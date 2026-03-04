import { z } from "zod";

const MEMBERSHIP_DURATION_OPTIONS = [1, 3, 6, 12, 24] as const;

export const membershipBenefitInputSchema = z.object({
  id: z.string().min(1).optional(),
  code: z.string().trim().min(1).max(100),
  titleEn: z.string().trim().min(1).max(160),
  titleAr: z.string().trim().min(1).max(160),
  descriptionEn: z.string().max(1000).optional().nullable(),
  descriptionAr: z.string().max(1000).optional().nullable(),
  limitCount: z.coerce.number().int().positive(),
  isActive: z.boolean().optional().default(true)
});

const membershipBenefitsSchema = z
  .array(membershipBenefitInputSchema)
  .default([])
  .superRefine((benefits, ctx) => {
    const seen = new Map<string, number[]>();

    benefits.forEach((benefit, index) => {
      const key = benefit.code.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, []);
      }
      seen.get(key)?.push(index);
    });

    seen.forEach((indexes) => {
      if (indexes.length < 2) return;
      indexes.forEach((index) => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "code"],
          message: "Benefit code must be unique within the plan."
        });
      });
    });
  });

export const membershipPlanInputSchema = z.object({
  tier: z.string().trim().min(1).max(60),
  nameEn: z.string().trim().min(2).max(120),
  nameAr: z.string().trim().min(2).max(120),
  imageUrl: z.string().max(1000).optional().nullable(),
  descriptionEn: z.string().max(1000).optional().nullable(),
  descriptionAr: z.string().max(1000).optional().nullable(),
  price: z.coerce.number().nonnegative(),
  durationMonths: z.coerce.number().int().refine((value) => MEMBERSHIP_DURATION_OPTIONS.includes(value as (typeof MEMBERSHIP_DURATION_OPTIONS)[number]), {
    message: "Duration must match an available preset."
  }),
  color: z
    .string()
    .trim()
    .regex(/^#([0-9A-F]{3}){1,2}$/i, "Color must be a valid hex value.")
    .optional()
    .nullable(),
  benefits: membershipBenefitsSchema
});

export const updateMembershipPlanSchema = membershipPlanInputSchema.partial().extend({
  isActive: z.boolean().optional()
});

export const createMembershipOrderSchema = z.object({
  planId: z.string().min(1),
  customerId: z.string().optional(),
  startDate: z.coerce.date().optional()
});

export const subscribeMembershipSchema = z.object({
  planId: z.string().min(1)
});

export const approveMembershipSubscriptionSchema = z
  .object({
    deliveryCompanyName: z.string().max(160).optional().nullable(),
    deliveryPhone: z.string().max(50).optional().nullable(),
    deliveryTrackingCode: z.string().max(120).optional().nullable(),
    deliveryNote: z.string().max(1000).optional().nullable()
  })
  .superRefine((value, ctx) => {
    if (!value.deliveryCompanyName?.trim() && !value.deliveryPhone?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either delivery company name or delivery phone is required."
      });
    }
  });

export const rejectMembershipSubscriptionSchema = z.object({
  rejectionReason: z.string().trim().min(1).max(1000)
});

export const confirmMembershipBenefitUseSchema = z.object({
  confirmNote: z.string().trim().max(500).optional().nullable()
});

export const createMembershipAdminNoteSchema = z.object({
  note: z.string().trim().min(1).max(2000)
});

export const useEntitlementSchema = z.object({
  serviceId: z.string().min(1),
  bookingId: z.string().optional(),
  note: z.string().max(500).optional()
});

export const adjustUsageSchema = z.object({
  serviceId: z.string().min(1),
  delta: z.coerce.number().int().min(-500).max(500).refine((value) => value !== 0, {
    message: "delta cannot be 0"
  }),
  reason: z.string().max(500).optional()
});
