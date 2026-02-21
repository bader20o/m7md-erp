import { BookingStatus, IncomeSource, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ locale: string }> };

async function getAmount(type: TransactionType, incomeSource?: IncomeSource): Promise<string> {
  const aggregate = await prisma.transaction.aggregate({
    where: {
      type,
      incomeSource
    },
    _sum: { amount: true }
  });

  return aggregate._sum.amount?.toString() ?? "0";
}

async function getCompletedBookingsIncome(): Promise<string> {
  const aggregate = await prisma.booking.aggregate({
    where: {
      status: BookingStatus.COMPLETED,
      finalPrice: { not: null }
    },
    _sum: { finalPrice: true }
  });
  return aggregate._sum.finalPrice?.toString() ?? "0";
}

export default async function AccountingDashboardPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const [appIncome, walkInIncome, membershipIncome, expenses] = await Promise.all([
    getCompletedBookingsIncome(),
    getAmount(TransactionType.INCOME, IncomeSource.WALK_IN),
    getAmount(TransactionType.INCOME, IncomeSource.MEMBERSHIP),
    getAmount(TransactionType.EXPENSE)
  ]);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{locale === "ar" ? "لوحة المحاسبة" : "Accounting Dashboard"}</h1>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm text-slate-600">App Booking Income</h2>
          <p className="mt-2 text-2xl font-bold text-brand-800">${appIncome}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm text-slate-600">Walk-in Income</h2>
          <p className="mt-2 text-2xl font-bold text-brand-800">${walkInIncome}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm text-slate-600">Membership Income</h2>
          <p className="mt-2 text-2xl font-bold text-brand-800">${membershipIncome}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm text-slate-600">Expenses</h2>
          <p className="mt-2 text-2xl font-bold text-red-700">${expenses}</p>
        </article>
      </div>
    </section>
  );
}
