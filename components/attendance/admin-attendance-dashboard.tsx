"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type FixedQrCard = {
  label: string;
  payload: string;
  imageDataUrl: string;
};

type AttendanceEventRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePhone: string;
  type: string;
  timestamp: string;
  dayKey: string;
  result: "ACCEPTED" | "REJECTED";
  message: string;
  source: string;
};

type AttendanceDashboardData = {
  filters: {
    from: string;
    to: string;
    employeeQuery: string;
    status: string;
  };
  summary: {
    todayDayKey: string;
    checkedInCount: number;
    checkedOutCount: number;
    missingCheckOutCount: number;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
  events: AttendanceEventRow[];
};

type ApiEnvelope<T> = {
  data?: T;
  error?: {
    message?: string;
  };
};

const RESULT_STYLES: Record<AttendanceEventRow["result"], string> = {
  ACCEPTED: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30",
  REJECTED: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30"
};

function defaultFromDate(): string {
  const value = new Date();
  value.setDate(value.getDate() - 13);
  return value.toISOString().slice(0, 10);
}

function defaultToDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AdminAttendanceDashboard({
  locale,
  timezone,
  qrCards
}: {
  locale: string;
  timezone: string;
  qrCards: FixedQrCard[];
}): React.ReactElement {
  const [from, setFrom] = useState(defaultFromDate());
  const [to, setTo] = useState(defaultToDate());
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AttendanceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedPayload, setCopiedPayload] = useState<string | null>(null);

  useEffect(() => {
    void loadDashboard();
  }, [from, to, employeeQuery, status, page]);

  useEffect(() => {
    if (!copiedPayload) {
      return;
    }

    const timeout = window.setTimeout(() => setCopiedPayload(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [copiedPayload]);

  async function loadDashboard(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        from,
        to,
        employeeQuery,
        status,
        page: String(page),
        pageSize: "50"
      });
      const response = await fetch(`/api/admin/attendance?${params.toString()}`, { cache: "no-store" });
      const json = (await response.json()) as ApiEnvelope<AttendanceDashboardData>;

      if (!response.ok || !json.data) {
        throw new Error(json.error?.message ?? "Failed to load attendance dashboard.");
      }

      setData(json.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load attendance dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function copyPayload(payload: string): Promise<void> {
    await navigator.clipboard.writeText(payload);
    setCopiedPayload(payload);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-slate-950 px-6 py-6 text-white shadow-[0_30px_80px_-48px_rgba(15,23,42,0.9)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Attendance</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">QR Attendance Dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Monitor global scan logs, review employee attendance by day, and use the fixed QR payloads for the permanent check-in and check-out codes.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Checked In</p>
              <p className="mt-2 text-2xl font-semibold">{data?.summary.checkedInCount ?? "--"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Checked Out</p>
              <p className="mt-2 text-2xl font-semibold">{data?.summary.checkedOutCount ?? "--"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Missing Checkout</p>
              <p className="mt-2 text-2xl font-semibold">{data?.summary.missingCheckOutCount ?? "--"}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="rounded-[24px] border border-white/10 bg-slate-950/95 p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Filters</p>
              <h2 className="mt-2 text-2xl font-semibold">Logs</h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-4">
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setPage(1);
                setFrom(event.target.value);
              }}
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
            />
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setPage(1);
                setTo(event.target.value);
              }}
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
            />
            <input
              value={employeeQuery}
              onChange={(event) => {
                setPage(1);
                setEmployeeQuery(event.target.value);
              }}
              placeholder="Search name or phone"
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500"
            />
            <select
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
            >
              <option value="">All results</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="mt-5 h-72 animate-pulse rounded-[20px] border border-white/10 bg-slate-900/70" />
          ) : !data || data.events.length === 0 ? (
            <div className="mt-5 rounded-[20px] border border-dashed border-slate-700 bg-slate-900/60 px-6 py-12 text-center text-slate-400">
              No attendance events found for this filter set.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Employee</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Timestamp</th>
                    <th className="px-3 py-3">Day</th>
                    <th className="px-3 py-3">Result</th>
                    <th className="px-3 py-3">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((event) => (
                    <tr key={event.id} className="border-t border-white/10">
                      <td className="px-3 py-3">
                        <Link
                          href={`/${locale}/admin/attendance/${event.employeeId}`}
                          className="font-semibold text-sky-300 transition hover:text-sky-200"
                        >
                          {event.employeeName}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">{event.employeePhone}</p>
                        <p className="mt-1 text-xs text-slate-400">{event.message}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200">
                          {event.type === "CHECK_IN" ? "IN" : "OUT"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-300">
                        {new Date(event.timestamp).toLocaleString(locale, {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          timeZone: timezone
                        })}
                      </td>
                      <td className="px-3 py-3 text-slate-300">{event.dayKey}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${RESULT_STYLES[event.result]}`}>
                          {event.result}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-300">{event.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data ? (
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm text-slate-400">
              <p>
                Page {data.pagination.page} of {data.pagination.pageCount} • {data.pagination.total} total logs
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                  className="rounded-xl border border-white/10 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= data.pagination.pageCount}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-xl border border-white/10 px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          {qrCards.map((card) => (
            <article
              key={card.label}
              className="rounded-[24px] border border-white/10 bg-slate-950/95 p-5 text-white"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Fixed QR</p>
                  <h2 className="mt-2 text-2xl font-semibold">{card.label}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => void copyPayload(card.payload)}
                  className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-900"
                >
                  {copiedPayload === card.payload ? "Copied" : "Copy Payload"}
                </button>
              </div>
              <div className="mt-5 rounded-[24px] border border-white/10 bg-slate-900/80 p-4">
                <img src={card.imageDataUrl} alt={card.label} className="mx-auto w-full max-w-[220px] rounded-2xl" />
              </div>
              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Payload</p>
                <p className="mt-2 break-all font-mono text-sm text-slate-200">{card.payload}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
