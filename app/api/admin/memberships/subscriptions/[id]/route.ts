import { Role } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { getAdminMembershipSubscriptionDetail } from "@/lib/memberships/subscriptions";
import { requireAnyPermission, requireRoles } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params): Promise<Response> {
  try {
    const session = await getSession();
    if (session?.role === Role.ADMIN) {
      requireRoles(session, [Role.ADMIN]);
    } else {
      await requireAnyPermission(session, ["memberships"]);
    }

    const { id } = await context.params;
    const data = await getAdminMembershipSubscriptionDetail(id);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
