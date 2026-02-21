import { BookingStatus, Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { assertBookingTransition } from "@/lib/booking-status";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { cancelBookingSchema } from "@/lib/validators/booking";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.RECEPTION, Role.MANAGER, Role.ADMIN]);
    const body = await parseJsonBody(request, cancelBookingSchema);
    const { id } = await context.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, status: true }
    });
    if (!booking) {
      throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
    }

    assertBookingTransition(booking.status, BookingStatus.CANCELLED);

    const item = await prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        cancelReason: body.cancelReason,
        cancelledByUserId: actor.sub,
        rejectReason: null,
        finalPrice: null,
        internalNote: null,
        performedByEmployeeId: null,
        completedAt: null
      }
    });

    await logAudit({
      action: "BOOKING_STATUS_CHANGE",
      entity: "Booking",
      entityId: item.id,
      actorId: actor.sub,
      payload: {
        from: booking.status,
        to: item.status,
        cancelReason: body.cancelReason,
        cancelledByUserId: actor.sub
      }
    });

    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}
