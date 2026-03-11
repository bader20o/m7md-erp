import {
  BookingStatus,
  CustomerAccountEntryType,
  ExpenseCategory,
  IncomeSource,
  MembershipOrderStatus,
  Role,
  StockMovementType,
  TransactionType,
  UserStatus
} from "@prisma/client";
import { isLowStock } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import type { AnalyticsGroupBy } from "@/lib/validators/admin-analytics";

const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 90 * 1000;
const RECENT_LIMIT = 20;
const TOP_LIMIT = 10;

type CacheEntry = {
  expiresAt: number;
  data: AnalyticsOverviewPayload;
};

declare global {
  // eslint-disable-next-line no-var
  var __analyticsOverviewCache: Map<string, CacheEntry> | undefined;
}

const overviewCache = globalThis.__analyticsOverviewCache ?? new Map<string, CacheEntry>();
if (!globalThis.__analyticsOverviewCache) {
  globalThis.__analyticsOverviewCache = overviewCache;
}

export type TimeSeriesRow = {
  bucketStart: string;
  income: number;
  expenses: number;
  profit: number;
  orders: number;
};

export type AnalyticsOverviewPayload = {
  range: {
    from: string;
    to: string;
    groupBy: AnalyticsGroupBy;
  };
  todaySnapshot: {
    income: number;
    expenses: number;
    bookings: number;
    activeEmployees: number;
  };
  inventory: {
    lowStockItems: Array<{
      id: string;
      name: string;
      vehicleModel: string | null;
      vehicleType: string | null;
      stockQty: number;
      lowStockThreshold: number;
    }>;
    totalPartsCount: number;
    itemsSoldToday: number;
  };
  customerFunnel: {
    newCustomers: number;
    returningCustomers: number;
    customersWithDebt: number;
  };
  employeePerformance: Array<{
    employeeId: string;
    name: string;
    jobsCompleted: number;
    revenue: number;
    attendancePct: number;
  }>;
  alerts: {
    lowInventory: Array<{
      partId: string;
      name: string;
      stockQty: number;
      lowStockThreshold: number;
    }>;
    overdueCustomerDebt: Array<{
      customerId: string;
      name: string;
      phone: string;
      balanceDue: number;
      lastActivityAt: string | null;
    }>;
    absentEmployeesToday: Array<{
      employeeId: string;
      name: string;
    }>;
  };
  kpis: {
    totalIncome: number;
    totalExpenses: number;
    totalProfit: number;
    totalOrders: number;
    avgOrderValue: number;
    activeMemberships: number;
    newMembershipsInRange: number;
  };
  timeseries: TimeSeriesRow[];
  breakdowns: {
    incomeBySource: Array<{ source: IncomeSource; amount: number }>;
    expensesByCategory: Array<{ category: ExpenseCategory; amount: number }>;
    ordersByStatus: Array<{ status: BookingStatus; count: number }>;
  };
  membership: {
    newCount: number;
    renewedCount: number;
    expiredCount: number;
    membershipRevenue: number;
  };
  top: {
    services: {
      byRevenue: Array<{
        serviceNameEn: string;
        serviceNameAr: string;
        ordersCount: number;
        revenue: number;
      }>;
      byOrders: Array<{
        serviceNameEn: string;
        serviceNameAr: string;
        ordersCount: number;
        revenue: number;
      }>;
    };
    employees: Array<{
      employeeId: string;
      name: string;
      handledOrders: number;
      revenue: number;
      workHours: number;
      ratingAvg: number | null;
    }>;
  };
  recent: {
    transactions: Array<{
      id: string;
      occurredAt: string;
      type: TransactionType;
      incomeSource: IncomeSource | null;
      expenseCategory: ExpenseCategory | null;
      itemName: string;
      quantity: number;
      unitPrice: number;
      amount: number;
      recordedBy: string;
    }>;
    completedBookings: Array<{
      id: string;
      completedAt: string;
      status: BookingStatus;
      customerName: string;
      serviceNameEn: string;
      serviceNameAr: string;
      employeeName: string;
      finalPrice: number;
    }>;
  };
};

export type OverviewInput = {
  from: Date;
  to: Date;
  groupBy: AnalyticsGroupBy;
};

function toDayStartUtc(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function toDayEndUtc(value: Date): Date {
  const start = toDayStartUtc(value);
  return new Date(start.getTime() + DAY_MS - 1);
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "bigint") return Number(value);
  if (value && typeof value === "object" && "toString" in value) {
    return Number(value.toString());
  }
  return 0;
}

function toGroupCount(value: unknown): number {
  if (value && typeof value === "object" && "_all" in value) {
    return toNumber((value as { _all?: unknown })._all);
  }
  return 0;
}

function startOfBucketUtc(value: Date, groupBy: AnalyticsGroupBy): Date {
  const dayStart = toDayStartUtc(value);
  if (groupBy === "day") {
    return dayStart;
  }

  if (groupBy === "week") {
    const weekday = dayStart.getUTCDay();
    const diffToMonday = (weekday + 6) % 7;
    return new Date(dayStart.getTime() - diffToMonday * DAY_MS);
  }

  return new Date(Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth(), 1));
}

function addBucketUtc(value: Date, groupBy: AnalyticsGroupBy): Date {
  if (groupBy === "day") {
    return new Date(value.getTime() + DAY_MS);
  }
  if (groupBy === "week") {
    return new Date(value.getTime() + 7 * DAY_MS);
  }
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1));
}

function enumerateBucketKeys(from: Date, to: Date, groupBy: AnalyticsGroupBy): string[] {
  const keys: string[] = [];
  let cursor = startOfBucketUtc(from, groupBy);
  const end = toDayStartUtc(to);
  while (cursor.getTime() <= end.getTime()) {
    keys.push(formatDateOnly(cursor));
    cursor = addBucketUtc(cursor, groupBy);
  }
  return keys;
}

function getBucketKey(value: Date, groupBy: AnalyticsGroupBy): string {
  return formatDateOnly(startOfBucketUtc(value, groupBy));
}

function cacheKey(from: Date, to: Date, groupBy: AnalyticsGroupBy): string {
  return `${formatDateOnly(from)}|${formatDateOnly(to)}|${groupBy}`;
}

function emptyTimeseries(keys: string[]): Map<string, TimeSeriesRow> {
  return new Map(
    keys.map((key) => [
      key,
      {
        bucketStart: key,
        income: 0,
        expenses: 0,
        profit: 0,
        orders: 0
      }
    ])
  );
}

function getDateRangeBounds(input: OverviewInput): { fromStart: Date; toStart: Date; toEnd: Date } {
  const fromStart = toDayStartUtc(input.from);
  const toStart = toDayStartUtc(input.to);
  const toEnd = new Date(toStart.getTime() + DAY_MS - 1);
  return { fromStart, toStart, toEnd };
}

function daysInclusive(fromStart: Date, toStart: Date): number {
  const diff = toStart.getTime() - fromStart.getTime();
  if (diff < 0) return 1;
  return Math.floor(diff / DAY_MS) + 1;
}

function computeMembershipNewRenewed(rangeOrders: Array<{ customerId: string; createdAt: Date }>, priorCustomers: Set<string>): {
  newCount: number;
  renewedCount: number;
} {
  const seenInRange = new Set<string>();
  let newCount = 0;
  let renewedCount = 0;

  const sorted = [...rangeOrders].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const order of sorted) {
    if (!priorCustomers.has(order.customerId) && !seenInRange.has(order.customerId)) {
      newCount += 1;
    } else {
      renewedCount += 1;
    }
    seenInRange.add(order.customerId);
  }

  return { newCount, renewedCount };
}

export async function getAnalyticsOverview(input: OverviewInput): Promise<AnalyticsOverviewPayload> {
  const { fromStart, toStart, toEnd } = getDateRangeBounds(input);
  const todayStart = toDayStartUtc(new Date());
  const todayEnd = toDayEndUtc(todayStart);
  const key = cacheKey(fromStart, toStart, input.groupBy);
  const nowMs = Date.now();
  const cached = overviewCache.get(key);
  if (cached && cached.expiresAt > nowMs) {
    return cached.data;
  }

  const [
    transactionRows,
    recentTransactions,
    ordersCount,
    bookingTimeRows,
    completedBookingsAggregate,
    completedBookingsCount,
    topServicesByRevenueRaw,
    topServicesByOrdersRaw,
    topEmployeesRaw,
    recentCompletedBookings,
    activeMemberships,
    membershipRevenueAgg,
    priorMembershipCustomersRaw,
    membershipOrdersInRangeRaw,
    expiredMemberships,
    todayTransactionRows,
    todayBookingsCount,
    activeEmployeeRows,
    activeAttendanceRowsInRange,
    todayActiveAttendanceRows,
    activeParts,
    itemsSoldTodayAgg,
    newCustomersInRangeCount,
    bookingCustomersInRangeRows,
    bookingCustomersBeforeRangeRows,
    customerLedgerRows
  ] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        deletedAt: null,
        occurredAt: {
          gte: fromStart,
          lte: toEnd
        }
      },
      select: {
        type: true,
        amount: true,
        occurredAt: true,
        incomeSource: true,
        expenseCategory: true
      }
    }),
    prisma.transaction.findMany({
      where: {
        deletedAt: null,
        occurredAt: {
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
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: RECENT_LIMIT
    }),
    prisma.booking.count({
      where: {
        appointmentAt: {
          gte: fromStart,
          lte: toEnd
        }
      }
    }),
    prisma.booking.findMany({
      where: {
        appointmentAt: {
          gte: fromStart,
          lte: toEnd
        }
      },
      select: {
        appointmentAt: true,
        status: true
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
      _count: { _all: true },
      _sum: { finalPrice: true },
      orderBy: { _sum: { finalPrice: "desc" } },
      take: TOP_LIMIT
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
      _count: { _all: true },
      _sum: { finalPrice: true },
      orderBy: { _count: { serviceNameSnapshotEn: "desc" } },
      take: TOP_LIMIT
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
      _count: { _all: true },
      _sum: { finalPrice: true },
      orderBy: { _sum: { finalPrice: "desc" } },
      take: TOP_LIMIT
    }),
    prisma.booking.findMany({
      where: {
        status: BookingStatus.COMPLETED,
        completedAt: {
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
      orderBy: { completedAt: "desc" },
      take: RECENT_LIMIT
    }),
    prisma.membershipOrder.count({
      where: {
        status: MembershipOrderStatus.ACTIVE,
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }]
      }
    }),
    prisma.transaction.aggregate({
      where: {
        type: TransactionType.INCOME,
        incomeSource: IncomeSource.MEMBERSHIP,
        deletedAt: null,
        occurredAt: {
          gte: fromStart,
          lte: toEnd
        }
      },
      _sum: { amount: true }
    }),
    prisma.membershipOrder.findMany({
      where: { createdAt: { lt: fromStart } },
      distinct: ["customerId"],
      select: { customerId: true }
    }),
    prisma.membershipOrder.findMany({
      where: {
        createdAt: {
          gte: fromStart,
          lte: toEnd
        }
      },
      select: {
        customerId: true,
        createdAt: true
      }
    }),
    prisma.membershipOrder.count({
      where: {
        endDate: {
          gte: fromStart,
          lte: toEnd
        }
      }
    }),
    prisma.transaction.findMany({
      where: {
        deletedAt: null,
        occurredAt: {
          gte: todayStart,
          lte: todayEnd
        }
      },
      select: {
        type: true,
        amount: true
      }
    }),
    prisma.booking.count({
      where: {
        appointmentAt: {
          gte: todayStart,
          lte: todayEnd
        }
      }
    }),
    prisma.employee.findMany({
      where: {
        isActive: true,
        user: {
          status: UserStatus.ACTIVE
        }
      },
      select: {
        id: true,
        user: {
          select: {
            fullName: true,
            phone: true
          }
        }
      }
    }),
    prisma.attendance.findMany({
      where: {
        checkInAt: {
          gte: fromStart,
          lte: toEnd
        },
        employee: {
          isActive: true,
          user: {
            status: UserStatus.ACTIVE
          }
        }
      },
      select: {
        employeeId: true,
        checkInAt: true,
        checkOutAt: true
      }
    }),
    prisma.attendance.findMany({
      where: {
        checkInAt: {
          gte: todayStart,
          lte: todayEnd
        },
        employee: {
          isActive: true,
          user: {
            status: UserStatus.ACTIVE
          }
        }
      },
      select: {
        employeeId: true
      },
      distinct: ["employeeId"]
    }),
    prisma.part.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        vehicleModel: true,
        vehicleType: true,
        stockQty: true,
        lowStockThreshold: true
      },
      orderBy: [{ stockQty: "asc" }, { name: "asc" }]
    }),
    prisma.stockMovement.aggregate({
      where: {
        occurredAt: {
          gte: todayStart,
          lte: todayEnd
        },
        OR: [
          { type: StockMovementType.SALE },
          {
            type: StockMovementType.OUT,
            note: {
              contains: "sold"
            }
          }
        ]
      },
      _sum: {
        quantity: true
      }
    }),
    prisma.user.count({
      where: {
        role: Role.CUSTOMER,
        createdAt: {
          gte: fromStart,
          lte: toEnd
        }
      }
    }),
    prisma.booking.findMany({
      where: {
        appointmentAt: {
          gte: fromStart,
          lte: toEnd
        }
      },
      select: {
        customerId: true
      },
      distinct: ["customerId"]
    }),
    prisma.booking.findMany({
      where: {
        appointmentAt: {
          lt: fromStart
        }
      },
      select: {
        customerId: true
      },
      distinct: ["customerId"]
    }),
    prisma.customerAccountEntry.findMany({
      select: {
        customerId: true,
        type: true,
        amount: true,
        occurredAt: true
      }
    })
  ]);

  const topEmployeeIds = topEmployeesRaw
    .map((row) => row.performedByEmployeeId)
    .filter((value): value is string => Boolean(value));

  const [topEmployeeProfiles, attendanceRows, ratingRows] = await Promise.all([
    topEmployeeIds.length
      ? prisma.employee.findMany({
        where: { id: { in: topEmployeeIds } },
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
      : Promise.resolve([]),
    topEmployeeIds.length
      ? prisma.attendance.findMany({
        where: {
          employeeId: { in: topEmployeeIds },
          checkInAt: {
            gte: fromStart,
            lte: toEnd
          }
        },
        select: {
          employeeId: true,
          checkInAt: true,
          checkOutAt: true
        }
      })
      : Promise.resolve([]),
    topEmployeeIds.length
      ? prisma.review.findMany({
        where: {
          booking: {
            performedByEmployeeId: { in: topEmployeeIds },
            status: BookingStatus.COMPLETED,
            completedAt: {
              gte: fromStart,
              lte: toEnd
            }
          }
        },
        select: {
          rating: true,
          booking: {
            select: {
              performedByEmployeeId: true
            }
          }
        }
      })
      : Promise.resolve([])
  ]);

  const bucketKeys = enumerateBucketKeys(fromStart, toStart, input.groupBy);
  const timeseriesMap = emptyTimeseries(bucketKeys);

  const incomeBySourceMap: Record<IncomeSource, number> = {
    BOOKING: 0,
    WALK_IN: 0,
    MEMBERSHIP: 0,
    INVOICE: 0,
    INVENTORY_SALE: 0
  };
  const expensesByCategoryMap: Record<ExpenseCategory, number> = {
    SUPPLIER: 0,
    GENERAL: 0,
    SALARY: 0,
    INVENTORY_PURCHASE: 0,
    INVENTORY_ADJUSTMENT: 0
  };
  const ordersByStatusMap = new Map<BookingStatus, number>();

  let totalIncome = 0;
  let totalExpenses = 0;

  for (const row of transactionRows) {
    const amount =
      row.type === TransactionType.EXPENSE ? Math.abs(toNumber(row.amount)) : toNumber(row.amount);
    const bucket = timeseriesMap.get(getBucketKey(row.occurredAt, input.groupBy));
    if (row.type === TransactionType.INCOME) {
      totalIncome += amount;
      if (bucket) bucket.income += amount;
      if (row.incomeSource) {
        incomeBySourceMap[row.incomeSource] += amount;
      }
    } else if (row.type === TransactionType.EXPENSE) {
      totalExpenses += amount;
      if (bucket) bucket.expenses += amount;
      const category = row.expenseCategory ?? ExpenseCategory.GENERAL;
      expensesByCategoryMap[category] += amount;
    }
  }

  for (const row of bookingTimeRows) {
    const bucket = timeseriesMap.get(getBucketKey(row.appointmentAt, input.groupBy));
    if (bucket) {
      bucket.orders += 1;
    }
    ordersByStatusMap.set(row.status, (ordersByStatusMap.get(row.status) ?? 0) + 1);
  }

  const timeseries = bucketKeys.map((key) => {
    const row = timeseriesMap.get(key)!;
    row.income = round2(row.income);
    row.expenses = round2(row.expenses);
    row.profit = round2(row.income - row.expenses);
    return row;
  });

  const priorCustomers = new Set(priorMembershipCustomersRaw.map((row) => row.customerId));
  const membershipRangeOrders = membershipOrdersInRangeRaw.map((row) => ({
    customerId: row.customerId,
    createdAt: row.createdAt
  }));
  const membershipLifecycle = computeMembershipNewRenewed(membershipRangeOrders, priorCustomers);

  const employeeProfileMap = new Map(topEmployeeProfiles.map((item) => [item.id, item]));
  const employeeWorkMinutes = new Map<string, number>();
  for (const row of attendanceRows) {
    const end = row.checkOutAt ?? toEnd;
    const diffMs = end.getTime() - row.checkInAt.getTime();
    if (diffMs > 0) {
      const prev = employeeWorkMinutes.get(row.employeeId) ?? 0;
      employeeWorkMinutes.set(row.employeeId, prev + Math.floor(diffMs / (60 * 1000)));
    }
  }

  const employeeRatings = new Map<string, { total: number; count: number }>();
  for (const row of ratingRows) {
    const employeeId = row.booking.performedByEmployeeId;
    if (!employeeId) continue;
    const current = employeeRatings.get(employeeId) ?? { total: 0, count: 0 };
    current.total += row.rating;
    current.count += 1;
    employeeRatings.set(employeeId, current);
  }

  const topEmployees = topEmployeesRaw
    .map((row) => {
      const employeeId = row.performedByEmployeeId;
      if (!employeeId) return null;
      const profile = employeeProfileMap.get(employeeId);
      const rating = employeeRatings.get(employeeId);
      return {
        employeeId,
        name: profile?.user.fullName ?? profile?.user.phone ?? employeeId,
        handledOrders: toGroupCount(row._count),
        revenue: round2(toNumber(row._sum?.finalPrice)),
        workHours: round2((employeeWorkMinutes.get(employeeId) ?? 0) / 60),
        ratingAvg: rating && rating.count > 0 ? round2(rating.total / rating.count) : null
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  let todayIncome = 0;
  let todayExpenses = 0;
  for (const row of todayTransactionRows) {
    const amount =
      row.type === TransactionType.EXPENSE ? Math.abs(toNumber(row.amount)) : toNumber(row.amount);
    if (row.type === TransactionType.INCOME) {
      todayIncome += amount;
    } else if (row.type === TransactionType.EXPENSE) {
      todayExpenses += amount;
    }
  }

  const lowStockItems = activeParts
    .filter((part) => isLowStock(part.stockQty, part.lowStockThreshold))
    .slice(0, 5);

  const bookingCustomersInRange = new Set(bookingCustomersInRangeRows.map((row) => row.customerId));
  const bookingCustomersBeforeRange = new Set(bookingCustomersBeforeRangeRows.map((row) => row.customerId));
  let returningCustomers = 0;
  for (const customerId of bookingCustomersInRange) {
    if (bookingCustomersBeforeRange.has(customerId)) {
      returningCustomers += 1;
    }
  }

  const customerBalances = new Map<string, number>();
  const customerLastActivity = new Map<string, Date>();
  for (const row of customerLedgerRows) {
    const current = customerBalances.get(row.customerId) ?? 0;
    const amount = toNumber(row.amount);
    if (row.type === CustomerAccountEntryType.PAYMENT) {
      customerBalances.set(row.customerId, current - amount);
    } else {
      customerBalances.set(row.customerId, current + amount);
    }

    const previousLast = customerLastActivity.get(row.customerId);
    if (!previousLast || row.occurredAt.getTime() > previousLast.getTime()) {
      customerLastActivity.set(row.customerId, row.occurredAt);
    }
  }

  const debtRows = Array.from(customerBalances.entries())
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);

  const overdueCutoff = new Date(todayStart.getTime() - 30 * DAY_MS);
  const overdueDebtRows = debtRows
    .filter(([customerId]) => {
      const lastActivity = customerLastActivity.get(customerId);
      return lastActivity ? lastActivity.getTime() < overdueCutoff.getTime() : false;
    })
    .slice(0, 5);

  const overdueCustomers = overdueDebtRows.length
    ? await prisma.user.findMany({
      where: { id: { in: overdueDebtRows.map(([customerId]) => customerId) } },
      select: {
        id: true,
        fullName: true,
        phone: true
      }
    })
    : [];
  const overdueCustomerMap = new Map(overdueCustomers.map((item) => [item.id, item]));

  const workingDays = daysInclusive(fromStart, toStart);
  const jobsByEmployee = new Map<string, { jobsCompleted: number; revenue: number }>();
  for (const row of topEmployeesRaw) {
    const employeeId = row.performedByEmployeeId;
    if (!employeeId) continue;
    jobsByEmployee.set(employeeId, {
      jobsCompleted: toGroupCount(row._count),
      revenue: round2(toNumber(row._sum?.finalPrice))
    });
  }

  const attendanceDaysByEmployee = new Map<string, Set<string>>();
  for (const row of activeAttendanceRowsInRange) {
    const dayKey = formatDateOnly(toDayStartUtc(row.checkInAt));
    const seenDays = attendanceDaysByEmployee.get(row.employeeId) ?? new Set<string>();
    seenDays.add(dayKey);
    attendanceDaysByEmployee.set(row.employeeId, seenDays);
  }

  const employeePerformance = activeEmployeeRows
    .map((employee) => {
      const jobs = jobsByEmployee.get(employee.id) ?? { jobsCompleted: 0, revenue: 0 };
      const attendanceDays = attendanceDaysByEmployee.get(employee.id)?.size ?? 0;
      const attendancePct = workingDays > 0 ? round2((attendanceDays / workingDays) * 100) : 0;
      return {
        employeeId: employee.id,
        name: employee.user.fullName ?? employee.user.phone ?? employee.id,
        jobsCompleted: jobs.jobsCompleted,
        revenue: jobs.revenue,
        attendancePct
      };
    })
    .sort((a, b) => {
      if (b.jobsCompleted !== a.jobsCompleted) return b.jobsCompleted - a.jobsCompleted;
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      return b.attendancePct - a.attendancePct;
    })
    .slice(0, 10);

  const activeTodayEmployeeIds = new Set(todayActiveAttendanceRows.map((row) => row.employeeId));
  const absentEmployeesToday = activeEmployeeRows
    .filter((employee) => !activeTodayEmployeeIds.has(employee.id))
    .slice(0, 5)
    .map((employee) => ({
      employeeId: employee.id,
      name: employee.user.fullName ?? employee.user.phone ?? employee.id
    }));

  const payload: AnalyticsOverviewPayload = {
    range: {
      from: formatDateOnly(fromStart),
      to: formatDateOnly(toStart),
      groupBy: input.groupBy
    },
    todaySnapshot: {
      income: round2(todayIncome),
      expenses: round2(todayExpenses),
      bookings: todayBookingsCount,
      activeEmployees: activeEmployeeRows.length
    },
    inventory: {
      lowStockItems: lowStockItems.map((part) => ({
        id: part.id,
        name: part.name,
        vehicleModel: part.vehicleModel,
        vehicleType: part.vehicleType,
        stockQty: part.stockQty,
        lowStockThreshold: part.lowStockThreshold
      })),
      totalPartsCount: activeParts.length,
      itemsSoldToday: Number(itemsSoldTodayAgg._sum.quantity ?? 0)
    },
    customerFunnel: {
      newCustomers: newCustomersInRangeCount,
      returningCustomers,
      customersWithDebt: debtRows.length
    },
    employeePerformance,
    alerts: {
      lowInventory: lowStockItems.slice(0, 3).map((part) => ({
        partId: part.id,
        name: part.name,
        stockQty: part.stockQty,
        lowStockThreshold: part.lowStockThreshold
      })),
      overdueCustomerDebt: overdueDebtRows.map(([customerId, balanceDue]) => {
        const customer = overdueCustomerMap.get(customerId);
        return {
          customerId,
          name: customer?.fullName ?? customer?.phone ?? customerId,
          phone: customer?.phone ?? "-",
          balanceDue: round2(balanceDue),
          lastActivityAt: customerLastActivity.get(customerId)?.toISOString() ?? null
        };
      }),
      absentEmployeesToday
    },
    kpis: {
      totalIncome: round2(totalIncome),
      totalExpenses: round2(totalExpenses),
      totalProfit: round2(totalIncome - totalExpenses),
      totalOrders: ordersCount,
      avgOrderValue: round2(toNumber(completedBookingsAggregate._avg.finalPrice)),
      activeMemberships,
      newMembershipsInRange: membershipLifecycle.newCount
    },
    timeseries,
    breakdowns: {
      incomeBySource: [
        { source: IncomeSource.BOOKING, amount: round2(incomeBySourceMap.BOOKING) },
        { source: IncomeSource.WALK_IN, amount: round2(incomeBySourceMap.WALK_IN) },
        { source: IncomeSource.MEMBERSHIP, amount: round2(incomeBySourceMap.MEMBERSHIP) },
        { source: IncomeSource.INVENTORY_SALE, amount: round2(incomeBySourceMap.INVENTORY_SALE) }
      ],
      expensesByCategory: [
        { category: ExpenseCategory.SUPPLIER, amount: round2(expensesByCategoryMap.SUPPLIER) },
        { category: ExpenseCategory.GENERAL, amount: round2(expensesByCategoryMap.GENERAL) },
        { category: ExpenseCategory.SALARY, amount: round2(expensesByCategoryMap.SALARY) },
        {
          category: ExpenseCategory.INVENTORY_PURCHASE,
          amount: round2(expensesByCategoryMap.INVENTORY_PURCHASE)
        },
        {
          category: ExpenseCategory.INVENTORY_ADJUSTMENT,
          amount: round2(expensesByCategoryMap.INVENTORY_ADJUSTMENT)
        }
      ],
      ordersByStatus: Array.from(ordersByStatusMap.entries()).map(([status, count]) => ({
        status,
        count
      }))
    },
    membership: {
      newCount: membershipLifecycle.newCount,
      renewedCount: membershipLifecycle.renewedCount,
      expiredCount: expiredMemberships,
      membershipRevenue: round2(toNumber(membershipRevenueAgg._sum.amount))
    },
    top: {
      services: {
        byRevenue: topServicesByRevenueRaw.map((row) => ({
          serviceNameEn: row.serviceNameSnapshotEn,
          serviceNameAr: row.serviceNameSnapshotAr,
          ordersCount: toGroupCount(row._count),
          revenue: round2(toNumber(row._sum?.finalPrice))
        })),
        byOrders: topServicesByOrdersRaw.map((row) => ({
          serviceNameEn: row.serviceNameSnapshotEn,
          serviceNameAr: row.serviceNameSnapshotAr,
          ordersCount: toGroupCount(row._count),
          revenue: round2(toNumber(row._sum?.finalPrice))
        }))
      },
      employees: topEmployees
    },
    recent: {
      transactions: recentTransactions.map((item) => ({
        id: item.id,
        occurredAt: item.occurredAt.toISOString(),
        type: item.type,
        incomeSource: item.incomeSource,
        expenseCategory: item.expenseCategory,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: round2(toNumber(item.unitPrice)),
        amount: round2(toNumber(item.amount)),
        recordedBy: item.createdBy?.fullName ?? item.createdBy?.phone ?? "-"
      })),
      completedBookings: recentCompletedBookings.map((item) => ({
        id: item.id,
        completedAt: item.completedAt ? item.completedAt.toISOString() : item.updatedAt.toISOString(),
        status: item.status,
        customerName: item.customer.fullName ?? item.customer.phone,
        serviceNameEn: item.serviceNameSnapshotEn,
        serviceNameAr: item.serviceNameSnapshotAr,
        employeeName:
          item.performedByEmployee?.user.fullName ??
          item.performedByEmployee?.user.phone ??
          "-",
        finalPrice: round2(toNumber(item.finalPrice))
      }))
    }
  };

  // Keep completed bookings count available in the in-memory data path for parity checks.
  if (completedBookingsCount < payload.recent.completedBookings.length) {
    payload.recent.completedBookings = payload.recent.completedBookings.slice(0, completedBookingsCount);
  }

  overviewCache.set(key, { expiresAt: nowMs + CACHE_TTL_MS, data: payload });
  return payload;
}
