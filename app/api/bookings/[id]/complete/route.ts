import { fail } from "@/lib/api";

export async function POST(): Promise<Response> {
  try {
    return Response.json(
      {
        success: false,
        error: {
          code: "ENDPOINT_MOVED",
          message: "Use POST /api/admin/bookings/:id/complete with { finalPrice, internalNote?, performedByEmployeeId? }."
        }
      },
      { status: 410 }
    );
  } catch (error) {
    return fail(error);
  }
}
