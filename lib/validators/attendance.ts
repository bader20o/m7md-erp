import { z } from "zod";

export const attendanceScanRequestSchema = z.object({
  qrText: z.string().trim().min(1).max(500)
});
