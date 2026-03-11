import { apiFetch } from "../../lib/api.js";
import { store } from "../../lib/store.js";
import { isAdminRole } from "../../lib/roles.js";

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const TRIGGER_LABELS = {
  VISIT_COUNT: "Visit Count",
  COMPLETED_BOOKING_COUNT: "Completed Booking Count"
};

const REWARD_LABELS = {
  FREE_SERVICE: "Free Service",
  DISCOUNT_PERCENTAGE: "Discount %",
  FIXED_AMOUNT_DISCOUNT: "Fixed Discount",
  CUSTOM_GIFT: "Custom Gift"
};

function rewardSummary(rule) {
  if (rule.rewardType === "FREE_SERVICE") return rule.rewardService?.nameEn || "Missing service";
  if (rule.rewardType === "DISCOUNT_PERCENTAGE") return `${Number(rule.discountPercentage || 0)}%`;
  if (rule.rewardType === "FIXED_AMOUNT_DISCOUNT") return `${Number(rule.fixedAmount || 0).toFixed(2)} JOD`;
  return rule.customGiftText || rule.rewardLabel || "Custom gift";
}

function statusBadge(active) {
  return active
    ? '<span class="px-2 py-1 rounded bg-success/15 text-success text-[10px] font-bold">ACTIVE</span>'
    : '<span class="px-2 py-1 rounded bg-danger/15 text-danger text-[10px] font-bold">INACTIVE</span>';
}

function toLocalDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fromDateInput(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function AdminRewards() {
  window.onMount = async () => {
    const user = store.state.user;
    const canManage = isAdminRole(user?.role);

    const statsGrid = document.getElementById("rewards-stats-grid");
    const rulesBody = document.getElementById("rewards-rules-body");
    const qrImage = document.getElementById("visit-qr-image");
    const qrMeta = document.getElementById("visit-qr-meta");
    const qrCountdown = document.getElementById("visit-qr-countdown");
    const qrExpiresSeconds = document.getElementById("visit-qr-expires-seconds");

    const form = document.getElementById("reward-rule-form");
    const formTitle = document.getElementById("reward-form-title");
    const resetButton = document.getElementById("reward-form-reset");

    const state = {
      rules: [],
      services: [],
      editingId: null,
      qrRefreshTimer: null,
      qrTickTimer: null,
      qrExpiresAt: null
    };

    function applyFormVisibility() {
      const rewardType = form.rewardType.value;
      document.getElementById("field-reward-service").classList.toggle("hidden", rewardType !== "FREE_SERVICE");
      document.getElementById("field-discount-percentage").classList.toggle("hidden", rewardType !== "DISCOUNT_PERCENTAGE");
      document.getElementById("field-fixed-amount").classList.toggle("hidden", rewardType !== "FIXED_AMOUNT_DISCOUNT");
      document.getElementById("field-custom-gift").classList.toggle("hidden", rewardType !== "CUSTOM_GIFT");
    }

    function resetForm() {
      state.editingId = null;
      formTitle.textContent = "Create Reward Rule";
      form.reset();
      form.isActive.checked = true;
      form.sortOrder.value = "0";
      applyFormVisibility();
    }

    function fillForm(rule) {
      state.editingId = rule.id;
      formTitle.textContent = `Edit: ${rule.title}`;
      form.code.value = rule.code || "";
      form.title.value = rule.title || "";
      form.description.value = rule.description || "";
      form.triggerType.value = rule.triggerType;
      form.triggerValue.value = String(rule.triggerValue || 1);
      form.rewardType.value = rule.rewardType;
      form.rewardServiceId.value = rule.rewardServiceId || "";
      form.rewardLabel.value = rule.rewardLabel || "";
      form.discountPercentage.value = rule.discountPercentage ?? "";
      form.fixedAmount.value = rule.fixedAmount ?? "";
      form.customGiftText.value = rule.customGiftText || "";
      form.currency.value = rule.currency || "JOD";
      form.periodDays.value = rule.periodDays ?? "";
      form.isActive.checked = Boolean(rule.isActive);
      form.sortOrder.value = String(rule.sortOrder ?? 0);
      form.startsAt.value = toLocalDateTime(rule.startsAt);
      form.endsAt.value = toLocalDateTime(rule.endsAt);
      applyFormVisibility();
    }

    function collectFormPayload() {
      return {
        code: form.code.value.trim(),
        title: form.title.value.trim(),
        description: form.description.value.trim() || null,
        triggerType: form.triggerType.value,
        triggerValue: Number(form.triggerValue.value),
        rewardType: form.rewardType.value,
        rewardServiceId: form.rewardServiceId.value || null,
        rewardLabel: form.rewardLabel.value.trim() || null,
        discountPercentage: form.discountPercentage.value ? Number(form.discountPercentage.value) : null,
        fixedAmount: form.fixedAmount.value ? Number(form.fixedAmount.value) : null,
        customGiftText: form.customGiftText.value.trim() || null,
        currency: form.currency.value.trim() || null,
        periodDays: form.periodDays.value ? Number(form.periodDays.value) : null,
        isActive: form.isActive.checked,
        sortOrder: Number(form.sortOrder.value || 0),
        startsAt: fromDateInput(form.startsAt.value),
        endsAt: fromDateInput(form.endsAt.value)
      };
    }

    function renderRules() {
      if (!state.rules.length) {
        rulesBody.innerHTML = '<tr><td colspan="10" class="px-4 py-8 text-center text-sm text-muted">No reward rules yet.</td></tr>';
        return;
      }

      rulesBody.innerHTML = state.rules
        .map((rule) => {
          const usage = rule.usage || { issued: 0, available: 0, redeemed: 0 };
          return `
            <tr class="border-b border-border hover:bg-bg transition-colors">
              <td class="px-4 py-3 text-sm font-semibold text-text">${esc(rule.title)}</td>
              <td class="px-4 py-3 text-xs text-muted">${esc(TRIGGER_LABELS[rule.triggerType] || rule.triggerType)} / ${rule.triggerValue}</td>
              <td class="px-4 py-3 text-xs text-text">${esc(REWARD_LABELS[rule.rewardType] || rule.rewardType)}</td>
              <td class="px-4 py-3 text-xs text-text">${esc(rewardSummary(rule))}</td>
              <td class="px-4 py-3 text-xs text-muted">${rule.periodDays ? `${rule.periodDays} days` : "No reset"}</td>
              <td class="px-4 py-3 text-xs">${statusBadge(rule.isActive)}</td>
              <td class="px-4 py-3 text-xs text-muted">Issued ${usage.issued} / Redeemed ${usage.redeemed}</td>
              <td class="px-4 py-3 text-xs text-muted">${rule.startsAt ? new Date(rule.startsAt).toLocaleDateString() : "-"}</td>
              <td class="px-4 py-3 text-xs text-muted">${rule.endsAt ? new Date(rule.endsAt).toLocaleDateString() : "-"}</td>
              <td class="px-4 py-3 text-right">
                <div class="inline-flex gap-2">
                  <button data-edit="${rule.id}" class="px-2 py-1 rounded border border-border text-xs hover:border-primary">Edit</button>
                  ${canManage
                    ? `<button data-toggle="${rule.id}" class="px-2 py-1 rounded border border-border text-xs hover:border-primary">${rule.isActive ? "Deactivate" : "Activate"}</button>
                       <button data-delete="${rule.id}" class="px-2 py-1 rounded border border-danger/20 text-danger text-xs hover:bg-danger/10">Delete</button>`
                    : ""
                  }
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      rulesBody.querySelectorAll("[data-edit]").forEach((button) => {
        button.addEventListener("click", () => {
          const rule = state.rules.find((entry) => entry.id === button.dataset.edit);
          if (rule) fillForm(rule);
        });
      });

      rulesBody.querySelectorAll("[data-toggle]").forEach((button) => {
        button.addEventListener("click", async () => {
          const rule = state.rules.find((entry) => entry.id === button.dataset.toggle);
          if (!rule) return;
          try {
            await apiFetch(`/admin/rewards/${rule.id}`, {
              method: "PATCH",
              body: { isActive: !rule.isActive }
            });
            window.toast("Reward status updated.", "success");
            await loadRules();
            await loadStats();
          } catch (error) {
            window.toast(error.message, "error");
          }
        });
      });

      rulesBody.querySelectorAll("[data-delete]").forEach((button) => {
        button.addEventListener("click", async () => {
          if (!confirm("Delete this reward rule?")) return;
          try {
            const result = await apiFetch(`/admin/rewards/${button.dataset.delete}`, { method: "DELETE" });
            window.toast(result.archived ? "Reward has history, archived instead of deleted." : "Reward deleted.", "success");
            await loadRules();
            await loadStats();
          } catch (error) {
            window.toast(error.message, "error");
          }
        });
      });
    }

    async function loadRules() {
      const res = await apiFetch("/admin/rewards");
      state.rules = res.items || [];
      renderRules();
    }

    async function loadServices() {
      const res = await apiFetch("/services");
      state.services = res.items || [];
      const options = ['<option value="">Select service</option>']
        .concat(
          state.services
            .filter((service) => service.isActive)
            .map((service) => `<option value="${service.id}">${esc(service.nameEn)}</option>`)
        )
        .join("");
      form.rewardServiceId.innerHTML = options;
    }

    async function loadStats() {
      const stats = await apiFetch("/admin/rewards/stats");
      statsGrid.innerHTML = `
        <div class="rounded-xl border border-border bg-surface p-4"><div class="text-xs text-muted">Active Rewards</div><div class="mt-2 text-2xl font-bold">${stats.activeRewards}</div></div>
        <div class="rounded-xl border border-border bg-surface p-4"><div class="text-xs text-muted">Issued Rewards</div><div class="mt-2 text-2xl font-bold">${stats.issuedRewards}</div></div>
        <div class="rounded-xl border border-border bg-surface p-4"><div class="text-xs text-muted">Redeemed Rewards</div><div class="mt-2 text-2xl font-bold">${stats.redeemedRewards}</div></div>
        <div class="rounded-xl border border-border bg-surface p-4"><div class="text-xs text-muted">Available Rewards</div><div class="mt-2 text-2xl font-bold">${stats.availableRewards}</div></div>
        <div class="rounded-xl border border-border bg-surface p-4"><div class="text-xs text-muted">QR Visits Today</div><div class="mt-2 text-2xl font-bold">${stats.qrVisitsToday}</div></div>
        <div class="rounded-xl border border-border bg-surface p-4"><div class="text-xs text-muted">QR Visits This Month</div><div class="mt-2 text-2xl font-bold">${stats.qrVisitsThisMonth}</div></div>
      `;

      document.getElementById("rewards-most-earned").textContent = stats.mostEarnedReward || "-";
      document.getElementById("rewards-most-redeemed").textContent = stats.mostRedeemedReward || "-";
    }

    async function refreshQr() {
      try {
        const data = await apiFetch("/admin/rewards/visit-qr");
        qrImage.src = data.qrDataUrl;
        qrMeta.textContent = `Generated: ${new Date().toLocaleTimeString()} | Expires: ${new Date(data.expiresAt).toLocaleTimeString()} | Rotation: ${data.rotationId.slice(0, 8)}`;
        state.qrExpiresAt = new Date(data.expiresAt).getTime();
      } catch (error) {
        qrMeta.textContent = error.message;
        qrExpiresSeconds.textContent = "--";
        qrCountdown.textContent = "Retrying...";
      }
    }

    function startQrTimers() {
      if (state.qrRefreshTimer) window.clearInterval(state.qrRefreshTimer);
      if (state.qrTickTimer) window.clearInterval(state.qrTickTimer);

      state.qrRefreshTimer = window.setInterval(() => {
        void refreshQr();
      }, 5000);

      state.qrTickTimer = window.setInterval(() => {
        if (!state.qrExpiresAt) {
          qrExpiresSeconds.textContent = "--";
          qrCountdown.textContent = "Refreshing...";
          return;
        }
        const left = Math.max(0, Math.ceil((state.qrExpiresAt - Date.now()) / 1000));
        qrExpiresSeconds.textContent = String(left);
        qrCountdown.textContent = left === 0 ? "Refreshing now..." : `Refreshing in ${left}s`;
      }, 300);
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!canManage) return;

      const payload = collectFormPayload();
      const url = state.editingId ? `/admin/rewards/${state.editingId}` : "/admin/rewards";
      const method = state.editingId ? "PATCH" : "POST";

      try {
        await apiFetch(url, { method, body: payload });
        window.toast(state.editingId ? "Reward updated." : "Reward created.", "success");
        resetForm();
        await loadRules();
        await loadStats();
      } catch (error) {
        window.toast(error.message, "error");
      }
    });

    form.rewardType.addEventListener("change", applyFormVisibility);
    resetButton.addEventListener("click", resetForm);

    if (!canManage) {
      form.querySelectorAll("input, select, textarea, button[type='submit']").forEach((el) => {
        el.disabled = true;
      });
      resetButton.disabled = true;
    }

    try {
      await Promise.all([loadServices(), loadRules(), loadStats(), refreshQr()]);
      startQrTimers();
      applyFormVisibility();
      resetForm();
    } catch (error) {
      window.toast(error.message || "Failed to load rewards.", "error");
    }

    window.__pageCleanup = () => {
      if (state.qrRefreshTimer) window.clearInterval(state.qrRefreshTimer);
      if (state.qrTickTimer) window.clearInterval(state.qrTickTimer);
    };
  };

  return `
    <div class="space-y-6">
      <section class="rounded-2xl border border-border bg-surface p-5">
        <h1 class="text-2xl font-heading font-bold text-text">Rewards & Loyalty</h1>
        <p class="text-sm text-muted mt-1">Manage reward campaigns, monitor loyalty usage, and run QR visit check-in.</p>
      </section>

      <section id="rewards-stats-grid" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"></section>
      <section class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="rounded-xl border border-border bg-surface p-4"><div class="text-xs text-muted">Most Earned Reward</div><div id="rewards-most-earned" class="mt-2 text-lg font-semibold">-</div></div>
        <div class="rounded-xl border border-border bg-surface p-4"><div class="text-xs text-muted">Most Redeemed Reward</div><div id="rewards-most-redeemed" class="mt-2 text-lg font-semibold">-</div></div>
      </section>

      <section class="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-4">
        <div class="rounded-2xl border border-border bg-surface overflow-hidden">
          <div class="px-5 py-4 border-b border-border"><h2 class="font-bold">Reward Rules</h2></div>
          <div class="overflow-auto">
            <table class="w-full min-w-[980px] text-left">
              <thead class="bg-bg border-b border-border">
                <tr>
                  <th class="px-4 py-3 text-xs uppercase text-muted">Title</th>
                  <th class="px-4 py-3 text-xs uppercase text-muted">Trigger</th>
                  <th class="px-4 py-3 text-xs uppercase text-muted">Type</th>
                  <th class="px-4 py-3 text-xs uppercase text-muted">Reward</th>
                  <th class="px-4 py-3 text-xs uppercase text-muted">Period</th>
                  <th class="px-4 py-3 text-xs uppercase text-muted">Status</th>
                  <th class="px-4 py-3 text-xs uppercase text-muted">Usage</th>
                  <th class="px-4 py-3 text-xs uppercase text-muted">Start</th>
                  <th class="px-4 py-3 text-xs uppercase text-muted">End</th>
                  <th class="px-4 py-3 text-xs uppercase text-muted text-right">Actions</th>
                </tr>
              </thead>
              <tbody id="rewards-rules-body"></tbody>
            </table>
          </div>
        </div>

        <div class="space-y-4">
          <div class="rounded-[32px] border border-primary/35 bg-[linear-gradient(160deg,#031a3a_0%,#011129_100%)] p-5 shadow-[0_24px_64px_rgba(2,6,23,0.55)]">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.22em] text-slate-300">Check In QR</p>
                <p class="mt-2 text-sm text-slate-300">Set <span class="font-semibold text-slate-100">ATTENDANCE_ALLOWED_IPS</span> to lock scans to the center network.</p>
                <p id="visit-qr-countdown" class="mt-2 text-sm font-bold uppercase tracking-[0.18em] text-primary">Rotates every 5 seconds</p>
              </div>
              <div class="rounded-2xl border border-slate-600/60 bg-[#020d24]/90 px-4 py-3 text-right shadow-inner shadow-black/30">
                <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Expires In</p>
                <p class="mt-1 text-2xl font-black text-slate-100"><span id="visit-qr-expires-seconds">--</span><span class="ml-1 text-sm font-semibold text-slate-300">s</span></p>
              </div>
            </div>

            <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
              <div class="rounded-3xl bg-slate-100 p-4">
                <div class="rounded-2xl bg-white p-2 shadow-inner shadow-slate-300">
                  <img id="visit-qr-image" alt="Visit QR" class="mx-auto h-auto w-full max-w-[320px]" />
                </div>
              </div>

              <div class="rounded-3xl border border-slate-600/60 bg-[#020d24]/85 p-5">
                <p class="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">Security</p>
                <p class="mt-3 text-base leading-7 text-slate-200">
                  This QR is live, short-lived, and invalid after the countdown ends. Use it only on the in-center check-in screen.
                </p>
                <p class="mt-4 text-base font-bold uppercase tracking-[0.14em] text-primary">
                  Screenshots and old photos will expire automatically.
                </p>
              </div>
            </div>

            <p id="visit-qr-meta" class="mt-4 break-all text-xs text-slate-400"></p>
          </div>

          <div class="rounded-2xl border border-border bg-surface p-4">
            <h2 id="reward-form-title" class="font-bold">Create Reward Rule</h2>
            <form id="reward-rule-form" class="mt-4 grid grid-cols-1 gap-3">
              <input name="code" placeholder="Code (e.g. VISIT5_WASH)" class="rounded-lg border border-border bg-bg px-3 py-2 text-sm" required />
              <input name="title" placeholder="Title" class="rounded-lg border border-border bg-bg px-3 py-2 text-sm" required />
              <textarea name="description" placeholder="Description" class="rounded-lg border border-border bg-bg px-3 py-2 text-sm" rows="2"></textarea>

              <div class="grid grid-cols-2 gap-3">
                <select name="triggerType" class="rounded-lg border border-border bg-bg px-3 py-2 text-sm">
                  <option value="VISIT_COUNT">Visit Count</option>
                  <option value="COMPLETED_BOOKING_COUNT">Completed Booking Count</option>
                </select>
                <input name="triggerValue" type="number" min="1" value="5" class="rounded-lg border border-border bg-bg px-3 py-2 text-sm" required />
              </div>

              <select name="rewardType" class="rounded-lg border border-border bg-bg px-3 py-2 text-sm">
                <option value="FREE_SERVICE">Free Service</option>
                <option value="DISCOUNT_PERCENTAGE">Discount Percentage</option>
                <option value="FIXED_AMOUNT_DISCOUNT">Fixed Amount Discount</option>
                <option value="CUSTOM_GIFT">Custom Gift</option>
              </select>

              <div id="field-reward-service"><select name="rewardServiceId" class="rounded-lg border border-border bg-bg px-3 py-2 text-sm"></select></div>
              <div id="field-discount-percentage" class="hidden"><input name="discountPercentage" type="number" step="0.01" min="0.01" max="100" placeholder="Discount %" class="rounded-lg border border-border bg-bg px-3 py-2 text-sm" /></div>
              <div id="field-fixed-amount" class="hidden"><input name="fixedAmount" type="number" step="0.01" min="0.01" placeholder="Fixed amount" class="rounded-lg border border-border bg-bg px-3 py-2 text-sm" /></div>
              <div id="field-custom-gift" class="hidden"><input name="customGiftText" placeholder="Custom gift text" class="rounded-lg border border-border bg-bg px-3 py-2 text-sm" /></div>

              <input name="rewardLabel" placeholder="Optional reward label" class="rounded-lg border border-border bg-bg px-3 py-2 text-sm" />

              <div class="grid grid-cols-3 gap-3">
                <input name="currency" value="JOD" class="rounded-lg border border-border bg-bg px-3 py-2 text-sm" />
                <input name="sortOrder" type="number" value="0" class="rounded-lg border border-border bg-bg px-3 py-2 text-sm" />
                <label class="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm"><input name="isActive" type="checkbox" checked /> Active</label>
              </div>

              <input name="periodDays" type="number" min="1" placeholder="Reset period in days (optional)" class="rounded-lg border border-border bg-bg px-3 py-2 text-sm" />

              <div class="grid grid-cols-2 gap-3">
                <input name="startsAt" type="datetime-local" class="rounded-lg border border-border bg-bg px-3 py-2 text-sm" />
                <input name="endsAt" type="datetime-local" class="rounded-lg border border-border bg-bg px-3 py-2 text-sm" />
              </div>

              <div class="flex gap-2 pt-2">
                <button type="submit" class="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary-hover">Save Rule</button>
                <button type="button" id="reward-form-reset" class="rounded-lg border border-border px-4 py-2 text-sm">Reset</button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  `;
}
