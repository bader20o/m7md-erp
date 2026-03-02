"use client";

import React, { useState } from "react";

type ServiceItem = {
  id: string;
  nameEn: string;
  nameAr: string;
  imageUrl: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  basePrice?: number | string | null;
  durationMinutes: number;
};

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function formatPrice(price: ServiceItem["basePrice"]): string {
  if (price === null || price === undefined || price === "") {
    return "Price after inspection";
  }

  const numeric = Number(price);
  if (Number.isNaN(numeric)) {
    return "Price after inspection";
  }

  return `${numeric.toFixed(2)} JOD`;
}

function PlaceholderIcon(): React.ReactElement {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      className="h-12 w-12 text-slate-200/70"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M37 13l6 6-8 8 4 4 8-8 6 6v10L41 51H31l-6-6 8-8-4-4-8 8-6-6V25L27 13h10Z" />
      <path d="M17 47l-4 4" />
    </svg>
  );
}

export function CreateBookingForm({
  locale,
  services,
  initialServiceId
}: {
  locale: string;
  services: ServiceItem[];
  initialServiceId?: string;
}): React.ReactElement {
  const [serviceId, setServiceId] = useState(
    services.some((service) => service.id === initialServiceId) ? (initialServiceId ?? "") : (services[0]?.id ?? "")
  );
  const [appointmentAt, setAppointmentAt] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId,
        appointmentAt: new Date(appointmentAt).toISOString(),
        notes
      })
    });
    const json = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(json?.error?.message ?? "Booking failed.");
      return;
    }

    setSuccess("Booking request submitted. Awaiting admin review.");
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-5 rounded-[24px] border border-sky-100 bg-white p-6 shadow-[0_24px_70px_-42px_rgba(17,94,169,0.45)]"
    >
      <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Booking pricing</p>
        <p className="mt-1">Final price confirmed by admin after review. You will see the quote before confirming.</p>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-800">Service</span>
        <div className="grid gap-4 sm:grid-cols-2">
          {services.map((service) => {
            const selected = service.id === serviceId;
            const serviceName = locale === "ar" ? service.nameAr : service.nameEn;
            const description =
              (locale === "ar" ? service.descriptionAr : service.descriptionEn)?.trim() ||
              "Inspection-focused servicing with final pricing reviewed after vehicle assessment.";

            return (
              <button
                key={service.id}
                type="button"
                onClick={() => setServiceId(service.id)}
                className={`group flex h-full min-h-[320px] flex-col overflow-hidden rounded-2xl border text-left transition duration-200 ${
                  selected
                    ? "border-sky-500 bg-sky-50 shadow-[0_18px_40px_-28px_rgba(14,116,144,0.45)]"
                    : "border-slate-200 bg-white hover:-translate-y-1 hover:bg-slate-50"
                }`}
                aria-pressed={selected}
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl">
                  {service.imageUrl ? (
                    <img
                      src={service.imageUrl}
                      alt={serviceName}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-950">
                      <div className="flex flex-col items-center gap-2 opacity-80">
                        <PlaceholderIcon />
                        <span className="text-xs font-medium tracking-[0.18em] text-slate-300 uppercase">
                          Service image
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <h3 className="text-base font-semibold text-slate-900">{serviceName}</h3>
                  <p className="line-clamp-2 text-sm text-slate-600">{description}</p>
                  <p className="text-sm font-semibold text-sky-800">{formatPrice(service.basePrice)}</p>
                  <p className="mt-auto text-sm text-slate-500">{formatDuration(service.durationMinutes)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-800">Appointment</span>
        <input
          type="datetime-local"
          value={appointmentAt}
          onChange={(event) => setAppointmentAt(event.target.value)}
          className="rounded-2xl border border-slate-200 px-4 py-3"
          required
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-800">Notes (optional)</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-28 rounded-2xl border border-slate-200 px-4 py-3"
        />
      </label>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-2xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white transition duration-200 hover:bg-sky-800 disabled:opacity-70"
      >
        {loading ? "Booking..." : "Book Now"}
      </button>
    </form>
  );
}
