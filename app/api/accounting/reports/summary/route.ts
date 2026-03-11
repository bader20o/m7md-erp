import { BookingStatus, IncomeSource, Role, TransactionType } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

export async function GET(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
    const url = new URL(request.url);
    const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from") as string) : null;
    const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to") as string) : null;

    const rangeFilter =
      from || to
        ? {
            gte: from ?? undefined,
            lte: to ?? undefined
          }
        : undefined;

    const [completedBookingsIncome, walkInIncome, membershipIncome, expenses] = await Promise.all([
      prisma.booking.aggregate({
        where: {
          status: BookingStatus.COMPLETED,
          finalPrice: { not: null },
          completedAt: rangeFilter
        },
        _sum: { finalPrice: true }
      }),
      prisma.transaction.aggregate({
        where: {
          type: TransactionType.INCOME,
          incomeSource: IncomeSource.WALK_IN,
          deletedAt: null,
          recordedAt: rangeFilter
        },
        _sum: { amount: true }
      }),
      prisma.transaction.aggregate({
        where: {
          type: TransactionType.INCOME,
          incomeSource: IncomeSource.MEMBERSHIP,
          deletedAt: null,
          recordedAt: rangeFilter
        },
        _sum: { amount: true }
      }),
      prisma.transaction.findMany({
        where: {
          type: TransactionType.EXPENSE,
          deletedAt: null,
          recordedAt: rangeFilter
        },
        select: { amount: true }
      })
    ]);

    return ok({
      appBookingIncome: completedBookingsIncome._sum.finalPrice ?? 0,
      walkInIncome: walkInIncome._sum.amount ?? 0,
      membershipIncome: membershipIncome._sum.amount ?? 0,
      expenses: expenses.reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0)
    });
  } catch (error) {
    return fail(error);
  }
}

