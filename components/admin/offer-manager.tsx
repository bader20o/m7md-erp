"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type OfferItem = {
  id: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  imageUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  serviceNames: string[];
};

type ServiceOption = {
  id: string;
  nameEn: string;
  nameAr: string;
};

type Props = {
  locale: string;
  offers: OfferItem[];
  serviceOptions: ServiceOption[];
};

type ApiErrorPayload = {
  error?: {
    message?: string;
    details?: Array<{
      message?: string;
      path?: Array<string | number>;
    }>;
  };
};

function getErrorMessage(payload: unknown, fallback: string): string {
  const typed = payload as ApiErrorPayload;
  const details = typed?.error?.details;
  if (Array.isArray(details) && details.length) {
    return details
      .map((item) => {
        const path = item.path?.length ? `${item.path.join(".")}: ` : "";
        return `${path}${item.message ?? "Invalid value"}`;
      })
      .join(" | ");
  }
  return typed?.error?.message ?? fallback;
}

export function OfferManager({ locale, offers, serviceOptions }: Props): React.ReactElement {
  const router = useRouter();
  const [titleEn, setTitleEn] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function toggleService(serviceId: string): void {
    setSelectedServiceIds((prev) => {
      if (prev.includes(serviceId)) {
        return prev.filter((item) => item !== serviceId);
      }
      return [...prev, serviceId];
    });
  }

  async function uploadImageFromDevice(): Promise<string | null> {
    if (!imageFile) {
      return imageUrl.trim() ? imageUrl.trim() : null;
    }

    const formData = new FormData();
    formData.append("file", imageFile);

    const uploadResponse = await fetch("/api/uploads/local", {
      method: "POST",
      body: formData
    });
    const uploadJson = (await uploadResponse.json()) as unknown;

    if (!uploadResponse.ok) {
      throw new Error(getErrorMessage(uploadJson, "Failed to upload image file."));
    }

    const typed = uploadJson as { data?: { fileUrl?: string } };
    const uploadedUrl = typed.data?.fileUrl;
    if (!uploadedUrl) {
      throw new Error("Upload succeeded but file URL was not returned.");
    }

    return uploadedUrl;
  }

  async function onCreate(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      titleEn,
      titleAr,
      isActive: true
    };

    try {
      const uploadedImageUrl = await uploadImageFromDevice();

      if (descriptionEn.trim()) payload.descriptionEn = descriptionEn.trim();
      if (descriptionAr.trim()) payload.descriptionAr = descriptionAr.trim();
      if (uploadedImageUrl) payload.imageUrl = uploadedImageUrl;
      if (startsAt) payload.startsAt = new Date(startsAt).toISOString();
      if (endsAt) payload.endsAt = new Date(endsAt).toISOString();
      if (selectedServiceIds.length) payload.serviceIds = selectedServiceIds;

      const response = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = (await response.json()) as unknown;
      setLoading(false);

      if (!response.ok) {
        setError(getErrorMessage(json, "Failed to create offer."));
        return;
      }

      setTitleEn("");
      setTitleAr("");
      setDescriptionEn("");
      setDescriptionAr("");
      setImageUrl("");
      setImageFile(null);
      setStartsAt("");
      setEndsAt("");
      setSelectedServiceIds([]);
      setSuccess("Offer created.");
      router.refresh();
    } catch (uploadError) {
      setLoading(false);
      const message = uploadError instanceof Error ? uploadError.message : "Failed to create offer.";
      setError(message);
    }
  }

  async function onToggle(offerId: string, nextState: boolean): Promise<void> {
    setLoadingId(offerId);
    setError(null);
    setSuccess(null);

    const response = await fetch(`/api/offers/${offerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: nextState })
    });
    const json = (await response.json()) as unknown;
    setLoadingId(null);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to update offer."));
      return;
    }

    setSuccess("Offer updated.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{locale === "ar" ? "إضافة عرض" : "Create Offer"}</h2>
        <p className="mt-1 text-xs text-slate-500">
          Available service IDs: {serviceOptions.map((service) => service.id).join(", ")}
        </p>
        <form onSubmit={onCreate} className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={titleEn}
            onChange={(event) => setTitleEn(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Title (EN)"
            minLength={2}
            required
          />
          <input
            value={titleAr}
            onChange={(event) => setTitleAr(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Title (AR)"
            minLength={2}
            required
          />
          <input
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Image URL (optional, if no file uploaded)"
            type="url"
          />
          <input
            onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
            className="rounded-md border border-slate-300 px-3 py-2"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
          />
          <div className="rounded-md border border-slate-300 px-3 py-2 md:col-span-2">
            <p className="text-xs font-semibold text-slate-700">Link Services</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {serviceOptions.map((service) => (
                <label key={service.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedServiceIds.includes(service.id)}
                    onChange={() => toggleService(service.id)}
                  />
                  <span>{locale === "ar" ? service.nameAr : service.nameEn}</span>
                </label>
              ))}
            </div>
          </div>
          <input
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            type="datetime-local"
          />
          <input
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
            type="datetime-local"
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
        <h2 className="text-lg font-semibold">{locale === "ar" ? "العروض الحالية" : "Existing Offers"}</h2>
        <div className="mt-3 grid gap-3">
          {offers.map((offer) => (
            <article key={offer.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{locale === "ar" ? offer.titleAr : offer.titleEn}</h3>
                  <p className="text-xs text-slate-500">{offer.id}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {locale === "ar" ? offer.descriptionAr : offer.descriptionEn}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Services: {offer.serviceNames.length ? offer.serviceNames.join(", ") : "None"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggle(offer.id, !offer.isActive)}
                  disabled={loadingId === offer.id}
                  className={`rounded-md px-3 py-1 text-xs font-semibold ${
                    offer.isActive ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
                  }`}
                >
                  {loadingId === offer.id
                    ? "Updating..."
                    : offer.isActive
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
