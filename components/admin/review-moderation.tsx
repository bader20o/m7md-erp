"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReviewItem = {
  id: string;
  status: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  bookingId: string;
  serviceName: string;
  customerName: string;
};

type Props = {
  locale: string;
  reviews: ReviewItem[];
};

type ApiErrorPayload = {
  error?: { message?: string };
};

function getErrorMessage(payload: unknown, fallback: string): string {
  const typed = payload as ApiErrorPayload;
  return typed?.error?.message ?? fallback;
}

export function ReviewModeration({ locale, reviews }: Props): React.ReactElement {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function moderate(reviewId: string, status: "APPROVED" | "REJECTED"): Promise<void> {
    const reason = status === "REJECTED" ? window.prompt("Rejection reason (optional):") ?? undefined : undefined;

    setLoadingId(reviewId);
    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/reviews/${reviewId}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reason })
    });
    const json = (await response.json()) as unknown;
    setLoadingId(null);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to moderate review."));
      return;
    }

    setSuccess("Review updated.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h1 className="text-2xl font-semibold">{locale === "ar" ? "مراجعات العملاء" : "Customer Reviews"}</h1>
        <div className="mt-3 grid gap-3">
          {reviews.map((review) => (
            <article key={review.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">
                    {review.customerName} • {review.serviceName}
                  </h2>
                  <p className="text-xs text-slate-500">Booking: {review.bookingId}</p>
                  <p className="mt-1 text-sm text-slate-700">Rating: {review.rating}/5</p>
                  <p className="text-sm text-slate-700">{review.comment || "-"}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                  {review.status}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => moderate(review.id, "APPROVED")}
                  disabled={loadingId === review.id}
                  className="rounded-md bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 disabled:opacity-60"
                >
                  {loadingId === review.id ? "..." : "Approve"}
                </button>
                <button
                  type="button"
                  onClick={() => moderate(review.id, "REJECTED")}
                  disabled={loadingId === review.id}
                  className="rounded-md bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 disabled:opacity-60"
                >
                  {loadingId === review.id ? "..." : "Reject"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

