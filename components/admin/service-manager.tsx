"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ServiceItem = {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  durationMinutes: number;
  isActive: boolean;
};

type Props = {
  locale: string;
  services: ServiceItem[];
};

type ApiErrorPayload = {
  error?: { message?: string };
};

function getErrorMessage(payload: unknown, fallback: string): string {
  const typed = payload as ApiErrorPayload;
  return typed?.error?.message ?? fallback;
}

export function ServiceManager({ locale, services }: Props): React.ReactElement {
  const router = useRouter();
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onCreate(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      nameEn,
      nameAr,
      durationMinutes: Number(durationMinutes)
    };
    if (descriptionEn.trim()) payload.descriptionEn = descriptionEn.trim();
    if (descriptionAr.trim()) payload.descriptionAr = descriptionAr.trim();

    const response = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = (await response.json()) as unknown;
    setLoading(false);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to create service."));
      return;
    }

    setNameEn("");
    setNameAr("");
    setDescriptionEn("");
    setDescriptionAr("");
    setDurationMinutes("60");
    setSuccess("Service created.");
    router.refresh();
  }

  async function onToggle(serviceId: string, nextState: boolean): Promise<void> {
    setLoadingId(serviceId);
    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/services/${serviceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: nextState })
    });
    const json = (await response.json()) as unknown;
    setLoadingId(null);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to update service."));
      return;
    }

    setSuccess("Service updated.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{locale === "ar" ? "إضافة خدمة" : "Create Service"}</h2>
        <form onSubmit={onCreate} className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={nameEn}
            onChange={(event) => setNameEn(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Name (EN)"
            required
          />
          <input
            value={nameAr}
            onChange={(event) => setNameAr(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Name (AR)"
            required
          />
          <input
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Duration Minutes"
            type="number"
            min="15"
            required
          />
          <textarea
            value={descriptionEn}
            onChange={(event) => setDescriptionEn(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Description (EN)"
          />
          <textarea
            value={descriptionAr}
            onChange={(event) => setDescriptionAr(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Description (AR)"
          />
          <button
            disabled={loading}
            type="submit"
            className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-70 md:col-span-2"
          >
            {loading ? "Saving..." : "Create"}
          </button>
        </form>
      </section>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{locale === "ar" ? "الخدمات الحالية" : "Existing Services"}</h2>
        <div className="mt-3 grid gap-3">
          {services.map((service) => (
            <article key={service.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">
                    {locale === "ar" ? service.nameAr : service.nameEn}
                    <span className="ml-2 text-xs text-slate-500">{service.id}</span>
                  </h3>
                  <p className="text-sm text-slate-600">{service.durationMinutes} min</p>
                  <p className="text-xs text-slate-500">
                    {locale === "ar" ? service.descriptionAr : service.descriptionEn}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggle(service.id, !service.isActive)}
                  disabled={loadingId === service.id}
                  className={`rounded-md px-3 py-1 text-xs font-semibold ${
                    service.isActive ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                  }`}
                >
                  {loadingId === service.id
                    ? "Updating..."
                    : service.isActive
                      ? "Deactivate"
                      : "Activate"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
