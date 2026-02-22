import { apiFetch } from '../../lib/api.js';
import { TableRowSkeleton, CardSkeleton } from '../../components/ui/Skeleton.js';

export function AdminEmployees() {

  window.onMount = async () => {
    const listTab = document.getElementById('tab-list');
    const attTab = document.getElementById('tab-attendance');
    const listContent = document.getElementById('content-list');
    const attContent = document.getElementById('content-attendance');
    const tbodyEmp = document.getElementById('emp-tbody');
    const tbodyAtt = document.getElementById('att-tbody');

    // Tab Switching
    listTab.addEventListener('click', () => {
      listTab.classList.add('border-primary', 'text-primary'); listTab.classList.remove('border-transparent', 'text-muted');
      attTab.classList.add('border-transparent', 'text-muted'); attTab.classList.remove('border-primary', 'text-primary');
      listContent.classList.remove('hidden'); attContent.classList.add('hidden');
      loadEmployees();
    });

    attTab.addEventListener('click', () => {
      attTab.classList.add('border-primary', 'text-primary'); attTab.classList.remove('border-transparent', 'text-muted');
      listTab.classList.add('border-transparent', 'text-muted'); listTab.classList.remove('border-primary', 'text-primary');
      attContent.classList.remove('hidden'); listContent.classList.add('hidden');
      loadAttendance();
    });

    async function loadEmployees() {
      tbodyEmp.innerHTML = TableRowSkeleton(5).repeat(3);
      try {
        const res = await apiFetch('/employees');
        if (res && res.items && res.items.length > 0) {
          tbodyEmp.innerHTML = res.items.map(e => `
            <tr class="group border-b border-border bg-surface hover:bg-bg transition-colors">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-bold text-text">${e.user?.fullName}</div>
                <div class="text-xs text-muted">${e.user?.phone}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-text">${e.jobTitle || '--'}</td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-text font-mono">${e.monthlyBase ? `${e.monthlyBase} JOD` : '--'}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                 ${e.isActive
              ? `<span class="px-2.5 py-1 bg-success/15 text-success rounded-md text-[10px] font-bold uppercase tracking-wider">Active</span>`
              : `<span class="px-2.5 py-1 bg-danger/15 text-danger rounded-md text-[10px] font-bold uppercase tracking-wider">Inactive</span>`}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
                <button class="text-primary font-semibold hover:underline" onclick="window.viewQr('${e.id}')">View QR</button>
              </td>
            </tr>
          `).join('');
        } else {
          tbodyEmp.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-muted text-sm font-medium">No employees found. Click "Add Employee" to start.</td></tr>`;
        }
      } catch (e) {
        tbodyEmp.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-danger text-sm font-medium">Failed to load employees.</td></tr>`;
      }
    }

    async function loadAttendance() {
      tbodyAtt.innerHTML = TableRowSkeleton(4).repeat(5);
      try {
        const res = await apiFetch('/employees/attendance');
        if (res && res.items && res.items.length > 0) {
          tbodyAtt.innerHTML = res.items.map(a => {
            const inDate = new Date(a.checkInAt);
            const outDate = a.checkOutAt ? new Date(a.checkOutAt) : null;
            return `
              <tr class="group border-b border-border bg-surface hover:bg-bg transition-colors">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-text">${a.employee?.user?.fullName || a.employeeId.substring(0, 8)}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="px-2.5 py-1 bg-green-500/15 text-green-500 rounded-md text-xs font-bold">${inDate.toLocaleTimeString([], { timeStyle: 'short' })}</span>
                  <div class="text-[10px] text-muted mt-1 uppercase tracking-wider">${inDate.toLocaleDateString()}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  ${outDate
                ? `<span class="px-2.5 py-1 bg-orange-500/15 text-orange-500 rounded-md text-xs font-bold">${outDate.toLocaleTimeString([], { timeStyle: 'short' })}</span>`
                : `<span class="text-xs text-muted italic border border-dashed border-border px-2.5 py-1 rounded-md">Working...</span>`}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-text">${a.note || '-'}</td>
              </tr>
             `;
          }).join('');
        } else {
          tbodyAtt.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-muted text-sm font-medium">No attendance logs found for today.</td></tr>`;
        }
      } catch (e) {
        tbodyAtt.innerHTML = `<tr><td colspan="4" class="py-12 text-center text-danger text-sm font-medium">Failed to load attendance records.</td></tr>`;
      }
    }

    // Manual creation of employee form toggle
    document.getElementById('create-emp-btn').addEventListener('click', () => {
      document.getElementById('emp-form-container').classList.toggle('hidden');
    });

    document.getElementById('emp-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await apiFetch('/employees', {
          method: 'POST',
          body: {
            fullName: e.target.fullName.value,
            phone: e.target.phone.value,
            password: e.target.password.value,
            jobTitle: e.target.jobTitle.value || undefined,
            monthlyBase: e.target.monthlyBase.value || undefined,
          }
        });
        window.toast('Employee created', 'success');
        e.target.reset();
        document.getElementById('emp-form-container').classList.add('hidden');
        loadEmployees();
      } catch (err) {
        window.toast(err.message, 'error');
      }
    });

    // Checkin system logic (Scanner mock)
    document.getElementById('scan-btn').addEventListener('click', () => {
      const qr = prompt('Simulate QR scan. Enter payload string:');
      if (qr) submitQR(qr);
    });

    async function submitQR(qrPayload) {
      try {
        const empIdStr = qrPayload.split(':')[0];
        const mode = confirm("Check In? (Cancel = Check Out)");

        await apiFetch('/employees/attendance/checkin', {
          method: 'POST',
          body: {
            employeeId: empIdStr,
            qrPayload,
            geoNote: 'Office Scan UI'
          }
        });
        window.toast(`Attendance recorded.`, 'success');
        if (!attContent.classList.contains('hidden')) loadAttendance();
      } catch (e) {
        window.toast(e.message, 'error');
      }
    }

    // Init
    loadEmployees();

    window.viewQr = async (empId) => {
      try {
        const res = await apiFetch(`/employees/attendance/qr?employeeId=${empId}`);
        alert(`QR Secret Payload for Demo: \n${res.payload}\n\nCopy this payload and use the Scan button to test check-in!`);
      } catch (e) {
        window.toast('Could not fetch QR', 'error');
      }
    };
  };

  return `
    <div class="w-full h-full flex flex-col gap-6">
      
      <div class="flex justify-between items-center bg-surface border border-border p-4 rounded-xl">
        <h1 class="text-2xl font-heading font-bold text-text">Human Resources</h1>
        <div class="flex gap-2">
          <button id="scan-btn" class="bg-surface border border-primary text-primary hover:bg-primary/5 px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
            Scan QR
          </button>
          <button id="create-emp-btn" class="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm">
            Add Employee
          </button>
        </div>
      </div>

      <div class="flex gap-6 border-b border-border">
        <button id="tab-list" class="pb-2 border-b-2 font-bold text-sm uppercase tracking-wider px-2 border-primary text-primary transition-colors">Employees List</button>
        <button id="tab-attendance" class="pb-2 border-b-2 font-bold text-sm uppercase tracking-wider px-2 border-transparent text-muted hover:text-text transition-colors">Attendance Logs</button>
      </div>

      <!-- Content Views -->
      <div id="content-list" class="flex-1 flex flex-col gap-4 fade-in">
        
        <div id="emp-form-container" class="hidden bg-surface border border-border rounded-xl p-6">
           <h3 class="font-bold text-lg mb-4 text-text border-b border-border pb-2">New Profile</h3>
           <form id="emp-form" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Full Name</label>
                <input type="text" name="fullName" required class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text">
              </div>
              <div>
                <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Phone</label>
                <input type="tel" name="phone" required class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text">
              </div>
              <div>
                <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Initial Password</label>
                <input type="password" name="password" required class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text">
              </div>
              <div>
                <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Job Title</label>
                <input type="text" name="jobTitle" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text">
              </div>
              <div>
                <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Base Salary (JOD)</label>
                <input type="number" step="0.5" name="monthlyBase" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text">
              </div>
              <div class="sm:col-span-2 flex justify-end">
                <button type="submit" class="bg-primary text-white px-6 py-2 rounded-lg font-bold">Save</button>
              </div>
           </form>
        </div>

        <div class="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex-1">
          <div class="overflow-x-auto overflow-y-auto block h-full">
            <table class="w-full text-left min-w-[800px]">
              <thead class="bg-bg border-b border-border sticky top-0 z-10 w-full">
                <tr>
                  <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Employee</th>
                  <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Title</th>
                  <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Salary</th>
                  <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                  <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right pr-6">Creds</th>
                </tr>
              </thead>
            <tbody id="emp-tbody" class="divide-y divide-border"></tbody>
          </table>
        </div>
      </div>

      <div id="content-attendance" class="hidden flex-1 flex flex-col fade-in">
        <div class="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex-1">
          <div class="overflow-x-auto overflow-y-auto block h-full">
            <table class="w-full text-left min-w-[800px]">
              <thead class="bg-bg border-b border-border sticky top-0 z-10 w-full">
                <tr>
                  <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Employee</th>
                  <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Check In</th>
                  <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Check Out</th>
                  <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Note</th>
                </tr>
              </thead>
              <tbody id="att-tbody" class="divide-y divide-border"></tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  `;
}
