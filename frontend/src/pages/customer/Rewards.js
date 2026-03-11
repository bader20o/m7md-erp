import { apiFetch } from "../../lib/api.js";

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function triggerText(rule) {
  if (rule.triggerType === "VISIT_COUNT") {
    return `${rule.triggerValue} visits`;
  }
  return `${rule.triggerValue} completed services`;
}

function rewardText(rule) {
  if (rule.rewardType === "FREE_SERVICE") return rule.rewardServiceName || rule.rewardLabel || "Free service";
  if (rule.rewardType === "DISCOUNT_PERCENTAGE") return `${Number(rule.discountPercentage || 0)}% discount`;
  if (rule.rewardType === "FIXED_AMOUNT_DISCOUNT") return `${Number(rule.fixedAmount || 0).toFixed(2)} JOD discount`;
  return rule.customGiftText || rule.rewardLabel || "Custom gift";
}

function rewardBadge(status) {
  if (status === "AVAILABLE") return '<span class="px-2 py-1 rounded bg-success/15 text-success text-[10px] font-bold">AVAILABLE</span>';
  if (status === "REDEEMED") return '<span class="px-2 py-1 rounded bg-primary/15 text-primary text-[10px] font-bold">REDEEMED</span>';
  if (status === "EXPIRED") return '<span class="px-2 py-1 rounded bg-amber-500/15 text-amber-500 text-[10px] font-bold">EXPIRED</span>';
  return '<span class="px-2 py-1 rounded bg-danger/15 text-danger text-[10px] font-bold">CANCELLED</span>';
}

export function CustomerRewards() {
  window.onMount = async () => {
    const offered = document.getElementById("rewards-offered");
    const available = document.getElementById("rewards-available");
    const history = document.getElementById("rewards-history");

    try {
      const data = await apiFetch("/customer/rewards");

      const activeRules = data.activeRules || [];
      offered.innerHTML = activeRules.length
        ? activeRules
            .map((rule) => {
              const progress = Number(rule.progressValue || 0);
              const triggerValue = Number(rule.triggerValue || 1);
              const percent = Math.min(100, Math.floor((progress / triggerValue) * 100));
              return `
                <article class="rounded-xl border border-border bg-surface p-4">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <h3 class="text-base font-semibold text-text">${esc(rule.title)}</h3>
                      <p class="text-xs text-muted mt-1">Unlock: ${esc(triggerText(rule))}</p>
                      <p class="text-xs text-text mt-1">Reward: ${esc(rewardText(rule))}</p>
                      ${rule.periodDays ? `<p class="text-xs text-muted mt-1">Resets every ${rule.periodDays} days${rule.daysUntilReset != null ? ` • ${rule.daysUntilReset} day(s) left` : ""}</p>` : ""}
                    </div>
                    <span class="text-xs text-muted">${progress} / ${triggerValue}</span>
                  </div>
                  <div class="mt-3 h-2 rounded-full bg-bg overflow-hidden"><div class="h-full bg-primary" style="width:${percent}%"></div></div>
                  <p class="mt-2 text-xs text-muted">${rule.remainingToUnlock <= 0 ? "Unlocked" : `${rule.remainingToUnlock} more to unlock`}</p>
                </article>
              `;
            })
            .join("")
        : '<div class="rounded-xl border border-border bg-surface p-4 text-sm text-muted">No active reward campaigns right now.</div>';

      const availableItems = data.availableRewards || [];
      available.innerHTML = availableItems.length
        ? availableItems
            .map(
              (item) => `
              <article class="rounded-xl border border-border bg-surface p-4">
                <div class="flex items-center justify-between gap-2">
                  <h3 class="text-sm font-semibold text-text">${esc(item.rewardRule?.title || item.rewardLabel || item.rewardType)}</h3>
                  ${rewardBadge(item.status)}
                </div>
                <p class="text-xs text-muted mt-2">${esc(rewardText(item))}</p>
                <p class="text-xs text-muted mt-2">Issued: ${new Date(item.issuedAt).toLocaleString()}</p>
              </article>
            `
            )
            .join("")
        : '<div class="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted">No available rewards yet.</div>';

      const historyItems = data.history || [];
      history.innerHTML = historyItems.length
        ? historyItems
            .map(
              (item) => `
              <article class="rounded-xl border border-border bg-surface p-4">
                <div class="flex items-center justify-between gap-2">
                  <h3 class="text-sm font-semibold text-text">${esc(item.rewardRule?.title || item.rewardLabel || item.rewardType)}</h3>
                  ${rewardBadge(item.status)}
                </div>
                <p class="text-xs text-muted mt-2">${esc(rewardText(item))}</p>
                <p class="text-xs text-muted mt-2">Issued: ${new Date(item.issuedAt).toLocaleString()}</p>
                <p class="text-xs text-muted mt-1">Redeemed: ${item.redeemedAt ? new Date(item.redeemedAt).toLocaleString() : "-"}</p>
              </article>
            `
            )
            .join("")
        : '<div class="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted">No reward history yet.</div>';
    } catch (error) {
      const html = `<div class="rounded-xl border border-danger/20 bg-danger/10 p-4 text-sm text-danger">${esc(error.message)}</div>`;
      offered.innerHTML = html;
      available.innerHTML = html;
      history.innerHTML = html;
    }
  };

  return `
    <div class="space-y-6">
      <section class="rounded-2xl border border-border bg-surface p-5">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 class="text-2xl font-heading font-bold text-text">My Rewards</h1>
            <p class="text-sm text-muted mt-1">Track your progress and redeem earned rewards on future bookings.</p>
          </div>
          <button onclick="navigate(event, '/rewards/scan')" class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover">Scan Visit QR</button>
        </div>
      </section>

      <section>
        <h2 class="text-lg font-semibold mb-3">Rewards Offered</h2>
        <div id="rewards-offered" class="grid grid-cols-1 gap-3 md:grid-cols-2"></div>
      </section>

      <section>
        <h2 class="text-lg font-semibold mb-3">Available Rewards</h2>
        <div id="rewards-available" class="grid grid-cols-1 gap-3 md:grid-cols-2"></div>
      </section>

      <section>
        <h2 class="text-lg font-semibold mb-3">Reward History</h2>
        <div id="rewards-history" class="grid grid-cols-1 gap-3 md:grid-cols-2"></div>
      </section>
    </div>
  `;
}
