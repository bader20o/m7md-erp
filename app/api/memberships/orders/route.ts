import { MembershipOrderStatus, Role } from "@prisma/client";
import { fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { createMembershipRequest, ensureOrderBenefitSnapshots } from "@/lib/memberships/subscriptions";
import { subscribeMembershipSchema } from "@/lib/validators/membership";

export async function GET(): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [
      Role.CUSTOMER,
      Role.EMPLOYEE,
      Role.EMPLOYEE,
      Role.ADMIN
    ]);

    if (actor.role === Role.CUSTOMER) {
      const activeOrders = await prisma.membershipOrder.findMany({
        where: {
          customerId: actor.sub,
          status: { in: [MembershipOrderStatus.ACTIVE] }
        },
        select: { id: true }
      });
      for (const order of activeOrders) {
        await ensureOrderBenefitSnapshots(prisma, order.id);
      }

      const items = await prisma.membershipOrder.findMany({
        where: { customerId: actor.sub },
        include: {
          plan: {
            include: {
              benefits: true,
              entitlements: { include: { service: true } }
            }
          },
          orderBenefits: {
            include: { uses: true }
          },
          transactions: true
        },
        orderBy: { createdAt: "desc" }
      });
      return ok({ items });
    }

    const activeOrders = await prisma.membershipOrder.findMany({
      where: {
        status: { in: [MembershipOrderStatus.ACTIVE] }
      },
      select: { id: true }
    });
    for (const order of activeOrders) {
      await ensureOrderBenefitSnapshots(prisma, order.id);
    }

    const items = await prisma.membershipOrder.findMany({
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
        plan: {
          include: {
            benefits: true,
            entitlements: { include: { service: true } }
          }
        },
        orderBenefits: {
          include: { uses: true }
        },
        transactions: true
      },
      orderBy: { createdAt: "desc" }
    });
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.CUSTOMER, Role.EMPLOYEE, Role.ADMIN]);
    const body = await parseJsonBody(request, subscribeMembershipSchema);
    const item = await createMembershipRequest(actor.sub, body.planId);
    return ok(item, 201);
  } catch (error) {
    return fail(error);
  }
}

