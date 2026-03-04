import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_JWT_SECRET: z.string().min(16),
  HR_ENCRYPTION_KEY: z.string().min(32),
  ATTENDANCE_QR_SECRET: z.string().min(16),
  ATTENDANCE_TIMEZONE: z.string().min(1).default("Asia/Amman"),
  ATTENDANCE_ALLOWED_IPS: z.string().default(""),
  ATTENDANCE_QR_ROTATION_SECONDS: z.coerce.number().int().positive().default(5),
  ATTENDANCE_QR_GRACE_WINDOWS: z.coerce.number().int().min(0).default(1),
  ATTENDANCE_MANUAL_ENTRY_ENABLED: z.coerce.boolean().default(true),
  BACKUP_RETENTION_COUNT: z.coerce.number().int().positive().default(30)
});

const parsed = schema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
  HR_ENCRYPTION_KEY: process.env.HR_ENCRYPTION_KEY ?? process.env.AUTH_JWT_SECRET ?? "",
  ATTENDANCE_QR_SECRET: process.env.ATTENDANCE_QR_SECRET ?? process.env.AUTH_JWT_SECRET ?? "",
  ATTENDANCE_TIMEZONE: process.env.ATTENDANCE_TIMEZONE ?? "Asia/Amman",
  ATTENDANCE_ALLOWED_IPS: process.env.ATTENDANCE_ALLOWED_IPS ?? "",
  ATTENDANCE_QR_ROTATION_SECONDS: process.env.ATTENDANCE_QR_ROTATION_SECONDS ?? "5",
  ATTENDANCE_QR_GRACE_WINDOWS: process.env.ATTENDANCE_QR_GRACE_WINDOWS ?? "1",
  ATTENDANCE_MANUAL_ENTRY_ENABLED: process.env.ATTENDANCE_MANUAL_ENTRY_ENABLED ?? "true",
  BACKUP_RETENTION_COUNT: process.env.BACKUP_RETENTION_COUNT ?? "30"
});

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const env = parsed.data;
