import { apiFetch } from '../../lib/api.js';
import { TableRowSkeleton } from '../../components/ui/Skeleton.js';
import { ConfirmModal } from '../../components/ui/Modal.js';

export function AdminBookings() {

  window.onMount = async () => {
    const tbody = document.getElementById('admin-bookings-tbody');
    let allBookings = [];

    const getStatusStyle = (s) => ({
      PENDING: { classes: 'bg-amber-500/10 text-amber-500 border-amber-500/20', text: 'PENDING' },
      APPROVED: { classes: 'bg-blue-500/10 text-blue-500 border-blue-500/20', text: 'CONFIRMED' },
      COMPLETED: { classes: 'bg-green-500/10 text-green-500 border-green-500/20', text: 'COMPLETED' },
      NO_SHOW: { classes: 'bg-red-500/10 text-red-500 border-red-500/20', text: 'NO SHOW' },
      CANCELLED: { classes: 'bg-gray-500/10 text-gray-500 border-gray-500/20', text: 'CANCELLED' },
      LATE_CANCELLED: { classes: 'bg-gray-500/10 text-gray-500 border-gray-500/20', text: 'CANCELLED' },
      NOT_SERVED: { classes: 'bg-gray-900/10 text-gray-900 border-gray-900/20', text: 'NOT SERVED' }
    })[s] || { classes: 'bg-bg text-text border-border', text: s };

    async function load() {
      tbody.innerHTML = TableRowSkeleton(6).repeat(8);

      try {
        const res = await apiFetch('/admin/bookings');
        if (res && res.items) {
          allBookings = res.items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          renderTable();
        }
      } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-danger">Failed to load bookings</td></tr>`;
      }
    }

    function renderTable() {
      const q = document.getElementById('search-bookings').value.toLowerCase();

      const filtered = allBookings.filter(b =>
        b.id.toLowerCase().includes(q) ||
        (b.customer?.fullName || '').toLowerCase().includes(q) ||
        (b.customer?.phone || '').toLowerCase().includes(q)
      );

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-muted font-medium text-sm">No bookings found</td></tr>`;
        return;
      }

      tbody.innerHTML = filtered.map(b => `
        <tr class="group border-b border-border bg-surface hover:bg-bg transition-colors">
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="font-mono text-xs text-primary font-semibold">${b.id.substring(0, 8)}</div>
            <div class="text-[10px] text-muted">${new Date(b.createdAt).toLocaleDateString()}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-bold text-text">${b.customer?.fullName || 'Unknown'}</div>
            <div class="text-xs text-muted">${b.customer?.phone || '--'}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-semibold text-text truncate max-w-[150px]">${b.serviceNameSnapshotEn}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-medium text-text">${new Date(b.appointmentAt).toLocaleDateString()}</div>
            <div class="text-xs text-text">${new Date(b.appointmentAt).toLocaleTimeString([], { timeStyle: 'short' })}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-3 py-1 rounded-full text-xs font-medium border ${getStatusStyle(b.status).classes}">${getStatusStyle(b.status).text}</span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium pr-6">
            <button class="text-primary hover:text-primary-hover bg-primary/10 hover:bg-primary/20 p-2 rounded-lg transition-colors" onclick="window.manageBooking('${b.id}')">
              Manage
            </button>
          </td>
        </tr>
      `).join('');
    }

    document.getElementById('search-bookings').addEventListener('input', renderTable);

    window.manageBooking = async (id) => {
      let b = allBookings.find(x => x.id === id);
      const m = document.getElementById('manage-modal');
      const mo = document.getElementById('manage-overlay');
      let customerRewards = [];

      mo.classList.remove('hidden');
      m.innerHTML = `<div class="p-12 flex justify-center"><div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>`;
      requestAnimationFrame(() => {
        mo.classList.remove('opacity-0');
        m.classList.remove('scale-95', 'opacity-0');
      });

      try {
        const detailRes = await apiFetch(`/admin/bookings/${id}`);
        if (detailRes && detailRes.item) {
          b = detailRes.item; // includes auditLogs
        }
        const rewardsRes = await apiFetch(`/admin/customers/${b.customerId}/rewards`);
        customerRewards = rewardsRes?.availableRewards || [];
      } catch (e) {
        window.toast('Failed to load booking details', 'error');
        window.closeManage();
        return;
      }
      const actionsHtml = (() => {
        if (b.status === 'PENDING') {
          return `
            <button onclick="window.patchStatus('${b.id}', 'APPROVED')" class="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold transition-colors shadow-sm">Confirm Booking</button>
            <button onclick="window.patchStatus('${b.id}', 'CANCELLED', true)" class="w-full py-2.5 bg-surface border border-border hover:bg-bg text-text rounded-lg font-bold transition-colors">Cancel Booking</button>
          `;
        }
        if (b.status === 'APPROVED') {
          const priceType = b.service?.priceType || b.priceTypeSnapshot || 'FIXED';
          const servicePrice = b.finalPrice || b.service?.basePrice || b.serviceBasePriceSnapshot || '';
          const rewardOptions = ['<option value=\"\">No reward</option>']
            .concat(
              customerRewards.map((reward) => {
                const title = reward.rewardRule?.title || reward.rewardLabel || reward.rewardType;
                const detail =
                  reward.rewardType === 'DISCOUNT_PERCENTAGE'
                    ? `${Number(reward.discountPercentage || 0)}%`
                    : reward.rewardType === 'FIXED_AMOUNT_DISCOUNT'
                      ? `${Number(reward.fixedAmount || 0).toFixed(2)} JOD`
                      : reward.rewardType === 'FREE_SERVICE'
                        ? (reward.rewardService?.nameEn || 'Free service')
                        : (reward.customGiftText || 'Custom gift');
                return `<option value=\"${reward.id}\" data-type=\"${reward.rewardType}\" data-discount=\"${reward.discountPercentage || ''}\" data-fixed=\"${reward.fixedAmount || ''}\">${title} (${detail})</option>`;
              })
            )
            .join('');
          return `
            <div id="complete-form-area" class="space-y-3">
              ${priceType === 'AFTER_INSPECTION' ? `
                <div class="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                  <p class="text-xs font-bold text-amber-500">Inspection Pricing</p>
                  <p class="text-[11px] text-muted mt-1">Final price must be set before completing this booking.</p>
                </div>
                <input id="complete-price" type="number" step="0.01" min="0.01" value="" placeholder="Enter final price (JOD) *" class="w-full bg-bg border border-border text-sm rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary transition-colors" />
              ` : `
                <input id="complete-price" type="number" step="0.01" min="0.01" value="${servicePrice}" class="w-full bg-bg border border-border text-sm rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary transition-colors" placeholder="Final price (JOD)" />
              `}
              <select id="complete-reward" class="w-full bg-bg border border-border text-sm rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary transition-colors">
                ${rewardOptions}
              </select>
              <p class="text-xs text-muted">Optional: apply an available customer reward during completion.</p>
              <textarea id="complete-note" placeholder="Admin note (optional)" class="w-full bg-bg border border-border text-sm rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary transition-colors" rows="2"></textarea>
              <button onclick="window.completeBooking('${b.id}')" class="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-colors shadow-sm">Mark Completed</button>
            </div>
            <div class="flex gap-3">
              <button onclick="window.patchStatus('${b.id}', 'NO_SHOW', true)" class="flex-1 py-2 bg-surface text-amber-500 border border-amber-500/20 hover:bg-amber-500/10 rounded-lg font-bold transition-colors">No Show</button>
              <button onclick="window.patchStatus('${b.id}', 'LATE_CANCELLED', true)" class="flex-1 py-2 bg-surface text-red-500 border border-red-500/20 hover:bg-red-500/10 rounded-lg font-bold transition-colors">Late Cancel</button>
            </div>
            <button onclick="window.patchStatus('${b.id}', 'CANCELLED', true)" class="w-full py-2.5 bg-surface border border-border hover:bg-bg text-text rounded-lg font-bold transition-colors">Cancel Booking</button>
          `;
        }
        return `<div class="text-center text-sm text-muted italic py-2">No actions available in ${b.status} status.</div>`;
      })();

      const auditLogsHtml = (b.auditLogs || []).length > 0 ? b.auditLogs.map(a => `
        <div class="mb-3 last:mb-0 border-l-2 border-primary/20 pl-3">
          <div class="text-xs font-bold text-text">${a.action}</div>
          <div class="text-[10px] text-muted">${new Date(a.createdAt).toLocaleString()} ${a.actor?.fullName ? 'by ' + a.actor.fullName : ''}</div>
          ${a.payload?.note ? `<div class="text-[11px] text-muted mt-0.5 italic">Note: ${a.payload.note}</div>` : ''}
        </div>
      `).join('') : '<div class="text-[11px] italic text-muted">No audit logs found.</div>';

      m.innerHTML = `
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <div class="flex items-center gap-3">
              <h3 class="font-heading font-bold text-xl text-text">Manage Booking</h3>
              <span class="px-3 py-1 text-xs font-medium rounded-full border ${getStatusStyle(b.status).classes}">${getStatusStyle(b.status).text}</span>
            </div>
            <button onclick="window.closeManage()" class="text-muted hover:text-text"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
          </div>
          
          <div class="space-y-4 mb-6 text-sm">
            <div class="flex justify-between border-b border-white/5 pb-2"><span class="text-muted">Customer</span> <span class="font-bold text-text">${b.customer?.fullName || 'Unknown'} (${b.customer?.phone || '--'})</span></div>
            <div class="flex justify-between border-b border-white/5 pb-2"><span class="text-muted">Service</span> <span class="font-bold text-text">${b.serviceNameSnapshotEn}</span></div>
            <div class="flex justify-between border-b border-white/5 pb-2"><span class="text-muted">Schedule</span> <span class="font-bold text-text">${new Date(b.appointmentAt).toLocaleDateString()} ${new Date(b.appointmentAt).toLocaleTimeString([], { timeStyle: 'short' })}</span></div>
            <div class="flex justify-between"><span class="text-muted">Notes</span> <span class="text-right max-w-xs text-text">${b.notes || '<span class="italic text-muted/50">None</span>'}</span></div>
          </div>
          
          <div class="flex flex-col gap-3" id="manage-actions-container">
            ${actionsHtml}
          </div>

          <div class="mt-6 pt-6 border-t border-border">
            <h4 class="text-xs font-bold uppercase tracking-wider text-muted mb-3">Audit Log</h4>
            <div class="max-h-[150px] overflow-y-auto pr-2 saas-scrollbar">
              ${auditLogsHtml}
            </div>
          </div>
        </div>
      `;
    };

    window.closeManage = () => {
      const m = document.getElementById('manage-modal');
      const mo = document.getElementById('manage-overlay');
      mo.classList.add('opacity-0');
      m.classList.add('scale-95', 'opacity-0');
      setTimeout(() => mo.classList.add('hidden'), 300);
    };

    // Complete a booking via dedicated /complete endpoint
    window.completeBooking = async (id) => {
      const priceEl = document.getElementById('complete-price');
      const rewardEl = document.getElementById('complete-reward');
      const noteEl = document.getElementById('complete-note');
      const price = Number(priceEl?.value);
      const note = noteEl?.value?.trim() || undefined;
      const rewardId = rewardEl?.value || undefined;

      if (!price || price <= 0) {
        window.toast('Please enter a valid final price.', 'error');
        return;
      }

      try {
        const container = document.getElementById('manage-actions-container');
        if (container) container.style.opacity = '0.5';

        await apiFetch(`/admin/bookings/${id}/complete`, {
          method: 'POST',
          body: {
            finalPrice: price,
            originalPrice: rewardId ? price : undefined,
            rewardId,
            internalNote: note
          }
        });

        window.toast('Booking completed successfully.', 'success');
        window.closeManage();
        load();
      } catch (e) {
        window.toast(e.message, 'error');
        const container = document.getElementById('manage-actions-container');
        if (container) container.style.opacity = '1';
      }
    };

    window.patchStatus = async (id, newStatus, requiresNote = false) => {
      let body = { status: newStatus };

      if (requiresNote) {
        const note = prompt(`Enter reason for marking as ${newStatus}:`);
        if (note === null) return; // cancelled
        if (note.trim().length < 2) return window.toast('Please provide a valid reason.', 'error');
        body.note = note.trim();
      } else {
        const confirmed = await ConfirmModal({
          title: `Confirm ${newStatus === 'APPROVED' ? 'CONFIRMED' : newStatus}`,
          message: `Are you sure you want to transition this booking to ${newStatus === 'APPROVED' ? 'CONFIRMED' : newStatus}?`,
          intent: 'primary'
        });
        if (!confirmed) return;
      }

      try {
        const container = document.getElementById('manage-actions-container');
        if (container) container.style.opacity = '0.5';

        await apiFetch(`/admin/bookings/${id}`, { method: 'PATCH', body });

        window.toast(`Booking successfully updated.`, 'success');
        window.closeManage();
        load();
      } catch (e) {
        window.toast(e.message, 'error');
        const container = document.getElementById('manage-actions-container');
        if (container) container.style.opacity = '1';
      }
    };

    load();
  };

  return `
    <div class="w-full h-full flex flex-col gap-6">
      
      <!-- Top Actions -->
      <div class="bg-surface border border-border rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 class="text-2xl font-heading font-bold text-text">Booking Operations</h1>
        </div>
        <div class="relative w-full sm:w-80">
          <input type="text" id="search-bookings" placeholder="Search ID, phone, name..." class="w-full bg-bg border border-border text-sm rounded-lg pl-10 pr-4 py-2 text-text focus:outline-none focus:border-primary transition-colors">
          <svg class="w-4 h-4 text-muted absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
      </div>

      <!-- Main Table -->
      <div class="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
        <div class="overflow-x-auto overflow-y-auto block h-full flex-1">
          <table class="w-full text-left min-w-[800px]">
            <thead class="bg-bg border-b border-border sticky top-0 z-10 w-full">
              <tr>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Ref / Date</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Customer</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Service</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Schedule</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right pr-6">Action</th>
              </tr>
            </thead>
            <tbody id="admin-bookings-tbody" class="divide-y divide-border">
              <!-- Rendered via JS -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- Manage Modal Container -->
      <div id="manage-overlay" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm hidden opacity-0 transition-opacity duration-300 flex items-center justify-center p-4">
        <div id="manage-modal" class="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl scale-95 opacity-0 transition-all duration-300 transform">
          <!-- loaded dynamically -->
        </div>
      </div>

    </div>
  `;
}




