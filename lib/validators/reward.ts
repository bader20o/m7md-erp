import { z } from "zod";

export const rewardTriggerTypeSchema = z.enum(["VISIT_COUNT", "COMPLETED_BOOKING_COUNT"]);
export const rewardTypeSchema = z.enum([
  "FREE_SERVICE",
  "DISCOUNT_PERCENTAGE",
  "FIXED_AMOUNT_DISCOUNT",
  "CUSTOM_GIFT"
]);

const nullableTrimmed = z.string().trim().max(500).nullable().optional();

export const createRewardRuleSchema = z
  .object({
    code: z.string().trim().min(2).max(64),
    title: z.string().trim().min(2).max(160),
    description: nullableTrimmed,
    triggerType: rewardTriggerTypeSchema,
    triggerValue: z.coerce.number().int().positive(),
    rewardType: rewardTypeSchema,
    rewardServiceId: z.string().trim().min(1).nullable().optional(),
    rewardLabel: nullableTrimmed,
    discountPercentage: z.coerce.number().positive().max(100).nullable().optional(),
    fixedAmount: z.coerce.number().positive().nullable().optional(),
    customGiftText: nullableTrimmed,
    currency: z.string().trim().min(2).max(8).nullable().optional(),
    periodDays: z.coerce.number().int().positive().nullable().optional(),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().default(0),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional()
  })
  .strict();

export const updateRewardRuleSchema = z
  .object({
    code: z.string().trim().min(2).max(64).optional(),
    title: z.string().trim().min(2).max(160).optional(),
    description: nullableTrimmed,
    triggerType: rewardTriggerTypeSchema.optional(),
    triggerValue: z.coerce.number().int().positive().optional(),
    rewardType: rewardTypeSchema.optional(),
    rewardServiceId: z.string().trim().min(1).nullable().optional(),
    rewardLabel: nullableTrimmed,
    discountPercentage: z.coerce.number().positive().max(100).nullable().optional(),
    fixedAmount: z.coerce.number().positive().nullable().optional(),
    customGiftText: nullableTrimmed,
    currency: z.string().trim().min(2).max(8).nullable().optional(),
    periodDays: z.coerce.number().int().positive().nullable().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional()
  })
  .strict();

export const visitCheckInSchema = z
  .object({
    token: z.string().trim().min(20),
    notes: z.string().trim().max(500).optional()
  })
  .strict();
