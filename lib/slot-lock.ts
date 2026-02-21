import { BookingStatus, Prisma } from "@prisma/client";
import { addMinutes } from "date-fns";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type AcquireLockInput = {
  branchId: string;
  appointmentAt: Date;
  userId: string;
};

export function getBookingSlotParts(appointmentAt: Date): { slotDate: string; slotTime: string } {
  const iso = appointmentAt.toISOString();
  return {
    slotDate: iso.slice(0, 10),
    slotTime: iso.slice(11, 16)
  };
}

export async function acquireBookingSlotLock(input: AcquireLockInput): Promise<{ lockId: string }> {
  const now = new Date();
  const expiresAt = addMinutes(now, 10);
  const slot = getBookingSlotParts(input.appointmentAt);

  return prisma.$transaction(async (tx) => {
    await tx.bookingSlotLock.deleteMany({
      where: { expiresAt: { lte: now } }
    });

    const conflictingBooking = await tx.booking.findFirst({
      where: {
        branchId: input.branchId,
        slotDate: slot.slotDate,
        slotTime: slot.slotTime,
        status: {
          in: [BookingStatus.PENDING, BookingStatus.APPROVED]
        }
      },
      select: { id: true }
    });

    if (conflictingBooking) {
      throw new ApiError(409, "SLOT_ALREADY_BOOKED", "This slot is already booked.");
    }

    try {
      const lock = await tx.bookingSlotLock.create({
        data: {
          branchId: input.branchId,
          slotDate: slot.slotDate,
          slotTime: slot.slotTime,
          appointmentAt: input.appointmentAt,
          lockedByUserId: input.userId,
          expiresAt
        },
        select: { id: true }
      });
      return { lockId: lock.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ApiError(409, "SLOT_LOCKED", "This slot is currently locked by another request.");
      }
      throw error;
    }
  });
}

export async function releaseBookingSlotLock(lockId: string): Promise<void> {
  await prisma.bookingSlotLock.deleteMany({
    where: { id: lockId }
  });
}
