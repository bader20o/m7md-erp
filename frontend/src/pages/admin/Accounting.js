import { apiFetch } from '../../lib/api.js';
import { PERMISSIONS } from '../../lib/roles.js';
import { TableRowSkeleton } from '../../components/ui/Skeleton.js';
import { ProfitLineChart, SimpleDonutChart } from '../../components/ui/ChartWrapper.js';
import { store } from '../../lib/store.js';
import { DateInput } from '../../components/ui/DateInput.js';
import { applyProfitTrendRangeToSeries, filterTransactionsByState } from './accounting.logic.js';

export function AdminAccounting() {

  window.onMount = async () => {

    const tbody = document.getElementById('tx-tbody');
    const expenseForm = document.getElementById('expense-form');
    const incomeItemSelect = document.getElementById('income-item-select');
    const incomeItemSearch = document.getElementById('income-item-search');
    const incomeItemResults = document.getElementById('income-item-results');
    const saleCustomerSelect = document.getElementById('sale-customer-select');
    const saleCustomerList = document.getElementById('sale-customer-list');
    const saleCustomerTypeSelect = document.getElementById('sale-customer-type');
    const existingCustomerFields = document.getElementById('existing-customer-fields');
    const quickCustomerFields = document.getElementById('quick-customer-fields');
    const walkinCustomerFields = document.getElementById('walkin-customer-fields');
    const quickCustomerName = document.getElementById('quick-customer-name');
    const quickCustomerPhone = document.getElementById('quick-customer-phone');
    const walkinCustomerName = document.getElementById('walkin-customer-name');
    const walkinCustomerPhone = document.getElementById('walkin-customer-phone');
    const incomeCombobox = document.getElementById('income-item-combobox');
    const expenseItemSelect = document.getElementById('expense-item-select');
    const walkinOverlay = document.getElementById('walkin-overlay');
    const expenseOverlay = document.getElementById('expense-overlay');
    const txSearchInput = document.getElementById('tx-search');
    const txTypeFilter = document.getElementById('tx-filter-type');
    const txSellingTypeFilter = document.getElementById('tx-filter-selling-type');
    const txFromDate = document.getElementById('tx-filter-from-date');
    const txToDate = document.getElementById('tx-filter-to-date');
    const txSortFilter = document.getElementById('tx-filter-sort');
    const txClearFilters = document.getElementById('tx-clear-filters');
    const txSummary = document.getElementById('tx-results-summary');
    const saleCustomerSearch = document.getElementById('sale-customer-search');
    const todayRevenueEl = document.getElementById('today-revenue-val');
    const todayExpensesEl = document.getElementById('today-expenses-val');
    const todayNetEl = document.getElementById('today-net-val');
    const todayRevenueMetaEl = document.getElementById('today-revenue-meta');
    const todayExpensesMetaEl = document.getElementById('today-expenses-meta');
    const todayNetMetaEl = document.getElementById('today-net-meta');
    const profitTrendEl = document.getElementById('chart-profit-trend-ledger');
    const profitTrendRangeFilterEl = document.getElementById('profit-trend-range-filter');
    const expenseBreakdownEl = document.getElementById('chart-expense-breakdown-ledger');
    let parts = [];
    let customers = [];
    let saleCart = [];
    let incomeItemLookup = new Map();
    let activeIncomeResultIndex = -1;
    let txFilterState = {
      q: '',
      type: 'ALL',
      sellingType: 'ALL',
      fromDate: '',
      toDate: '',
      sort: 'NEWEST'
    };
    let profitTrendRange = 'ALL';
    const canEditSaleUnitPrice = store.isAdmin() || store.hasPermission(PERMISSIONS.ACCOUNTING);
    const escapeAttr = (value) =>
      String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
    const normalizeText = (value) => String(value || '').toLowerCase();
    const EXPENSE_CATEGORY_TO_API = {
      Utilities: 'GENERAL',
      Equipment: 'SUPPLIER',
      Tools: 'SUPPLIER',
      Maintenance: 'GENERAL',
      Rent: 'GENERAL',
      Salary: 'SALARY',
      Supplies: 'SUPPLIER',
      Other: 'GENERAL'
    };
    const SEED_DEBUG_PATTERNS = ['[seed-full-test-data]', 'seed service', 'seed'];
    const vmDateFormatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
    const vmShortDateFormatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric'
    });
    const vmTimeFormatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    function sanitizeDebugText(rawValue) {
      let text = String(rawValue || '');
      for (const pattern of SEED_DEBUG_PATTERNS) {
        text = text.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
      }
      text = text.replace(/\s+/g, ' ').trim();
      return text;
    }

    function getSellingTypeBucket(tx) {
      const src = normalizeText(tx.incomeSource || tx.expenseCategory || '');
      if (tx.type === 'EXPENSE') return 'EXPENSE';
      if (
        src.includes('inventory_sale') ||
        src.includes('cart_checkout') ||
        src.includes('invoice')
      ) {
        return 'INVENTORY';
      }
      if (src.includes('walk') || src.includes('cash')) return 'WALK_IN';
      if (src.includes('booking') || src.includes('appointment')) return 'BOOKING';
      return 'GENERAL';
    }

    function getTransactionViewModel(tx) {
      const color = tx.type === 'INCOME' ? 'text-success' : 'text-danger';
      const date = new Date(tx.occurredAt);
      let sellingType = tx.incomeSource || tx.expenseCategory || '-';
      let itemTitle = tx.itemName || '-';
      let hasDetails = false;

      if (tx.incomeSource === 'INVOICE' || tx.incomeSource === 'INVENTORY_SALE') {
        itemTitle = 'Inventory Cart Sale';
        sellingType = 'CART_CHECKOUT';
        if (tx.invoice && tx.invoice.invoiceLines) hasDetails = true;
      }

      const cleanedNote = sanitizeDebugText(tx.note || tx.description || '');
      const note = cleanedNote || '-';
      const noteShort = note.length > 30 ? `${note.substring(0, 30)}...` : note;
      const sellingBucket = getSellingTypeBucket(tx);
      const sellingTypeLabel = sellingBucket === 'WALK_IN'
        ? 'Walk-in'
        : sellingBucket === 'BOOKING'
          ? 'Booking'
          : sellingBucket === 'INVENTORY'
            ? 'Inventory'
            : sellingBucket === 'EXPENSE'
              ? 'Expense'
              : 'General';
      const dateLabel = vmDateFormatter.format(date);
      const timeLabel = vmTimeFormatter.format(date);
      const baseQty = Number(tx.quantity || 0);
      const baseUnitPrice = Number(tx.unitPrice || 0);
      let displayQuantity = Number.isFinite(baseQty) && baseQty > 0 ? baseQty : 1;
      let displayUnitPrice = Number.isFinite(baseUnitPrice) && baseUnitPrice >= 0 ? baseUnitPrice : 0;

      const movementQty = Number(tx.movementQuantity || 0);
      const movementUnitCost = Number(tx.movementUnitCost || 0);
      if (Number.isFinite(movementQty) && movementQty > 0) displayQuantity = movementQty;
      if (Number.isFinite(movementUnitCost) && movementUnitCost > 0) displayUnitPrice = movementUnitCost;

      if (tx.invoice?.invoiceLines?.length) {
        const invoiceQty = tx.invoice.invoiceLines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
        const invoiceTotal = tx.invoice.invoiceLines.reduce((sum, line) => {
          const lineTotal = Number(line.lineTotal ?? Number(line.quantity || 0) * Number(line.unitAmount || 0));
          return sum + (Number.isFinite(lineTotal) ? lineTotal : 0);
        }, 0);
        if (invoiceQty > 0) {
          displayQuantity = invoiceQty;
          displayUnitPrice = invoiceTotal > 0 ? invoiceTotal / invoiceQty : displayUnitPrice;
        }
      }

      if ((!Number.isFinite(displayUnitPrice) || displayUnitPrice <= 0) && displayQuantity > 0) {
        const amountAbs = Math.abs(Number(tx.amount || 0));
        if (amountAbs > 0) displayUnitPrice = amountAbs / displayQuantity;
      }

      return {
        tx,
        color,
        date,
        sellingType,
        itemTitle,
        hasDetails,
        note,
        noteShort,
        sellingBucket,
        sellingTypeLabel,
        dateLabel,
        timeLabel,
        displayQuantity,
        displayUnitPrice
      };
    }

    function getDateRangeOnlyTransactions(all) {
      const fromDate = txFilterState.fromDate ? new Date(`${txFilterState.fromDate}T00:00:00`) : null;
      const toDate = txFilterState.toDate ? new Date(`${txFilterState.toDate}T23:59:59.999`) : null;
      return all.filter((t) => {
        const date = new Date(t.occurredAt);
        if (fromDate && date < fromDate) return false;
        if (toDate && date > toDate) return false;
        return true;
      });
    }

    function getExpenseUiCategory(tx) {
      const category = normalizeText(tx.expenseCategory || '');
      const sourceText = normalizeText(`${tx.itemName || ''} ${tx.note || ''} ${tx.description || ''}`);
      if (category === 'salary' || sourceText.includes('salary') || sourceText.includes('payroll')) return 'Salary';
      if (sourceText.includes('utility') || sourceText.includes('electric') || sourceText.includes('water') || sourceText.includes('internet')) return 'Utilities';
      if (sourceText.includes('equipment')) return 'Equipment';
      if (sourceText.includes('tool')) return 'Tools';
      if (sourceText.includes('maintenance') || sourceText.includes('repair')) return 'Maintenance';
      if (sourceText.includes('rent')) return 'Rent';
      if (category === 'supplier' || sourceText.includes('supply') || sourceText.includes('part')) return 'Supplies';
      return 'Other';
    }

    function formatPctDelta(todayValue, yesterdayValue) {
      if (yesterdayValue <= 0) {
        return todayValue > 0 ? '+100%' : '0%';
      }
      const delta = ((todayValue - yesterdayValue) / yesterdayValue) * 100;
      const sign = delta > 0 ? '+' : '';
      return `${sign}${delta.toFixed(0)}%`;
    }

    function renderTopSummary(transactions) {
      const totalIncome = transactions
        .filter((item) => item.type === 'INCOME')
        .reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);
      const totalExpenses = transactions
        .filter((item) => item.type === 'EXPENSE')
        .reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);
      const totalNet = totalIncome - totalExpenses;

      document.getElementById('total-income-val').innerHTML = `${totalIncome.toFixed(2)} JOD`;
      document.getElementById('total-expense-val').innerHTML = `${totalExpenses.toFixed(2)} JOD`;
      document.getElementById('net-profit-val').innerHTML = `${totalNet < 0 ? '-' : ''}${Math.abs(totalNet).toFixed(2)} JOD`;
      document.getElementById('net-profit-val').className = `mt-3 text-3xl font-bold leading-none tabular-nums ${totalNet > 0 ? 'text-success' : totalNet < 0 ? 'text-danger' : 'text-text'}`;
    }

    function renderLedgerInsights(filteredTransactions, allTransactionsForToday = filteredTransactions) {
      const dateScoped = getDateRangeOnlyTransactions(filteredTransactions);
      const now = new Date();
      const todayKey = now.toISOString().slice(0, 10);
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yesterdayKey = y.toISOString().slice(0, 10);

      let todayIncome = 0;
      let todayExpenses = 0;
      let yesterdayIncome = 0;
      let yesterdayExpenses = 0;
      let todayExpenseRecords = 0;
      const dailyMap = new Map();
      const expenseCategoryTotals = new Map();

      for (const tx of allTransactionsForToday) {
        const amount = Math.abs(Number(tx.amount || 0));
        const dayKey = new Date(tx.occurredAt).toISOString().slice(0, 10);
        if (tx.type === 'INCOME') {
          if (dayKey === todayKey) todayIncome += amount;
          if (dayKey === yesterdayKey) yesterdayIncome += amount;
        } else {
          if (dayKey === todayKey) {
            todayExpenses += amount;
            todayExpenseRecords += 1;
          }
          if (dayKey === yesterdayKey) yesterdayExpenses += amount;
        }
      }

      for (const tx of dateScoped) {
        const amount = Math.abs(Number(tx.amount || 0));
        const dayKey = new Date(tx.occurredAt).toISOString().slice(0, 10);
        const bucket = dailyMap.get(dayKey) || { income: 0, expenses: 0 };
        if (tx.type === 'INCOME') {
          bucket.income += amount;
        } else {
          bucket.expenses += amount;

          const uiCategory = getExpenseUiCategory(tx);
          expenseCategoryTotals.set(uiCategory, (expenseCategoryTotals.get(uiCategory) || 0) + amount);
        }
        dailyMap.set(dayKey, bucket);
      }

      const todayNet = todayIncome - todayExpenses;
      if (todayRevenueEl) todayRevenueEl.textContent = `${todayIncome.toFixed(2)} JOD`;
      if (todayExpensesEl) todayExpensesEl.textContent = `${todayExpenses.toFixed(2)} JOD`;
      if (todayNetEl) {
        todayNetEl.textContent = `${todayNet < 0 ? '-' : ''}${Math.abs(todayNet).toFixed(2)} JOD`;
        todayNetEl.className = `mt-3 text-3xl font-bold leading-none tabular-nums ${todayNet > 0 ? 'text-success' : todayNet < 0 ? 'text-danger' : 'text-text'}`;
      }
      if (todayRevenueMetaEl) todayRevenueMetaEl.textContent = `Compared to yesterday: ${formatPctDelta(todayIncome, yesterdayIncome)}`;
      if (todayExpensesMetaEl) todayExpensesMetaEl.textContent = `${todayExpenseRecords} expense records today`;
      if (todayNetMetaEl) todayNetMetaEl.textContent = todayNet >= 0 ? 'Positive day' : 'Negative day';

      const dailySeriesRaw = Array.from(dailyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, value]) => ({
          label: vmDateFormatter.format(new Date(date)),
          shortLabel: vmShortDateFormatter.format(new Date(date)),
          income: Number(value.income.toFixed(2)),
          expenses: Number(value.expenses.toFixed(2)),
          profit: Number((value.income - value.expenses).toFixed(2))
        }));
      const labelStep = dailySeriesRaw.length > 12 ? Math.ceil(dailySeriesRaw.length / 8) : 1;
      const dailySeries = dailySeriesRaw.map((item, index) => ({
        ...item,
        shortLabel:
          index % labelStep === 0 || index === dailySeriesRaw.length - 1 ? item.shortLabel : ' '
      }));
      const trendSeries = applyProfitTrendRangeToSeries(dailySeries, profitTrendRange);

      if (profitTrendEl) {
        profitTrendEl.innerHTML = trendSeries.length
          ? ProfitLineChart(trendSeries, {
              height: '250px',
              format: (value) => `${Number(value || 0).toFixed(2)} JOD`
            })
          : '<div class="h-[250px] flex items-center justify-center text-sm text-muted">No profit data for the selected range.</div>';
      }

      const categoryPalette = {
        Utilities: '#ef4444',
        Equipment: '#f97316',
        Tools: '#f59e0b',
        Maintenance: '#06b6d4',
        Rent: '#8b5cf6',
        Salary: '#ec4899',
        Supplies: '#22c55e',
        Other: '#64748b'
      };
      const expenseItems = Array.from(expenseCategoryTotals.entries())
        .map(([label, value]) => ({
          label,
          value: Number(value.toFixed(2)),
          color: categoryPalette[label] || '#64748b'
        }))
        .sort((a, b) => b.value - a.value);
      const expenseTotal = expenseItems.reduce((sum, item) => sum + item.value, 0);

      if (expenseBreakdownEl) {
        expenseBreakdownEl.innerHTML = expenseItems.length
          ? SimpleDonutChart(expenseItems, {
              size: 180,
              cutout: '28%',
              centerLabel: 'Expenses',
              centerValue: `${expenseTotal.toFixed(2)} JOD`,
              legendValueFormatter: (item) => {
                const pct = expenseTotal > 0 ? (Number(item.value || 0) / expenseTotal) * 100 : 0;
                return `${Number(item.value || 0).toFixed(2)} JOD (${pct.toFixed(0)}%)`;
              }
            })
          : '<div class="h-[250px] flex items-center justify-center text-sm text-muted">No expense category data available.</div>';
      }
    }

    function renderTransactions(transactions) {
      if (!transactions.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" class="text-center py-10">
              <p class="text-sm font-semibold text-text">No transactions found</p>
              <p class="text-xs text-muted mt-1">Try adjusting filters</p>
              <button type="button" id="tx-empty-clear" class="mt-4 px-4 py-2 rounded-lg border border-border text-sm font-semibold text-text hover:bg-bg transition-colors">Clear Filters</button>
            </td>
          </tr>
        `;
        const emptyClearBtn = document.getElementById('tx-empty-clear');
        if (emptyClearBtn) {
          emptyClearBtn.onclick = () => {
            resetTransactionFilters();
            applyTransactionFilters();
          };
        }
        return;
      }

      tbody.innerHTML = transactions.map((t) => {
        const vm = getTransactionViewModel(t);
        const sourceBadgeClass = vm.sellingBucket === 'WALK_IN'
          ? 'bg-success/15 text-success border border-success/20'
          : vm.sellingBucket === 'BOOKING'
            ? 'bg-primary/15 text-primary border border-primary/20'
            : vm.sellingBucket === 'INVENTORY'
              ? 'bg-primary/15 text-primary border border-primary/20'
              : vm.sellingBucket === 'EXPENSE'
                ? 'bg-danger/15 text-danger border border-danger/20'
                : 'bg-bg text-muted border border-border';
        const createdBy = t.createdBy?.fullName || t.createdBy?.phone || '-';
        return `
          <tr class="group border-b border-border bg-surface hover:bg-bg transition-colors ${t.type === 'INCOME' ? 'border-l-4 border-l-success/60' : 'border-l-4 border-l-danger/60'}">
            <td class="px-5 py-4 whitespace-nowrap text-xs font-mono text-muted">${vm.dateLabel}<br>${vm.timeLabel}</td>
            <td class="px-5 py-4 whitespace-nowrap"><span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${t.type === 'INCOME' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}">${t.type}</span></td>
            <td class="px-5 py-4 whitespace-nowrap text-xs font-semibold tracking-wider"><span class="inline-flex rounded-full px-2 py-1 ${sourceBadgeClass}">${vm.sellingTypeLabel}</span></td>
            <td class="px-5 py-4 whitespace-nowrap text-sm font-bold text-text truncate max-w-[150px]">${vm.itemTitle}</td>
            <td class="px-5 py-4 whitespace-nowrap text-xs text-muted truncate max-w-[150px]">${vm.noteShort}</td>
            <td class="px-5 py-4 whitespace-nowrap text-right text-sm font-bold text-text">${vm.displayQuantity}</td>
            <td class="px-5 py-4 whitespace-nowrap text-right text-sm font-bold text-text">${Number(vm.displayUnitPrice || 0).toFixed(2)} JOD</td>
            <td class="px-5 py-4 whitespace-nowrap text-right font-bold font-mono ${vm.color}">${Math.abs(Number(t.amount)).toFixed(2)} JOD</td>
            <td class="px-5 py-4 whitespace-nowrap text-xs text-muted">${createdBy}</td>
            <td class="px-5 py-4 whitespace-nowrap text-right">
              ${vm.hasDetails ? `<button onclick="window.viewTransactionDetails('${t.id}')" class="text-xs font-bold text-primary border border-primary/30 px-3 py-1.5 rounded-md hover:bg-primary hover:text-white transition-colors">View Details</button>` : '<span class="text-xs text-muted">-</span>'}
            </td>
          </tr>
        `;
      }).join('');
    }

    function updateTransactionSummary(transactions) {
      if (!txSummary) return;
      const incomeCount = transactions.filter((t) => t.type === 'INCOME').length;
      const expenseCount = transactions.filter((t) => t.type === 'EXPENSE').length;
      txSummary.textContent = `${transactions.length} transactions | ${incomeCount} income | ${expenseCount} expenses`;
    }

    function resetTransactionFilters() {
      txFilterState = {
        q: '',
        type: 'ALL',
        sellingType: 'ALL',
        fromDate: '',
        toDate: '',
        sort: 'NEWEST'
      };
      if (txSearchInput) txSearchInput.value = '';
      if (txTypeFilter) txTypeFilter.value = 'ALL';
      if (txSellingTypeFilter) txSellingTypeFilter.value = 'ALL';
      if (txFromDate) txFromDate.value = '';
      if (txToDate) txToDate.value = '';
      if (txSortFilter) txSortFilter.value = 'NEWEST';
    }

    function applyTransactionFilters() {
      const all = Array.isArray(window.allTransactions) ? window.allTransactions.slice() : [];

      const filtered = filterTransactionsByState(all, txFilterState, {
        getSellingBucket: (tx) => getTransactionViewModel(tx).sellingBucket,
        buildSearchBlob: (tx) => {
          const vm = getTransactionViewModel(tx);
          return normalizeText([
            vm.itemTitle,
            vm.note,
            tx.type,
            vm.sellingTypeLabel,
            vm.sellingType,
            tx.createdBy?.fullName || '',
            tx.createdBy?.phone || '',
            tx.booking?.customerName || '',
            tx.booking?.customerPhone || ''
          ].join(' '));
        }
      });

      updateTransactionSummary(filtered);
      renderTransactions(filtered);
      renderTopSummary(filtered);
      renderLedgerInsights(filtered, all);
    }

    function closeWalkinOverlay() {
      walkinOverlay.classList.add('hidden');
    }

    function closeExpenseOverlay() {
      expenseOverlay.classList.add('hidden');
    }

    function openIncome() {
      walkinOverlay.classList.remove('hidden');
      expenseOverlay.classList.add('hidden');
      updateSaleCustomerMode();
      renderIncomeComboboxResults(incomeItemSearch.value);
    }

    function openExpense() {
      expenseOverlay.classList.remove('hidden');
      walkinOverlay.classList.add('hidden');
    }

    window.closeWalkinOverlay = closeWalkinOverlay;
    window.closeExpenseOverlay = closeExpenseOverlay;

    document.getElementById('add-income-btn').onclick = openIncome;
    document.getElementById('add-expense-btn').onclick = openExpense;

    walkinOverlay.onclick = (event) => {
      if (event.target === walkinOverlay) closeWalkinOverlay();
    };
    expenseOverlay.onclick = (event) => {
      if (event.target === expenseOverlay) closeExpenseOverlay();
    };

    if (!window.__accountingEscBound) {
      window.__accountingEscBound = true;
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        const walkinNode = document.getElementById('walkin-overlay');
        const expenseNode = document.getElementById('expense-overlay');
        if (walkinNode && !walkinNode.classList.contains('hidden')) walkinNode.classList.add('hidden');
        if (expenseNode && !expenseNode.classList.contains('hidden')) expenseNode.classList.add('hidden');
      });
    }

    if (window.location.hash === '#walkin-sale') {
      openIncome();
    } else if (window.location.hash === '#add-expense') {
      openExpense();
    }

    function renderPartsSelects() {
      incomeItemLookup = new Map();
      for (const item of parts) {
        const label = `${item.name}${item.vehicleModel ? ` - ${item.vehicleModel}` : ''}${item.vehicleType ? ` (${item.vehicleType})` : ''}`;
        incomeItemLookup.set(label, item.id);
      }

      const options = [
        '<option value="">No catalog item (manual entry)...</option>',
        ...parts.map(
          (item) =>
            `<option value="${item.id}">${item.name}${item.vehicleModel ? ` - ${item.vehicleModel}` : ''}${item.vehicleType ? ` (${item.vehicleType})` : ''}</option>`
        )
      ].join('');
      incomeItemSelect.innerHTML = options;
      expenseItemSelect.innerHTML = options;

      if (parts.length) {
        expenseItemSelect.value = '';
        applyExpensePartToForm(expenseItemSelect, expenseForm);
        renderIncomeComboboxResults(incomeItemSearch.value);
      } else {
        incomeItemSearch.value = '';
        incomeItemResults.innerHTML = '<div class="px-3 py-2 text-sm text-muted">No inventory items found.</div>';
        expenseForm.itemName.value = '';
        expenseForm.unitPrice.value = '';
      }
    }

    function getPartLabel(item) {
      return `${item.name}${item.vehicleModel ? ` - ${item.vehicleModel}` : ''}${item.vehicleType ? ` (${item.vehicleType})` : ''}`;
    }

    function getFilteredIncomeParts(rawValue) {
      const query = String(rawValue || '').trim().toLowerCase();
      if (!query) return parts.slice(0, 12);
      return parts
        .filter((item) => {
          const label = getPartLabel(item).toLowerCase();
          return (
            label.includes(query) ||
            (item.sku || '').toLowerCase().includes(query) ||
            (item.vehicleModel || '').toLowerCase().includes(query) ||
            (item.vehicleType || '').toLowerCase().includes(query)
          );
        })
        .slice(0, 12);
    }

    function openIncomeCombobox() {
      incomeItemResults.classList.remove('hidden');
    }

    function closeIncomeCombobox() {
      incomeItemResults.classList.add('hidden');
      activeIncomeResultIndex = -1;
    }

    function setSelectedIncomePart(part, { syncSearch = true, closeList = true } = {}) {
      incomeItemSelect.value = part?.id || '';
      if (syncSearch) {
        incomeItemSearch.value = part ? getPartLabel(part) : '';
      }
      renderIncomeComboboxResults(syncSearch ? '' : incomeItemSearch.value);
      if (closeList) closeIncomeCombobox();
    }

    function renderIncomeComboboxResults(rawValue) {
      const filtered = getFilteredIncomeParts(rawValue);
      const selectedId = incomeItemSelect.value;
      if (!filtered.length) {
        incomeItemResults.innerHTML = '<div class="px-3 py-2 text-sm text-muted">No matching inventory items.</div>';
        activeIncomeResultIndex = -1;
        openIncomeCombobox();
        return;
      }

      if (activeIncomeResultIndex >= filtered.length) {
        activeIncomeResultIndex = filtered.length - 1;
      }

      incomeItemResults.innerHTML = filtered
        .map((item, index) => {
          const isActive = index === activeIncomeResultIndex;
          const isSelected = item.id === selectedId;
          return `
            <button
              type="button"
              data-part-id="${item.id}"
              class="flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition-colors ${isActive ? 'bg-success/15' : 'hover:bg-bg'} ${isSelected ? 'text-success' : 'text-text'}"
            >
              <span class="min-w-0">
                <span class="block truncate text-sm font-semibold">${escapeAttr(item.name)}</span>
                <span class="block truncate text-xs text-muted">${escapeAttr(`${item.sku || 'No SKU'}${item.vehicleModel ? ` | ${item.vehicleModel}` : ''}${item.vehicleType ? ` | ${item.vehicleType}` : ''}`)}</span>
              </span>
              <span class="shrink-0 text-xs text-muted">${Number(item.stockQty || 0)} in stock</span>
            </button>
          `;
        })
        .join('');
      openIncomeCombobox();
    }

    function findIncomePartIdByQuery(rawValue) {
      const query = String(rawValue || '').trim().toLowerCase();
      if (!query) return '';

      const exact = incomeItemLookup.get(rawValue);
      if (exact) return exact;

      const partial = parts.find((item) => {
        const label = `${item.name}${item.vehicleModel ? ` - ${item.vehicleModel}` : ''}${item.vehicleType ? ` (${item.vehicleType})` : ''}`;
        return label.toLowerCase().includes(query);
      });
      return partial?.id || '';
    }

    function syncIncomeItemFromSearch() {
      const partId = findIncomePartIdByQuery(incomeItemSearch.value);
      incomeItemSelect.value = partId;
      renderIncomeComboboxResults(incomeItemSearch.value);
      openIncomeCombobox();
      return partId;
    }

    function syncIncomeSearchFromSelect() {
      const selected = parts.find((item) => item.id === incomeItemSelect.value);
      incomeItemSearch.value = selected
        ? `${selected.name}${selected.vehicleModel ? ` - ${selected.vehicleModel}` : ''}${selected.vehicleType ? ` (${selected.vehicleType})` : ''}`
        : '';
    }

    function selectDefaultIncomeItem() {
      if (!parts.length) {
        incomeItemSelect.value = '';
        incomeItemSearch.value = '';
        return;
      }
      if (!incomeItemSelect.value) {
        incomeItemSelect.value = parts[0].id;
      } else {
        const exists = parts.some((item) => item.id === incomeItemSelect.value);
        if (!exists) incomeItemSelect.value = parts[0].id;
      }
      syncIncomeSearchFromSelect();
      renderIncomeComboboxResults('');
    }

    function getCustomerLabel(customer) {
      return customer.fullName ? `${customer.fullName} (${customer.phone})` : customer.phone;
    }

    function renderCustomersSelect() {
      saleCustomerSelect.innerHTML = [
        '<option value=\"\">Select customer...</option>',
        ...customers.map((item) => `<option value=\"${item.id}\">${getCustomerLabel(item)}</option>`)
      ].join('');
      if (saleCustomerList) {
        saleCustomerList.innerHTML = customers
          .map((item) => `<option value=\"${escapeAttr(getCustomerLabel(item))}\"></option>`)
          .join('');
      }
    }

    function resolveCustomerId(rawValue) {
      const query = normalizeText(rawValue);
      if (!query) return '';

      const exact = customers.find((item) => {
        const nameOnly = normalizeText(item.fullName || '');
        const phoneOnly = normalizeText(item.phone || '');
        const fullLabel = normalizeText(getCustomerLabel(item));
        return nameOnly === query || phoneOnly === query || fullLabel === query;
      });
      if (exact) return exact.id;

      const partial = customers.find((item) => {
        const label = normalizeText(`${item.fullName || ''} ${item.phone || ''} ${getCustomerLabel(item)}`);
        return label.includes(query);
      });
      return partial?.id || '';
    }

    function syncSaleCustomerSelectFromSearch() {
      saleCustomerSelect.value = resolveCustomerId(saleCustomerSearch?.value || '');
    }

    function syncSaleCustomerSearchFromSelect() {
      if (!saleCustomerSearch) return;
      const selected = customers.find((item) => item.id === saleCustomerSelect.value);
      saleCustomerSearch.value = selected ? getCustomerLabel(selected) : '';
    }

    function resetSaleCustomerFields() {
      saleCustomerSelect.value = '';
      if (saleCustomerSearch) saleCustomerSearch.value = '';
      quickCustomerName.value = '';
      quickCustomerPhone.value = '';
      walkinCustomerName.value = '';
      walkinCustomerPhone.value = '';
    }

    function updateSaleCustomerMode() {
      const mode = saleCustomerTypeSelect.value;
      existingCustomerFields.classList.toggle('hidden', mode !== 'existing');
      quickCustomerFields.classList.toggle('hidden', mode !== 'quick');
      walkinCustomerFields.classList.toggle('hidden', mode !== 'walkin');
    }

    function applyExpensePartToForm(selectNode, formNode) {
      const item = parts.find((p) => p.id === selectNode.value) || null;
      if (!item) {
        formNode.itemName.readOnly = false;
        return;
      }
      formNode.itemName.value = item.name;
      formNode.unitPrice.value = item.sellPrice !== null ? Number(item.sellPrice).toFixed(2) : '0.00';
      formNode.expenseCategory.value = 'Supplies';
      formNode.itemName.readOnly = true;
    }

    async function loadParts() {
      try {
        const response = await apiFetch('/inventory/parts');
        parts = response.items || [];
        renderPartsSelects();
      } catch (error) {
        parts = [];
        renderPartsSelects();
        window.toast(error.message || 'Failed to load inventory parts.', 'error');
      }
    }

    async function loadCustomers() {
      try {
        const response = await apiFetch('/admin/customers?status=active&page=1&limit=100');
        customers = response.items || [];
        renderCustomersSelect();
      } catch (error) {
        customers = [];
        renderCustomersSelect();
        window.toast(error.message || 'Failed to load customers for ledger posting.', 'error');
      }
    }

    window.openAddToCartModal = () => {
      const partId = incomeItemSelect.value || syncIncomeItemFromSearch();
      const part = parts.find(p => p.id === partId);
      if (!part) {
        window.toast('Please select an inventory item first.', 'error');
        return;
      }
      document.getElementById('cart-modal-part-name').value = part.name;
      document.getElementById('cart-modal-vehicle-type').value = part.vehicleType || '';
      document.getElementById('cart-modal-vehicle-model').value = part.vehicleModel || '';
      document.getElementById('cart-modal-stock').value = part.stockQty || 0;
      document.getElementById('cart-modal-qty').value = '1';
      document.getElementById('cart-modal-price').value = part.sellPrice !== null ? part.sellPrice : 0;
      document.getElementById('cart-modal-price').disabled = !canEditSaleUnitPrice;
      document.getElementById('cart-modal-note').value = '';
      document.getElementById('cart-modal').classList.remove('hidden');
    };

    window.closeAddToCartModal = () => {
      document.getElementById('cart-modal').classList.add('hidden');
    };

    window.confirmAddToCart = () => {
      const partId = incomeItemSelect.value;
      const part = parts.find(p => p.id === partId);
      if (!part) {
        window.toast('Please select an inventory item first.', 'error');
        return;
      }

      const qty = parseInt(document.getElementById('cart-modal-qty').value, 10);
      const price = parseFloat(document.getElementById('cart-modal-price').value);
      const note = document.getElementById('cart-modal-note').value;

      if (isNaN(qty) || qty < 1 || isNaN(price) || price < 0) {
        window.toast('Invalid quantity or price.', 'error');
        return;
      }
      const stock = Number(part.stockQty || 0);
      const reservedQty = saleCart
        .filter((line) => line.partId === part.id)
        .reduce((sum, line) => sum + Number(line.quantity || 0), 0);
      if (qty + reservedQty > stock) {
        window.toast(`Requested quantity exceeds available stock (${stock}).`, 'error');
        return;
      }

      saleCart.push({
        partId: part.id,
        partName: part.name,
        vehicleCategory: part.vehicleType || '-',
        carModel: part.vehicleModel || '-',
        quantity: qty,
        unitPrice: price,
        note: note
      });
      renderCart();
      window.toast('Item added to cart.', 'success');
      window.closeAddToCartModal();
    };

    window.removeCartLine = (index) => {
      saleCart.splice(index, 1);
      renderCart();
    };
    window.clearCart = () => {
      saleCart = [];
      renderCart();
      window.toast('Cart cleared.', 'success');
    };

    function renderCart() {
      const tbody = document.getElementById('cart-tbody');
      if (!saleCart.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-3 py-3 text-center text-muted">Cart is empty.</td></tr>';
        document.getElementById('cart-total-display').textContent = '0.00';
        document.getElementById('cart-checkout-btn').disabled = true;
        return;
      }

      let total = 0;
      tbody.innerHTML = saleCart.map((line, index) => {
        const lineTotal = line.quantity * line.unitPrice;
        total += lineTotal;
        return `
          <tr class="border-t border-border bg-bg">
            <td class="px-3 py-2 text-sm">${line.partName}</td>
            <td class="px-3 py-2 text-sm">${line.vehicleCategory}</td>
            <td class="px-3 py-2 text-sm">${line.carModel}</td>
            <td class="px-3 py-2 text-sm">${line.quantity}</td>
            <td class="px-3 py-2 text-sm">${line.unitPrice.toFixed(2)} JOD</td>
            <td class="px-3 py-2 text-sm font-semibold">${lineTotal.toFixed(2)} JOD</td>
            <td class="px-3 py-2"><button type="button" onclick="window.removeCartLine(${index})" class="text-xs font-semibold text-danger border border-danger/30 px-2 py-1 rounded-md hover:bg-danger hover:text-white transition-colors">Remove</button></td>
          </tr>
        `;
      }).join('');
      document.getElementById('cart-total-display').textContent = total.toFixed(2);
      document.getElementById('cart-checkout-btn').disabled = false;
    }

    async function load() {
      tbody.innerHTML = TableRowSkeleton(6).repeat(8);
      document.getElementById('total-income-val').innerHTML = '<span class="skeleton h-8 w-24 inline-block rounded"></span>';
      document.getElementById('total-expense-val').innerHTML = '<span class="skeleton h-8 w-24 inline-block rounded"></span>';
      document.getElementById('net-profit-val').innerHTML = '<span class="skeleton h-8 w-24 inline-block rounded"></span>';
      if (todayRevenueEl) todayRevenueEl.innerHTML = '<span class="skeleton h-6 w-24 inline-block rounded"></span>';
      if (todayExpensesEl) todayExpensesEl.innerHTML = '<span class="skeleton h-6 w-24 inline-block rounded"></span>';
      if (todayNetEl) todayNetEl.innerHTML = '<span class="skeleton h-6 w-24 inline-block rounded"></span>';
      if (profitTrendEl) profitTrendEl.innerHTML = '<div class="h-[250px] rounded-lg border border-border/60 bg-bg/40"></div>';
      if (expenseBreakdownEl) expenseBreakdownEl.innerHTML = '<div class="h-[250px] rounded-lg border border-border/60 bg-bg/40"></div>';

      try {
        const [txRes, sumRes] = await Promise.all([
          apiFetch('/accounting/transactions'),
          apiFetch('/accounting/reports/summary')
        ]);

        if (txRes && txRes.items) {
          window.allTransactions = txRes.items;
          applyTransactionFilters();
        }

        if (sumRes && (!txRes || !txRes.items)) {
          const inc = parseFloat(sumRes.walkInIncome || 0);
          const exp = Math.abs(parseFloat(sumRes.expenses || 0));
          const net = inc - exp;

          document.getElementById('total-income-val').innerHTML = `${inc.toFixed(2)} JOD`;
          document.getElementById('total-expense-val').innerHTML = `${exp.toFixed(2)} JOD`;
          document.getElementById('net-profit-val').innerHTML = `${net < 0 ? '-' : ''}${Math.abs(net).toFixed(2)} JOD`;
          document.getElementById('net-profit-val').className = `mt-3 text-3xl font-bold leading-none tabular-nums ${net > 0 ? 'text-success' : net < 0 ? 'text-danger' : 'text-text'}`;
        }

      } catch (e) {
        window.toast('Error loading accounting data', 'error');
      }
    }

    window.viewTransactionDetails = (txId) => {
      const tx = window.allTransactions?.find(t => t.id === txId);
      if (!tx || !tx.invoice) return;

      const lines = tx.invoice.invoiceLines || [];
      const tbody = document.getElementById('tx-details-tbody');

      if (lines.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-muted">No line items found.</td></tr>';
      } else {
        tbody.innerHTML = lines.map(line => `
          <tr class="border-b border-border/50 bg-bg hover:bg-surface">
            <td class="px-3 py-2 text-sm text-text font-semibold">${line.part?.name || line.description || 'Unknown Item'}</td>
            <td class="px-3 py-2 text-xs text-muted">${line.part?.vehicleModel || '-'}</td>
            <td class="px-3 py-2 text-sm text-center">${line.quantity}</td>
            <td class="px-3 py-2 text-sm text-right">${Number(line.unitAmount).toFixed(2)}</td>
            <td class="px-3 py-2 text-sm text-right font-bold">${Number(line.lineTotal).toFixed(2)}</td>
          </tr>
        `).join('');
      }

      document.getElementById('tx-details-modal').classList.remove('hidden');
    };

    window.closeTxDetailsModal = () => {
      document.getElementById('tx-details-modal').classList.add('hidden');
    };

    window.checkoutCart = async () => {
      if (!saleCart.length) return;
      document.getElementById('cart-checkout-btn').disabled = true;
      document.getElementById('cart-checkout-btn').textContent = 'Processing...';

      const customerMode = saleCustomerTypeSelect.value;
      const invoiceNumber = `SALE-${Date.now()}`;
      const payload = {
        number: invoiceNumber,
        note: "Sale from accounting cart",
        lines: saleCart.map(line => ({
          partId: line.partId,
          lineType: "INVENTORY",
          description: line.partName,
          quantity: line.quantity,
          unitAmount: line.unitPrice
        }))
      };

      const saleDateStr = document.getElementById('cart-sale-date').value;
      const saleTimeStr = document.getElementById('cart-sale-time').value;
      if (saleDateStr) {
        const issueDateRaw = saleTimeStr ? `${saleDateStr}T${saleTimeStr}` : `${saleDateStr}T12:00`;
        payload.issueDate = new Date(issueDateRaw).toISOString();
      }

      const idempotencyKey = `sale-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      try {
        if (customerMode === 'existing') {
          if (!saleCustomerSelect.value) {
            throw new Error('Select an existing customer or choose a different customer type.');
          }
          payload.customerId = saleCustomerSelect.value;
        } else if (customerMode === 'quick') {
          if (!store.isAdmin()) {
            throw new Error('Quick Create Customer requires admin access. Use Walk-in (No Account) or Existing Customer.');
          }
          if (!quickCustomerName.value.trim() || !quickCustomerPhone.value.trim()) {
            throw new Error('Quick Create Customer requires name and phone.');
          }
          const created = await apiFetch('/admin/customers', {
            method: 'POST',
            body: {
              fullName: quickCustomerName.value.trim(),
              phone: quickCustomerPhone.value.trim()
            }
          });
          const createdCustomer = created?.item;
          if (createdCustomer?.id) {
            customers = [createdCustomer, ...customers.filter((item) => item.id !== createdCustomer.id)];
            renderCustomersSelect();
            saleCustomerSelect.value = createdCustomer.id;
            syncSaleCustomerSearchFromSelect();
            payload.customerId = createdCustomer.id;
            if (created?.temporaryPassword) {
              window.toast(`Customer created. Temporary password: ${created.temporaryPassword}`, 'success');
            }
          }
        }
        await apiFetch('/accounting/sale-invoices', {
          method: 'POST',
          headers: { 'Idempotency-Key': idempotencyKey },
          body: payload
        });
        window.toast('Cart sale confirmed and inventory updated.', 'success');
        saleCart = [];
        renderCart();
        document.getElementById('cart-sale-date').value = '';
        document.getElementById('cart-sale-time').value = '';
        saleCustomerTypeSelect.value = 'existing';
        resetSaleCustomerFields();
        updateSaleCustomerMode();
        selectDefaultIncomeItem();
        closeWalkinOverlay();
        load();
      } catch (e) {
        window.toast(e.message, 'error');
      } finally {
        document.getElementById('cart-checkout-btn').disabled = false;
        document.getElementById('cart-checkout-btn').textContent = 'Confirm Cart Sale';
      }
    };

    expenseForm.onsubmit = async (e) => {
      e.preventDefault();
      const selectedPartId = expenseItemSelect.value || undefined;
      const idempotencyKey = `expense-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const submitBtn = expenseForm.querySelector('button[type="submit"]');
      const quantityInput = expenseForm.querySelector('[name="quantity"]');
      const unitPriceInput = expenseForm.querySelector('[name="unitPrice"]');
      const quantity = Number.parseInt(quantityInput?.value || '1', 10);
      const unitPrice = Number.parseFloat(unitPriceInput?.value || '0');
      if (!Number.isInteger(quantity) || quantity < 1 || Number.isNaN(unitPrice) || unitPrice < 0) {
        window.toast('Invalid quantity or price.', 'error');
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      try {
        await apiFetch('/accounting/expenses', {
          method: 'POST',
          headers: { 'Idempotency-Key': idempotencyKey },
          body: {
            itemName: expenseForm.itemName.value,
            unitPrice,
            quantity,
            note: expenseForm.note.value || undefined,
            expenseCategory: EXPENSE_CATEGORY_TO_API[expenseForm.expenseCategory.value] || 'GENERAL',
            partId: selectedPartId,
            supplierName: expenseForm.supplierName.value || undefined,
            occurredAt: expenseForm.occurredAt.value ? new Date(expenseForm.occurredAt.value).toISOString() : new Date().toISOString()
          }
        });
        window.toast('Expense recorded', 'success');
        expenseForm.reset();
        applyExpensePartToForm(expenseItemSelect, expenseForm);
        closeExpenseOverlay();
        load();
      } catch (e) { window.toast(e.message, 'error'); }
      finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    };

    expenseItemSelect.addEventListener('change', () => applyExpensePartToForm(expenseItemSelect, expenseForm));
    incomeItemSearch.addEventListener('input', syncIncomeItemFromSearch);
    incomeItemSearch.addEventListener('focus', () => {
      renderIncomeComboboxResults(incomeItemSearch.value);
      openIncomeCombobox();
    });
    incomeItemSearch.addEventListener('click', () => {
      renderIncomeComboboxResults(incomeItemSearch.value);
      openIncomeCombobox();
    });
    incomeItemSearch.addEventListener('keydown', (event) => {
      const filtered = getFilteredIncomeParts(incomeItemSearch.value);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        activeIncomeResultIndex = filtered.length ? Math.min(activeIncomeResultIndex + 1, filtered.length - 1) : -1;
        renderIncomeComboboxResults(incomeItemSearch.value);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        activeIncomeResultIndex = filtered.length ? Math.max(activeIncomeResultIndex - 1, 0) : -1;
        renderIncomeComboboxResults(incomeItemSearch.value);
        return;
      }
      if (event.key === 'Enter' && filtered.length) {
        event.preventDefault();
        const picked = filtered[Math.max(activeIncomeResultIndex, 0)];
        setSelectedIncomePart(picked);
      }
    });
    incomeItemSelect.addEventListener('change', syncIncomeSearchFromSelect);
    incomeItemResults.addEventListener('click', (event) => {
      const button = event.target.closest('[data-part-id]');
      if (!button) return;
      const part = parts.find((item) => item.id === button.getAttribute('data-part-id'));
      if (!part) return;
      setSelectedIncomePart(part);
    });
    document.addEventListener('click', (event) => {
      if (!incomeCombobox.contains(event.target)) {
        closeIncomeCombobox();
      }
    });
    saleCustomerTypeSelect.addEventListener('change', updateSaleCustomerMode);
    saleCustomerSearch?.addEventListener('input', syncSaleCustomerSelectFromSearch);
    saleCustomerSearch?.addEventListener('change', syncSaleCustomerSelectFromSearch);
    saleCustomerSelect?.addEventListener('change', syncSaleCustomerSearchFromSelect);

    const onTxFiltersChanged = () => {
      txFilterState.q = txSearchInput?.value || '';
      txFilterState.type = txTypeFilter?.value || 'ALL';
      txFilterState.sellingType = txSellingTypeFilter?.value || 'ALL';
      txFilterState.fromDate = txFromDate?.value || '';
      txFilterState.toDate = txToDate?.value || '';
      txFilterState.sort = txSortFilter?.value || 'NEWEST';
      applyTransactionFilters();
    };

    txSearchInput?.addEventListener('input', onTxFiltersChanged);
    txTypeFilter?.addEventListener('change', onTxFiltersChanged);
    txSellingTypeFilter?.addEventListener('change', onTxFiltersChanged);
    txFromDate?.addEventListener('change', onTxFiltersChanged);
    txToDate?.addEventListener('change', onTxFiltersChanged);
    txSortFilter?.addEventListener('change', onTxFiltersChanged);
    profitTrendRangeFilterEl?.addEventListener('change', () => {
      profitTrendRange = profitTrendRangeFilterEl.value || 'ALL';
      applyTransactionFilters();
    });
    document.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement)) return;
      if (target.id !== 'profit-trend-range-filter') return;
      profitTrendRange = target.value || 'ALL';
      applyTransactionFilters();
    });
    txClearFilters?.addEventListener('click', () => {
      resetTransactionFilters();
      applyTransactionFilters();
    });

    await Promise.all([loadParts(), loadCustomers()]);
    selectDefaultIncomeItem();
    updateSaleCustomerMode();
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
        <div class="flex items-center gap-3 w-full md:w-auto relative z-10">
          <button id="add-income-btn" class="flex-1 md:flex-none border-2 border-success text-success hover:bg-success hover:text-white px-5 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm">+ Walk-in Sale</button>
          <button id="add-expense-btn" class="flex-1 md:flex-none border-2 border-danger text-danger hover:bg-danger hover:text-white px-5 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm">- Log Expense</button>
        </div>
      </div>

      <!-- Quick Summary -->
      <div class="flex items-center justify-between">
        <p class="text-xs uppercase tracking-wider text-muted font-bold">This Month</p>
      </div>
      <div id="report-summary" class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 relative z-10">
        <article class="h-full min-h-[156px] rounded-xl border border-border bg-surface p-4 flex flex-col">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-2 w-2 rounded-full bg-success"></span>
            <p class="text-xs uppercase font-bold text-muted tracking-widest">Total Income</p>
          </div>
          <h3 id="total-income-val" class="mt-3 text-3xl font-bold leading-none tabular-nums text-success">0.00</h3>
          <p class="mt-auto h-5 truncate text-xs text-muted">Across current transaction set</p>
        </article>
        <article class="h-full min-h-[156px] rounded-xl border border-border bg-surface p-4 flex flex-col">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-2 w-2 rounded-full bg-danger"></span>
            <p class="text-xs uppercase font-bold text-muted tracking-widest">Total Expenses</p>
          </div>
          <h3 id="total-expense-val" class="mt-3 text-3xl font-bold leading-none tabular-nums text-danger">0.00</h3>
          <p class="mt-auto h-5 truncate text-xs text-muted">Across current transaction set</p>
        </article>
        <article class="h-full min-h-[156px] rounded-xl border border-border bg-surface p-4 flex flex-col">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-2 w-2 rounded-full bg-primary"></span>
            <p class="text-xs uppercase font-bold text-muted tracking-widest">Net Profit / Loss</p>
          </div>
          <h3 id="net-profit-val" class="mt-3 text-3xl font-bold leading-none tabular-nums text-text">0.00</h3>
          <p class="mt-auto h-5 truncate text-xs text-muted">Income minus expenses</p>
        </article>
        <article class="h-full min-h-[156px] rounded-xl border border-border bg-surface p-4 flex flex-col">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-2 w-2 rounded-full bg-success"></span>
            <p class="text-xs uppercase font-bold text-muted tracking-widest">Today Revenue</p>
          </div>
          <h4 id="today-revenue-val" class="mt-3 text-3xl font-bold leading-none tabular-nums text-success">0.00 JOD</h4>
          <p id="today-revenue-meta" class="mt-auto h-5 truncate text-xs text-muted">Compared to yesterday: 0%</p>
        </article>
        <article class="h-full min-h-[156px] rounded-xl border border-border bg-surface p-4 flex flex-col">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-2 w-2 rounded-full bg-danger"></span>
            <p class="text-xs uppercase font-bold text-muted tracking-widest">Today Expenses</p>
          </div>
          <h4 id="today-expenses-val" class="mt-3 text-3xl font-bold leading-none tabular-nums text-danger">0.00 JOD</h4>
          <p id="today-expenses-meta" class="mt-auto h-5 truncate text-xs text-muted">0 expense records today</p>
        </article>
        <article class="h-full min-h-[156px] rounded-xl border border-border bg-surface p-4 flex flex-col">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-2 w-2 rounded-full bg-primary"></span>
            <p class="text-xs uppercase font-bold text-muted tracking-widest">Today Net Profit</p>
          </div>
          <h4 id="today-net-val" class="mt-3 text-3xl font-bold leading-none tabular-nums text-text">0.00 JOD</h4>
          <p id="today-net-meta" class="mt-auto h-5 truncate text-xs text-muted">Positive day</p>
        </article>
      </div>

      <!-- Ledger Insights -->
      <div class="grid grid-cols-1 gap-4">
        <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <article class="xl:col-span-2 bg-surface border border-border rounded-xl p-4 min-h-[320px] flex flex-col">
            <header class="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 class="text-sm font-bold text-text uppercase tracking-wider">Profit Trend</h3>
                <p class="text-xs text-muted mt-1">Daily net profit over the selected period</p>
              </div>
              <select id="profit-trend-range-filter" class="h-9 rounded-lg border border-border bg-bg px-3 text-xs font-semibold text-text outline-none focus:border-primary">
                <option value="ALL" selected>All</option>
                <option value="7D">Last 7D</option>
                <option value="30D">Last 30D</option>
                <option value="90D">Last 90D</option>
              </select>
            </header>
            <div id="chart-profit-trend-ledger" class="flex-1 min-h-[250px] overflow-hidden"></div>
          </article>
          <article class="bg-surface border border-border rounded-xl p-4 min-h-[320px] flex flex-col">
            <header class="mb-3">
              <h3 class="text-sm font-bold text-text uppercase tracking-wider">Expense Breakdown</h3>
              <p class="text-xs text-muted mt-1">Where expenses are going</p>
            </header>
            <div id="chart-expense-breakdown-ledger" class="flex-1 min-h-[250px]"></div>
          </article>
        </div>
      </div>

      <!-- Walk-in Sale Modal -->
      <div id="walkin-overlay" class="hidden fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="w-full max-w-6xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
          <div class="flex items-center justify-between px-6 py-4 border-b border-border bg-bg/50">
            <div>
              <h3 class="text-xl font-heading font-bold text-text">Walk-in Sale</h3>
              <p class="text-sm text-muted">Sale from inventory checkout and customer charge.</p>
            </div>
            <button type="button" onclick="window.closeWalkinOverlay()" class="text-muted hover:text-text">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div class="p-6 overflow-y-auto">
            <div id="income-container" class="border border-success/30 rounded-xl bg-surface p-4 shadow-sm">
              <h3 class="font-bold text-success mb-3">Sale From Inventory (Checkout)</h3>
              <div class="grid gap-3 md:grid-cols-2 mb-4">
                <div class="md:col-span-2">
                  <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">Customer Type</label>
                  <select id="sale-customer-type" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-success">
                    <option value="existing">Existing Customer</option>
                    <option value="quick">Quick Create Customer</option>
                    <option value="walkin">Walk-in (No Account)</option>
                  </select>
                </div>
                <div id="existing-customer-fields" class="md:col-span-2">
                  <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">Existing Customer</label>
                  <input id="sale-customer-search" list="sale-customer-list" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-success" placeholder="Select or type customer name/phone..." autocomplete="off" />
                  <datalist id="sale-customer-list"></datalist>
                  <select id="sale-customer-select" class="hidden"></select>
                </div>
                <div id="quick-customer-fields" class="hidden md:col-span-2 grid gap-3 md:grid-cols-2">
                  <div>
                    <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">Customer Name</label>
                    <input id="quick-customer-name" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-success" placeholder="Full name" />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">Customer Phone</label>
                    <input id="quick-customer-phone" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-success" placeholder="0780000000" />
                  </div>
                </div>
                <div id="walkin-customer-fields" class="hidden md:col-span-2 grid gap-3 md:grid-cols-2">
                  <div>
                    <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">Walk-in Name (Optional)</label>
                    <input id="walkin-customer-name" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-success" placeholder="Customer name" />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">Walk-in Phone (Optional)</label>
                    <input id="walkin-customer-phone" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-success" placeholder="07xxxxxxxx" />
                  </div>
                  <p class="md:col-span-2 text-xs text-muted">No account or ledger customer will be attached when using walk-in mode.</p>
                </div>
                <div id="income-item-combobox" class="relative md:col-span-2">
                  <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">Inventory Item</label>
                  <input id="income-item-search" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-success" placeholder="Search inventory item by name, SKU, model, or type..." autocomplete="off" />
                  <div id="income-item-results" class="hidden absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-surface shadow-2xl"></div>
                  <select id="income-item-select" class="hidden"></select>
                </div>
                <button type="button" onclick="window.openAddToCartModal()" class="w-full rounded-md bg-success px-4 py-2 text-sm font-semibold text-white hover:bg-success/90 transition-colors md:col-span-2">Add To Cart</button>
                <div class="md:col-span-1">
                  <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">Sale Date (Optional)</label>
                  ${DateInput({ id: 'cart-sale-date', className: 'w-full rounded-lg px-3 py-2 border border-border bg-bg focus:border-success text-text' })}
                </div>
                <div class="md:col-span-1">
                  <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-muted">Sale Time (Optional)</label>
                  <input id="cart-sale-time" type="time" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-success" />
                </div>
              </div>
              <div class="overflow-x-auto rounded-lg border border-border bg-bg">
                <table class="w-full text-sm">
                  <thead class="bg-surface text-left text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th class="px-3 py-2 font-bold">Item</th>
                      <th class="px-3 py-2 font-bold">Category</th>
                      <th class="px-3 py-2 font-bold">Car Model</th>
                      <th class="px-3 py-2 font-bold">Qty</th>
                      <th class="px-3 py-2 font-bold">Unit Price</th>
                      <th class="px-3 py-2 font-bold">Line Total</th>
                      <th class="px-3 py-2 font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody id="cart-tbody">
                    <tr><td colspan="7" class="px-3 py-3 text-center text-muted">Cart is empty.</td></tr>
                  </tbody>
                </table>
              </div>
              <div class="mt-4 flex flex-wrap items-center justify-between gap-3 bg-success/10 p-3 rounded-lg border border-success/20">
                <p class="text-sm font-bold text-success">Cart Total: <span id="cart-total-display">0.00</span> JOD</p>
                <div class="flex items-center gap-2">
                  <button id="cart-clear-btn" type="button" onclick="window.clearCart()" class="rounded-md border border-border px-4 py-2 text-sm font-bold text-text hover:bg-bg transition-colors">Clear Cart</button>
                  <button id="cart-checkout-btn" type="button" disabled onclick="window.checkoutCart()" class="rounded-md bg-success px-6 py-2 text-sm font-bold text-white hover:bg-success/90 disabled:opacity-60 transition-colors shadow-sm">Confirm Cart Sale</button>
                </div>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-3 px-6 py-4 border-t border-border bg-bg/30">
            <button type="button" onclick="window.closeWalkinOverlay()" class="px-5 py-2 rounded-lg border border-border text-text hover:bg-bg transition-colors font-semibold text-sm">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Add to Cart Modal -->
      <div id="cart-modal" class="hidden fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl p-5 overflow-hidden">
          <h3 class="text-lg font-heading font-bold text-text mb-1">Item Details</h3>
          <p class="text-xs text-muted mb-4">Review details and edit default price before adding to cart.</p>
          <div class="grid gap-4 md:grid-cols-2 mb-5">
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Item Name</label>
              <input id="cart-modal-part-name" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text" readonly disabled />
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Vehicle Type</label>
              <input id="cart-modal-vehicle-type" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text" readonly disabled />
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Vehicle Model</label>
              <input id="cart-modal-vehicle-model" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text" readonly disabled />
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Current Stock</label>
              <input id="cart-modal-stock" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text" readonly disabled />
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Sale Quantity</label>
              <input id="cart-modal-qty" type="number" min="1" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-success" />
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Unit Price</label>
              <input id="cart-modal-price" type="number" step="0.01" min="0" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-success" />
            </div>
            <div class="md:col-span-2">
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Note (optional)</label>
              <textarea id="cart-modal-note" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-success resize-none" rows="2"></textarea>
            </div>
          </div>
          <div class="flex justify-end gap-3">
            <button type="button" onclick="window.closeAddToCartModal()" class="px-4 py-2 rounded-lg border border-border text-text hover:bg-bg transition-colors font-semibold text-sm">Cancel</button>
            <button type="button" onclick="window.confirmAddToCart()" class="px-5 py-2 rounded-lg bg-success text-white hover:bg-success/90 transition-colors font-bold text-sm shadow-sm">Confirm Add To Cart</button>
          </div>
        </div>
      </div>

      <!-- Expense Modal -->
      <div id="expense-overlay" class="hidden fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="w-full max-w-5xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
          <div class="flex items-center justify-between px-6 py-4 border-b border-border bg-bg/50">
            <div>
              <h3 class="text-xl font-heading font-bold text-text">Log Expense</h3>
              <p class="text-sm text-muted">Record business expenses into the ledger.</p>
            </div>
            <button type="button" onclick="window.closeExpenseOverlay()" class="text-muted hover:text-text">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div class="p-6 overflow-y-auto">
            <div id="expense-container" class="bg-danger/10 border border-danger/30 rounded-xl p-6">
              <h3 class="font-bold text-danger mb-4 flex items-center gap-2">- Record Business Expense</h3>
              <form id="expense-form" class="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div class="md:col-span-4">
                  <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Catalog Item</label>
                  <select id="expense-item-select" class="w-full bg-surface border border-danger/30 rounded-lg px-3 py-2 text-text outline-none"></select>
                </div>
                <div class="md:col-span-3">
                  <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Item Name</label>
                  <input type="text" name="itemName" required class="w-full bg-surface border border-danger/30 rounded-lg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-danger">
                </div>
                <div class="md:col-span-2">
                  <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Category</label>
                  <select name="expenseCategory" class="w-full bg-surface border border-danger/30 rounded-lg px-3 py-2 text-text outline-none">
                    <option value="Utilities">Utilities</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Tools">Tools</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Rent">Rent</option>
                    <option value="Salary">Salary</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Other" selected>Other</option>
                  </select>
                </div>
                <div class="md:col-span-3">
                  <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Supplier / Vendor</label>
                  <input type="text" name="supplierName" class="w-full bg-surface border border-danger/30 rounded-lg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-danger">
                </div>
                <div class="md:col-span-3">
                  <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Cost</label>
                  <input type="number" step="0.01" name="unitPrice" required class="w-full bg-surface border border-danger/30 rounded-lg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-danger">
                </div>
                <div class="md:col-span-2">
                  <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Qty</label>
                  <input type="number" name="quantity" value="1" min="1" required class="w-full bg-surface border border-danger/30 rounded-lg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-danger">
                </div>
                <div class="md:col-span-4">
                  <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Date Occurred</label>
                  ${DateInput({ name: 'occurredAt', className: 'bg-surface border-danger/30 focus:border-danger focus:ring-danger' })}
                </div>
                <div class="md:col-span-12">
                  <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Note</label>
                  <textarea name="note" rows="2" class="w-full bg-surface border border-danger/30 rounded-lg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-danger resize-none"></textarea>
                </div>
                <button type="submit" class="md:col-span-12 justify-self-end bg-danger text-white px-8 py-2.5 rounded-lg font-bold">Record Expense</button>
              </form>
            </div>
          </div>
          <div class="flex justify-end gap-3 px-6 py-4 border-t border-border bg-bg/30">
            <button type="button" onclick="window.closeExpenseOverlay()" class="px-5 py-2 rounded-lg border border-border text-text hover:bg-bg transition-colors font-semibold text-sm">Cancel</button>
          </div>
        </div>
      </div>

      <!-- Tx Table -->
        <div class="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0 mt-4 md:mt-2">
          <div class="p-4 border-b border-border bg-bg/50">
            <h3 class="text-sm font-bold text-text uppercase tracking-wider px-2">Transaction Ledger</h3>
            <div class="mt-4 rounded-xl border border-border bg-surface/40 p-3">
              <div class="flex items-center gap-2 overflow-x-auto pb-1">
                <input id="tx-search" type="text" class="min-w-[260px] flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-primary" placeholder="Search item, customer, note, or transaction source..." />
                <select id="tx-filter-type" class="min-w-[140px] bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-primary">
                  <option value="ALL">Type: All</option>
                  <option value="INCOME">Income</option>
                  <option value="EXPENSE">Expense</option>
                </select>
                <select id="tx-filter-selling-type" class="min-w-[190px] bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-primary">
                  <option value="ALL">Transaction Source: All</option>
                  <option value="WALK_IN">Walk-in</option>
                  <option value="BOOKING">Booking</option>
                  <option value="INVENTORY">Inventory</option>
                  <option value="EXPENSE">Expense</option>
                  <option value="GENERAL">General</option>
                </select>
                <div class="min-w-[190px] flex items-center gap-2">
                  <span class="shrink-0 text-xs font-semibold text-muted">From date</span>
                  <input id="tx-filter-from-date" type="date" class="w-full rounded-lg px-3 py-2 border border-border bg-bg text-text focus:border-primary outline-none" />
                </div>
                <div class="min-w-[190px] flex items-center gap-2">
                  <span class="shrink-0 text-xs font-semibold text-muted">To date</span>
                  <input id="tx-filter-to-date" type="date" class="w-full rounded-lg px-3 py-2 border border-border bg-bg text-text focus:border-primary outline-none" />
                </div>
                <select id="tx-filter-sort" class="min-w-[200px] bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-primary">
                  <option value="NEWEST">Sort: Newest first</option>
                  <option value="OLDEST">Oldest first</option>
                  <option value="AMOUNT_HIGH">Amount high to low</option>
                  <option value="AMOUNT_LOW">Amount low to high</option>
                </select>
                <button id="tx-clear-filters" type="button" class="shrink-0 border border-border rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:text-text hover:bg-bg transition-colors">Clear Filters</button>
              </div>
              <p id="tx-results-summary" class="mt-3 text-xs text-muted">Showing 0 transactions</p>
            </div>
          </div>
          <div class="overflow-x-auto overflow-y-auto flex-1 h-full block">
            <table class="w-full text-left min-w-[1000px]">
              <thead class="bg-bg border-b border-border sticky top-0 z-10 w-full">
                <tr>
                  <th class="px-5 py-4 text-xs font-bold text-muted uppercase tracking-wider">Date & Time</th>
                  <th class="px-5 py-4 text-xs font-bold text-muted uppercase tracking-wider">Type</th>
                  <th class="px-5 py-4 text-xs font-bold text-muted uppercase tracking-wider">Source</th>
                  <th class="px-5 py-4 text-xs font-bold text-muted uppercase tracking-wider">Item</th>
                  <th class="px-5 py-4 text-xs font-bold text-muted uppercase tracking-wider">Note</th>
                  <th class="px-5 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Qty</th>
                  <th class="px-5 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Unit Price</th>
                  <th class="px-5 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Total</th>
                  <th class="px-5 py-4 text-xs font-bold text-muted uppercase tracking-wider">Created By</th>
                  <th class="px-5 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody id="tx-tbody" class="divide-y divide-border">
              </tbody>
            </table>
          </div>
        </div>

      <!-- Transaction Details Modal -->
      <div id="tx-details-modal" class="hidden fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="w-full max-w-3xl bg-surface border border-border rounded-2xl shadow-2xl p-5 overflow-hidden flex flex-col max-h-[90vh]">
          <div class="flex justify-between items-center mb-4">
            <div>
              <h3 class="text-xl font-heading font-bold text-text">Selling Details</h3>
              <p class="text-sm text-muted">Breakdown of the cart checkout properties.</p>
            </div>
            <button type="button" onclick="window.closeTxDetailsModal()" class="text-muted hover:text-text">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          
          <div class="overflow-y-auto border border-border rounded-lg bg-bg flex-1 min-h-[150px]">
            <table class="w-full text-left">
              <thead class="bg-surface sticky top-0 z-10 border-b border-border">
                <tr>
                  <th class="px-3 py-2 text-xs font-bold text-muted uppercase tracking-wider">Item Name</th>
                  <th class="px-3 py-2 text-xs font-bold text-muted uppercase tracking-wider">Vehicle Model</th>
                  <th class="px-3 py-2 text-xs font-bold text-muted uppercase tracking-wider text-center">Qty</th>
                  <th class="px-3 py-2 text-xs font-bold text-muted uppercase tracking-wider text-right">Unit Price</th>
                  <th class="px-3 py-2 text-xs font-bold text-muted uppercase tracking-wider text-right">Total</th>
                </tr>
              </thead>
              <tbody id="tx-details-tbody">
              </tbody>
            </table>
          </div>
          
          <div class="flex justify-end mt-5">
             <button type="button" onclick="window.closeTxDetailsModal()" class="px-5 py-2.5 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors font-bold text-sm shadow-sm">Close</button>
          </div>
        </div>
      </div>

    </div>
        `;
}





