import { apiFetch } from '../../lib/api.js';
import { SimpleBarChart, SimpleDonutChart } from '../../components/ui/ChartWrapper.js';
import { KPISkeleton, ChartSkeleton, TableRowSkeleton } from '../../components/ui/Skeleton.js';

export function AdminAnalytics() {

    window.onMount = async () => {
        // Default dates (Last 30 Days)
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        document.getElementById('date-to').value = today.toISOString().split('T')[0];
        document.getElementById('date-from').value = thirtyDaysAgo.toISOString().split('T')[0];

        document.getElementById('filter-btn').addEventListener('click', loadDashboard);
        document.getElementById('copy-ai-data').addEventListener('click', copyAiData);
        document.getElementById('export-tx').addEventListener('click', () => exportCSV('transactions'));
        document.getElementById('export-bk').addEventListener('click', () => exportCSV('bookings'));

        let currentAiData = null;

        loadDashboard();

        async function loadDashboard() {
            const from = document.getElementById('date-from').value;
            const to = document.getElementById('date-to').value;
            const groupBy = document.getElementById('group-by').value;

            setLoadingState();

            try {
                const [overviewRes, aiSummaryRes, outstandingRes] = await Promise.all([
                    apiFetch(`/admin/analytics/overview?from=${from}&to=${to}&groupBy=${groupBy}`),
                    apiFetch(`/admin/analytics/ai-summary?from=${from}&to=${to}`),
                    apiFetch('/admin/analytics/outstanding')
                ]);

                if (overviewRes) populateOverview(overviewRes);
                if (aiSummaryRes) {
                    populateAISummary(aiSummaryRes);
                    currentAiData = aiSummaryRes.compactData;
                }
                if (outstandingRes) {
                    populateOutstanding(outstandingRes);
                }

            } catch (e) {
                window.toast('Failed to load analytics: ' + e.message, 'error');
            }
        }

        function setLoadingState() {
            ['kpi-income', 'kpi-expense', 'kpi-profit', 'kpi-orders', 'kpi-avg'].forEach(id => {
                document.getElementById(id).innerHTML = KPISkeleton();
            });
            document.getElementById('chart-timeseries').innerHTML = ChartSkeleton();
            document.getElementById('chart-donuts').innerHTML = ChartSkeleton();
            document.getElementById('outstanding-total').textContent = '...';
            document.getElementById('outstanding-count').textContent = '...';
            document.getElementById('outstanding-top').innerHTML = `<div class="skeleton h-8 w-full rounded mb-2"></div><div class="skeleton h-8 w-full rounded"></div>`;
        }

        function populateOverview(data) {
            const { kpis, timeseries, breakdowns, membership, top, recent } = data;

            // KPIs
            document.getElementById('kpi-income').innerHTML = renderKpi('Total Income', `${kpis.totalIncome.toFixed(2)} JOD`, 'success', 'arrow-up');
            document.getElementById('kpi-expense').innerHTML = renderKpi('Total Expenses', `${kpis.totalExpenses.toFixed(2)} JOD`, 'danger', 'arrow-down');
            document.getElementById('kpi-profit').innerHTML = renderKpi('Total Profit', `${kpis.totalProfit.toFixed(2)} JOD`, 'primary', 'cash');
            document.getElementById('kpi-orders').innerHTML = renderKpi('Total Orders', kpis.totalOrders, 'muted', 'clipboard');
            document.getElementById('kpi-avg').innerHTML = renderKpi('Avg Order Value', `${kpis.avgOrderValue.toFixed(2)} JOD`, 'muted', 'chart-bar');

            // Charts (Simple implementations tailored to our wrapper format)
            if (timeseries && timeseries.length) {
                document.getElementById('chart-timeseries').innerHTML = SimpleBarChart(
                    timeseries.map(t => ({ label: t.bucketStart.substring(5), value: t.income })),
                    { color: 'var(--primary)', height: '250px', format: v => `${v.toFixed(0)} JOD` }
                );
            }

            if (breakdowns.expensesByCategory) {
                const colors = ['var(--danger)', '#F59E0B', '#10B981'];
                document.getElementById('chart-donuts').innerHTML = SimpleDonutChart(
                    breakdowns.expensesByCategory.map((c, i) => ({ label: c.category, value: c.amount, color: colors[i % colors.length] }))
                );
            }

            // Membership
            document.getElementById('mem-new').textContent = membership.newCount;
            document.getElementById('mem-renewed').textContent = membership.renewedCount;
            document.getElementById('mem-expired').textContent = membership.expiredCount;
            document.getElementById('mem-rev').textContent = `${membership.membershipRevenue.toFixed(2)} JOD`;

            // Top Performers
            const byRev = top.services.byRevenue.slice(0, 3);
            document.getElementById('top-services').innerHTML = byRev.map(s => `
        <div class="flex justify-between text-sm py-2 border-b border-border last:border-0">
          <span class="font-medium text-text">${s.serviceNameEn}</span>
          <span class="font-bold text-primary">${s.revenue.toFixed(2)} JOD</span>
        </div>
      `).join('');

            document.getElementById('top-employees').innerHTML = top.employees.slice(0, 3).map(e => `
        <div class="flex justify-between items-center text-sm py-2 border-b border-border last:border-0">
          <div><span class="font-medium text-text">${e.name}</span> <span class="text-xs text-muted ml-1 inline-block">★ ${e.ratingAvg || '-'}</span></div>
          <span class="font-bold text-text">${e.handledOrders} ord</span>
        </div>
      `).join('');
        }

        function populateAISummary(data) {
            document.getElementById('ai-pulse').classList.remove('animate-pulse', 'bg-primary/20');
            document.getElementById('ai-pulse').classList.add('bg-primary/10');
            document.getElementById('ai-summary-text').innerHTML = `<p class="text-sm leading-relaxed">${data.summaryText}</p>`;

            const badgeColors = {
                low: 'bg-green-500/10 text-green-500 border-green-500/20',
                medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
                high: 'bg-red-500/10 text-red-500 border-red-500/20'
            };

            document.getElementById('ai-signals').innerHTML = data.signals.map(s => `
        <div class="border border-border rounded-lg p-3 bg-bg">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${badgeColors[s.severity] || badgeColors.low}">${s.severity} ${s.type}</span>
            <span class="font-semibold text-sm text-text truncate">${s.title}</span>
          </div>
          <p class="text-xs text-muted leading-relaxed">${s.detail}</p>
        </div>
      `).join('');
        }

        function populateOutstanding(data) {
            document.getElementById('outstanding-total').textContent = `${Number(data.totalOutstanding || 0).toFixed(2)} JOD`;
            document.getElementById('outstanding-count').textContent = `${data.countCustomersWithDebt || 0}`;
            const top = data.topCustomersByDebt || [];
            document.getElementById('outstanding-top').innerHTML = top.length
                ? top.map(c => `
                    <div class="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                      <div>
                        <div class="font-semibold text-text">${c.fullName || c.phone || 'Customer'}</div>
                        <div class="text-xs text-muted">${c.phone || '-'}</div>
                      </div>
                      <div class="font-bold text-danger">${Number(c.balanceDue).toFixed(2)}</div>
                    </div>
                  `).join('')
                : `<div class="text-sm text-muted py-3">No outstanding debt.</div>`;
        }

        function renderKpi(title, value, intent, icon) {
            const intentFmt = {
                primary: 'text-primary bg-primary/10',
                success: 'text-success bg-success/10',
                danger: 'text-danger bg-danger/10',
                muted: 'text-muted bg-muted/10'
            };

            return `
        <div class="bg-surface rounded-2xl p-6 border border-border shadow-sm">
          <p class="text-xs font-bold text-muted uppercase tracking-wider mb-2">${title}</p>
          <div class="flex items-end justify-between">
            <h4 class="text-2xl font-heading font-bold text-text truncate">${value}</h4>
            <div class="w-10 h-10 rounded-full flex items-center justify-center ${intentFmt[intent]} shrink-0">
               <!-- Generic generic icon placeholder -->
               <div class="w-3 h-3 rounded-full bg-current"></div>
            </div>
          </div>
        </div>
      `;
        }

        function copyAiData() {
            if (currentAiData) {
                navigator.clipboard.writeText(JSON.stringify(currentAiData, null, 2));
                window.toast('Compact data copied to clipboard', 'success');
            }
        }

        function exportCSV(type) {
            const from = document.getElementById('date-from').value;
            const to = document.getElementById('date-to').value;
            window.open(`/api/admin/reports/export-${type}?from=${from}&to=${to}`, '_blank');
        }
    };

    return `
    <div class="w-full max-w-7xl mx-auto flex flex-col gap-6">
      
      <!-- Top Filters -->
      <div class="flex flex-col md:flex-row gap-4 items-end bg-surface p-4 rounded-2xl border border-border">
        <div class="flex-1 w-full flex flex-col sm:flex-row gap-4">
          <div class="flex-1">
            <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">From Data</label>
            <input type="date" id="date-from" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary text-text">
          </div>
          <div class="flex-1">
            <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">To Date</label>
            <input type="date" id="date-to" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary text-text">
          </div>
          <div class="flex-1">
            <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Group By</label>
            <select id="group-by" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary text-text">
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>
        </div>
        <div class="flex gap-2">
          <button id="filter-btn" class="bg-primary hover:bg-primary-hover text-white px-6 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm">Apply Filters</button>
        </div>
      </div>

      <!-- AI Summary Banner -->
      <div class="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-1 relative overflow-hidden shadow-lg border border-indigo-500/30">
        <div class="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20"></div>
        <div class="bg-surface/95 backdrop-blur-md rounded-xl p-6 relative z-10">
          <div class="flex items-center justify-between mb-4 border-b border-border/50 pb-4">
             <div class="flex items-center gap-3">
               <div id="ai-pulse" class="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center animate-pulse">
                 <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
               </div>
               <div>
                 <h2 class="font-heading font-bold text-lg text-text">AI Executive Summary</h2>
                 <p class="text-xs text-muted">Analysis generated across selected date range</p>
               </div>
             </div>
             <button id="copy-ai-data" class="text-xs font-semibold px-3 py-1.5 border border-border rounded bg-bg hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-text">Copy Context Data</button>
          </div>
          
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div id="ai-summary-text" class="lg:col-span-2 text-text">
              <!-- JS loaded -->
              <div class="skeleton h-4 w-full mb-2"></div>
              <div class="skeleton h-4 w-5/6 mb-2"></div>
              <div class="skeleton h-4 w-4/6"></div>
            </div>
            <div id="ai-signals" class="flex flex-col gap-2">
              <div class="skeleton h-20 w-full rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- KPIs -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div id="kpi-income"></div>
        <div id="kpi-expense"></div>
        <div id="kpi-profit"></div>
        <div id="kpi-orders"></div>
        <div id="kpi-avg"></div>
      </div>

      <div class="bg-surface border border-border rounded-2xl p-6">
        <div class="flex items-center justify-between border-b border-border pb-3 mb-4">
          <h3 class="font-bold text-text text-sm uppercase tracking-wider">Outstanding Debt</h3>
          <a href="/admin/customers" onclick="navigate(event, '/admin/customers')" class="text-xs font-semibold text-primary hover:text-primary-hover">Open Customers</a>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="rounded-xl border border-border p-4 bg-bg">
            <div class="text-xs text-muted uppercase tracking-wider">Total Outstanding</div>
            <div id="outstanding-total" class="text-2xl font-bold text-danger mt-1">0.00 JOD</div>
          </div>
          <div class="rounded-xl border border-border p-4 bg-bg">
            <div class="text-xs text-muted uppercase tracking-wider">Customers with Debt</div>
            <div id="outstanding-count" class="text-2xl font-bold text-text mt-1">0</div>
          </div>
          <div class="rounded-xl border border-border p-4 bg-bg">
            <div class="text-xs text-muted uppercase tracking-wider mb-2">Top by Debt</div>
            <div id="outstanding-top"></div>
          </div>
        </div>
      </div>

      <!-- Main Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 bg-surface border border-border rounded-2xl p-6">
          <h3 class="font-bold text-text mb-6 pb-2 border-b border-border text-sm uppercase tracking-wider">Income Timeseries</h3>
          <div id="chart-timeseries"></div>
        </div>
        
        <div class="bg-surface border border-border rounded-2xl p-6">
          <h3 class="font-bold text-text mb-6 pb-2 border-b border-border text-sm uppercase tracking-wider">Expenses by Category</h3>
          <div id="chart-donuts" class="h-[250px]"></div>
        </div>
      </div>

      <!-- Bottom Grids -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <!-- Membership Snapshot -->
        <div class="bg-surface border border-border rounded-2xl p-6">
           <h3 class="font-bold text-text mb-4 text-sm uppercase tracking-wider border-b border-border pb-2">Membership Flow</h3>
           <div class="grid grid-cols-2 gap-4 mt-6">
             <div class="p-3 bg-bg rounded-xl border border-border text-center">
               <div class="text-xs text-muted uppercase font-bold tracking-wider mb-1">New</div>
               <div id="mem-new" class="text-xl font-bold text-primary">0</div>
             </div>
             <div class="p-3 bg-bg rounded-xl border border-border text-center">
               <div class="text-xs text-muted uppercase font-bold tracking-wider mb-1">Renewed</div>
               <div id="mem-renewed" class="text-xl font-bold text-purple-500">0</div>
             </div>
             <div class="p-3 bg-bg rounded-xl border border-border text-center">
               <div class="text-xs text-muted uppercase font-bold tracking-wider mb-1">Expired</div>
               <div id="mem-expired" class="text-xl font-bold text-danger">0</div>
             </div>
             <div class="p-3 bg-bg rounded-xl border border-border text-center">
               <div class="text-xs text-muted uppercase font-bold tracking-wider mb-1">Revenue</div>
               <div id="mem-rev" class="text-xl font-bold text-success">0</div>
             </div>
           </div>
        </div>

        <!-- Top Services -->
        <div class="bg-surface border border-border rounded-2xl p-6 flex flex-col">
           <h3 class="font-bold text-text mb-4 text-sm uppercase tracking-wider border-b border-border pb-2">Top Services (Revenue)</h3>
           <div id="top-services" class="flex-1 flex flex-col gap-1 justify-center relative">
              <div class="skeleton h-10 w-full mb-2"></div><div class="skeleton h-10 w-full mb-2"></div>
           </div>
        </div>

        <!-- Top Employees -->
        <div class="bg-surface border border-border rounded-2xl p-6 flex flex-col">
           <h3 class="font-bold text-text mb-4 text-sm uppercase tracking-wider border-b border-border pb-2">Employee Leaderboard</h3>
           <div id="top-employees" class="flex-1 flex flex-col gap-1 justify-center relative">
              <div class="skeleton h-10 w-full mb-2"></div><div class="skeleton h-10 w-full mb-2"></div>
           </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="flex items-center justify-end gap-3 pb-8">
        <button id="export-tx" class="px-5 py-2.5 bg-surface border border-border hover:border-text text-text font-semibold rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          Export Transactions (CSV)
        </button>
        <button id="export-bk" class="px-5 py-2.5 bg-surface border border-border hover:border-text text-text font-semibold rounded-lg text-sm transition-colors flex items-center gap-2 shadow-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          Export Bookings (CSV)
        </button>
      </div>

    </div>
  `;
}
