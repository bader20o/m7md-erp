import { z } from "zod";

export const createEmployeeSchema = z.object({
  phone: z.string().min(7).max(20),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(120),
  jobTitle: z.string().max(120).optional(),
  monthlyBase: z.coerce.number().min(0).optional()
});

export const attendanceScanSchema = z.object({
  employeeId: z.string().min(1),
  qrPayload: z.string().min(10),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  geoNote: z.string().max(160).optional()
});

export const salaryPaymentSchema = z.object({
  employeeId: z.string().min(1),
  amount: z.coerce.number().min(0),
  periodMonth: z.coerce.number().int().min(1).max(12),
  periodYear: z.coerce.number().int().min(2024).max(2200),
  markPaid: z.boolean().default(true),
  note: z.string().max(500).optional(),
  occurredAt: z.coerce.date().optional()
});
