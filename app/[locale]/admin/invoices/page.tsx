import { InvoiceManager } from "@/components/admin/invoice-manager";
import { prisma } from "@/lib/prisma";

export default async function AdminInvoicesPage(): Promise<React.ReactElement> {
  const invoices = await prisma.invoice.findMany({
    include: { _count: { select: { expenses: true } } },
    orderBy: { issueDate: "desc" }
  });

  const serialized = invoices.map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    note: invoice.note,
    status: invoice.status,
    issueDate: invoice.issueDate.toISOString(),
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString() : null,
    expensesCount: invoice._count.expenses
  }));

  return (
    <InvoiceManager invoices={serialized} />
  );
}
