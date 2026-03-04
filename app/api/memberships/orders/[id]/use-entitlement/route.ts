import { Role } from "@prisma/client";
import { ApiError, fail } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { requireRoles } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.CUSTOMER, Role.EMPLOYEE, Role.ADMIN]);
    await context.params;
    void request;
    throw new ApiError(
      403,
      "BENEFIT_CONFIRM_ADMIN_ONLY",
      "Membership benefits can only be confirmed by an admin from the subscriber details view."
    );
  } catch (error) {
    return fail(error);
  }
}
