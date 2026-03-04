import { AttendanceEventStatus } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import {
  getAttendanceDayKey,
  getAttendanceEventMessage,
  isAttendanceIpRestricted,
  isAttendanceManualEntryEnabled,
  requireAttendanceEmployee
} from "@/lib/attendance";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request): Promise<Response> {
  try {
    const { employee } = await requireAttendanceEmployee(await getSession());
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 50;
    const todayDayKey = getAttendanceDayKey(new Date());

    const [events, today] = await Promise.all([
      prisma.attendanceEvent.findMany({
        where: { employeeId: employee.id },
        orderBy: { occurredAt: "desc" },
        take: limit
      }),
      prisma.attendanceDay.findUnique({
        where: {
          employeeId_dayKey: {
            employeeId: employee.id,
            dayKey: todayDayKey
          }
        }
      })
    ]);

    return ok({
      manualEntryEnabled: isAttendanceManualEntryEnabled(),
      security: {
        ipRestricted: isAttendanceIpRestricted()
      },
      todayStatus: {
        dayKey: todayDayKey,
        checkedInAt: today?.checkInAt?.toISOString() ?? null,
        checkedOutAt: today?.checkOutAt?.toISOString() ?? null,
        canCheckIn: !today?.checkInAt,
        canCheckOut: Boolean(today?.checkInAt) && !today?.checkOutAt
      },
      events: events.map((event) => ({
        id: event.id,
        type: event.type,
        occurredAt: event.occurredAt.toISOString(),
        dayKey: event.dayKey,
        status: event.status,
        rejectReason: event.rejectReason,
        message: getAttendanceEventMessage(event.type, event.status, event.rejectReason),
        source: "QR"
      }))
    });
  } catch (error) {
    return fail(error);
  }
}
