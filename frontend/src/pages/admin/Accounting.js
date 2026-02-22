import { apiFetch } from '../../lib/api.js';
import { TableRowSkeleton, KPISkeleton } from '../../components/ui/Skeleton.js';

export function AdminAccounting() {

  window.onMount = async () => {

    const tbody = document.getElementById('tx-tbody');
    const incomeForm = document.getElementById('income-form');
    const expenseForm = document.getElementById('expense-form');

    document.getElementById('add-income-btn').addEventListener('click', () => {
      document.getElementById('income-container').classList.toggle('hidden');
      document.getElementById('expense-container').classList.add('hidden');
    });

    document.getElementById('add-expense-btn').addEventListener('click', () => {
      document.getElementById('expense-container').classList.toggle('hidden');
      document.getElementById('income-container').classList.add('hidden');
    });

    async function load() {
      tbody.innerHTML = TableRowSkeleton(6).repeat(8);
      document.getElementById('total-income-val').innerHTML = '<span class="skeleton h-8 w-24 inline-block rounded"></span>';
      document.getElementById('total-expense-val').innerHTML = '<span class="skeleton h-8 w-24 inline-block rounded"></span>';
      document.getElementById('net-profit-val').innerHTML = '<span class="skeleton h-8 w-24 inline-block rounded"></span>';

      try {
        const [txRes, sumRes] = await Promise.all([
          apiFetch('/accounting/transactions'),
          apiFetch('/accounting/reports/summary')
        ]);

        if (txRes && txRes.items) {
          const sorted = txRes.items.sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));

          if (sorted.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-muted">No transactions found</td></tr>`;
          } else {
            tbody.innerHTML = sorted.map(t => {
              const sign = t.type === 'INCOME' ? '+' : '-';
              const color = t.type === 'INCOME' ? 'text-success' : 'text-danger';
              const date = new Date(t.occurredAt);
              return `
              <tr class="group border-b border-border bg-surface hover:bg-bg transition-colors">
                <td class="px-6 py-4 whitespace-nowrap text-xs font-mono text-muted">${date.toLocaleDateString()}<br>${date.toLocaleTimeString([], { timeStyle: 'short' })}</td>
                <td class="px-6 py-4 whitespace-nowrap"><span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${t.type === 'INCOME' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}">${t.type}</span></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-text">${t.itemName}</td>
                <td class="px-6 py-4 whitespace-nowrap text-xs font-semibold text-muted">${t.incomeSource || t.expenseCategory || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-text">${t.quantity} <span class="text-xs text-muted font-normal">x</span> ${t.unitPrice}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right font-bold font-mono ${color} pr-6">${sign}${t.amount} JOD</td>
              </tr>
              `;
            }).join('');
          }
        }

        if (sumRes) {
          const inc = parseFloat(sumRes.walkInIncome || 0);
          const exp = parseFloat(sumRes.expenses || 0);
          const net = inc - exp;

          document.getElementById('total-income-val').innerHTML = `+${inc.toFixed(2)}`;
          document.getElementById('total-expense-val').innerHTML = `-${exp.toFixed(2)}`;
          document.getElementById('net-profit-val').innerHTML = `${net.toFixed(2)}`;
        }

      } catch (e) {
        window.toast('Error loading accounting data', 'error');
      }
    }

    incomeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await apiFetch('/accounting/walkin-income', {
          method: 'POST',
          body: {
            itemName: incomeForm.itemName.value,
            unitPrice: parseFloat(incomeForm.unitPrice.value),
            quantity: parseInt(incomeForm.quantity.value, 10),
            occurredAt: new Date().toISOString()
          }
        });
        window.toast('Direct income recorded', 'success');
        incomeForm.reset();
        document.getElementById('income-container').classList.add('hidden');
        load();
      } catch (e) { window.toast(e.message, 'error'); }
    });

    expenseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await apiFetch('/accounting/expenses', {
          method: 'POST',
          body: {
            itemName: expenseForm.itemName.value,
            unitPrice: parseFloat(expenseForm.unitPrice.value),
            quantity: parseInt(expenseForm.quantity.value, 10),
            expenseCategory: expenseForm.expenseCategory.value,
            occurredAt: expenseForm.occurredAt.value ? new Date(expenseForm.occurredAt.value).toISOString() : new Date().toISOString()
          }
        });
        window.toast('Expense recorded', 'success');
        expenseForm.reset();
        document.getElementById('expense-container').classList.add('hidden');
        load();
      } catch (e) { window.toast(e.message, 'error'); }
    });

    load();
  };

  return `
    <div class="w-full h-full flex flex-col gap-6">
      
      <!-- Top header / actions -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-4">
        <div>
          <h1 class="text-3xl font-heading font-bold text-text">General Ledger</h1>
          <p class="text-sm text-muted">Monitor all monetary flows, walk-in sales, and operational expenses.</p>
        </div>
        <div class="flex items-center gap-3 w-full md:w-auto">
          <button id="add-income-btn" class="flex-1 md:flex-none border-2 border-success text-success hover:bg-success hover:text-white px-5 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm">+ Walk-in Sale</button>
          <button id="add-expense-btn" class="flex-1 md:flex-none border-2 border-danger text-danger hover:bg-danger hover:text-white px-5 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm">- Log Expense</button>
        </div>
      </div>

      <!-- Quick Summary -->
      <div id="report-summary" class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-surface border border-border rounded-xl p-6 flex flex-col justify-center shadow-sm">
           <div class="flex items-center gap-3 mb-2">
             <div class="w-8 h-8 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0">
               <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
             </div>
             <p class="text-xs uppercase font-bold text-muted tracking-widest">Total Income</p>
           </div>
           <h3 id="total-income-val" class="text-3xl font-bold text-text drop-shadow-sm">0.00</h3>
        </div>
        <div class="bg-surface border border-border rounded-xl p-6 flex flex-col justify-center shadow-sm">
           <div class="flex items-center gap-3 mb-2">
             <div class="w-8 h-8 rounded-full bg-danger/10 text-danger flex items-center justify-center shrink-0">
               <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"></path></svg>
             </div>
             <p class="text-xs uppercase font-bold text-muted tracking-widest">Total Expenses</p>
           </div>
           <h3 id="total-expense-val" class="text-3xl font-bold text-text drop-shadow-sm">0.00</h3>
        </div>
        <div class="bg-surface border border-border rounded-xl p-6 flex flex-col justify-center shadow-sm">
           <div class="flex items-center gap-3 mb-2">
             <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
               <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
             </div>
             <p class="text-xs uppercase font-bold text-muted tracking-widest">Net Profit / Loss</p>
           </div>
           <h3 id="net-profit-val" class="text-3xl font-bold text-primary drop-shadow-sm">0.00</h3>
        </div>
      </div>

      <!-- Forms (Hidden by default) -->
      <div id="income-container" class="hidden bg-success/10 border border-success/30 rounded-xl p-6">
        <h3 class="font-bold text-success mb-4 flex items-center gap-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg> Record External Income</h3>
        <form id="income-form" class="flex flex-wrap gap-4 items-end">
          <div class="flex-1 min-w-[200px]">
            <label class="block text-xs font-bold text-success uppercase tracking-wider mb-1">Item / Description</label>
            <input type="text" name="itemName" required class="w-full bg-surface border border-success/30 rounded-lg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-success">
          </div>
          <div class="w-24">
            <label class="block text-xs font-bold text-success uppercase tracking-wider mb-1">Unit Price</label>
            <input type="number" step="0.01" name="unitPrice" required class="w-full bg-surface border border-success/30 rounded-lg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-success">
          </div>
          <div class="w-24">
            <label class="block text-xs font-bold text-success uppercase tracking-wider mb-1">Qty</label>
            <input type="number" name="quantity" value="1" min="1" required class="w-full bg-surface border border-success/30 rounded-lg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-success">
          </div>
          <button type="submit" class="bg-success text-white px-8 py-2.5 rounded-lg font-bold">Save</button>
        </form>
      </div>

      <div id="expense-container" class="hidden bg-danger/10 border border-danger/30 rounded-xl p-6">
        <h3 class="font-bold text-danger mb-4 flex items-center gap-2">- Record Business Expense</h3>
        <form id="expense-form" class="flex flex-wrap gap-4 items-end">
          <div class="flex-1 min-w-[200px]">
            <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Supplier / Item / Desc</label>
            <input type="text" name="itemName" required class="w-full bg-surface border border-danger/30 rounded-lg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-danger">
          </div>
          <div class="w-40">
            <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Category</label>
            <select name="expenseCategory" class="w-full bg-surface border border-danger/30 rounded-lg px-3 py-2 text-text outline-none">
              <option value="GENERAL">General Operational</option>
              <option value="SUPPLIER">Supplier / Parts</option>
              <option value="SALARY">Payroll / Salary</option>
            </select>
          </div>
          <div class="w-24">
            <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Cost</label>
            <input type="number" step="0.01" name="unitPrice" required class="w-full bg-surface border border-danger/30 rounded-lg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-danger">
          </div>
          <div class="w-24">
            <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Qty</label>
            <input type="number" name="quantity" value="1" min="1" required class="w-full bg-surface border border-danger/30 rounded-lg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-danger">
          </div>
          <div class="w-40">
            <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Date Occurred</label>
            <input type="date" name="occurredAt" class="w-full bg-surface border border-danger/30 rounded-lg px-3 py-2 text-text outline-none custom-calendar-icon">
          </div>
          <button type="submit" class="bg-danger text-white px-8 py-2.5 rounded-lg font-bold">Charge</button>
        </form>
      </div>

      <!-- Tx Table -->
      <div class="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0 mt-4 md:mt-2">
        <div class="p-4 border-b border-border bg-bg/50">
          <h3 class="text-sm font-bold text-text uppercase tracking-wider px-2">Transaction Ledger</h3>
        </div>
        <div class="overflow-x-auto overflow-y-auto flex-1 h-full block">
          <table class="w-full text-left min-w-[800px]">
            <thead class="bg-bg border-b border-border sticky top-0 z-10 w-full">
              <tr>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Date</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Type</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Description</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Category</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Qty/Rate</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right pr-6">Amount</th>
              </tr>
            </thead>
            <tbody id="tx-tbody" class="divide-y divide-border">
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}
