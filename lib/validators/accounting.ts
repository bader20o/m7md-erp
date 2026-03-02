import { z } from "zod";

export const walkInIncomeSchema = z.object({
  itemName: z.string().trim().min(2).max(160),
  unitPrice: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(1).max(10000).default(1),
  occurredAt: z.coerce.date(),
  note: z.string().trim().max(500).optional(),
  branchId: z.string().min(1).max(64).optional()
});

export const inventorySaleSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(10000),
  unitPrice: z.coerce.number().min(0).optional(),
  occurredAt: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional()
});

export const createExpenseSchema = z.object({
  itemName: z.string().trim().min(2).max(160),
  unitPrice: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(1).max(10000).default(1),
  expenseCategory: z.preprocess(
    (value) => (typeof value === "string" ? value.toUpperCase() : value),
    z.enum(["SUPPLIER", "GENERAL", "SALARY"]).default("GENERAL")
  ),
  partId: z.string().optional(),
  supplierId: z.string().optional(),
  supplierName: z.string().max(150).optional(),
  invoiceId: z.string().optional(),
  occurredAt: z.coerce.date(),
  note: z.string().trim().max(500).optional()
});

export const createInvoiceSchema = z.object({
  number: z.string().trim().min(2).max(80),
  note: z.string().max(500).optional(),
  dueDate: z.coerce.date().optional(),
  issueDate: z.coerce.date().optional(),
  supplierId: z.string().optional()
});

export const createInvoiceLineSchema = z.object({
  invoiceId: z.string().min(1),
  supplierId: z.string().optional(),
  serviceId: z.string().optional(),
  description: z.string().trim().min(2).max(300),
  quantity: z.coerce.number().int().min(1).max(10000).default(1),
  unitAmount: z.coerce.number().min(0),
  expenseCategory: z.enum(["SUPPLIER", "GENERAL", "SALARY"]).default("SUPPLIER"),
  occurredAt: z.coerce.date().optional()
});

export const createItemCatalogSchema = z.object({
  itemName: z.string().trim().min(2).max(160),
  defaultUnitPrice: z.coerce.number().min(0),
  category: z.string().trim().max(120).optional(),
  isActive: z.boolean().default(true)
});

export const updateItemCatalogSchema = z
  .object({
    itemName: z.string().trim().min(2).max(160).optional(),
    defaultUnitPrice: z.coerce.number().min(0).optional(),
    category: z.string().trim().max(120).nullable().optional(),
    isActive: z.boolean().optional()
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "At least one field is required."
  });

// ── Sale Invoice (ERP integration) ─────────────────────────────────

const saleInvoiceLineSchema = z
  .object({
    partId: z.string().optional().nullable(),
    serviceId: z.string().optional().nullable(),
    lineType: z.enum(["INVENTORY", "OUTSIDE", "SERVICE"]),
    description: z.string().trim().min(1).max(300),
    quantity: z.coerce.number().int().min(1).max(100000),
    unitAmount: z.coerce.number().min(0)
  })
  .superRefine((value, context) => {
    if (value.lineType === "INVENTORY" && !value.partId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["partId"],
        message: "partId is required for INVENTORY lines."
      });
    }
  });

export const createSaleInvoiceSchema = z.object({
  number: z.string().trim().min(2).max(80),
  note: z.string().max(500).optional(),
  dueDate: z.coerce.date().optional(),
  issueDate: z.coerce.date().optional(),
  customerId: z.string().optional(),
  lines: z.array(saleInvoiceLineSchema).min(1, "At least one line is required.")
});

export const updateSaleInvoiceSchema = z.object({
  note: z.string().max(500).optional(),
  dueDate: z.coerce.date().optional(),
  customerId: z.string().optional(),
  lines: z.array(saleInvoiceLineSchema).min(1, "At least one line is required.")
});
