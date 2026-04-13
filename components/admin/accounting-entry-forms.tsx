"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ResponsiveDataTable } from "@/components/ui/responsive-data-table";

type SupplierOption = {
  id: string;
  name: string;
};

type InvoiceOption = {
  id: string;
  number: string;
};

type CustomerOption = {
  id: string;
  fullName: string | null;
  phone: string;
};

type PartOption = {
  id: string;
  name: string;
  sku: string | null;
  vehicleModel: string | null;
  vehicleType: string | null;
  category: string | null;
  sellPrice: number | null;
  stockQty: number;
};

type SaleCartLine = {
  id: string;
  partId: string;
  partName: string;
  vehicleCategory: string;
  carModel: string;
  quantity: number;
  unitPrice: number;
  note: string;
};

type ApiExpenseCategory = "SUPPLIER" | "GENERAL" | "SALARY";
type ExpenseUiCategory =
  | "Utilities"
  | "Equipment"
  | "Tools"
  | "Maintenance"
  | "Rent"
  | "Salary"
  | "Supplies"
  | "Other";

const EXPENSE_UI_CATEGORIES: ExpenseUiCategory[] = [
  "Utilities",
  "Equipment",
  "Tools",
  "Maintenance",
  "Rent",
  "Salary",
  "Supplies",
  "Other"
];

const EXPENSE_UI_TO_API: Record<ExpenseUiCategory, ApiExpenseCategory> = {
  Utilities: "GENERAL",
  Equipment: "SUPPLIER",
  Tools: "SUPPLIER",
  Maintenance: "GENERAL",
  Rent: "GENERAL",
  Salary: "SALARY",
  Supplies: "SUPPLIER",
  Other: "GENERAL"
};

type Props = {
  suppliers: SupplierOption[];
  invoices: InvoiceOption[];
  customers: CustomerOption[];
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

function toCustomerLabel(customer: CustomerOption): string {
  return customer.fullName ? `${customer.fullName} (${customer.phone})` : customer.phone;
}

function toPartLabel(part: PartOption): string {
  return `${part.name}${part.vehicleModel ? ` - ${part.vehicleModel}` : ""}${part.vehicleType ? ` (${part.vehicleType})` : ""}`;
}

export function AccountingEntryForms({
  suppliers,
  invoices,
  customers,
  parts,
  recordedByName
}: Props): React.ReactElement {
  const router = useRouter();

  const [walkinItemName, setWalkinItemName] = useState("");
  const [walkinUnitPrice, setWalkinUnitPrice] = useState("");
  const [walkinQuantity, setWalkinQuantity] = useState("1");
  const [walkinDate, setWalkinDate] = useState("");
  const [walkinNote, setWalkinNote] = useState("");

  const [expenseItemName, setExpenseItemName] = useState("");
  const [expenseUnitPrice, setExpenseUnitPrice] = useState("");
  const [expenseQuantity, setExpenseQuantity] = useState("1");
  const [expenseUiCategory, setExpenseUiCategory] = useState<ExpenseUiCategory>("Other");
  const [expenseCategorySearch, setExpenseCategorySearch] = useState("");
  const [expensePartId, setExpensePartId] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [expenseSupplierId, setExpenseSupplierId] = useState("");
  const [expenseInvoiceId, setExpenseInvoiceId] = useState("");
  const [expenseDate, setExpenseDate] = useState("");

  const [loadingWalkin, setLoadingWalkin] = useState(false);
  const [loadingExpense, setLoadingExpense] = useState(false);
  const [loadingCartCheckout, setLoadingCartCheckout] = useState(false);

  const [saleSearch, setSaleSearch] = useState("");
  const [salePartId, setSalePartId] = useState("");
  const [saleCustomerSearch, setSaleCustomerSearch] = useState("");
  const [saleCustomerId, setSaleCustomerId] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [saleCart, setSaleCart] = useState<SaleCartLine[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalQuantity, setModalQuantity] = useState("1");
  const [modalUnitPrice, setModalUnitPrice] = useState("");
  const [modalNote, setModalNote] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const expenseCategory = EXPENSE_UI_TO_API[expenseUiCategory];
  const walkinTotal = Number(walkinUnitPrice || 0) * Number(walkinQuantity || 0);
  const expenseTotal = Number(expenseUnitPrice || 0) * Number(expenseQuantity || 0);
  const selectedPart = parts.find((part) => part.id === expensePartId) ?? null;
  const selectedSalePart = parts.find((part) => part.id === salePartId) ?? null;

  const filteredSaleParts = useMemo(() => {
    const q = saleSearch.trim().toLowerCase();
    if (!q) return parts.slice(0, 30);

    return parts
      .filter((part) => {
        return (
          part.name.toLowerCase().includes(q) ||
          (part.sku ?? "").toLowerCase().includes(q) ||
          (part.vehicleModel ?? "").toLowerCase().includes(q) ||
          (part.vehicleType ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [parts, saleSearch]);

  const filteredCustomers = useMemo(() => {
    const q = saleCustomerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 20);

    return customers
      .filter((customer) => {
        return (
          (customer.fullName ?? "").toLowerCase().includes(q) ||
          customer.phone.toLowerCase().includes(q)
        );
      })
      .slice(0, 20);
  }, [customers, saleCustomerSearch]);

  const filteredExpenseCategories = useMemo(() => {
    const q = expenseCategorySearch.trim().toLowerCase();
    if (!q) return EXPENSE_UI_CATEGORIES;
    return EXPENSE_UI_CATEGORIES.filter((item) => item.toLowerCase().includes(q));
  }, [expenseCategorySearch]);

  const modalTotal = Number(modalQuantity || 0) * Number(modalUnitPrice || 0);
  const cartTotal = useMemo(
    () => saleCart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    [saleCart]
  );

  function openAddToCartModal(): void {
    if (!selectedSalePart) {
      setError("Please select an inventory item first.");
      return;
    }
    setError(null);
    setSuccess(null);
    setModalQuantity("1");
    setModalUnitPrice(String(selectedSalePart.sellPrice ?? 0));
    setModalNote("");
    setModalOpen(true);
  }

  function confirmAddToCart(): void {
    if (!selectedSalePart) {
      setError("Selected inventory item not found.");
      return;
    }

    const qty = Number(modalQuantity);
    const unitPrice = Number(modalUnitPrice);
    if (!Number.isFinite(qty) || qty < 1) {
      setError("Quantity must be at least 1.");
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setError("Unit price must be zero or greater.");
      return;
    }

    setSaleCart((prev) => [
      ...prev,
      {
        id: globalThis.crypto.randomUUID(),
        partId: selectedSalePart.id,
        partName: selectedSalePart.name,
        vehicleCategory: selectedSalePart.vehicleType ?? "-",
        carModel: selectedSalePart.vehicleModel ?? "-",
        quantity: qty,
        unitPrice,
        note: modalNote.trim()
      }
    ]);
    setModalOpen(false);
    setSuccess("Item added to cart.");
  }

  function removeCartLine(lineId: string): void {
    setSaleCart((prev) => prev.filter((line) => line.id !== lineId));
  }

  function clearCart(): void {
    setSaleCart([]);
    setSuccess("Cart cleared.");
  }

  async function checkoutCart(): Promise<void> {
    if (!saleCart.length) {
      setError("Cart is empty.");
      return;
    }

    setLoadingCartCheckout(true);
    setError(null);
    setSuccess(null);

    const invoiceNumber = `SALE-${Date.now()}`;
    const payload: Record<string, unknown> = {
      number: invoiceNumber,
      note: "Sale from accounting cart",
      lines: saleCart.map((line) => ({
        partId: line.partId,
        lineType: "INVENTORY",
        description: line.partName,
        quantity: line.quantity,
        unitAmount: line.unitPrice
      }))
    };

    if (saleDate) {
      payload.issueDate = new Date(saleDate).toISOString();
    }
    if (saleCustomerId) {
      payload.customerId = saleCustomerId;
    }

    const response = await fetch("/api/accounting/sale-invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = (await response.json()) as unknown;
    setLoadingCartCheckout(false);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to checkout cart."));
      return;
    }

    setSaleCart([]);
    setSaleDate("");
    setSalePartId("");
    setSaleSearch("");
    setSaleCustomerId("");
    setSaleCustomerSearch("");
    setSuccess("Cart sale confirmed and inventory updated.");
    router.refresh();
  }

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
    setExpenseUiCategory("Other");
    setExpenseCategorySearch("");
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
      <section className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
        <h2 className="text-lg font-semibold">Sale From Inventory</h2>
        <p className="mt-1 text-xs text-slate-500">Recorded by: {recordedByName}</p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <input
              value={saleCustomerSearch}
              onChange={(event) => {
                setSaleCustomerSearch(event.target.value);
                setSaleCustomerId("");
              }}
              className="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-3"
              placeholder="Search customer name or phone..."
            />
            {!!saleCustomerSearch.trim() && (
              <div className="mt-2 max-h-44 overflow-auto rounded-xl border border-slate-200 bg-white p-1">
                {filteredCustomers.length ? (
                  filteredCustomers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => {
                        setSaleCustomerId(customer.id);
                        setSaleCustomerSearch(toCustomerLabel(customer));
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {toCustomerLabel(customer)}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-slate-500">No customer matches your search.</p>
                )}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <input
              value={saleSearch}
              onChange={(event) => {
                setSaleSearch(event.target.value);
                setSalePartId("");
              }}
              className="min-w-0 w-full rounded-xl border border-slate-300 px-3 py-3"
              placeholder="Search inventory item..."
            />
            {!!saleSearch.trim() && (
              <div className="mt-2 max-h-52 overflow-auto rounded-xl border border-slate-200 bg-white p-1">
                {filteredSaleParts.length ? (
                  filteredSaleParts.map((part) => (
                    <button
                      key={part.id}
                      type="button"
                      onClick={() => {
                        setSalePartId(part.id);
                        setSaleSearch(toPartLabel(part));
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      {toPartLabel(part)}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-slate-500">No inventory items match your search.</p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={openAddToCartModal}
            className="rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-800 md:col-span-2"
          >
            Add To Cart
          </button>
          <input
            value={saleDate}
            onChange={(event) => setSaleDate(event.target.value)}
            className="min-w-0 rounded-xl border border-slate-300 px-3 py-3 md:col-span-2"
            type="datetime-local"
            placeholder="Sale date"
          />
        </div>

        <div className="mt-4">
          <ResponsiveDataTable
            items={saleCart}
            getKey={(line) => line.id}
            emptyState="Cart is empty."
            tableClassName="border border-slate-200 bg-white"
            columns={[
              { key: "item", header: "Item", cell: (line) => line.partName },
              { key: "category", header: "Category", cell: (line) => line.vehicleCategory },
              { key: "model", header: "Car Model", cell: (line) => line.carModel },
              { key: "qty", header: "Qty", cell: (line) => line.quantity },
              { key: "unit", header: "Unit Price", cell: (line) => line.unitPrice.toFixed(2) },
              {
                key: "total",
                header: "Line Total",
                cell: (line) => <span className="font-medium">{(line.quantity * line.unitPrice).toFixed(2)}</span>
              },
              {
                key: "action",
                header: "Action",
                cell: (line) => (
                  <button
                    type="button"
                    onClick={() => removeCartLine(line.id)}
                    className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700"
                  >
                    Remove
                  </button>
                )
              }
            ]}
            cardTitle={(line) => line.partName}
            cardBadge={(line) => (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {(line.quantity * line.unitPrice).toFixed(2)}
              </span>
            )}
            cardSubtitle={(line) => `${line.vehicleCategory} - ${line.carModel}`}
            cardFields={[
              { key: "qty", label: "Qty", value: (line) => line.quantity },
              { key: "unit", label: "Unit Price", value: (line) => line.unitPrice.toFixed(2) },
              { key: "note", label: "Note", value: (line) => line.note || "-" }
            ]}
            cardActions={(line) => (
              <button
                type="button"
                onClick={() => removeCartLine(line.id)}
                className="w-full rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700"
              >
                Remove
              </button>
            )}
          />
        </div>

        <div className="sticky bottom-0 mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-800">Cart Total: {cartTotal.toFixed(2)}</p>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              disabled={!saleCart.length}
              onClick={clearCart}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 sm:w-auto"
            >
              Clear Cart
            </button>
            <button
              type="button"
              disabled={loadingCartCheckout || saleCart.length === 0}
              onClick={() => {
                void checkoutCart();
              }}
              className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-70 sm:w-auto"
            >
              {loadingCartCheckout ? "Processing..." : "Confirm Cart Sale"}
            </button>
          </div>
        </div>
      </section>

      {modalOpen && selectedSalePart ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[24px] bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4">
              <div>
                <h3 className="text-lg font-semibold">Item Details</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Review details and edit default price before adding to cart.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-4">
              <div className="grid gap-3 md:grid-cols-2">
                <input value={selectedSalePart.name} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2" readOnly />
                <input value={selectedSalePart.vehicleType ?? ""} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2" readOnly />
                <input value={selectedSalePart.vehicleModel ?? ""} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2" readOnly />
                <input value={String(selectedSalePart.stockQty)} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2" readOnly />
                <input
                  value={modalQuantity}
                  onChange={(event) => setModalQuantity(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Quantity"
                />
                <input
                  value={modalUnitPrice}
                  onChange={(event) => setModalUnitPrice(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Unit Price"
                />
                <input
                  value={modalTotal ? modalTotal.toFixed(2) : "0.00"}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2"
                  readOnly
                />
                <textarea
                  value={modalNote}
                  onChange={(event) => setModalNote(event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 md:col-span-2"
                  placeholder="Note (optional)"
                />
              </div>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-4 py-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAddToCart}
                className="rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-800"
              >
                Confirm Add To Cart
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

          <div>
            <input
              value={expenseCategorySearch}
              onChange={(event) => setExpenseCategorySearch(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
              placeholder="Search expense category..."
            />
            <div className="mt-2 max-h-40 overflow-auto rounded-md border border-slate-200 bg-white p-1">
              {filteredExpenseCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => {
                    setExpenseUiCategory(category);
                    setExpenseCategorySearch(category);
                    if (EXPENSE_UI_TO_API[category] !== "SUPPLIER") {
                      setExpensePartId("");
                    }
                  }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm ${expenseUiCategory === category ? "bg-slate-100 text-slate-900" : "text-slate-700 hover:bg-slate-50"}`}
                >
                  {category}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">Mapped backend category: {expenseCategory}</p>
          </div>

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

