"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AttendanceDayItem = {
  dayKey: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  workedMinutes: number | null;
  status: string;
  invalidAttempts: number;
  rejectedReasons: string[];
  flags: string[];
};

type AttendanceDetailData = {
  employee: {
    id: string;
    fullName: string;
    phone: string;
  };
  filters: {
    from: string;
    to: string;
  };
  days: AttendanceDayItem[];
};

type ApiEnvelope<T> = {
  data?: T;
  error?: {
    message?: string;
  };
};

function defaultFromDate(): string {
  const value = new Date();
  value.setDate(value.getDate() - 29);
  return value.toISOString().slice(0, 10);
}

function formatWorkedMinutes(value: number | null): string {
  if (value == null) {
    return "--";
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

export function AdminEmployeeAttendanceDetail({
  locale,
  timezone,
  employeeId
}: {
  locale: string;
  timezone: string;
  employeeId: string;
}): React.ReactElement {
  const [from, setFrom] = useState(defaultFromDate());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<AttendanceDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadDetail();
  }, [employeeId, from, to]);

  async function loadDetail(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ from, to });
      const response = await fetch(`/api/admin/attendance/employee/${employeeId}?${params.toString()}`, {
        cache: "no-store"
      });
      const json = (await response.json()) as ApiEnvelope<AttendanceDetailData>;

      if (!response.ok || !json.data) {
        throw new Error(json.error?.message ?? "Failed to load employee attendance.");
      }

      setData(json.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load employee attendance.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-slate-950 px-6 py-6 text-white shadow-[0_30px_80px_-48px_rgba(15,23,42,0.9)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <Link
              href={`/${locale}/admin/attendance`}
              className="text-sm font-medium text-sky-300 transition hover:text-sky-200"
            >
              Back to attendance
            </Link>
            <p className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-400">Employee Detail</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              {data?.employee.fullName ?? "Attendance Detail"}
            </h1>
            <p className="mt-2 text-sm text-slate-400">{data?.employee.phone ?? "Loading employee..."}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
            />
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
            />
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="h-80 animate-pulse rounded-[24px] border border-white/10 bg-slate-950/80" />
      ) : !data || data.days.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-700 bg-slate-950/80 px-6 py-12 text-center text-slate-400">
          No attendance days found in this range.
        </div>
      ) : (
        <div className="grid gap-4">
          {data.days.map((day) => (
            <article
              key={day.dayKey}
              className="rounded-[24px] border border-white/10 bg-slate-950/95 p-5 text-white"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{day.dayKey}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {day.flags.map((flag) => (
                      <span
                        key={flag}
                        className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-200 ring-1 ring-amber-400/30"
                      >
                        {flag}
                      </span>
                    ))}
                    {day.invalidAttempts > 0 ? (
                      <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-200 ring-1 ring-rose-400/30">
                        {day.invalidAttempts} invalid attempt{day.invalidAttempts === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Check In</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {day.checkInAt
                        ? new Date(day.checkInAt).toLocaleString(locale, {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: timezone
                          })
                        : "--"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Check Out</p>
                    <p className="mt-2 text-sm font-semibold text-white">
                      {day.checkOutAt
                        ? new Date(day.checkOutAt).toLocaleString(locale, {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: timezone
                          })
                        : "--"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Worked</p>
                    <p className="mt-2 text-sm font-semibold text-white">{formatWorkedMinutes(day.workedMinutes)}</p>
                  </div>
                </div>
              </div>

              {day.rejectedReasons.length > 0 ? (
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Rejected Reasons</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {day.rejectedReasons.map((reason) => (
                      <span key={reason} className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-200">
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
