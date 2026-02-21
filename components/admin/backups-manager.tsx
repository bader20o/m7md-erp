"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BackupItem = {
  id: string;
  status: string;
  storageKey: string | null;
  fileSizeBytes: string | null;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  initiatedByName: string | null;
};

type Props = {
  backups: BackupItem[];
};

type ApiErrorPayload = {
  error?: { message?: string };
};

function getErrorMessage(payload: unknown, fallback: string): string {
  const typed = payload as ApiErrorPayload;
  return typed?.error?.message ?? fallback;
}

export function BackupsManager({ backups }: Props): React.ReactElement {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function runManualBackup(): Promise<void> {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/backups/manual", { method: "POST" });
    const json = (await response.json()) as unknown;
    setLoading(false);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to trigger backup."));
      return;
    }

    setSuccess("Manual backup completed.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Backups</h1>
          <button
            type="button"
            disabled={loading}
            onClick={runManualBackup}
            className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-70"
          >
            {loading ? "Running..." : "Run Manual Backup"}
          </button>
        </div>
      </section>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3">
          {backups.map((backup) => (
            <article key={backup.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">{backup.id}</h2>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium">{backup.status}</span>
              </div>
              <p className="mt-1 text-xs text-slate-600">By: {backup.initiatedByName || "System"}</p>
              <p className="text-xs text-slate-600">Storage: {backup.storageKey || "-"}</p>
              <p className="text-xs text-slate-600">Size: {backup.fileSizeBytes || "-"}</p>
              <p className="text-xs text-slate-600">Started: {new Date(backup.startedAt).toLocaleString()}</p>
              <p className="text-xs text-slate-600">
                Completed: {backup.completedAt ? new Date(backup.completedAt).toLocaleString() : "-"}
              </p>
              {backup.errorMessage ? <p className="text-xs text-red-700">{backup.errorMessage}</p> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

