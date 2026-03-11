import {
  BookingPricingMode,
  BookingStatus,
  CustomerRewardStatus,
  IncomeSource,
  PriceType,
  Prisma,
  RewardType,
  Role,
  TransactionType
} from "@prisma/client";
import { ApiError, fail, ok, parseJsonBody } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { assertBookingTransition } from "@/lib/booking-status";
import { getSession } from "@/lib/auth";
import { computeRewardAdjustedFinalPrice, handleBookingCompletedLoyalty } from "@/lib/loyalty";
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
        include: { transaction: true, service: { select: { basePrice: true } } }
      });
      if (!booking) {
        throw new ApiError(404, "BOOKING_NOT_FOUND", "Booking not found.");
      }

      // Idempotent: already completed with transaction → return as-is
      if (booking.status === BookingStatus.COMPLETED && booking.transaction) {
        return booking;
      }

      assertBookingTransition(booking.status, BookingStatus.COMPLETED);

      // Enforce finalPrice for AFTER_INSPECTION bookings
      if (booking.priceTypeSnapshot === PriceType.AFTER_INSPECTION && Number(body.finalPrice) <= 0) {
        throw new ApiError(400, "FINAL_PRICE_REQUIRED", "Final price is required for inspection-priced bookings.");
      }

      let finalPrice = Number(body.finalPrice);
      let originalPrice: number | null = null;
      let pricingMode: BookingPricingMode = BookingPricingMode.MANUAL;
      let rewardId: string | null = null;
      let redeemedRewardPayload: {
        id: string;
        rewardType: RewardType;
        discountPercentage: number | null;
        fixedAmount: number | null;
      } | null = null;

      if (body.rewardId) {
        const reward = await tx.customerReward.findFirst({
          where: {
            id: body.rewardId,
            customerId: booking.customerId,
            status: CustomerRewardStatus.AVAILABLE
          },
          select: {
            id: true,
            rewardType: true,
            discountPercentage: true,
            fixedAmount: true
          }
        });

        if (!reward) {
          throw new ApiError(400, "REWARD_NOT_AVAILABLE", "Selected reward is not available for this customer.");
        }

        const basePrice = Number(body.originalPrice ?? body.finalPrice);
        if (!Number.isFinite(basePrice) || basePrice < 0) {
          throw new ApiError(400, "INVALID_ORIGINAL_PRICE", "originalPrice must be a positive number when using reward redemption.");
        }

        originalPrice = basePrice;
        finalPrice = computeRewardAdjustedFinalPrice({
          rewardType: reward.rewardType,
          originalPrice: basePrice,
          discountPercentage: reward.discountPercentage == null ? null : Number(reward.discountPercentage),
          fixedAmount: reward.fixedAmount == null ? null : Number(reward.fixedAmount),
          finalPriceFallback: Number(body.finalPrice)
        });
        pricingMode = BookingPricingMode.REWARD;
        rewardId = reward.id;
        redeemedRewardPayload = {
          id: reward.id,
          rewardType: reward.rewardType,
          discountPercentage: reward.discountPercentage == null ? null : Number(reward.discountPercentage),
          fixedAmount: reward.fixedAmount == null ? null : Number(reward.fixedAmount)
        };
      } else {
        const snapshotPrice = booking.serviceBasePriceSnapshot == null ? null : Number(booking.serviceBasePriceSnapshot);
        const providedPrice = Number(body.finalPrice);
        if (
          booking.priceTypeSnapshot === PriceType.FIXED &&
          snapshotPrice != null &&
          Number.isFinite(snapshotPrice) &&
          Math.abs(snapshotPrice - providedPrice) < 0.0001
        ) {
          pricingMode = BookingPricingMode.NORMAL;
        } else {
          pricingMode = BookingPricingMode.MANUAL;
        }
      }

      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          status: BookingStatus.COMPLETED,
          finalPrice,
          originalPrice,
          pricingMode,
          rewardId,
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
          unitPrice: finalPrice,
          quantity: 1,
          amount: finalPrice,
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

      if (redeemedRewardPayload) {
        await tx.customerReward.update({
          where: { id: redeemedRewardPayload.id },
          data: {
            status: CustomerRewardStatus.REDEEMED,
            redeemedAt: now,
            redeemedBookingId: id
          }
        });
      }

      return updatedBooking;
    });

    try {
      await handleBookingCompletedLoyalty({
        bookingId: item.id,
        customerId: item.customerId
      });
    } catch (rewardError) {
      console.error("LOYALTY_BOOKING_REWARD_SYNC_FAILED", rewardError);
    }

    await logAudit({
      action: "BOOKING_STATUS_CHANGE",
      entity: "Booking",
      entityId: item.id,
      actorId: actor.sub,
      payload: {
        to: BookingStatus.COMPLETED,
        finalPrice: item.finalPrice,
        originalPrice: item.originalPrice,
        pricingMode: item.pricingMode,
        rewardId: item.rewardId,
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
