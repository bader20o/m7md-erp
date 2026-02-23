import { BookingStatus, ExpenseCategory, IncomeSource, TransactionType } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { analyticsRangeQuerySchema, parseDateOnlyUtc } from "@/lib/validators/reports";

const DAY_MS = 24 * 60 * 60 * 1000;

type DailyPoint = {
  date: string;
  income: number;
  expense: number;
  bookingIncome: number;
  walkInIncome: number;
  membershipIncome: number;
};

function toDayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string") {
    return Number(value);
  }
  if (value && typeof value === "object" && "toString" in value) {
    return Number(value.toString());
  }
  return 0;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function enumerateDayKeys(from: Date, to: Date): string[] {
  const keys: string[] = [];
  for (let current = from.getTime(); current <= to.getTime(); current += DAY_MS) {
    keys.push(toDayKey(new Date(current)));
  }
  return keys;
}

export async function GET(request: Request): Promise<Response> {
  try {
    await requirePermission(await getSession(), "analytics");

    const url = new URL(request.url);
    const query = await analyticsRangeQuerySchema.parseAsync({
      from: url.searchParams.get("from") ?? "",
      to: url.searchParams.get("to") ?? ""
    });

    const fromStart = parseDateOnlyUtc(query.from);
    const toStart = parseDateOnlyUtc(query.to);
    const toEnd = new Date(toStart.getTime() + DAY_MS - 1);

    const [ledgerRows, completedAggregate, completedBookingsCount, pendingBookingsCount, noShowCount, cancellationCount, topServicesRaw, topCustomersRaw, topEmployeesRaw, recentTransactionsRaw] =
      await Promise.all([
        prisma.transaction.findMany({
          where: {
            recordedAt: {
              gte: fromStart,
              lte: toEnd
            }
          },
          select: {
            type: true,
            incomeSource: true,
            expenseCategory: true,
            amount: true,
            recordedAt: true
          }
        }),
        prisma.booking.aggregate({
          where: {
            status: BookingStatus.COMPLETED,
            finalPrice: { not: null },
            completedAt: {
              gte: fromStart,
              lte: toEnd
            }
          },
          _avg: { finalPrice: true }
        }),
        prisma.booking.count({
          where: {
            status: BookingStatus.COMPLETED,
            completedAt: {
              gte: fromStart,
              lte: toEnd
            }
          }
        }),
        prisma.booking.count({
          where: {
            status: BookingStatus.PENDING,
            appointmentAt: {
              gte: fromStart,
              lte: toEnd
            }
          }
        }),
        prisma.booking.count({
          where: {
            status: BookingStatus.NO_SHOW,
            appointmentAt: {
              gte: fromStart,
              lte: toEnd
            }
          }
        }),
        prisma.booking.count({
          where: {
            status: { in: [BookingStatus.CANCELLED, BookingStatus.LATE_CANCELLED] },
            appointmentAt: {
              gte: fromStart,
              lte: toEnd
            }
          }
        }),
        prisma.booking.groupBy({
          by: ["serviceNameSnapshotEn", "serviceNameSnapshotAr"],
          where: {
            status: BookingStatus.COMPLETED,
            finalPrice: { not: null },
            completedAt: {
              gte: fromStart,
              lte: toEnd
            }
          },
          _sum: { finalPrice: true },
          _count: { _all: true },
          orderBy: { _sum: { finalPrice: "desc" } },
          take: 10
        }),
        prisma.booking.groupBy({
          by: ["customerId"],
          where: {
            status: BookingStatus.COMPLETED,
            finalPrice: { not: null },
            completedAt: {
              gte: fromStart,
              lte: toEnd
            }
          },
          _sum: { finalPrice: true },
          _count: { _all: true },
          orderBy: { _sum: { finalPrice: "desc" } },
          take: 10
        }),
        prisma.booking.groupBy({
          by: ["performedByEmployeeId"],
          where: {
            status: BookingStatus.COMPLETED,
            finalPrice: { not: null },
            completedAt: {
              gte: fromStart,
              lte: toEnd
            },
            performedByEmployeeId: { not: null }
          },
          _sum: { finalPrice: true },
          _count: { _all: true },
          orderBy: { _sum: { finalPrice: "desc" } },
          take: 10
        }),
        prisma.transaction.findMany({
          where: {
            recordedAt: {
              gte: fromStart,
              lte: toEnd
            }
          },
          include: {
            createdBy: {
              select: {
                fullName: true,
                phone: true
              }
            }
          },
          orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
          take: 10
        })
      ]);

    const customerIds = topCustomersRaw.map((entry) => entry.customerId);
    const employeeIds = topEmployeesRaw
      .map((entry) => entry.performedByEmployeeId)
      .filter((value): value is string => Boolean(value));

    const [customers, employees] = await Promise.all([
      customerIds.length
        ? prisma.user.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, fullName: true, phone: true }
          })
        : Promise.resolve([]),
      employeeIds.length
        ? prisma.employee.findMany({
            where: { id: { in: employeeIds } },
            select: {
              id: true,
              user: {
                select: {
                  fullName: true,
                  phone: true
                }
              }
            }
          })
        : Promise.resolve([])
    ]);

    const customerMap = new Map(customers.map((item) => [item.id, item]));
    const employeeMap = new Map(employees.map((item) => [item.id, item]));

    const dayKeys = enumerateDayKeys(fromStart, toStart);
    const dailyMap = new Map<string, DailyPoint>(
      dayKeys.map((date) => [
        date,
        {
          date,
          income: 0,
          expense: 0,
          bookingIncome: 0,
          walkInIncome: 0,
          membershipIncome: 0
        }
      ])
    );

    const incomeBySourceTotals: Record<IncomeSource, number> = {
      BOOKING: 0,
      WALK_IN: 0,
      MEMBERSHIP: 0
    };
    const expenseByCategoryTotals: Record<ExpenseCategory, number> = {
      SUPPLIER: 0,
      GENERAL: 0,
      SALARY: 0
    };

    let totalIncome = 0;
    let totalExpenses = 0;

    for (const row of ledgerRows) {
      const amount = toNumber(row.amount);
      const dateKey = toDayKey(row.recordedAt);
      const point = dailyMap.get(dateKey);

      if (row.type === TransactionType.INCOME) {
        totalIncome += amount;
        if (point) {
          point.income += amount;
        }

        if (row.incomeSource) {
          incomeBySourceTotals[row.incomeSource] += amount;
          if (point) {
            if (row.incomeSource === IncomeSource.BOOKING) {
              point.bookingIncome += amount;
            } else if (row.incomeSource === IncomeSource.WALK_IN) {
              point.walkInIncome += amount;
            } else if (row.incomeSource === IncomeSource.MEMBERSHIP) {
              point.membershipIncome += amount;
            }
          }
        }
      } else if (row.type === TransactionType.EXPENSE) {
        totalExpenses += amount;
        if (point) {
          point.expense += amount;
        }

        const category = row.expenseCategory ?? ExpenseCategory.GENERAL;
        expenseByCategoryTotals[category] += amount;
      }
    }

    const payload = {
      kpis: {
        totalIncome: roundCurrency(totalIncome),
        bookingIncome: roundCurrency(incomeBySourceTotals.BOOKING),
        walkInIncome: roundCurrency(incomeBySourceTotals.WALK_IN),
        membershipIncome: roundCurrency(incomeBySourceTotals.MEMBERSHIP),
        totalExpenses: roundCurrency(totalExpenses),
        netProfit: roundCurrency(totalIncome - totalExpenses),
        completedBookingsCount,
        pendingBookingsCount,
        noShowCount,
        cancellationCount,
        averageTicket: roundCurrency(toNumber(completedAggregate._avg.finalPrice))
      },
      timeseries: {
        daily: dayKeys.map((date) => {
          const point = dailyMap.get(date)!;
          return {
            date: point.date,
            income: roundCurrency(point.income),
            expense: roundCurrency(point.expense),
            bookingIncome: roundCurrency(point.bookingIncome),
            walkInIncome: roundCurrency(point.walkInIncome),
            membershipIncome: roundCurrency(point.membershipIncome)
          };
        })
      },
      breakdowns: {
        expenseByCategory: [
          { category: ExpenseCategory.SUPPLIER, amount: roundCurrency(expenseByCategoryTotals.SUPPLIER) },
          { category: ExpenseCategory.GENERAL, amount: roundCurrency(expenseByCategoryTotals.GENERAL) },
          { category: ExpenseCategory.SALARY, amount: roundCurrency(expenseByCategoryTotals.SALARY) }
        ],
        incomeBySource: [
          { source: IncomeSource.BOOKING, amount: roundCurrency(incomeBySourceTotals.BOOKING) },
          { source: IncomeSource.WALK_IN, amount: roundCurrency(incomeBySourceTotals.WALK_IN) },
          { source: IncomeSource.MEMBERSHIP, amount: roundCurrency(incomeBySourceTotals.MEMBERSHIP) }
        ]
      },
      top: {
        services: topServicesRaw.map((entry) => ({
          serviceNameEn: entry.serviceNameSnapshotEn,
          serviceNameAr: entry.serviceNameSnapshotAr,
          completedCount: entry._count._all,
          totalRevenue: roundCurrency(toNumber(entry._sum.finalPrice))
        })),
        customers: topCustomersRaw.map((entry) => {
          const customer = customerMap.get(entry.customerId);
          return {
            customerId: entry.customerId,
            name: customer?.fullName ?? null,
            phone: customer?.phone ?? "-",
            completedCount: entry._count._all,
            totalSpend: roundCurrency(toNumber(entry._sum.finalPrice))
          };
        }),
        employees: topEmployeesRaw.map((entry) => {
          const employeeId = entry.performedByEmployeeId;
          const employee = employeeId ? employeeMap.get(employeeId) : null;
          return {
            employeeId,
            name: employee?.user.fullName ?? null,
            phone: employee?.user.phone ?? "-",
            completedJobsCount: entry._count._all,
            totalRevenue: roundCurrency(toNumber(entry._sum.finalPrice))
          };
        })
      },
      recentTransactions: recentTransactionsRaw.map((item) => ({
        id: item.id,
        date: item.recordedAt.toISOString(),
        type: item.type,
        sourceOrCategory: item.type === TransactionType.INCOME ? item.incomeSource : item.expenseCategory,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: roundCurrency(toNumber(item.unitPrice)),
        totalAmount: roundCurrency(toNumber(item.amount)),
        recordedBy: item.createdBy?.fullName ?? item.createdBy?.phone ?? "-"
      }))
    };

    return ok(payload);
  } catch (error) {
    return fail(error);
  }
}
