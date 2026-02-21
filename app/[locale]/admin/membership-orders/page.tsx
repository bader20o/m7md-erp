import { prisma } from "@/lib/prisma";

export default async function AdminMembershipOrdersPage(): Promise<React.ReactElement> {
  const orders = await prisma.membershipOrder.findMany({
    include: {
      customer: { select: { fullName: true, phone: true } },
      plan: true,
      _count: { select: { usages: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Membership Orders</h1>
      <div className="grid gap-3">
        {orders.map((order) => (
          <article key={order.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">
              {order.customer.fullName || order.customer.phone} • {order.plan.nameEn}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Status: {order.status} • Price Snapshot: ${order.priceSnapshot.toString()}
            </p>
            <p className="text-xs text-slate-600">
              Period: {order.startDate ? order.startDate.toLocaleDateString() : "-"} -{" "}
              {order.endDate ? order.endDate.toLocaleDateString() : "-"}
            </p>
            <p className="text-xs text-slate-600">Usages: {order._count.usages}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
