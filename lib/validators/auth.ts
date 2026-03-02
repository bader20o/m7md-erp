import { z } from "zod";
import { normalizePhone } from "../utils/phone";

const phoneSchema = z
  .string()
  .trim()
  .transform((val) => normalizePhone(val) || val)
  .refine((val) => /^07\d{8}$/.test(val), "Phone must be a valid Jordan mobile number starting with 07 and contain 10 digits.");

export const registerSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(120),
  locale: z.enum(["en", "ar"]).default("en")
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(8).max(128)
});
