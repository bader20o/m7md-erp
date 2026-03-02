const fs = require('fs');
const path = require('path');

const analyticsPath = 'c:/Users/bkhwe/final_mohammad/frontend/src/pages/admin/Analytics.js';
const replaceUIPath = 'c:/Users/bkhwe/final_mohammad/replaceUI.js';

const htmlSource = fs.readFileSync(replaceUIPath, 'utf8');
const htmlStart = htmlSource.indexOf('<div class="w-full max-w-7xl');
if (htmlStart === -1) {
    console.error('Could not find HTML start in replaceUI.js');
    process.exit(1);
}
let htmlContent = `  return \`
    ` + htmlSource.substring(htmlStart);
// remove the trailing `;\n}\n` from replaceUI.js if it exists, or just ensure it ends correctly.
// replaceUI.js ends with `;\n}\n`;

const newJs = `import { apiFetch } from '../../lib/api.js';
import { DateInput } from '../../components/ui/DateInput.js';
import { SimpleBarChart, SimpleDonutChart } from '../../components/ui/ChartWrapper.js';
import { KPISkeleton, ChartSkeleton, TableRowSkeleton } from '../../components/ui/Skeleton.js';

function formatJod(value) {
  return \`\${Number(value || 0).toFixed(2)} JOD\`;
}

function openAdminPath(path) {
  if (typeof window.navigate === 'function') {
    window.navigate(null, path);
    return;
  }
  window.location.href = path;
}

export function AdminAnalytics() {

  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const todayStr = today.toISOString().split('T')[0];
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  let activeQuickAction = null;

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
      transactions: \`/api/admin/reports/export-transactions?from=\${from}&to=\${to}\`,
      bookings: \`/api/admin/reports/export-bookings?from=\${from}&to=\${to}\`,
      inventory: '/api/admin/reports/export-inventory',
      accounting: \`/api/admin/reports/export-accounting?from=\${from}&to=\${to}\`,
      reconciliation: \`/api/admin/reports/export-reconciliation?from=\${from}&to=\${to}\`
    };

    window.open(routes[type], '_blank');
  };

  window.onMount = async () => {
    let parts = [];
    let customers = [];

    try {
      const saved = JSON.parse(localStorage.getItem('dashboard_filters'));
      if (saved) {
        if (saved.from) document.getElementById('date-from').value = saved.from;
        if (saved.to) document.getElementById('date-to').value = saved.to;
        if (saved.groupBy) document.getElementById('group-by').value = saved.groupBy;
      }
    } catch (e) { }

    document.getElementById('filter-btn').addEventListener('click', loadDashboard);

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
        ...parts.map(p => \`<option value="\${p.id}">\${p.name} - \${p.vehicleModel || ''} (\${p.sellPrice || 0} JOD)</option>\`)
      ].join('');

      const customerOptions = [
        '<option value="">Walk-in Customer (No Profile)...</option>',
        ...customers.map(c => \`<option value="\${c.id}">\${c.fullName || c.phone} (\${c.phone})</option>\`)
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
            number: \`SALE-\${Date.now()}\`,
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
      const from = document.getElementById('date-from').value;
      const to = document.getElementById('date-to').value;
      const groupBy = document.getElementById('group-by').value;

      localStorage.setItem('dashboard_filters', JSON.stringify({ from, to, groupBy }));

      const displayMap = { day: 'Day', week: 'Week', month: 'Month' };
      document.getElementById('active-date-display').textContent = \`Viewing: \${from} to \${to} (Grouped by \${displayMap[groupBy] || groupBy})\`;

      setLoadingState();

      try {
        const [overviewRes, summaryRes, outstandingRes] = await Promise.all([
          apiFetch(\`/admin/analytics/overview?from=\${from}&to=\${to}&groupBy=\${groupBy}\`),
          apiFetch(\`/admin/analytics/ai-summary?from=\${from}&to=\${to}\`),
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
        'snap-income', 'snap-expenses', 'snap-bookings', 'snap-employees',
        'funnel-new', 'funnel-returning', 'funnel-debt'
      ];
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<div class="skeleton h-8 w-24"></div>';
      });

      document.getElementById('alerts-low').innerHTML = '<div class="skeleton h-10 w-full rounded-lg"></div>';
      document.getElementById('alerts-debt').innerHTML = '<div class="skeleton h-10 w-full rounded-lg"></div>';
      document.getElementById('alerts-absent').innerHTML = '<div class="skeleton h-10 w-full rounded-lg"></div>';

      document.getElementById('chart-timeseries').innerHTML = ChartSkeleton();
      document.getElementById('chart-donuts').innerHTML = ChartSkeleton();

      document.getElementById('outstanding-total').innerHTML = '<div class="skeleton h-8 w-24"></div>';
      document.getElementById('outstanding-count').innerHTML = '<div class="skeleton h-8 w-16"></div>';
      document.getElementById('outstanding-top').innerHTML = \`<div class="skeleton h-10 w-full rounded-lg mb-2"></div><div class="skeleton h-10 w-full rounded-lg"></div>\`;
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

      document.getElementById('snap-income').textContent = formatJod(todaySnapshot?.income || 0);
      document.getElementById('snap-expenses').textContent = formatJod(todaySnapshot?.expenses || 0);
      document.getElementById('snap-bookings').textContent = Number(todaySnapshot?.bookings || 0).toLocaleString();
      document.getElementById('snap-employees').textContent = Number(todaySnapshot?.activeEmployees || 0).toLocaleString();

      if (document.getElementById('adv-income')) {
        document.getElementById('adv-income').textContent = formatJod(kpis.totalIncome);
        document.getElementById('adv-expense').textContent = formatJod(kpis.totalExpenses);
        document.getElementById('adv-profit').textContent = formatJod(kpis.totalProfit);
        document.getElementById('adv-orders').textContent = Number(kpis.totalOrders || 0).toLocaleString();
        document.getElementById('adv-avg').textContent = formatJod(kpis.avgOrderValue);
      }

      document.getElementById('funnel-new').textContent = Number(customerFunnel?.newCustomers || 0).toLocaleString();
      document.getElementById('funnel-returning').textContent = Number(customerFunnel?.returningCustomers || 0).toLocaleString();
      document.getElementById('funnel-debt').textContent = Number(customerFunnel?.customersWithDebt || 0).toLocaleString();

      const lowAlerts = alerts?.lowInventory || [];
      const debtAlerts = alerts?.overdueCustomerDebt || [];
      const absentAlerts = alerts?.absentEmployeesToday || [];

      document.getElementById('alerts-low').innerHTML = lowAlerts.length
        ? lowAlerts.map((item) => \`<div class="text-xs bg-bg border border-border rounded-lg px-3 py-2 text-text flex items-center justify-between"><span>\${item.name}</span> <span class="text-amber-500 font-bold">\${item.stockQty} left</span></div>\`).join('')
        : '<div class="text-xs text-muted">No alerts.</div>';

      document.getElementById('alerts-debt').innerHTML = debtAlerts.length
        ? debtAlerts.map((item) => \`<div class="text-xs bg-bg border border-border rounded-lg px-3 py-2 text-text flex items-center justify-between"><span>\${item.name}</span> <span class="text-danger font-bold">\${formatJod(item.balanceDue)}</span></div>\`).join('')
        : '<div class="text-xs text-muted">No alerts.</div>';

      document.getElementById('alerts-absent').innerHTML = absentAlerts.length
        ? absentAlerts.map((item) => \`<div class="text-xs bg-bg border border-border rounded-lg px-3 py-2 text-text">\${item.name}</div>\`).join('')
        : '<div class="text-xs text-muted">No alerts.</div>';

      if (timeseries && timeseries.length) {
        document.getElementById('chart-timeseries').innerHTML = SimpleBarChart(
          timeseries.map(t => ({ label: t.bucketStart.substring(5), value: t.income })),
          { color: 'var(--success)', height: '250px', format: v => \`\${v.toFixed(0)} JOD\` }
        );
      }

      if (breakdowns?.expensesByCategory && document.getElementById('chart-donuts')) {
        const colors = ['var(--danger)', 'var(--amber-500)', 'var(--primary)'];
        document.getElementById('chart-donuts').innerHTML = SimpleDonutChart(
          breakdowns.expensesByCategory.map((c, i) => ({ label: c.category, value: c.amount, color: colors[i % colors.length] }))
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
          ? byRev.map(s => \`
            <div class="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
              <span class="font-medium text-text truncate">\${s.serviceNameEn}</span>
              <span class="font-bold text-text">\${formatJod(s.revenue)}</span>
            </div>
        \`).join('')
          : '<div class="text-sm text-muted">No service records.</div>';
      }
    }

    function populateExecutiveSummary(data) {
      document.getElementById('summary-signals').innerHTML = (data.signals || []).map(s => \`
        <div class="bg-bg border border-white/5 rounded-2xl p-4 flex flex-col justify-center">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-2 h-2 rounded-full \${s.severity === 'high' ? 'bg-danger' : s.severity === 'medium' ? 'bg-amber-500' : 'bg-primary'}"></div>
              <span class="text-[10px] uppercase font-bold text-muted tracking-wider">\${s.type}</span>
            </div>
            <div class="font-bold text-sm text-text mb-1">\${s.title}</div>
            <div class="text-xs text-muted leading-relaxed">\${s.detail}</div>
        </div>
      \`).join('') || '<div class="text-sm text-muted col-span-3">No insights generated for this period.</div>';
    }

    function populateOutstanding(data) {
      document.getElementById('outstanding-total').textContent = formatJod(data.totalOutstanding || 0);
      document.getElementById('outstanding-count').textContent = \`\${data.countCustomersWithDebt || 0}\`;
      const top = data.topCustomersByDebt || [];
      document.getElementById('outstanding-top').innerHTML = top.length
        ? top.map(c => \`
            <div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0 text-sm">
              <div>
                <div class="font-semibold text-text">\${c.fullName || c.phone || 'Customer'}</div>
                <div class="text-xs text-muted">\${c.phone || '-'}</div>
              </div>
              <div class="font-bold text-danger">\${formatJod(c.balanceDue)}</div>
            </div>
          \`).join('')
        : \`<div class="text-sm text-muted">No outstanding debt.</div>\`;
    }
  };

\n`;

const fullOutput = newJs + htmlContent;
fs.writeFileSync(analyticsPath, fullOutput, 'utf8');
console.log('Analytics.js successfully built!');
