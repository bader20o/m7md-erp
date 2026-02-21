import Link from "next/link";
import { CustomerMembershipsManager } from "@/components/memberships/customer-memberships-manager";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ locale: string }> };

export default async function MembershipsPage({ params }: Props): Promise<React.ReactElement> {
  const { locale } = await params;
  const session = await getSession();

  if (!session) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        Please login to manage memberships.{" "}
        <Link href={`/${locale}/login`} className="font-medium underline">
          Login
        </Link>
      </div>
    );
  }

  const [plans, orders] = await Promise.all([
    prisma.membershipPlan.findMany({
      where: { isActive: true },
      include: {
        entitlements: {
          include: {
            service: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.membershipOrder.findMany({
      where: { customerId: session.sub },
      include: {
        plan: {
          include: {
            entitlements: {
              include: {
                service: true
              }
            }
          }
        },
        usages: {
          select: { serviceId: true }
        }
      },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const serializedPlans = plans.map((plan) => ({
    id: plan.id,
    nameEn: plan.nameEn,
    nameAr: plan.nameAr,
    descriptionEn: plan.descriptionEn,
    descriptionAr: plan.descriptionAr,
    price: plan.price.toString(),
    durationDays: plan.durationDays,
    entitlements: plan.entitlements.map((entitlement) => ({
      serviceId: entitlement.serviceId,
      serviceNameEn: entitlement.service.nameEn,
      serviceNameAr: entitlement.service.nameAr,
      totalUses: entitlement.totalUses
    }))
  }));

  const serializedOrders = orders.map((order) => {
    const usedMap = new Map<string, number>();
    for (const usage of order.usages) {
      const current = usedMap.get(usage.serviceId) ?? 0;
      usedMap.set(usage.serviceId, current + 1);
    }

    return {
      id: order.id,
      status: order.status,
      planNameEn: order.plan.nameEn,
      planNameAr: order.plan.nameAr,
      priceSnapshot: order.priceSnapshot.toString(),
      startDate: order.startDate ? order.startDate.toISOString() : null,
      endDate: order.endDate ? order.endDate.toISOString() : null,
      services: order.plan.entitlements.map((entitlement) => ({
        serviceId: entitlement.serviceId,
        serviceNameEn: entitlement.service.nameEn,
        serviceNameAr: entitlement.service.nameAr,
        totalUses: entitlement.totalUses,
        usedCount: usedMap.get(entitlement.serviceId) ?? 0
      }))
    };
  });

  return <CustomerMembershipsManager locale={locale} plans={serializedPlans} orders={serializedOrders} />;
}

