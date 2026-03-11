"use client";

import React, { useMemo, useState } from "react";
import { sanitizeServiceText } from "@/lib/sanitize-service-text";
import { ServiceCard } from "@/components/services/ServiceCard";

type ServiceItem = {
  id: string;
  nameEn: string;
  nameAr: string;
  imageUrl: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  basePrice?: number | string | null;
  durationMinutes: number;
  priceType?: "FIXED" | "AFTER_INSPECTION";
  supportedCarTypes?: string | null;
  category?: string | null;
};

type CarTypeFilter = "ALL" | "EV" | "HYBRID" | "FUEL";

const CAR_TYPE_TABS: { value: CarTypeFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "EV", label: "EV" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "FUEL", label: "Fuel" }
];

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${hours}h ${rem}m` : `${hours}h`;
}

function normalizeServiceText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function parseCarTypes(raw: string | null | undefined): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((value) => String(value).trim().toUpperCase())
        .filter(Boolean);
    }
  } catch {
    // Ignore malformed JSON and fall back to comma-delimited parsing.
  }

  return raw
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}

function getPrimaryCarType(service: ServiceItem): string {
  const supportedTypes = parseCarTypes(service.supportedCarTypes);
  if (supportedTypes.length > 0) {
    return supportedTypes[0];
  }

  return service.category?.trim() || "GENERAL";
}

export function CreateBookingForm({
  locale,
  services
}: {
  locale: string;
  services: ServiceItem[];
  initialServiceId?: string;
}): React.ReactElement {
  const [serviceId, setServiceId] = useState("");
  const [appointmentAt, setAppointmentAt] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [carTypeFilter, setCarTypeFilter] = useState<CarTypeFilter>("ALL");

  const isRtl = locale === "ar";

  const filteredServices = useMemo(() => {
    if (carTypeFilter === "ALL") return services;

    return services.filter((service) => {
      const types = parseCarTypes(service.supportedCarTypes);
      if (types.length === 0) return true;
      return types.includes(carTypeFilter);
    });
  }, [carTypeFilter, services]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!serviceId) return;

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
      dir={isRtl ? "rtl" : "ltr"}
      className="grid gap-5 rounded-[24px] border border-sky-100 bg-white p-4 shadow-[0_24px_70px_-42px_rgba(17,94,169,0.45)] sm:p-6"
    >
      <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Booking pricing</p>
        <p className="mt-1">Final price confirmed by admin after review. You will see the quote before confirming.</p>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-800">Service</span>

        <div className="grid gap-2 rounded-xl bg-slate-100 p-1 sm:grid-cols-4 sm:gap-1">
          {CAR_TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setCarTypeFilter(tab.value)}
              className={`min-h-11 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                carTypeFilter === tab.value ? "bg-white text-sky-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {filteredServices.length === 0 ? (
            <div className="col-span-full py-8 text-center text-sm text-slate-400">No services available for this car type.</div>
          ) : (
            filteredServices.map((service) => {
              const selected = service.id === serviceId;
              const serviceName = sanitizeServiceText(locale === "ar" ? service.nameAr : service.nameEn);
              const description = sanitizeServiceText(locale === "ar" ? service.descriptionAr : service.descriptionEn);
              const shouldRenderDescription = Boolean(description) && normalizeServiceText(description) !== normalizeServiceText(serviceName);
              const durationLabel = sanitizeServiceText(formatDuration(service.durationMinutes));

              return (
                <ServiceCard
                  key={service.id}
                  onClick={() => setServiceId(service.id)}
                  selected={selected}
                  title={serviceName}
                  description={shouldRenderDescription ? description : null}
                  duration={durationLabel}
                  price={service.basePrice}
                  image={service.imageUrl}
                  carType={getPrimaryCarType(service)}
                  className={isRtl ? "text-right" : ""}
                />
              );
            })
          )}
        </div>
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-800">Appointment</span>
        <input
          type="datetime-local"
          value={appointmentAt}
          onChange={(event) => setAppointmentAt(event.target.value)}
          className="min-w-0 rounded-2xl border border-slate-200 px-4 py-3"
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

      <div className="sticky bottom-0 -mx-4 border-t border-sky-100 bg-white/95 px-4 pb-1 pt-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0">
        <button
          type="submit"
          disabled={loading || !serviceId}
          className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white transition duration-200 ${
            serviceId ? "bg-sky-700 hover:bg-sky-800" : "cursor-not-allowed bg-slate-300"
          } disabled:opacity-70`}
        >
          {loading ? "Booking..." : !serviceId ? "Select a service to continue" : "Book Now"}
        </button>
      </div>
    </form>
  );
}
