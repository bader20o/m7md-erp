"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type WorkingHourItem = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
};

type Props = {
  items: WorkingHourItem[];
};

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type ApiErrorPayload = {
  error?: { message?: string };
};

function getErrorMessage(payload: unknown, fallback: string): string {
  const typed = payload as ApiErrorPayload;
  return typed?.error?.message ?? fallback;
}

function normalizeHours(items: WorkingHourItem[]): WorkingHourItem[] {
  const byDay = new Map<number, WorkingHourItem>();
  for (const item of items) {
    byDay.set(item.dayOfWeek, item);
  }

  const normalized: WorkingHourItem[] = [];
  for (let day = 0; day < 7; day += 1) {
    normalized.push(
      byDay.get(day) ?? {
        dayOfWeek: day,
        openTime: "09:00",
        closeTime: "18:00",
        isClosed: false
      }
    );
  }
  return normalized;
}

export function WorkingHoursManager({ items }: Props): React.ReactElement {
  const router = useRouter();
  const initial = useMemo(() => normalizeHours(items), [items]);
  const [hours, setHours] = useState<WorkingHourItem[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function updateHour(dayOfWeek: number, partial: Partial<WorkingHourItem>): void {
    setHours((prev) =>
      prev.map((item) => (item.dayOfWeek === dayOfWeek ? { ...item, ...partial } : item))
    );
  }

  async function saveAll(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/working-hours", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: hours })
    });
    const json = (await response.json()) as unknown;
    setLoading(false);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to save working hours."));
      return;
    }

    setSuccess("Working hours updated.");
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h1 className="text-2xl font-semibold">Working Hours</h1>
      <form onSubmit={saveAll} className="mt-4 grid gap-3">
        {hours.map((item) => (
          <div key={item.dayOfWeek} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-4">
            <div className="text-sm font-medium">{dayNames[item.dayOfWeek]}</div>
            <input
              type="time"
              value={item.openTime}
              onChange={(event) => updateHour(item.dayOfWeek, { openTime: event.target.value })}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              disabled={item.isClosed}
            />
            <input
              type="time"
              value={item.closeTime}
              onChange={(event) => updateHour(item.dayOfWeek, { closeTime: event.target.value })}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              disabled={item.isClosed}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.isClosed}
                onChange={(event) => updateHour(item.dayOfWeek, { isClosed: event.target.checked })}
              />
              Closed
            </label>
          </div>
        ))}
        <button
          disabled={loading}
          type="submit"
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-70"
        >
          {loading ? "Saving..." : "Save Working Hours"}
        </button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="mt-2 text-sm text-green-700">{success}</p> : null}
    </section>
  );
}

