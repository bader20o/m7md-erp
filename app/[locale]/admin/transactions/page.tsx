import { AccountingEntryForms } from "@/components/admin/accounting-entry-forms";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminTransactionsPage(): Promise<React.ReactElement> {
  const session = await getSession();
  const [transactions, suppliers, invoices, parts, currentUser] = await Promise.all([
    prisma.transaction.findMany({
      include: {
        createdBy: { select: { fullName: true, phone: true } },
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
    }),
    prisma.part.findMany({
      where: { isActive: true },
      select: { id: true, name: true, sku: true },
      orderBy: { name: "asc" }
    }),
    session
      ? prisma.user.findUnique({
          where: { id: session.sub },
          select: { fullName: true, phone: true }
        })
      : Promise.resolve(null)
  ]);
  const recordedByName = currentUser?.fullName || currentUser?.phone || session?.phone || "Current User";

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Transactions</h1>
      <AccountingEntryForms
        suppliers={suppliers}
        invoices={invoices}
        parts={parts}
        recordedByName={recordedByName}
      />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Unit Price</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">By</th>
              <th className="px-3 py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-3 py-2">{item.itemName}</td>
                <td className="px-3 py-2">${item.unitPrice.toFixed(2)}</td>
                <td className="px-3 py-2">{item.quantity}</td>
                <td className="px-3 py-2 font-medium">${item.amount.toString()}</td>
                <td className="px-3 py-2">{item.recordedAt.toLocaleString()}</td>
                <td className="px-3 py-2">{item.createdBy?.fullName || item.createdBy?.phone || "-"}</td>
                <td className="px-3 py-2 text-xs text-slate-600">{item.note || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
