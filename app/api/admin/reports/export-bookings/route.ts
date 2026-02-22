import { Role } from "@prisma/client";
import { fail } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { adminAnalyticsSummaryQuerySchema } from "@/lib/validators/admin-analytics";
import { parseDateOnlyUtc } from "@/lib/validators/reports";

const DAY_MS = 24 * 60 * 60 * 1000;

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "bigint") return Number(value);
  if (value && typeof value === "object" && "toString" in value) {
    return Number(value.toString());
  }
  return 0;
}

export async function GET(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ADMIN]);
    const url = new URL(request.url);
    const query = await adminAnalyticsSummaryQuerySchema.parseAsync({
      from: url.searchParams.get("from") ?? "",
      to: url.searchParams.get("to") ?? ""
    });

    const fromStart = parseDateOnlyUtc(query.from);
    const toStart = parseDateOnlyUtc(query.to);
    const toEnd = new Date(toStart.getTime() + DAY_MS - 1);

    const items = await prisma.booking.findMany({
      where: {
        appointmentAt: {
          gte: fromStart,
          lte: toEnd
        }
      },
      include: {
        customer: {
          select: {
            fullName: true,
            phone: true
          }
        },
        performedByEmployee: {
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
      orderBy: [{ appointmentAt: "desc" }, { createdAt: "desc" }]
    });

    const rows: unknown[][] = [
      [
        "Appointment Date",
        "Completed Date",
        "Booking ID",
        "Status",
        "Customer",
        "Service EN",
        "Service AR",
        "Employee",
        "Final Price"
      ]
    ];

    for (const item of items) {
      rows.push([
        item.appointmentAt.toISOString(),
        item.completedAt ? item.completedAt.toISOString() : "",
        item.id,
        item.status,
        item.customer.fullName ?? item.customer.phone,
        item.serviceNameSnapshotEn,
        item.serviceNameSnapshotAr,
        item.performedByEmployee?.user.fullName ?? item.performedByEmployee?.user.phone ?? "",
        item.finalPrice ? toNumber(item.finalPrice).toFixed(2) : ""
      ]);
    }

    const csv = toCsv(rows);
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bookings-${query.from}-to-${query.to}.csv"`
      }
    });
  } catch (error) {
    return fail(error);
  }
}

