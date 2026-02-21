"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type InvoiceItem = {
  id: string;
  number: string;
  note: string | null;
  status: string;
  issueDate: string;
  dueDate: string | null;
  expensesCount: number;
};

type Props = {
  invoices: InvoiceItem[];
};

type ApiErrorPayload = {
  error?: { message?: string };
};

function getErrorMessage(payload: unknown, fallback: string): string {
  const typed = payload as ApiErrorPayload;
  return typed?.error?.message ?? fallback;
}

export function InvoiceManager({ invoices }: Props): React.ReactElement {
  const router = useRouter();
  const [number, setNumber] = useState("");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onCreate(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = { number };
    if (note.trim()) payload.note = note.trim();
    if (dueDate) payload.dueDate = new Date(dueDate).toISOString();

    const response = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = (await response.json()) as unknown;
    setLoading(false);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to create invoice."));
      return;
    }

    setNumber("");
    setNote("");
    setDueDate("");
    setSuccess("Invoice created.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Create Invoice</h2>
        <form onSubmit={onCreate} className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Invoice Number"
            required
          />
          <input
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            type="date"
          />
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 md:col-span-2"
            placeholder="Note"
          />
          <button
            disabled={loading}
            type="submit"
            className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-70 md:col-span-2"
          >
            {loading ? "Saving..." : "Create"}
          </button>
        </form>
      </section>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Invoices</h2>
        <div className="mt-3 grid gap-3">
          {invoices.map((invoice) => (
            <article key={invoice.id} className="rounded-lg border border-slate-200 p-3">
              <h3 className="font-semibold">{invoice.number}</h3>
              <p className="text-xs text-slate-500">{invoice.id}</p>
              <p className="mt-1 text-sm text-slate-600">
                Status: {invoice.status} • Expenses: {invoice.expensesCount}
              </p>
              <p className="text-xs text-slate-600">Issue: {new Date(invoice.issueDate).toLocaleDateString()}</p>
              <p className="text-xs text-slate-600">
                Due: {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "-"}
              </p>
              <p className="mt-1 text-xs text-slate-600">{invoice.note || "-"}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

