import { apiFetch } from '../../lib/api.js';
import { DateInput } from '../../components/ui/DateInput.js';
import { SimpleBarChart, SimpleDonutChart, MultiBarChart } from '../../components/ui/ChartWrapper.js';
import { KPISkeleton, ChartSkeleton, TableRowSkeleton } from '../../components/ui/Skeleton.js';

function formatJod(value) {
  return `${Number(value || 0).toFixed(2)} JOD`;
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
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  if (groupBy === 'week') {
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  }

  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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
        }
      } else {
        syncDateInputDisplay('date-from', thirtyDaysAgoStr);
        syncDateInputDisplay('date-to', todayStr);
      }
    } catch (e) {
      syncDateInputDisplay('date-from', thirtyDaysAgoStr);
      syncDateInputDisplay('date-to', todayStr);
    }

    const filterBtn = document.getElementById('filter-btn');
    if (filterBtn) {
      filterBtn.addEventListener('click', loadDashboard);
    }

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
      let groupBy = document.getElementById('group-by').value;

      // Force daily grouping if interval <= 60 days
      const d1 = new Date(from);
      const d2 = new Date(to);
      const diffTime = Math.abs(d2 - d1);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 60) {
        groupBy = 'day';
        document.getElementById('group-by').value = 'day';
      }

      currentGroupBy = groupBy;
      syncDateInputDisplay('date-from', from);
      syncDateInputDisplay('date-to', to);
      localStorage.setItem('dashboard_filters', JSON.stringify({ from, to, groupBy }));

      const displayMap = { day: 'Day', week: 'Week', month: 'Month' };
      document.getElementById('active-date-display').textContent = `Viewing: ${from} to ${to} (Grouped by ${displayMap[groupBy] || groupBy})`;

      setLoadingState();

      try {
        const [overviewRes, summaryRes, outstandingRes] = await Promise.all([
          apiFetch(`/admin/analytics/overview?from=${from}&to=${to}&groupBy=${groupBy}`),
          apiFetch(`/admin/analytics/ai-summary?from=${from}&to=${to}`),
          apiFetch('/admin/analytics/outstanding')
        ]);

        if (overviewRes) populateOverview(overviewRes);
        if (summaryRes) populateExecutiveSummary(summaryRes);
        if (outstandingRes) populateOutstanding(outstandingRes);
      } catch (e) {
        window.toast('Failed to load dashboard: ' + e.message, 'error');
      }
    }

    function setLoadingState() {
      ['adv-income', 'adv-expense', 'adv-profit', 'adv-orders', 'adv-avg'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = KPISkeleton();
      });

      const ids = [
        'snap-income', 'snap-expenses', 'snap-profit', 'snap-bookings', 'snap-employees',
        'period-income', 'period-expense', 'period-profit', 'period-bookings', 'period-avg',
        'funnel-new', 'funnel-returning', 'funnel-debt'
      ];
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<div class="skeleton h-8 w-24"></div>';
      });

      document.getElementById('alerts-low').innerHTML = '<div class="text-xs text-muted">Checking...</div>';
      document.getElementById('alerts-debt').innerHTML = '<div class="text-xs text-muted">Checking...</div>';
      document.getElementById('alerts-absent').innerHTML = '<div class="text-xs text-muted">Checking...</div>';

      document.getElementById('chart-timeseries').innerHTML = ChartSkeleton();
      document.getElementById('chart-donuts').innerHTML = ChartSkeleton();

      document.getElementById('outstanding-total').innerHTML = '<div class="skeleton h-8 w-24"></div>';
      document.getElementById('outstanding-count').innerHTML = '<div class="skeleton h-8 w-16"></div>';
      document.getElementById('outstanding-top').innerHTML = `<div class="skeleton h-10 w-full rounded-lg mb-2"></div><div class="skeleton h-10 w-full rounded-lg"></div>`;
    }

    function populateOverview(data) {
      const {
        kpis,
        timeseries,
        breakdowns,
        membership,
        top,
        todaySnapshot,
        customerFunnel,
        alerts,
        inventory
      } = data;

      const todayIncome = todaySnapshot?.income || 0;
      const todayExpenses = todaySnapshot?.expenses || 0;
      const todayProfit = todayIncome - todayExpenses;

      document.getElementById('snap-income').textContent = formatJod(todayIncome);
      document.getElementById('snap-expenses').textContent = formatJod(todayExpenses);

      const snapProfitEl = document.getElementById('snap-profit');
      if (snapProfitEl) {
        snapProfitEl.textContent = formatJod(todayProfit);
        snapProfitEl.className = `text-3xl font-bold ${todayProfit > 0 ? 'text-success' : todayProfit < 0 ? 'text-danger' : 'text-text'}`;
      }

      document.getElementById('snap-bookings').textContent = Number(todaySnapshot?.bookings || 0).toLocaleString();
      document.getElementById('snap-employees').textContent = Number(todaySnapshot?.activeEmployees || 0).toLocaleString();

      if (document.getElementById('period-income')) {
        const pIncome = kpis.totalIncome || 0;
        const pExpense = kpis.totalExpenses || 0;
        const pProfit = pIncome - pExpense;
        const pBookings = kpis.totalOrders || 0;
        const pAvg = pBookings > 0 ? (pIncome / pBookings) : 0;

        document.getElementById('period-income').textContent = formatJod(pIncome);
        document.getElementById('period-expense').textContent = formatJod(pExpense);

        const periodProfitEl = document.getElementById('period-profit');
        if (periodProfitEl) {
          periodProfitEl.textContent = formatJod(pProfit);
          periodProfitEl.className = `text-xl font-bold ${pProfit > 0 ? 'text-success' : pProfit < 0 ? 'text-danger' : 'text-text'}`;
        }

        document.getElementById('period-bookings').textContent = Number(pBookings).toLocaleString();
        document.getElementById('period-avg').textContent = formatJod(pAvg);
      }

      document.getElementById('funnel-new').textContent = Number(customerFunnel?.newCustomers || 0).toLocaleString();
      document.getElementById('funnel-returning').textContent = Number(customerFunnel?.returningCustomers || 0).toLocaleString();
      document.getElementById('funnel-debt').textContent = Number(customerFunnel?.customersWithDebt || 0).toLocaleString();

      const lowAlerts = alerts?.lowInventory || [];
      const debtAlerts = alerts?.overdueCustomerDebt || [];
      const absentAlerts = alerts?.absentEmployeesToday || [];

      document.getElementById('alerts-low').innerHTML = lowAlerts.length
        ? lowAlerts.map((item) => `<div class="text-xs text-text flex items-center justify-between py-1 border-b border-white/5 last:border-0"><span>${item.name}</span> <span class="text-amber-500 font-bold">${item.stockQty} left</span></div>`).join('')
        : '<div class="text-xs text-muted">No low inventory items.</div>';

      document.getElementById('alerts-debt').innerHTML = debtAlerts.length
        ? debtAlerts.map((item) => `<div class="text-xs text-text flex items-center justify-between py-1 border-b border-white/5 last:border-0"><span>${item.name}</span> <span class="text-danger font-bold">${formatJod(item.balanceDue)}</span></div>`).join('')
        : '<div class="text-xs text-muted">No overdue debt.</div>';

      document.getElementById('alerts-absent').innerHTML = absentAlerts.length
        ? absentAlerts.map((item) => `<div class="text-xs text-text py-1 border-b border-white/5 last:border-0">${item.name}</div>`).join('')
        : '<div class="text-xs text-muted">No absent employees.</div>';

      if (Array.isArray(timeseries) && timeseries.length > 0) {
        document.getElementById('chart-timeseries').innerHTML = MultiBarChart(
          timeseries.map(t => {
            return {
              label: formatBucketLabel(t.bucketStart, currentGroupBy),
              income: t.income,
              expenses: t.expenses,
              profit: t.income - t.expenses
            };
          }),
          { height: '250px', format: v => `${v.toFixed(0)} JOD` }
        );
      } else {
        document.getElementById('chart-timeseries').innerHTML =
          '<div class="h-[250px] flex items-center justify-center text-sm text-muted">No chart data for selected period.</div>';
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
            : [{ label: 'No Expenses', value: 1, color: 'var(--border)' }]
        );
      }

      if (document.getElementById('mem-new')) {
        document.getElementById('mem-new').textContent = Number(membership?.newCount || 0).toLocaleString();
        document.getElementById('mem-renewed').textContent = Number(membership?.renewedCount || 0).toLocaleString();
        document.getElementById('mem-expired').textContent = Number(membership?.expiredCount || 0).toLocaleString();
        document.getElementById('mem-rev').textContent = formatJod(membership?.membershipRevenue || 0);
      }

      const byRev = top?.services?.byRevenue?.slice(0, 3) || [];
      if (document.getElementById('top-services')) {
        document.getElementById('top-services').innerHTML = byRev.length
          ? byRev.map(s => `
          <div class="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
              <span class="font-medium text-text truncate">${s.serviceNameEn}</span>
              <span class="font-bold text-text">${formatJod(s.revenue)}</span>
            </div>
          `).join('')
          : '<div class="text-sm text-muted">No service records.</div>';
      }
    }

    function populateExecutiveSummary(data) {
      document.getElementById('summary-signals').innerHTML = (data.signals || []).slice(0, 3).map(s => `
        <li class="flex items-start gap-3">
          <div class="mt-1 min-w-[8px] h-2 w-2 rounded-full ${s.severity === 'high' ? 'bg-danger' : s.severity === 'medium' ? 'bg-amber-500' : 'bg-primary'}"></div>
          <div>
            <div class="font-bold text-sm text-text flex items-center gap-2">
              ${s.title}
              <span class="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/5 text-muted tracking-wider">${s.type}</span>
            </div>
            <div class="text-xs text-muted mt-0.5">${s.detail}</div>
          </div>
        </li>
      `).join('') || '<li class="text-sm text-muted">No insights generated for this period.</li>';
    }

    function populateOutstanding(data) {
      document.getElementById('outstanding-total').textContent = formatJod(data.totalOutstanding || 0);
      document.getElementById('outstanding-count').textContent = `${data.countCustomersWithDebt || 0} `;
      const top = data.topCustomersByDebt || [];
      document.getElementById('outstanding-top').innerHTML = top.length
        ? top.map(c => `
          <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0 text-sm">
              <div>
                <div class="font-semibold text-text">${c.fullName || c.phone || 'Customer'}</div>
                <div class="text-xs text-muted">${c.phone || '-'}</div>
              </div>
              <div class="font-bold text-danger">${formatJod(c.balanceDue)}</div>
            </div>
          `).join('')
        : `<div class="text-sm text-muted">No outstanding debt.</div>`;
    }
  };


  return `
    <div class="w-full max-w-7xl mx-auto flex flex-col gap-6">

      <!-- Top Filters -->
      <div class="flex flex-col md:flex-row gap-4 items-end bg-surface p-4 border border-white/5 rounded-2xl">
        <div class="flex-1 w-full flex flex-col sm:flex-row gap-4">
          <div class="flex-1 min-w-[140px]">
            <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">From Date</label>
            ${DateInput({ id: 'date-from', value: thirtyDaysAgoStr, className: 'bg-slate-950 border border-white/5 rounded-lg py-2 text-sm text-text outline-none focus:ring-1 focus:ring-primary' })}
          </div>
          <div class="flex-1 min-w-[140px]">
            <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">To Date</label>
            ${DateInput({ id: 'date-to', value: todayStr, className: 'bg-slate-950 border border-white/5 rounded-lg py-2 text-sm text-text outline-none focus:ring-1 focus:ring-primary' })}
          </div>
          <div class="flex-1 min-w-[140px]">
            <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Group By</label>
            <select id="group-by" class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-primary">
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>
        </div>
        <div class="flex gap-2">
          <button id="filter-btn" class="px-6 py-2 rounded-lg bg-text text-bg font-bold text-sm hover:opacity-90 transition-opacity">Apply Filters</button>
        </div>
      </div>

      <!-- Section 1: Today Snapshot -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div class="bg-surface rounded-2xl p-6 border border-white/5 flex flex-col justify-center">
          <p class="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Today Income</p>
          <div id="snap-income" class="text-3xl font-bold truncate">0.00 JOD</div>
        </div>
        <div class="bg-surface rounded-2xl p-6 border border-white/5 flex flex-col justify-center">
          <p class="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Today Expenses</p>
          <div id="snap-expenses" class="text-3xl font-bold truncate">0.00 JOD</div>
        </div>
        <div class="bg-surface rounded-2xl p-6 border border-white/5 flex flex-col justify-center">
          <p class="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Today Profit</p>
          <div id="snap-profit" class="text-3xl font-bold truncate">0.00 JOD</div>
        </div>
        <div class="bg-surface rounded-2xl p-6 border border-white/5 flex flex-col justify-center">
          <p class="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">New Bookings</p>
          <div id="snap-bookings" class="text-3xl font-bold text-text truncate">0</div>
        </div>
        <div class="bg-surface rounded-2xl p-6 border border-white/5 flex flex-col justify-center">
          <p class="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Active Employees</p>
          <div id="snap-employees" class="text-3xl font-bold text-text truncate">0</div>
        </div>
      </div>

      <!-- Section 2 + 3: Date Range Chart & Period Performance Row -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="lg:col-span-2 flex flex-col gap-4">
          <div class="bg-surface border border-white/5 rounded-2xl p-6 flex-1">
            <h3 class="font-bold text-text mb-6 flex items-center justify-between text-[10px] uppercase tracking-wider">
              <span>Income vs Expenses</span>
              <span id="active-date-display" class="text-muted font-normal normal-case">Viewing: - to -</span>
            </h3>
            <div id="chart-timeseries"></div>
          </div>
          
          <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
             <div class="bg-surface border border-white/5 rounded-xl p-4 flex flex-col justify-center items-center text-center">
               <div class="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Period Income</div>
               <div id="period-income" class="text-lg font-bold text-text truncate">0.00 JOD</div>
             </div>
             <div class="bg-surface border border-white/5 rounded-xl p-4 flex flex-col justify-center items-center text-center">
               <div class="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Period Expense</div>
               <div id="period-expense" class="text-lg font-bold text-text truncate">0.00 JOD</div>
             </div>
             <div class="bg-surface border border-white/5 rounded-xl p-4 flex flex-col justify-center items-center text-center">
               <div class="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Period Profit</div>
               <div id="period-profit" class="text-lg font-bold text-text truncate">0.00 JOD</div>
             </div>
             <div class="bg-surface border border-white/5 rounded-xl p-4 flex flex-col justify-center items-center text-center">
               <div class="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Bookings</div>
               <div id="period-bookings" class="text-lg font-bold text-text truncate">0</div>
             </div>
             <div class="bg-surface border border-white/5 rounded-xl p-4 flex flex-col justify-center items-center text-center">
               <div class="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Avg Order Value</div>
               <div id="period-avg" class="text-lg font-bold text-text truncate">0.00 JOD</div>
             </div>
          </div>
        </div>

        <div class="bg-surface border border-white/5 rounded-2xl p-6 flex flex-col gap-6">
          <div>
             <h3 class="font-bold text-text mb-6 pb-2 border-b border-white/5 text-[10px] uppercase tracking-wider">Expenses by Category</h3>
             <div id="chart-donuts" class="h-[250px]"></div>
          </div>
          <div class="flex-1 mt-4">
            <h3 class="font-bold text-text mb-4 text-[10px] uppercase tracking-wider">Customer Funnel</h3>
            <div class="grid grid-cols-3 gap-2 text-center">
              <div class="bg-bg rounded-lg py-3 border border-white/5"><div class="text-[10px] text-muted uppercase mb-1">New</div><div id="funnel-new" class="font-bold text-sm text-text">0</div></div>
              <div class="bg-bg rounded-lg py-3 border border-white/5"><div class="text-[10px] text-muted uppercase mb-1">Returning</div><div id="funnel-returning" class="font-bold text-sm text-text">0</div></div>
              <div class="bg-bg rounded-lg py-3 border border-white/5"><div class="text-[10px] text-muted uppercase mb-1">Debt</div><div id="funnel-debt" class="font-bold text-sm text-danger">0</div></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 4 & 5: Executive Insights & Quick Actions / Alerts -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        
        <!-- Summary & Top Widgets -->
        <div class="md:col-span-2 flex flex-col gap-4">
          <div class="bg-surface border border-white/5 rounded-2xl p-6">
             <div class="flex items-center gap-2 mb-4">
                <div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                </div>
                <h3 class="font-bold text-text text-[10px] uppercase tracking-wider">Executive Insights</h3>
             </div>
             <ul id="summary-signals" class="space-y-4">
                <li class="col-span-full"><div class="skeleton h-8 w-full rounded-lg"></div></li>
             </ul>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="bg-surface border border-white/5 rounded-2xl p-6">
                <h3 class="font-bold text-text mb-3 text-[10px] uppercase tracking-wider">Alerts & Notifications</h3>
                <div class="space-y-4 pt-2">
                  <div>
                    <h4 class="text-[10px] text-muted font-bold uppercase tracking-wider flex items-center gap-2 mb-1"><div class="w-1.5 h-1.5 rounded-full bg-amber-500"></div> Low Inventory</h4>
                    <div id="alerts-low" class="pl-3.5 border-l border-white/5 ml-0.5 space-y-1"></div>
                  </div>
                  <div>
                    <h4 class="text-[10px] text-muted font-bold uppercase tracking-wider flex items-center gap-2 mb-1"><div class="w-1.5 h-1.5 rounded-full bg-danger"></div> Overdue Debt</h4>
                    <div id="alerts-debt" class="pl-3.5 border-l border-white/5 ml-0.5 space-y-1"></div>
                  </div>
                  <div>
                    <h4 class="text-[10px] text-muted font-bold uppercase tracking-wider flex items-center gap-2 mb-1"><div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Employee Absences</h4>
                    <div id="alerts-absent" class="pl-3.5 border-l border-white/5 ml-0.5 space-y-1"></div>
                  </div>
                </div>
              </div>

              <div class="bg-surface border border-white/5 rounded-2xl p-6 flex flex-col">
                <h3 class="font-bold text-text mb-3 text-[10px] uppercase tracking-wider flex justify-between items-center">
                  Outstanding Debt 
                  <a href="/admin/customers" onclick="openAdminPath('/admin/customers')" class="text-[10px] text-primary hover:underline">View All</a>
                </h3>
                <div class="flex flex-col gap-1">
                  <div class="flex items-end gap-3 mb-2 flex-wrap">
                    <div>
                      <div class="text-[10px] text-muted uppercase tracking-wider">Total</div>
                      <div id="outstanding-total" class="text-sm font-bold text-danger">0.00 JOD</div>
                    </div>
                    <div class="px-3 border-l border-white/5">
                      <div class="text-[10px] text-muted uppercase tracking-wider">Count</div>
                      <div id="outstanding-count" class="text-sm font-bold text-text">0</div>
                    </div>
                  </div>
                  <div id="outstanding-top" class="border-t border-white/5 pt-2"></div>
                </div>
              </div>
          </div>
        </div>

        <!-- Quick Actions Column -->
        <div class="flex flex-col gap-4">
          <div class="bg-surface border border-white/5 rounded-2xl p-6">
            <h3 class="font-bold text-text mb-4 text-[10px] uppercase tracking-wider">Quick Actions</h3>
            <div class="flex flex-col gap-2">
              <button onclick="window.openQuickAction('WALKIN')" class="w-full text-left p-3 rounded-xl bg-success/5 border-l-2 border-l-success hover:bg-success/10 hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-3">
                 <div class="text-xs font-bold text-white">Walk-in Sale</div>
              </button>
              <button onclick="window.openQuickAction('EXPENSE')" class="w-full text-left p-3 rounded-xl bg-danger/5 border-l-2 border-l-danger hover:bg-danger/10 hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-3">
                 <div class="text-xs font-bold text-white">Add Expense</div>
              </button>
              <button onclick="window.openQuickAction('INVENTORY')" class="w-full text-left p-3 rounded-xl bg-primary/5 border-l-2 border-l-primary hover:bg-primary/10 hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-3">
                 <div class="text-xs font-bold text-white">Add Inventory</div>
              </button>
              <button onclick="window.openQuickAction('CUSTOMER')" class="w-full text-left p-3 rounded-xl bg-indigo-500/5 border-l-2 border-l-indigo-500 hover:bg-indigo-500/10 hover:-translate-y-0.5 transition-all duration-200 flex items-center gap-3">
                 <div class="text-xs font-bold text-white">Create Customer</div>
              </button>
            </div>
          </div>
          <div class="bg-surface border border-white/5 rounded-2xl p-6 flex flex-col">
            <h3 class="font-bold text-text mb-3 text-[10px] uppercase tracking-wider">Top Services</h3>
            <div id="top-services" class="flex-1 space-y-2 mt-2">
               <div class="skeleton h-8 w-full"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Action Unified Modal -->
      <div id="qa-overlay" class="hidden fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="w-full max-w-xl bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
          <div class="flex items-center justify-between px-6 py-5 border-b border-white/5">
            <div>
              <h3 id="qa-title" class="text-base font-bold text-text">Quick Action</h3>
              <p id="qa-desc" class="text-xs text-muted mt-1">Complete this action instantly.</p>
            </div>
            <div class="flex items-center gap-4">
              <a id="qa-full-link" href="#" onclick="window.closeQuickAction()" class="text-[10px] text-muted font-bold uppercase tracking-wider hover:text-text transition-colors">Open Page</a>
              <button type="button" onclick="window.closeQuickAction()" class="text-muted hover:text-text w-8 h-8 flex items-center justify-center rounded-full bg-bg border border-white/5 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
          </div>
          
          <div class="p-6 overflow-y-auto">
            
            <form id="qa-form-walkin" class="hidden space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Item</label>
                  <select name="item" id="qa-walkin-item" required class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-primary">
                    <option value="">Loading items...</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Qty</label>
                  <input name="qty" type="number" min="1" value="1" required class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-primary">
                </div>
                <div class="md:col-span-2">
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Customer</label>
                  <select name="customer" id="qa-walkin-customer" class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-primary">
                    <option value="">Walk-in Customer...</option>
                  </select>
                </div>
                <div class="md:col-span-2">
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Note (optional)</label>
                  <input name="note" class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-primary">
                </div>
              </div>
              <div class="flex justify-end pt-4">
                <button type="submit" class="px-5 py-2.5 rounded-xl bg-text text-bg font-bold text-sm hover:opacity-90 transition-opacity">Confirm Sale</button>
              </div>
            </form>

            <form id="qa-form-expense" class="hidden space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Item / Name</label>
                  <input name="itemName" required class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-danger">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Category</label>
                  <select name="category" required class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-danger">
                    <option value="GENERAL">General Operational</option>
                    <option value="SUPPLIER">Supplier / Parts</option>
                    <option value="SALARY">Payroll / Salary</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Total Cost</label>
                  <input name="cost" type="number" step="0.01" min="0" required class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-danger">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Quantity</label>
                  <input name="qty" type="number" min="1" value="1" required class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-danger">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Supplier (optional)</label>
                  <input name="supplier" class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-danger">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Related Part</label>
                  <select name="item" id="qa-expense-item" class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-danger">
                    <option value="">None...</option>
                  </select>
                </div>
                <div class="md:col-span-2">
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Note (optional)</label>
                  <input name="note" class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-danger">
                </div>
              </div>
              <div class="flex justify-end pt-4">
                <button type="submit" class="px-5 py-2.5 rounded-xl bg-danger text-white font-bold text-sm hover:opacity-90 transition-opacity">Log Expense</button>
              </div>
            </form>

            <form id="qa-form-inventory" class="hidden space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Part Name</label>
                  <input name="name" required class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-text">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Vehicle Model</label>
                  <input name="model" required placeholder="Ex: Toyota Camry" class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-text">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Cost Price (JOD)</label>
                  <input name="cost" type="number" step="0.01" min="0" class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-text">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Sell Price (JOD)</label>
                  <input name="price" type="number" step="0.01" min="0" required class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-text">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Vehicle Type</label>
                  <select name="type" required class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-text">
                    <option value="EV">EV (Electric)</option>
                    <option value="HYBRID">Hybrid</option>
                    <option value="REGULAR">Regular Fuel</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Min. Stock Alert</label>
                  <input name="minStock" type="number" min="0" value="5" required class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-text">
                </div>
              </div>
              <div class="flex justify-end pt-4">
                <button type="submit" class="px-5 py-2.5 rounded-xl bg-text text-bg font-bold text-sm hover:opacity-90 transition-opacity">Create Part</button>
              </div>
            </form>

            <form id="qa-form-customer" class="hidden space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Full Name</label>
                  <input name="fullName" required class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-text">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Phone</label>
                  <input name="phone" required pattern="07[0-9]{8}" placeholder="07XXXXXXXX" class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-text">
                </div>
                <div class="md:col-span-2">
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Location / Address</label>
                  <input name="location" class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-text">
                </div>
                <div class="md:col-span-2">
                  <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Initial Outstanding Debt (optional)</label>
                  <input name="debt" type="number" step="0.01" min="0" class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-text outline-none focus:ring-1 focus:ring-text">
                </div>
              </div>
              <div class="flex justify-end pt-4">
                <button type="submit" class="px-5 py-2.5 rounded-xl bg-text text-bg font-bold text-sm hover:opacity-90 transition-opacity">Add Customer</button>
              </div>
            </form>

          </div>
        </div>
      </div>
    </div>
  `;
}
