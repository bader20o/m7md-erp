import { ApiError, fail } from "@/lib/api";

export async function PATCH(): Promise<Response> {
  return fail(new ApiError(410, "TASK_ROUTE_DEPRECATED", "Use PATCH /api/tasks/:id instead."));
}
