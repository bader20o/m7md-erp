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
    const holidaysField = document.getElementById("settings-holidays");
    const hoursContainer = document.getElementById("working-hours-editor");

    let workingHoursState = Array.from({ length: 7 }, (_, day) => createDefaultDay(day));

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

      statusNode.textContent = "Settings loaded.";
      statusNode.className = "text-xs text-success";
    } catch (error) {
      renderWorkingHours();
      statusNode.textContent = error.message || "Unable to load settings.";
      statusNode.className = "text-xs text-danger";
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      statusNode.textContent = "Saving...";
      statusNode.className = "text-xs text-muted";

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
              workingHours: systemHoursPayload,
              holidays
            }
          })
        ]);

        statusNode.textContent = "Settings saved.";
        statusNode.className = "text-xs text-success";
      } catch (error) {
        statusNode.textContent = error.message || "Save failed.";
        statusNode.className = "text-xs text-danger";
      }
    });
  };

  return `
    <div class="max-w-5xl w-full flex flex-col gap-5">
      <div>
        <h1 class="text-2xl font-heading font-bold text-text">Settings</h1>
        <p class="text-sm text-muted mt-1">Business profile, fixed currency, working hours, and holidays.</p>
      </div>

      <form id="settings-form" class="bg-surface border border-border rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <div class="md:col-span-2">
          <label class="block text-xs uppercase text-muted mb-2">Working Hours</label>
          <div id="working-hours-editor" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
        </div>

        <div class="md:col-span-2">
          <label class="block text-xs uppercase text-muted mb-1">Holidays (JSON)</label>
          <textarea id="settings-holidays" rows="5" class="w-full px-3 py-2 rounded-lg border border-border bg-bg font-mono text-xs"></textarea>
        </div>

        <div class="md:col-span-2 flex items-center justify-between">
          <p id="settings-status" class="text-xs text-muted">Loading...</p>
          <button class="px-5 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover">Save Settings</button>
        </div>
      </form>
    </div>
  `;
}
