import { Role } from "@prisma/client";
import { fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { createMembershipRequest } from "@/lib/memberships/subscriptions";
import { requireRoles } from "@/lib/rbac";
import { subscribeMembershipSchema } from "@/lib/validators/membership";

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.CUSTOMER]);
    const body = await parseJsonBody(request, subscribeMembershipSchema);
    const data = await createMembershipRequest(actor.sub, body.planId);
    return ok(data, 201);
  } catch (error) {
    return fail(error);
  }
}
