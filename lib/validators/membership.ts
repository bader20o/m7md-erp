import { z } from "zod";

export const createMembershipOrderSchema = z.object({
  planId: z.string().min(1),
  customerId: z.string().optional(),
  startDate: z.coerce.date().optional()
});

export const updateMembershipOrderStatusSchema = z.object({
  status: z.enum(["ACTIVE", "EXPIRED", "SUSPENDED"])
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
