"use client";

import { useState } from "react";

type ServiceItem = {
  id: string;
  nameEn: string;
  nameAr: string;
  durationMinutes: number;
};

export function CreateBookingForm({
  locale,
  services
}: {
  locale: string;
  services: ServiceItem[];
}): React.ReactElement {
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
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

    setSuccess(`Booking created: ${json?.data?.item?.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-xl border border-brand-100 bg-white p-6">
      <label className="grid gap-2">
        <span className="text-sm font-medium">Service</span>
        <select
          value={serviceId}
          onChange={(event) => setServiceId(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        >
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {locale === "ar" ? service.nameAr : service.nameEn}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium">Appointment</span>
        <input
          type="datetime-local"
          value={appointmentAt}
          onChange={(event) => setAppointmentAt(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
          required
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium">Notes (optional)</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-70"
      >
        {loading ? "Booking..." : "Book Now"}
      </button>
    </form>
  );
}
