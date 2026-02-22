"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type BookingStatus =
  | "PENDING"
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
  employeeOptions
}: Props): React.ReactElement {
  const router = useRouter();
  const [rejectReason, setRejectReason] = useState("");
  const [finalPrice, setFinalPrice] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [performedByEmployeeId, setPerformedByEmployeeId] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showPendingActions = status === "PENDING";
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
    setFinalPrice("");
    setInternalNote("");
    setPerformedByEmployeeId("");
    router.refresh();
  }

  if (!hasAnyActions) {
    return <></>;
  }

  return (
    <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {showPendingActions ? (
        <div className="grid gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => callAction(`/api/admin/bookings/${bookingId}/approve`)}
              disabled={Boolean(loadingAction)}
              className="rounded-md bg-blue-700 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-70"
            >
              {loadingAction === `/api/admin/bookings/${bookingId}/approve` ? "..." : "Approve"}
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <input
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              placeholder="Reject reason (required)"
            />
            <button
              type="button"
              onClick={() => callAction(`/api/admin/bookings/${bookingId}/reject`, { rejectReason })}
              disabled={Boolean(loadingAction) || rejectReason.trim().length < 3}
              className="rounded-md bg-red-700 px-3 py-1 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-70"
            >
              {loadingAction === `/api/admin/bookings/${bookingId}/reject` ? "..." : "Reject"}
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
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              placeholder="Final price (required)"
              type="number"
              step="0.01"
              min="0"
            />
            <select
              value={performedByEmployeeId}
              onChange={(event) => setPerformedByEmployeeId(event.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
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
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            placeholder="Admin internal note (optional)"
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
              className="rounded-md bg-green-700 px-3 py-1 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-70"
            >
              {loadingAction === `/api/admin/bookings/${bookingId}/complete` ? "..." : "Complete"}
            </button>
            <button
              type="button"
              onClick={() => callAction(`/api/admin/bookings/${bookingId}/no-show`)}
              disabled={Boolean(loadingAction)}
              className="rounded-md bg-purple-700 px-3 py-1 text-xs font-semibold text-white hover:bg-purple-800 disabled:opacity-70"
            >
              {loadingAction === `/api/admin/bookings/${bookingId}/no-show` ? "..." : "No Show"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

