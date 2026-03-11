import { Role } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { getCustomerRewardsPayload } from "@/lib/loyalty";
import { requireRoles } from "@/lib/rbac";

export async function GET(): Promise<Response> {
  try {
    const session = requireRoles(await getSession(), [Role.CUSTOMER]);
    const payload = await getCustomerRewardsPayload(session.sub);
    return ok(payload);
  } catch (error) {
    return fail(error);
  }
}
