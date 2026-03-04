import { fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { requireAnyPermission, requireRoles } from "@/lib/rbac";
import {
  createMembershipPlan,
  listMembershipPlans
} from "@/lib/memberships/subscriptions";
import { membershipPlanInputSchema } from "@/lib/validators/membership";
import { Role } from "@prisma/client";

export async function GET(): Promise<Response> {
  try {
    const session = await getSession();
    let includeInactive = false;

    if (session?.role === Role.ADMIN) {
      requireRoles(session, [Role.ADMIN]);
      includeInactive = true;
    } else if (session?.role === Role.EMPLOYEE) {
      await requireAnyPermission(session, ["memberships"]);
      includeInactive = true;
    }

    const items = await listMembershipPlans({ includeInactive });
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getSession();
    const actor =
      session?.role === Role.ADMIN
        ? requireRoles(session, [Role.ADMIN])
        : await requireAnyPermission(session, ["memberships"]);
    const body = await parseJsonBody(request, membershipPlanInputSchema);
    const item = await createMembershipPlan(actor.sub, body);
    return ok({ item }, 201);
  } catch (error) {
    return fail(error);
  }
}


