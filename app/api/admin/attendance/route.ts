import { AttendanceEventStatus } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import {
  getAttendanceQrCodes,
  getAttendanceDayKey,
  getAttendanceEventMessage,
  isAttendanceIpRestricted,
  requireAttendanceAdmin
} from "@/lib/attendance";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import QRCode from "qrcode";

function defaultFromDate(): string {
  const value = new Date();
  value.setDate(value.getDate() - 13);
  return getAttendanceDayKey(value);
}

function buildRange(from: string | null, to: string | null): { from: string; to: string } {
  const normalizedFrom = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : defaultFromDate();
  const normalizedTo = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : getAttendanceDayKey(new Date());
  return normalizedFrom <= normalizedTo
    ? { from: normalizedFrom, to: normalizedTo }
    : { from: normalizedTo, to: normalizedFrom };
}

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAttendanceAdmin(await getSession());

    const url = new URL(request.url);
    const range = buildRange(url.searchParams.get("from"), url.searchParams.get("to"));
    const employeeQuery = url.searchParams.get("employeeQuery")?.trim() ?? "";
    const statusParam = url.searchParams.get("status")?.trim().toUpperCase();
    const status =
      statusParam === AttendanceEventStatus.ACCEPTED || statusParam === AttendanceEventStatus.REJECTED
        ? statusParam
        : undefined;
    const pageParam = Number(url.searchParams.get("page") ?? "1");
    const pageSizeParam = Number(url.searchParams.get("pageSize") ?? "50");
    const page = Number.isFinite(pageParam) ? Math.max(Math.trunc(pageParam), 1) : 1;
    const pageSize = Number.isFinite(pageSizeParam) ? Math.min(Math.max(Math.trunc(pageSizeParam), 1), 100) : 50;
    const skip = (page - 1) * pageSize;

    const filters = {
      dayKey: {
        gte: range.from,
        lte: range.to
      },
      ...(status ? { status } : {}),
      ...(employeeQuery
        ? {
            employee: {
              user: {
                OR: [
                  { fullName: { contains: employeeQuery, mode: "insensitive" as const } },
                  { phone: { contains: employeeQuery, mode: "insensitive" as const } }
                ]
              }
            }
          }
        : {})
    };

    const todayDayKey = getAttendanceDayKey(new Date());

    const qrCodes = getAttendanceQrCodes();

    const [total, events, checkedInToday, checkedOutToday, missingCheckOutToday, checkInQrImage, checkOutQrImage] =
      await Promise.all([
      prisma.attendanceEvent.count({ where: filters }),
      prisma.attendanceEvent.findMany({
        where: filters,
        include: {
          employee: {
            include: {
              user: {
                select: {
                  fullName: true,
                  phone: true
                }
              }
            }
          }
        },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: pageSize
      }),
      prisma.attendanceDay.count({
        where: {
          dayKey: todayDayKey,
          checkInAt: { not: null }
        }
      }),
      prisma.attendanceDay.count({
        where: {
          dayKey: todayDayKey,
          checkOutAt: { not: null }
        }
      }),
      prisma.attendanceDay.count({
        where: {
          dayKey: todayDayKey,
          checkInAt: { not: null },
          checkOutAt: null
        }
      }),
      QRCode.toDataURL(qrCodes.checkIn.payload, {
        margin: 1,
        width: 240,
        color: {
          dark: "#E5EEF9",
          light: "#08101E"
        }
      }),
      QRCode.toDataURL(qrCodes.checkOut.payload, {
        margin: 1,
        width: 240,
        color: {
          dark: "#E5EEF9",
          light: "#08101E"
        }
      })
    ]);

    return ok({
      filters: {
        from: range.from,
        to: range.to,
        employeeQuery,
        status: status ?? ""
      },
      summary: {
        todayDayKey,
        checkedInCount: checkedInToday,
        checkedOutCount: checkedOutToday,
        missingCheckOutCount: missingCheckOutToday
      },
      fixedQr: {
        ipRestricted: isAttendanceIpRestricted(),
        refreshEverySeconds: qrCodes.checkIn.refreshEverySeconds,
        checkIn: {
          payload: qrCodes.checkIn.payload,
          expiresAt: qrCodes.checkIn.expiresAt,
          imageDataUrl: checkInQrImage
        },
        checkOut: {
          payload: qrCodes.checkOut.payload,
          expiresAt: qrCodes.checkOut.expiresAt,
          imageDataUrl: checkOutQrImage
        }
      },
      pagination: {
        page,
        pageSize,
        total,
        pageCount: Math.max(Math.ceil(total / pageSize), 1)
      },
      events: events.map((event) => ({
        id: event.id,
        employeeId: event.employeeId,
        employeeName: event.employee.user.fullName ?? event.employee.user.phone,
        employeePhone: event.employee.user.phone,
        type: event.type,
        timestamp: event.occurredAt.toISOString(),
        dayKey: event.dayKey,
        result: event.status,
        status: event.status,
        message: getAttendanceEventMessage(event.type, event.status, event.rejectReason),
        rejectReason: event.rejectReason,
        source: "QR"
      }))
    });
  } catch (error) {
    return fail(error);
  }
}
