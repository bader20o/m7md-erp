"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SupplierOption = {
  id: string;
  name: string;
};

type InvoiceOption = {
  id: string;
  number: string;
};

type Props = {
  suppliers: SupplierOption[];
  invoices: InvoiceOption[];
};

type ApiErrorPayload = {
  error?: { message?: string };
};

function getErrorMessage(payload: unknown, fallback: string): string {
  const typed = payload as ApiErrorPayload;
  return typed?.error?.message ?? fallback;
}

export function AccountingEntryForms({ suppliers, invoices }: Props): React.ReactElement {
  const router = useRouter();

  const [walkinAmount, setWalkinAmount] = useState("");
  const [walkinDescription, setWalkinDescription] = useState("");
  const [walkinDate, setWalkinDate] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [expenseSupplierId, setExpenseSupplierId] = useState("");
  const [expenseInvoiceId, setExpenseInvoiceId] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [loadingWalkin, setLoadingWalkin] = useState(false);
  const [loadingExpense, setLoadingExpense] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function createWalkinIncome(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoadingWalkin(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      amount: Number(walkinAmount),
      description: walkinDescription
    };
    if (walkinDate) {
      payload.recordedAt = new Date(walkinDate).toISOString();
    }

    const response = await fetch("/api/accounting/walkin-income", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = (await response.json()) as unknown;
    setLoadingWalkin(false);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to create walk-in income."));
      return;
    }

    setWalkinAmount("");
    setWalkinDescription("");
    setWalkinDate("");
    setSuccess("Walk-in income recorded.");
    router.refresh();
  }

  async function createExpense(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoadingExpense(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      amount: Number(expenseAmount)
    };
    if (expenseNote.trim()) payload.note = expenseNote.trim();
    if (expenseSupplierId) payload.supplierId = expenseSupplierId;
    if (expenseInvoiceId) payload.invoiceId = expenseInvoiceId;
    if (expenseDate) payload.expenseDate = new Date(expenseDate).toISOString();

    const response = await fetch("/api/accounting/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = (await response.json()) as unknown;
    setLoadingExpense(false);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to create expense."));
      return;
    }

    setExpenseAmount("");
    setExpenseNote("");
    setExpenseSupplierId("");
    setExpenseInvoiceId("");
    setExpenseDate("");
    setSuccess("Expense recorded.");
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Record Walk-in Income</h2>
        <form onSubmit={createWalkinIncome} className="mt-3 grid gap-3">
          <input
            value={walkinAmount}
            onChange={(event) => setWalkinAmount(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Amount"
            type="number"
            min="0"
            step="0.01"
            required
          />
          <input
            value={walkinDescription}
            onChange={(event) => setWalkinDescription(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Description"
            required
          />
          <input
            value={walkinDate}
            onChange={(event) => setWalkinDate(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            type="datetime-local"
          />
          <button
            disabled={loadingWalkin}
            type="submit"
            className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-70"
          >
            {loadingWalkin ? "Saving..." : "Add Walk-in Income"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Record Expense</h2>
        <form onSubmit={createExpense} className="mt-3 grid gap-3">
          <input
            value={expenseAmount}
            onChange={(event) => setExpenseAmount(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Amount"
            type="number"
            min="0"
            step="0.01"
            required
          />
          <input
            value={expenseNote}
            onChange={(event) => setExpenseNote(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Note"
          />
          <select
            value={expenseSupplierId}
            onChange={(event) => setExpenseSupplierId(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">No supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
          <select
            value={expenseInvoiceId}
            onChange={(event) => setExpenseInvoiceId(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="">No invoice</option>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.number}
              </option>
            ))}
          </select>
          <input
            value={expenseDate}
            onChange={(event) => setExpenseDate(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            type="datetime-local"
          />
          <button
            disabled={loadingExpense}
            type="submit"
            className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-70"
          >
            {loadingExpense ? "Saving..." : "Add Expense"}
          </button>
        </form>
      </section>

      {error ? <p className="text-sm text-red-700 lg:col-span-2">{error}</p> : null}
      {success ? <p className="text-sm text-green-700 lg:col-span-2">{success}</p> : null}
    </div>
  );
}

