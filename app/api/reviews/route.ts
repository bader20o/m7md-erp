import { BookingStatus, Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { createReviewSchema } from "@/lib/validators/review";

export async function GET(): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [
      Role.CUSTOMER,
      Role.EMPLOYEE,
      Role.EMPLOYEE,
      Role.ADMIN
    ]);

    if (actor.role === Role.CUSTOMER) {
      const items = await prisma.review.findMany({
        where: { customerId: actor.sub },
        include: { booking: true },
        orderBy: { createdAt: "desc" }
      });
      return ok({ items });
    }

    const items = await prisma.review.findMany({
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
        booking: true
      },
      orderBy: { createdAt: "desc" }
    });
    return ok({ items });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.CUSTOMER]);
    const body = await parseJsonBody(request, createReviewSchema);

    const booking = await prisma.booking.findUnique({
      where: { id: body.bookingId }
    });

    if (!booking || booking.customerId !== actor.sub) {
      throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
    }

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new ApiError(400, "BOOKING_NOT_COMPLETED", "Only completed bookings can be reviewed.");
    }

    const item = await prisma.review.create({
      data: {
        bookingId: booking.id,
        customerId: actor.sub,
        rating: body.rating,
        comment: body.comment
      }
    });

    return ok({ item }, 201);
  } catch (error) {
    return fail(error);
  }
}


