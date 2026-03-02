import { BookingStatus, Role } from "@prisma/client";
import { z } from "zod";
import { ApiError, fail, ok } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { assertBookingTransition } from "@/lib/booking-status";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };
const approveBookingSchema = z.object({
  finalPrice: z.coerce.number().positive()
});

export async function POST(request: Request, context: Params): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
    const rawBody = await request.text();
    let parsedBody: unknown = {};
    if (rawBody) {
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
      }
    }
    const body = approveBookingSchema.parse(parsedBody);
    const { id } = await context.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, status: true }
    });
    if (!booking) {
      throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
    }

    assertBookingTransition(booking.status, BookingStatus.APPROVED);

    const item = await prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.APPROVED,
        finalPrice: body.finalPrice,
        rejectReason: null,
        cancelReason: null,
        cancelledByUserId: null
      }
    });

    await logAudit({
      action: "BOOKING_STATUS_CHANGE",
      entity: "Booking",
      entityId: item.id,
      actorId: actor.sub,
      payload: { from: booking.status, to: item.status, finalPrice: body.finalPrice }
    });

    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}
