import { z } from "zod";

export const createBookingSchema = z.object({
  serviceId: z.string().min(1),
  appointmentAt: z.coerce.date(),
  notes: z.string().max(500).optional(),
  customerId: z.string().min(1).optional(),
  branchId: z.string().min(1).max(64).optional()
});

export const rejectBookingSchema = z.object({
  rejectReason: z.string().trim().min(3).max(500)
});

export const cancelBookingSchema = z.object({
  cancelReason: z.string().trim().min(3).max(500)
});

export const completeBookingSchema = z.object({
  finalPrice: z.coerce.number().min(0),
  internalNote: z.string().max(1000).optional(),
  performedByEmployeeId: z.string().min(1).optional()
});

export const assignBookingEmployeeSchema = z.object({
  employeeId: z.string().min(1),
  serviceId: z.string().min(1).optional(),
  note: z.string().max(300).optional()
});
