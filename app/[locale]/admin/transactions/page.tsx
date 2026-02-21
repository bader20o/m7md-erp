import { AccountingEntryForms } from "@/components/admin/accounting-entry-forms";
import { prisma } from "@/lib/prisma";

export default async function AdminTransactionsPage(): Promise<React.ReactElement> {
  const [transactions, suppliers, invoices] = await Promise.all([
    prisma.transaction.findMany({
      include: {
        booking: {
          include: {
            service: true,
            customer: { select: { fullName: true, phone: true } }
          }
        },
        expense: {
          include: {
            supplier: true,
            invoice: true
          }
        },
        membershipOrder: {
          include: {
            plan: true,
            customer: { select: { fullName: true, phone: true } }
          }
        }
      },
      orderBy: { recordedAt: "desc" },
      take: 300
    }),
    prisma.supplier.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.invoice.findMany({
      select: { id: true, number: true },
      orderBy: { issueDate: "desc" }
    })
  ]);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Transactions</h1>
      <AccountingEntryForms suppliers={suppliers} invoices={invoices} />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Reference</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{item.recordedAt.toLocaleString()}</td>
                <td className="px-3 py-2">{item.type}</td>
                <td className="px-3 py-2">{item.incomeSource || "-"}</td>
                <td className="px-3 py-2 font-medium">${item.amount.toString()}</td>
                <td className="px-3 py-2 text-xs text-slate-600">
                  {item.booking
                    ? `Booking ${item.booking.id}`
                    : item.expense
                      ? `Expense ${item.expense.id}`
                      : item.membershipOrder
                        ? `Membership ${item.membershipOrder.id}`
                        : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
