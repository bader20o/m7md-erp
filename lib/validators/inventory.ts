import { z } from "zod";

function nullableString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

export const listPartsQuerySchema = z.object({
  q: z.string().optional(),
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true")
});

export const createPartSchema = z.object({
  name: z.string().trim().min(2).max(160),
  sku: z.string().max(120).optional().transform(nullableString),
  unit: z.string().trim().min(1).max(40),
  costPrice: z.coerce.number().min(0).optional(),
  sellPrice: z.coerce.number().min(0).optional(),
  stockQty: z.coerce.number().int().min(0).default(0),
  lowStockThreshold: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true)
});

export const updatePartSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    sku: z.string().max(120).optional().nullable().transform((value) => {
      if (value === null) {
        return null;
      }
      return nullableString(value);
    }),
    unit: z.string().trim().min(1).max(40).optional(),
    costPrice: z.coerce.number().min(0).optional().nullable(),
    sellPrice: z.coerce.number().min(0).optional().nullable(),
    stockQty: z.coerce.number().int().min(0).optional(),
    lowStockThreshold: z.coerce.number().int().min(0).optional(),
    isActive: z.boolean().optional()
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "At least one field is required."
  });

export const listMovementsQuerySchema = z.object({
  partId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  take: z.coerce.number().int().min(1).max(300).default(150)
});

export const createMovementSchema = z.object({
  partId: z.string().min(1),
  type: z.enum(["IN", "OUT", "ADJUST"]),
  quantity: z.coerce.number().int().min(1),
  occurredAt: z.coerce.date(),
  note: z.string().trim().max(500).optional(),
  bookingId: z.string().optional(),
  supplierId: z.string().optional(),
  invoiceId: z.string().optional(),
  adjustDirection: z.enum(["IN", "OUT"]).optional()
});
