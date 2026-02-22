import { apiFetch } from '../../lib/api.js';
import { TableRowSkeleton } from '../../components/ui/Skeleton.js';

export function AdminMemberships() {
  window.onMount = async () => {
    const tbody = document.getElementById('plans-tbody');
    const formContainer = document.getElementById('creation-form-container');
    const createBtn = document.getElementById('create-plan-btn');
    const planForm = document.getElementById('plan-form');

    createBtn.addEventListener('click', () => {
      formContainer.classList.toggle('hidden');
    });

    async function load() {
      tbody.innerHTML = TableRowSkeleton(5).repeat(3);
      try {
        const res = await apiFetch('/memberships/plans');
        if (res && res.items) {
          if (res.items.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-muted font-medium text-sm">No active membership plans found. Click "Create Plan" to add one.</td></tr>`;
          } else {
            tbody.innerHTML = res.items.map(p => `
                            <tr class="group border-b border-border bg-surface hover:bg-bg transition-colors">
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="flex items-center gap-3">
                                      <div class="w-8 h-8 rounded-lg flex items-center justify-center border border-white/10 shadow-sm shrink-0" style="background-color: ${p.color || '#3B82F6'}">
                                        <svg class="w-4 h-4 text-white opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path></svg>
                                      </div>
                                      <div>
                                        <div class="text-sm font-bold text-text">${p.nameEn} <span class="text-[10px] font-bold uppercase tracking-wider ml-1 opacity-70">(${p.tier})</span></div>
                                        <div class="text-[10px] text-muted">${p.nameAr}</div>
                                      </div>
                                    </div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="text-sm font-semibold text-text">${p.price} JOD</div>
                                    <div class="text-[10px] text-muted uppercase tracking-wider">${Math.round(p.durationDays / 30) || 12} Months</div>
                                </td>
                                <td class="px-6 py-4 max-w-xs truncate">
                                    <div class="text-xs text-muted truncate">${p.descriptionEn || '--'}</div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    ${p.isActive
                ? `<span class="px-2.5 py-1 bg-success/15 text-success rounded-md text-[10px] font-bold uppercase tracking-wider">Active</span>`
                : `<span class="px-2.5 py-1 bg-danger/15 text-danger rounded-md text-[10px] font-bold uppercase tracking-wider">Inactive</span>`}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-right pr-6 text-sm">
                                    <button class="text-primary hover:text-primary-hover font-semibold p-2">Edit</button>
                                </td>
                            </tr>
                        `).join('');
          }
        }
      } catch (e) {
        // If endpoint doesn't exist yet, just show empty state
        tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-muted font-medium text-sm">No active membership plans found. Database pending integration.</td></tr>`;
      }
    }

    planForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;

      const body = {
        tier: form.tier.value,
        color: form.color.value,
        nameEn: form.nameEn.value,
        nameAr: form.nameAr.value,
        price: parseFloat(form.price.value),
        durationDays: parseInt(form.durationMonths.value, 10) * 30,
        descriptionEn: form.featuresEn.value,
        descriptionAr: form.featuresAr.value
      };

      try {
        await apiFetch('/memberships/plans', { method: 'POST', body });
        window.toast('Membership Plan created successfully!', 'success');
        form.reset();
        formContainer.classList.add('hidden');
        load();
      } catch (err) {
        window.toast(err.message || 'Failed to create plan', 'error');
      }
    });

    load();
  };

  return `
    <div class="w-full h-full flex flex-col gap-6 fade-in">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface border border-border p-6 rounded-xl shadow-sm">
        <div>
          <h1 class="text-2xl font-heading font-bold text-text">Memberships Management</h1>
          <p class="text-sm text-muted mt-1">View and manage customer membership plans and subscriptions.</p>
        </div>
        <button id="create-plan-btn" class="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-sm flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
          Create Plan
        </button>
      </div>

      <!-- Creation Form -->
      <div id="creation-form-container" class="hidden bg-surface border border-border rounded-xl p-6 shadow-sm">
        <h3 class="font-heading font-bold text-lg mb-4 text-text">Add New Membership Plan</h3>
        <form id="plan-form" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Tier Level</label>
              <input type="text" name="tier" required placeholder="e.g. Platinum" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-primary transition-colors">
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Theme Color</label>
              <input type="color" name="color" value="#3B82F6" class="w-full bg-bg border border-border rounded-lg h-[42px] px-1 py-1 cursor-pointer outline-none focus:border-primary transition-colors">
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Plan Name (EN)</label>
              <input type="text" name="nameEn" required class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-primary transition-colors">
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Plan Name (AR)</label>
              <input type="text" name="nameAr" required class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text text-right outline-none focus:border-primary transition-colors">
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Price (JOD)</label>
              <input type="number" step="0.01" name="price" required class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-primary transition-colors">
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Duration (Months)</label>
              <input type="number" name="durationMonths" required min="1" value="12" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-primary transition-colors">
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Features (EN) - Comma Separated</label>
              <textarea name="featuresEn" rows="2" placeholder="e.g. Free Oil Change, 20% Discount on Labor" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-primary transition-colors resize-none"></textarea>
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Features (AR) - Comma Separated</label>
              <textarea name="featuresAr" rows="2" placeholder="e.g. تغيير زيت مجاني, خصم ٢٠٪" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text right outline-none focus:border-primary transition-colors resize-none text-right"></textarea>
            </div>
          </div>
          <div class="flex justify-end pt-2">
             <button type="submit" class="bg-success hover:bg-green-600 text-white px-8 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-sm">Save Plan</button>
          </div>
        </form>
      </div>

      <!-- Plans Table -->
      <div class="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
        <div class="overflow-x-auto overflow-y-auto block h-full flex-1">
          <table class="w-full text-left min-w-[800px]">
            <thead class="bg-bg border-b border-border sticky top-0 z-10 w-full">
              <tr>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Plan Details</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Price / Duration</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Features</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody id="plans-tbody" class="divide-y divide-border">
            </tbody>
          </table>
        </div>
      </div>

    </div>
    `;
}
