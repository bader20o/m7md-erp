import { apiFetch } from '../../lib/api.js';
import { TableRowSkeleton } from '../../components/ui/Skeleton.js';
import { store } from '../../lib/store.js';
import { t } from '../../lib/i18n.js';

const NOT_SET_PRICE_LABEL = '\u063A\u064A\u0631 \u0645\u062D\u062F\u062F';

export function MyBookings() {

    window.onMount = async () => {
        const tbody = document.getElementById('bookings-tbody');
        const drawer = document.getElementById('booking-drawer');
        const drawerOverlay = document.getElementById('drawer-overlay');
        let allBookings = [];

        // Load
        tbody.innerHTML = TableRowSkeleton(5) + TableRowSkeleton(5) + TableRowSkeleton(5);

        try {
            const res = await apiFetch('/bookings');
            if (res && res.items) {
                allBookings = res.items.sort((a, b) => new Date(b.appointmentAt) - new Date(a.appointmentAt));
                renderTable(allBookings);
            } else {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-muted">No bookings found</td></tr>`;
            }
        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-danger">${t('common.error')}</td></tr>`;
        }

        // Filter logic
        document.getElementById('status-filter').addEventListener('change', (e) => {
            const status = e.target.value;
            if (status === 'ALL') renderTable(allBookings);
            else renderTable(allBookings.filter(b => b.status === status));
        });

        function renderTable(bookings) {
            if (bookings.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-muted">No bookings match this filter</td></tr>`;
                return;
            }

            const lang = store.state.lang;

            const statusColors = {
                PENDING: 'bg-orange-500/10 text-orange-500',
                APPROVED: 'bg-primary/10 text-primary',
                COMPLETED: 'bg-success/10 text-success',
                CANCELLED: 'bg-danger/10 text-danger',
                NO_SHOW: 'bg-gray-500/10 text-gray-500',
                NOT_SERVED: 'bg-red-900/10 text-red-900'
            };

            tbody.innerHTML = bookings.map(b => {
                const title = lang === 'ar' ? b.serviceNameSnapshotAr : b.serviceNameSnapshotEn;
                const d = new Date(b.appointmentAt);
                const color = statusColors[b.status] || 'bg-muted/10 text-muted';
                const hasFinalPrice = b.finalPrice !== null && b.finalPrice !== undefined;
                const hasBasePrice = b.serviceBasePriceSnapshot !== null && b.serviceBasePriceSnapshot !== undefined;
                const displayPrice = hasFinalPrice
                    ? `${b.finalPrice} JOD`
                    : hasBasePrice
                        ? `${b.serviceBasePriceSnapshot} JOD (Est)`
                        : NOT_SET_PRICE_LABEL;

                return `
          <tr class="border-b border-border hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group" onclick="window.openBookingDrawer('${b.id}')">
            <td class="px-6 py-4 whitespace-nowrap"><div class="text-sm font-semibold text-text">${b.id.substring(0, 8)}</div></td>
            <td class="px-6 py-4 whitespace-nowrap">
               <div class="text-sm font-bold text-text group-hover:text-primary transition-colors">${title}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm text-text">${d.toLocaleDateString()}</div>
              <div class="text-xs text-muted">${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="px-2.5 py-1 text-xs font-bold rounded-full ${color} uppercase tracking-wider">${b.status}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="text-base font-extrabold ${displayPrice === NOT_SET_PRICE_LABEL ? 'text-muted' : 'text-primary'}">${displayPrice}</span>
            </td>
          </tr>
        `;
            }).join('');
        }

        // Drawer Logic
        window.openBookingDrawer = (id) => {
            const b = allBookings.find(x => x.id === id);
            if (!b) return;

            const lang = store.state.lang;
            const title = lang === 'ar' ? b.serviceNameSnapshotAr : b.serviceNameSnapshotEn;
            const d = new Date(b.appointmentAt);

            document.getElementById('drawer-id').textContent = b.id;
            document.getElementById('drawer-service').textContent = title;
            document.getElementById('drawer-datetime').textContent = `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            document.getElementById('drawer-status').textContent = b.status;
            const hasFinalPrice = b.finalPrice !== null && b.finalPrice !== undefined;
            const hasBasePrice = b.serviceBasePriceSnapshot !== null && b.serviceBasePriceSnapshot !== undefined;
            document.getElementById('drawer-price').textContent = hasFinalPrice
                ? `${b.finalPrice} JOD`
                : hasBasePrice
                    ? `${b.serviceBasePriceSnapshot} JOD (Estimated)`
                    : NOT_SET_PRICE_LABEL;
            document.getElementById('drawer-notes').textContent = b.notes || 'None';

            const cancelBtn = document.getElementById('drawer-cancel-btn');
            if (['PENDING', 'APPROVED'].includes(b.status)) {
                cancelBtn.classList.remove('hidden');
                cancelBtn.onclick = () => window.cancelBooking(id);
            } else {
                cancelBtn.classList.add('hidden');
            }

            drawerOverlay.classList.remove('opacity-0', 'pointer-events-none');
            drawer.classList.remove('translate-x-full');
        };

        window.closeBookingDrawer = () => {
            drawerOverlay.classList.add('opacity-0', 'pointer-events-none');
            drawer.classList.add('translate-x-full');
        };

        window.cancelBooking = async (id) => {
            if (confirm('Are you sure you want to cancel this booking?')) {
                try {
                    await apiFetch(`/bookings/${id}/cancel`, {
                        method: 'POST',
                        body: { cancelReason: 'Customer requested cancellation' }
                    });
                    window.toast('Booking cancelled', 'success');
                    window.closeBookingDrawer();
                    window.onMount(); // refetch
                } catch (e) {
                    window.toast(e.message || 'Failed to cancel', 'error');
                }
            }
        };
    };

    return `
    <div class="flex flex-col h-full gap-6 w-full max-w-6xl mx-auto relative overflow-x-hidden">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-2xl md:text-3xl font-heading font-bold text-text">Booking History</h1>
          <p class="text-muted mt-1">View and manage your past and upcoming service appointments.</p>
        </div>
        <select id="status-filter" class="w-full sm:w-auto px-4 py-2 bg-surface text-text border border-border rounded-lg outline-none focus:border-primary transition-colors text-sm font-medium">
          <option value="ALL">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <!-- Desktop Table / Mobile Cards -->
      <div class="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left">
            <thead class="bg-black/5 dark:bg-white/5 border-b border-border">
              <tr>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">ID</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Service</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Date & Time</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Price</th>
              </tr>
            </thead>
            <tbody id="bookings-tbody" class="divide-y divide-border">
              <!-- Rendered via JS -->
            </tbody>
          </table>
        </div>
      </div>

      <!-- Detail Drawer Overlay -->
      <div id="drawer-overlay" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 opacity-0 pointer-events-none transition-opacity duration-300" onclick="closeBookingDrawer()"></div>
      
      <!-- Detail Drawer -->
      <div id="booking-drawer" class="fixed inset-y-0 right-0 w-full max-w-md bg-surface shadow-2xl z-50 transform translate-x-full transition-transform duration-300 flex flex-col border-l border-border">
        <div class="flex items-center justify-between p-6 border-b border-border">
          <h3 class="font-heading font-bold text-xl text-text">Booking Details</h3>
          <button onclick="closeBookingDrawer()" class="p-2 text-muted hover:text-text rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        <div class="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
             <p class="text-xs text-muted uppercase tracking-wider font-semibold mb-1">Booking ID</p>
             <p id="drawer-id" class="text-sm font-medium text-text font-mono"></p>
          </div>
          <div>
             <p class="text-xs text-muted uppercase tracking-wider font-semibold mb-1">Service</p>
             <p id="drawer-service" class="text-lg font-bold text-text"></p>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
               <p class="text-xs text-muted uppercase tracking-wider font-semibold mb-1">Date & Time</p>
               <p id="drawer-datetime" class="text-sm font-medium text-text"></p>
            </div>
            <div>
               <p class="text-xs text-muted uppercase tracking-wider font-semibold mb-1">Status</p>
               <p id="drawer-status" class="text-sm font-bold text-text"></p>
            </div>
          </div>
          <div>
             <p class="text-xs text-muted uppercase tracking-wider font-semibold mb-1">Price</p>
             <p id="drawer-price" class="text-lg font-bold text-primary"></p>
          </div>
          <div>
             <p class="text-xs text-muted uppercase tracking-wider font-semibold mb-1">Customer Notes</p>
             <div id="drawer-notes" class="bg-bg border border-border p-4 rounded-xl text-sm text-text whitespace-pre-wrap"></div>
          </div>
        </div>

        <div class="p-6 border-t border-border bg-black/5 dark:bg-white/5 space-y-3">
          <button id="drawer-cancel-btn" class="w-full py-3 bg-surface border border-danger text-danger hover:bg-danger hover:text-white rounded-xl font-bold transition-all hidden">Cancel Booking</button>
          <button class="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover transition-all shadow-md" onclick="navigate(event, '/chat')">Contact Support</button>
        </div>
      </div>

    </div>
  `;
}
