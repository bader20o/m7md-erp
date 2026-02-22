import { InventoryManager } from "@/components/admin/inventory-manager";
import { isLowStock } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ locale: string }> };

export default async function AdminInventoryPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const [parts, movements, suppliers, invoices] = await Promise.all([
    prisma.part.findMany({
      orderBy: [{ name: "asc" }]
    }),
    prisma.stockMovement.findMany({
      include: {
        part: { select: { id: true, name: true, sku: true, unit: true } },
        createdBy: { select: { id: true, fullName: true, phone: true, role: true } },
        supplier: { select: { id: true, name: true } },
        invoice: { select: { id: true, number: true } },
        booking: { select: { id: true, status: true } }
      },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 300
    }),
    prisma.supplier.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),
    prisma.invoice.findMany({
      select: { id: true, number: true },
      orderBy: { issueDate: "desc" },
      take: 100
    })
  ]);

  const serializedParts = parts.map((part) => ({
    ...part,
    lowStock: isLowStock(part.stockQty, part.lowStockThreshold)
  }));

  const serializedMovements = movements.map((movement) => ({
    ...movement,
    occurredAt: movement.occurredAt.toISOString()
  }));

  const alerts = serializedParts.filter((part) => part.lowStock);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{locale === "ar" ? "المخزون" : "Inventory"}</h1>
      <InventoryManager
        locale={locale}
        parts={serializedParts}
        alerts={alerts}
        movements={serializedMovements}
        suppliers={suppliers}
        invoices={invoices}
      />
    </section>
  );
}
