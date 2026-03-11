import { AccountingEntryForms } from "@/components/admin/accounting-entry-forms";
import { ResponsiveDataTable } from "@/components/ui/responsive-data-table";
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
      select: {
        id: true,
        name: true,
        sku: true,
        vehicleModel: true,
        vehicleType: true,
        category: true,
        sellPrice: true,
        stockQty: true
      },
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
      <div className="flex justify-end">
        <a
          href="/api/admin/reports/export-accounting"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Export Accounting (.xlsx)
        </a>
      </div>
      <AccountingEntryForms
        suppliers={suppliers}
        invoices={invoices}
        parts={parts}
        recordedByName={recordedByName}
      />
      <ResponsiveDataTable
        items={transactions}
        getKey={(item) => item.id}
        emptyState="No transactions found."
        tableClassName="border border-slate-200 bg-white"
        columns={[
          {
            key: "item",
            header: "Item",
            cell: (item) => item.itemName
          },
          {
            key: "unit-price",
            header: "Unit Price",
            cell: (item) => `$${item.unitPrice.toFixed(2)}`
          },
          {
            key: "qty",
            header: "Qty",
            cell: (item) => item.quantity
          },
          {
            key: "total",
            header: "Total",
            cell: (item) => <span className="font-medium">{`$${item.amount.toString()}`}</span>
          },
          {
            key: "date",
            header: "Date",
            cell: (item) => item.recordedAt.toLocaleString()
          },
          {
            key: "by",
            header: "By",
            cell: (item) => item.createdBy?.fullName || item.createdBy?.phone || "-"
          },
          {
            key: "note",
            header: "Note",
            cell: (item) => <span className="text-xs text-slate-600">{item.note || "-"}</span>
          }
        ]}
        cardTitle={(item) => item.itemName}
        cardBadge={(item) => (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            {`$${item.amount.toString()}`}
          </span>
        )}
        cardSubtitle={(item) => item.recordedAt.toLocaleString()}
        cardFields={[
          {
            key: "unit-price",
            label: "Unit Price",
            value: (item) => `$${item.unitPrice.toFixed(2)}`
          },
          {
            key: "qty",
            label: "Qty",
            value: (item) => item.quantity
          },
          {
            key: "by",
            label: "By",
            value: (item) => item.createdBy?.fullName || item.createdBy?.phone || "-"
          },
          {
            key: "note",
            label: "Note",
            value: (item) => item.note || "-"
          }
        ]}
      />
    </section>
  );
}
