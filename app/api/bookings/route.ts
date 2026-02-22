import { BookingStatus, Role } from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { getSession } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { requireRoles, requireSession } from "@/lib/rbac";
import { acquireBookingSlotLock, getBookingSlotParts, releaseBookingSlotLock } from "@/lib/slot-lock";
import { createBookingSchema } from "@/lib/validators/booking";

export async function GET(): Promise<Response> {
  try {
    const session = await getSession();
    const actor = requireSession(session);

    if (actor.role === Role.CUSTOMER) {
      const bookings = await prisma.booking.findMany({
        where: { customerId: actor.sub },
        include: { service: true, performedByEmployee: { include: { user: true } } },
        orderBy: { appointmentAt: "desc" }
      });
      return ok({ items: bookings });
    }

    const canViewAll =
      actor.role === Role.RECEPTION || actor.role === Role.MANAGER || actor.role === Role.ADMIN;
    if (!canViewAll) {
      throw new ApiError(403, "FORBIDDEN", "You do not have permission for this resource.");
    }

    const bookings = await prisma.booking.findMany({
      include: {
        service: true,
        customer: { select: { id: true, fullName: true, phone: true } },
        performedByEmployee: { include: { user: true } }
      },
      orderBy: { appointmentAt: "desc" },
      take: 200
    });
    return ok({ items: bookings });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  let lockId: string | null = null;

  try {
    const session = await getSession();
    const actor = requireRoles(session, [Role.CUSTOMER, Role.RECEPTION, Role.MANAGER, Role.ADMIN]);
    const body = await parseJsonBody(request, createBookingSchema);

    const service = await prisma.service.findUnique({
      where: { id: body.serviceId },
      select: { id: true, isActive: true, nameEn: true, nameAr: true, category: true, basePrice: true }
    });

    if (!service || !service.isActive) {
      throw new ApiError(404, "SERVICE_NOT_FOUND", "Service not found.");
    }

    const isWalkIn = actor.role !== Role.CUSTOMER;
    let customerId = actor.sub;

    if (isWalkIn) {
      if (!body.customerId) {
        throw new ApiError(400, "CUSTOMER_ID_REQUIRED", "customerId is required for walk-in bookings.");
      }

      const customer = await prisma.user.findUnique({
        where: { id: body.customerId },
        select: { id: true, isActive: true }
      });

      if (!customer || !customer.isActive) {
        throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
      }

      customerId = customer.id;
    }

    const branchId = body.branchId ?? "MAIN";
    const slot = getBookingSlotParts(body.appointmentAt);

    const lock = await acquireBookingSlotLock({
      branchId,
      appointmentAt: body.appointmentAt,
      userId: actor.sub
    });
    lockId = lock.lockId;

    const booking = await prisma.booking.create({
      data: {
        serviceId: service.id,
        customerId,
        createdByUserId: isWalkIn ? actor.sub : null,
        branchId,
        slotDate: slot.slotDate,
        slotTime: slot.slotTime,
        appointmentAt: body.appointmentAt,
        notes: body.notes,
        status: isWalkIn ? BookingStatus.APPROVED : BookingStatus.PENDING,
        serviceNameSnapshotEn: service.nameEn,
        serviceNameSnapshotAr: service.nameAr,
        serviceCategorySnapshot: service.category,
        serviceBasePriceSnapshot: service.basePrice
      },
      include: {
        service: {
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
            descriptionEn: true,
            descriptionAr: true,
            durationMinutes: true,
            isActive: true
          }
        }
      }
    });

    await createNotification({
      userId: customerId,
      title: isWalkIn ? "Walk-in Booking Added" : "Booking Created",
      message: `Booking ${booking.id} was created for ${booking.appointmentAt.toISOString()}.`,
      type: "BOOKING",
      metadata: { bookingId: booking.id }
    });

    await logAudit({
      action: "BOOKING_CREATE",
      entity: "Booking",
      entityId: booking.id,
      actorId: actor.sub,
      payload: {
        serviceId: booking.serviceId,
        customerId: booking.customerId,
        appointmentAt: booking.appointmentAt,
        status: booking.status,
        isWalkIn
      }
    });

    await releaseBookingSlotLock(lock.lockId);
    lockId = null;

    return ok({ item: booking }, 201);
  } catch (error) {
    if (lockId) {
      await releaseBookingSlotLock(lockId);
    }
    return fail(error);
  }
}
