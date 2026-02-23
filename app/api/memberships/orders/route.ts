import { addDays } from "date-fns";
import { IncomeSource, MembershipOrderStatus, Role, TransactionType } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { createMembershipOrderSchema } from "@/lib/validators/membership";

export async function GET(): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [
      Role.CUSTOMER,
      Role.EMPLOYEE,
      Role.EMPLOYEE,
      Role.ADMIN
    ]);

    if (actor.role === Role.CUSTOMER) {
      const items = await prisma.membershipOrder.findMany({
        where: { customerId: actor.sub },
        include: { plan: true, usages: true, transactions: true },
        orderBy: { createdAt: "desc" }
      });
      return ok({ items });
    }

    const items = await prisma.membershipOrder.findMany({
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
        plan: true,
        usages: true
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
    const body = await parseJsonBody(request, createMembershipOrderSchema);

    const plan = await prisma.membershipPlan.findUnique({
      where: { id: body.planId }
    });
    if (!plan || !plan.isActive) {
      throw new ApiError(404, "PLAN_NOT_FOUND", "Membership plan not found.");
    }

    const now = new Date();
    const endDate = addDays(now, plan.durationDays);

    const item = await prisma.$transaction(async (tx) => {
      const order = await tx.membershipOrder.create({
        data: {
          customerId: actor.sub,
          planId: plan.id,
          priceSnapshot: plan.price,
          status: MembershipOrderStatus.ACTIVE,
          startDate: now,
          endDate
        }
      });

      await tx.transaction.create({
        data: {
          type: TransactionType.INCOME,
          incomeSource: IncomeSource.MEMBERSHIP,
          itemName: plan.nameEn,
          unitPrice: Number(plan.price),
          quantity: 1,
          amount: plan.price,
          note: null,
          description: `Membership order ${order.id}`,
          membershipOrderId: order.id,
          createdById: actor.sub
        }
      });

      return order;
    });

    await createNotification({
      userId: actor.sub,
      title: "Membership Activated",
      message: `Your membership is active until ${endDate.toISOString()}.`,
      type: "MEMBERSHIP",
      metadata: { orderId: item.id }
    });

    await logAudit({
      action: "MEMBERSHIP_ORDER_CREATE",
      entity: "MembershipOrder",
      entityId: item.id,
      actorId: actor.sub,
      payload: {
        planId: item.planId,
        priceSnapshot: item.priceSnapshot
      }
    });

    return ok({ item }, 201);
  } catch (error) {
    return fail(error);
  }
}

