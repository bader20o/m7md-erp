import { subDays } from "date-fns";
import { BookingStatus, IncomeSource, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

async function aggregateAmount(type: TransactionType, incomeSource?: IncomeSource, from?: Date): Promise<string> {
  const result = await prisma.transaction.aggregate({
    where: {
      type,
      incomeSource,
      recordedAt: from ? { gte: from } : undefined
    },
    _sum: { amount: true }
  });

  return result._sum.amount?.toString() ?? "0";
}

async function aggregateCompletedBookingsIncome(from?: Date): Promise<string> {
  const result = await prisma.booking.aggregate({
    where: {
      status: BookingStatus.COMPLETED,
      finalPrice: { not: null },
      completedAt: from ? { gte: from } : undefined
    },
    _sum: { finalPrice: true }
  });

  return result._sum.finalPrice?.toString() ?? "0";
}

export default async function AdminReportsPage(): Promise<React.ReactElement> {
  const last30Days = subDays(new Date(), 30);

  const [allApp, allWalkIn, allMembership, allExpense, last30App, last30WalkIn, last30Membership, last30Expense] =
    await Promise.all([
      aggregateCompletedBookingsIncome(),
      aggregateAmount(TransactionType.INCOME, IncomeSource.WALK_IN),
      aggregateAmount(TransactionType.INCOME, IncomeSource.MEMBERSHIP),
      aggregateAmount(TransactionType.EXPENSE),
      aggregateCompletedBookingsIncome(last30Days),
      aggregateAmount(TransactionType.INCOME, IncomeSource.WALK_IN, last30Days),
      aggregateAmount(TransactionType.INCOME, IncomeSource.MEMBERSHIP, last30Days),
      aggregateAmount(TransactionType.EXPENSE, undefined, last30Days)
    ]);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs uppercase tracking-wide text-slate-500">All Time App Booking Income</h2>
          <p className="mt-2 text-2xl font-bold text-brand-800">${allApp}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs uppercase tracking-wide text-slate-500">All Time Walk-in Income</h2>
          <p className="mt-2 text-2xl font-bold text-brand-800">${allWalkIn}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs uppercase tracking-wide text-slate-500">All Time Membership Income</h2>
          <p className="mt-2 text-2xl font-bold text-brand-800">${allMembership}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs uppercase tracking-wide text-slate-500">All Time Expenses</h2>
          <p className="mt-2 text-2xl font-bold text-red-700">${allExpense}</p>
        </article>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs uppercase tracking-wide text-slate-500">Last 30d App Booking Income</h2>
          <p className="mt-2 text-2xl font-bold text-brand-800">${last30App}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs uppercase tracking-wide text-slate-500">Last 30d Walk-in Income</h2>
          <p className="mt-2 text-2xl font-bold text-brand-800">${last30WalkIn}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs uppercase tracking-wide text-slate-500">Last 30d Membership Income</h2>
          <p className="mt-2 text-2xl font-bold text-brand-800">${last30Membership}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs uppercase tracking-wide text-slate-500">Last 30d Expenses</h2>
          <p className="mt-2 text-2xl font-bold text-red-700">${last30Expense}</p>
        </article>
      </div>
    </section>
  );
}
