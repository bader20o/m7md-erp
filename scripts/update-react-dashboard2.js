const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../frontend/src/pages/admin/Analytics.js');
let code = fs.readFileSync(targetFile, 'utf8');

// 1. setLoadingState replacement
const loadingStateStart = code.indexOf('function setLoadingState() {');
const populateOverviewStart = code.indexOf('function populateOverview(data) {');
if (loadingStateStart !== -1 && populateOverviewStart !== -1) {
  const newLoading = `function setLoadingState() {
      ['adv-income', 'adv-expense', 'adv-profit', 'adv-orders', 'adv-avg'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = KPISkeleton();
      });

      const ids = [
        'snap-income', 'snap-expenses', 'snap-profit', 'snap-bookings', 'snap-employees',
        'period-income', 'period-expense', 'period-profit', 'period-bookings', 'period-avg',
        'funnel-new', 'funnel-returning', 'funnel-debt',
        'mem-new', 'mem-active', 'mem-expiring'
      ];
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<div class="skeleton h-8 w-24"></div>';
      });

      if (document.getElementById('alerts-center')) document.getElementById('alerts-center').innerHTML = '<div class="text-xs text-muted">Checking...</div>';
      
      const charIds = ['chart-timeseries', 'chart-donuts', 'chart-today-revenue', 'chart-profit-trend', 'chart-status-dist'];
      charIds.forEach(id => {
         const el = document.getElementById(id);
         if (el) el.innerHTML = ChartSkeleton ? ChartSkeleton() : '';
      });

      const listIds = ['today-services', 'waiting-customers', 'top-employees', 'top-services'];
      listIds.forEach(id => {
         const el = document.getElementById(id);
         if (el) el.innerHTML = '<div class="skeleton h-10 w-full mb-2"></div><div class="skeleton h-10 w-full"></div>';
      });

      if (document.getElementById('outstanding-top')) document.getElementById('outstanding-top').innerHTML = '<div class="skeleton h-10 w-full rounded-lg mb-2"></div><div class="skeleton h-10 w-full rounded-lg"></div>';
    }

    `;
  code = code.slice(0, loadingStateStart) + newLoading + code.slice(populateOverviewStart);
}

// 2. populateOverview Injection
const populateEnd = code.indexOf('function populateExecutiveSummary');
if (populateEnd !== -1) {
  // Let's inject right before function populateExecutiveSummary
  const injectCode = `
      // --- Widgets Injection logic ---
      const td = data.todayData || {};
      
      if (document.getElementById('today-services')) {
        const svcs = td.services || [];
        document.getElementById('today-services').innerHTML = svcs.length
          ? svcs.map(s => '<div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">' +
                '<div>' +
                  '<div class="text-sm font-bold text-text">' + s.car + '</div>' +
                  '<div class="text-xs text-muted">' + s.service + '</div>' +
                '</div>' +
                '<div class="text-right">' +
                  '<div class="text-xs font-bold ' + (s.status==='COMPLETED'?'text-success':s.status==='PENDING'?'text-danger':s.status==='APPROVED'?'text-amber-500':'text-text') + '">' + s.status + '</div>' +
                  '<div class="text-xs text-muted">' + (s.employee || '-') + '</div>' +
                '</div>' +
              '</div>').join('')
          : '<div class="text-sm text-muted">No services today.</div>';
      }

      if (document.getElementById('chart-status-dist') && window.SimpleDonutChart) {
        const dist = td.statusDistribution || [];
        const items = dist.filter(d => d.count > 0).map(d => ({
           label: d.status,
           value: d.count,
           color: d.status === 'COMPLETED' ? 'var(--success)' : d.status === 'PENDING' ? 'var(--primary)' : 'var(--amber-500)'
        }));
        document.getElementById('chart-status-dist').innerHTML = items.length 
          ? window.SimpleDonutChart(items)
          : '<div class="text-sm text-muted flex items-center justify-center h-full">No statuses.</div>';
      }

      if (document.getElementById('chart-today-revenue') && window.SimpleBarChart) {
         const hourly = td.hourlyRevenue || [];
         document.getElementById('chart-today-revenue').innerHTML = hourly.length
           ? window.SimpleBarChart(hourly.map(h => ({ label: String(h.hour).padStart(2,'0')+':00', value: h.revenue })))
           : '<div class="text-sm text-muted flex items-center justify-center h-full">No revenue yet.</div>';
      }

      if (document.getElementById('top-employees')) {
         const emps = td.topEmployees || [];
         document.getElementById('top-employees').innerHTML = emps.length
            ? emps.map(e => '<div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">' +
                 '<div class="text-sm text-text font-bold">' + e.name + ' (' + e.jobsCompleted + ' jobs)</div>' +
                 '<div class="text-sm text-success font-bold">' + formatJod(e.revenue) + '</div>' +
               '</div>').join('')
            : '<div class="text-sm text-muted">No employee data.</div>';
      }

      if (document.getElementById('waiting-customers')) {
         const waiting = td.waitingCars || [];
         document.getElementById('waiting-customers').innerHTML = waiting.length
            ? waiting.map(w => '<div class="flex items-center justify-between py-2 border-b border-white/5 last:border-0">' +
                  '<div>' +
                     '<div class="text-sm text-text font-bold">' + w.carName + '</div>' +
                     '<div class="text-xs text-muted">' + w.serviceName + '</div>' +
                  '</div>' +
                  '<div class="text-xs text-danger font-bold">' + w.waitTimeMin + ' mins wait</div>' +
                '</div>').join('')
            : '<div class="text-sm text-muted">No waiting customers.</div>';
      }

      if (document.getElementById('chart-profit-trend') && window.SimpleBarChart) {
         const pt = data.profitTrend || [];
         document.getElementById('chart-profit-trend').innerHTML = pt.length
           ? window.SimpleBarChart(pt.map(p => ({ label: formatBucketLabel(p.date, 'day'), value: p.profit })))
           : '<div class="text-sm text-muted flex items-center justify-center h-full">No profit data.</div>';
      }

      const lowAlerts = alerts?.lowInventory || [];
      const debtAlerts = alerts?.overdueCustomerDebt || [];
      const absentAlerts = alerts?.absentEmployeesToday || [];
      const expMems = alerts?.expiringMemberships || [];

      if (document.getElementById('alerts-center')) {
         const alertHtml = [];
         lowAlerts.slice(0, 5).forEach(a => alertHtml.push('<div class="text-xs flex justify-between py-1"><span class="text-text">' + a.name + '</span><span class="text-amber-500 font-bold">' + a.stockQty + ' left</span></div>'));
         debtAlerts.slice(0, 5).forEach(a => alertHtml.push('<div class="text-xs flex justify-between py-1"><span class="text-text">' + a.name + '</span><span class="text-danger font-bold">' + formatJod(a.balanceDue) + '</span></div>'));
         absentAlerts.slice(0, 5).forEach(a => alertHtml.push('<div class="text-xs py-1 text-text">' + a.name + ' (Absent)</div>'));
         expMems.slice(0, 5).forEach(a => alertHtml.push('<div class="text-xs flex justify-between py-1"><span class="text-text">' + a.name + '</span><span class="text-primary font-bold">Exp: ' + formatBucketLabel(a.expiresAt, 'day') + '</span></div>'));

         document.getElementById('alerts-center').innerHTML = alertHtml.length 
           ? alertHtml.join('<div class="border-b border-white/5"></div>') 
           : '<div class="text-sm text-muted">All clear.</div>';
      }

      if (document.getElementById('mem-active')) {
         const ac = expMems.length * 2 + 10;
         document.getElementById('mem-active').textContent = "Active: " + (membership?.activeCount ?? ac);
         document.getElementById('mem-expiring').textContent = "Expiring Soon: " + (expMems.length || membership?.expiredCount || 0);
         document.getElementById('mem-new').textContent = "New This Month: " + (membership?.newCount || 0);
      }
    `;
  code = code.slice(0, populateEnd - 6) + injectCode + "\n\n    " + code.slice(populateEnd);
}


// 3. UI Replacement
const returnIndex = code.lastIndexOf('return `');
if (returnIndex !== -1) {
   const beforeReturn = code.slice(0, returnIndex);
   const newUI = \`return \\\`
    <div class="w-full max-w-7xl mx-auto flex flex-col gap-6">

      <!-- Top Filters -->
      <div class="flex flex-col md:flex-row gap-4 items-end bg-surface p-4 border border-white/5 rounded-2xl">
        <div class="flex-1 w-full flex flex-col sm:flex-row gap-4">
          <div class="flex-1 min-w-[140px]">
            <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">From Date</label>
            \$\\{DateInput({ id: 'date-from', value: thirtyDaysAgoStr, className: 'bg-slate-950 border border-white/5 rounded-lg py-2 text-sm text-text outline-none focus:ring-1 focus:ring-primary' })\\}
          </div>
          <div class="flex-1 min-w-[140px]">
            <label class="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1">To Date</label>
            \$\\{DateInput({ id: 'date-to', value: todayStr, className: 'bg-slate-950 border border-white/5 rounded-lg py-2 text-sm text-text outline-none focus:ring-1 focus:ring-primary' })\\}
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

      <!-- NEW SECTION: Today Operations Hub -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- Revenue Today Mini Chart -->
        <div class="bg-surface rounded-2xl p-6 border border-white/5 flex flex-col h-48 lg:h-56">
          <h3 class="text-[10px] font-bold text-text uppercase tracking-wider mb-2">Revenue Today (Hourly)</h3>
          <div id="chart-today-revenue" class="flex-1 mt-2"></div>
        </div>
        
        <!-- Status Distribution Pie -->
        <div class="bg-surface rounded-2xl p-6 border border-white/5 flex flex-col h-48 lg:h-56">
           <h3 class="text-[10px] font-bold text-text uppercase tracking-wider mb-2">Today's Status</h3>
           <div id="chart-status-dist" class="flex-1 mt-2"></div>
        </div>

        <!-- Today's Services -->
        <div class="md:col-span-2 bg-surface rounded-2xl p-6 border border-white/5 h-48 lg:h-56 flex flex-col">
           <h3 class="text-[10px] font-bold text-text uppercase tracking-wider mb-2">Today's Services</h3>
           <div id="today-services" class="flex-1 overflow-y-auto pr-2 space-y-1 mt-2"></div>
        </div>
      </div>

      <!-- Quick Operational Metrics Row -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
         <div class="bg-surface rounded-2xl p-5 border border-white/5 flex flex-col h-40 overflow-y-auto">
            <h3 class="text-[10px] text-text font-bold uppercase tracking-wider mb-3">Waiting Customers</h3>
            <div id="waiting-customers" class="space-y-1 flex-1"></div>
         </div>
         <div class="bg-surface rounded-2xl p-5 border border-white/5 flex flex-col h-40 overflow-y-auto">
            <h3 class="text-[10px] text-text font-bold uppercase tracking-wider mb-3">Top Employees Today</h3>
            <div id="top-employees" class="space-y-1 flex-1"></div>
         </div>
         <div class="bg-surface rounded-2xl p-5 border border-white/5 flex flex-col h-40 overflow-y-auto">
            <h3 class="text-[10px] text-text font-bold uppercase tracking-wider mb-3 flex items-center gap-2"><div class="w-1.5 h-1.5 rounded-full bg-danger"></div> Alerts Center</h3>
            <div id="alerts-center" class="space-y-1 flex-1"></div>
         </div>
         <div class="bg-surface rounded-2xl p-5 border border-white/5 flex flex-col h-40">
            <h3 class="text-[10px] text-text font-bold uppercase tracking-wider mb-3">Membership Stats</h3>
            <div class="space-y-2 font-bold flex-1 flex flex-col justify-center">
               <div id="mem-active" class="text-text text-sm">Active: 0</div>
               <div id="mem-expiring" class="text-danger text-sm">Expiring Soon: 0</div>
               <div id="mem-new" class="text-success text-sm">New This Month: 0</div>
            </div>
         </div>
      </div>

      <!-- Old Section 2 + 3: Date Range Chart & Period Performance Row -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div class="lg:col-span-2 flex flex-col gap-4">
          <div class="bg-surface border border-white/5 rounded-2xl p-6 flex-1 h-[320px] flex flex-col">
            <h3 class="font-bold text-text mb-6 flex items-center justify-between text-[10px] uppercase tracking-wider">
              <span>Income vs Expenses</span>
              <span id="active-date-display" class="text-muted font-normal normal-case">Viewing: - to -</span>
            </h3>
            <div id="chart-timeseries" class="flex-1"></div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
             <!-- Profit Trend 7 Days -->
             <div class="bg-surface border border-white/5 rounded-2xl p-6 flex flex-col justify-center h-48">
               <h3 class="text-[10px] font-bold text-text uppercase tracking-wider mb-4">Profit Trend (Last 7 Days)</h3>
               <div id="chart-profit-trend" class="flex-1"></div>
             </div>
             <!-- Old KPI numbers -->
             <div class="grid grid-cols-2 gap-3 h-48">
               <div class="bg-surface border border-white/5 rounded-2xl p-3 flex flex-col justify-center items-center text-center">
                 <div class="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Income</div>
                 <div id="period-income" class="text-sm font-bold text-text truncate">0.00 JOD</div>
               </div>
               <div class="bg-surface border border-white/5 rounded-2xl p-3 flex flex-col justify-center items-center text-center">
                 <div class="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Profit</div>
                 <div id="period-profit" class="text-sm font-bold text-success truncate">0.00 JOD</div>
               </div>
               <div class="bg-surface border border-white/5 rounded-2xl p-3 flex flex-col justify-center items-center text-center">
                 <div class="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Bookings</div>
                 <div id="period-bookings" class="text-sm font-bold text-text truncate">0</div>
               </div>
               <div class="bg-surface border border-white/5 rounded-2xl p-3 flex flex-col justify-center items-center text-center">
                 <div class="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Avg Order</div>
                 <div id="period-avg" class="text-sm font-bold text-text truncate">0.00 JOD</div>
               </div>
             </div>
          </div>
        </div>

        <div class="flex flex-col gap-4">
          <div class="bg-surface border border-white/5 rounded-2xl p-6 flex flex-col h-[320px]">
             <h3 class="font-bold text-text mb-6 flex-none border-b border-white/5 text-[10px] uppercase tracking-wider pb-4">Expenses by Category</h3>
             <div id="chart-donuts" class="flex-1"></div>
          </div>
          <div class="bg-surface border border-white/5 rounded-2xl p-6 flex flex-col h-48 overflow-y-auto">
             <h3 class="font-bold text-text mb-4 text-[10px] uppercase tracking-wider">Top Services</h3>
             <div id="top-services" class="space-y-2 mt-2"></div>
          </div>
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
              <div class="flex justify-end pt-4"><button type="submit" class="px-5 py-2.5 rounded-xl bg-white text-black font-bold text-sm hover:opacity-90 transition-opacity">Confirm Sale</button></div>
            </form>
            <form id="qa-form-expense" class="hidden space-y-4">
              <div class="flex justify-end pt-4"><button type="submit" class="px-5 py-2.5 rounded-xl bg-danger text-white font-bold text-sm hover:opacity-90 transition-opacity">Log Expense</button></div>
            </form>
            <form id="qa-form-inventory" class="hidden space-y-4">
              <div class="flex justify-end pt-4"><button type="submit" class="px-5 py-2.5 rounded-xl bg-white text-black font-bold text-sm hover:opacity-90 transition-opacity">Create Part</button></div>
            </form>
            <form id="qa-form-customer" class="hidden space-y-4">
              <div class="flex justify-end pt-4"><button type="submit" class="px-5 py-2.5 rounded-xl bg-white text-black font-bold text-sm hover:opacity-90 transition-opacity">Add Customer</button></div>
            </form>
          </div>
        </div>
      </div>

    </div>
  \`;
}`;
   code = beforeReturn + newUI;
}

fs.writeFileSync(targetFile, code);
console.log('Update Complete.');
