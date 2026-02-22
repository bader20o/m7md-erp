import { store } from '../../lib/store.js';
import { apiFetch } from '../../lib/api.js';

export function Membership() {

    window.onMount = async () => {
        const plansGrid = document.getElementById('plans-grid');
        const myMembershipCard = document.getElementById('my-membership-card');

        try {
            const [plansRes, ordersRes] = await Promise.all([
                apiFetch('/memberships/plans'),
                apiFetch('/memberships/orders')
            ]);

            const activeOrder = ordersRes?.items?.find(o => o.status === 'ACTIVE');

            if (activeOrder) {
                // Display digital card
                const cardColor = activeOrder.plan.tier === 'GOLD' ? 'from-yellow-400 to-yellow-600 shadow-yellow-500/30'
                    : activeOrder.plan.tier === 'SILVER' ? 'from-gray-300 to-gray-500 shadow-gray-500/30'
                        : 'from-orange-400 to-orange-700 shadow-orange-700/30';

                myMembershipCard.innerHTML = `
          <div class="w-full max-w-md mx-auto aspect-[1.6/1] bg-gradient-to-br ${cardColor} rounded-2xl p-6 md:p-8 text-white flex flex-col justify-between relative overflow-hidden shadow-2xl transition-transform hover:scale-[1.02]">
             <!-- Holographic overlay effect -->
             <div class="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-50 mix-blend-overlay"></div>
             
             <div class="flex justify-between items-start relative z-10">
               <div class="flex gap-2 items-center">
                 <div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-md">EV</div>
                 <span class="font-heading font-bold tracking-widest uppercase text-sm opacity-90">Elite Care</span>
               </div>
               <div class="font-mono bg-white/20 backdrop-blur-md px-3 py-1 rounded text-xs tracking-widest">${activeOrder.plan.tier}</div>
             </div>

             <div class="relative z-10 mt-auto">
               <div class="font-mono text-lg tracking-widest opacity-90 mb-2">${activeOrder.id.substring(0, 4)} ${activeOrder.id.substring(4, 8)} ${activeOrder.id.substring(8, 12)}</div>
               <div class="flex justify-between items-end">
                 <div>
                   <p class="text-[10px] uppercase tracking-wider opacity-70 mb-0.5">Member Name</p>
                   <p class="font-bold tracking-wide">${store.state.user.fullName || 'Valued Member'}</p>
                 </div>
                 <div class="text-right">
                   <p class="text-[10px] uppercase tracking-wider opacity-70 mb-0.5">Valid Thru</p>
                   <p class="font-bold tracking-wide font-mono">${new Date(activeOrder.endDate).toLocaleDateString(undefined, { month: '2-digit', year: '2-digit' })}</p>
                 </div>
               </div>
             </div>
          </div>
          
          <div class="mt-8 bg-surface border border-border rounded-xl p-6">
            <h3 class="font-bold text-lg mb-4">Plan Benefits</h3>
            <ul class="space-y-3">
              ${(activeOrder.plan.entitlements || []).map(ent => `
                <li class="flex items-center gap-3 text-sm text-text">
                  <svg class="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                  ${ent.service?.nameEn || 'Service'} (${ent.totalUses} uses remaining)
                </li>
              `).join('')}
              <li class="flex items-center gap-3 text-sm text-text">
                  <svg class="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                  Premium Priority Support
              </li>
            </ul>
          </div>
        `;
            } else {
                myMembershipCard.innerHTML = `<div class="text-center p-8 bg-surface border border-border rounded-xl text-muted">You do not have an active membership yet. Select a plan below.</div>`;
            }

            // Render Plans Grid
            if (plansRes && plansRes.items) {
                const lang = store.state.lang;
                plansGrid.innerHTML = plansRes.items.filter(p => p.isActive).map(p => {
                    const title = lang === 'ar' ? p.nameAr : p.nameEn;
                    const desc = lang === 'ar' ? p.descriptionAr : p.descriptionEn;
                    return `
            <div class="bg-surface border border-border hover:border-primary rounded-2xl p-6 flex flex-col flex-1 card-hover">
              <div class="text-xs font-bold text-primary uppercase tracking-widest mb-2">${p.tier}</div>
              <h3 class="font-heading font-bold text-2xl text-text mb-4">${title}</h3>
              <p class="text-sm text-muted mb-6 flex-1">${desc || 'Comprehensive care plan.'}</p>
              <div class="text-3xl font-bold text-text mb-6">
                ${p.price} <span class="text-sm font-medium text-muted">JOD / year</span>
              </div>
              <button onclick="window.buyPlan('${p.id}')" class="w-full py-3 bg-primary hover:bg-primary-hover text-white font-bold rounded-xl transition-colors">
                Subscribe Now
              </button>
            </div>
          `;
                }).join('');
            }
        } catch (e) {
            console.error(e);
            myMembershipCard.innerHTML = `<div class="text-danger p-4">Error loading membership data</div>`;
        }

        window.buyPlan = async (planId) => {
            try {
                await apiFetch('/memberships/orders', {
                    method: 'POST',
                    body: { planId }
                });
                window.toast('Successfully subscribed to plan!', 'success');
                window.onMount(); // Reload page state
            } catch (e) {
                window.toast(e.message || 'Error subscribing', 'error');
            }
        };
    };

    return `
    <div class="flex flex-col gap-12 w-full max-w-5xl mx-auto">
      
      <!-- Digital Card Section -->
      <section>
        <div class="mb-6 text-center md:text-left">
          <h1 class="text-3xl font-heading font-bold text-text">Your Digital Card</h1>
          <p class="text-muted mt-2">Present this card at branch reception to instantly apply your benefits.</p>
        </div>
        <div id="my-membership-card" class="w-full max-w-xl md:mx-0 mx-auto">
          <div class="skeleton w-full aspect-[1.6/1] rounded-2xl"></div>
        </div>
      </section>

      <!-- Upgrade / Plans Section -->
      <section>
        <div class="mb-8 text-center">
          <h2 class="text-3xl font-heading font-bold text-text">Membership Plans</h2>
          <p class="text-muted mt-2">Choose the tier that fits your EV needs and enjoy incredible savings.</p>
        </div>
        
        <div id="plans-grid" class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="skeleton h-80 rounded-2xl"></div>
          <div class="skeleton h-80 rounded-2xl"></div>
          <div class="skeleton h-80 rounded-2xl"></div>
        </div>
      </section>

    </div>
  `;
}
