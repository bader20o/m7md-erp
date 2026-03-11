import { Role } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { getAdminRewardsStats } from "@/lib/loyalty";
import { requireRoles } from "@/lib/rbac";

export async function GET(): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ADMIN, Role.EMPLOYEE]);
    const stats = await getAdminRewardsStats();
    return ok(stats);
  } catch (error) {
    return fail(error);
  }
}
