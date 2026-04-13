import { apiFetch } from '../../lib/api.js';
import { TableRowSkeleton } from '../../components/ui/Skeleton.js';
import { ConfirmModal } from '../../components/ui/Modal.js';

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatScheduleDay(dateStr) {
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return '-';
  const now = new Date();
  if (isSameDay(dt, now)) return 'Today';
  return dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatScheduleTime(dateStr) {
  const dt = new Date(dateStr);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getAssignedTechnician(booking) {
  const performedBy = booking?.performedByEmployee?.user?.fullName;
  if (performedBy) return { name: performedBy, meta: 'Performed by' };
  const assigned = booking?.assignments?.[0]?.employee?.user?.fullName;
  if (assigned) return { name: assigned, meta: 'Assigned' };
  return { name: 'Unassigned', meta: 'No technician yet' };
}

export function AdminBookings() {

  window.onMount = async () => {
    const tbody = document.getElementById('admin-bookings-tbody');
    const statsGrid = document.getElementById('booking-stats-grid');
    const cancelReasonOverlay = document.getElementById('booking-cancel-reason-overlay');
    const cancelReasonInput = document.getElementById('booking-cancel-reason-input');
    const cancelReasonError = document.getElementById('booking-cancel-reason-error');
    const cancelReasonConfirmBtn = document.getElementById('booking-cancel-reason-confirm');
    const cancelReasonCloseBtn = document.getElementById('booking-cancel-reason-close');
    const cancelReasonDismissBtn = document.getElementById('booking-cancel-reason-dismiss');
    let allBookings = [];
    let employeeOptions = [];
    const bookingNoteDrafts = new Map();
    let cancelReasonResolver = null;

    const getStatusStyle = (s) => ({
      PENDING: { classes: 'bg-amber-500/10 text-amber-500 border-amber-500/20', text: 'PENDING' },
      APPROVED: { classes: 'bg-blue-500/10 text-blue-500 border-blue-500/20', text: 'CONFIRMED' },
      COMPLETED: { classes: 'bg-green-500/10 text-green-500 border-green-500/20', text: 'COMPLETED' },
      NO_SHOW: { classes: 'bg-red-500/10 text-red-500 border-red-500/20', text: 'NO SHOW' },
      CANCELLED: { classes: 'bg-gray-500/10 text-gray-500 border-gray-500/20', text: 'CANCELLED' },
      LATE_CANCELLED: { classes: 'bg-gray-500/10 text-gray-500 border-gray-500/20', text: 'CANCELLED' },
      NOT_SERVED: { classes: 'bg-gray-900/10 text-gray-900 border-gray-900/20', text: 'NOT SERVED' }
    })[s] || { classes: 'bg-bg text-text border-border', text: s };

    function renderStats(items) {
      const now = new Date();
      const isToday = (value) => {
        const dt = new Date(value);
        return !Number.isNaN(dt.getTime()) && isSameDay(dt, now);
      };
      const todayCount = items.filter((b) => isToday(b.appointmentAt)).length;
      const pendingCount = items.filter((b) => b.status === 'PENDING').length;
      const confirmedCount = items.filter((b) => b.status === 'APPROVED').length;
      const completedCount = items.filter((b) => b.status === 'COMPLETED').length;

      statsGrid.innerHTML = `
        <div class="rounded-xl border border-white/10 bg-bg/20 p-4">
          <div class="text-[10px] uppercase tracking-wider text-muted">Today's bookings</div>
          <div class="mt-2 text-3xl font-bold tabular-nums text-text">${todayCount}</div>
        </div>
        <div class="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div class="text-[10px] uppercase tracking-wider text-amber-400">Pending bookings</div>
          <div class="mt-2 text-3xl font-bold tabular-nums text-amber-400">${pendingCount}</div>
        </div>
        <div class="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
          <div class="text-[10px] uppercase tracking-wider text-blue-400">Confirmed bookings</div>
          <div class="mt-2 text-3xl font-bold tabular-nums text-blue-400">${confirmedCount}</div>
        </div>
        <div class="rounded-xl border border-green-500/20 bg-green-500/10 p-4">
          <div class="text-[10px] uppercase tracking-wider text-green-400">Completed bookings</div>
          <div class="mt-2 text-3xl font-bold tabular-nums text-green-400">${completedCount}</div>
        </div>
      `;
    }

    async function loadEmployeeOptions() {
      if (employeeOptions.length) return employeeOptions;
      const res = await apiFetch('/admin/employees?limit=100');
      employeeOptions = (res?.items || [])
        .map((item) => ({ id: item.id, fullName: item.fullName || 'Employee', roleProfile: item.roleProfile || '' }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
      return employeeOptions;
    }

    async function load() {
      tbody.innerHTML = TableRowSkeleton(7).repeat(8);

      try {
        const res = await apiFetch('/admin/bookings');
        if (res && res.items) {
          allBookings = res.items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } else {
          allBookings = [];
        }
        renderTable();
      } catch (e) {
        renderStats([]);
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-danger">Failed to load bookings</td></tr>`;
      }
    }

    function syncCancelReasonState() {
      const value = cancelReasonInput?.value?.trim() || '';
      cancelReasonConfirmBtn.disabled = !value;
    }

    function closeCancelReasonModal(result = null) {
      cancelReasonOverlay.classList.add('hidden');
      cancelReasonInput.value = '';
      cancelReasonError.classList.add('hidden');
      cancelReasonError.textContent = 'Cancellation reason is required.';
      cancelReasonConfirmBtn.disabled = true;
      const resolver = cancelReasonResolver;
      cancelReasonResolver = null;
      if (resolver) resolver(result);
    }

    function openCancelReasonModal(seed = '') {
      cancelReasonInput.value = seed;
      cancelReasonError.classList.add('hidden');
      cancelReasonError.textContent = 'Cancellation reason is required.';
      syncCancelReasonState();
      cancelReasonOverlay.classList.remove('hidden');
      requestAnimationFrame(() => cancelReasonInput.focus());

      return new Promise((resolve) => {
        cancelReasonResolver = resolve;
      });
    }

    function renderTable() {
      const q = document.getElementById('search-bookings').value.toLowerCase();

      const filtered = allBookings.filter(b =>
        b.id.toLowerCase().includes(q) ||
        (b.customer?.fullName || '').toLowerCase().includes(q) ||
        (b.customer?.phone || '').toLowerCase().includes(q)
      );

      renderStats(filtered);

      if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-muted font-medium text-sm">No bookings found</td></tr>`;
        return;
      }

      tbody.innerHTML = filtered.map(b => `
        <tr class="group border-b border-border bg-surface hover:bg-slate-800/40 transition-colors">
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
            <div class="text-sm font-semibold text-text">${getAssignedTechnician(b).name}</div>
            <div class="text-xs text-muted">${getAssignedTechnician(b).meta}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-medium text-text">${formatScheduleDay(b.appointmentAt)}</div>
            <div class="text-xs text-text">${formatScheduleTime(b.appointmentAt)}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-3 py-1 rounded-full text-xs font-medium border ${getStatusStyle(b.status).classes}">${getStatusStyle(b.status).text}</span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium pr-6">
            <div class="inline-flex items-center gap-2">
              <button class="px-2.5 py-1.5 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 text-xs font-semibold hover:bg-green-500/20 transition-colors ${b.status !== 'PENDING' ? 'opacity-50 cursor-not-allowed' : ''}" ${b.status !== 'PENDING' ? 'disabled' : ''} onclick="window.quickConfirmBooking('${b.id}')">Confirm</button>
              <button class="px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors ${!['PENDING','APPROVED'].includes(b.status) ? 'opacity-50 cursor-not-allowed' : ''}" ${!['PENDING','APPROVED'].includes(b.status) ? 'disabled' : ''} onclick="window.quickCancelBooking('${b.id}')">Cancel</button>
              <button class="px-2.5 py-1.5 rounded-lg border border-border bg-bg text-text text-xs font-semibold hover:bg-slate-800/50 transition-colors" onclick="window.manageBooking('${b.id}')">View</button>
            </div>
          </td>
        </tr>
      `).join('');
    }

    document.getElementById('search-bookings').addEventListener('input', renderTable);
    cancelReasonInput.addEventListener('input', () => {
      cancelReasonError.classList.add('hidden');
      syncCancelReasonState();
    });
    cancelReasonCloseBtn.addEventListener('click', () => closeCancelReasonModal(null));
    cancelReasonDismissBtn.addEventListener('click', () => closeCancelReasonModal(null));
    cancelReasonOverlay.addEventListener('click', (event) => {
      if (event.target === cancelReasonOverlay) {
        closeCancelReasonModal(null);
      }
    });
    cancelReasonConfirmBtn.addEventListener('click', () => {
      const reason = cancelReasonInput.value.trim();
      if (!reason) {
        cancelReasonError.classList.remove('hidden');
        cancelReasonError.textContent = 'Cancellation reason is required.';
        cancelReasonConfirmBtn.disabled = true;
        return;
      }
      closeCancelReasonModal(reason);
    });
    const onCancelReasonEscape = (event) => {
      if (event.key === 'Escape' && !cancelReasonOverlay.classList.contains('hidden')) {
        closeCancelReasonModal(null);
      }
    };
    document.addEventListener('keydown', onCancelReasonEscape);

    window.manageBooking = async (id) => {
      const listSnapshot = allBookings.find((x) => x.id === id);
      let b = listSnapshot;
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
        const [detailRes, employeesRes] = await Promise.all([
          apiFetch(`/admin/bookings/${id}`),
          loadEmployeeOptions()
        ]);
        void employeesRes;
        if (detailRes && detailRes.item) {
          b = {
            ...(listSnapshot || {}),
            ...detailRes.item,
            assignments: listSnapshot?.assignments || detailRes.item.assignments || [],
            performedByEmployee: listSnapshot?.performedByEmployee || detailRes.item.performedByEmployee || null
          };
        }
        const rewardsRes = await apiFetch(`/admin/customers/${b.customerId}/rewards`);
        customerRewards = rewardsRes?.availableRewards || [];
      } catch (e) {
        window.toast('Failed to load booking details', 'error');
        window.closeManage();
        return;
      }

      const currentTechnician = getAssignedTechnician(b);
      const employeeOptionsHtml = employeeOptions.length
        ? employeeOptions
            .map((emp) => `<option value="${emp.id}">${emp.fullName}${emp.roleProfile ? ` (${emp.roleProfile})` : ''}</option>`)
            .join('')
        : '<option value="">No active employees available</option>';

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
            return `<option value=\"${reward.id}\">${title} (${detail})</option>`;
          })
        )
        .join('');

      const statusTimeline = (b.auditLogs || []).map((a) => {
        const from = a?.payload?.from ? String(a.payload.from).replaceAll('_', ' ') : null;
        const to = a?.payload?.to ? String(a.payload.to).replaceAll('_', ' ') : null;
        const label = from && to ? `Booking ${from.toLowerCase()} -> ${to.toLowerCase()}` : 'Booking status updated';
        return {
          at: a.createdAt,
          actor: a.actor?.fullName || null,
          label,
          note: a?.payload?.note || null
        };
      });

      const assignmentTimeline = (b.assignments || []).map((row) => ({
        at: row.createdAt || b.updatedAt || b.createdAt,
        actor: row.employee?.user?.fullName || null,
        label: `Technician assigned${row.employee?.user?.fullName ? `: ${row.employee.user.fullName}` : ''}`,
        note: row.note || null
      }));

      const timeline = [
        {
          at: b.createdAt,
          actor: b.createdByUserId ? 'Staff' : null,
          label: 'Booking created',
          note: b.notes || null
        },
        ...statusTimeline,
        ...assignmentTimeline,
        ...(b.status === 'COMPLETED' ? [{ at: b.completedAt || b.updatedAt || b.appointmentAt, actor: b.performedByEmployee?.user?.fullName || null, label: 'Service completed', note: null }] : [])
      ]
        .filter((item) => item.at)
        .sort((x, y) => new Date(x.at) - new Date(y.at));

      const auditLogsHtml = timeline.length > 0
        ? timeline
            .map((a) => `
              <div class="mb-3 last:mb-0 rounded-lg border border-white/10 bg-bg/30 px-3 py-2">
                <div class="text-xs font-semibold text-text">${a.label}</div>
                <div class="mt-1 text-[10px] text-muted">${new Date(a.at).toLocaleString()}${a.actor ? ` · ${a.actor}` : ''}</div>
                ${a.note ? `<div class="mt-1 text-[11px] text-muted italic">Note: ${a.note}</div>` : ''}
              </div>
            `)
            .join('')
        : '<div class="text-[11px] italic text-muted">No operational events found.</div>';

      const noteDraft = bookingNoteDrafts.get(b.id) || b.notes || '';

      m.innerHTML = `
        <div class="p-6 max-h-[85vh] overflow-y-auto">
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
            <div class="flex justify-between border-b border-white/5 pb-2"><span class="text-muted">Technician</span> <span class="font-bold text-text">${currentTechnician.name}</span></div>
            <div class="flex justify-between border-b border-white/5 pb-2"><span class="text-muted">Schedule</span> <span class="font-bold text-text">${formatScheduleDay(b.appointmentAt)} ${formatScheduleTime(b.appointmentAt)}</span></div>
            <div class="flex justify-between"><span class="text-muted">Notes</span> <span class="text-right max-w-xs text-text">${b.notes || '<span class="italic text-muted/50">None</span>'}</span></div>
          </div>

          <div id="manage-actions-container" class="space-y-4">
            <section class="rounded-xl border border-white/10 bg-bg/30 p-4">
              <h4 class="text-xs font-bold uppercase tracking-wider text-muted mb-3">Operational Actions</h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button onclick="window.patchStatus('${b.id}', 'APPROVED')" class="rounded-lg px-3 py-2.5 text-sm font-semibold border border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors ${b.status !== 'PENDING' ? 'opacity-50 cursor-not-allowed' : ''}" ${b.status !== 'PENDING' ? 'disabled' : ''}>Confirm booking</button>
                <button onclick="window.patchStatus('${b.id}', 'CANCELLED', true)" class="rounded-lg px-3 py-2.5 text-sm font-semibold border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors ${!['PENDING', 'APPROVED'].includes(b.status) ? 'opacity-50 cursor-not-allowed' : ''}" ${!['PENDING', 'APPROVED'].includes(b.status) ? 'disabled' : ''}>Cancel booking</button>
              </div>
            </section>

            <section class="rounded-xl border border-white/10 bg-bg/30 p-4">
              <h4 class="text-xs font-bold uppercase tracking-wider text-muted mb-3">Assign Technician</h4>
              <div class="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
                <select id="assign-tech-id" class="w-full bg-bg border border-border text-sm rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary transition-colors">
                  <option value="">Select technician</option>
                  ${employeeOptionsHtml}
                </select>
                <input id="assign-tech-note" type="text" placeholder="Assignment note (optional)" class="w-full bg-bg border border-border text-sm rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary transition-colors" />
                <button onclick="window.assignTechnician('${b.id}')" class="rounded-lg px-3 py-2 text-sm font-semibold border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors">Assign</button>
              </div>
            </section>

            <section class="rounded-xl border border-white/10 bg-bg/30 p-4">
              <h4 class="text-xs font-bold uppercase tracking-wider text-muted mb-3">Reschedule Booking</h4>
              <div class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                <input id="reschedule-datetime" type="datetime-local" class="w-full bg-bg border border-border text-sm rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary transition-colors" />
                <button onclick="window.rescheduleBooking('${b.id}')" class="rounded-lg px-3 py-2 text-sm font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors ${!['PENDING','APPROVED'].includes(b.status) ? 'opacity-50 cursor-not-allowed' : ''}" ${!['PENDING','APPROVED'].includes(b.status) ? 'disabled' : ''}>Reschedule</button>
              </div>
              <p class="mt-2 text-[11px] text-muted">Reschedule creates a replacement booking using the selected slot, then cancels this booking.</p>
            </section>

            <section class="rounded-xl border border-white/10 bg-bg/30 p-4">
              <h4 class="text-xs font-bold uppercase tracking-wider text-muted mb-3">Update Notes</h4>
              <textarea id="booking-note-draft" rows="2" class="w-full bg-bg border border-border text-sm rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary transition-colors" placeholder="Operational notes for your next action">${noteDraft}</textarea>
              <div class="mt-2">
                <button onclick="window.saveBookingNoteDraft('${b.id}')" class="rounded-lg px-3 py-2 text-sm font-semibold border border-border bg-bg text-text hover:bg-slate-800/50 transition-colors">Save Note Draft</button>
              </div>
              <p class="mt-2 text-[11px] text-muted">This note is reused in cancel/reschedule/complete actions in this session.</p>
            </section>

            ${
              b.status === 'APPROVED'
                ? `
                  <section class="rounded-xl border border-white/10 bg-bg/30 p-4">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-muted mb-3">Complete Service</h4>
                    ${priceType === 'AFTER_INSPECTION' ? `
                      <div class="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 mb-3">
                        <p class="text-xs font-bold text-amber-500">Inspection pricing required</p>
                        <p class="text-[11px] text-muted mt-1">Final price must be set before completion.</p>
                      </div>
                    ` : ''}
                    <div class="space-y-3">
                      <input id="complete-price" type="number" step="0.01" min="0.01" value="${priceType === 'AFTER_INSPECTION' ? '' : servicePrice}" placeholder="Final price (JOD)" class="w-full bg-bg border border-border text-sm rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary transition-colors" />
                      <select id="complete-reward" class="w-full bg-bg border border-border text-sm rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary transition-colors">
                        ${rewardOptions}
                      </select>
                      <textarea id="complete-note" placeholder="Completion note (optional)" class="w-full bg-bg border border-border text-sm rounded-lg px-3 py-2 text-text focus:outline-none focus:border-primary transition-colors" rows="2">${noteDraft}</textarea>
                      <button onclick="window.completeBooking('${b.id}')" class="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-colors shadow-sm">Complete service</button>
                    </div>
                  </section>
                `
                : ''
            }
          </div>

          <div class="mt-6 pt-6 border-t border-border">
            <h4 class="text-xs font-bold uppercase tracking-wider text-muted mb-3">Audit Log</h4>
            <div class="max-h-[180px] overflow-y-auto pr-2 saas-scrollbar">
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
        const draftFromModal = document.getElementById('booking-note-draft')?.value?.trim();
        const noteSeed = draftFromModal || bookingNoteDrafts.get(id) || '';
        const note = await openCancelReasonModal(noteSeed);
        if (note == null) return;
        if (!note.trim()) return;
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

    window.quickConfirmBooking = async (id) => {
      await window.patchStatus(id, 'APPROVED', false);
    };

    window.quickCancelBooking = async (id) => {
      await window.patchStatus(id, 'CANCELLED', true);
    };

    window.saveBookingNoteDraft = (id) => {
      const note = document.getElementById('booking-note-draft')?.value?.trim() || '';
      bookingNoteDrafts.set(id, note);
      window.toast('Operational note draft saved for this booking.', 'success');
    };

    window.assignTechnician = async (id) => {
      const employeeId = document.getElementById('assign-tech-id')?.value;
      const note = document.getElementById('assign-tech-note')?.value?.trim() || undefined;
      if (!employeeId) {
        window.toast('Please choose a technician first.', 'error');
        return;
      }
      try {
        await apiFetch(`/bookings/${id}/assign-employee`, {
          method: 'POST',
          body: { employeeId, note }
        });
        window.toast('Technician assigned successfully.', 'success');
        await load();
        await window.manageBooking(id);
      } catch (e) {
        window.toast(e.message, 'error');
      }
    };

    window.rescheduleBooking = async (id) => {
      const booking = allBookings.find((row) => row.id === id);
      const nextAtRaw = document.getElementById('reschedule-datetime')?.value;
      if (!booking) {
        window.toast('Booking not found in current list.', 'error');
        return;
      }
      if (!nextAtRaw) {
        window.toast('Please choose the new schedule date/time.', 'error');
        return;
      }

      const nextAt = new Date(nextAtRaw);
      if (Number.isNaN(nextAt.getTime())) {
        window.toast('Invalid reschedule date/time.', 'error');
        return;
      }

      const noteDraft = document.getElementById('booking-note-draft')?.value?.trim() || bookingNoteDrafts.get(id) || '';
      const cancelReason = noteDraft || `Rescheduled to ${nextAt.toLocaleString()}`;

      try {
        await apiFetch('/bookings', {
          method: 'POST',
          body: {
            serviceId: booking.serviceId,
            customerId: booking.customerId,
            appointmentAt: nextAt.toISOString(),
            notes: noteDraft || booking.notes || undefined
          }
        });

        await apiFetch(`/admin/bookings/${id}`, {
          method: 'PATCH',
          body: {
            status: 'CANCELLED',
            note: cancelReason
          }
        });

        window.toast('Booking rescheduled by creating a replacement booking and canceling this one.', 'success');
        window.closeManage();
        await load();
      } catch (e) {
        window.toast(e.message, 'error');
      }
    };

    window.__pageCleanup = () => {
      document.removeEventListener('keydown', onCancelReasonEscape);
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

      <div id="booking-stats-grid" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3"></div>

      <!-- Main Table -->
      <div class="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
        <div class="overflow-x-auto overflow-y-auto block h-full flex-1">
          <table class="w-full text-left min-w-[980px]">
            <thead class="bg-bg border-b border-border sticky top-0 z-10 w-full">
              <tr>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Ref</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Customer</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Service</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Technician</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Schedule</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right pr-6">Actions</th>
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
        <div id="manage-modal" class="bg-surface border border-border rounded-2xl w-full max-w-3xl shadow-2xl scale-95 opacity-0 transition-all duration-300 transform">
          <!-- loaded dynamically -->
        </div>
      </div>

      <!-- Cancel Reason Modal -->
      <div id="booking-cancel-reason-overlay" class="fixed inset-0 z-[60] hidden flex items-center justify-center bg-black/70 p-4">
        <div class="w-full max-w-md rounded-xl border border-white/10 bg-surface p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-bold text-text">Cancel Booking</h3>
              <p class="mt-1 text-sm text-muted">Enter the reason for cancelling this booking.</p>
            </div>
            <button id="booking-cancel-reason-close" type="button" class="rounded-lg border border-border bg-bg px-2 py-1 text-xs font-semibold text-text hover:bg-slate-800/50 transition-colors">Close</button>
          </div>
          <div class="mt-4">
            <textarea id="booking-cancel-reason-input" rows="4" class="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary transition-colors" placeholder="Cancellation reason"></textarea>
            <p id="booking-cancel-reason-error" class="mt-2 hidden text-xs text-danger">Cancellation reason is required.</p>
          </div>
          <div class="mt-5 flex items-center justify-end gap-2">
            <button id="booking-cancel-reason-dismiss" type="button" class="rounded-lg border border-border bg-bg px-4 py-2 text-sm font-semibold text-text hover:bg-slate-800/50 transition-colors">Cancel</button>
            <button id="booking-cancel-reason-confirm" type="button" class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled>Confirm Cancel</button>
          </div>
        </div>
      </div>

    </div>
  `;
}




