import { z } from "zod";

export const registerSchema = z.object({
  phone: z.string().min(7).max(20),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(120),
  locale: z.enum(["en", "ar"]).default("en")
});

export const loginSchema = z.object({
  phone: z.string().min(7).max(20),
  password: z.string().min(8).max(128)
});

