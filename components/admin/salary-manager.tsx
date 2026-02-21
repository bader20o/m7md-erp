"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type EmployeeOption = {
  id: string;
  label: string;
};

type Props = {
  employees: EmployeeOption[];
};

type ApiErrorPayload = {
  error?: { message?: string };
};

function getErrorMessage(payload: unknown, fallback: string): string {
  const typed = payload as ApiErrorPayload;
  return typed?.error?.message ?? fallback;
}

export function SalaryManager({ employees }: Props): React.ReactElement {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [periodMonth, setPeriodMonth] = useState(String(now.getMonth() + 1));
  const [periodYear, setPeriodYear] = useState(String(now.getFullYear()));
  const [markPaid, setMarkPaid] = useState(true);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onCreate(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      employeeId,
      amount: Number(amount),
      periodMonth: Number(periodMonth),
      periodYear: Number(periodYear),
      markPaid
    };
    if (note.trim()) payload.note = note.trim();

    const response = await fetch("/api/employees/salaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = (await response.json()) as unknown;
    setLoading(false);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to create salary payment."));
      return;
    }

    setAmount("");
    setNote("");
    setSuccess("Salary payment recorded.");
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-lg font-semibold">Record Salary Payment</h2>
      <form onSubmit={onCreate} className="mt-3 grid gap-3 md:grid-cols-2">
        <select
          value={employeeId}
          onChange={(event) => setEmployeeId(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
          required
        >
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.label}
            </option>
          ))}
        </select>
        <input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
          placeholder="Amount"
          type="number"
          step="0.01"
          min="0"
          required
        />
        <input
          value={periodMonth}
          onChange={(event) => setPeriodMonth(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
          placeholder="Month"
          type="number"
          min="1"
          max="12"
          required
        />
        <input
          value={periodYear}
          onChange={(event) => setPeriodYear(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
          placeholder="Year"
          type="number"
          min="2024"
          required
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            checked={markPaid}
            onChange={(event) => setMarkPaid(event.target.checked)}
            type="checkbox"
          />
          Mark as paid immediately
        </label>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
          placeholder="Note"
        />
        <button
          disabled={loading}
          type="submit"
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-70 md:col-span-2"
        >
          {loading ? "Saving..." : "Record"}
        </button>
      </form>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="mt-2 text-sm text-green-700">{success}</p> : null}
    </section>
  );
}

