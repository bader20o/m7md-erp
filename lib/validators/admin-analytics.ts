import { z } from "zod";
import { parseDateOnlyUtc } from "@/lib/validators/reports";

const DAY_MS = 24 * 60 * 60 * 1000;

export const analyticsGroupBySchema = z.enum(["day", "week", "month"]);

const rangeBaseSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const refineRangeSchema = <T extends z.ZodRawShape>(shape: T): z.ZodEffects<z.ZodObject<T>> =>
  z.object(shape).superRefine((value, ctx) => {
    const from = typeof value.from === "string" ? value.from : "";
    const to = typeof value.to === "string" ? value.to : "";

    let fromDate: Date;
    let toDate: Date;
    try {
      fromDate = parseDateOnlyUtc(from);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["from"],
        message: "from must be a valid YYYY-MM-DD date."
      });
      return;
    }

    try {
      toDate = parseDateOnlyUtc(to);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "to must be a valid YYYY-MM-DD date."
      });
      return;
    }

    if (fromDate.getTime() > toDate.getTime()) {
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

export const adminAnalyticsOverviewQuerySchema = refineRangeSchema({
  ...rangeBaseSchema.shape,
  groupBy: analyticsGroupBySchema.default("day")
});

export const adminAnalyticsSummaryQuerySchema = refineRangeSchema({
  ...rangeBaseSchema.shape
});

export type AnalyticsGroupBy = z.infer<typeof analyticsGroupBySchema>;

