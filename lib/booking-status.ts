import { BookingStatus } from "@prisma/client";
import { ApiError } from "@/lib/api";

const transitions: Partial<Record<BookingStatus, BookingStatus[]>> = {
  PENDING: [BookingStatus.APPROVED, BookingStatus.REJECTED, BookingStatus.CANCELLED, BookingStatus.LATE_CANCELLED],
  APPROVED: [
    BookingStatus.REJECTED,
    BookingStatus.CANCELLED,
    BookingStatus.LATE_CANCELLED,
    BookingStatus.NO_SHOW,
    BookingStatus.NOT_SERVED,
    BookingStatus.COMPLETED
  ]
};

export function isBookingSlotBlockingStatus(status: BookingStatus): boolean {
  return status === BookingStatus.PENDING || status === BookingStatus.APPROVED;
}

export function assertBookingTransition(from: BookingStatus, to: BookingStatus): void {
  if (from === to) {
    throw new ApiError(400, "INVALID_STATUS_TRANSITION", "Booking is already in the requested status.");
  }

  const allowed = transitions[from] ?? [];
  if (!allowed.includes(to)) {
    throw new ApiError(400, "INVALID_STATUS_TRANSITION", `Cannot move booking from ${from} to ${to}.`);
  }
}
