"use client";

import { format, subDays } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import type { Dictionary } from "@/lib/i18n";

type GroupBy = "day" | "week" | "month";
type BookingStatus =
  | "PENDING"
  | "PRICE_SET"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "LATE_CANCELLED"
  | "NO_SHOW"
  | "COMPLETED"
  | "NOT_SERVED";

type Payload = {
  range: { from: string; to: string; groupBy: GroupBy };
  todaySnapshot: {
    income: number;
    expenses: number;
    bookings: number;
    activeEmployees: number;
  };
  inventory: {
    lowStockItems: Array<{ id: string; name: string; stockQty: number; lowStockThreshold: number }>;
    totalPartsCount: number;
    itemsSoldToday: number;
  };
  customerFunnel: {
    newCustomers: number;
    returningCustomers: number;
    customersWithDebt: number;
  };
  alerts: {
    lowInventory: Array<{ partId: string; name: string; stockQty: number; lowStockThreshold: number }>;
  };
  kpis: {
    totalIncome: number;
    totalExpenses: number;
    totalProfit: number;
    totalOrders: number;
    avgOrderValue: number;
    activeMemberships: number;
    newMembershipsInRange: number;
  };
  timeseries: Array<{
    bucketStart: string;
    income: number;
    expenses: number;
    profit: number;
    orders: number;
  }>;
  breakdowns: {
    incomeBySource: Array<{ source: "BOOKING" | "WALK_IN" | "MEMBERSHIP"; amount: number }>;
    expensesByCategory: Array<{ category: "SUPPLIER" | "GENERAL" | "SALARY"; amount: number }>;
    ordersByStatus: Array<{ status: BookingStatus; count: number }>;
  };
  membership: {
    newCount: number;
    renewedCount: number;
    expiredCount: number;
    membershipRevenue: number;
  };
  top: {
    services: {
      byRevenue: Array<{
        serviceNameEn: string;
        serviceNameAr: string;
        ordersCount: number;
        revenue: number;
      }>;
      byOrders: Array<{
        serviceNameEn: string;
        serviceNameAr: string;
        ordersCount: number;
        revenue: number;
      }>;
    };
    employees: Array<{
      employeeId: string;
      name: string;
      handledOrders: number;
      revenue: number;
      workHours: number;
      ratingAvg: number | null;
    }>;
  };
  recent: {
    transactions: Array<{
      id: string;
      occurredAt: string;
      type: "INCOME" | "EXPENSE";
      incomeSource: "BOOKING" | "WALK_IN" | "MEMBERSHIP" | null;
      expenseCategory: "SUPPLIER" | "GENERAL" | "SALARY" | null;
      itemName: string;
      quantity: number;
      unitPrice: number;
      amount: number;
      recordedBy: string;
    }>;
    completedBookings: Array<{
      id: string;
      completedAt: string;
      status: BookingStatus;
      customerName: string;
      serviceNameEn: string;
      serviceNameAr: string;
      employeeName: string;
      finalPrice: number;
    }>;
  };
};

type ApiResponse =
  | { success: true; data: Payload }
  | { success: false; error?: { message?: string } };

type Props = {
  locale: string;
  dir: "ltr" | "rtl";
  dict: Dictionary;
  adminUserId: string;
};

const EXPENSE_COLORS = ["#94a3b8", "#64748b", "#475569"];
const GROUP_BY_VALUES: GroupBy[] = ["day", "week", "month"];
const CHART_GROUP_BY_VALUES: Array<"day" | "week"> = ["day", "week"];

function safeParse<T>(value: string | null): T | null {
  try {
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function isGroupBy(value: unknown): value is GroupBy {
  return typeof value === "string" && GROUP_BY_VALUES.includes(value as GroupBy);
}

function isChartGroupBy(value: unknown): value is "day" | "week" {
  return typeof value === "string" && CHART_GROUP_BY_VALUES.includes(value as "day" | "week");
}

function toInputDate(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

function toDisplayDate(value: string, locale: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function toDisplayDateTime(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusBadgeClass(status: BookingStatus): string {
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-800";
  if (status === "PENDING") return "bg-slate-100 text-slate-700";
  if (status === "PRICE_SET") return "bg-amber-100 text-amber-800";
  if (status === "APPROVED") return "bg-blue-100 text-blue-700";
  if (status === "NO_SHOW") return "bg-purple-100 text-purple-700";
  if (status === "CANCELLED" || status === "LATE_CANCELLED") return "bg-orange-100 text-orange-800";
  if (status === "REJECTED") return "bg-red-100 text-red-700";
  return "bg-zinc-100 text-zinc-700";
}

function statusText(status: BookingStatus, dict: Dictionary): string {
  if (status === "PENDING") return dict.analyticsStatusPending;
  if (status === "PRICE_SET") return "Price Set";
  if (status === "APPROVED") return dict.analyticsStatusConfirmed;
  if (status === "REJECTED") return dict.analyticsStatusRejected;
  if (status === "CANCELLED") return dict.analyticsStatusCancelled;
  if (status === "LATE_CANCELLED") return dict.analyticsStatusLateCancelled;
  if (status === "NO_SHOW") return dict.analyticsStatusNoShow;
  if (status === "COMPLETED") return dict.analyticsStatusCompleted;
  if (status === "NOT_SERVED") return dict.analyticsStatusNotServed;
  return status;
}

function formatMoney(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

function SkeletonCard(): React.ReactElement {
  return <div className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />;
}

function ChartFrame({ children }: { children: React.ReactElement }): React.ReactElement {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <div className="mt-3 h-72 min-h-[18rem] w-full min-w-0">
      {ready ? (
        <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={260}>
          {children}
        </ResponsiveContainer>
      ) : (
        <div className="h-full w-full animate-pulse rounded-lg bg-slate-100" />
      )}
    </div>
  );
}

function sourceLabel(value: string | null, dict: Dictionary): string {
  if (value === "BOOKING") return dict.analyticsSourceBooking;
  if (value === "WALK_IN") return dict.analyticsSourceWalkIn;
  if (value === "MEMBERSHIP") return dict.analyticsSourceMembership;
  if (value === "SUPPLIER") return dict.analyticsCategorySupplier;
  if (value === "GENERAL") return dict.analyticsCategoryGeneral;
  if (value === "SALARY") return dict.analyticsCategorySalary;
  return dict.analyticsUnknown;
}

function typeLabel(value: "INCOME" | "EXPENSE", dict: Dictionary): string {
  return value === "INCOME" ? dict.analyticsTypeIncome : dict.analyticsTypeExpense;
}

export function AdminAnalyticsPage({ locale, dir, dict, adminUserId }: Props): React.ReactElement {
  const defaultFrom = useMemo(() => toInputDate(subDays(new Date(), 29)), []);
  const defaultTo = useMemo(() => toInputDate(new Date()), []);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [chartGroupBy, setChartGroupBy] = useState<"day" | "week">("day");
  const [data, setData] = useState<Payload | null>(null);
  const [chartData, setChartData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const filterKey = useMemo(() => `admin-dashboard-filters:${adminUserId}`, [adminUserId]);

  useEffect(() => {
    const saved = safeParse<{ from: string; to: string; groupBy: GroupBy; chartGroupBy: "day" | "week" }>(
      window.localStorage.getItem(filterKey)
    );
    if (!saved) return;
    if (saved.from) setFrom(saved.from);
    if (saved.to) setTo(saved.to);
    if (isGroupBy(saved.groupBy)) {
      setGroupBy(saved.groupBy);
    }
    if (isChartGroupBy(saved.chartGroupBy)) {
      setChartGroupBy(saved.chartGroupBy);
    }
  }, [filterKey]);

  useEffect(() => {
    window.localStorage.setItem(filterKey, JSON.stringify({ from, to, groupBy, chartGroupBy }));
  }, [chartGroupBy, filterKey, from, groupBy, to]);

  const exportTransactionsHref = useMemo(
    () =>
      `/api/admin/reports/export-transactions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    [from, to]
  );
  const exportBookingsHref = useMemo(
    () =>
      `/api/admin/reports/export-bookings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    [from, to]
  );

  useEffect(() => {
    if (!from || !to) return;
    if (from > to) {
      setError(dict.analyticsRangeInvalid);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const query = new URLSearchParams({ from, to, groupBy });
    void fetch(`/api/admin/analytics/overview?${query.toString()}`, {
      cache: "no-store",
      signal: controller.signal
    })
      .then(async (response) => {
        const json = (await response.json()) as ApiResponse;
        if (!response.ok || !json.success) {
          const message =
            !json.success && json.error?.message
              ? json.error.message
              : dict.analyticsUnexpectedError;
          throw new Error(message);
        }
        return json.data;
      })
      .then((payload) => {
        setData(payload);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) return;
        setError(fetchError instanceof Error ? fetchError.message : dict.analyticsUnexpectedError);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [dict.analyticsRangeInvalid, dict.analyticsUnexpectedError, from, groupBy, refreshToken, to]);

  useEffect(() => {
    if (!from || !to || from > to) return;
    const controller = new AbortController();
    setChartLoading(true);
    const query = new URLSearchParams({ from, to, groupBy: chartGroupBy });
    void fetch(`/api/admin/analytics/overview?${query.toString()}`, {
      cache: "no-store",
      signal: controller.signal
    })
      .then(async (response) => {
        const json = (await response.json()) as ApiResponse;
        if (!response.ok || !json.success) {
          throw new Error("Chart fetch failed");
        }
        return json.data;
      })
      .then((payload) => {
        setChartData(payload);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setChartData(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setChartLoading(false);
        }
      });

    return () => controller.abort();
  }, [chartGroupBy, from, refreshToken, to]);

  const pieData = data
    ? data.breakdowns.expensesByCategory.map((item) => ({
        ...item,
        name: sourceLabel(item.category, dict)
      }))
    : [];

  const incomeSourceData = data
    ? data.breakdowns.incomeBySource.map((item) => ({
        ...item,
        label: sourceLabel(item.source, dict)
      }))
    : [];
  const groupedSeries = chartData?.timeseries ?? data?.timeseries ?? [];
  const summaryHighlights = data
    ? [
        `Revenue ${formatMoney(data.kpis.totalIncome, locale)} against expenses ${formatMoney(data.kpis.totalExpenses, locale)} in the selected range.`,
        `${data.kpis.totalOrders.toLocaleString(locale)} orders with an average ticket of ${formatMoney(data.kpis.avgOrderValue, locale)}.`,
        `${data.inventory.lowStockItems.length.toLocaleString(locale)} low-stock items and ${data.customerFunnel.customersWithDebt.toLocaleString(locale)} customers with debt need attention.`
      ]
    : [];
  const insightBadge = data ? `Profit ${formatMoney(data.kpis.totalProfit, locale)}` : null;

  return (
    <section className="space-y-6 text-slate-100">
      <header className="space-y-4 rounded-2xl bg-slate-950 px-1 py-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">{dict.analyticsTitle}</h1>
            <p className="text-sm text-slate-400">{dict.centerName}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={exportTransactionsHref}
              className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5"
            >
              {dict.analyticsExportTransactions}
            </a>
            <a
              href={exportBookingsHref}
              className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5"
            >
              {dict.analyticsExportBookings}
            </a>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_0.9fr_auto]">
          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">{dict.analyticsFromLabel}</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="h-11 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">{dict.analyticsToLabel}</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="h-11 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">{dict.analyticsGroupByLabel}</span>
            <select
              value={groupBy}
              onChange={(event) => {
                const nextValue = event.target.value;
                setGroupBy(isGroupBy(nextValue) ? nextValue : "day");
              }}
              className="h-11 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-100"
            >
              <option value="day">{dict.analyticsGroupByDay}</option>
              <option value="week">{dict.analyticsGroupByWeek}</option>
              <option value="month">{dict.analyticsGroupByMonth}</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => setRefreshToken((value) => value + 1)}
            className="h-11 self-end rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
          >
            {dict.analyticsRefresh}
          </button>
        </div>
      </header>

      {loading && !data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <SkeletonCard key={`kpi-${idx}`} />
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
            <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          </div>
          <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
        </>
      ) : null}

      {!loading && error && !data ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
          <p className="font-semibold">{dict.analyticsErrorTitle}</p>
          <p className="mt-1">{error}</p>
        </div>
      ) : null}

      {error && data ? (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {error}
        </div>
      ) : null}

      {data ? (
        <>
          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">Executive Summary</h2>
                {insightBadge ? <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs text-slate-300">{insightBadge}</span> : null}
              </div>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
                {summaryHighlights.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">{dict.analyticsOrdersByStatusTitle}</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {data.breakdowns.ordersByStatus.map((item) => (
                  <span key={item.status} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusBadgeClass(item.status)}`}>
                    {statusText(item.status, dict)}: {item.count.toLocaleString(locale)}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <article className="rounded-2xl bg-white/[0.03] p-4">
              <h2 className="text-xs uppercase tracking-[0.14em] text-slate-500">{dict.analyticsTotalIncome}</h2>
              <p className="mt-2 text-lg font-semibold text-slate-100 sm:text-xl">{formatMoney(data.kpis.totalIncome, locale)}</p>
            </article>
            <article className="rounded-2xl bg-white/[0.03] p-4">
              <h2 className="text-xs uppercase tracking-[0.14em] text-slate-500">{dict.analyticsTotalExpenses}</h2>
              <p className="mt-2 text-lg font-semibold text-slate-100 sm:text-xl">{formatMoney(data.kpis.totalExpenses, locale)}</p>
            </article>
            <article className="rounded-2xl bg-white/[0.03] p-4">
              <h2 className="text-xs uppercase tracking-[0.14em] text-slate-500">{dict.analyticsTotalProfit}</h2>
              <p className={`mt-2 text-lg font-semibold sm:text-xl ${data.kpis.totalProfit >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {formatMoney(data.kpis.totalProfit, locale)}
              </p>
            </article>
            <article className="rounded-2xl bg-white/[0.03] p-4">
              <h2 className="text-xs uppercase tracking-[0.14em] text-slate-500">{dict.analyticsTotalOrders}</h2>
              <p className="mt-2 text-lg font-semibold text-slate-100 sm:text-xl">{data.kpis.totalOrders.toLocaleString(locale)}</p>
            </article>
            <article className="rounded-2xl bg-white/[0.03] p-4">
              <h2 className="text-xs uppercase tracking-[0.14em] text-slate-500">{dict.analyticsAvgOrderValue}</h2>
              <p className="mt-2 text-lg font-semibold text-slate-100 sm:text-xl">{formatMoney(data.kpis.avgOrderValue, locale)}</p>
            </article>
            <article className="rounded-2xl bg-white/[0.03] p-4">
              <h2 className="text-xs uppercase tracking-[0.14em] text-slate-500">{dict.analyticsActiveMemberships}</h2>
              <p className="mt-2 text-lg font-semibold text-slate-100 sm:text-xl">{data.kpis.activeMemberships.toLocaleString(locale)}</p>
            </article>
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-slate-950 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Revenue vs Expenses</h2>
                  <p className="mt-1 text-sm text-slate-400">Uses the selected date range and toggles daily or weekly buckets.</p>
                </div>
                <div className="inline-flex rounded-xl bg-white/[0.05] p-1">
                  {(["day", "week"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setChartGroupBy(value)}
                      className={`h-9 rounded-lg px-3 text-sm font-medium transition ${chartGroupBy === value ? "bg-white text-slate-950" : "text-slate-300"}`}
                    >
                      {value === "day" ? "Daily" : "Weekly"}
                    </button>
                  ))}
                </div>
              </div>
              <ChartFrame>
                <BarChart data={groupedSeries} barGap={6}>
                  <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="bucketStart" tickFormatter={(value) => toDisplayDate(value, locale)} minTickGap={20} tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} width={84} />
                  <Tooltip
                    contentStyle={{ direction: dir, textAlign: dir === "rtl" ? "right" : "left", backgroundColor: "#020617", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, color: "#e2e8f0" }}
                    labelFormatter={(value) => toDisplayDate(value, locale)}
                    formatter={(value: number | string | undefined, name: string | undefined) => [
                      formatMoney(Number(value ?? 0), locale),
                      name === "income" ? dict.analyticsTotalIncome : dict.analyticsTotalExpenses
                    ]}
                  />
                  <Bar radius={[8, 8, 0, 0]} dataKey="income" fill="#e2e8f0" />
                  <Bar radius={[8, 8, 0, 0]} dataKey="expenses" fill="#64748b" />
                </BarChart>
              </ChartFrame>
              {chartLoading ? <p className="text-xs text-slate-500">Updating chart...</p> : null}
            </article>

            <article className="rounded-2xl border border-white/10 bg-slate-950 p-5">
              <h2 className="text-lg font-semibold text-white">{dict.analyticsOrdersPerPeriodTitle}</h2>
              <ChartFrame>
                <BarChart data={data.timeseries}>
                  <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="bucketStart" tickFormatter={(value) => toDisplayDate(value, locale)} minTickGap={20} tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ direction: dir, textAlign: dir === "rtl" ? "right" : "left", backgroundColor: "#020617", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, color: "#e2e8f0" }}
                    labelFormatter={(value) => toDisplayDate(value, locale)}
                  />
                  <Bar radius={[8, 8, 0, 0]} dataKey="orders" fill="#94a3b8" />
                </BarChart>
              </ChartFrame>
            </article>
          </section>
          <section className="grid gap-3 lg:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-slate-950 p-5">
              <h2 className="text-lg font-semibold text-white">{dict.analyticsExpenseBreakdownTitle}</h2>
              <ChartFrame>
                <PieChart>
                  <Tooltip
                    contentStyle={{ direction: dir, textAlign: dir === "rtl" ? "right" : "left", backgroundColor: "#020617", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, color: "#e2e8f0" }}
                    formatter={(value: number | string | undefined) => [formatMoney(Number(value ?? 0), locale), dict.analyticsAmountLabel]}
                  />
                  <Pie
                    data={pieData}
                    dataKey="amount"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={95}
                  >
                    {pieData.map((item, index) => (
                      <Cell key={`${item.category}-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartFrame>
            </article>

            <article className="rounded-2xl border border-white/10 bg-slate-950 p-5">
              <h2 className="text-lg font-semibold text-white">{dict.analyticsIncomeBySourceTitle}</h2>
              <ChartFrame>
                <BarChart data={incomeSourceData}>
                  <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="label" interval={0} tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ direction: dir, textAlign: dir === "rtl" ? "right" : "left", backgroundColor: "#020617", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, color: "#e2e8f0" }}
                    formatter={(value: number | string | undefined) => [formatMoney(Number(value ?? 0), locale), dict.analyticsAmountLabel]}
                  />
                  <Bar radius={[8, 8, 0, 0]} dataKey="amount" fill="#94a3b8" />
                </BarChart>
              </ChartFrame>
            </article>
          </section>

          <section className="grid gap-3 xl:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-slate-950 p-5">
              <h2 className="text-lg font-semibold text-white">{dict.analyticsTopServicesByRevenueTitle}</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">{dict.analyticsServiceColumn}</th>
                      <th className="px-3 py-2">{dict.analyticsCompletedCountColumn}</th>
                      <th className="px-3 py-2">{dict.analyticsTotalRevenueColumn}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top.services.byRevenue.map((item) => (
                      <tr key={`${item.serviceNameEn}-${item.serviceNameAr}`} className="border-t border-white/5 text-slate-300">
                        <td className="px-3 py-2">
                          {locale === "ar" ? item.serviceNameAr || item.serviceNameEn : item.serviceNameEn || item.serviceNameAr}
                        </td>
                        <td className="px-3 py-2">{item.ordersCount.toLocaleString(locale)}</td>
                        <td className="px-3 py-2 font-medium text-slate-100">{formatMoney(item.revenue, locale)}</td>
                      </tr>
                    ))}
                    {data.top.services.byRevenue.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-3 text-center text-slate-500">
                          {dict.analyticsEmptyTable}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-2xl border border-white/10 bg-slate-950 p-5">
              <h2 className="text-lg font-semibold text-white">{dict.analyticsTopServicesByOrdersTitle}</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">{dict.analyticsServiceColumn}</th>
                      <th className="px-3 py-2">{dict.analyticsCompletedCountColumn}</th>
                      <th className="px-3 py-2">{dict.analyticsTotalRevenueColumn}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top.services.byOrders.map((item) => (
                      <tr key={`${item.serviceNameEn}-${item.serviceNameAr}-count`} className="border-t border-white/5 text-slate-300">
                        <td className="px-3 py-2">
                          {locale === "ar" ? item.serviceNameAr || item.serviceNameEn : item.serviceNameEn || item.serviceNameAr}
                        </td>
                        <td className="px-3 py-2">{item.ordersCount.toLocaleString(locale)}</td>
                        <td className="px-3 py-2 font-medium text-slate-100">{formatMoney(item.revenue, locale)}</td>
                      </tr>
                    ))}
                    {data.top.services.byOrders.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-3 text-center text-slate-500">
                          {dict.analyticsEmptyTable}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-950 p-5">
            <h2 className="text-lg font-semibold text-white">{dict.analyticsTopEmployeesTitle}</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">{dict.analyticsEmployeeColumn}</th>
                    <th className="px-3 py-2">{dict.analyticsHandledOrdersColumn}</th>
                    <th className="px-3 py-2">{dict.analyticsWorkHoursColumn}</th>
                    <th className="px-3 py-2">{dict.analyticsRatingAvgColumn}</th>
                    <th className="px-3 py-2">{dict.analyticsTotalRevenueColumn}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top.employees.map((item) => (
                    <tr key={item.employeeId} className="border-t border-white/5 text-slate-300">
                      <td className="px-3 py-2">{item.name}</td>
                      <td className="px-3 py-2">{item.handledOrders.toLocaleString(locale)}</td>
                      <td className="px-3 py-2">{item.workHours.toLocaleString(locale)}</td>
                      <td className="px-3 py-2">{item.ratingAvg !== null ? item.ratingAvg.toLocaleString(locale) : "-"}</td>
                      <td className="px-3 py-2 font-medium text-slate-100">{formatMoney(item.revenue, locale)}</td>
                    </tr>
                  ))}
                  {data.top.employees.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-center text-slate-500">
                        {dict.analyticsEmptyTable}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-950 p-5">
            <h2 className="text-lg font-semibold text-white">{dict.analyticsMembershipSectionTitle}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <article className="rounded-2xl bg-white/[0.03] p-4">
                <h3 className="text-xs uppercase tracking-[0.14em] text-slate-500">{dict.analyticsMembershipNew}</h3>
                <p className="mt-2 text-lg font-semibold text-slate-100">{data.membership.newCount.toLocaleString(locale)}</p>
              </article>
              <article className="rounded-2xl bg-white/[0.03] p-4">
                <h3 className="text-xs uppercase tracking-[0.14em] text-slate-500">{dict.analyticsMembershipRenewed}</h3>
                <p className="mt-2 text-lg font-semibold text-slate-100">{data.membership.renewedCount.toLocaleString(locale)}</p>
              </article>
              <article className="rounded-2xl bg-white/[0.03] p-4">
                <h3 className="text-xs uppercase tracking-[0.14em] text-slate-500">{dict.analyticsMembershipExpired}</h3>
                <p className="mt-2 text-lg font-semibold text-slate-100">{data.membership.expiredCount.toLocaleString(locale)}</p>
              </article>
              <article className="rounded-2xl bg-white/[0.03] p-4">
                <h3 className="text-xs uppercase tracking-[0.14em] text-slate-500">{dict.analyticsMembershipRevenue}</h3>
                <p className="mt-2 text-lg font-semibold text-slate-100">{formatMoney(data.membership.membershipRevenue, locale)}</p>
              </article>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-950 p-5">
            <h2 className="text-lg font-semibold text-white">{dict.analyticsRecentTransactionsTitle}</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">{dict.analyticsDateColumn}</th>
                    <th className="px-3 py-2">{dict.analyticsTypeColumn}</th>
                    <th className="px-3 py-2">{dict.analyticsSourceCategoryColumn}</th>
                    <th className="px-3 py-2">{dict.analyticsItemColumn}</th>
                    <th className="hidden px-3 py-2 md:table-cell">{dict.analyticsQtyColumn}</th>
                    <th className="hidden px-3 py-2 md:table-cell">{dict.analyticsUnitPriceColumn}</th>
                    <th className="px-3 py-2">{dict.analyticsTotalAmountColumn}</th>
                    <th className="hidden px-3 py-2 lg:table-cell">{dict.analyticsRecordedByColumn}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.transactions.map((item) => (
                    <tr key={item.id} className="border-t border-white/5 text-slate-300">
                      <td className="px-3 py-2">{toDisplayDateTime(item.occurredAt, locale)}</td>
                      <td className="px-3 py-2">{typeLabel(item.type, dict)}</td>
                      <td className="px-3 py-2">{sourceLabel(item.incomeSource ?? item.expenseCategory, dict)}</td>
                      <td className="px-3 py-2">{item.itemName}</td>
                      <td className="hidden px-3 py-2 md:table-cell">{item.quantity.toLocaleString(locale)}</td>
                      <td className="hidden px-3 py-2 md:table-cell">{formatMoney(item.unitPrice, locale)}</td>
                      <td className="px-3 py-2 font-medium text-slate-100">{formatMoney(item.amount, locale)}</td>
                      <td className="hidden px-3 py-2 lg:table-cell">{item.recordedBy}</td>
                    </tr>
                  ))}
                  {data.recent.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-3 text-center text-slate-500">
                        {dict.analyticsEmptyTable}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-950 p-5">
            <h2 className="text-lg font-semibold text-white">{dict.analyticsRecentCompletedBookingsTitle}</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">{dict.analyticsDateColumn}</th>
                    <th className="px-3 py-2">{dict.analyticsBookingIdColumn}</th>
                    <th className="px-3 py-2">{dict.analyticsStatusColumn}</th>
                    <th className="px-3 py-2">{dict.analyticsCustomerColumn}</th>
                    <th className="px-3 py-2">{dict.analyticsServiceColumn}</th>
                    <th className="hidden px-3 py-2 md:table-cell">{dict.analyticsEmployeeColumn}</th>
                    <th className="px-3 py-2">{dict.analyticsTotalAmountColumn}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.completedBookings.map((item) => (
                    <tr key={item.id} className="border-t border-white/5 text-slate-300">
                      <td className="px-3 py-2">{toDisplayDateTime(item.completedAt, locale)}</td>
                      <td className="px-3 py-2 font-mono text-xs">{item.id.slice(0, 8)}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadgeClass(item.status)}`}>
                          {statusText(item.status, dict)}
                        </span>
                      </td>
                      <td className="px-3 py-2">{item.customerName}</td>
                      <td className="px-3 py-2">
                        {locale === "ar" ? item.serviceNameAr || item.serviceNameEn : item.serviceNameEn || item.serviceNameAr}
                      </td>
                      <td className="hidden px-3 py-2 md:table-cell">{item.employeeName}</td>
                      <td className="px-3 py-2 font-medium text-slate-100">{formatMoney(item.finalPrice, locale)}</td>
                    </tr>
                  ))}
                  {data.recent.completedBookings.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-3 text-center text-slate-500">
                        {dict.analyticsEmptyTable}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
