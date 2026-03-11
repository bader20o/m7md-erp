import { apiFetch } from "../../lib/api.js";

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export function CustomerVisitScan() {
  window.onMount = async () => {
    const statusBox = document.getElementById("visit-scan-status");
    const video = document.getElementById("visit-scanner-video");
    const deviceSelect = document.getElementById("visit-camera-select");
    const manualInput = document.getElementById("visit-manual-input");
    const manualBtn = document.getElementById("visit-manual-submit");

    const state = {
      reader: null,
      controls: null,
      busy: false,
      lastToken: "",
      lastAt: 0
    };

    function setStatus(message, tone = "text-muted") {
      statusBox.className = `text-sm ${tone}`;
      statusBox.textContent = message;
    }

    async function stopScanner() {
      try {
        state.controls?.stop?.();
      } catch {
        // ignore
      }
      state.controls = null;
      try {
        state.reader?.reset?.();
      } catch {
        // ignore
      }
      state.reader = null;
      if (video) video.srcObject = null;
    }

    async function submitToken(token) {
      const now = Date.now();
      if (!token || state.busy) return;
      if (state.lastToken === token && now - state.lastAt < 2500) return;

      state.busy = true;
      state.lastToken = token;
      state.lastAt = now;
      manualBtn.disabled = true;
      setStatus("Submitting check-in...", "text-primary");

      try {
        const result = await apiFetch("/customer/visits/check-in", {
          method: "POST",
          body: { token }
        });

        if (result.success) {
          window.toast(result.message, "success");
          setStatus(result.message, "text-success");
        } else {
          window.toast(result.message, "error");
          setStatus(result.message, "text-amber-500");
        }
      } catch (error) {
        window.toast(error.message, "error");
        setStatus(error.message, "text-danger");
      } finally {
        state.busy = false;
        manualBtn.disabled = false;
      }
    }

    async function startScanner(deviceId) {
      if (!window.ZXingBrowser?.BrowserQRCodeReader) {
        setStatus("Scanner library unavailable. Use manual token entry.", "text-danger");
        return;
      }

      await stopScanner();
      state.reader = new window.ZXingBrowser.BrowserQRCodeReader();
      setStatus("Starting camera...", "text-primary");

      try {
        state.controls = await state.reader.decodeFromVideoDevice(deviceId || undefined, video, (result) => {
          const text = result?.text || (typeof result?.getText === "function" ? result.getText() : "");
          if (text) void submitToken(text);
        });
        setStatus("Camera active. Scan the visit QR shown by admin/reception.", "text-success");
      } catch (error) {
        setStatus(error?.message || "Unable to access camera. Use manual entry.", "text-danger");
      }
    }

    async function loadDevices() {
      try {
        const devices = await window.ZXingBrowser.BrowserCodeReader.listVideoInputDevices();
        const options = devices
          .map((device) => `<option value="${esc(device.deviceId)}">${esc(device.label || "Camera")}</option>`)
          .join("");
        deviceSelect.innerHTML = options || '<option value="">Default camera</option>';
        const preferred = devices.find((device) => /back|rear|environment/i.test(device.label || "")) || devices[0];
        if (preferred) {
          deviceSelect.value = preferred.deviceId;
        }
        await startScanner(preferred?.deviceId);
      } catch (error) {
        setStatus(error?.message || "Unable to list camera devices.", "text-danger");
      }
    }

    document.getElementById("visit-camera-start").addEventListener("click", () => {
      void startScanner(deviceSelect.value || undefined);
    });
    document.getElementById("visit-camera-stop").addEventListener("click", () => {
      void stopScanner();
      setStatus("Camera stopped.", "text-muted");
    });
    deviceSelect.addEventListener("change", () => {
      void startScanner(deviceSelect.value || undefined);
    });

    document.getElementById("visit-manual-form").addEventListener("submit", (event) => {
      event.preventDefault();
      void submitToken(manualInput.value.trim());
      manualInput.value = "";
    });

    await loadDevices();

    window.__pageCleanup = () => {
      void stopScanner();
    };
  };

  return `
    <div class="space-y-6">
      <section class="rounded-2xl border border-border bg-surface p-5">
        <h1 class="text-2xl font-heading font-bold text-text">Visit Check-In</h1>
        <p class="text-sm text-muted mt-1">Scan the rotating center QR code to register today\'s visit.</p>
      </section>

      <section class="rounded-2xl border border-border bg-surface p-5">
        <div class="flex flex-wrap items-center gap-3">
          <select id="visit-camera-select" class="rounded-lg border border-border bg-bg px-3 py-2 text-sm"></select>
          <button id="visit-camera-start" type="button" class="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">Start</button>
          <button id="visit-camera-stop" type="button" class="rounded-lg border border-border bg-bg px-4 py-2 text-sm font-semibold text-text">Stop</button>
        </div>
        <div class="mt-4 overflow-hidden rounded-xl border border-border bg-black">
          <video id="visit-scanner-video" class="aspect-[4/3] w-full object-cover" playsinline muted></video>
        </div>
        <div class="mt-3 rounded-lg border border-border bg-bg px-3 py-2">
          <p id="visit-scan-status" class="text-sm text-muted">Preparing scanner...</p>
        </div>
      </section>

      <section class="rounded-2xl border border-border bg-surface p-5">
        <h2 class="text-lg font-semibold">Manual Entry</h2>
        <p class="text-sm text-muted mt-1">Use this only if camera scanning is unavailable.</p>
        <form id="visit-manual-form" class="mt-3 flex flex-col gap-3 md:flex-row">
          <input id="visit-manual-input" placeholder="Paste QR token" class="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm" />
          <button id="visit-manual-submit" class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover">Submit</button>
        </form>
      </section>
    </div>
  `;
}
