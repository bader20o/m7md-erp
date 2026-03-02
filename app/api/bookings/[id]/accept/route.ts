import { BookingStatus, NotificationType, Role } from "@prisma/client";
import { ApiError, fail, ok } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { assertBookingTransition } from "@/lib/booking-status";
import { getSession } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, context: Params): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.CUSTOMER]);
    const { id } = await context.params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, status: true, customerId: true, finalPrice: true }
    });
    if (!booking) {
      throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
    }
    if (booking.customerId !== actor.sub) {
      throw new ApiError(403, "FORBIDDEN", "You can only accept your own bookings.");
    }

    assertBookingTransition(booking.status, BookingStatus.APPROVED);

    const item = await prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.APPROVED,
        rejectReason: null,
        cancelReason: null,
        cancelledByUserId: null
      }
    });

    const admins = await prisma.user.findMany({
      where: { role: Role.ADMIN, isActive: true },
      select: { id: true }
    });
    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin.id,
          title: "Booking confirmed by customer",
          message: `Booking ${id} was accepted by the customer and is ready for scheduling.`,
          type: NotificationType.BOOKING,
          metadata: {
            bookingId: id,
            status: item.status,
            finalPrice: booking.finalPrice?.toString() ?? null
          }
        })
      )
    );

    await logAudit({
      action: "BOOKING_CUSTOMER_ACCEPT",
      entity: "Booking",
      entityId: item.id,
      actorId: actor.sub,
      payload: { from: booking.status, to: item.status, finalPrice: booking.finalPrice }
    });

    return ok({ item });
  } catch (error) {
    return fail(error);
  }
}
