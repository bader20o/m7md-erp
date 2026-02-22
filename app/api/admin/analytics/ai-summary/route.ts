import { Role } from "@prisma/client";
import { fail, ok } from "@/lib/api";
import { getAnalyticsOverview } from "@/lib/analytics/overview";
import { getSession } from "@/lib/auth";
import { requireRoles } from "@/lib/rbac";
import { adminAnalyticsSummaryQuerySchema } from "@/lib/validators/admin-analytics";
import { parseDateOnlyUtc } from "@/lib/validators/reports";

type Signal = {
  type: "growth" | "risk" | "anomaly" | "opportunity";
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
};

function buildSignals(data: Awaited<ReturnType<typeof getAnalyticsOverview>>): Signal[] {
  const signals: Signal[] = [];
  const { kpis, breakdowns, membership, timeseries } = data;

  if (kpis.totalIncome > 0) {
    const expenseRatio = kpis.totalExpenses / kpis.totalIncome;
    if (expenseRatio >= 0.85) {
      signals.push({
        type: "risk",
        severity: "high",
        title: "Expense pressure is high",
        detail: `Expenses are ${Math.round(expenseRatio * 100)}% of income in this period.`
      });
    } else if (expenseRatio >= 0.7) {
      signals.push({
        type: "risk",
        severity: "medium",
        title: "Expense ratio needs monitoring",
        detail: `Expenses are ${Math.round(expenseRatio * 100)}% of income in this period.`
      });
    } else {
      signals.push({
        type: "growth",
        severity: "low",
        title: "Healthy margin",
        detail: `Profit is ${Math.round((kpis.totalProfit / kpis.totalIncome) * 100)}% of income.`
      });
    }
  }

  const membershipShare =
    kpis.totalIncome > 0 ? membership.membershipRevenue / kpis.totalIncome : 0;
  if (membershipShare < 0.15) {
    signals.push({
      type: "opportunity",
      severity: "medium",
      title: "Membership revenue is relatively low",
      detail: "Membership contributes less than 15% of income. Consider renewal campaigns."
    });
  }

  const noShow = breakdowns.ordersByStatus.find((item) => item.status === "NO_SHOW")?.count ?? 0;
  if (kpis.totalOrders > 0) {
    const noShowRate = noShow / kpis.totalOrders;
    if (noShowRate >= 0.12) {
      signals.push({
        type: "anomaly",
        severity: "medium",
        title: "No-show rate is elevated",
        detail: `${Math.round(noShowRate * 100)}% of bookings were no-show in this range.`
      });
    }
  }

  if (timeseries.length >= 3) {
    const profits = timeseries.map((item) => item.profit);
    const avgProfit = profits.reduce((sum, value) => sum + value, 0) / profits.length;
    const maxProfit = Math.max(...profits);
    const minProfit = Math.min(...profits);

    if (avgProfit !== 0 && maxProfit > avgProfit * 2) {
      signals.push({
        type: "anomaly",
        severity: "low",
        title: "Profit spike detected",
        detail: "One period produced more than 2x the average profit."
      });
    }

    if (minProfit < 0) {
      signals.push({
        type: "risk",
        severity: "medium",
        title: "Loss period detected",
        detail: "At least one period had negative profit."
      });
    }
  }

  if (!signals.length) {
    signals.push({
      type: "growth",
      severity: "low",
      title: "Stable operations",
      detail: "No major anomaly was detected in the selected range."
    });
  }

  return signals;
}

function buildSummaryText(data: Awaited<ReturnType<typeof getAnalyticsOverview>>): string {
  const { range, kpis, membership } = data;
  return [
    `From ${range.from} to ${range.to}, total income was ${kpis.totalIncome.toFixed(2)} and expenses were ${kpis.totalExpenses.toFixed(2)}.`,
    `Net profit reached ${kpis.totalProfit.toFixed(2)} across ${kpis.totalOrders} orders with an average order value of ${kpis.avgOrderValue.toFixed(2)}.`,
    `Membership activity: ${membership.newCount} new, ${membership.renewedCount} renewed, ${membership.expiredCount} expired, with membership revenue at ${membership.membershipRevenue.toFixed(2)}.`
  ].join(" ");
}

export async function GET(request: Request): Promise<Response> {
  try {
    requireRoles(await getSession(), [Role.ADMIN]);
    const url = new URL(request.url);
    const query = await adminAnalyticsSummaryQuerySchema.parseAsync({
      from: url.searchParams.get("from") ?? "",
      to: url.searchParams.get("to") ?? ""
    });

    const overview = await getAnalyticsOverview({
      from: parseDateOnlyUtc(query.from),
      to: parseDateOnlyUtc(query.to),
      groupBy: "day"
    });
    const signals = buildSignals(overview);

    return ok({
      summaryText: buildSummaryText(overview),
      signals,
      compactData: {
        range: overview.range,
        kpis: overview.kpis,
        membership: overview.membership,
        incomeBySource: overview.breakdowns.incomeBySource,
        expensesByCategory: overview.breakdowns.expensesByCategory,
        ordersByStatus: overview.breakdowns.ordersByStatus,
        topServices: overview.top.services.byRevenue.slice(0, 5),
        topEmployees: overview.top.employees.slice(0, 5),
        recentTrend: overview.timeseries.slice(-7)
      }
    });
  } catch (error) {
    return fail(error);
  }
}

