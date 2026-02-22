import { z } from "zod";

const DAY_MS = 24 * 60 * 60 * 1000;
const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

function parseDateOnly(value: string): Date | null {
  if (!dateOnlyRegex.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export const analyticsRangeQuerySchema = z
  .object({
    from: z.string().regex(dateOnlyRegex),
    to: z.string().regex(dateOnlyRegex)
  })
  .superRefine((value, ctx) => {
    const fromDate = parseDateOnly(value.from);
    const toDate = parseDateOnly(value.to);

    if (!fromDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["from"],
        message: "from must be a valid YYYY-MM-DD date."
      });
      return;
    }

    if (!toDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "to must be a valid YYYY-MM-DD date."
      });
      return;
    }

    if (fromDate > toDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "to must be greater than or equal to from."
      });
      return;
    }

    const daySpan = Math.floor((toDate.getTime() - fromDate.getTime()) / DAY_MS) + 1;
    if (daySpan > 366) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "Date range cannot exceed 366 days."
      });
    }
  });

export function parseDateOnlyUtc(value: string): Date {
  const parsed = parseDateOnly(value);
  if (!parsed) {
    throw new Error("Invalid date-only value.");
  }
  return parsed;
}

