import { Role } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { listAdminMembershipSubscriptions } from "@/lib/memberships/subscriptions";
import { requireAnyPermission, requireRoles } from "@/lib/rbac";

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getSession();
    if (session?.role === Role.ADMIN) {
      requireRoles(session, [Role.ADMIN]);
    } else {
      await requireAnyPermission(session, ["memberships"]);
    }

    const url = new URL(request.url);
    const status = (url.searchParams.get("status") ?? "all").toLowerCase();
    const q = url.searchParams.get("q");
    const data = await listAdminMembershipSubscriptions({
      status:
        status === "pending" || status === "active" || status === "rejected" || status === "all"
          ? status
          : "all",
      q
    });
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
