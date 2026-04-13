import { apiFetch } from '../../lib/api.js';
import { DateInput } from '../../components/ui/DateInput.js';
import { SimpleBarChart, SimpleDonutChart, MultiBarChart } from '../../components/ui/ChartWrapper.js';
import { KPISkeleton, ChartSkeleton, TableRowSkeleton } from '../../components/ui/Skeleton.js';

function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function formatJod(value) {
  return `${toFiniteNumber(value).toFixed(2)} JOD`;
}

function formatSignedJod(value) {
  const num = toFiniteNumber(value);
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)} JOD`;
}

function isGarbledText(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return /[?]{3,}/.test(trimmed) || /\uFFFD/.test(trimmed);
}

function safeText(value, fallback = 'No data') {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return fallback;
    return isGarbledText(trimmed) ? fallback : trimmed;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
}

function safeServiceName(value) {
  return safeText(value, 'Unknown service');
}

function safeDescription(value) {
  return safeText(value, 'No description');
}

function kpiHelperText(value, zeroText) {
  return toFiniteNumber(value) === 0 ? zeroText : '';
}

function kpiFooterText(value, zeroText, nonZeroText) {
  return toFiniteNumber(value) === 0 ? zeroText : nonZeroText;
}

function safeDateLabel(value, fallback = '-') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function alertTypeMeta(type) {
  const map = {
    inventory: { tag: 'INV', className: 'text-amber-400 border-amber-400/30 bg-amber-500/10' },
    debt: { tag: 'DEBT', className: 'text-danger border-danger/30 bg-danger/10' },
    attendance: { tag: 'STAFF', className: 'text-primary border-primary/30 bg-primary/10' },
    membership: { tag: 'MEM', className: 'text-success border-success/30 bg-success/10' }
  };
  return map[type] || { tag: 'INFO', className: 'text-muted border-white/20 bg-white/5' };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatHourLabel(hourValue) {
  if (typeof hourValue === 'number' && Number.isFinite(hourValue)) {
    return `${String(hourValue).padStart(2, '0')}:00`;
  }
  const asString = String(hourValue ?? '').trim();
  if (/^\d{1,2}$/.test(asString)) {
    return `${asString.padStart(2, '0')}:00`;
  }
  const asDate = new Date(asString);
  if (!Number.isNaN(asDate.getTime())) {
    return `${String(asDate.getHours()).padStart(2, '0')}:00`;
  }
  return '--:--';
}

function expenseCategoryLabel(value) {
  const labels = {
    SUPPLIER: 'Supplier',
    GENERAL: 'General',
    SALARY: 'Salary',
    INVENTORY_PURCHASE: 'Inventory Purchase',
    INVENTORY_ADJUSTMENT: 'Inventory Adjustment'
  };
  return labels[value] || value;
}

const BOOKING_STATUS_META = {
  COMPLETED: { label: 'Completed', color: 'var(--success)' },
  APPROVED: { label: 'Approved', color: '#f59e0b' },
  PENDING: { label: 'Pending', color: 'var(--primary)' },
  REJECTED: { label: 'Rejected', color: '#ef4444' },
  CANCELLED: { label: 'Cancelled', color: '#f97316' },
  LATE_CANCELLED: { label: 'Late Cancelled', color: '#fb923c' },
  NO_SHOW: { label: 'No Show', color: '#8b5cf6' },
  NOT_SERVED: { label: 'Not Served', color: '#94a3b8' },
  PRICE_SET: { label: 'Price Set', color: '#06b6d4' }
};

const BOOKING_STATUS_ORDER = [
  'COMPLETED',
  'APPROVED',
  'PENDING',
  'PRICE_SET',
  'REJECTED',
  'CANCELLED',
  'LATE_CANCELLED',
  'NO_SHOW',
  'NOT_SERVED'
];

function bookingStatusMeta(status) {
  return BOOKING_STATUS_META[status] || {
    label: String(status || 'Unknown').replace(/_/g, ' '),
    color: 'var(--muted)'
  };
}

function toLocalDateInputValue(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeRange(from, to) {
  if (!from && !to) {
    return { from: '', to: '' };
  }
  if (!from) {
    return { from: to, to };
  }
  if (!to) {
    return { from, to: from };
  }
  return from <= to ? { from, to } : { from: to, to: from };
}

function openAdminPath(path) {
  if (typeof window.navigate === 'function') {
    window.navigate(null, path);
    return;
  }
  window.location.href = path;
}

function formatBucketLabel(bucketStart, groupBy) {
  const date = new Date(bucketStart);
  if (Number.isNaN(date.getTime())) {
    return String(bucketStart || '');
  }

  if (groupBy === 'day') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  if (groupBy === 'week') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function normalizeCarType(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  if (raw.includes('EV') || raw.includes('ELECTRIC')) return 'EV';
  if (raw.includes('HYBRID')) return 'HYBRID';
  if (
    raw.includes('FUEL') ||
    raw.includes('REGULAR') ||
    raw.includes('GAS') ||
    raw.includes('PETROL') ||
    raw.includes('DIESEL')
  ) return 'FUEL';
  return '';
}

function formatDurationMinutes(value) {
  const minutes = Math.round(toFiniteNumber(value));
  if (minutes <= 0) return 'No data';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function averageRepairMinutesFromOverview(overview) {
  const employees = Array.isArray(overview?.top?.employees) ? overview.top.employees : [];
  const totals = employees.reduce(
    (acc, employee) => {
      acc.jobs += toFiniteNumber(employee?.handledOrders);
      acc.hours += toFiniteNumber(employee?.workHours);
      return acc;
    },
    { jobs: 0, hours: 0 }
  );
  if (totals.jobs <= 0 || totals.hours <= 0) return 0;
  return (totals.hours * 60) / totals.jobs;
}

export function AdminAnalytics() {

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const todayStr = toLocalDateInputValue(today);
  const thirtyDaysAgoStr = toLocalDateInputValue(thirtyDaysAgo);

  let activeQuickAction = null;
  let currentGroupBy = 'day';

  function syncDateInputDisplay(inputId, value) {
    const input = document.getElementById(inputId);
    const display = document.getElementById(`${inputId}-display`);
    if (!input || !display) return;

    input.value = value || '';
    if (value) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        display.textContent = `${monthNames[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
        display.classList.remove('text-muted');
        display.classList.add('text-text');
        return;
      }
    }

    display.textContent = 'Select a date';
    display.classList.remove('text-text');
    display.classList.add('text-muted');
  }

  function syncGroupByButtons(value) {
    const buttons = document.querySelectorAll('[data-group-by-btn]');
    buttons.forEach((button) => {
      const isActive = button.getAttribute('data-value') === value;
      button.classList.toggle('bg-blue-700', isActive);
      button.classList.toggle('text-white', isActive);
      button.classList.toggle('border-blue-500', isActive);
      button.classList.toggle('shadow-[0_0_0_1px_rgba(59,130,246,0.35)]', isActive);
      button.classList.toggle('bg-slate-800/70', !isActive);
      button.classList.toggle('text-blue-100', !isActive);
      button.classList.toggle('border-blue-500/30', !isActive);
    });
  }

  window.openQuickAction = (type) => {
    activeQuickAction = type;
    const overlay = document.getElementById('qa-overlay');
    const title = document.getElementById('qa-title');
    const desc = document.getElementById('qa-desc');
    const link = document.getElementById('qa-full-link');

    ['qa-form-walkin', 'qa-form-expense', 'qa-form-inventory', 'qa-form-customer'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });

    if (type === 'WALKIN') {
      title.textContent = 'Walk-in Sale';
      desc.textContent = 'Instantly charge a customer for a part.';
      link.href = '/admin/accounting#walkin-sale';
      const f = document.getElementById('qa-form-walkin');
      if (f) f.classList.remove('hidden');
      const r = document.getElementById('qa-walkin-form');
      if (r) r.reset();
    } else if (type === 'EXPENSE') {
      title.textContent = 'Log Expense';
      desc.textContent = 'Record a single business expense directly.';
      link.href = '/admin/accounting#add-expense';
      const f = document.getElementById('qa-form-expense');
      if (f) f.classList.remove('hidden');
      const r = document.getElementById('qa-expense-form');
      if (r) r.reset();
    } else if (type === 'INVENTORY') {
      title.textContent = 'Add Inventory';
      desc.textContent = 'Create a new catalog item.';
      link.href = '/admin/inventory#add-part';
      const f = document.getElementById('qa-form-inventory');
      if (f) f.classList.remove('hidden');
      const r = document.getElementById('qa-inventory-form');
      if (r) r.reset();
    } else if (type === 'CUSTOMER') {
      title.textContent = 'Add Customer';
      desc.textContent = 'Create a new customer profile.';
      link.href = '/admin/customers#create-customer';
      const f = document.getElementById('qa-form-customer');
      if (f) f.classList.remove('hidden');
      const r = document.getElementById('qa-customer-form');
      if (r) r.reset();
    }

    if (overlay) overlay.classList.remove('hidden');
  };

  window.closeQuickAction = () => {
    activeQuickAction = null;
    const overlay = document.getElementById('qa-overlay');
    if (overlay) overlay.classList.add('hidden');
  };

  window.exportData = (type) => {
    const from = document.getElementById('date-from').value;
    const to = document.getElementById('date-to').value;

    const routes = {
      transactions: `/api/admin/reports/export-transactions?from=${from}&to=${to}`,
      bookings: `/api/admin/reports/export-bookings?from=${from}&to=${to}`,
      inventory: '/api/admin/reports/export-inventory',
      accounting: `/api/admin/reports/export-accounting?from=${from}&to=${to}`,
      reconciliation: `/api/admin/reports/export-reconciliation?from=${from}&to=${to}`
    };

    window.open(routes[type], '_blank');
  };

  window.onMount = async () => {
    let parts = [];
    let customers = [];

    try {
      const saved = JSON.parse(localStorage.getItem('dashboard_filters'));
      if (saved) {
        const range = normalizeRange(saved.from || thirtyDaysAgoStr, saved.to || todayStr);
        syncDateInputDisplay('date-from', range.from);
        syncDateInputDisplay('date-to', range.to);
        if (saved.groupBy) {
          document.getElementById('group-by').value = saved.groupBy;
          currentGroupBy = saved.groupBy;
          syncGroupByButtons(saved.groupBy);
        }
      } else {
        syncDateInputDisplay('date-from', thirtyDaysAgoStr);
        syncDateInputDisplay('date-to', todayStr);
        syncGroupByButtons(currentGroupBy);
      }
    } catch (e) {
      syncDateInputDisplay('date-from', thirtyDaysAgoStr);
      syncDateInputDisplay('date-to', todayStr);
      syncGroupByButtons(currentGroupBy);
    }
    syncGroupByButtons(document.getElementById('group-by')?.value || currentGroupBy);

    const filterBtn = document.getElementById('filter-btn');
    if (filterBtn) {
      filterBtn.addEventListener('click', loadDashboard);
    }

    const resetBtn = document.getElementById('reset-filters-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        currentGroupBy = 'day';
        if (document.getElementById('group-by')) {
          document.getElementById('group-by').value = 'day';
        }
        syncDateInputDisplay('date-from', thirtyDaysAgoStr);
        syncDateInputDisplay('date-to', todayStr);
        syncGroupByButtons('day');
        loadDashboard();
      });
    }

    document.querySelectorAll('[data-group-by-btn]').forEach((button) => {
      button.addEventListener('click', () => {
        const value = button.getAttribute('data-value') || 'day';
        const input = document.getElementById('group-by');
        if (input) {
          input.value = value;
        }
        currentGroupBy = value;
        syncGroupByButtons(value);
      });
    });

    loadDashboard();
    loadParts();
    loadCustomers();

    async function loadParts() {
      try {
        const response = await apiFetch('/inventory/parts');
        parts = response.items || [];
        renderQuickActionDropdowns();
      } catch (error) {
        console.error('Failed to load parts', error);
      }
    }

    async function loadCustomers() {
      try {
        const response = await apiFetch('/admin/customers?status=active&page=1&limit=100');
        customers = response.items || [];
        renderQuickActionDropdowns();
      } catch (error) {
        console.error('Failed to load customers', error);
      }
    }

    function renderQuickActionDropdowns() {
      const partOptions = [
        '<option value="">Select an Item...</option>',
        ...parts.map(p => `<option value="${p.id}">${p.name} - ${p.vehicleModel || ''} (${p.sellPrice || 0} JOD)</option>`)
      ].join('');

      const customerOptions = [
        '<option value="">Walk-in Customer (No Profile)...</option>',
        ...customers.map(c => `<option value="${c.id}">${c.fullName || c.phone} (${c.phone})</option>`)
      ].join('');

      const walkinItem = document.getElementById('qa-walkin-item');
      if (walkinItem) walkinItem.innerHTML = partOptions;

      const expenseItem = document.getElementById('qa-expense-item');
      if (expenseItem) expenseItem.innerHTML = partOptions;

      const customerSelect = document.getElementById('qa-walkin-customer');
      if (customerSelect) customerSelect.innerHTML = customerOptions;
    }

    document.getElementById('qa-walkin-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const partId = form.item.value;
      const qty = parseInt(form.qty.value, 10);
      if (!partId) return window.toast('Please select an item.', 'error');

      const part = parts.find(p => p.id === partId);
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;

      try {
        await apiFetch('/accounting/sale-invoices', {
          method: 'POST',
          body: {
            number: `SALE-${Date.now()}`,
            note: form.note.value || "Quick Action Sale",
            customerId: form.customer.value || undefined,
            lines: [{
              partId: part.id,
              lineType: "INVENTORY",
              description: part.name,
              quantity: qty,
              unitAmount: part.sellPrice || 0
            }]
          }
        });
        window.toast('Sale confirmed.', 'success');
        window.closeQuickAction();
        loadDashboard();
      } catch (error) {
        window.toast(error.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('qa-expense-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;

      try {
        await apiFetch('/accounting/expenses', {
          method: 'POST',
          body: {
            itemName: form.itemName.value,
            unitPrice: parseFloat(form.cost.value),
            quantity: parseInt(form.qty.value, 10),
            note: form.note.value || undefined,
            expenseCategory: form.category.value,
            partId: form.item.value || undefined,
            supplierName: form.supplier.value || undefined,
            occurredAt: new Date().toISOString()
          }
        });
        window.toast('Expense logged.', 'success');
        window.closeQuickAction();
        loadDashboard();
      } catch (error) {
        window.toast(error.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('qa-inventory-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;

      try {
        await apiFetch('/inventory/parts', {
          method: 'POST',
          body: {
            name: form.name.value,
            vehicleModel: form.model.value,
            vehicleType: form.type.value,
            unit: 'piece',
            costPrice: form.cost.value ? Number(form.cost.value) : undefined,
            sellPrice: Number(form.price.value),
            stockQty: 0,
            lowStockThreshold: Number(form.minStock.value)
          }
        });
        window.toast('Inventory part created.', 'success');
        window.closeQuickAction();
        loadParts();
      } catch (error) {
        window.toast(error.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });

    document.getElementById('qa-customer-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;

      try {
        await apiFetch('/admin/customers', {
          method: 'POST',
          body: {
            fullName: form.fullName.value,
            phone: form.phone.value,
            location: form.location.value || undefined,
            initialDebt: form.debt.value ? Number(form.debt.value) : undefined
          }
        });
        window.toast('Customer created.', 'success');
        window.closeQuickAction();
        loadCustomers();
        loadDashboard();
      } catch (error) {
        window.toast(error.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });

    async function loadDashboard() {
      const inputRange = normalizeRange(
        document.getElementById('date-from').value || thirtyDaysAgoStr,
        document.getElementById('date-to').value || todayStr
      );
      const from = inputRange.from;
      const to = inputRange.to;
      const groupBy = document.getElementById('group-by').value || 'day';

      currentGroupBy = groupBy;
      syncGroupByButtons(groupBy);
      syncDateInputDisplay('date-from', from);
      syncDateInputDisplay('date-to', to);
      localStorage.setItem('dashboard_filters', JSON.stringify({ from, to, groupBy }));

      const displayMap = { day: 'Day', week: 'Week', month: 'Month' };
      document.getElementById('active-date-display').textContent = `Viewing: ${from} to ${to} (Grouped by ${displayMap[groupBy] || groupBy})`;

      setLoadingState();

      try {
        const now = new Date();
        const todayRange = toLocalDateInputValue(now);
        const last7 = new Date(now);
        last7.setDate(now.getDate() - 6);
        const last30 = new Date(now);
        last30.setDate(now.getDate() - 29);
        const last7Range = toLocalDateInputValue(last7);
        const last30Range = toLocalDateInputValue(last30);

        const [overviewRes, summaryRes, outstandingRes, todayOverviewRes, last7OverviewRes, last30OverviewRes] = await Promise.all([
          apiFetch(`/admin/analytics/overview?from=${from}&to=${to}&groupBy=${groupBy}`),
          apiFetch(`/admin/analytics/ai-summary?from=${from}&to=${to}`),
          apiFetch('/admin/analytics/outstanding'),
          apiFetch(`/admin/analytics/overview?from=${todayRange}&to=${todayRange}&groupBy=day`).catch(() => null),
          apiFetch(`/admin/analytics/overview?from=${last7Range}&to=${todayRange}&groupBy=day`).catch(() => null),
          apiFetch(`/admin/analytics/overview?from=${last30Range}&to=${todayRange}&groupBy=day`).catch(() => null)
        ]);

        if (overviewRes) {
          populateOverview(overviewRes, {
            today: todayOverviewRes,
            last7: last7OverviewRes,
            last30: last30OverviewRes
          });
        }
        if (summaryRes) populateExecutiveSummary(summaryRes);
        if (outstandingRes) populateOutstanding(outstandingRes);
      } catch (e) {
        console.error('DASHBOARD_LOAD_ERROR:', e);
        window.toast('Failed to load dashboard: ' + e.message, 'error');
        if (document.getElementById('alerts-center')) {
            document.getElementById('alerts-center').innerHTML = '<div class="text-xs text-danger font-bold">Failed to load: ' + e.message + '</div>';
        }
      }
    }

    function setLoadingState() {
      // KPI Skeletons
      ['adv-income', 'adv-expense', 'adv-profit', 'adv-orders', 'adv-avg'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = KPISkeleton();
      });

      const ids = [
        'snap-income', 'snap-expenses', 'snap-profit', 'snap-bookings', 'snap-employees', 'kpi-waiting', 'kpi-memberships',
        'period-income', 'period-expense', 'period-profit', 'period-bookings', 'period-avg',
        'funnel-new', 'funnel-returning', 'funnel-debt',
        'mem-new', 'mem-active', 'mem-expiring'
      ];
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<div class="skeleton h-8 w-24"></div>';
      });

      if (document.getElementById('alerts-center')) document.getElementById('alerts-center').innerHTML = '<div class="text-xs text-muted">Checking...</div>';
      
      const charIds = ['chart-timeseries', 'chart-donuts', 'chart-today-revenue', 'chart-profit-trend', 'chart-status-dist', 'chart-car-type-dist'];
      charIds.forEach(id => {
         const el = document.getElementById(id);
         if (el) el.innerHTML = typeof ChartSkeleton !== 'undefined' ? ChartSkeleton() : '';
      });

      const listIds = ['today-services', 'waiting-customers', 'top-employees', 'top-services', 'mechanic-workload-list'];
      listIds.forEach(id => {
         const el = document.getElementById(id);
         if (el) el.innerHTML = '<div class="skeleton h-10 w-full mb-2"></div><div class="skeleton h-10 w-full"></div>';
      });

      if (document.getElementById('avg-repair-today')) document.getElementById('avg-repair-today').textContent = '--';
      if (document.getElementById('avg-repair-7d')) document.getElementById('avg-repair-7d').textContent = '--';
      if (document.getElementById('avg-repair-30d')) document.getElementById('avg-repair-30d').textContent = '--';

      const outTop = document.getElementById('outstanding-top');
      if (outTop) outTop.innerHTML = '<div class="skeleton h-10 w-full rounded-lg mb-2"></div><div class="skeleton h-10 w-full rounded-lg"></div>';
    }

    function populateOverview(data, periodSnapshots = {}) {
      const {
        kpis,
        timeseries,
        breakdowns,
        membership,
        top,
        todaySnapshot,
        customerFunnel,
        alerts,
        inventory,
        recent
      } = data;

      const todayIncome = todaySnapshot?.income || 0;
      const todayExpenses = todaySnapshot?.expenses || 0;
      const todayProfit = todayIncome - todayExpenses;

      const snapIncomeEl = document.getElementById('snap-income');
      if (snapIncomeEl) snapIncomeEl.textContent = formatJod(todayIncome);
      if (document.getElementById('snap-income-helper')) document.getElementById('snap-income-helper').textContent = kpiFooterText(todayIncome, 'No revenue', 'Revenue today');

      const snapExpensesEl = document.getElementById('snap-expenses');
      if (snapExpensesEl) snapExpensesEl.textContent = formatJod(todayExpenses);
      if (document.getElementById('snap-expenses-helper')) document.getElementById('snap-expenses-helper').textContent = kpiFooterText(todayExpenses, 'No expenses', 'Expenses today');

      const snapProfitEl = document.getElementById('snap-profit');
      if (snapProfitEl) {
        snapProfitEl.textContent = formatSignedJod(todayProfit);
        snapProfitEl.className = `text-3xl font-bold ${todayProfit > 0 ? 'text-success' : todayProfit < 0 ? 'text-danger' : 'text-text'}`;
      }
      if (document.getElementById('snap-profit-helper')) document.getElementById('snap-profit-helper').textContent = todayProfit === 0 ? 'Break-even' : todayProfit > 0 ? 'Net profit' : 'Net loss';

      const snapBookingsEl = document.getElementById('snap-bookings');
      if (snapBookingsEl) snapBookingsEl.textContent = Number(todaySnapshot?.bookings || 0).toLocaleString();
      if (document.getElementById('snap-bookings-helper')) document.getElementById('snap-bookings-helper').textContent = kpiFooterText(todaySnapshot?.bookings || 0, 'No bookings', 'Bookings today');

      const snapEmployeesEl = document.getElementById('snap-employees');
      if (snapEmployeesEl) snapEmployeesEl.textContent = Number(todaySnapshot?.activeEmployees || 0).toLocaleString();

      const pIncome = kpis?.totalIncome || 0;
      const pExpense = kpis?.totalExpenses || 0;
      const pProfit = pIncome - pExpense;
      const pBookings = kpis?.totalOrders || 0;
      const pAvg = pBookings > 0 ? (pIncome / pBookings) : 0;

      if (document.getElementById('period-income')) {
        document.getElementById('period-income').textContent = formatJod(pIncome);
      }
      if (document.getElementById('period-expense')) {
        document.getElementById('period-expense').textContent = formatJod(pExpense);
      }

      const periodProfitEl = document.getElementById('period-profit');
      if (periodProfitEl) {
        periodProfitEl.textContent = formatJod(pProfit);
        periodProfitEl.className = `text-xl font-bold ${pProfit > 0 ? 'text-success' : pProfit < 0 ? 'text-danger' : 'text-text'}`;
      }

      if (document.getElementById('period-bookings')) {
        document.getElementById('period-bookings').textContent = Number(pBookings).toLocaleString();
      }
      if (document.getElementById('period-avg')) {
        document.getElementById('period-avg').textContent = formatJod(pAvg);
      }

      if (document.getElementById('funnel-new')) document.getElementById('funnel-new').textContent = Number(customerFunnel?.newCustomers || 0).toLocaleString();
      if (document.getElementById('funnel-returning')) document.getElementById('funnel-returning').textContent = Number(customerFunnel?.returningCustomers || 0).toLocaleString();
      if (document.getElementById('funnel-debt')) document.getElementById('funnel-debt').textContent = Number(customerFunnel?.customersWithDebt || 0).toLocaleString();

      const lowAlerts = alerts?.lowInventory || [];
      const debtAlerts = alerts?.overdueCustomerDebt || [];
      const absentAlerts = alerts?.absentEmployeesToday || [];

      if (document.getElementById('alerts-low')) {
        document.getElementById('alerts-low').innerHTML = lowAlerts.length
          ? lowAlerts.map((item) => `<div class="text-xs text-text flex items-center justify-between py-1 border-b border-white/5 last:border-0"><span>${item.name}</span> <span class="text-amber-500 font-bold">${item.stockQty} left</span></div>`).join('')
          : '<div class="text-xs text-muted">No low inventory items.</div>';
      }

      if (document.getElementById('alerts-debt')) {
        document.getElementById('alerts-debt').innerHTML = debtAlerts.length
          ? debtAlerts.map((item) => `<div class="text-xs text-text flex items-center justify-between py-1 border-b border-white/5 last:border-0"><span>${item.name}</span> <span class="text-danger font-bold">${formatJod(item.balanceDue)}</span></div>`).join('')
          : '<div class="text-xs text-muted">No overdue debt.</div>';
      }

      if (document.getElementById('alerts-absent')) {
        document.getElementById('alerts-absent').innerHTML = absentAlerts.length
          ? absentAlerts.map((item) => `<div class="text-xs text-text py-1 border-b border-white/5 last:border-0">${item.name}</div>`).join('')
          : '<div class="text-xs text-muted">No absent employees.</div>';
      }

      const tsEl = document.getElementById('chart-timeseries');
      if (tsEl) {
        if (Array.isArray(timeseries) && timeseries.length > 0) {
          tsEl.innerHTML = MultiBarChart(
            timeseries.map(t => {
              return {
                label: formatBucketLabel(t.bucketStart, currentGroupBy),
                income: toFiniteNumber(t.income),
                expenses: toFiniteNumber(t.expenses),
                profit: toFiniteNumber(t.income) - toFiniteNumber(t.expenses)
              };
            }),
            { height: '100%', format: v => `${v.toFixed(0)} JOD` }
          );
        } else {
          tsEl.innerHTML = '<div class="h-full flex items-center justify-center text-sm text-muted">No revenue data for selected range</div>';
        }
      }

      if (breakdowns?.expensesByCategory && document.getElementById('chart-donuts')) {
        const colorByCategory = {
          SUPPLIER: 'var(--danger)',
          GENERAL: 'var(--amber-500)',
          SALARY: 'var(--primary)',
          INVENTORY_PURCHASE: '#06b6d4',
          INVENTORY_ADJUSTMENT: '#a78bfa'
        };

        const donutItems = (breakdowns.expensesByCategory || [])
          .filter((c) => Number(c.amount || 0) > 0)
          .map((c) => ({
            label: expenseCategoryLabel(c.category),
            value: Number(c.amount || 0),
            color: colorByCategory[c.category] || 'var(--muted)'
          }));

        document.getElementById('chart-donuts').innerHTML = SimpleDonutChart(
          donutItems.length
            ? donutItems
            : [{ label: 'No expense categories in selected range', value: 1, color: 'var(--border)' }]
        );
      }

      if (document.getElementById('mem-new')) document.getElementById('mem-new').textContent = Number(membership?.newCount || 0).toLocaleString();
      if (document.getElementById('mem-renewed')) document.getElementById('mem-renewed').textContent = Number(membership?.renewedCount || 0).toLocaleString();
      if (document.getElementById('mem-expired')) document.getElementById('mem-expired').textContent = Number(membership?.expiredCount || 0).toLocaleString();
      if (document.getElementById('mem-rev')) document.getElementById('mem-rev').textContent = formatJod(membership?.membershipRevenue || 0);

      const td = data.todayData || {};
      const waitingCars = Array.isArray(td.waitingCars) ? td.waitingCars : [];
      const byRev = (top?.services?.byRevenue || []).slice(0, 5);
      if (document.getElementById('top-services')) {
        document.getElementById('top-services').innerHTML = byRev.length
          ? byRev.map(s => `
          <div class="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
              <div class="min-w-0 pr-3">
                <div class="font-medium text-text truncate">${escapeHtml(safeServiceName(s.serviceNameEn || s.serviceNameAr))}</div>
                <div class="text-[11px] text-muted truncate">${escapeHtml(safeDescription(s.serviceNameAr))}</div>
              </div>
              <span class="font-bold text-text whitespace-nowrap">${formatJod(s.revenue)}</span>
            </div>
          `).join('')
          : '<div class="text-sm text-muted">No data</div>';
      }

      const todayServicesEl = document.getElementById('today-services');
      if (todayServicesEl) {
        const svcs = Array.isArray(td.services) ? td.services.slice(0, 5) : [];
        todayServicesEl.innerHTML = svcs.length
          ? svcs.map(s => '<div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">' +
                '<div>' +
                  '<div class="text-sm font-bold text-text">' + escapeHtml(safeText(s.carName, 'Unknown vehicle')) + '</div>' +
                  '<div class="text-xs text-muted">' + escapeHtml(safeServiceName(s.serviceName)) + '</div>' +
                '</div>' +
                '<div class="text-right">' +
                  '<div class="text-xs font-bold ' + (s.status==='COMPLETED'?'text-success':s.status==='PENDING'?'text-danger':s.status==='APPROVED'?'text-amber-500':'text-text') + '">' + escapeHtml(safeText(s.status, 'No data')) + '</div>' +
                  '<div class="text-xs text-muted">' + escapeHtml(safeText(s.employeeName, '-')) + '</div>' +
                '</div>' +
              '</div>').join('')
          : '<div class="text-sm text-muted">No services completed today</div>';
      }

      const statusDistEl = document.getElementById('chart-status-dist');
      if (statusDistEl && typeof SimpleDonutChart !== 'undefined') {
        const dist = td.statusDistribution || [];
        const distMap = new Map(dist.map(d => [d.status, Number(d.count || 0)]));
        const items = BOOKING_STATUS_ORDER.map(status => {
          const meta = bookingStatusMeta(status);
          return {
            label: meta.label,
            value: distMap.get(status) || 0,
            color: meta.color
          };
        });
        const prioritized = [
          ...items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value),
          ...items.filter((item) => item.value === 0)
        ];
        const legendItems = prioritized.slice(0, 6);
        const hiddenZeroCount = prioritized.length - legendItems.length;
        const totalStatuses = items.reduce((sum, item) => sum + item.value, 0);
        if (!items.length) {
          statusDistEl.innerHTML = '<div class="text-sm text-muted flex items-center justify-center h-full">No data</div>';
        } else if (totalStatuses === 0) {
          statusDistEl.innerHTML = `
            <div class="h-full w-full flex flex-col items-center justify-center gap-2">
              <div class="relative h-[132px] w-[132px] rounded-full border-[14px] border-white/15">
                <div class="absolute inset-[24px] rounded-full bg-surface flex flex-col items-center justify-center text-center">
                  <span class="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Total</span>
                  <span class="text-2xl font-black leading-none text-text">0</span>
                </div>
              </div>
              <div class="text-[11px] text-muted text-center">No activity today</div>
            </div>
          `;
        } else {
          statusDistEl.innerHTML = SimpleDonutChart(legendItems, {
            size: 148,
            cutout: '22%',
            centerLabel: 'Total',
            centerValue: totalStatuses,
            legendValueFormatter: item => `${item.value}`,
            legendToneByItem: item => (item.value > 0 ? 'text-text' : 'text-muted')
          }) + (hiddenZeroCount > 0 ? `<div class="mt-2 text-center text-[11px] text-muted">+${hiddenZeroCount} more statuses</div>` : '');
        }
      }

      const revChartEl = document.getElementById('chart-today-revenue');
      if (revChartEl && typeof SimpleBarChart !== 'undefined') {
         const hourly = Array.isArray(td.hourlyRevenue) ? td.hourlyRevenue : [];
         revChartEl.innerHTML = hourly.length
           ? SimpleBarChart(hourly.map(h => ({ label: formatHourLabel(h.hour), value: toFiniteNumber(h.revenue) })))
           : '<div class="text-sm text-muted flex items-center justify-center h-full">No revenue data for selected range</div>';
      }

      const topEmpsEl = document.getElementById('top-employees');
      if (topEmpsEl) {
         const emps = (Array.isArray(td.topEmployees) ? td.topEmployees : []).slice(0, 5);
         topEmpsEl.innerHTML = emps.length
            ? emps.map((e, index) => '<div class="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">' +
                 '<div class="min-w-0 flex items-center gap-2">' +
                   '<span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-text">#' + (index + 1) + '</span>' +
                   '<div class="min-w-0">' +
                     '<div class="text-sm text-text font-bold truncate">' + escapeHtml(safeText(e.name, 'Unknown employee')) + '</div>' +
                     '<div class="text-xs text-muted">' + toFiniteNumber(e.jobsCompleted) + ' jobs</div>' +
                   '</div>' +
                 '</div>' +
                 '<div class="text-sm text-success font-bold whitespace-nowrap">' + formatJod(e.revenue) + '</div>' +
               '</div>').join('')
            : '<div class="text-sm text-muted">No employees today</div>';
      }

      const waitingEl = document.getElementById('waiting-customers');
      if (waitingEl) {
         const waiting = waitingCars.slice(0, 5);
         waitingEl.innerHTML = waiting.length
            ? waiting.map(w => '<div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">' +
                  '<div>' +
                     '<div class="text-sm text-text font-bold">' + escapeHtml(safeText(w.carName, 'Unknown vehicle')) + '</div>' +
                     '<div class="text-xs text-muted">' + escapeHtml(safeServiceName(w.serviceName)) + '</div>' +
                  '</div>' +
                  '<div class="text-xs text-danger font-bold whitespace-nowrap">' + Math.max(0, Math.round((Date.now() - new Date(w.waitingSince || Date.now()).getTime()) / 60000)) + ' min</div>' +
                '</div>').join('')
            : '<div class="text-sm text-muted">No waiting customers</div>';
      }

      const ptChartEl = document.getElementById('chart-profit-trend');
      if (ptChartEl && typeof SimpleBarChart !== 'undefined') {
         const pt = Array.isArray(data.profitTrend) ? data.profitTrend : [];
         ptChartEl.innerHTML = pt.length
           ? SimpleBarChart(pt.map(p => ({ label: formatBucketLabel(p.date, 'day'), value: toFiniteNumber(p.profit) })))
           : '<div class="text-sm text-muted flex items-center justify-center h-full">No data</div>';
      }

      const expMems = alerts?.expiringMemberships || [];

      const alertsEl = document.getElementById('alerts-center');
      if (alertsEl) {
         const alertHtml = [];
         lowAlerts.slice(0, 2).forEach(a => {
           const meta = alertTypeMeta('inventory');
           alertHtml.push(
             '<div class="text-xs flex items-center justify-between gap-2 py-1.5">' +
               '<div class="min-w-0 flex items-center gap-2">' +
                 '<span class="inline-flex h-5 w-11 shrink-0 items-center justify-center rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider ' + meta.className + '">' + meta.tag + '</span>' +
                 '<span class="truncate text-text">' + escapeHtml(safeText(a.name, 'No data')) + '</span>' +
               '</div>' +
               '<span class="text-amber-500 font-bold whitespace-nowrap">' + toFiniteNumber(a.stockQty) + ' left</span>' +
             '</div>'
           );
         });
         debtAlerts.slice(0, 2).forEach(a => {
           const meta = alertTypeMeta('debt');
           alertHtml.push(
             '<div class="text-xs flex items-center justify-between gap-2 py-1.5">' +
               '<div class="min-w-0 flex items-center gap-2">' +
                 '<span class="inline-flex h-5 w-11 shrink-0 items-center justify-center rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider ' + meta.className + '">' + meta.tag + '</span>' +
                 '<span class="truncate text-text">' + escapeHtml(safeText(a.name, 'No data')) + '</span>' +
               '</div>' +
               '<span class="text-danger font-bold whitespace-nowrap">' + formatJod(a.balanceDue) + '</span>' +
             '</div>'
           );
         });
         absentAlerts.slice(0, 1).forEach(a => {
           const meta = alertTypeMeta('attendance');
           alertHtml.push(
             '<div class="text-xs flex items-center justify-between gap-2 py-1.5">' +
               '<div class="min-w-0 flex items-center gap-2">' +
                 '<span class="inline-flex h-5 w-11 shrink-0 items-center justify-center rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider ' + meta.className + '">' + meta.tag + '</span>' +
                 '<span class="truncate text-text">' + escapeHtml(safeText(a.name, 'No data')) + '</span>' +
               '</div>' +
               '<span class="text-primary font-bold whitespace-nowrap">Absent</span>' +
             '</div>'
           );
         });
         expMems.slice(0, 1).forEach(a => {
           const meta = alertTypeMeta('membership');
           alertHtml.push(
             '<div class="text-xs flex items-center justify-between gap-2 py-1.5">' +
               '<div class="min-w-0 flex items-center gap-2">' +
                 '<span class="inline-flex h-5 w-11 shrink-0 items-center justify-center rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider ' + meta.className + '">' + meta.tag + '</span>' +
                 '<span class="truncate text-text">' + escapeHtml(safeText(a.name, 'No data')) + '</span>' +
               '</div>' +
               '<span class="text-success font-bold whitespace-nowrap">Exp: ' + safeDateLabel(a.expiresAt) + '</span>' +
             '</div>'
           );
         });

         alertsEl.innerHTML = alertHtml.length 
           ? alertHtml.join('<div class="border-b border-white/5"></div>') 
           : '<div class="text-sm text-muted">No alerts right now</div>';
      }

      if (document.getElementById('mem-active')) {
         const activeMemberships = toFiniteNumber(kpis?.activeMemberships);
         const waitingCount = waitingCars.length;
         document.getElementById('mem-active').textContent = "Active: " + activeMemberships;
         if (document.getElementById('kpi-waiting')) document.getElementById('kpi-waiting').textContent = String(waitingCount);
         if (document.getElementById('kpi-memberships')) document.getElementById('kpi-memberships').textContent = String(activeMemberships);
         if (document.getElementById('kpi-waiting-helper')) document.getElementById('kpi-waiting-helper').textContent = kpiFooterText(waitingCount, 'No waiting customers', 'Waiting now');
         if (document.getElementById('kpi-memberships-helper')) document.getElementById('kpi-memberships-helper').textContent = kpiFooterText(activeMemberships, 'No active members', 'Active members');
         if (document.getElementById('mem-expiring')) document.getElementById('mem-expiring').textContent = "Expiring Soon: " + toFiniteNumber(expMems.length || membership?.expiredCount || 0);
         if (document.getElementById('mem-new')) document.getElementById('mem-new').textContent = "New This Month: " + (membership?.newCount || 0);
      }

      const mechanicWorkloadEl = document.getElementById('mechanic-workload-list');
      if (mechanicWorkloadEl) {
        const workload = (Array.isArray(top?.employees) ? top.employees : [])
          .slice()
          .sort((a, b) => toFiniteNumber(b.handledOrders) - toFiniteNumber(a.handledOrders))
          .slice(0, 5);
        mechanicWorkloadEl.innerHTML = workload.length
          ? workload.map((employee, index) => (
              '<div class="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">' +
                '<div class="min-w-0 flex items-center gap-2">' +
                  '<span class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-text">#' + (index + 1) + '</span>' +
                  '<div class="min-w-0">' +
                    '<div class="truncate text-sm font-bold text-text">' + escapeHtml(safeText(employee.name, 'Unknown employee')) + '</div>' +
                    '<div class="text-xs text-muted">' + toFiniteNumber(employee.handledOrders).toLocaleString() + ' jobs</div>' +
                  '</div>' +
                '</div>' +
                '<div class="text-xs font-bold text-success whitespace-nowrap">' + formatJod(employee.revenue) + '</div>' +
              '</div>'
            )).join('')
          : '<div class="text-sm text-muted">No mechanic workload data</div>';
      }

      const carTypeChartEl = document.getElementById('chart-car-type-dist');
      if (carTypeChartEl) {
        const typeCounts = { EV: 0, HYBRID: 0, FUEL: 0 };
        const sources = [
          ...(Array.isArray(td.services) ? td.services : []),
          ...(Array.isArray(recent?.completedBookings) ? recent.completedBookings : [])
        ];

        sources.forEach((entry) => {
          const explicitType = normalizeCarType(entry?.carType || entry?.vehicleType || entry?.type);
          const inferredType = explicitType || normalizeCarType(entry?.carName || entry?.vehicleModel || entry?.serviceNameEn || entry?.serviceNameAr || '');
          if (inferredType && Object.prototype.hasOwnProperty.call(typeCounts, inferredType)) {
            typeCounts[inferredType] += 1;
          }
        });

        const carTypeItems = [
          { label: 'EV', value: typeCounts.EV, color: '#22c55e' },
          { label: 'Hybrid', value: typeCounts.HYBRID, color: '#f59e0b' },
          { label: 'Fuel', value: typeCounts.FUEL, color: '#3b82f6' }
        ];
        const totalCarTypes = carTypeItems.reduce((sum, item) => sum + item.value, 0);

        carTypeChartEl.innerHTML = totalCarTypes > 0
          ? SimpleDonutChart(carTypeItems, {
              size: 146,
              cutout: '22%',
              centerLabel: 'Cars',
              centerValue: totalCarTypes,
              legendValueFormatter: (item) => `${((item.value / totalCarTypes) * 100).toFixed(0)}%`
            })
          : '<div class="text-sm text-muted flex items-center justify-center h-full">No car type data for selected range</div>';
      }

      const todayAvg = averageRepairMinutesFromOverview(periodSnapshots.today);
      const weekAvg = averageRepairMinutesFromOverview(periodSnapshots.last7);
      const monthAvg = averageRepairMinutesFromOverview(periodSnapshots.last30);
      if (document.getElementById('avg-repair-today')) document.getElementById('avg-repair-today').textContent = formatDurationMinutes(todayAvg);
      if (document.getElementById('avg-repair-7d')) document.getElementById('avg-repair-7d').textContent = formatDurationMinutes(weekAvg);
      if (document.getElementById('avg-repair-30d')) document.getElementById('avg-repair-30d').textContent = formatDurationMinutes(monthAvg);

    }

    function populateExecutiveSummary(data) {
      const summarySignalsEl = document.getElementById('summary-signals');
      if (summarySignalsEl) {
        summarySignalsEl.innerHTML = (data.signals || []).slice(0, 3).map(s => `
          <li class="flex items-start gap-3">
            <div class="mt-1 min-w-[8px] h-2 w-2 rounded-full ${s.severity === 'high' ? 'bg-danger' : s.severity === 'medium' ? 'bg-amber-500' : 'bg-primary'}"></div>
            <div>
              <div class="font-bold text-sm text-text flex items-center gap-2">
                ${escapeHtml(safeText(s.title, 'No data'))}
                <span class="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/5 text-muted tracking-wider">${escapeHtml(safeText(s.type, 'Info'))}</span>
              </div>
              <div class="text-xs text-muted mt-0.5">${escapeHtml(safeText(s.detail, 'No description'))}</div>
            </div>
          </li>
        `).join('') || '<li class="text-sm text-muted">No insights generated for this period.</li>';
      }
    }

    function populateOutstanding(data) {
      if (document.getElementById('outstanding-total')) document.getElementById('outstanding-total').textContent = formatJod(data.totalOutstanding || 0);
      if (document.getElementById('outstanding-count')) document.getElementById('outstanding-count').textContent = `${data.countCustomersWithDebt || 0} `;
      
      const outstandingTopEl = document.getElementById('outstanding-top');
      if (outstandingTopEl) {
        const top = data.topCustomersByDebt || [];
        outstandingTopEl.innerHTML = top.length
          ? top.map(c => `
            <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0 text-sm">
                <div>
                  <div class="font-semibold text-text">${escapeHtml(safeText(c.fullName || c.phone, 'Customer'))}</div>
                  <div class="text-xs text-muted">${escapeHtml(safeText(c.phone, '-'))}</div>
                </div>
                <div class="font-bold text-danger">${formatJod(c.balanceDue)}</div>
              </div>
            `).join('')
          : `<div class="text-sm text-muted">No outstanding debt.</div>`;
      }
    }
  };


  return `<div class="w-full max-w-7xl mx-auto flex flex-col gap-6">

      <style>
        .dashboard-card {
          transition: transform 160ms ease, border-color 160ms ease, background-color 160ms ease;
        }
        .dashboard-card:hover {
          transform: translateY(-2px);
          border-color: rgba(59, 130, 246, 0.55);
          background-color: rgba(15, 23, 42, 0.84);
        }
      </style>

      <!-- Top Filters -->
      <div class="flex flex-col gap-3 bg-surface p-4 border border-white/5 rounded-xl">
        <div class="flex flex-col lg:flex-row gap-3">
          <div class="flex-1 w-full flex flex-col sm:flex-row gap-3">
          <div class="flex-1 min-w-[140px]">
            <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">From</label>
            ${DateInput({ id: 'date-from', value: thirtyDaysAgoStr, className: 'bg-slate-950 border border-white/10 rounded-lg py-2 text-sm text-text outline-none focus:ring-1 focus:ring-primary' })}
          </div>
          <div class="flex-1 min-w-[140px]">
            <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">To</label>
            ${DateInput({ id: 'date-to', value: todayStr, className: 'bg-slate-950 border border-white/10 rounded-lg py-2 text-sm text-text outline-none focus:ring-1 focus:ring-primary' })}
          </div>
          <div class="sm:w-[240px]">
            <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Group By</label>
            <div class="flex items-center rounded-lg border border-blue-500/25 bg-blue-950/50 p-1 gap-1">
              <button type="button" data-group-by-btn data-value="day" class="flex-1 rounded-md border border-blue-500/30 bg-slate-800/70 px-2 py-1.5 text-xs font-semibold text-blue-100 transition-colors hover:border-cyan-300/60 hover:text-cyan-200">Day</button>
              <button type="button" data-group-by-btn data-value="week" class="flex-1 rounded-md border border-blue-500/30 bg-slate-800/70 px-2 py-1.5 text-xs font-semibold text-blue-100 transition-colors hover:border-cyan-300/60 hover:text-cyan-200">Week</button>
              <button type="button" data-group-by-btn data-value="month" class="flex-1 rounded-md border border-blue-500/30 bg-slate-800/70 px-2 py-1.5 text-xs font-semibold text-blue-100 transition-colors hover:border-cyan-300/60 hover:text-cyan-200">Month</button>
            </div>
            <select id="group-by" class="hidden">
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>
        </div>
          <div class="flex gap-2 lg:self-end">
            <button id="reset-filters-btn" class="px-4 py-2 rounded-lg border border-blue-500/30 text-blue-200 text-sm font-semibold hover:border-blue-400/60 hover:bg-blue-500/10 transition-colors">Reset</button>
            <button id="filter-btn" class="px-5 py-2 rounded-lg bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 transition-colors">Apply Filters</button>
          </div>
        </div>
      </div>

      <!-- Row 1: Compact KPI Cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <div class="dashboard-card bg-surface border border-white/5 rounded-xl p-4">
          <div class="text-[10px] font-bold text-muted uppercase tracking-wider">Revenue</div>
          <div id="snap-income" class="mt-2 text-lg font-bold text-text">0.00 JOD</div>
          <div id="snap-income-helper" class="mt-1 min-h-[14px] text-[10px] text-muted"></div>
        </div>
        <div class="dashboard-card bg-surface border border-white/5 rounded-xl p-4">
          <div class="text-[10px] font-bold text-muted uppercase tracking-wider">Expenses</div>
          <div id="snap-expenses" class="mt-2 text-lg font-bold text-text">0.00 JOD</div>
          <div id="snap-expenses-helper" class="mt-1 min-h-[14px] text-[10px] text-muted"></div>
        </div>
        <div class="dashboard-card bg-surface border border-white/5 rounded-xl p-4">
          <div class="text-[10px] font-bold text-muted uppercase tracking-wider">Profit</div>
          <div id="snap-profit" class="mt-2 text-lg font-bold text-success">0.00 JOD</div>
          <div id="snap-profit-helper" class="mt-1 min-h-[14px] text-[10px] text-muted"></div>
        </div>
        <div class="dashboard-card bg-surface border border-white/5 rounded-xl p-4">
          <div class="text-[10px] font-bold text-muted uppercase tracking-wider">Bookings</div>
          <div id="snap-bookings" class="mt-2 text-lg font-bold text-text">0</div>
          <div id="snap-bookings-helper" class="mt-1 min-h-[14px] text-[10px] text-muted"></div>
        </div>
        <div class="dashboard-card bg-surface border border-white/5 rounded-xl p-4">
          <div class="text-[10px] font-bold text-muted uppercase tracking-wider">Waiting Customers</div>
          <div id="kpi-waiting" class="mt-2 text-lg font-bold text-text">0</div>
          <div id="kpi-waiting-helper" class="mt-1 min-h-[14px] text-[10px] text-muted">No waiting customers</div>
        </div>
        <div class="dashboard-card bg-surface border border-white/5 rounded-xl p-4">
          <div class="text-[10px] font-bold text-muted uppercase tracking-wider">Active Memberships</div>
          <div id="kpi-memberships" class="mt-2 text-lg font-bold text-text">0</div>
          <div id="kpi-memberships-helper" class="mt-1 min-h-[14px] text-[10px] text-muted">No active members</div>
        </div>
      </div>

      <!-- Row 2: Main Insights -->
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div class="dashboard-card xl:col-span-8 bg-surface border border-white/5 rounded-xl p-5 flex flex-col min-h-[250px]">
          <h3 class="font-bold text-text mb-4 flex items-center justify-between text-[10px] uppercase tracking-wider">
            <span>Income vs Expenses</span>
            <span id="active-date-display" class="text-muted font-normal normal-case">Viewing: - to -</span>
          </h3>
          <div id="chart-timeseries" class="flex-1 min-h-[190px]"></div>
        </div>
        <div class="dashboard-card xl:col-span-4 bg-surface border border-white/5 rounded-xl p-5 flex flex-col min-h-[330px]">
          <h3 class="text-[10px] font-bold text-text uppercase tracking-wider mb-3">Today's Status</h3>
          <div id="chart-status-dist" class="flex-1"></div>
        </div>
        <div class="dashboard-card xl:col-span-12 bg-surface border border-white/5 rounded-xl p-5">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-[10px] font-bold text-text uppercase tracking-wider">Today's Services</h3>
            <a href="/admin/bookings" onclick="openAdminPath('/admin/bookings')" class="text-[11px] text-muted hover:text-text">View all</a>
          </div>
          <div id="today-services" class="space-y-1"></div>
        </div>
      </div>

      <!-- Row 3: Supporting Widgets -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div class="dashboard-card bg-surface border border-white/5 rounded-xl p-5 min-h-[250px]">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-[10px] text-text font-bold uppercase tracking-wider">Top Employees Today</h3>
            <a href="/admin/employees" onclick="openAdminPath('/admin/employees')" class="text-[11px] text-muted hover:text-text">View all</a>
          </div>
          <div id="top-employees" class="space-y-1"></div>
        </div>
        <div class="dashboard-card bg-surface border border-white/5 rounded-xl p-5 min-h-[250px]">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-[10px] text-text font-bold uppercase tracking-wider">Alerts Center</h3>
            <a href="/admin/customers" onclick="openAdminPath('/admin/customers')" class="text-[11px] text-muted hover:text-text">View all</a>
          </div>
          <div id="alerts-center" class="space-y-1"></div>
        </div>
        <div class="dashboard-card bg-surface border border-white/5 rounded-xl p-5 min-h-[250px]">
          <h3 class="text-[10px] text-text font-bold uppercase tracking-wider mb-3">Membership Stats</h3>
          <div class="space-y-2 text-sm font-bold">
             <div id="mem-active" class="text-text">Active: 0</div>
             <div id="mem-expiring" class="text-danger">Expiring Soon: 0</div>
             <div id="mem-new" class="text-success">New This Month: 0</div>
          </div>
          <div class="mt-4 pt-3 border-t border-white/5">
            <h4 class="text-[10px] text-muted uppercase tracking-wider mb-2">Waiting Customers</h4>
            <div id="waiting-customers" class="space-y-1"></div>
          </div>
        </div>
        <div class="dashboard-card bg-surface border border-white/5 rounded-xl p-5 min-h-[250px] flex flex-col">
          <h3 class="text-[10px] text-text font-bold uppercase tracking-wider mb-3">Expenses by Category</h3>
          <div id="chart-donuts" class="flex-1"></div>
        </div>
      </div>

      <!-- Supplemental Widgets -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div class="dashboard-card bg-surface border border-white/5 rounded-xl p-5 flex flex-col min-h-[230px]">
          <h3 class="text-[10px] font-bold text-text uppercase tracking-wider mb-3">Revenue Today (Hourly)</h3>
          <div id="chart-today-revenue" class="flex-1"></div>
        </div>
        <div class="dashboard-card bg-surface border border-white/5 rounded-xl p-5 flex flex-col min-h-[230px]">
          <h3 class="text-[10px] font-bold text-text uppercase tracking-wider mb-3">Profit Trend (Last 7 Days)</h3>
          <div id="chart-profit-trend" class="flex-1"></div>
        </div>
        <div class="dashboard-card bg-surface border border-white/5 rounded-xl p-5">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-[10px] font-bold text-text uppercase tracking-wider">Top Services</h3>
            <a href="/admin/services" onclick="openAdminPath('/admin/services')" class="text-[11px] text-muted hover:text-text">View all</a>
          </div>
          <div id="top-services" class="space-y-1"></div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div class="dashboard-card bg-surface border border-white/5 rounded-xl p-5 min-h-[230px]">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-[10px] font-bold text-text uppercase tracking-wider">Mechanic Workload</h3>
          </div>
          <div id="mechanic-workload-list" class="space-y-1"></div>
        </div>
        <div class="dashboard-card bg-surface border border-white/5 rounded-xl p-5 min-h-[230px] flex flex-col">
          <h3 class="text-[10px] font-bold text-text uppercase tracking-wider mb-3">Car Type Distribution</h3>
          <div id="chart-car-type-dist" class="flex-1"></div>
        </div>
        <div class="dashboard-card bg-surface border border-white/5 rounded-xl p-5 min-h-[230px]">
          <h3 class="text-[10px] font-bold text-text uppercase tracking-wider mb-3">Average Repair Time</h3>
          <div class="space-y-3 text-sm">
            <div class="flex items-center justify-between border-b border-white/5 pb-2">
              <span class="text-muted">Today</span>
              <span id="avg-repair-today" class="font-bold text-text">--</span>
            </div>
            <div class="flex items-center justify-between border-b border-white/5 pb-2">
              <span class="text-muted">Last 7 days</span>
              <span id="avg-repair-7d" class="font-bold text-text">--</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted">Last 30 days</span>
              <span id="avg-repair-30d" class="font-bold text-text">--</span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        <div class="dashboard-card bg-surface border border-white/5 rounded-xl p-5">
          <h3 class="text-[10px] font-bold text-text uppercase tracking-wider mb-3">Executive Insights</h3>
          <ul id="summary-signals" class="space-y-2.5">
            <li class="text-sm text-muted">No data</li>
          </ul>
        </div>
        <div class="dashboard-card bg-surface border border-white/5 rounded-xl p-5">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-[10px] font-bold text-text uppercase tracking-wider">Outstanding Debt</h3>
            <a href="/admin/customers" onclick="openAdminPath('/admin/customers')" class="text-[11px] text-muted hover:text-text">View all</a>
          </div>
          <div class="mb-3 flex items-center gap-3">
            <div>
              <div class="text-[10px] text-muted uppercase tracking-wider">Total</div>
              <div id="outstanding-total" class="text-sm font-bold text-danger">0.00 JOD</div>
            </div>
            <div class="pl-3 border-l border-white/10">
              <div class="text-[10px] text-muted uppercase tracking-wider">Count</div>
              <div id="outstanding-count" class="text-sm font-bold text-text">0</div>
            </div>
          </div>
          <div id="outstanding-top" class="space-y-1"></div>
        </div>
      </div>
    
      <!-- Quick Action Unified Modal -->
      <div id="qa-overlay" class="hidden fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <!-- modal content remains unchanged -->
        <div class="w-full max-w-xl bg-surface border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
          <div class="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-slate-900/50">
            <div>
              <h3 id="qa-title" class="text-base font-bold text-white">Quick Action</h3>
              <p id="qa-desc" class="text-xs text-muted mt-1">Complete this action instantly.</p>
            </div>
            <div class="flex items-center gap-4">
              <a id="qa-full-link" href="#" onclick="window.closeQuickAction()" class="text-[10px] text-muted font-bold uppercase tracking-wider hover:text-white transition-colors">Open Page</a>
              <button type="button" onclick="window.closeQuickAction()" class="text-muted hover:text-white w-8 h-8 flex items-center justify-center rounded-full bg-slate-950 border border-white/10 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          </div>
          <div class="p-6 overflow-y-auto bg-slate-950">
            <form id="qa-form-walkin" class="hidden space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="md:col-span-2">
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Item</label>
                  <select name="item" id="qa-walkin-item" required class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text">
                    <option value="">Select item</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Qty</label>
                  <input name="qty" type="number" min="1" value="1" required class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text" />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Customer</label>
                  <select name="customer" id="qa-walkin-customer" class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text">
                    <option value="">Walk-in</option>
                  </select>
                </div>
                <div class="md:col-span-2">
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Note</label>
                  <input name="note" class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text" />
                </div>
              </div>
              <div class="flex justify-end pt-4"><button type="submit" class="px-5 py-2.5 rounded-xl bg-white text-black font-bold text-sm hover:opacity-90 transition-opacity">Confirm Sale</button></div>
            </form>
            <form id="qa-form-expense" class="hidden space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Item Name</label>
                  <input name="itemName" required class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text" />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Category</label>
                  <select name="category" required class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text">
                    <option value="GENERAL">General</option>
                    <option value="SUPPLIER">Supplier</option>
                    <option value="SALARY">Salary</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Cost</label>
                  <input name="cost" type="number" min="0" step="0.01" required class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text" />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Qty</label>
                  <input name="qty" type="number" min="1" value="1" required class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text" />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Supplier</label>
                  <input name="supplier" class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text" />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Part</label>
                  <select name="item" id="qa-expense-item" class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text">
                    <option value="">No linked part</option>
                  </select>
                </div>
                <div class="md:col-span-2">
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Note</label>
                  <input name="note" class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text" />
                </div>
              </div>
              <div class="flex justify-end pt-4"><button type="submit" class="px-5 py-2.5 rounded-xl bg-danger text-white font-bold text-sm hover:opacity-90 transition-opacity">Log Expense</button></div>
            </form>
            <form id="qa-form-inventory" class="hidden space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Part Name</label>
                  <input name="name" required class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text" />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Vehicle Model</label>
                  <input name="model" required class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text" />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Type</label>
                  <select name="type" required class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text">
                    <option value="EV">EV</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="REGULAR">Regular</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Sell Price</label>
                  <input name="price" type="number" step="0.01" min="0" required class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text" />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Cost Price</label>
                  <input name="cost" type="number" step="0.01" min="0" class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text" />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Min Stock</label>
                  <input name="minStock" type="number" min="0" value="5" required class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text" />
                </div>
              </div>
              <div class="flex justify-end pt-4"><button type="submit" class="px-5 py-2.5 rounded-xl bg-white text-black font-bold text-sm hover:opacity-90 transition-opacity">Create Part</button></div>
            </form>
            <form id="qa-form-customer" class="hidden space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Full Name</label>
                  <input name="fullName" required class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text" />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Phone</label>
                  <input name="phone" required class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text" />
                </div>
                <div class="md:col-span-2">
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Location</label>
                  <input name="location" class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text" />
                </div>
                <div class="md:col-span-2">
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Initial Debt</label>
                  <input name="debt" type="number" step="0.01" min="0" class="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-text" />
                </div>
              </div>
              <div class="flex justify-end pt-4"><button type="submit" class="px-5 py-2.5 rounded-xl bg-white text-black font-bold text-sm hover:opacity-90 transition-opacity">Add Customer</button></div>
            </form>
          </div>
        </div>
      </div>

    </div>
  `;
}
