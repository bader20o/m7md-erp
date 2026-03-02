const fs = require('fs');
const filePath = 'c:/Users/bkhwe/final_mohammad/frontend/src/pages/admin/Analytics.js';
let content = fs.readFileSync(filePath, 'utf8');

const marker = "    function exportData(type) {";
const index = content.indexOf(marker);

if (index !== -1) {
    const newHtml = `    function exportData(type) {
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
    }
  };

  return \`
    <div class="w-full max-w-7xl mx-auto flex flex-col gap-6 pb-12">

      <div class="flex items-center justify-between mt-2 mb-2 px-2">
        <h1 class="text-2xl font-bold text-text">Operational Dashboard</h1>
      </div>

      <!-- SECTION 1: TODAY SNAPSHOT -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 px-2">
        <div class="bg-surface rounded-2xl p-6 flex flex-col justify-center border border-white/5 shadow-sm">
          <div class="text-[10px] uppercase font-bold text-muted tracking-wider mb-2">Today Income</div>
          <div id="snap-income" class="text-3xl font-bold text-success">0.00 JOD</div>
        </div>
        <div class="bg-surface rounded-2xl p-6 flex flex-col justify-center border border-white/5 shadow-sm">
          <div class="text-[10px] uppercase font-bold text-muted tracking-wider mb-2">Today Expenses</div>
          <div id="snap-expenses" class="text-3xl font-bold text-danger">0.00 JOD</div>
        </div>
        <div class="bg-surface rounded-2xl p-6 flex flex-col justify-center border border-white/5 shadow-sm">
          <div class="text-[10px] uppercase font-bold text-muted tracking-wider mb-2">New Bookings</div>
          <div id="snap-bookings" class="text-3xl font-bold text-text">0</div>
        </div>
        <div class="bg-surface rounded-2xl p-6 flex flex-col justify-center border border-white/5 shadow-sm">
          <div class="text-[10px] uppercase font-bold text-muted tracking-wider mb-2">Active Employees</div>
          <div id="snap-employees" class="text-3xl font-bold text-text">0</div>
        </div>
      </div>

      <!-- SECTION 2: DATE RANGE + PRIMARY CHART -->
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 px-2">
        <!-- Filters (Left) -->
        <div class="lg:col-span-1 bg-surface rounded-2xl p-6 flex flex-col gap-4 border border-white/5 shadow-sm">
          <h3 class="font-bold text-sm text-text">Date Range</h3>
          <div>
            <label class="block text-[10px] uppercase font-bold text-muted tracking-wider mb-1">From</label>
            \${DateInput({ id: 'date-from', value: thirtyDaysAgoStr, className: 'w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-shadow text-text' })}
          </div>
          <div>
            <label class="block text-[10px] uppercase font-bold text-muted tracking-wider mb-1">To</label>
            \${DateInput({ id: 'date-to', value: todayStr, className: 'w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-shadow text-text' })}
          </div>
          <div>
            <label class="block text-[10px] uppercase font-bold text-muted tracking-wider mb-1">Group By</label>
            <select id="group-by" class="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none transition-shadow text-text">
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </div>
          <button id="filter-btn" class="mt-2 w-full bg-bg hover:bg-bg/80 text-text px-4 py-2 rounded-lg font-bold text-sm transition-colors border border-white/5 shadow-sm">Apply Filters</button>
        </div>

        <!-- Primary Chart (Right) -->
        <div class="lg:col-span-3 bg-surface rounded-2xl p-6 flex flex-col border border-white/5 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-sm text-text">Revenue Trends</h3>
            <span id="active-date-display" class="text-xs text-muted font-medium bg-bg border border-white/5 px-2 py-1 rounded">Last 30 Days</span>
          </div>
          <div id="chart-timeseries" class="flex-1 min-h-[250px] flex items-end"></div>
        </div>
      </div>

      <!-- SECTION 3: EXECUTIVE INSIGHTS -->
      <div class="bg-surface rounded-2xl p-6 mx-2 border border-white/5 shadow-sm">
        <h3 class="font-bold text-sm text-text mb-4">Executive Insights</h3>
        <div id="summary-signals" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="skeleton h-16 w-full rounded-xl"></div>
        </div>
      </div>

      <!-- SECTION 4: ACTION CENTER -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 px-2">
        <!-- Quick Actions -->
        <div class="lg:col-span-1 bg-surface rounded-2xl p-6 flex flex-col gap-3 border border-white/5 shadow-sm">
          <h3 class="font-bold text-sm text-text mb-2">Quick Actions</h3>
          <button onclick="window.openQuickAction('WALKIN')" class="w-full bg-slate-950 hover:bg-white/5 border border-white/5 text-text px-4 py-3 rounded-xl font-semibold text-sm transition-colors text-left flex items-center gap-3">
            <div class="w-6 text-center text-muted"><i class="fa-solid fa-cart-shopping"></i></div> Walk-in Sale
          </button>
          <button onclick="window.openQuickAction('EXPENSE')" class="w-full bg-slate-950 hover:bg-white/5 border border-white/5 text-text px-4 py-3 rounded-xl font-semibold text-sm transition-colors text-left flex items-center gap-3">
            <div class="w-6 text-center text-muted"><i class="fa-solid fa-money-bill-transfer"></i></div> Add Expense
          </button>
          <button onclick="window.openQuickAction('INVENTORY')" class="w-full bg-slate-950 hover:bg-white/5 border border-white/5 text-text px-4 py-3 rounded-xl font-semibold text-sm transition-colors text-left flex items-center gap-3">
            <div class="w-6 text-center text-muted"><i class="fa-solid fa-box"></i></div> Add Inventory
          </button>
          <button onclick="window.openQuickAction('CUSTOMER')" class="w-full bg-slate-950 hover:bg-white/5 border border-white/5 text-text px-4 py-3 rounded-xl font-semibold text-sm transition-colors text-left flex items-center gap-3">
            <div class="w-6 text-center text-muted"><i class="fa-solid fa-user-plus"></i></div> Create Customer
          </button>
        </div>

        <!-- Alerts -->
        <div class="lg:col-span-2 bg-surface rounded-2xl p-6 border border-white/5 flex flex-col shadow-sm">
           <h3 class="font-bold text-sm text-text mb-4">Alerts & Attention</h3>
           <div class="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
             <div class="bg-slate-950 rounded-2xl p-4 flex flex-col gap-2 border border-white/5">
               <div class="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-amber-500"></div> Low Inventory</div>
               <div id="alerts-low" class="flex flex-col gap-2 flex-1 mt-1"></div>
             </div>
             <div class="bg-slate-950 rounded-2xl p-4 flex flex-col gap-2 border border-white/5">
               <div class="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-danger"></div> Overdue Debt</div>
               <div id="alerts-debt" class="flex flex-col gap-2 flex-1 mt-1"></div>
             </div>
             <div class="bg-slate-950 rounded-2xl p-4 flex flex-col gap-2 border border-white/5">
               <div class="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-2"><div class="w-2 h-2 rounded-full bg-primary"></div> Absent Employees</div>
               <div id="alerts-absent" class="flex flex-col gap-2 flex-1 mt-1"></div>
             </div>
           </div>
        </div>
      </div>

      <!-- SECTION 5: SUMMARY PANELS -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 px-2">
        <div class="bg-surface rounded-2xl p-6 border border-white/5 flex flex-col shadow-sm">
           <div class="flex items-center justify-between mb-4">
             <h3 class="font-bold text-sm text-text">Outstanding Debt Summary</h3>
             <button id="export-acc" class="text-xs text-muted hover:text-text font-bold uppercase transition-colors"><i class="fa-solid fa-download"></i> Export</button>
           </div>
           <div class="grid grid-cols-2 gap-3 mb-4">
             <div class="bg-slate-950 border border-white/5 rounded-2xl p-4">
               <div class="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Total Arrears</div>
               <div id="outstanding-total" class="text-xl font-bold text-danger">0.00 JOD</div>
             </div>
             <div class="bg-slate-950 border border-white/5 rounded-2xl p-4">
               <div class="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Accounts in Debt</div>
               <div id="outstanding-count" class="text-xl font-bold text-text">0</div>
             </div>
           </div>
           <div class="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Highest Balances</div>
           <div id="outstanding-top" class="bg-slate-950 border border-white/5 rounded-xl p-3 flex flex-col gap-2 flex-1"></div>
        </div>

        <div class="bg-surface rounded-2xl p-6 border border-white/5 flex flex-col justify-between shadow-sm">
           <h3 class="font-bold text-sm text-text mb-4">Customer Funnel</h3>
           <div class="flex flex-col gap-3">
             <div class="bg-slate-950 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
               <span class="text-xs font-bold text-muted uppercase tracking-wider">New</span>
               <span id="funnel-new" class="font-bold text-text">0</span>
             </div>
             <div class="bg-slate-950 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
               <span class="text-xs font-bold text-muted uppercase tracking-wider">Returning</span>
               <span id="funnel-returning" class="font-bold text-text">0</span>
             </div>
             <div class="bg-slate-950 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
               <span class="text-xs font-bold text-muted uppercase tracking-wider">With Debt</span>
               <span id="funnel-debt" class="font-bold text-danger">0</span>
             </div>
           </div>
        </div>
      </div>

      <!-- SECTION 6: ADVANCED METRICS -->
      <div class="px-2">
        <details class="group bg-surface rounded-2xl border border-white/5 transition-all shadow-sm">
          <summary class="cursor-pointer font-bold text-sm text-text p-6 list-none flex items-center justify-between select-none hover:bg-white/5 rounded-2xl">
            <span>Advanced Metrics</span>
            <div class="flex items-center gap-4">
              <button id="export-tx" class="text-[10px] text-muted hover:text-text font-bold uppercase transition-colors" onclick="event.preventDefault(); window.exportData('transactions')"><i class="fa-solid fa-download"></i> TX Export</button>
              <i class="fa-solid fa-chevron-down text-muted transition-transform group-open:rotate-180"></i>
            </div>
          </summary>
          <div class="p-6 pt-0 border-t border-white/5 mt-2">
            
            <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-4 mb-6">
              <div class="bg-slate-950 border border-white/5 rounded-2xl p-4 relative overflow-hidden">
                <div class="text-[10px] uppercase font-bold text-muted mb-1">Total Income</div>
                <div id="adv-income" class="font-bold text-lg text-success">0.00 JOD</div>
              </div>
              <div class="bg-slate-950 border border-white/5 rounded-2xl p-4 relative overflow-hidden">
                <div class="text-[10px] uppercase font-bold text-muted mb-1">Total Expenses</div>
                <div id="adv-expense" class="font-bold text-lg text-danger">0.00 JOD</div>
              </div>
              <div class="bg-slate-950 border border-white/5 rounded-2xl p-4 relative overflow-hidden">
                <div class="text-[10px] uppercase font-bold text-muted mb-1">Total Profit</div>
                <div id="adv-profit" class="font-bold text-lg text-text">0.00 JOD</div>
              </div>
              <div class="bg-slate-950 border border-white/5 rounded-2xl p-4 relative overflow-hidden">
                <div class="text-[10px] uppercase font-bold text-muted mb-1">Total Orders</div>
                <div id="adv-orders" class="font-bold text-lg text-text">0</div>
              </div>
              <div class="bg-slate-950 border border-white/5 rounded-2xl p-4 relative overflow-hidden">
                <div class="text-[10px] uppercase font-bold text-muted mb-1">Avg Order Value</div>
                <div id="adv-avg" class="font-bold text-lg text-text">0.00 JOD</div>
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
               <div class="bg-slate-950 border border-white/5 rounded-2xl p-6 lg:col-span-2">
                  <h3 class="font-bold text-sm text-text mb-4">Expenses by Category</h3>
                  <div id="chart-donuts" class="h-[250px]"></div>
               </div>
               <div class="flex flex-col gap-6">
                  <div class="bg-slate-950 border border-white/5 rounded-2xl p-6 flex-1">
                    <h3 class="font-bold text-sm text-text mb-4">Membership Flow</h3>
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <div class="text-[10px] text-muted uppercase tracking-wider font-bold mb-1">New</div>
                        <div id="mem-new" class="font-bold text-text">0</div>
                      </div>
                      <div>
                        <div class="text-[10px] text-muted uppercase tracking-wider font-bold mb-1">Renewed</div>
                        <div id="mem-renewed" class="font-bold text-text">0</div>
                      </div>
                      <div>
                        <div class="text-[10px] text-muted uppercase tracking-wider font-bold mb-1">Expired</div>
                        <div id="mem-expired" class="font-bold text-danger">0</div>
                      </div>
                      <div>
                        <div class="text-[10px] text-muted uppercase tracking-wider font-bold mb-1">Revenue</div>
                        <div id="mem-rev" class="font-bold text-success">0.00 JOD</div>
                      </div>
                    </div>
                  </div>
                  <div class="bg-slate-950 border border-white/5 rounded-2xl p-6">
                    <h3 class="font-bold text-sm text-text mb-3">Top Services</h3>
                    <div id="top-services" class="flex flex-col gap-2"></div>
                  </div>
               </div>
            </div>

          </div>
        </details>
      </div>

      <!-- Quick Action Unified Modal (Clean) -->
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
  \`;\n}\n`;

    const newContent = content.substring(0, index) + newHtml;
    fs.writeFileSync(filePath, newContent, 'utf8');
}
