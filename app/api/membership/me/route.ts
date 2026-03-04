import { Role } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { getMembershipForUser } from "@/lib/memberships/subscriptions";
import { requireRoles } from "@/lib/rbac";

export async function GET(): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.CUSTOMER]);
    const data = await getMembershipForUser(actor.sub);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
