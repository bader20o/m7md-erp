import { Role } from "@prisma/client";
import { ApiError, fail, ok } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { getCustomerRewardsPayload } from "@/lib/loyalty";
import { prisma } from "@/lib/prisma";
import { requireAnyPermission, requireRoles } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Params): Promise<Response> {
  try {
    const session = await getSession();
    if (session?.role === Role.ADMIN) {
      requireRoles(session, [Role.ADMIN]);
    } else {
      await requireAnyPermission(session, ["bookings", "memberships"]);
    }

    const { id } = await context.params;
    const customer = await prisma.user.findFirst({
      where: { id, role: Role.CUSTOMER },
      select: { id: true }
    });

    if (!customer) {
      throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
    }

    const data = await getCustomerRewardsPayload(customer.id);
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
