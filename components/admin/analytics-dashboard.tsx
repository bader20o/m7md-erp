"use client";

import {
  endOfMonth,
  format,
  startOfMonth,
  subDays,
  subMonths
} from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useEffect, useMemo, useState } from "react";
import type { Dictionary } from "@/lib/i18n";

type AnalyticsPayload = {
  kpis: {
    totalIncome: number;
    bookingIncome: number;
    walkInIncome: number;
    membershipIncome: number;
    totalExpenses: number;
    netProfit: number;
    completedBookingsCount: number;
    pendingBookingsCount: number;
    noShowCount: number;
    cancellationCount: number;
    averageTicket: number;
  };
  timeseries: {
    daily: Array<{
      date: string;
      income: number;
      expense: number;
      bookingIncome: number;
      walkInIncome: number;
      membershipIncome: number;
    }>;
  };
  breakdowns: {
    expenseByCategory: Array<{ category: "SUPPLIER" | "GENERAL" | "SALARY"; amount: number }>;
    incomeBySource: Array<{ source: "BOOKING" | "WALK_IN" | "MEMBERSHIP"; amount: number }>;
  };
  top: {
    services: Array<{
      serviceNameEn: string;
      serviceNameAr: string;
      completedCount: number;
      totalRevenue: number;
    }>;
    customers: Array<{
      customerId: string;
      name: string | null;
      phone: string;
      completedCount: number;
      totalSpend: number;
    }>;
    employees: Array<{
      employeeId: string | null;
      name: string | null;
      phone: string;
      completedJobsCount: number;
      totalRevenue: number;
    }>;
  };
  recentTransactions: Array<{
    id: string;
    date: string;
    type: "INCOME" | "EXPENSE";
    sourceOrCategory: string | null;
    itemName: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    recordedBy: string;
  }>;
};

type ApiPayload =
  | {
      success: true;
      data: AnalyticsPayload;
    }
  | {
      success: false;
      error?: {
        message?: string;
      };
    };

type PresetKey = "today" | "last7" | "thisMonth" | "lastMonth" | "custom";

type Props = {
  locale: string;
  dir: "ltr" | "rtl";
  dict: Dictionary;
};

const PIE_COLORS = ["#0f766e", "#64748b", "#dc2626"];

function toDateInputValue(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

function formatDayTick(value: string, locale: string): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function formatDateTime(value: string, locale: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildPresetRange(preset: Exclude<PresetKey, "custom">, now: Date): { from: string; to: string } {
  if (preset === "today") {
    const value = toDateInputValue(now);
    return { from: value, to: value };
  }

  if (preset === "last7") {
    return {
      from: toDateInputValue(subDays(now, 6)),
      to: toDateInputValue(now)
    };
  }

  if (preset === "thisMonth") {
    return {
      from: toDateInputValue(startOfMonth(now)),
      to: toDateInputValue(now)
    };
  }

  const lastMonth = subMonths(now, 1);
  return {
    from: toDateInputValue(startOfMonth(lastMonth)),
    to: toDateInputValue(endOfMonth(lastMonth))
  };
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

function TableEmptyRow({ colSpan, label }: { colSpan: number; label: string }): React.ReactElement {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-4 text-center text-sm text-slate-500">
        {label}
      </td>
    </tr>
  );
}

export function AnalyticsDashboard({ locale, dir, dict }: Props): React.ReactElement {
  const now = useMemo(() => new Date(), []);
  const [from, setFrom] = useState<string>(() => toDateInputValue(subDays(new Date(), 29)));
  const [to, setTo] = useState<string>(() => toDateInputValue(new Date()));
  const [preset, setPreset] = useState<PresetKey>("custom");
  const [reloadToken, setReloadToken] = useState(0);
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2
      }),
    [locale]
  );

  function formatCurrency(value: number): string {
    return currencyFormatter.format(value);
  }

  function formatTypeLabel(value: "INCOME" | "EXPENSE"): string {
    return value === "INCOME" ? dict.analyticsTypeIncome : dict.analyticsTypeExpense;
  }

  function formatSourceOrCategory(value: string | null): string {
    if (value === "BOOKING") return dict.analyticsSourceBooking;
    if (value === "WALK_IN") return dict.analyticsSourceWalkIn;
    if (value === "MEMBERSHIP") return dict.analyticsSourceMembership;
    if (value === "SUPPLIER") return dict.analyticsCategorySupplier;
    if (value === "GENERAL") return dict.analyticsCategoryGeneral;
    if (value === "SALARY") return dict.analyticsCategorySalary;
    return dict.analyticsUnknown;
  }

  function applyPreset(nextPreset: Exclude<PresetKey, "custom">): void {
    const range = buildPresetRange(nextPreset, now);
    setFrom(range.from);
    setTo(range.to);
    setPreset(nextPreset);
  }

  function onRetry(): void {
    setReloadToken((value) => value + 1);
  }

  useEffect(() => {
    if (!from || !to) {
      return;
    }

    if (from > to) {
      setError(dict.analyticsRangeInvalid);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ from, to });
    void fetch(`/api/reports/analytics?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal
    })
      .then(async (response) => {
        const json = (await response.json()) as ApiPayload;
        if (!response.ok || !json.success) {
          const message =
            !json.success && json.error?.message
              ? json.error.message
              : dict.analyticsUnexpectedError;
          throw new Error(message);
        }
        return json.data;
      })
      .then((data) => {
        setPayload(data);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(
          fetchError instanceof Error ? fetchError.message : dict.analyticsUnexpectedError
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [dict.analyticsRangeInvalid, dict.analyticsUnexpectedError, from, reloadToken, to]);

  const kpiItems = payload
    ? [
        { label: dict.analyticsTotalIncome, value: formatCurrency(payload.kpis.totalIncome), tone: "text-emerald-700" },
        { label: dict.analyticsBookingIncome, value: formatCurrency(payload.kpis.bookingIncome), tone: "text-brand-800" },
        { label: dict.analyticsWalkInIncome, value: formatCurrency(payload.kpis.walkInIncome), tone: "text-brand-800" },
        { label: dict.analyticsMembershipIncome, value: formatCurrency(payload.kpis.membershipIncome), tone: "text-brand-800" },
        { label: dict.analyticsTotalExpenses, value: formatCurrency(payload.kpis.totalExpenses), tone: "text-red-700" },
        { label: dict.analyticsNetProfit, value: formatCurrency(payload.kpis.netProfit), tone: payload.kpis.netProfit >= 0 ? "text-emerald-700" : "text-red-700" },
        { label: dict.analyticsCompletedBookingsCount, value: payload.kpis.completedBookingsCount.toLocaleString(locale), tone: "text-slate-900" },
        { label: dict.analyticsPendingBookingsCount, value: payload.kpis.pendingBookingsCount.toLocaleString(locale), tone: "text-slate-900" },
        { label: dict.analyticsNoShowCount, value: payload.kpis.noShowCount.toLocaleString(locale), tone: "text-slate-900" },
        { label: dict.analyticsCancellationCount, value: payload.kpis.cancellationCount.toLocaleString(locale), tone: "text-slate-900" },
        { label: dict.analyticsAverageTicket, value: formatCurrency(payload.kpis.averageTicket), tone: "text-slate-900" }
      ]
    : [];

  const pieData = payload
    ? payload.breakdowns.expenseByCategory.map((item) => ({
        ...item,
        name: formatSourceOrCategory(item.category)
      }))
    : [];

  const legendLabelByDataKey: Record<string, string> = {
    income: dict.analyticsIncomeLegend,
    expense: dict.analyticsExpenseLegend,
    bookingIncome: dict.analyticsSourceBooking,
    walkInIncome: dict.analyticsSourceWalkIn,
    membershipIncome: dict.analyticsSourceMembership
  };

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">{dict.analyticsTitle}</h1>
            <p className="text-sm text-slate-600">{dict.centerName}</p>
          </div>
          <p className="text-xs text-slate-500">
            {dict.analyticsRangeLabel}: {from} - {to}
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPreset("today")}
              className={`rounded-md border px-3 py-1.5 text-sm ${preset === "today" ? "border-brand-700 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              {dict.analyticsPresetToday}
            </button>
            <button
              type="button"
              onClick={() => applyPreset("last7")}
              className={`rounded-md border px-3 py-1.5 text-sm ${preset === "last7" ? "border-brand-700 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              {dict.analyticsPresetLast7Days}
            </button>
            <button
              type="button"
              onClick={() => applyPreset("thisMonth")}
              className={`rounded-md border px-3 py-1.5 text-sm ${preset === "thisMonth" ? "border-brand-700 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              {dict.analyticsPresetThisMonth}
            </button>
            <button
              type="button"
              onClick={() => applyPreset("lastMonth")}
              className={`rounded-md border px-3 py-1.5 text-sm ${preset === "lastMonth" ? "border-brand-700 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              {dict.analyticsPresetLastMonth}
            </button>
            <button
              type="button"
              onClick={() => setPreset("custom")}
              className={`rounded-md border px-3 py-1.5 text-sm ${preset === "custom" ? "border-brand-700 bg-brand-50 text-brand-800" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
            >
              {dict.analyticsPresetCustom}
            </button>
          </div>

          {preset === "custom" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">{dict.analyticsFromLabel}</span>
                <input
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">{dict.analyticsToLabel}</span>
                <input
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
          ) : null}
        </div>
      </header>

      {error && payload ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      {loading && !payload ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <SkeletonCard key={`kpi-skeleton-${index}`} />
            ))}
          </div>
          <div className="grid gap-3">
            <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
            <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
            <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          </div>
        </>
      ) : null}

      {!loading && error && !payload ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">{dict.analyticsErrorTitle}</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-md bg-red-700 px-3 py-1.5 font-semibold text-white hover:bg-red-800"
          >
            {dict.analyticsRetry}
          </button>
        </div>
      ) : null}

      {payload ? (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpiItems.map((item) => (
              <article key={item.label} className="rounded-xl border border-slate-200 bg-white p-3">
                <h2 className="text-xs uppercase tracking-wide text-slate-500">{item.label}</h2>
                <p className={`mt-2 text-lg font-bold sm:text-xl ${item.tone}`}>{item.value}</p>
              </article>
            ))}
          </section>

          <section className="space-y-3">
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-lg font-semibold">{dict.analyticsIncomeVsExpensesTitle}</h2>
              <ChartFrame>
                <LineChart data={payload.timeseries.daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(value) => formatDayTick(value, locale)} minTickGap={20} />
                  <YAxis />
                  <Tooltip
                    contentStyle={{ direction: dir, textAlign: dir === "rtl" ? "right" : "left" }}
                    formatter={(value: number | string | undefined, name: string | undefined) => [
                      formatCurrency(Number(value ?? 0)),
                      legendLabelByDataKey[name ?? ""] ?? name ?? ""
                    ]}
                    labelFormatter={(value) => formatDayTick(value, locale)}
                  />
                  <Legend formatter={(value) => legendLabelByDataKey[value] ?? value} />
                  <Line type="monotone" dataKey="income" stroke="#0f766e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="expense" stroke="#dc2626" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartFrame>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-lg font-semibold">{dict.analyticsIncomeBreakdownTitle}</h2>
              <ChartFrame>
                <BarChart data={payload.timeseries.daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(value) => formatDayTick(value, locale)} minTickGap={20} />
                  <YAxis />
                  <Tooltip
                    contentStyle={{ direction: dir, textAlign: dir === "rtl" ? "right" : "left" }}
                    formatter={(value: number | string | undefined, name: string | undefined) => [
                      formatCurrency(Number(value ?? 0)),
                      legendLabelByDataKey[name ?? ""] ?? name ?? ""
                    ]}
                    labelFormatter={(value) => formatDayTick(value, locale)}
                  />
                  <Legend formatter={(value) => legendLabelByDataKey[value] ?? value} />
                  <Bar dataKey="bookingIncome" stackId="income" fill="#1d4ed8" />
                  <Bar dataKey="walkInIncome" stackId="income" fill="#0891b2" />
                  <Bar dataKey="membershipIncome" stackId="income" fill="#16a34a" />
                </BarChart>
              </ChartFrame>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-lg font-semibold">{dict.analyticsExpenseBreakdownTitle}</h2>
              <ChartFrame>
                <PieChart>
                  <Tooltip
                    contentStyle={{ direction: dir, textAlign: dir === "rtl" ? "right" : "left" }}
                    formatter={(value: number | string | undefined) => [
                      formatCurrency(Number(value ?? 0)),
                      dict.analyticsAmountLabel
                    ]}
                  />
                  <Legend />
                  <Pie
                    data={pieData}
                    dataKey="amount"
                    nameKey="name"
                    outerRadius={95}
                    innerRadius={45}
                    label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`${entry.category}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartFrame>
            </article>
          </section>

          <section className="space-y-3">
            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{dict.analyticsTopServicesTitle}</h2>
                <p className="text-xs text-slate-500">{dict.analyticsTop10Note}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">{dict.analyticsServiceColumn}</th>
                      <th className="px-3 py-2">{dict.analyticsCompletedCountColumn}</th>
                      <th className="px-3 py-2">{dict.analyticsTotalRevenueColumn}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.top.services.map((item) => (
                      <tr key={`${item.serviceNameEn}-${item.serviceNameAr}`} className="border-t border-slate-100">
                        <td className="px-3 py-2">{locale === "ar" ? item.serviceNameAr || item.serviceNameEn : item.serviceNameEn || item.serviceNameAr}</td>
                        <td className="px-3 py-2">{item.completedCount.toLocaleString(locale)}</td>
                        <td className="px-3 py-2 font-medium">{formatCurrency(item.totalRevenue)}</td>
                      </tr>
                    ))}
                    {payload.top.services.length === 0 ? (
                      <TableEmptyRow colSpan={3} label={dict.analyticsEmptyTable} />
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{dict.analyticsTopCustomersTitle}</h2>
                <p className="text-xs text-slate-500">{dict.analyticsTop10Note}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">{dict.analyticsCustomerColumn}</th>
                      <th className="px-3 py-2">{dict.analyticsCompletedCountColumn}</th>
                      <th className="px-3 py-2">{dict.analyticsTotalSpendColumn}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.top.customers.map((item) => (
                      <tr key={item.customerId} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <p>{item.name || dict.analyticsUnknown}</p>
                          <p className="text-xs text-slate-500">{item.phone}</p>
                        </td>
                        <td className="px-3 py-2">{item.completedCount.toLocaleString(locale)}</td>
                        <td className="px-3 py-2 font-medium">{formatCurrency(item.totalSpend)}</td>
                      </tr>
                    ))}
                    {payload.top.customers.length === 0 ? (
                      <TableEmptyRow colSpan={3} label={dict.analyticsEmptyTable} />
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{dict.analyticsTopEmployeesTitle}</h2>
                <p className="text-xs text-slate-500">{dict.analyticsTop10Note}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2">{dict.analyticsEmployeeColumn}</th>
                      <th className="px-3 py-2">{dict.analyticsCompletedJobsColumn}</th>
                      <th className="px-3 py-2">{dict.analyticsTotalRevenueColumn}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payload.top.employees.map((item) => (
                      <tr key={item.employeeId ?? item.phone} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <p>{item.name || dict.analyticsUnknown}</p>
                          <p className="text-xs text-slate-500">{item.phone}</p>
                        </td>
                        <td className="px-3 py-2">{item.completedJobsCount.toLocaleString(locale)}</td>
                        <td className="px-3 py-2 font-medium">{formatCurrency(item.totalRevenue)}</td>
                      </tr>
                    ))}
                    {payload.top.employees.length === 0 ? (
                      <TableEmptyRow colSpan={3} label={dict.analyticsEmptyTable} />
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{dict.analyticsRecentTransactionsTitle}</h2>
                <p className="text-xs text-slate-500">{dict.analyticsTop10Note}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
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
                    {payload.recentTransactions.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">{formatDateTime(item.date, locale)}</td>
                        <td className="px-3 py-2">{formatTypeLabel(item.type)}</td>
                        <td className="px-3 py-2">{formatSourceOrCategory(item.sourceOrCategory)}</td>
                        <td className="px-3 py-2">{item.itemName}</td>
                        <td className="hidden px-3 py-2 md:table-cell">{item.quantity.toLocaleString(locale)}</td>
                        <td className="hidden px-3 py-2 md:table-cell">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-3 py-2 font-medium">{formatCurrency(item.totalAmount)}</td>
                        <td className="hidden px-3 py-2 lg:table-cell">{item.recordedBy}</td>
                      </tr>
                    ))}
                    {payload.recentTransactions.length === 0 ? (
                      <TableEmptyRow colSpan={8} label={dict.analyticsEmptyTable} />
                    ) : null}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        </>
      ) : null}
    </section>
  );
}
