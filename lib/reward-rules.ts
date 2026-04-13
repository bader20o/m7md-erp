import { RewardType, type Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api";

export type RewardRuleWriteInput = {
  code: string;
  title: string;
  description?: string | null;
  triggerType: "VISIT_COUNT" | "COMPLETED_BOOKING_COUNT";
  triggerValue: number;
  rewardType: "FREE_SERVICE" | "DISCOUNT_PERCENTAGE" | "FIXED_AMOUNT_DISCOUNT" | "CUSTOM_GIFT";
  rewardServiceId?: string | null;
  rewardLabel?: string | null;
  rewardIconUrl?: string | null;
  discountPercentage?: number | null;
  fixedAmount?: number | null;
  customGiftText?: string | null;
  currency?: string | null;
  periodDays?: number | null;
  isActive?: boolean;
  sortOrder?: number;
  startsAt?: string | null;
  endsAt?: string | null;
};

export function normalizeRewardRuleData(input: RewardRuleWriteInput): Prisma.RewardRuleUncheckedCreateInput {
  return {
    code: input.code.trim().toUpperCase(),
    title: input.title.trim(),
    description: normalizeOptionalText(input.description),
    triggerType: input.triggerType,
    triggerValue: input.triggerValue,
    rewardType: input.rewardType,
    rewardServiceId: input.rewardServiceId?.trim() || null,
    rewardLabel: normalizeOptionalText(input.rewardLabel),
    rewardIconUrl: normalizeOptionalText(input.rewardIconUrl),
    discountPercentage: input.discountPercentage ?? null,
    fixedAmount: input.fixedAmount ?? null,
    customGiftText: normalizeOptionalText(input.customGiftText),
    currency: normalizeOptionalText(input.currency),
    periodDays: input.periodDays ?? null,
    isActive: input.isActive ?? true,
    sortOrder: input.sortOrder ?? 0,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null
  };
}

export function normalizeOptionalText(value?: string | null): string | null {
  if (value == null) return null;
  const text = value.trim();
  return text.length ? text : null;
}

export function assertValidRewardRule(data: {
  triggerValue: number;
  rewardType: RewardType | string;
  rewardServiceId?: string | null;
  rewardLabel?: string | null;
  rewardIconUrl?: string | null;
  discountPercentage?: number | null;
  fixedAmount?: number | null;
  customGiftText?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  periodDays?: number | null;
}): void {
  if (!Number.isInteger(data.triggerValue) || data.triggerValue <= 0) {
    throw new ApiError(400, "INVALID_TRIGGER_VALUE", "triggerValue must be greater than zero.");
  }

  if (data.startsAt && data.endsAt && data.endsAt < data.startsAt) {
    throw new ApiError(400, "INVALID_DATE_RANGE", "endsAt must be after startsAt.");
  }

  if (data.periodDays != null && (!Number.isInteger(data.periodDays) || data.periodDays <= 0)) {
    throw new ApiError(400, "INVALID_PERIOD_DAYS", "periodDays must be a positive integer when provided.");
  }

  if (data.rewardIconUrl && data.rewardIconUrl.length > 1200) {
    throw new ApiError(400, "INVALID_REWARD_ICON_URL", "rewardIconUrl is too long.");
  }

  if (data.rewardType === RewardType.FREE_SERVICE) {
    if (!data.rewardServiceId) {
      throw new ApiError(400, "INVALID_REWARD_CONFIG", "FREE_SERVICE requires rewardServiceId.");
    }
    return;
  }

  if (data.rewardType === RewardType.DISCOUNT_PERCENTAGE) {
    const pct = Number(data.discountPercentage ?? 0);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      throw new ApiError(400, "INVALID_REWARD_CONFIG", "DISCOUNT_PERCENTAGE requires discountPercentage between 0 and 100.");
    }
    return;
  }

  if (data.rewardType === RewardType.FIXED_AMOUNT_DISCOUNT) {
    const amount = Number(data.fixedAmount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError(400, "INVALID_REWARD_CONFIG", "FIXED_AMOUNT_DISCOUNT requires fixedAmount > 0.");
    }
    return;
  }

  if (data.rewardType === RewardType.CUSTOM_GIFT) {
    const hasGift = Boolean(normalizeOptionalText(data.customGiftText) || normalizeOptionalText(data.rewardLabel));
    if (!hasGift) {
      throw new ApiError(400, "INVALID_REWARD_CONFIG", "CUSTOM_GIFT requires customGiftText or rewardLabel.");
    }
  }
}
