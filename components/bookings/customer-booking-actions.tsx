"use client";

import { useState } from "react";
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

type Props = {
  bookingId: string;
  status: BookingStatus;
  hasReview: boolean;
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
  hasReview
}: Props): React.ReactElement {
  const router = useRouter();
  const [rating, setRating] = useState("5");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);

  const showReview = status === "COMPLETED" && !hasReview;

  async function onReview(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoadingReview(true);
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
    setLoadingReview(false);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to submit review."));
      return;
    }

    setComment("");
    setSuccess("Review submitted.");
    router.refresh();
  }

  if (!showReview) {
    return <></>;
  }

  return (
    <div className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {showReview ? (
        <form onSubmit={onReview} className="grid gap-2">
          <h3 className="text-sm font-semibold">Submit Review</h3>
          <select
            value={rating}
            onChange={(event) => setRating(event.target.value)}
            className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm"
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
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Comment (optional)"
          />
          <button
            type="submit"
            disabled={loadingReview}
            className="w-fit rounded-md bg-brand-700 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-70"
          >
            {loadingReview ? "Submitting..." : "Submit Review"}
          </button>
        </form>
      ) : null}

      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {success ? <p className="text-xs text-green-700">{success}</p> : null}
    </div>
  );
}
