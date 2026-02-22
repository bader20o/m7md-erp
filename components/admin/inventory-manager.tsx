"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PartItem = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  costPrice: number | null;
  sellPrice: number | null;
  stockQty: number;
  lowStockThreshold: number;
  isActive: boolean;
  lowStock: boolean;
};

type MovementItem = {
  id: string;
  partId: string;
  type: "IN" | "OUT" | "ADJUST";
  quantity: number;
  occurredAt: string;
  note: string | null;
  bookingId: string | null;
  supplierId: string | null;
  invoiceId: string | null;
  part: {
    id: string;
    name: string;
    sku: string | null;
    unit: string;
  };
  createdBy: {
    id: string;
    fullName: string | null;
    phone: string;
    role: string;
  };
  supplier: { id: string; name: string } | null;
  invoice: { id: string; number: string } | null;
  booking: { id: string; status: string } | null;
};

type SupplierOption = {
  id: string;
  name: string;
};

type InvoiceOption = {
  id: string;
  number: string;
};

type Props = {
  locale: string;
  parts: PartItem[];
  alerts: PartItem[];
  movements: MovementItem[];
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

function toLocalDateTimeInput(value: Date): string {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function parseAdjustDirection(note: string | null): "IN" | "OUT" | null {
  if (!note) {
    return null;
  }
  if (note.startsWith("[IN]")) {
    return "IN";
  }
  if (note.startsWith("[OUT]")) {
    return "OUT";
  }
  return null;
}

export function InventoryManager({
  locale,
  parts,
  alerts,
  movements,
  suppliers,
  invoices
}: Props): React.ReactElement {
  const router = useRouter();
  const isArabic = locale === "ar";

  const [search, setSearch] = useState("");
  const [partName, setPartName] = useState("");
  const [partSku, setPartSku] = useState("");
  const [partUnit, setPartUnit] = useState("piece");
  const [partCostPrice, setPartCostPrice] = useState("");
  const [partSellPrice, setPartSellPrice] = useState("");
  const [partStockQty, setPartStockQty] = useState("0");
  const [partLowStockThreshold, setPartLowStockThreshold] = useState("0");
  const [partIsActive, setPartIsActive] = useState(true);
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [movementPartId, setMovementPartId] = useState(parts[0]?.id ?? "");
  const [movementType, setMovementType] = useState<"IN" | "OUT" | "ADJUST">("IN");
  const [adjustDirection, setAdjustDirection] = useState<"IN" | "OUT">("IN");
  const [movementQuantity, setMovementQuantity] = useState("1");
  const [movementOccurredAt, setMovementOccurredAt] = useState(toLocalDateTimeInput(new Date()));
  const [movementNote, setMovementNote] = useState("");
  const [movementSupplierId, setMovementSupplierId] = useState("");
  const [movementInvoiceId, setMovementInvoiceId] = useState("");
  const [movementBookingId, setMovementBookingId] = useState("");
  const [movementFilterPartId, setMovementFilterPartId] = useState("");
  const [movementFilterFrom, setMovementFilterFrom] = useState("");
  const [movementFilterTo, setMovementFilterTo] = useState("");
  const [loadingPart, setLoadingPart] = useState(false);
  const [loadingMovement, setLoadingMovement] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filteredParts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return parts;
    }

    return parts.filter((part) => {
      return part.name.toLowerCase().includes(q) || (part.sku || "").toLowerCase().includes(q);
    });
  }, [parts, search]);

  const filteredMovements = useMemo(() => {
    return movements.filter((movement) => {
      if (movementFilterPartId && movement.partId !== movementFilterPartId) {
        return false;
      }

      const timestamp = new Date(movement.occurredAt).getTime();
      if (movementFilterFrom) {
        const fromTime = new Date(movementFilterFrom).getTime();
        if (timestamp < fromTime) {
          return false;
        }
      }
      if (movementFilterTo) {
        const toTime = new Date(movementFilterTo).getTime();
        if (timestamp > toTime) {
          return false;
        }
      }
      return true;
    });
  }, [movementFilterFrom, movementFilterPartId, movementFilterTo, movements]);

  async function submitPart(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoadingPart(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      name: partName.trim(),
      unit: partUnit.trim(),
      stockQty: Number(partStockQty),
      lowStockThreshold: Number(partLowStockThreshold),
      isActive: partIsActive
    };

    if (partSku.trim()) payload.sku = partSku.trim();
    if (partCostPrice.trim()) payload.costPrice = Number(partCostPrice);
    if (partSellPrice.trim()) payload.sellPrice = Number(partSellPrice);

    const endpoint = editingPartId ? `/api/inventory/parts/${editingPartId}` : "/api/inventory/parts";
    const method = editingPartId ? "PATCH" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = (await response.json()) as unknown;
    setLoadingPart(false);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to save part."));
      return;
    }

    setPartName("");
    setPartSku("");
    setPartUnit("piece");
    setPartCostPrice("");
    setPartSellPrice("");
    setPartStockQty("0");
    setPartLowStockThreshold("0");
    setPartIsActive(true);
    setEditingPartId(null);
    setSuccess(editingPartId ? "Part updated." : "Part created.");
    router.refresh();
  }

  async function submitMovement(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoadingMovement(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      partId: movementPartId,
      type: movementType,
      quantity: Number(movementQuantity),
      occurredAt: new Date(movementOccurredAt).toISOString()
    };

    if (movementType === "ADJUST") {
      payload.adjustDirection = adjustDirection;
    }
    if (movementNote.trim()) payload.note = movementNote.trim();
    if (movementSupplierId) payload.supplierId = movementSupplierId;
    if (movementInvoiceId) payload.invoiceId = movementInvoiceId;
    if (movementBookingId.trim()) payload.bookingId = movementBookingId.trim();

    const response = await fetch("/api/inventory/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = (await response.json()) as unknown;
    setLoadingMovement(false);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to create stock movement."));
      return;
    }

    setMovementQuantity("1");
    setMovementOccurredAt(toLocalDateTimeInput(new Date()));
    setMovementNote("");
    setMovementSupplierId("");
    setMovementInvoiceId("");
    setMovementBookingId("");
    setSuccess("Stock movement recorded.");
    router.refresh();
  }

  function startEdit(part: PartItem): void {
    setEditingPartId(part.id);
    setPartName(part.name);
    setPartSku(part.sku || "");
    setPartUnit(part.unit);
    setPartCostPrice(part.costPrice === null ? "" : part.costPrice.toString());
    setPartSellPrice(part.sellPrice === null ? "" : part.sellPrice.toString());
    setPartStockQty(part.stockQty.toString());
    setPartLowStockThreshold(part.lowStockThreshold.toString());
    setPartIsActive(part.isActive);
  }

  function movementQtyLabel(movement: MovementItem): string {
    if (movement.type === "IN") {
      return `+${movement.quantity}`;
    }
    if (movement.type === "OUT") {
      return `-${movement.quantity}`;
    }

    const direction = parseAdjustDirection(movement.note);
    if (direction === "OUT") {
      return `-${movement.quantity}`;
    }
    if (direction === "IN") {
      return `+${movement.quantity}`;
    }
    return `${movement.quantity}`;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{isArabic ? "تنبيهات المخزون المنخفض" : "Low Stock Alerts"}</h2>
        {alerts.length ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {alerts.map((part) => (
              <article key={part.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="font-semibold text-amber-900">{part.name}</p>
                <p className="text-amber-800">
                  {isArabic ? "المخزون الحالي" : "Current"}: {part.stockQty} {part.unit}
                </p>
                <p className="text-xs text-amber-700">
                  {isArabic ? "حد التنبيه" : "Threshold"}: {part.lowStockThreshold}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">{isArabic ? "لا توجد تنبيهات حالياً." : "No low stock alerts."}</p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{editingPartId ? (isArabic ? "تعديل قطعة" : "Edit Part") : isArabic ? "إضافة قطعة" : "Create Part"}</h2>
        <form onSubmit={submitPart} className="mt-3 grid gap-3 md:grid-cols-2">
          <input value={partName} onChange={(event) => setPartName(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2" placeholder={isArabic ? "اسم القطعة" : "Part Name"} required />
          <input value={partSku} onChange={(event) => setPartSku(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2" placeholder="SKU (optional)" />
          <input value={partUnit} onChange={(event) => setPartUnit(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2" placeholder={isArabic ? "الوحدة" : "Unit"} required />
          <input value={partStockQty} onChange={(event) => setPartStockQty(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2" placeholder={isArabic ? "المخزون الابتدائي" : "Stock Qty"} type="number" min="0" required />
          <input value={partLowStockThreshold} onChange={(event) => setPartLowStockThreshold(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2" placeholder={isArabic ? "حد التنبيه" : "Low Stock Threshold"} type="number" min="0" required />
          <input value={partCostPrice} onChange={(event) => setPartCostPrice(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2" placeholder={isArabic ? "سعر التكلفة" : "Cost Price"} type="number" min="0" step="0.01" />
          <input value={partSellPrice} onChange={(event) => setPartSellPrice(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2" placeholder={isArabic ? "سعر البيع المقترح" : "Sell Price"} type="number" min="0" step="0.01" />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={partIsActive} onChange={(event) => setPartIsActive(event.target.checked)} />
            {isArabic ? "نشط" : "Active"}
          </label>
          <div className="md:col-span-2 flex gap-2">
            <button disabled={loadingPart} type="submit" className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-70">
              {loadingPart ? (isArabic ? "جارٍ الحفظ..." : "Saving...") : editingPartId ? (isArabic ? "تحديث" : "Update") : isArabic ? "إضافة" : "Create"}
            </button>
            {editingPartId ? (
              <button
                type="button"
                onClick={() => {
                  setEditingPartId(null);
                  setPartName("");
                  setPartSku("");
                  setPartUnit("piece");
                  setPartCostPrice("");
                  setPartSellPrice("");
                  setPartStockQty("0");
                  setPartLowStockThreshold("0");
                  setPartIsActive(true);
                }}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                {isArabic ? "إلغاء" : "Cancel"}
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{isArabic ? "حركة المخزون" : "Stock Movement"}</h2>
        <form onSubmit={submitMovement} className="mt-3 grid gap-3 md:grid-cols-2">
          <select value={movementPartId} onChange={(event) => setMovementPartId(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2" required>
            <option value="">{isArabic ? "اختر قطعة" : "Select Part"}</option>
            {parts.map((part) => (
              <option key={part.id} value={part.id}>
                {part.name} ({part.stockQty} {part.unit})
              </option>
            ))}
          </select>
          <select value={movementType} onChange={(event) => setMovementType(event.target.value as "IN" | "OUT" | "ADJUST")} className="rounded-md border border-slate-300 px-3 py-2" required>
            <option value="IN">IN</option>
            <option value="OUT">OUT</option>
            <option value="ADJUST">ADJUST</option>
          </select>
          {movementType === "ADJUST" ? (
            <select value={adjustDirection} onChange={(event) => setAdjustDirection(event.target.value as "IN" | "OUT")} className="rounded-md border border-slate-300 px-3 py-2" required>
              <option value="IN">{isArabic ? "زيادة" : "Increase (+)"}</option>
              <option value="OUT">{isArabic ? "نقصان" : "Decrease (-)"}</option>
            </select>
          ) : null}
          <input value={movementQuantity} onChange={(event) => setMovementQuantity(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2" type="number" min="1" required placeholder={isArabic ? "الكمية" : "Quantity"} />
          <input value={movementOccurredAt} onChange={(event) => setMovementOccurredAt(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2" type="datetime-local" required />
          <select value={movementSupplierId} onChange={(event) => setMovementSupplierId(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2">
            <option value="">{isArabic ? "بدون مورد" : "No supplier"}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
          <select value={movementInvoiceId} onChange={(event) => setMovementInvoiceId(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2">
            <option value="">{isArabic ? "بدون فاتورة" : "No invoice"}</option>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.number}
              </option>
            ))}
          </select>
          <input value={movementBookingId} onChange={(event) => setMovementBookingId(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2" placeholder={isArabic ? "Booking ID (اختياري)" : "Booking ID (optional)"} />
          <textarea value={movementNote} onChange={(event) => setMovementNote(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2 md:col-span-2" placeholder={isArabic ? "ملاحظة (اختياري)" : "Note (optional)"} />
          <button disabled={loadingMovement} type="submit" className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-70 md:col-span-2">
            {loadingMovement ? (isArabic ? "جارٍ الحفظ..." : "Saving...") : isArabic ? "تسجيل الحركة" : "Record Movement"}
          </button>
        </form>
      </section>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{isArabic ? "القطع" : "Parts"}</h2>
        <input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2" placeholder={isArabic ? "بحث بالاسم أو SKU" : "Search by name or SKU"} />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">{isArabic ? "الاسم" : "Name"}</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">{isArabic ? "المخزون" : "Stock"}</th>
                <th className="px-3 py-2">{isArabic ? "حد التنبيه" : "Threshold"}</th>
                <th className="px-3 py-2">{isArabic ? "الحالة" : "Status"}</th>
                <th className="px-3 py-2">{isArabic ? "إجراء" : "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {filteredParts.map((part) => (
                <tr key={part.id} className={`border-t border-slate-100 ${part.lowStock ? "bg-amber-50" : ""}`}>
                  <td className="px-3 py-2">{part.name}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{part.sku || "-"}</td>
                  <td className="px-3 py-2">
                    {part.stockQty} {part.unit}
                  </td>
                  <td className="px-3 py-2">{part.lowStockThreshold}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${part.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                      {part.isActive ? (isArabic ? "نشط" : "Active") : isArabic ? "موقوف" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => startEdit(part)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700"
                    >
                      {isArabic ? "تعديل" : "Edit"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{isArabic ? "سجل الحركات" : "Movements History"}</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <select value={movementFilterPartId} onChange={(event) => setMovementFilterPartId(event.target.value)} className="rounded-md border border-slate-300 px-3 py-2">
            <option value="">{isArabic ? "كل القطع" : "All parts"}</option>
            {parts.map((part) => (
              <option key={part.id} value={part.id}>
                {part.name}
              </option>
            ))}
          </select>
          <input value={movementFilterFrom} onChange={(event) => setMovementFilterFrom(event.target.value)} type="datetime-local" className="rounded-md border border-slate-300 px-3 py-2" />
          <input value={movementFilterTo} onChange={(event) => setMovementFilterTo(event.target.value)} type="datetime-local" className="rounded-md border border-slate-300 px-3 py-2" />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">{isArabic ? "القطعة" : "Part"}</th>
                <th className="px-3 py-2">{isArabic ? "النوع" : "Type"}</th>
                <th className="px-3 py-2">{isArabic ? "الكمية" : "Qty"}</th>
                <th className="px-3 py-2">{isArabic ? "التاريخ" : "Date"}</th>
                <th className="px-3 py-2">{isArabic ? "المستخدم" : "By"}</th>
                <th className="px-3 py-2">{isArabic ? "مراجع" : "Refs"}</th>
                <th className="px-3 py-2">{isArabic ? "ملاحظة" : "Note"}</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((movement) => (
                <tr key={movement.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{movement.part.name}</td>
                  <td className="px-3 py-2">{movement.type}</td>
                  <td className="px-3 py-2 font-semibold">{movementQtyLabel(movement)}</td>
                  <td className="px-3 py-2">{new Date(movement.occurredAt).toLocaleString(locale)}</td>
                  <td className="px-3 py-2">{movement.createdBy.fullName || movement.createdBy.phone}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {movement.booking ? `B:${movement.booking.id}` : ""}
                    {movement.supplier ? ` S:${movement.supplier.name}` : ""}
                    {movement.invoice ? ` I:${movement.invoice.number}` : ""}
                    {!movement.booking && !movement.supplier && !movement.invoice ? "-" : ""}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{movement.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
