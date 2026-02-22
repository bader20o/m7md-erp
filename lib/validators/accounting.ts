import { z } from "zod";

export const walkInIncomeSchema = z.object({
  itemName: z.string().trim().min(2).max(160),
  unitPrice: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(1).max(10000).default(1),
  occurredAt: z.coerce.date(),
  note: z.string().trim().max(500).optional(),
  branchId: z.string().min(1).max(64).optional()
});

export const createExpenseSchema = z.object({
  itemName: z.string().trim().min(2).max(160),
  unitPrice: z.coerce.number().min(0),
  quantity: z.coerce.number().int().min(1).max(10000).default(1),
  expenseCategory: z.enum(["SUPPLIER", "GENERAL", "SALARY"]).default("GENERAL"),
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
