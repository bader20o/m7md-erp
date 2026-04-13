import { ApiError, fail } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { requireSession } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, context: Params): Promise<Response> {
  try {
    requireSession(await getSession());
    await context.params;
    throw new ApiError(403, "MESSAGE_DELETE_DISABLED", "Deleting chat messages is disabled.");
  } catch (error) {
    return fail(error);
  }
}
