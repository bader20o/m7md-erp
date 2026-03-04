import { createHmac, timingSafeEqual } from "node:crypto";
import { AttendanceDayStatus, AttendanceEventStatus, AttendanceType, EmployeeRoleProfile, Role } from "@prisma/client";
import { ApiError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";

const QR_PREFIX = "EVSC:ATTENDANCE";

const dayKeyFormatter = new Intl.DateTimeFormat("en", {
  timeZone: env.ATTENDANCE_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export type AttendanceScanResponse = {
  ok: boolean;
  status: "ACCEPTED" | "REJECTED";
  message: string;
  event: {
    id: string;
    type: AttendanceType;
    occurredAt: Date;
    dayKey: string;
  };
};

type AttendanceValidation =
  | { ok: true; type: AttendanceType }
  | { ok: false; message: string; reason: string; type: AttendanceType | null };

type AttendanceQrCodeData = {
  payload: string;
  slot: number;
  expiresAt: string;
  refreshEverySeconds: number;
};

function normalizeQrSegment(type: AttendanceType): "IN" | "OUT" {
  return type === AttendanceType.CHECK_IN ? "IN" : "OUT";
}

function getAttendanceQrSlot(at = Date.now()): number {
  return Math.floor(at / (env.ATTENDANCE_QR_ROTATION_SECONDS * 1000));
}

function getAttendanceQrExpiresAt(slot: number): string {
  return new Date((slot + 1) * env.ATTENDANCE_QR_ROTATION_SECONDS * 1000).toISOString();
}

function buildAttendanceQrSignature(type: AttendanceType, slot: number): string {
  return createHmac("sha256", env.ATTENDANCE_QR_SECRET)
    .update(`${QR_PREFIX}:${normalizeQrSegment(type)}:${slot}`)
    .digest("hex")
    .slice(0, 24);
}

function isSignatureMatch(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function normalizeIpv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return null;
  }

  let result = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return null;
    }

    const value = Number(part);
    if (value < 0 || value > 255) {
      return null;
    }

    result = (result << 8) + value;
  }

  return result >>> 0;
}

function normalizeIp(input: string): string {
  let value = input.trim();

  if (value.startsWith("::ffff:")) {
    value = value.slice(7);
  }

  if (value.startsWith("[") && value.includes("]:")) {
    value = value.slice(1, value.indexOf("]:"));
  } else if (value.includes(".") && value.lastIndexOf(":") > value.lastIndexOf(".")) {
    value = value.slice(0, value.lastIndexOf(":"));
  }

  return value.trim();
}

function matchesIpAllowlist(ipAddress: string, entry: string): boolean {
  const normalizedIp = normalizeIp(ipAddress);
  const normalizedEntry = normalizeIp(entry);

  if (!normalizedEntry) {
    return false;
  }

  if (!normalizedEntry.includes("/")) {
    return normalizedIp === normalizedEntry;
  }

  const [network, prefixRaw] = normalizedEntry.split("/");
  const prefix = Number(prefixRaw);
  const ipInt = normalizeIpv4(normalizedIp);
  const networkInt = normalizeIpv4(network);

  if (ipInt == null || networkInt == null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
  return (ipInt & mask) === (networkInt & mask);
}

function parseAttendanceQrText(qrText: string): AttendanceValidation {
  const parts = qrText.trim().split(":");
  if (parts.length !== 5 || parts[0] !== "EVSC" || parts[1] !== "ATTENDANCE") {
    return {
      ok: false,
      message: "Invalid attendance QR code.",
      reason: "INVALID_QR_FORMAT",
      type: null
    };
  }

  const type =
    parts[2] === "IN"
      ? AttendanceType.CHECK_IN
      : parts[2] === "OUT"
        ? AttendanceType.CHECK_OUT
        : null;

  if (!type) {
    return {
      ok: false,
      message: "Invalid attendance QR code.",
      reason: "INVALID_QR_TYPE",
      type: null
    };
  }

  const slot = Number(parts[3]);
  if (!Number.isInteger(slot) || slot < 0) {
    return {
      ok: false,
      message: "Invalid attendance QR code.",
      reason: "INVALID_QR_SLOT",
      type
    };
  }

  const currentSlot = getAttendanceQrSlot();
  if (slot > currentSlot || currentSlot - slot > env.ATTENDANCE_QR_GRACE_WINDOWS) {
    return {
      ok: false,
      message: "Attendance QR expired.",
      reason: "EXPIRED_QR",
      type
    };
  }

  const expectedSignature = buildAttendanceQrSignature(type, slot);
  if (!isSignatureMatch(parts[4], expectedSignature)) {
    return {
      ok: false,
      message: "Invalid attendance QR code.",
      reason: "INVALID_QR_SECRET",
      type
    };
  }

  return { ok: true, type };
}

function getRejectedMessage(reason: string): string {
  switch (reason) {
    case "ALREADY_CHECKED_IN":
      return "Already checked in today";
    case "ALREADY_CHECKED_OUT":
      return "Already checked out today";
    case "CHECK_OUT_BEFORE_CHECK_IN":
      return "Cannot check out before check in";
    case "IP_NOT_ALLOWED":
      return "Scanning is only allowed from the service center network.";
    case "EXPIRED_QR":
      return "QR expired. Scan the current code on the attendance screen.";
    default:
      return "Invalid attendance QR code.";
  }
}

export function getAttendanceEventMessage(
  type: AttendanceType,
  status: AttendanceEventStatus | "ACCEPTED" | "REJECTED",
  rejectReason: string | null
): string {
  const isRejected = status === "REJECTED";

  if (isRejected) {
    return getRejectedMessage(rejectReason ?? "INVALID_QR_FORMAT");
  }

  return type === AttendanceType.CHECK_IN ? "Checked in successfully" : "Checked out successfully";
}

function getWorkedMinutes(start: Date, end: Date): number {
  return Math.max(Math.round((end.getTime() - start.getTime()) / 60000), 0);
}

export function getAttendanceDayKey(value: Date): string {
  const parts = dayKeyFormatter.formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
}

export function getAttendanceQrPayload(type: AttendanceType): string {
  const slot = getAttendanceQrSlot();
  return `${QR_PREFIX}:${normalizeQrSegment(type)}:${slot}:${buildAttendanceQrSignature(type, slot)}`;
}

export function getFixedAttendancePayloads(): { checkIn: string; checkOut: string } {
  return {
    checkIn: getAttendanceQrPayload(AttendanceType.CHECK_IN),
    checkOut: getAttendanceQrPayload(AttendanceType.CHECK_OUT)
  };
}

export function getAttendanceQrCodeData(type: AttendanceType): AttendanceQrCodeData {
  const slot = getAttendanceQrSlot();
  return {
    payload: `${QR_PREFIX}:${normalizeQrSegment(type)}:${slot}:${buildAttendanceQrSignature(type, slot)}`,
    slot,
    expiresAt: getAttendanceQrExpiresAt(slot),
    refreshEverySeconds: env.ATTENDANCE_QR_ROTATION_SECONDS
  };
}

export function getAttendanceQrCodes(): { checkIn: AttendanceQrCodeData; checkOut: AttendanceQrCodeData } {
  return {
    checkIn: getAttendanceQrCodeData(AttendanceType.CHECK_IN),
    checkOut: getAttendanceQrCodeData(AttendanceType.CHECK_OUT)
  };
}

export function isAttendanceManualEntryEnabled(): boolean {
  return env.ATTENDANCE_MANUAL_ENTRY_ENABLED;
}

export function resolveAttendanceRequestIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const candidate = forwarded?.split(",")[0]?.trim() ?? realIp?.trim() ?? null;
  return candidate ? normalizeIp(candidate) : null;
}

export function isAttendanceIpRestricted(): boolean {
  return env.ATTENDANCE_ALLOWED_IPS
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean).length > 0;
}

export function isAttendanceIpAllowed(ipAddress: string | null): boolean {
  const entries = env.ATTENDANCE_ALLOWED_IPS
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    return true;
  }

  if (!ipAddress) {
    return false;
  }

  return entries.some((entry) => matchesIpAllowlist(ipAddress, entry));
}

export async function requireAttendanceAdmin(session: SessionPayload | null): Promise<SessionPayload> {
  const activeSession = requireSession(session);
  if (activeSession.role === Role.ADMIN) {
    return activeSession;
  }

  if (activeSession.role !== Role.EMPLOYEE) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission for this resource.");
  }

  const employee = await prisma.employee.findUnique({
    where: { userId: activeSession.sub },
    select: { roleProfile: true }
  });

  if (employee?.roleProfile !== EmployeeRoleProfile.MANAGER) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission for this resource.");
  }

  return activeSession;
}

export async function requireAttendanceEmployee(session: SessionPayload | null): Promise<{
  session: SessionPayload;
  employee: {
    id: string;
    userId: string;
    roleProfile: EmployeeRoleProfile;
  };
}> {
  const activeSession = requireSession(session);
  const employee = await prisma.employee.findUnique({
    where: { userId: activeSession.sub },
    select: {
      id: true,
      userId: true,
      roleProfile: true
    }
  });

  if (!employee) {
    throw new ApiError(403, "EMPLOYEE_ONLY", "Only employees can access attendance scanning.");
  }

  return {
    session: activeSession,
    employee
  };
}

export async function recordAttendanceScan(input: {
  employeeId: string;
  qrText: string;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<AttendanceScanResponse> {
  const occurredAt = new Date();
  const dayKey = getAttendanceDayKey(occurredAt);
  const qrValidation = parseAttendanceQrText(input.qrText);

  let rejectedReason = qrValidation.ok ? null : qrValidation.reason;
  let type = qrValidation.ok ? qrValidation.type : qrValidation.type ?? AttendanceType.CHECK_IN;

  if (!rejectedReason && !isAttendanceIpAllowed(input.ipAddress)) {
    rejectedReason = "IP_NOT_ALLOWED";
  }

  return prisma.$transaction(async (tx) => {
    const currentDay = await tx.attendanceDay.findUnique({
      where: {
        employeeId_dayKey: {
          employeeId: input.employeeId,
          dayKey
        }
      }
    });

    if (!rejectedReason) {
      if (type === AttendanceType.CHECK_IN && currentDay?.checkInAt) {
        rejectedReason = "ALREADY_CHECKED_IN";
      } else if (type === AttendanceType.CHECK_OUT && !currentDay?.checkInAt) {
        rejectedReason = "CHECK_OUT_BEFORE_CHECK_IN";
      } else if (type === AttendanceType.CHECK_OUT && currentDay?.checkOutAt) {
        rejectedReason = "ALREADY_CHECKED_OUT";
      }
    }

    const status =
      rejectedReason == null ? AttendanceEventStatus.ACCEPTED : AttendanceEventStatus.REJECTED;
    const message = getAttendanceEventMessage(type, status, rejectedReason);

    const event = await tx.attendanceEvent.create({
      data: {
        employeeId: input.employeeId,
        type,
        occurredAt,
        dayKey,
        status,
        rejectReason: rejectedReason,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent
      }
    });

    if (status === AttendanceEventStatus.ACCEPTED) {
      if (type === AttendanceType.CHECK_IN) {
        await tx.attendanceDay.upsert({
          where: {
            employeeId_dayKey: {
              employeeId: input.employeeId,
              dayKey
            }
          },
          update: {
            checkInAt: occurredAt,
            status: AttendanceDayStatus.OPEN
          },
          create: {
            employeeId: input.employeeId,
            dayKey,
            checkInAt: occurredAt,
            status: AttendanceDayStatus.OPEN
          }
        });

        await tx.attendance.create({
          data: {
            employeeId: input.employeeId,
            checkInAt: occurredAt,
            qrPayload: getAttendanceQrPayload(AttendanceType.CHECK_IN)
          }
        });
      } else {
        const checkInAt = currentDay?.checkInAt ?? occurredAt;
        const workedMinutes = getWorkedMinutes(checkInAt, occurredAt);

        await tx.attendanceDay.upsert({
          where: {
            employeeId_dayKey: {
              employeeId: input.employeeId,
              dayKey
            }
          },
          update: {
            checkOutAt: occurredAt,
            workedMinutes,
            status: AttendanceDayStatus.CLOSED
          },
          create: {
            employeeId: input.employeeId,
            dayKey,
            checkInAt,
            checkOutAt: occurredAt,
            workedMinutes,
            status: AttendanceDayStatus.CLOSED
          }
        });

        const openLegacyAttendance = await tx.attendance.findFirst({
          where: {
            employeeId: input.employeeId,
            checkOutAt: null
          },
          orderBy: {
            checkInAt: "desc"
          }
        });

        if (openLegacyAttendance) {
          await tx.attendance.update({
            where: { id: openLegacyAttendance.id },
            data: { checkOutAt: occurredAt }
          });
        } else {
          await tx.attendance.create({
            data: {
              employeeId: input.employeeId,
              checkInAt,
              checkOutAt: occurredAt,
              qrPayload: getAttendanceQrPayload(AttendanceType.CHECK_OUT)
            }
          });
        }
      }
    }

    return {
      ok: status === AttendanceEventStatus.ACCEPTED,
      status: status === AttendanceEventStatus.ACCEPTED ? "ACCEPTED" : "REJECTED",
      message,
      event: {
        id: event.id,
        type: event.type,
        occurredAt: event.occurredAt,
        dayKey: event.dayKey
      }
    };
  });
}
