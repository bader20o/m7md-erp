import { AttendanceEventStatus } from "@prisma/client";
import { ApiError, fail, ok } from "@/lib/api";
import { requireAttendanceAdmin } from "@/lib/attendance";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function buildRange(from: string | null, to: string | null): { from: string; to: string } {
  const now = new Date();
  const fallbackTo = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setDate(now.getDate() - 29);
  const fallbackFrom = fromDate.toISOString().slice(0, 10);
  const normalizedFrom = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : fallbackFrom;
  const normalizedTo = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : fallbackTo;
  return normalizedFrom <= normalizedTo
    ? { from: normalizedFrom, to: normalizedTo }
    : { from: normalizedTo, to: normalizedFrom };
}

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: Params): Promise<Response> {
  try {
    await requireAttendanceAdmin(await getSession());
    const { id } = await context.params;
    const url = new URL(request.url);
    const range = buildRange(url.searchParams.get("from"), url.searchParams.get("to"));

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            fullName: true,
            phone: true
          }
        }
      }
    });

    if (!employee) {
      throw new ApiError(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
    }

    const [days, rejectedEvents] = await Promise.all([
      prisma.attendanceDay.findMany({
        where: {
          employeeId: id,
          dayKey: {
            gte: range.from,
            lte: range.to
          }
        },
        orderBy: {
          dayKey: "desc"
        }
      }),
      prisma.attendanceEvent.findMany({
        where: {
          employeeId: id,
          dayKey: {
            gte: range.from,
            lte: range.to
          },
          status: AttendanceEventStatus.REJECTED
        },
        orderBy: [{ dayKey: "desc" }, { occurredAt: "desc" }]
      })
    ]);

    const dayMap = new Map<
      string,
      {
        dayKey: string;
        checkInAt: string | null;
        checkOutAt: string | null;
        workedMinutes: number | null;
        status: string;
        invalidAttempts: number;
        rejectedReasons: string[];
        flags: string[];
      }
    >();

    for (const day of days) {
      const flags: string[] = [];
      if (day.checkInAt && !day.checkOutAt) {
        flags.push("Missing checkout");
      }

      dayMap.set(day.dayKey, {
        dayKey: day.dayKey,
        checkInAt: day.checkInAt?.toISOString() ?? null,
        checkOutAt: day.checkOutAt?.toISOString() ?? null,
        workedMinutes: day.workedMinutes ?? null,
        status: day.status,
        invalidAttempts: 0,
        rejectedReasons: [],
        flags
      });
    }

    for (const event of rejectedEvents) {
      const entry =
        dayMap.get(event.dayKey) ??
        {
          dayKey: event.dayKey,
          checkInAt: null,
          checkOutAt: null,
          workedMinutes: null,
          status: "OPEN",
          invalidAttempts: 0,
          rejectedReasons: [],
          flags: []
        };

      entry.invalidAttempts += 1;
      if (event.rejectReason && !entry.rejectedReasons.includes(event.rejectReason)) {
        entry.rejectedReasons.push(event.rejectReason);
      }
      if (!entry.flags.includes("Invalid attempts")) {
        entry.flags.push("Invalid attempts");
      }

      dayMap.set(event.dayKey, entry);
    }

    const items = Array.from(dayMap.values()).sort((a, b) => b.dayKey.localeCompare(a.dayKey));

    return ok({
      employee: {
        id: employee.id,
        fullName: employee.user.fullName ?? employee.user.phone,
        phone: employee.user.phone
      },
      filters: range,
      days: items
    });
  } catch (error) {
    return fail(error);
  }
}
