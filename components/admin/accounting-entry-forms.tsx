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

type PartOption = {
  id: string;
  name: string;
  sku: string | null;
};

type Props = {
  suppliers: SupplierOption[];
  invoices: InvoiceOption[];
  parts: PartOption[];
  recordedByName: string;
};

type ApiErrorPayload = {
  error?: { message?: string };
};

function getErrorMessage(payload: unknown, fallback: string): string {
  const typed = payload as ApiErrorPayload;
  return typed?.error?.message ?? fallback;
}

export function AccountingEntryForms({ suppliers, invoices, parts, recordedByName }: Props): React.ReactElement {
  const router = useRouter();

  const [walkinItemName, setWalkinItemName] = useState("");
  const [walkinUnitPrice, setWalkinUnitPrice] = useState("");
  const [walkinQuantity, setWalkinQuantity] = useState("1");
  const [walkinDate, setWalkinDate] = useState("");
  const [walkinNote, setWalkinNote] = useState("");
  const [expenseItemName, setExpenseItemName] = useState("");
  const [expenseUnitPrice, setExpenseUnitPrice] = useState("");
  const [expenseQuantity, setExpenseQuantity] = useState("1");
  const [expenseCategory, setExpenseCategory] = useState<"SUPPLIER" | "GENERAL" | "SALARY">("GENERAL");
  const [expensePartId, setExpensePartId] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [expenseSupplierId, setExpenseSupplierId] = useState("");
  const [expenseInvoiceId, setExpenseInvoiceId] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [loadingWalkin, setLoadingWalkin] = useState(false);
  const [loadingExpense, setLoadingExpense] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const walkinTotal = Number(walkinUnitPrice || 0) * Number(walkinQuantity || 0);
  const expenseTotal = Number(expenseUnitPrice || 0) * Number(expenseQuantity || 0);
  const selectedPart = parts.find((part) => part.id === expensePartId) ?? null;

  async function createWalkinIncome(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoadingWalkin(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      itemName: walkinItemName.trim(),
      unitPrice: Number(walkinUnitPrice),
      quantity: Number(walkinQuantity),
      occurredAt: new Date(walkinDate).toISOString()
    };
    if (walkinNote.trim()) {
      payload.note = walkinNote.trim();
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

    setWalkinItemName("");
    setWalkinUnitPrice("");
    setWalkinQuantity("1");
    setWalkinDate("");
    setWalkinNote("");
    setSuccess("Walk-in income recorded.");
    router.refresh();
  }

  async function createExpense(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoadingExpense(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      itemName: selectedPart?.name || expenseItemName.trim(),
      unitPrice: Number(expenseUnitPrice),
      quantity: Number(expenseQuantity),
      occurredAt: new Date(expenseDate).toISOString(),
      expenseCategory
    };
    if (expenseNote.trim()) payload.note = expenseNote.trim();
    if (expenseSupplierId) payload.supplierId = expenseSupplierId;
    if (expenseInvoiceId) payload.invoiceId = expenseInvoiceId;
    if (expensePartId) payload.partId = expensePartId;

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

    setExpenseItemName("");
    setExpenseUnitPrice("");
    setExpenseQuantity("1");
    setExpenseCategory("GENERAL");
    setExpensePartId("");
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
        <p className="mt-1 text-xs text-slate-500">Recorded by: {recordedByName}</p>
        <form onSubmit={createWalkinIncome} className="mt-3 grid gap-3">
          <input
            value={walkinItemName}
            onChange={(event) => setWalkinItemName(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Item / Service Name"
            required
          />
          <input
            value={walkinUnitPrice}
            onChange={(event) => setWalkinUnitPrice(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Unit Price"
            type="number"
            min="0"
            step="0.01"
            required
          />
          <input
            value={walkinQuantity}
            onChange={(event) => setWalkinQuantity(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Quantity"
            type="number"
            min="1"
            step="1"
            required
          />
          <input
            value={walkinTotal ? walkinTotal.toFixed(2) : "0.00"}
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700"
            placeholder="Total"
            readOnly
          />
          <input
            value={walkinDate}
            onChange={(event) => setWalkinDate(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            type="datetime-local"
            required
          />
          <textarea
            value={walkinNote}
            onChange={(event) => setWalkinNote(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Note (optional)"
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
        <p className="mt-1 text-xs text-slate-500">Recorded by: {recordedByName}</p>
        <form onSubmit={createExpense} className="mt-3 grid gap-3">
          <input
            value={expenseItemName}
            onChange={(event) => setExpenseItemName(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Item / Service Name"
            disabled={Boolean(selectedPart)}
            required
          />
          <select
            value={expenseCategory}
            onChange={(event) => {
              const next = event.target.value as "SUPPLIER" | "GENERAL" | "SALARY";
              setExpenseCategory(next);
              if (next !== "SUPPLIER") {
                setExpensePartId("");
              }
            }}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            <option value="GENERAL">GENERAL</option>
            <option value="SUPPLIER">SUPPLIER</option>
            <option value="SALARY">SALARY</option>
          </select>
          {expenseCategory === "SUPPLIER" ? (
            <select
              value={expensePartId}
              onChange={(event) => {
                const nextPartId = event.target.value;
                setExpensePartId(nextPartId);
                const part = parts.find((item) => item.id === nextPartId);
                if (part) {
                  setExpenseItemName(part.name);
                }
              }}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="">No part selected</option>
              {parts.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.name}
                  {part.sku ? ` (${part.sku})` : ""}
                </option>
              ))}
            </select>
          ) : null}
          <input
            value={expenseUnitPrice}
            onChange={(event) => setExpenseUnitPrice(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Unit Price"
            type="number"
            min="0"
            step="0.01"
            required
          />
          <input
            value={expenseQuantity}
            onChange={(event) => setExpenseQuantity(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Quantity"
            type="number"
            min="1"
            step="1"
            required
          />
          <input
            value={expenseTotal ? expenseTotal.toFixed(2) : "0.00"}
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700"
            placeholder="Total"
            readOnly
          />
          <input
            value={expenseNote}
            onChange={(event) => setExpenseNote(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Note (optional)"
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
            required
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

