import { AccountingEntryForms } from "@/components/admin/accounting-entry-forms";
import { AccountingLedgerView, type LedgerTransaction } from "@/components/admin/accounting-ledger-view";
import { Role } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminTransactionsPage(): Promise<React.ReactElement> {
  const session = await getSession();
  const [transactions, suppliers, invoices, parts, customers, currentUser] = await Promise.all([
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
    prisma.user.findMany({
      where: { role: Role.CUSTOMER, isActive: true },
      select: { id: true, fullName: true, phone: true },
      orderBy: { fullName: "asc" },
      take: 500
    }),
    session
      ? prisma.user.findUnique({
          where: { id: session.sub },
          select: { fullName: true, phone: true }
        })
      : Promise.resolve(null)
  ]);
  const recordedByName = currentUser?.fullName || currentUser?.phone || session?.phone || "Current User";
  const ledgerItems: LedgerTransaction[] = transactions.map((item) => ({
    id: item.id,
    recordedAt: item.recordedAt.toISOString(),
    type: item.type,
    incomeSource: item.incomeSource,
    expenseCategory: item.expenseCategory,
    itemName: item.itemName,
    note: item.note,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: Number(item.amount),
    createdBy: item.createdBy?.fullName || item.createdBy?.phone || null,
    customerName:
      item.booking?.customer?.fullName ||
      item.booking?.customer?.phone ||
      item.membershipOrder?.customer?.fullName ||
      item.membershipOrder?.customer?.phone ||
      null
  }));

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
        customers={customers.map((customer) => ({
          id: customer.id,
          fullName: customer.fullName,
          phone: customer.phone
        }))}
        recordedByName={recordedByName}
      />
      <AccountingLedgerView transactions={ledgerItems} />
    </section>
  );
}
