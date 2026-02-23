import { BookingStatus, IncomeSource, Prisma, Role, TransactionType } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { assertBookingTransition } from "@/lib/booking-status";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { completeBookingSchema } from "@/lib/validators/booking";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params): Promise<Response> {
  try {
    const actor = requireRoles(await getSession(), [Role.EMPLOYEE, Role.ADMIN]);
    const body = await parseJsonBody(request, completeBookingSchema);
    const { id } = await context.params;

    if (body.performedByEmployeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: body.performedByEmployeeId },
        select: { id: true, isActive: true }
      });
      if (!employee || !employee.isActive) {
        throw new ApiError(400, "INVALID_EMPLOYEE", "performedByEmployeeId must reference an active employee.");
      }
    }

    const now = new Date();

    const item = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id },
        include: { transaction: true }
      });
      if (!booking) {
        throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
      }

      if (booking.status === BookingStatus.COMPLETED && booking.transaction) {
        return booking;
      }

      assertBookingTransition(booking.status, BookingStatus.COMPLETED);

      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.COMPLETED,
          finalPrice: body.finalPrice,
          internalNote: body.internalNote,
          performedByEmployeeId: body.performedByEmployeeId,
          completedAt: now,
          rejectReason: null,
          cancelReason: null,
          cancelledByUserId: null
        }
      });

      await tx.transaction.create({
        data: {
          type: TransactionType.INCOME,
          incomeSource: IncomeSource.BOOKING,
          itemName: booking.serviceNameSnapshotEn || booking.serviceNameSnapshotAr || `Booking ${id}`,
          unitPrice: Number(body.finalPrice),
          quantity: 1,
          amount: body.finalPrice,
          note: body.internalNote,
          bookingId: id,
          referenceType: "BOOKING",
          referenceId: id,
          description: `Booking completion income ${id}`,
          occurredAt: now,
          recordedAt: now,
          createdById: actor.sub
        }
      });

      return updatedBooking;
    });

    await logAudit({
      action: "BOOKING_STATUS_CHANGE",
      entity: "Booking",
      entityId: item.id,
      actorId: actor.sub,
      payload: {
        to: BookingStatus.COMPLETED,
        finalPrice: item.finalPrice,
        performedByEmployeeId: item.performedByEmployeeId
      }
    });

    return ok({ item });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      try {
        const existing = await prisma.booking.findUnique({
          where: { id: (await context.params).id },
          include: { transaction: true }
        });
        if (existing?.transaction) {
          return ok({ item: existing });
        }
      } catch {
        // Fall back to standard error response.
      }
    }
    return fail(error);
  }
}
