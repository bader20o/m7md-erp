import { Role } from "@prisma/client";
import { fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { confirmMembershipBenefitUse } from "@/lib/memberships/subscriptions";
import { requireAnyPermission, requireRoles } from "@/lib/rbac";
import { confirmMembershipBenefitUseSchema } from "@/lib/validators/membership";

type Params = { params: Promise<{ id: string; benefitId: string }> };

export async function POST(request: Request, context: Params): Promise<Response> {
  try {
    const session = await getSession();
    const actor =
      session?.role === Role.ADMIN
        ? requireRoles(session, [Role.ADMIN])
        : await requireAnyPermission(session, ["memberships"]);
    const body = await parseJsonBody(request, confirmMembershipBenefitUseSchema);
    const { id, benefitId } = await context.params;
    const data = await confirmMembershipBenefitUse(actor.sub, id, benefitId, body.confirmNote);
    return ok(data, 201);
  } catch (error) {
    return fail(error);
  }
}
