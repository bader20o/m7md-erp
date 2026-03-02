import { BookingStatus, EmploymentStatus, EmployeeRoleProfile, Prisma, Role, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const EMPLOYEE_ROLE_OPTIONS = [
  "ADMIN",
  "MANAGER",
  "RECEPTION",
  "ACCOUNTANT",
  "TECHNICIAN",
  "EMPLOYEE"
] as const;

function formatCodeLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatAuditActionLabel(action: string, entity?: string | null): string {
  switch (action) {
    case "EMPLOYEE_RESEND_CREDENTIALS":
      return "Credentials resent by Admin";
    case "EMPLOYEE_RESET_PASSWORD":
      return "Password reset by Admin";
    case "EMPLOYEE_FORCE_PASSWORD_RESET":
      return "Password reset required by Admin";
    case "EMPLOYEE_FORCE_LOGOUT_ALL":
      return "All sessions signed out by Admin";
    case "EMPLOYEE_SUSPEND":
      return "Employee suspended by Admin";
    case "EMPLOYEE_ACTIVATE":
    case "EMPLOYEE_UNBAN":
      return "Employee reactivated by Admin";
    case "EMPLOYEE_BAN":
      return "Employee banned by Admin";
    case "EMPLOYEE_UPDATE_PROFILE":
      return "Profile updated by Admin";
    case "EMPLOYEE_UPDATE_HR":
      return "HR details updated by Admin";
    case "EMPLOYEE_UPDATE_PERMISSIONS":
    case "EMPLOYEE_UPDATE_ROLE_PERMISSIONS":
      return "Permissions updated by Admin";
    case "LOGIN":
      return "Signed in";
    case "LOGOUT":
      return "Signed out";
    default:
      return entity ? `${formatCodeLabel(action)} (${formatCodeLabel(entity)})` : formatCodeLabel(action);
  }
}

export type EmployeeOverrideFlags = {
  canManageBookings: boolean;
  canAccessAccounting: boolean;
  canEditInventory: boolean;
  canManageEmployees: boolean;
  canViewReports: boolean;
  canIssueRefunds: boolean;
};

export function roleDefaultOverrides(roleProfile: EmployeeRoleProfile): EmployeeOverrideFlags {
  switch (roleProfile) {
    case "ADMIN":
      return {
        canManageBookings: true,
        canAccessAccounting: true,
        canEditInventory: true,
        canManageEmployees: true,
        canViewReports: true,
        canIssueRefunds: true
      };
    case "MANAGER":
      return {
        canManageBookings: true,
        canAccessAccounting: true,
        canEditInventory: true,
        canManageEmployees: true,
        canViewReports: true,
        canIssueRefunds: true
      };
    case "RECEPTION":
      return {
        canManageBookings: true,
        canAccessAccounting: false,
        canEditInventory: false,
        canManageEmployees: false,
        canViewReports: true,
        canIssueRefunds: true
      };
    case "ACCOUNTANT":
      return {
        canManageBookings: false,
        canAccessAccounting: true,
        canEditInventory: false,
        canManageEmployees: false,
        canViewReports: true,
        canIssueRefunds: true
      };
    case "TECHNICIAN":
      return {
        canManageBookings: false,
        canAccessAccounting: false,
        canEditInventory: true,
        canManageEmployees: false,
        canViewReports: false,
        canIssueRefunds: false
      };
    default:
      return {
        canManageBookings: false,
        canAccessAccounting: false,
        canEditInventory: false,
        canManageEmployees: false,
        canViewReports: false,
        canIssueRefunds: false
      };
  }
}

export function normalizeOverrides(value: Prisma.JsonValue | null | undefined): EmployeeOverrideFlags {
  const defaults = roleDefaultOverrides(EmployeeRoleProfile.EMPLOYEE);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  return {
    canManageBookings: Boolean(value.canManageBookings),
    canAccessAccounting: Boolean(value.canAccessAccounting),
    canEditInventory: Boolean(value.canEditInventory),
    canManageEmployees: Boolean(value.canManageEmployees),
    canViewReports: Boolean(value.canViewReports),
    canIssueRefunds: Boolean(value.canIssueRefunds)
  };
}

export function effectiveOverrides(roleProfile: EmployeeRoleProfile, value: Prisma.JsonValue | null | undefined): EmployeeOverrideFlags {
  const defaults = roleDefaultOverrides(roleProfile);
  const overrides = normalizeOverrides(value);
  return {
    canManageBookings: overrides.canManageBookings,
    canAccessAccounting: overrides.canAccessAccounting,
    canEditInventory: overrides.canEditInventory,
    canManageEmployees: overrides.canManageEmployees,
    canViewReports: overrides.canViewReports,
    canIssueRefunds: overrides.canIssueRefunds || defaults.canIssueRefunds
  };
}

export function getEmployeeStatusLabel(userStatus: UserStatus, employmentStatus: EmploymentStatus): "ACTIVE" | "SUSPENDED" | "BANNED" | "ON_LEAVE" {
  if (userStatus === UserStatus.BANNED) return "BANNED";
  if (userStatus === UserStatus.SUSPENDED) return "SUSPENDED";
  if (employmentStatus === EmploymentStatus.ON_LEAVE) return "ON_LEAVE";
  return "ACTIVE";
}

function parseUserAgent(userAgent: string | null): { device: string | null; browser: string | null } {
  if (!userAgent) {
    return { device: null, browser: null };
  }

  const browser =
    /Edg\//.test(userAgent)
      ? "Edge"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : /Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)
            ? "Safari"
            : /MSIE|Trident/.test(userAgent)
              ? "Internet Explorer"
              : "Unknown";

  const device =
    /Mobile|Android|iPhone/i.test(userAgent)
      ? "Mobile"
      : /iPad|Tablet/i.test(userAgent)
        ? "Tablet"
        : "Desktop";

  return { device, browser };
}

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return Number(value);
}

type PerformanceRange = {
  from: Date;
  to: Date;
};

export function resolvePerformanceRange(from?: string | null, to?: string | null): PerformanceRange {
  const now = new Date();
  const rangeTo = to ? new Date(to) : now;
  const rangeFrom = from ? new Date(from) : new Date(rangeTo.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { from: rangeFrom, to: rangeTo };
}

function formatDurationHours(totalMs: number): string {
  const hours = totalMs / (1000 * 60 * 60);
  return `${hours.toFixed(1)} h`;
}

export async function buildEmployeePerformance(
  employeeId: string,
  userId: string,
  roleProfile: EmployeeRoleProfile,
  range: PerformanceRange
): Promise<{
  range: { from: string; to: string };
  cards: Array<{ key: string; label: string; value: string }>;
  rows: Array<Record<string, string | number | null>>;
}> {
  if (roleProfile === EmployeeRoleProfile.RECEPTION) {
    const bookings = await prisma.booking.findMany({
      where: {
        createdByUserId: userId,
        createdAt: { gte: range.from, lte: range.to }
      },
      select: {
        id: true,
        status: true,
        finalPrice: true,
        createdAt: true,
        completedAt: true,
        serviceNameSnapshotEn: true,
        customer: { select: { fullName: true, phone: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 8
    });

    const completed = bookings.filter((item) => item.status === BookingStatus.COMPLETED);
    const avgHandlingTime =
      completed.length > 0
        ? Math.round(
            completed.reduce((sum, item) => {
              if (!item.completedAt) return sum;
              return sum + (item.completedAt.getTime() - item.createdAt.getTime()) / 60000;
            }, 0) / completed.length
          )
        : 0;

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      cards: [
        { key: "bookingsHandled", label: "Bookings handled", value: `${bookings.length}` },
        {
          key: "revenueProcessed",
          label: "Revenue processed",
          value: `${completed.reduce((sum, item) => sum + toNumber(item.finalPrice), 0).toFixed(2)}`
        },
        { key: "avgHandlingTime", label: "Avg. handling time", value: `${avgHandlingTime} min` }
      ],
      rows: bookings.map((item) => ({
        id: item.id,
        date: item.createdAt.toISOString(),
        service: item.serviceNameSnapshotEn,
        customer: item.customer.fullName || item.customer.phone,
        status: item.status,
        amount: toNumber(item.finalPrice)
      }))
    };
  }

  if (roleProfile === EmployeeRoleProfile.ACCOUNTANT) {
    const invoices = await prisma.invoiceLine.findMany({
      where: {
        createdById: userId,
        createdAt: { gte: range.from, lte: range.to }
      },
      select: {
        id: true,
        description: true,
        lineTotal: true,
        createdAt: true,
        invoice: { select: { number: true, status: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 8
    });

    return {
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      cards: [
        { key: "invoicesProcessed", label: "Invoices processed", value: `${invoices.length}` },
        {
          key: "totalMoneyHandled",
          label: "Total money handled",
          value: `${invoices.reduce((sum, item) => sum + toNumber(item.lineTotal), 0).toFixed(2)}`
        }
      ],
      rows: invoices.map((item) => ({
        id: item.id,
        date: item.createdAt.toISOString(),
        invoice: item.invoice.number,
        description: item.description,
        amount: toNumber(item.lineTotal),
        status: item.invoice.status
      }))
    };
  }

  const jobs = await prisma.booking.findMany({
    where: {
      performedByEmployeeId: employeeId,
      createdAt: { gte: range.from, lte: range.to }
    },
    select: {
      id: true,
      status: true,
      finalPrice: true,
      completedAt: true,
      serviceNameSnapshotEn: true,
      createdAt: true,
      customer: { select: { fullName: true, phone: true } },
      review: { select: { rating: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 8
  });

  const completedJobs = jobs.filter((item) => item.status === BookingStatus.COMPLETED);
  const ratedJobs = jobs.filter((item) => item.review?.rating != null);
  const ratingAverage =
    ratedJobs.length > 0
      ? (ratedJobs.reduce((sum, item) => sum + Number(item.review?.rating || 0), 0) / ratedJobs.length).toFixed(1)
      : "0.0";

  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    cards: [
      { key: "jobsCompleted", label: "Jobs completed", value: `${completedJobs.length}` },
      {
        key: "revenueGenerated",
        label: "Revenue generated",
        value: `${completedJobs.reduce((sum, item) => sum + toNumber(item.finalPrice), 0).toFixed(2)}`
      },
      { key: "avgCustomerRating", label: "Avg. customer rating", value: ratingAverage }
    ],
    rows: jobs.map((item) => ({
      id: item.id,
      date: item.createdAt.toISOString(),
      service: item.serviceNameSnapshotEn,
      customer: item.customer.fullName || item.customer.phone,
      status: item.status,
      amount: toNumber(item.finalPrice),
      rating: item.review?.rating ?? null
    }))
  };
}

export async function buildEmployeeActivity(userId: string, employeeId: string, range?: PerformanceRange) {
  const createdAtFilter = range ? { gte: range.from, lte: range.to } : undefined;
  const [recentActions, recentEntityActions, sessionEvents] = await Promise.all([
    prisma.auditLog.findMany({
      where: { actorId: userId, ...(createdAtFilter ? { createdAt: createdAtFilter } : {}) },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    prisma.auditLog.findMany({
      where: { entity: "Employee", entityId: employeeId, ...(createdAtFilter ? { createdAt: createdAtFilter } : {}) },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    prisma.auditLog.findMany({
      where: {
        actorId: userId,
        action: { in: ["LOGIN", "LOGOUT"] },
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {})
      },
      orderBy: { createdAt: "desc" },
      take: 8
    })
  ]);

  const merged = [...recentActions, ...recentEntityActions]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index);

  const lastActive = merged[0]?.createdAt ?? null;
  const lastLogin = sessionEvents.find((item) => item.action === "LOGIN") ?? null;
  const lastLogout = sessionEvents.find((item) => item.action === "LOGOUT") ?? null;
  const uaValue =
    (typeof lastLogin?.payload === "object" && lastLogin?.payload && "userAgent" in lastLogin.payload
      ? String(lastLogin.payload.userAgent)
      : null) ?? null;
  const parsedUserAgent = parseUserAgent(uaValue);

  return {
    security: {
      lastLoginAt: lastLogin?.createdAt.toISOString() ?? null,
      lastLogoutAt: lastLogout?.createdAt.toISOString() ?? null,
      lastActiveAt: lastActive?.toISOString() ?? null,
      device: parsedUserAgent.device,
      browser: parsedUserAgent.browser,
      ipAddress: lastLogin?.ipAddress ?? null,
      userAgent: uaValue
    },
    activity: merged.slice(0, 12).map((item) => ({
      id: item.id,
      action: formatAuditActionLabel(item.action, item.entity),
      actionCode: item.action,
      entity: item.entity,
      entityId: item.entityId,
      ipAddress: item.ipAddress,
      createdAt: item.createdAt.toISOString()
    })),
    recentActivity: merged.slice(0, 3).map((item) => ({
      id: item.id,
      action: formatAuditActionLabel(item.action, item.entity),
      actionCode: item.action,
      entity: item.entity,
      createdAt: item.createdAt.toISOString()
    })),
    sessions: sessionEvents.map((item) => ({
      id: item.id,
      action: formatAuditActionLabel(item.action, item.entity),
      actionCode: item.action,
      createdAt: item.createdAt.toISOString(),
      ipAddress: item.ipAddress,
      userAgent:
        typeof item.payload === "object" && item.payload && "userAgent" in item.payload
          ? String(item.payload.userAgent)
          : null
    }))
  };
}

export async function buildEmployeeAttendance(employeeId: string, range?: PerformanceRange) {
  const checkInFilter = range ? { gte: range.from, lte: range.to } : undefined;
  const [latestCheckIn, latestCheckOut, records] = await Promise.all([
    prisma.attendance.findFirst({
      where: { employeeId },
      orderBy: { checkInAt: "desc" },
      select: { checkInAt: true }
    }),
    prisma.attendance.findFirst({
      where: { employeeId, checkOutAt: { not: null } },
      orderBy: { checkOutAt: "desc" },
      select: { checkOutAt: true }
    }),
    prisma.attendance.findMany({
      where: { employeeId, ...(checkInFilter ? { checkInAt: checkInFilter } : {}) },
      orderBy: { checkInAt: "desc" },
      take: 60,
      select: {
        id: true,
        checkInAt: true,
        checkOutAt: true,
        qrPayload: true
      }
    })
  ]);

  const attendanceLog = records.flatMap((record) => {
    const baseDate = record.checkInAt.toISOString().slice(0, 10);
    const source = record.qrPayload ? "QR Scan" : "Manual";
    const entries = [
      {
        id: `${record.id}:in`,
        date: baseDate,
        action: "Check-in",
        time: record.checkInAt.toISOString(),
        source,
        ipAddress: null as string | null
      }
    ];

    if (record.checkOutAt) {
      entries.push({
        id: `${record.id}:out`,
        date: record.checkOutAt.toISOString().slice(0, 10),
        action: "Check-out",
        time: record.checkOutAt.toISOString(),
        source,
        ipAddress: null as string | null
      });
    }

    return entries;
  });

  const summaryBase = range?.to ?? new Date();
  const summaryMonth = summaryBase.getUTCMonth();
  const summaryYear = summaryBase.getUTCFullYear();
  const monthlyRecords = records.filter(
    (record) => record.checkInAt.getUTCMonth() === summaryMonth && record.checkInAt.getUTCFullYear() === summaryYear
  );
  const presentDays = new Set(monthlyRecords.map((record) => record.checkInAt.toISOString().slice(0, 10))).size;
  const completedShifts = monthlyRecords.filter((record) => record.checkOutAt).length;
  const totalWorkedMs = monthlyRecords.reduce((sum, record) => {
    if (!record.checkOutAt) return sum;
    return sum + (record.checkOutAt.getTime() - record.checkInAt.getTime());
  }, 0);

  return {
    snapshot: {
      lastCheckInAt: latestCheckIn?.checkInAt.toISOString() ?? null,
      lastCheckOutAt: latestCheckOut?.checkOutAt?.toISOString() ?? null
    },
    log: attendanceLog,
    monthlySummary:
      monthlyRecords.length > 0
        ? {
            month: `${summaryYear}-${String(summaryMonth + 1).padStart(2, "0")}`,
            presentDays,
            completedShifts,
            totalWorkedHours: formatDurationHours(totalWorkedMs)
          }
        : null
  };
}

export function canEditEmployeeFullProfile(actorRole: Role, actorEmployeeRoleProfile?: EmployeeRoleProfile | null): boolean {
  if (actorRole === Role.ADMIN) {
    return true;
  }
  return actorEmployeeRoleProfile === EmployeeRoleProfile.MANAGER;
}
