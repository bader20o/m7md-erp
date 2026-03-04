"use client";

import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { AttendanceType } from "@prisma/client";
import { useEffect, useRef, useState } from "react";

type ToastState =
  | {
      tone: "success" | "error";
      message: string;
    }
  | null;

type AttendanceEventItem = {
  id: string;
  type: AttendanceType;
  occurredAt: string;
  dayKey: string;
  status: "ACCEPTED" | "REJECTED";
  message: string;
  source: string;
};

type AttendancePayload = {
  manualEntryEnabled: boolean;
  security: {
    ipRestricted: boolean;
  };
  todayStatus: {
    dayKey: string;
    checkedInAt: string | null;
    checkedOutAt: string | null;
    canCheckIn: boolean;
    canCheckOut: boolean;
  };
  events: AttendanceEventItem[];
};

type ApiEnvelope<T> = {
  data?: T;
  error?: {
    message?: string;
  };
};

const EVENT_TYPE_LABELS: Record<AttendanceType, string> = {
  CHECK_IN: "IN",
  CHECK_OUT: "OUT"
};

const EVENT_STATUS_STYLES: Record<AttendanceEventItem["status"], string> = {
  ACCEPTED: "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30",
  REJECTED: "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30"
};

function formatDateTime(value: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleString(locale, options);
}

export function EmployeeQrScanPage({
  locale,
  timezone
}: {
  locale: string;
  timezone: string;
}): React.ReactElement {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const lockRef = useRef(false);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);

  const [data, setData] = useState<AttendancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [cameraState, setCameraState] = useState<"starting" | "ready" | "error">("starting");
  const [cameraMessage, setCameraMessage] = useState("Starting camera scanner...");
  const [manualCode, setManualCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    void loadAttendance();
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    let disposed = false;

    async function startScanner(): Promise<void> {
      if (!videoRef.current) {
        return;
      }

      setCameraState("starting");
      setCameraMessage("Requesting camera access...");

      try {
        const reader = new BrowserQRCodeReader();
        readerRef.current = reader;

        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" }
            }
          },
          videoRef.current,
          (result) => {
            if (!result) {
              return;
            }

            const qrText = result.getText().trim();
            const now = Date.now();
            if (
              lockRef.current ||
              (lastScanRef.current &&
                lastScanRef.current.value === qrText &&
                now - lastScanRef.current.at < 1600)
            ) {
              return;
            }

            lastScanRef.current = { value: qrText, at: now };
            void submitScan(qrText);
          }
        );

        if (disposed) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setCameraState("ready");
        setCameraMessage("Camera ready. Point it at the fixed check-in or check-out QR code.");
      } catch (error) {
        if (disposed) {
          return;
        }

        setCameraState("error");
        setCameraMessage(error instanceof Error ? error.message : "Unable to start camera scanner.");
      }
    }

    void startScanner();

    return () => {
      disposed = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      readerRef.current = null;
    };
  }, []);

  async function loadAttendance(): Promise<void> {
    setLoading(true);
    try {
      const response = await fetch("/api/employee/attendance/me?limit=50", { cache: "no-store" });
      const json = (await response.json()) as ApiEnvelope<AttendancePayload>;

      if (!response.ok || !json.data) {
        throw new Error(json.error?.message ?? "Failed to load attendance history.");
      }

      setData(json.data);
    } catch (error) {
      setToast({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to load attendance history."
      });
    } finally {
      setLoading(false);
    }
  }

  async function submitScan(qrText: string): Promise<void> {
    if (lockRef.current) {
      return;
    }

    lockRef.current = true;
    setSubmitting(true);

    try {
      const response = await fetch("/api/employee/attendance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrText })
      });
      const json = (await response.json()) as
        | ApiEnvelope<{
            ok: boolean;
            status: "ACCEPTED" | "REJECTED";
            message: string;
          }>
        | undefined;

      if (!response.ok || !json?.data) {
        throw new Error(json?.error?.message ?? "Attendance scan failed.");
      }

      setToast({
        tone: json.data.status === "ACCEPTED" ? "success" : "error",
        message: json.data.message
      });
      setManualCode("");
      await loadAttendance();
    } catch (error) {
      setToast({
        tone: "error",
        message: error instanceof Error ? error.message : "Attendance scan failed."
      });
    } finally {
      setSubmitting(false);
      window.setTimeout(() => {
        lockRef.current = false;
      }, 1400);
    }
  }

  function handleManualSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!manualCode.trim()) {
      return;
    }
    void submitScan(manualCode.trim());
  }

  const todayStatus = data?.todayStatus;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-slate-950 px-6 py-6 text-white shadow-[0_30px_80px_-48px_rgba(15,23,42,0.9)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Attendance</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">QR Scan</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Scan the fixed QR code to check in or check out. Only one accepted check-in and one accepted check-out are allowed each day.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Day</p>
              <p className="mt-2 text-lg font-semibold">{todayStatus?.dayKey ?? "--"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Check In</p>
              <p className="mt-2 text-lg font-semibold">
                {todayStatus?.checkedInAt
                  ? formatDateTime(todayStatus.checkedInAt, locale, {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: timezone
                    })
                  : "--"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Check Out</p>
              <p className="mt-2 text-lg font-semibold">
                {todayStatus?.checkedOutAt
                  ? formatDateTime(todayStatus.checkedOutAt, locale, {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: timezone
                    })
                  : "--"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="rounded-[24px] border border-white/10 bg-slate-950/95 p-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Scanner</p>
              <h2 className="mt-2 text-2xl font-semibold">Camera QR Reader</h2>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                cameraState === "ready"
                  ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/30"
                  : cameraState === "error"
                    ? "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30"
                    : "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30"
              }`}
            >
              {cameraState === "ready" ? "Live" : cameraState === "error" ? "Unavailable" : "Starting"}
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-slate-900">
            <video
              ref={videoRef}
              muted
              playsInline
              className="aspect-[4/3] w-full bg-slate-950 object-cover"
            />
          </div>
          <p className="mt-3 text-sm text-slate-400">{cameraMessage}</p>
          {data?.security.ipRestricted ? (
            <p className="mt-2 text-xs text-amber-200">
              Attendance scanning is restricted to the service center network.
            </p>
          ) : null}

          {data?.manualEntryEnabled ? (
            <form onSubmit={handleManualSubmit} className="mt-6 grid gap-3 md:grid-cols-[1fr,140px]">
              <input
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value)}
                placeholder="Enter fixed QR code"
                className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={submitting || !manualCode.trim()}
                className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Enter Code"}
              </button>
            </form>
          ) : null}
        </div>

        <div className="rounded-[24px] border border-white/10 bg-slate-950/95 p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Today</p>
              <h2 className="mt-2 text-2xl font-semibold">Status Rules</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
              <p className="text-sm font-semibold text-white">Check-in</p>
              <p className="mt-2 text-sm text-slate-400">
                {todayStatus?.canCheckIn ? "Available" : "Already completed for today"}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
              <p className="text-sm font-semibold text-white">Check-out</p>
              <p className="mt-2 text-sm text-slate-400">
                {todayStatus?.canCheckOut
                  ? "Available after your accepted check-in"
                  : todayStatus?.checkedOutAt
                    ? "Already completed for today"
                    : "Requires an accepted check-in first"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-white/10 bg-slate-950/95 p-5 text-white">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">History</p>
            <h2 className="mt-2 text-2xl font-semibold">Recent Scans</h2>
          </div>
        </div>

        {loading ? (
          <div className="mt-5 h-48 animate-pulse rounded-[20px] border border-white/10 bg-slate-900/70" />
        ) : !data || data.events.length === 0 ? (
          <div className="mt-5 rounded-[20px] border border-dashed border-slate-700 bg-slate-900/60 px-6 py-12 text-center text-slate-400">
            No scan history yet.
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Time</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((event) => (
                  <tr key={event.id} className="border-t border-white/10">
                    <td className="px-3 py-3 text-slate-300">{event.dayKey}</td>
                    <td className="px-3 py-3 text-slate-300">
                      {formatDateTime(event.occurredAt, locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        timeZone: timezone
                      })}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200">
                        {EVENT_TYPE_LABELS[event.type]}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${EVENT_STATUS_STYLES[event.status]}`}>
                        {event.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-300">{event.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {toast ? (
        <div
          className={`fixed bottom-5 right-5 z-50 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${
            toast.tone === "success" ? "bg-emerald-500 text-slate-950" : "bg-rose-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
