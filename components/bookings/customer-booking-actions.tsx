"use client";

import { useState } from "react";
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

type Props = {
  bookingId: string;
  status: BookingStatus;
  hasReview: boolean;
  finalPrice?: string | number | null;
  adminNote?: string | null;
};

type ApiErrorPayload = {
  error?: { message?: string };
};

function getErrorMessage(payload: unknown, fallback: string): string {
  const typed = payload as ApiErrorPayload;
  return typed?.error?.message ?? fallback;
}

export function CustomerBookingActions({
  bookingId,
  status,
  hasReview,
  finalPrice,
  adminNote
}: Props): React.ReactElement {
  const router = useRouter();
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const showReview = status === "COMPLETED" && !hasReview;
  const showAwaiting = status === "PENDING";
  const showPriceApproval = status === "PRICE_SET";

  async function callAction(
    action: "accept" | "cancel",
    options: { url: string; payload?: Record<string, unknown> }
  ): Promise<void> {
    setLoadingAction(action);
    setError(null);
    setSuccess(null);

    const response = await fetch(options.url, {
      method: "POST",
      headers: options.payload ? { "Content-Type": "application/json" } : undefined,
      body: options.payload ? JSON.stringify(options.payload) : undefined
    });
    const json = (await response.json()) as unknown;
    setLoadingAction(null);

    if (!response.ok) {
      setError(getErrorMessage(json, "Action failed."));
      return;
    }

    if (action === "cancel") {
      setCancelReason("");
      setSuccess("Request cancelled.");
    } else {
      setSuccess("Booking confirmed.");
    }
    router.refresh();
  }

  async function onReview(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoadingAction("review");
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      bookingId,
      rating: Number(rating)
    };
    if (comment.trim()) {
      payload.comment = comment.trim();
    }

    const response = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = (await response.json()) as unknown;
    setLoadingAction(null);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to submit review."));
      return;
    }

    setComment("");
    setSuccess("Review submitted.");
    router.refresh();
  }

  if (!showAwaiting && !showPriceApproval && !showReview) {
    return <></>;
  }

  return (
    <div className="mt-4 grid gap-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
      {showAwaiting ? (
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-slate-900">Awaiting admin review</p>
          <p className="text-sm text-slate-600">Your booking request has been received. Pricing will be shared after inspection review.</p>
        </div>
      ) : null}

      {showPriceApproval ? (
        <div className="grid gap-3">
          <div className="rounded-2xl border border-sky-100 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Final Price: {finalPrice ?? "-"} JOD</p>
            <p className="mt-2 text-sm text-slate-600">
              Admin Notes: {adminNote?.trim() ? adminNote : "No additional notes."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void callAction("accept", { url: `/api/bookings/${bookingId}/accept` });
              }}
              disabled={Boolean(loadingAction)}
              className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-sky-800 disabled:opacity-70"
            >
              {loadingAction === "accept" ? "Confirming..." : "Accept & Confirm"}
            </button>
          </div>

          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
              placeholder="Reason for cancellation"
            />
            <button
              type="button"
              onClick={() => {
                void callAction("cancel", {
                  url: `/api/bookings/${bookingId}/cancel`,
                  payload: { cancelReason }
                });
              }}
              disabled={Boolean(loadingAction) || cancelReason.trim().length < 3}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition duration-200 hover:bg-red-100 disabled:opacity-70"
            >
              {loadingAction === "cancel" ? "Cancelling..." : "Cancel Request"}
            </button>
          </div>
        </div>
      ) : null}

      {showReview ? (
        <form onSubmit={onReview} className="grid gap-2">
          <h3 className="text-sm font-semibold">Submit Review</h3>
          <select
            value={rating}
            onChange={(event) => setRating(event.target.value)}
            className="w-24 rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="5">5</option>
            <option value="4">4</option>
            <option value="3">3</option>
            <option value="2">2</option>
            <option value="1">1</option>
          </select>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Comment (optional)"
          />
          <button
            type="submit"
            disabled={loadingAction === "review"}
            className="w-fit rounded-xl bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-70"
          >
            {loadingAction === "review" ? "Submitting..." : "Submit Review"}
          </button>
        </form>
      ) : null}

      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {success ? <p className="text-xs text-green-700">{success}</p> : null}
    </div>
  );
}
