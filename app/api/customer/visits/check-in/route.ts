import { Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { registerVisitCheckIn } from "@/lib/loyalty";
import { requireRoles } from "@/lib/rbac";
import { visitCheckInSchema } from "@/lib/validators/reward";

export async function POST(request: Request): Promise<Response> {
  try {
    const session = requireRoles(await getSession(), [Role.CUSTOMER]);
    const body = await parseJsonBody(request, visitCheckInSchema);

    const result = await registerVisitCheckIn({
      customerId: session.sub,
      token: body.token,
      notes: body.notes
    });

    return ok(result);
  } catch (error) {
    if (error instanceof ApiError) {
      return fail(error);
    }
    return fail(new ApiError(400, "VISIT_CHECKIN_FAILED", "Unable to register visit."));
  }
}
