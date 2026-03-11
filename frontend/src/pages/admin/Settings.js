import { apiFetch } from "../../lib/api.js";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function createDefaultDay(dayOfWeek) {
  return {
    dayOfWeek,
    openTime: "09:00",
    closeTime: "18:00",
    isClosed: false,
    splitEnabled: false,
    splitOpenTime: "20:00",
    splitCloseTime: "23:00"
  };
}

export function AdminSettings() {
  window.onMount = async () => {
    const form = document.getElementById("settings-form");
    const statusNode = document.getElementById("settings-status");
    const saveButton = document.getElementById("settings-save-btn");
    const holidaysField = document.getElementById("settings-holidays");
    const hoursContainer = document.getElementById("working-hours-editor");

    let workingHoursState = Array.from({ length: 7 }, (_, day) => createDefaultDay(day));

    function setStatus(message, tone = "muted") {
      statusNode.textContent = message;
      statusNode.className = `text-xs ${tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-muted"}`;
    }

    function setSavingState(isSaving) {
      if (!saveButton) return;
      saveButton.disabled = isSaving;
      saveButton.textContent = isSaving ? "Saving..." : "Save Settings";
    }

    function renderWorkingHours() {
      hoursContainer.innerHTML = workingHoursState
        .map((day) => {
          const splitHidden = day.splitEnabled ? "" : "hidden";
          return `
            <div data-day="${day.dayOfWeek}" class="rounded-xl border border-border bg-bg p-3 space-y-3">
              <div class="flex items-center justify-between gap-3">
                <div class="font-semibold text-sm text-text">${DAY_LABELS[day.dayOfWeek]}</div>
                <label class="inline-flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" data-field="isClosed" ${day.isClosed ? "checked" : ""}>
                  Closed
                </label>
              </div>
              <div class="grid grid-cols-2 gap-3 ${day.isClosed ? "opacity-50" : ""}">
                <div>
                  <label class="block text-[10px] uppercase text-muted mb-1">Start</label>
                  <input type="time" data-field="openTime" value="${day.openTime}" ${day.isClosed ? "disabled" : ""} class="w-full px-2 py-2 rounded-lg border border-border bg-surface text-sm">
                </div>
                <div>
                  <label class="block text-[10px] uppercase text-muted mb-1">End</label>
                  <input type="time" data-field="closeTime" value="${day.closeTime}" ${day.isClosed ? "disabled" : ""} class="w-full px-2 py-2 rounded-lg border border-border bg-surface text-sm">
                </div>
              </div>
              <div class="${day.isClosed ? "opacity-50" : ""}">
                <label class="inline-flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" data-field="splitEnabled" ${day.splitEnabled ? "checked" : ""} ${day.isClosed ? "disabled" : ""}>
                  Split shift
                </label>
                <div class="grid grid-cols-2 gap-3 mt-2 ${splitHidden}">
                  <div>
                    <label class="block text-[10px] uppercase text-muted mb-1">Split Start</label>
                    <input type="time" data-field="splitOpenTime" value="${day.splitOpenTime}" class="w-full px-2 py-2 rounded-lg border border-border bg-surface text-sm">
                  </div>
                  <div>
                    <label class="block text-[10px] uppercase text-muted mb-1">Split End</label>
                    <input type="time" data-field="splitCloseTime" value="${day.splitCloseTime}" class="w-full px-2 py-2 rounded-lg border border-border bg-surface text-sm">
                  </div>
                </div>
              </div>
            </div>
          `;
        })
        .join("");
    }

    function updateDayState(dayOfWeek, field, value) {
      const day = workingHoursState.find((entry) => entry.dayOfWeek === dayOfWeek);
      if (!day) return;
      day[field] = value;
    }

    hoursContainer.addEventListener("change", (event) => {
      const target = event.target;
      const row = target.closest("[data-day]");
      if (!row) return;

      const dayOfWeek = Number(row.dataset.day);
      const field = target.dataset.field;
      if (!field) return;

      if (target.type === "checkbox") {
        updateDayState(dayOfWeek, field, target.checked);
        renderWorkingHours();
      }
    });

    hoursContainer.addEventListener("input", (event) => {
      const target = event.target;
      const row = target.closest("[data-day]");
      if (!row) return;

      const dayOfWeek = Number(row.dataset.day);
      const field = target.dataset.field;
      if (!field || target.type === "checkbox") return;
      updateDayState(dayOfWeek, field, target.value);
    });

    try {
      const [settingsData, workingHoursData] = await Promise.all([
        apiFetch("/system/settings"),
        apiFetch("/working-hours")
      ]);

      const item = settingsData?.item || {};
      form.businessName.value = item.businessName || "";
      form.businessPhone.value = item.businessPhone || "";
      form.businessAddress.value = item.businessAddress || "";
      form.email.value = item.email || "";
      form.whatsapp.value = item.whatsapp || "";
      form.website.value = item.website || "";
      form.instagram.value = item.instagram || "";
      form.facebook.value = item.facebook || "";
      form.tiktok.value = item.tiktok || "";
      form.youtube.value = item.youtube || "";
      holidaysField.value = JSON.stringify(item.holidays || [], null, 2);

      const baseDays = Array.from({ length: 7 }, (_, day) => createDefaultDay(day));
      const primaryHours = workingHoursData?.items || [];
      for (const entry of primaryHours) {
        const day = baseDays.find((candidate) => candidate.dayOfWeek === entry.dayOfWeek);
        if (!day) continue;
        day.openTime = entry.openTime;
        day.closeTime = entry.closeTime;
        day.isClosed = Boolean(entry.isClosed);
      }

      const storedHours = Array.isArray(item.workingHours) ? item.workingHours : [];
      for (const entry of storedHours) {
        const day = baseDays.find((candidate) => candidate.dayOfWeek === entry.day);
        if (!day) continue;
        if (Array.isArray(entry.splitShifts) && entry.splitShifts[0]) {
          day.splitEnabled = true;
          day.splitOpenTime = entry.splitShifts[0].open || day.splitOpenTime;
          day.splitCloseTime = entry.splitShifts[0].close || day.splitCloseTime;
        }
      }

      workingHoursState = baseDays;
      renderWorkingHours();

      setStatus("Settings loaded.", "success");
    } catch (error) {
      renderWorkingHours();
      setStatus(error.message || "Unable to load settings.", "danger");
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setStatus("Saving...");
      setSavingState(true);

      try {
        const holidays = JSON.parse(holidaysField.value || "[]");
        const firstShiftPayload = workingHoursState.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          openTime: day.openTime,
          closeTime: day.closeTime,
          isClosed: day.isClosed
        }));

        const systemHoursPayload = workingHoursState.map((day) => ({
          day: day.dayOfWeek,
          open: day.openTime,
          close: day.closeTime,
          closed: day.isClosed,
          splitShifts: day.splitEnabled
            ? [
                {
                  open: day.splitOpenTime,
                  close: day.splitCloseTime
                }
              ]
            : []
        }));

        await Promise.all([
          apiFetch("/working-hours", {
            method: "PUT",
            body: { items: firstShiftPayload }
          }),
          apiFetch("/system/settings", {
            method: "PUT",
            body: {
              businessName: form.businessName.value,
              businessPhone: form.businessPhone.value,
              businessAddress: form.businessAddress.value,
              email: form.email.value || null,
              whatsapp: form.whatsapp.value || null,
              website: form.website.value || null,
              instagram: form.instagram.value || null,
              facebook: form.facebook.value || null,
              tiktok: form.tiktok.value || null,
              youtube: form.youtube.value || null,
              workingHours: systemHoursPayload,
              holidays
            }
          })
        ]);

        setStatus(`Settings saved at ${new Date().toLocaleTimeString()}.`, "success");
      } catch (error) {
        setStatus(error.message || "Save failed.", "danger");
      } finally {
        setSavingState(false);
      }
    });
  };

  return `
    <div class="max-w-5xl w-full flex flex-col gap-5">
      <div>
        <h1 class="text-2xl font-heading font-bold text-text">Settings</h1>
        <p class="text-sm text-muted mt-1">Business profile, fixed currency, working hours, and holidays.</p>
      </div>

      <form id="settings-form" class="bg-surface border border-border rounded-2xl p-6 space-y-6">
        <section class="space-y-3">
          <div>
            <h2 class="text-sm font-bold uppercase tracking-wider text-muted">Business Profile</h2>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label class="block text-xs uppercase text-muted mb-1">Business Name</label>
              <input name="businessName" required class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
            </div>
            <div>
              <label class="block text-xs uppercase text-muted mb-1">Phone</label>
              <input name="businessPhone" required class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
            </div>
            <div>
              <label class="block text-xs uppercase text-muted mb-1">Currency</label>
              <input value="JOD" readonly class="w-full px-3 py-2 rounded-lg border border-border bg-bg text-muted">
            </div>
            <div class="md:col-span-2">
              <label class="block text-xs uppercase text-muted mb-1">Address</label>
              <input name="businessAddress" required class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
            </div>
          </div>
        </section>

        <section class="space-y-3 pt-2 border-t border-border">
          <div>
            <h2 class="text-sm font-bold uppercase tracking-wider text-muted">Contact Information</h2>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs uppercase text-muted mb-1">Email</label>
              <input name="email" type="email" placeholder="optional" class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
            </div>
            <div>
              <label class="block text-xs uppercase text-muted mb-1">WhatsApp</label>
              <input name="whatsapp" placeholder="optional" class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
            </div>
            <div>
              <label class="block text-xs uppercase text-muted mb-1">Website</label>
              <input name="website" placeholder="optional" class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
            </div>
          </div>
        </section>

        <section class="space-y-3 pt-2 border-t border-border">
          <div>
            <h2 class="text-sm font-bold uppercase tracking-wider text-muted">Social Media</h2>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs uppercase text-muted mb-1">Instagram</label>
              <input name="instagram" placeholder="optional" class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
            </div>
            <div>
              <label class="block text-xs uppercase text-muted mb-1">Facebook</label>
              <input name="facebook" placeholder="optional" class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
            </div>
            <div>
              <label class="block text-xs uppercase text-muted mb-1">TikTok</label>
              <input name="tiktok" placeholder="optional" class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
            </div>
            <div>
              <label class="block text-xs uppercase text-muted mb-1">YouTube</label>
              <input name="youtube" placeholder="optional" class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
            </div>
          </div>
        </section>

        <section class="space-y-3 pt-2 border-t border-border">
          <label class="block text-xs uppercase text-muted mb-2">Working Hours</label>
          <div id="working-hours-editor" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
        </section>

        <section class="space-y-3 pt-2 border-t border-border">
          <label class="block text-xs uppercase text-muted mb-1">Holidays (JSON)</label>
          <textarea id="settings-holidays" rows="5" class="w-full px-3 py-2 rounded-lg border border-border bg-bg font-mono text-xs"></textarea>
        </section>

        <div class="flex items-center justify-between pt-1">
          <p id="settings-status" class="text-xs text-muted">Loading...</p>
          <button id="settings-save-btn" class="px-5 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover disabled:opacity-70 disabled:cursor-not-allowed">Save Settings</button>
        </div>
      </form>
    </div>
  `;
}
