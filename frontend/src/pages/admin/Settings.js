import { apiFetch } from "../../lib/api.js";

export function AdminSettings() {
  window.onMount = async () => {
    const form = document.getElementById("settings-form");
    const statusNode = document.getElementById("settings-status");

    try {
      const data = await apiFetch("/system/settings");
      const item = data?.item || {};
      form.businessName.value = item.businessName || "";
      form.businessPhone.value = item.businessPhone || "";
      form.businessAddress.value = item.businessAddress || "";
      form.currency.value = item.currency || "USD";
      form.workingHours.value = JSON.stringify(
        item.workingHours || [
          { day: 0, open: "09:00", close: "18:00", closed: false },
          { day: 1, open: "09:00", close: "18:00", closed: false }
        ],
        null,
        2
      );
      form.holidays.value = JSON.stringify(item.holidays || [], null, 2);
      statusNode.textContent = "Settings loaded.";
      statusNode.className = "text-xs text-success";
    } catch (error) {
      statusNode.textContent = error.message || "Unable to load settings.";
      statusNode.className = "text-xs text-danger";
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      statusNode.textContent = "Saving...";
      statusNode.className = "text-xs text-muted";
      try {
        const body = {
          businessName: form.businessName.value,
          businessPhone: form.businessPhone.value,
          businessAddress: form.businessAddress.value,
          currency: form.currency.value,
          workingHours: JSON.parse(form.workingHours.value || "[]"),
          holidays: JSON.parse(form.holidays.value || "[]")
        };
        await apiFetch("/system/settings", {
          method: "PUT",
          body
        });
        statusNode.textContent = "Settings saved.";
        statusNode.className = "text-xs text-success";
      } catch (error) {
        statusNode.textContent = error.message || "Save failed.";
        statusNode.className = "text-xs text-danger";
      }
    });
  };

  return `
    <div class="max-w-4xl w-full flex flex-col gap-5">
      <div>
        <h1 class="text-2xl font-heading font-bold text-text">Settings</h1>
        <p class="text-sm text-muted mt-1">Business profile, hours, holidays, and currency.</p>
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
          <input name="currency" required class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
        </div>
        <div class="md:col-span-2">
          <label class="block text-xs uppercase text-muted mb-1">Address</label>
          <input name="businessAddress" required class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
        </div>
        <div>
          <label class="block text-xs uppercase text-muted mb-1">Working Hours (JSON)</label>
          <textarea name="workingHours" rows="7" class="w-full px-3 py-2 rounded-lg border border-border bg-bg font-mono text-xs"></textarea>
        </div>
        <div>
          <label class="block text-xs uppercase text-muted mb-1">Holidays (JSON)</label>
          <textarea name="holidays" rows="7" class="w-full px-3 py-2 rounded-lg border border-border bg-bg font-mono text-xs"></textarea>
        </div>
        <div class="md:col-span-2 flex items-center justify-between">
          <p id="settings-status" class="text-xs text-muted">Loading...</p>
          <button class="px-5 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary-hover">Save Settings</button>
        </div>
      </form>
    </div>
  `;
}

