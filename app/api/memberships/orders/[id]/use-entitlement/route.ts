import { MembershipOrderStatus, Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { useEntitlementSchema } from "@/lib/validators/membership";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.CUSTOMER, Role.EMPLOYEE, Role.ADMIN]);
    const body = await parseJsonBody(request, useEntitlementSchema);
    const { id } = await context.params;

    const order = await prisma.membershipOrder.findUnique({
      where: { id },
      include: {
        plan: {
          include: { entitlements: true }
        }
      }
    });

    if (!order) {
      throw new ApiError(404, "ORDER_NOT_FOUND", "Membership order not found.");
    }

    if (actor.role === Role.CUSTOMER && order.customerId !== actor.sub) {
      throw new ApiError(403, "FORBIDDEN", "Cannot use another customer's entitlements.");
    }

    if (order.status !== MembershipOrderStatus.ACTIVE) {
      throw new ApiError(400, "ORDER_NOT_ACTIVE", "Membership order is not active.");
    }

    const entitlement = order.plan.entitlements.find((item) => item.serviceId === body.serviceId);
    if (!entitlement) {
      throw new ApiError(400, "NO_ENTITLEMENT", "Service is not included in this membership.");
    }

    const usedCount = await prisma.membershipUsage.count({
      where: {
        orderId: order.id,
        serviceId: body.serviceId
      }
    });

    if (usedCount >= entitlement.totalUses) {
      throw new ApiError(400, "ENTITLEMENT_EXHAUSTED", "No remaining uses for this service.");
    }

    const usage = await prisma.membershipUsage.create({
      data: {
        orderId: order.id,
        serviceId: body.serviceId,
        bookingId: body.bookingId,
        note: body.note
      }
    });

    await logAudit({
      action: "MEMBERSHIP_USAGE_CREATE",
      entity: "MembershipUsage",
      entityId: usage.id,
      actorId: actor.sub,
      payload: {
        orderId: usage.orderId,
        serviceId: usage.serviceId,
        bookingId: usage.bookingId
      }
    });

    return ok({ item: usage }, 201);
  } catch (error) {
    return fail(error);
  }
}
