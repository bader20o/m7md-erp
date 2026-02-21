"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AboutSettingsInput = {
  centerNameEn: string;
  centerNameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  mapEmbedUrl: string;
  phone: string;
  whatsapp: string;
  instagramUrl: string;
  facebookUrl: string;
  xUrl: string;
};

type SystemSettingsInput = {
  cancellationPolicyHours: number;
  lateCancellationHours: number;
  defaultCurrency: string;
  timezone: string;
};

type Props = {
  about: AboutSettingsInput;
  settings: SystemSettingsInput;
};

type ApiErrorPayload = {
  error?: { message?: string };
};

function getErrorMessage(payload: unknown, fallback: string): string {
  const typed = payload as ApiErrorPayload;
  return typed?.error?.message ?? fallback;
}

function optionalText(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function optionalUrl(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

export function AboutSettingsManager({ about, settings }: Props): React.ReactElement {
  const router = useRouter();
  const [aboutState, setAboutState] = useState(about);
  const [settingsState, setSettingsState] = useState(settings);
  const [loadingAbout, setLoadingAbout] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function saveAbout(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoadingAbout(true);
    setError(null);
    setSuccess(null);

    const payload: Record<string, unknown> = {
      centerNameEn: aboutState.centerNameEn.trim(),
      centerNameAr: aboutState.centerNameAr.trim(),
      descriptionEn: optionalText(aboutState.descriptionEn),
      descriptionAr: optionalText(aboutState.descriptionAr),
      mapEmbedUrl: optionalUrl(aboutState.mapEmbedUrl),
      phone: optionalText(aboutState.phone),
      whatsapp: optionalText(aboutState.whatsapp),
      instagramUrl: optionalUrl(aboutState.instagramUrl),
      facebookUrl: optionalUrl(aboutState.facebookUrl),
      xUrl: optionalUrl(aboutState.xUrl)
    };

    const response = await fetch("/api/about", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = (await response.json()) as unknown;
    setLoadingAbout(false);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to update About settings."));
      return;
    }

    setSuccess("About settings updated.");
    router.refresh();
  }

  async function saveSystemSettings(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoadingSettings(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/system/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cancellationPolicyHours: Number(settingsState.cancellationPolicyHours),
        lateCancellationHours: Number(settingsState.lateCancellationHours),
        defaultCurrency: settingsState.defaultCurrency.toUpperCase().trim(),
        timezone: settingsState.timezone.trim()
      })
    });
    const json = (await response.json()) as unknown;
    setLoadingSettings(false);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to update system settings."));
      return;
    }

    setSuccess("System settings updated.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Public About Settings</h2>
        <form onSubmit={saveAbout} className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={aboutState.centerNameEn}
            onChange={(event) => setAboutState((prev) => ({ ...prev, centerNameEn: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Center Name (EN)"
            required
          />
          <input
            value={aboutState.centerNameAr}
            onChange={(event) => setAboutState((prev) => ({ ...prev, centerNameAr: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Center Name (AR)"
            required
          />
          <textarea
            value={aboutState.descriptionEn}
            onChange={(event) => setAboutState((prev) => ({ ...prev, descriptionEn: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Description (EN)"
          />
          <textarea
            value={aboutState.descriptionAr}
            onChange={(event) => setAboutState((prev) => ({ ...prev, descriptionAr: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Description (AR)"
          />
          <input
            value={aboutState.mapEmbedUrl}
            onChange={(event) => setAboutState((prev) => ({ ...prev, mapEmbedUrl: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Map Embed URL"
          />
          <input
            value={aboutState.phone}
            onChange={(event) => setAboutState((prev) => ({ ...prev, phone: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Phone"
          />
          <input
            value={aboutState.whatsapp}
            onChange={(event) => setAboutState((prev) => ({ ...prev, whatsapp: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="WhatsApp"
          />
          <input
            value={aboutState.instagramUrl}
            onChange={(event) => setAboutState((prev) => ({ ...prev, instagramUrl: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Instagram URL"
          />
          <input
            value={aboutState.facebookUrl}
            onChange={(event) => setAboutState((prev) => ({ ...prev, facebookUrl: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Facebook URL"
          />
          <input
            value={aboutState.xUrl}
            onChange={(event) => setAboutState((prev) => ({ ...prev, xUrl: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="X URL"
          />
          <button
            type="submit"
            disabled={loadingAbout}
            className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-70 md:col-span-2"
          >
            {loadingAbout ? "Saving..." : "Save About"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">System Policy Settings</h2>
        <form onSubmit={saveSystemSettings} className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={settingsState.cancellationPolicyHours}
            onChange={(event) =>
              setSettingsState((prev) => ({ ...prev, cancellationPolicyHours: Number(event.target.value) }))
            }
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Cancellation Policy Hours"
            type="number"
            min={1}
            max={168}
            required
          />
          <input
            value={settingsState.lateCancellationHours}
            onChange={(event) =>
              setSettingsState((prev) => ({ ...prev, lateCancellationHours: Number(event.target.value) }))
            }
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Late Cancellation Hours"
            type="number"
            min={0}
            max={48}
            required
          />
          <input
            value={settingsState.defaultCurrency}
            onChange={(event) => setSettingsState((prev) => ({ ...prev, defaultCurrency: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Currency (USD)"
            maxLength={3}
            required
          />
          <input
            value={settingsState.timezone}
            onChange={(event) => setSettingsState((prev) => ({ ...prev, timezone: event.target.value }))}
            className="rounded-md border border-slate-300 px-3 py-2"
            placeholder="Timezone"
            required
          />
          <button
            type="submit"
            disabled={loadingSettings}
            className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-70 md:col-span-2"
          >
            {loadingSettings ? "Saving..." : "Save System Settings"}
          </button>
        </form>
      </section>
    </div>
  );
}

