import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission, requireRoles } from "@/lib/rbac";
import { updateMembershipPlan } from "@/lib/memberships/subscriptions";
import { updateMembershipPlanSchema } from "@/lib/validators/membership";
import { Role } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Params): Promise<Response> {
  try {
    const session = await getSession();
    const actor =
      session?.role === Role.ADMIN
        ? requireRoles(session, [Role.ADMIN])
        : await requireAnyPermission(session, ["memberships"]);

    const body = await parseJsonBody(request, updateMembershipPlanSchema);
    const { id } = await context.params;

    const exists = await prisma.membershipPlan.findUnique({
      where: { id },
      select: { id: true }
    });
    if (!exists) {
      throw new ApiError(404, "PLAN_NOT_FOUND", "Membership plan not found.");
    }

    const item = await updateMembershipPlan(actor.sub, id, body);

    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}
