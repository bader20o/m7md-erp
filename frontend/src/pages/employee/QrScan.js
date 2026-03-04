import { apiFetch } from "../../lib/api.js";

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function formatTime(value) {
  return value
    ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "-";
}

function formatType(value) {
  return value === "CHECK_OUT" ? "OUT" : "IN";
}

function resultBadge(value) {
  const tone =
    value === "ACCEPTED"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      : "border-danger/30 bg-danger/10 text-danger";
  return `<span class="inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${tone}">${esc(value)}</span>`;
}

function typeBadge(value) {
  const tone =
    value === "CHECK_OUT"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
      : "border-sky-500/30 bg-sky-500/10 text-sky-300";
  return `<span class="inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${tone}">${esc(formatType(value))}</span>`;
}

function statusTile(label, value, tone = "text-text") {
  return `
    <div class="rounded-[24px] border border-border bg-surface px-5 py-5">
      <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">${label}</div>
      <div class="mt-3 text-2xl font-bold ${tone}">${esc(value || "-")}</div>
    </div>
  `;
}

export function EmployeeQrScan() {
  window.onMount = async () => {
    const historyBody = document.getElementById("attendance-history-body");
    const statusGrid = document.getElementById("attendance-status-grid");
    const statusLine = document.getElementById("attendance-scan-status");
    const deviceSelect = document.getElementById("attendance-camera-select");
    const manualCard = document.getElementById("attendance-manual-card");
    const manualInput = document.getElementById("attendance-manual-input");
    const scanButton = document.getElementById("attendance-manual-submit");
    const video = document.getElementById("attendance-scanner-video");
    const startButton = document.getElementById("attendance-camera-start");
    const stopButton = document.getElementById("attendance-camera-stop");
    const cameraHint = document.getElementById("attendance-camera-hint");

    const state = {
      controls: null,
      reader: null,
      devices: [],
      submitting: false,
      lastDecodedText: "",
      lastDecodedAt: 0
    };

    function setStatus(message, tone = "text-muted") {
      statusLine.className = `text-sm ${tone}`;
      statusLine.textContent = message;
    }

    function renderTodayStatus(todayStatus) {
      statusGrid.innerHTML = [
        statusTile("Today", todayStatus?.dayKey || "-"),
        statusTile(
          "Check In",
          todayStatus?.checkedInAt ? formatTime(todayStatus.checkedInAt) : "Not yet",
          todayStatus?.checkedInAt ? "text-emerald-400" : "text-muted"
        ),
        statusTile(
          "Check Out",
          todayStatus?.checkedOutAt ? formatTime(todayStatus.checkedOutAt) : "Not yet",
          todayStatus?.checkedOutAt ? "text-amber-400" : "text-muted"
        )
      ].join("");
    }

    function renderHistory(events) {
      historyBody.innerHTML = events.length
        ? events
            .map(
              (event) => `
                <tr class="border-t border-border">
                  <td class="px-4 py-3 text-sm text-text">${esc(formatDate(event.occurredAt))}</td>
                  <td class="px-4 py-3 text-sm text-text">${esc(formatTime(event.occurredAt))}</td>
                  <td class="px-4 py-3 text-sm">${typeBadge(event.type)}</td>
                  <td class="px-4 py-3 text-sm">${resultBadge(event.status)}</td>
                  <td class="px-4 py-3 text-sm text-muted">${esc(event.message || "-")}</td>
                </tr>
              `
            )
            .join("")
        : `<tr><td colspan="5" class="px-4 py-10 text-center text-sm text-muted">No attendance scans yet.</td></tr>`;
    }

    async function loadAttendance() {
      historyBody.innerHTML = `<tr><td colspan="5" class="px-4 py-10 text-center text-sm text-muted">Loading attendance history...</td></tr>`;
      try {
        const response = await apiFetch("/employee/attendance/me?limit=25");
        renderTodayStatus(response.todayStatus);
        renderHistory(response.events || []);
        if (response.manualEntryEnabled) {
          manualCard.classList.remove("hidden");
        } else {
          manualCard.classList.add("hidden");
        }
        if (response.security?.ipRestricted) {
          cameraHint.textContent = "Scans are accepted only from the allowed service center network.";
        }
      } catch (error) {
        historyBody.innerHTML = `<tr><td colspan="5" class="px-4 py-10 text-center text-sm text-danger">${esc(error.message)}</td></tr>`;
      }
    }

    async function stopScanner() {
      try {
        state.controls?.stop?.();
      } catch {
        // Ignore scanner stop failures.
      }
      state.controls = null;
      try {
        state.reader?.reset?.();
      } catch {
        // Ignore scanner reset failures.
      }
      state.reader = null;
      try {
        window.ZXingBrowser?.BrowserCodeReader?.releaseAllStreams?.();
      } catch {
        // Ignore stream cleanup failures.
      }
      if (video) {
        video.srcObject = null;
      }
    }

    async function submitScan(qrText) {
      const now = Date.now();
      if (!qrText || state.submitting) return;
      if (state.lastDecodedText === qrText && now - state.lastDecodedAt < 2500) return;

      state.submitting = true;
      state.lastDecodedText = qrText;
      state.lastDecodedAt = now;
      scanButton.disabled = true;
      setStatus("Submitting attendance scan...", "text-primary");

      try {
        const response = await apiFetch("/employee/attendance/scan", {
          method: "POST",
          body: { qrText }
        });
        window.toast(response.message, response.status === "ACCEPTED" ? "success" : "error");
        manualInput.value = "";
        setStatus(response.message, response.status === "ACCEPTED" ? "text-emerald-400" : "text-danger");
        await loadAttendance();
      } catch (error) {
        window.toast(error.message, "error");
        setStatus(error.message, "text-danger");
      } finally {
        state.submitting = false;
        scanButton.disabled = false;
      }
    }

    async function startScanner(deviceId) {
      if (!window.ZXingBrowser?.BrowserQRCodeReader) {
        setStatus("QR scanner library is not available in this browser.", "text-danger");
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("Camera access is not supported here. Use manual entry.", "text-danger");
        return;
      }

      await stopScanner();
      state.reader = new window.ZXingBrowser.BrowserQRCodeReader();
      setStatus("Starting camera...", "text-primary");

      try {
        state.controls = await state.reader.decodeFromVideoDevice(deviceId || undefined, video, (result) => {
          if (result?.text) {
            void submitScan(result.text);
          } else if (typeof result?.getText === "function") {
            void submitScan(result.getText());
          }
        });
        setStatus("Camera is active. Point it at the fixed attendance QR code.", "text-emerald-400");
      } catch (error) {
        setStatus(error?.message || "Unable to access the camera. Use manual entry instead.", "text-danger");
      }
    }

    async function loadDevicesAndStart() {
      if (!window.ZXingBrowser?.BrowserCodeReader) {
        setStatus("QR scanner library is not available in this browser.", "text-danger");
        return;
      }

      try {
        state.devices = await window.ZXingBrowser.BrowserCodeReader.listVideoInputDevices();
        const options = state.devices
          .map((device) => `<option value="${esc(device.deviceId)}">${esc(device.label || "Camera")}</option>`)
          .join("");
        deviceSelect.innerHTML = options || `<option value="">Default camera</option>`;

        const preferred =
          state.devices.find((device) => /back|rear|environment/i.test(device.label || "")) || state.devices[0];
        if (preferred) {
          deviceSelect.value = preferred.deviceId;
        }

        await startScanner(preferred?.deviceId);
      } catch (error) {
        setStatus(error?.message || "Unable to enumerate camera devices.", "text-danger");
      }
    }

    startButton.addEventListener("click", () => {
      void startScanner(deviceSelect.value || undefined);
    });
    stopButton.addEventListener("click", () => {
      void stopScanner();
      setStatus("Camera stopped.", "text-muted");
    });
    deviceSelect.addEventListener("change", () => {
      void startScanner(deviceSelect.value || undefined);
    });
    document.getElementById("attendance-manual-form").addEventListener("submit", (event) => {
      event.preventDefault();
      void submitScan(manualInput.value.trim());
    });

    window.__pageCleanup = () => {
      void stopScanner();
    };

    await loadAttendance();
    await loadDevicesAndStart();
  };

  return `
    <div class="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div class="rounded-[28px] border border-border bg-surface px-6 py-6">
        <h1 class="text-3xl font-heading font-bold text-text">QR Scan</h1>
        <p class="mt-2 text-sm text-muted">Scan the fixed check-in or check-out QR code while logged in. Only one accepted check-in and one accepted check-out are allowed per day.</p>
      </div>

      <div id="attendance-status-grid" class="grid grid-cols-1 gap-4 md:grid-cols-3"></div>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div class="rounded-[28px] border border-border bg-surface px-6 py-6">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Camera Scanner</div>
              <h2 class="mt-2 text-xl font-bold text-text">Live QR Reader</h2>
              <p id="attendance-camera-hint" class="mt-2 text-sm text-muted">Use the device camera to scan the fixed attendance QR code.</p>
            </div>
            <div class="flex flex-wrap items-center gap-3">
              <select id="attendance-camera-select" class="min-w-[180px] rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text"></select>
              <button id="attendance-camera-start" type="button" class="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">Start</button>
              <button id="attendance-camera-stop" type="button" class="rounded-xl border border-border bg-bg px-4 py-3 text-sm font-semibold text-text">Stop</button>
            </div>
          </div>
          <div class="mt-5 overflow-hidden rounded-[24px] border border-border bg-bg">
            <video id="attendance-scanner-video" class="aspect-[4/3] w-full bg-black object-cover" playsinline muted></video>
          </div>
          <div class="mt-4 rounded-2xl border border-border bg-bg px-4 py-3">
            <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Scanner Status</div>
            <div id="attendance-scan-status" class="mt-2 text-sm text-muted">Preparing scanner...</div>
          </div>
        </div>

        <div class="flex flex-col gap-6">
          <div id="attendance-manual-card" class="hidden rounded-[28px] border border-border bg-surface px-6 py-6">
            <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Manual Fallback</div>
            <h2 class="mt-2 text-xl font-bold text-text">Enter QR Code</h2>
            <p class="mt-2 text-sm text-muted">Use this only when the camera is unavailable on the device.</p>
            <form id="attendance-manual-form" class="mt-5 flex flex-col gap-3">
              <input id="attendance-manual-input" class="rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text" placeholder="EVSC:ATTENDANCE:IN:..." />
              <button id="attendance-manual-submit" class="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white">Submit Code</button>
            </form>
          </div>

          <div class="rounded-[28px] border border-border bg-surface px-6 py-6">
            <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Rules</div>
            <ul class="mt-4 space-y-3 text-sm text-muted">
              <li>One accepted check-in per day.</li>
              <li>One accepted check-out per day.</li>
              <li>Check-out is rejected until a same-day check-in exists.</li>
              <li>All accepted and rejected attempts are logged for audit.</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="overflow-hidden rounded-[28px] border border-border bg-surface">
        <div class="border-b border-border px-6 py-5">
          <h2 class="text-xl font-bold text-text">Recent Scan History</h2>
          <p class="mt-1 text-sm text-muted">Your latest attendance attempts and results.</p>
        </div>
        <div class="overflow-auto">
          <table class="min-w-[760px] w-full text-left">
            <thead class="bg-bg">
              <tr>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted">Date</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted">Time</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted">Type</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted">Status</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted">Message</th>
              </tr>
            </thead>
            <tbody id="attendance-history-body"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
