"use client";

import { useMemo, useState } from "react";
import { ResponsiveDataTable } from "@/components/ui/responsive-data-table";

type TimeContext = "THIS_MONTH" | "LAST_30_DAYS" | "ALL_TIME";

export type LedgerTransaction = {
  id: string;
  recordedAt: string;
  type: "INCOME" | "EXPENSE";
  incomeSource: string | null;
  expenseCategory: string | null;
  itemName: string;
  note: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  createdBy: string | null;
  customerName: string | null;
};

type Props = {
  transactions: LedgerTransaction[];
};

function formatMoney(value: number): string {
  return `${value.toFixed(2)} JOD`;
}

function formatSource(item: LedgerTransaction): string {
  if (item.type === "EXPENSE") {
    return "Expense";
  }
  if (item.incomeSource === "BOOKING") {
    return "Booking";
  }
  if (item.incomeSource === "WALK_IN") {
    return "Walk-in";
  }
  if (item.incomeSource === "INVOICE" || item.incomeSource === "INVENTORY_SALE") {
    return "Inventory";
  }
  if (item.incomeSource === "MEMBERSHIP") {
    return "General";
  }
  return "General";
}

function sourceBadgeClass(source: string): string {
  if (source === "Walk-in") {
    return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  }
  if (source === "Booking") {
    return "bg-sky-50 text-sky-700 border border-sky-200";
  }
  if (source === "Inventory") {
    return "bg-amber-50 text-amber-700 border border-amber-200";
  }
  if (source === "Expense") {
    return "bg-rose-50 text-rose-700 border border-rose-200";
  }
  return "bg-slate-100 text-slate-700 border border-slate-200";
}

function timeContextLabel(context: TimeContext): string {
  if (context === "THIS_MONTH") return "This Month";
  if (context === "LAST_30_DAYS") return "Last 30 Days";
  return "All Time";
}

export function AccountingLedgerView({ transactions }: Props): React.ReactElement {
  const [timeContext, setTimeContext] = useState<TimeContext>("THIS_MONTH");
  const [search, setSearch] = useState("");

  const timeFiltered = useMemo(() => {
    if (timeContext === "ALL_TIME") {
      return transactions;
    }

    const now = new Date();
    const threshold = new Date(now);
    if (timeContext === "THIS_MONTH") {
      threshold.setDate(1);
      threshold.setHours(0, 0, 0, 0);
    } else {
      threshold.setDate(now.getDate() - 30);
    }

    return transactions.filter((item) => new Date(item.recordedAt).getTime() >= threshold.getTime());
  }, [transactions, timeContext]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return timeFiltered;
    }

    return timeFiltered.filter((item) => {
      const source = formatSource(item).toLowerCase();
      return (
        item.itemName.toLowerCase().includes(q) ||
        (item.note ?? "").toLowerCase().includes(q) ||
        source.includes(q) ||
        (item.customerName ?? "").toLowerCase().includes(q)
      );
    });
  }, [search, timeFiltered]);

  const kpis = useMemo(() => {
    let income = 0;
    let expenses = 0;

    for (const item of timeFiltered) {
      if (item.type === "INCOME") {
        income += item.amount;
      } else {
        expenses += item.amount;
      }
    }

    return {
      income,
      expenses,
      net: income - expenses
    };
  }, [timeFiltered]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {timeContextLabel(timeContext)}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">General Ledger</h2>
          </div>
          <select
            value={timeContext}
            onChange={(event) => setTimeContext(event.target.value as TimeContext)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
          >
            <option value="THIS_MONTH">This Month</option>
            <option value="LAST_30_DAYS">Last 30 Days</option>
            <option value="ALL_TIME">All Time</option>
          </select>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total Income</p>
            <p className="mt-2 text-xl font-semibold text-emerald-700">{formatMoney(kpis.income)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total Expenses</p>
            <p className="mt-2 text-xl font-semibold text-rose-700">{formatMoney(kpis.expenses)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Net Profit / Loss</p>
            <p className={`mt-2 text-xl font-semibold ${kpis.net >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {formatMoney(Math.abs(kpis.net))}
            </p>
          </article>
        </div>

        <div className="mt-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-3"
            placeholder="Search item, customer, note, or transaction source..."
          />
        </div>
      </div>

      <ResponsiveDataTable
        items={filtered}
        getKey={(item) => item.id}
        emptyState="No transactions found."
        tableClassName="border border-slate-200 bg-white"
        rowClassName={(item) => (item.type === "INCOME" ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-rose-500")}
        cardItemClassName={(item) => (item.type === "INCOME" ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-rose-500")}
        columns={[
          {
            key: "datetime",
            header: "Date & Time",
            cell: (item) => new Date(item.recordedAt).toLocaleString()
          },
          {
            key: "type",
            header: "Type",
            cell: (item) => (
              <span className={`text-xs font-semibold uppercase ${item.type === "INCOME" ? "text-emerald-700" : "text-rose-700"}`}>
                {item.type}
              </span>
            )
          },
          {
            key: "source",
            header: "Source",
            cell: (item) => {
              const source = formatSource(item);
              return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${sourceBadgeClass(source)}`}>{source}</span>;
            }
          },
          {
            key: "item",
            header: "Item",
            cell: (item) => <span className="font-medium text-slate-900">{item.itemName}</span>
          },
          {
            key: "note",
            header: "Note",
            cell: (item) => <span className="text-xs text-slate-600">{item.note || "-"}</span>
          },
          {
            key: "qty",
            header: "Qty",
            cell: (item) => item.quantity
          },
          {
            key: "unit",
            header: "Unit Price",
            cell: (item) => formatMoney(item.unitPrice)
          },
          {
            key: "total",
            header: "Total",
            cell: (item) => (
              <span className={`font-semibold ${item.type === "INCOME" ? "text-emerald-700" : "text-rose-700"}`}>
                {formatMoney(item.amount)}
              </span>
            )
          },
          {
            key: "created-by",
            header: "Created By",
            cell: (item) => item.createdBy || "-"
          },
          {
            key: "action",
            header: "Action",
            cell: () => <span className="text-slate-400">-</span>
          }
        ]}
        cardTitle={(item) => item.itemName}
        cardBadge={(item) => (
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.type === "INCOME" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {formatMoney(item.amount)}
          </span>
        )}
        cardSubtitle={(item) => `${new Date(item.recordedAt).toLocaleString()} - ${formatSource(item)}`}
        cardFields={[
          { key: "type", label: "Type", value: (item) => item.type },
          { key: "note", label: "Note", value: (item) => item.note || "-" },
          { key: "qty", label: "Qty", value: (item) => item.quantity },
          { key: "unit", label: "Unit Price", value: (item) => formatMoney(item.unitPrice) },
          { key: "createdBy", label: "Created By", value: (item) => item.createdBy || "-" }
        ]}
      />
    </div>
  );
}

