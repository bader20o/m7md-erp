import { BookingStatus, NotificationType, Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { assertBookingTransition } from "@/lib/booking-status";
import { getSession } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { setBookingPriceSchema } from "@/lib/validators/booking";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
    const body = await parseJsonBody(request, setBookingPriceSchema);
    const { id } = await context.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, status: true, customerId: true }
    });
    if (!booking) {
      throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
    }

    if (booking.status !== BookingStatus.PRICE_SET) {
      assertBookingTransition(booking.status, BookingStatus.PRICE_SET);
    }

    const item = await prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.PRICE_SET,
        finalPrice: body.finalPrice,
        internalNote: body.internalNote?.trim() || null,
        rejectReason: null,
        cancelReason: null,
        cancelledByUserId: null,
        completedAt: null
      }
    });

    await createNotification({
      userId: booking.customerId,
      title: "Booking price ready",
      message: `Booking ${id} has a final price and is awaiting your confirmation.`,
      type: NotificationType.BOOKING,
      metadata: {
        bookingId: id,
        status: item.status,
        finalPrice: item.finalPrice?.toString() ?? null,
        internalNote: item.internalNote
      }
    });

    await logAudit({
      action: "BOOKING_PRICE_SET",
      entity: "Booking",
      entityId: item.id,
      actorId: actor.sub,
      payload: {
        from: booking.status,
        to: item.status,
        finalPrice: item.finalPrice,
        internalNote: item.internalNote
      }
    });

    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}
