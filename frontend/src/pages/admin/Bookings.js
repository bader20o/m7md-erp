import { apiFetch } from '../../lib/api.js';
import { TableRowSkeleton } from '../../components/ui/Skeleton.js';
import { ConfirmModal } from '../../components/ui/Modal.js';

export function AdminBookings() {

  window.onMount = async () => {
    const tbody = document.getElementById('admin-bookings-tbody');
    let allBookings = [];

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

      const getStatusColor = (s) => ({
        PENDING: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
        APPROVED: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        COMPLETED: 'bg-green-500/10 text-green-500 border-green-500/20',
        CANCELLED: 'bg-red-500/10 text-red-500 border-red-500/20',
        LATE_CANCELLED: 'bg-red-800/10 text-red-800 border-red-800/20',
        NO_SHOW: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
        NOT_SERVED: 'bg-gray-900/10 text-gray-900 border-gray-900/20'
      })[s] || 'bg-bg text-text border-border';

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
            <div class="text-[10px] text-muted">${b.serviceBasePriceSnapshot} JOD</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-medium text-text">${new Date(b.appointmentAt).toLocaleDateString()}</div>
            <div class="text-xs text-text">${new Date(b.appointmentAt).toLocaleTimeString([], { timeStyle: 'short' })}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(b.status)}">${b.status}</span>
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

    window.manageBooking = (id) => {
      const b = allBookings.find(x => x.id === id);
      const m = document.getElementById('manage-modal');
      const mo = document.getElementById('manage-overlay');

      let actionsHtml = '';

      if (b.status === 'PENDING') {
        actionsHtml = `
          <button onclick="window.bAction('${id}', 'approve')" class="flex-1 bg-primary text-white py-2 rounded font-bold hover:bg-primary-hover shadow-sm">Approve</button>
          <button onclick="window.bAction('${id}', 'reject')" class="flex-1 bg-surface border border-danger text-danger py-2 rounded font-bold hover:bg-danger/10">Reject</button>
        `;
      } else if (b.status === 'APPROVED') {
        actionsHtml = `
          <button onclick="window.bComplete('${id}')" class="w-full bg-success text-white py-2 rounded font-bold hover:bg-green-600 shadow-sm mb-3">Complete Servicing</button>
          <div class="grid grid-cols-2 gap-3">
            <button onclick="window.bAction('${id}', 'no-show')" class="bg-surface border border-border text-text py-1.5 text-sm rounded font-medium hover:bg-bg">No Show</button>
            <button onclick="window.bAction('${id}', 'cancel')" class="bg-surface border border-danger text-danger py-1.5 text-sm rounded font-medium hover:bg-danger/10">Cancel</button>
          </div>
        `;
      } else {
        actionsHtml = `<div class="text-center text-sm font-medium text-muted bg-bg py-3 border border-border rounded-lg">No actions available (Terminal Status)</div>`;
      }

      m.innerHTML = `
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h3 class="font-heading font-bold text-xl text-text">Manage Booking</h3>
            <button onclick="window.closeManage()" class="text-muted hover:text-text"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
          </div>
          
          <div class="space-y-4 mb-8 text-sm">
            <div class="flex justify-between border-b border-border pb-2"><span class="text-muted">ID</span> <span class="font-mono text-text">${b.id}</span></div>
            <div class="flex justify-between border-b border-border pb-2"><span class="text-muted">Customer</span> <span class="font-bold text-text">${b.customer?.fullName} (${b.customer?.phone})</span></div>
            <div class="flex justify-between border-b border-border pb-2"><span class="text-muted">Service</span> <span class="font-bold text-text">${b.serviceNameSnapshotEn}</span></div>
            <div class="flex justify-between border-b border-border pb-2"><span class="text-muted">Schedule</span> <span class="font-bold text-text">${new Date(b.appointmentAt).toLocaleString()}</span></div>
            <div class="flex justify-between"><span class="text-muted">Notes</span> <span class="text-right max-w-xs text-text">${b.notes || '-'}</span></div>
          </div>
          
          <div class="flex flex-col gap-3">
            ${actionsHtml}
          </div>
        </div>
      `;

      mo.classList.remove('hidden');
      requestAnimationFrame(() => {
        mo.classList.remove('opacity-0');
        m.classList.remove('scale-95', 'opacity-0');
      });
    };

    window.closeManage = () => {
      const m = document.getElementById('manage-modal');
      const mo = document.getElementById('manage-overlay');
      mo.classList.add('opacity-0');
      m.classList.add('scale-95', 'opacity-0');
      setTimeout(() => mo.classList.add('hidden'), 300);
    };

    window.bAction = async (id, action) => {
      let body = {};
      if (['reject', 'cancel', 'late-cancel'].includes(action)) {
        const reason = prompt(`Enter ${action} reason (optional):`);
        if (reason === null) return; // User cancelled prompt
        body = { [`${action === 'reject' ? 'rejectReason' : 'cancelReason'}`]: reason };
      }

      const confirmed = await ConfirmModal({
        title: `Confirm ${action.toUpperCase()}`,
        message: `Are you sure you want to perform '${action}' on this booking?`,
        intent: ['reject', 'cancel', 'late-cancel', 'not-served', 'no-show'].includes(action) ? 'danger' : 'primary'
      });

      if (!confirmed) return;

      try {
        await apiFetch(`/admin/bookings/${id}/${action}`, { method: 'POST', body });
        window.toast(`Booking ${action} successful`, 'success');
        window.closeManage();
        load();
      } catch (e) {
        window.toast(e.message, 'error');
      }
    };

    window.bComplete = async (id) => {
      const priceStr = prompt('Enter final price for this service (JOD):');
      if (priceStr === null) return;
      const finalPrice = parseFloat(priceStr);
      if (isNaN(finalPrice) || finalPrice < 0) return window.toast('Invalid price', 'error');

      const confirmed = await ConfirmModal({
        title: `Complete Service`,
        message: `Are you sure you want to complete this booking for ${finalPrice} JOD? This will create an accounting transaction.`,
        intent: 'primary'
      });

      if (!confirmed) return;

      try {
        await apiFetch(`/admin/bookings/${id}/complete`, {
          method: 'POST',
          body: { finalPrice, internalNote: 'Completed via UI' }
        });
        window.toast(`Booking completed globally!`, 'success');
        window.closeManage();
        load();
      } catch (e) {
        window.toast(e.message, 'error');
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
