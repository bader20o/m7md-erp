import { apiFetch } from '../../lib/api.js';
import { store } from '../../lib/store.js';

function formatDate(value, options = {}) {
    if (!value) return 'Not available';
    return new Date(value).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...options
    });
}

function formatCardExpiry(value) {
    if (!value) return '--/--';
    return new Date(value).toLocaleDateString(undefined, {
        month: '2-digit',
        year: '2-digit'
    });
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function resolveText(lang, item, enKey, arKey, fallback = '') {
    return lang === 'ar'
        ? item?.[arKey] || item?.[enKey] || fallback
        : item?.[enKey] || item?.[arKey] || fallback;
}

function renderPlanBenefits(plan, lang) {
    const benefits = plan?.benefits || [];
    if (!benefits.length) {
        return `<div class="text-xs text-muted">Benefits will appear after activation.</div>`;
    }

    return `
      <ul class="space-y-2">
        ${benefits
            .map((benefit) => `
            <li class="flex items-start gap-3 text-sm text-text">
              <span class="mt-1 inline-flex w-2 h-2 rounded-full bg-primary"></span>
              <div>
                <div class="font-semibold">${escapeHtml(resolveText(lang, benefit, 'titleEn', 'titleAr', 'Benefit'))}</div>
                <div class="text-xs text-muted">${benefit.limitCount} use${benefit.limitCount === 1 ? '' : 's'}</div>
              </div>
            </li>
          `)
            .join('')}
      </ul>
    `;
}

function renderMembershipState(subscription, lang) {
    if (!subscription) {
        return `
          <div class="bg-surface border border-border rounded-2xl p-8 text-center text-muted">
            You do not have a membership yet. Choose a plan below to submit your request.
          </div>
        `;
    }

    if (subscription.status === 'PENDING') {
        return `
          <div class="bg-surface border border-primary/40 rounded-2xl p-6 shadow-sm">
            <div class="inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-primary">Pending Approval</div>
            <h2 class="mt-4 text-2xl font-heading font-bold text-text">Your membership request is pending admin approval.</h2>
            <p class="mt-2 text-sm text-muted">Requested plan: <span class="text-text font-semibold">${escapeHtml(resolveText(lang, subscription.plan, 'nameEn', 'nameAr', subscription.plan?.tier || 'Membership'))}</span></p>
            <p class="mt-1 text-sm text-muted">Requested on ${formatDate(subscription.requestedAt)}</p>
          </div>
        `;
    }

    if (subscription.status === 'REJECTED') {
        return `
          <div class="bg-surface border border-danger/40 rounded-2xl p-6 shadow-sm">
            <div class="inline-flex items-center rounded-full bg-danger/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-danger">Rejected</div>
            <h2 class="mt-4 text-2xl font-heading font-bold text-text">Your membership request was rejected.</h2>
            <p class="mt-2 text-sm text-muted">Plan: <span class="text-text font-semibold">${escapeHtml(resolveText(lang, subscription.plan, 'nameEn', 'nameAr', subscription.plan?.tier || 'Membership'))}</span></p>
            <div class="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-text">
              <div class="text-xs font-bold uppercase tracking-[0.22em] text-danger/80">Reason</div>
              <div class="mt-2">${escapeHtml(subscription.rejectionReason || 'No reason provided.')}</div>
            </div>
            <p class="mt-3 text-xs text-muted">Rejected on ${formatDate(subscription.rejectedAt || subscription.requestedAt)}</p>
          </div>
        `;
    }

    const cardColor = subscription.plan?.tier === 'GOLD'
        ? 'from-yellow-400 to-yellow-600 shadow-yellow-500/25'
        : subscription.plan?.tier === 'SILVER'
            ? 'from-slate-300 to-slate-500 shadow-slate-500/25'
            : 'from-cyan-500 to-blue-700 shadow-cyan-500/25';

    return `
      <div class="space-y-6">
        <div class="w-full max-w-md mx-auto md:mx-0 aspect-[1.6/1] bg-gradient-to-br ${cardColor} rounded-2xl p-6 md:p-8 text-white flex flex-col justify-between relative overflow-hidden shadow-2xl">
          <div class="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-50 mix-blend-overlay"></div>
          <div class="relative z-10 flex justify-between items-start">
            <div class="flex gap-2 items-center">
              <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-md">EV</div>
              <span class="font-heading font-bold tracking-widest uppercase text-sm opacity-90">Elite Care</span>
            </div>
            <div class="font-mono bg-white/20 backdrop-blur-md px-3 py-1 rounded text-xs tracking-widest">${escapeHtml(subscription.plan?.tier || 'MEMBER')}</div>
          </div>
          <div class="relative z-10 mt-auto">
            <div class="font-mono text-lg tracking-widest opacity-90 mb-2">${escapeHtml(subscription.id.slice(0, 4))} ${escapeHtml(subscription.id.slice(4, 8))} ${escapeHtml(subscription.id.slice(8, 12))}</div>
            <div class="flex justify-between items-end gap-4">
              <div>
                <p class="text-[10px] uppercase tracking-wider opacity-70 mb-0.5">Member Name</p>
                <p class="font-bold tracking-wide">${escapeHtml(store.state.user?.fullName || 'Valued Member')}</p>
              </div>
              <div class="text-right">
                <p class="text-[10px] uppercase tracking-wider opacity-70 mb-0.5">Valid Thru</p>
                <p class="font-bold tracking-wide font-mono">${escapeHtml(formatCardExpiry(subscription.expiresAt))}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-surface border border-border rounded-2xl p-6">
          <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div class="inline-flex items-center rounded-full bg-success/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-success">Active</div>
              <h3 class="mt-4 text-2xl font-heading font-bold text-text">${escapeHtml(resolveText(lang, subscription.plan, 'nameEn', 'nameAr', subscription.plan?.tier || 'Membership'))}</h3>
              <p class="mt-2 text-sm text-muted">${escapeHtml(resolveText(lang, subscription.plan, 'descriptionEn', 'descriptionAr', 'Membership plan'))}</p>
            </div>
            <div class="rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-muted min-w-[220px]">
              <div>Requested: <span class="text-text">${formatDate(subscription.requestedAt)}</span></div>
              <div class="mt-1">Approved: <span class="text-text">${formatDate(subscription.approvedAt)}</span></div>
              <div class="mt-1">Expires: <span class="text-text">${formatDate(subscription.expiresAt)}</span></div>
            </div>
          </div>

          <div class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="rounded-2xl border border-border bg-bg p-5">
              <div class="text-xs font-bold uppercase tracking-[0.24em] text-muted">Benefits</div>
              <div class="mt-4 space-y-3">
                ${(subscription.benefits || []).length
            ? subscription.benefits.map((benefit) => `
                      <div class="rounded-xl border border-border p-4">
                        <div class="flex items-start justify-between gap-3">
                          <div>
                            <div class="font-semibold text-text">${escapeHtml(resolveText(lang, benefit, 'titleEn', 'titleAr', 'Benefit'))}</div>
                            <div class="mt-1 text-sm text-muted">${escapeHtml(resolveText(lang, benefit, 'descriptionEn', 'descriptionAr', ''))}</div>
                          </div>
                          <div class="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">${benefit.usedCount}/${benefit.limitCount}</div>
                        </div>
                      </div>
                    `).join('')
            : `<div class="text-sm text-muted">No benefits are attached to this membership yet.</div>`}
              </div>
            </div>
            <div class="rounded-2xl border border-border bg-bg p-5">
              <div class="text-xs font-bold uppercase tracking-[0.24em] text-muted">Delivery Details</div>
              <div class="mt-4 space-y-3 text-sm">
                <div class="flex justify-between gap-4"><span class="text-muted">Company</span><span class="text-text text-right">${escapeHtml(subscription.delivery?.deliveryCompanyName || 'Not provided')}</span></div>
                <div class="flex justify-between gap-4"><span class="text-muted">Contact</span><span class="text-text text-right">${escapeHtml(subscription.delivery?.deliveryPhone || 'Not provided')}</span></div>
                <div class="flex justify-between gap-4"><span class="text-muted">Tracking</span><span class="text-text text-right">${escapeHtml(subscription.delivery?.deliveryTrackingCode || 'Pending')}</span></div>
                <div class="rounded-xl border border-border p-4 text-text">
                  <div class="text-xs font-bold uppercase tracking-[0.24em] text-muted">Admin Note</div>
                  <div class="mt-2">${escapeHtml(subscription.delivery?.deliveryNote || 'No delivery note available.')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
}

function getPlanVisualTheme(plan) {
    const tier = String(plan?.tier || '').toUpperCase();

    if (tier === 'GOLD') {
        return {
            panelClass: 'from-amber-300/20 via-yellow-500/10 to-orange-500/20',
            accentClass: 'bg-yellow-400/15 text-yellow-200 border-yellow-300/20',
            glowClass: 'shadow-yellow-500/20'
        };
    }

    if (tier === 'SILVER') {
        return {
            panelClass: 'from-slate-200/20 via-slate-400/10 to-slate-500/20',
            accentClass: 'bg-slate-200/10 text-slate-100 border-slate-200/20',
            glowClass: 'shadow-slate-400/20'
        };
    }

    return {
        panelClass: 'from-amber-700/20 via-orange-500/10 to-rose-500/20',
        accentClass: 'bg-amber-400/15 text-amber-100 border-amber-300/20',
        glowClass: 'shadow-amber-500/20'
    };
}

function getPlanActionState(subscription, plan) {
    const currentStatus = subscription?.status || null;
    const isCurrentPlan = subscription?.plan?.id === plan.id;

    if (currentStatus === 'ACTIVE') {
        return {
            disabled: true,
            label: isCurrentPlan ? 'Current Plan' : 'Membership Active',
            note: isCurrentPlan ? 'This is the plan currently attached to your account.' : 'You can request a new plan after the current membership ends.',
            buttonClass: 'bg-success/15 text-success cursor-not-allowed'
        };
    }

    if (currentStatus === 'PENDING') {
        return {
            disabled: true,
            label: isCurrentPlan ? 'Pending Approval' : 'Request Pending',
            note: isCurrentPlan ? 'Your selected plan is waiting for admin approval.' : 'Wait for the current request to be reviewed before submitting another one.',
            buttonClass: 'bg-primary/15 text-primary cursor-not-allowed'
        };
    }

    if (currentStatus === 'REJECTED') {
        return {
            disabled: false,
            label: isCurrentPlan ? 'Request Again' : 'Subscribe Now',
            note: isCurrentPlan ? 'You can submit this plan again with updated details.' : '',
            buttonClass: 'bg-primary hover:bg-primary-hover text-white'
        };
    }

    return {
        disabled: false,
        label: 'Subscribe Now',
        note: '',
        buttonClass: 'bg-primary hover:bg-primary-hover text-white'
    };
}

function renderPlans(plans, subscription, lang) {
    if (!plans.length) {
        return `<div class="col-span-full rounded-2xl border border-border bg-surface p-8 text-center text-muted">No membership plans are available right now.</div>`;
    }

    return plans.map((plan) => {
        const theme = getPlanVisualTheme(plan);
        const action = getPlanActionState(subscription, plan);
        const isCurrentPlan = subscription?.plan?.id === plan.id;

        return `
      <article class="bg-surface border ${isCurrentPlan ? 'border-primary shadow-lg shadow-primary/10' : 'border-border hover:border-primary'} rounded-2xl overflow-hidden shadow-sm flex flex-col">
        <div class="aspect-[16/9] bg-bg border-b border-border overflow-hidden">
          ${plan.imageUrl
            ? `<img src="${plan.imageUrl}" alt="${escapeHtml(plan.nameEn)}" class="w-full h-full object-cover">`
            : `<div class="relative w-full h-full overflow-hidden bg-gradient-to-br ${theme.panelClass}">
                <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_38%)]"></div>
                <div class="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/8 blur-2xl"></div>
                <div class="absolute -left-10 bottom-0 h-24 w-24 rounded-full bg-white/8 blur-xl"></div>
                <div class="relative flex h-full flex-col justify-between p-5">
                  <div class="flex items-start justify-between gap-3">
                    <span class="inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] ${theme.accentClass}">${escapeHtml(plan.tier)}</span>
                    ${isCurrentPlan ? '<span class="rounded-full bg-primary/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Current</span>' : ''}
                  </div>
                  <div class="max-w-[70%]">
                    <div class="text-xs font-bold uppercase tracking-[0.24em] text-white/60">EV Service Center</div>
                    <div class="mt-2 text-2xl font-heading font-bold text-white">${escapeHtml(resolveText(lang, plan, 'nameEn', 'nameAr', plan.tier))}</div>
                  </div>
                </div>
              </div>`}
        </div>
        <div class="p-6 flex flex-col gap-4 flex-1">
          <div class="flex items-center justify-between gap-3">
            <span class="inline-flex rounded-full bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-primary">${escapeHtml(plan.tier)}</span>
            <span class="text-sm text-muted">${plan.durationMonths} month${plan.durationMonths === 1 ? '' : 's'}</span>
          </div>
          <div>
            <h3 class="card-title font-heading text-text">${escapeHtml(resolveText(lang, plan, 'nameEn', 'nameAr', plan.tier))}</h3>
            <p class="card-description mt-3 leading-relaxed">${escapeHtml(resolveText(lang, plan, 'descriptionEn', 'descriptionAr', 'Comprehensive care plan.'))}</p>
          </div>
          <div class="rounded-2xl border border-border bg-bg p-4">
            <div class="text-xs font-bold uppercase tracking-[0.24em] text-muted">Included Benefits</div>
            <div class="mt-3">${renderPlanBenefits(plan, lang)}</div>
          </div>
          <div class="mt-auto flex items-center justify-between gap-4">
            <div class="text-3xl font-bold text-text">
              ${Number(plan.priceJod).toFixed(2)} <span class="text-sm font-medium text-muted">JOD</span>
            </div>
            <button
              class="membership-subscribe-btn min-w-[160px] py-3 px-5 rounded-xl font-bold transition-colors ${action.buttonClass}"
              data-plan-id="${plan.id}"
              ${action.disabled ? 'disabled' : ''}
            >
              ${action.label}
            </button>
          </div>
          ${action.note ? `<div class="text-xs leading-relaxed text-muted">${escapeHtml(action.note)}</div>` : ''}
        </div>
      </article>
    `;
    }).join('');
}

export function Membership() {

    window.onMount = async () => {
        const plansGrid = document.getElementById('plans-grid');
        const membershipStateCard = document.getElementById('my-membership-card');

        async function load() {
            plansGrid.innerHTML = `
              <div class="skeleton h-80 rounded-2xl"></div>
              <div class="skeleton h-80 rounded-2xl"></div>
              <div class="skeleton h-80 rounded-2xl"></div>
            `;
            membershipStateCard.innerHTML = `<div class="skeleton w-full aspect-[1.6/1] rounded-2xl"></div>`;

            try {
                const data = await apiFetch('/membership/me');
                const lang = store.state.lang;
                const subscription = data?.currentSubscription || null;
                const plans = data?.plans || [];

                membershipStateCard.innerHTML = renderMembershipState(subscription, lang);
                plansGrid.innerHTML = renderPlans(plans, subscription, lang);

                plansGrid.querySelectorAll('.membership-subscribe-btn').forEach((button) => {
                    button.addEventListener('click', async () => {
                        const planId = button.getAttribute('data-plan-id');
                        if (!planId) return;

                        button.disabled = true;
                        try {
                            await apiFetch('/membership/subscribe', {
                                method: 'POST',
                                body: { planId }
                            });
                            window.toast('Membership request submitted.', 'success');
                            await load();
                        } catch (error) {
                            window.toast(error.message || 'Unable to submit membership request.', 'error');
                            button.disabled = false;
                        }
                    });
                });
            } catch (error) {
                console.error(error);
                membershipStateCard.innerHTML = `<div class="bg-surface border border-danger/40 rounded-2xl p-6 text-danger">Error loading membership data.</div>`;
                plansGrid.innerHTML = `<div class="col-span-full rounded-2xl border border-danger/40 bg-surface p-6 text-danger">Unable to load membership plans.</div>`;
            }
        }

        await load();
    };

    return `
    <div class="flex flex-col gap-12 w-full max-w-6xl mx-auto">
      <section>
        <div class="mb-6 text-center md:text-left">
          <h1 class="text-3xl font-heading font-bold text-text">Your Digital Card</h1>
          <p class="text-muted mt-2">Request a membership plan, wait for approval, then use your active benefits from this page.</p>
        </div>
        <div id="my-membership-card" class="w-full">
          <div class="skeleton w-full max-w-xl aspect-[1.6/1] rounded-2xl"></div>
        </div>
      </section>

      <section>
        <div class="mb-8 text-center">
          <h2 class="section-title font-heading text-text">Membership Plans</h2>
          <p class="text-muted mt-2">Choose the tier that fits your EV needs and submit your membership request.</p>
        </div>

        <div id="plans-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <div class="skeleton h-80 rounded-2xl"></div>
          <div class="skeleton h-80 rounded-2xl"></div>
          <div class="skeleton h-80 rounded-2xl"></div>
        </div>
      </section>
    </div>
  `;
}
