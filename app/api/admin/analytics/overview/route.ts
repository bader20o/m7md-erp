import { fail, ok } from "@/lib/api";
import { getAnalyticsOverview } from "@/lib/analytics/overview";
import { getSession } from "@/lib/auth";
import { requireAnyPermission } from "@/lib/rbac";
import { adminAnalyticsOverviewQuerySchema } from "@/lib/validators/admin-analytics";
import { parseDateOnlyUtc } from "@/lib/validators/reports";

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAnyPermission(await getSession(), ["analytics"]);
    const url = new URL(request.url);
    const query = await adminAnalyticsOverviewQuerySchema.parseAsync({
      from: url.searchParams.get("from") ?? "",
      to: url.searchParams.get("to") ?? "",
      groupBy: url.searchParams.get("groupBy") ?? "day"
    });

    const data = await getAnalyticsOverview({
      from: parseDateOnlyUtc(query.from),
      to: parseDateOnlyUtc(query.to),
      groupBy: query.groupBy
    });

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
