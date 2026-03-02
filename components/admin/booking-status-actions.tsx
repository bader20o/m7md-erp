"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type BookingStatus =
  | "PENDING"
  | "PRICE_SET"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "LATE_CANCELLED"
  | "NO_SHOW"
  | "COMPLETED"
  | "NOT_SERVED";

type EmployeeOption = {
  id: string;
  label: string;
};

type Props = {
  bookingId: string;
  status: BookingStatus;
  employeeOptions: EmployeeOption[];
  existingFinalPrice?: string | number | null;
  existingInternalNote?: string | null;
};

type ApiErrorPayload = {
  error?: { message?: string };
};

function getErrorMessage(payload: unknown, fallback: string): string {
  const typed = payload as ApiErrorPayload;
  return typed?.error?.message ?? fallback;
}

export function BookingStatusActions({
  bookingId,
  status,
  employeeOptions,
  existingFinalPrice,
  existingInternalNote
}: Props): React.ReactElement {
  const router = useRouter();
  const [rejectReason, setRejectReason] = useState("");
  const [finalPrice, setFinalPrice] = useState(existingFinalPrice?.toString() ?? "");
  const [internalNote, setInternalNote] = useState(existingInternalNote ?? "");
  const [performedByEmployeeId, setPerformedByEmployeeId] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showPendingActions = status === "PENDING" || status === "PRICE_SET";
  const showApprovedActions = status === "APPROVED";
  const hasAnyActions = showPendingActions || showApprovedActions;

  const sortedEmployees = useMemo(
    () => employeeOptions.slice().sort((a, b) => a.label.localeCompare(b.label)),
    [employeeOptions]
  );

  async function callAction(url: string, payload?: Record<string, unknown>): Promise<void> {
    setLoadingAction(url);
    setError(null);
    const response = await fetch(url, {
      method: "POST",
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined
    });
    const json = (await response.json()) as unknown;
    setLoadingAction(null);
    if (!response.ok) {
      setError(getErrorMessage(json, "Action failed."));
      return;
    }
    setRejectReason("");
    router.refresh();
  }

  if (!hasAnyActions) {
    return <></>;
  }

  return (
    <div className="mt-4 grid gap-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
      {showPendingActions ? (
        <div className="grid gap-3">
          <div className="rounded-2xl border border-sky-100 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Admin pricing review</p>
            <p className="mt-1 text-sm text-slate-600">
              Set the final customer price and add optional notes before the customer confirms.
            </p>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <input
              value={finalPrice}
              onChange={(event) => setFinalPrice(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Final price (JOD)"
              type="number"
              step="0.01"
              min="0"
            />
            <textarea
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-1"
              placeholder="Notes for customer"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                callAction(`/api/admin/bookings/${bookingId}/set-price`, {
                  finalPrice: Number(finalPrice),
                  internalNote: internalNote.trim() || undefined
                })
              }
              disabled={Boolean(loadingAction) || Number(finalPrice) <= 0}
              className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-sky-800 disabled:opacity-70"
            >
              {loadingAction === `/api/admin/bookings/${bookingId}/set-price`
                ? "Saving..."
                : "Set Price & Notify Customer"}
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Reject reason"
            />
            <button
              type="button"
              onClick={() => callAction(`/api/admin/bookings/${bookingId}/reject`, { rejectReason })}
              disabled={Boolean(loadingAction) || rejectReason.trim().length < 3}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition duration-200 hover:bg-red-100 disabled:opacity-70"
            >
              {loadingAction === `/api/admin/bookings/${bookingId}/reject` ? "Rejecting..." : "Reject"}
            </button>
          </div>
        </div>
      ) : null}

      {showApprovedActions ? (
        <div className="grid gap-2">
          <div className="grid gap-2 md:grid-cols-2">
            <input
              value={finalPrice}
              onChange={(event) => setFinalPrice(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Final price"
              type="number"
              step="0.01"
              min="0"
            />
            <select
              value={performedByEmployeeId}
              onChange={(event) => setPerformedByEmployeeId(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">No linked employee</option>
              {sortedEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={internalNote}
            onChange={(event) => setInternalNote(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Admin note"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                callAction(`/api/admin/bookings/${bookingId}/complete`, {
                  finalPrice: Number(finalPrice),
                  internalNote: internalNote.trim() || undefined,
                  performedByEmployeeId: performedByEmployeeId || undefined
                })
              }
              disabled={Boolean(loadingAction) || Number(finalPrice) <= 0}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-emerald-800 disabled:opacity-70"
            >
              {loadingAction === `/api/admin/bookings/${bookingId}/complete` ? "Completing..." : "Complete"}
            </button>
            <button
              type="button"
              onClick={() => callAction(`/api/admin/bookings/${bookingId}/no-show`)}
              disabled={Boolean(loadingAction)}
              className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition duration-200 hover:bg-violet-100 disabled:opacity-70"
            >
              {loadingAction === `/api/admin/bookings/${bookingId}/no-show` ? "Updating..." : "No Show"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
