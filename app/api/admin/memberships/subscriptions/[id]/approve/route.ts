import { Role } from "@prisma/client";
import { fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { approveMembershipSubscription } from "@/lib/memberships/subscriptions";
import { requireAnyPermission, requireRoles } from "@/lib/rbac";
import { approveMembershipSubscriptionSchema } from "@/lib/validators/membership";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params): Promise<Response> {
  try {
    const session = await getSession();
    const actor =
      session?.role === Role.ADMIN
        ? requireRoles(session, [Role.ADMIN])
        : await requireAnyPermission(session, ["memberships"]);
    const body = await parseJsonBody(request, approveMembershipSubscriptionSchema);
    const { id } = await context.params;
    const data = await approveMembershipSubscription(actor.sub, id, body);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
