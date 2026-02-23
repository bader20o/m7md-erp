import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_JWT_SECRET: z.string().min(16),
  HR_ENCRYPTION_KEY: z.string().min(32),
  BACKUP_RETENTION_COUNT: z.coerce.number().int().positive().default(30)
});

const parsed = schema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
  HR_ENCRYPTION_KEY: process.env.HR_ENCRYPTION_KEY ?? process.env.AUTH_JWT_SECRET ?? "",
  BACKUP_RETENTION_COUNT: process.env.BACKUP_RETENTION_COUNT ?? "30"
});

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const env = parsed.data;
