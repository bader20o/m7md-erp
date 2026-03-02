import { apiFetch } from '../../lib/api.js';
import { PERMISSIONS } from '../../lib/roles.js';
import { TableRowSkeleton } from '../../components/ui/Skeleton.js';
import { store } from '../../lib/store.js';
import { DateInput } from '../../components/ui/DateInput.js';

export function AdminAccounting() {

  window.onMount = async () => {

    const tbody = document.getElementById('tx-tbody');
    const expenseForm = document.getElementById('expense-form');
    const incomeItemSelect = document.getElementById('income-item-select');
    const incomeItemSearch = document.getElementById('income-item-search');
    const incomeItemResults = document.getElementById('income-item-results');
    const saleCustomerSelect = document.getElementById('sale-customer-select');
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
    let parts = [];
    let customers = [];
    let saleCart = [];
    let incomeItemLookup = new Map();
    let activeIncomeResultIndex = -1;
    const canEditSaleUnitPrice = store.isAdmin() || store.hasPermission(PERMISSIONS.ACCOUNTING);
    const escapeAttr = (value) =>
      String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');

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
                <span class="block truncate text-xs text-muted">${escapeAttr(`${item.sku || 'No SKU'}${item.vehicleModel ? ` • ${item.vehicleModel}` : ''}${item.vehicleType ? ` • ${item.vehicleType}` : ''}`)}</span>
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

    function renderCustomersSelect() {
      saleCustomerSelect.innerHTML = [
        '<option value=\"\">Select customer...</option>',
        ...customers.map((item) => `<option value=\"${item.id}\">${item.fullName || item.phone} (${item.phone})</option>`)
      ].join('');
    }

    function resetSaleCustomerFields() {
      saleCustomerSelect.value = '';
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
      formNode.expenseCategory.value = 'SUPPLIER';
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

      try {
        const [txRes, sumRes] = await Promise.all([
          apiFetch('/accounting/transactions'),
          apiFetch('/accounting/reports/summary')
        ]);

        if (txRes && txRes.items) {
          window.allTransactions = txRes.items;
          const sorted = txRes.items.sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));

          if (sorted.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center py-6 text-muted">No transactions found</td></tr>`;
          } else {
            tbody.innerHTML = sorted.map(t => {
              const sign = t.type === 'INCOME' ? '+' : '-';
              const color = t.type === 'INCOME' ? 'text-success' : 'text-danger';
              const date = new Date(t.occurredAt);

              let sellingType = t.incomeSource || t.expenseCategory || '-';
              let itemTitle = t.itemName;
              let hasDetails = false;

              if (t.incomeSource === 'INVOICE' || t.incomeSource === 'INVENTORY_SALE') {
                itemTitle = 'Inventory Cart Sale';
                sellingType = 'CART_CHECKOUT';
                if (t.invoice && t.invoice.invoiceLines) {
                  hasDetails = true;
                }
              }

              let note = t.note || t.description || '-';
              if (note.length > 30) note = note.substring(0, 30) + '...';

              return `
              <tr class="group border-b border-border bg-surface hover:bg-bg transition-colors">
                <td class="px-5 py-4 whitespace-nowrap text-xs font-mono text-muted">${date.toLocaleDateString()}<br>${date.toLocaleTimeString([], { timeStyle: 'short' })}</td>
                <td class="px-5 py-4 whitespace-nowrap"><span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${t.type === 'INCOME' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}">${t.type}</span></td>
                <td class="px-5 py-4 whitespace-nowrap text-xs font-semibold text-muted tracking-wider">${sellingType.replace('_', ' ')}</td>
                <td class="px-5 py-4 whitespace-nowrap text-sm font-bold text-text truncate max-w-[150px]">${itemTitle}</td>
                <td class="px-5 py-4 whitespace-nowrap text-xs text-muted truncate max-w-[150px]">${note}</td>
                <td class="px-5 py-4 whitespace-nowrap text-sm text-right font-bold text-text">${t.quantity} <span class="text-xs text-muted font-normal mx-1">x</span> ${t.unitPrice}</td>
                <td class="px-5 py-4 whitespace-nowrap text-right font-bold font-mono ${color}">${sign}${Number(t.amount).toFixed(2)} JOD</td>
                <td class="px-5 py-4 whitespace-nowrap text-right font-mono text-sm text-muted">${Number(t.runningBalance || 0).toFixed(2)} JOD</td>
                <td class="px-5 py-4 whitespace-nowrap text-right">
                  ${hasDetails ? `<button onclick="window.viewTransactionDetails('${t.id}')" class="text-xs font-bold text-primary border border-primary/30 px-3 py-1.5 rounded-md hover:bg-primary hover:text-white transition-colors">View Details</button>` : '<span class="text-xs text-muted">-</span>'}
                </td>
              </tr>
              `;
            }).join('');
          }
        }

        if (sumRes) {
          const inc = parseFloat(sumRes.walkInIncome || 0);
          const exp = parseFloat(sumRes.expenses || 0);
          const net = inc - exp;

          document.getElementById('total-income-val').innerHTML = `+${inc.toFixed(2)} JOD`;
          document.getElementById('total-expense-val').innerHTML = `-${exp.toFixed(2)} JOD`;
          document.getElementById('net-profit-val').innerHTML = `${net.toFixed(2)} JOD`;
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

      const dateStr = document.getElementById('cart-sale-date').value;
      if (dateStr) {
        payload.issueDate = new Date(dateStr).toISOString();
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
      if (submitBtn) submitBtn.disabled = true;
      try {
        await apiFetch('/accounting/expenses', {
          method: 'POST',
          headers: { 'Idempotency-Key': idempotencyKey },
          body: {
            itemName: expenseForm.itemName.value,
            unitPrice: parseFloat(expenseForm.unitPrice.value),
            quantity: parseInt(expenseForm.quantity.value, 10),
            note: expenseForm.note.value || undefined,
            expenseCategory: expenseForm.expenseCategory.value,
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
      <div id="report-summary" class="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
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
                  <select id="sale-customer-select" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-success"></select>
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
                <input id="cart-sale-date" type="datetime-local" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text outline-none focus:border-success md:col-span-2" placeholder="Sale date (optional)" />
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
                <button id="cart-checkout-btn" type="button" disabled onclick="window.checkoutCart()" class="rounded-md bg-success px-6 py-2 text-sm font-bold text-white hover:bg-success/90 disabled:opacity-60 transition-colors shadow-sm">Confirm Cart Sale</button>
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
              <form id="expense-form" class="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                <div class="md:col-span-2">
                  <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Catalog Item</label>
                  <select id="expense-item-select" class="w-full bg-surface border border-danger/30 rounded-lg px-3 py-2 text-text outline-none"></select>
                </div>
                <div>
                  <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Item Name</label>
                  <input type="text" name="itemName" required class="w-full bg-surface border border-danger/30 rounded-lg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-danger">
                </div>
                <div>
                  <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Category</label>
                  <select name="expenseCategory" class="w-full bg-surface border border-danger/30 rounded-lg px-3 py-2 text-text outline-none">
                    <option value="GENERAL">General Operational</option>
                    <option value="SUPPLIER">Supplier / Parts</option>
                    <option value="SALARY">Payroll / Salary</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Supplier / Vendor</label>
                  <input type="text" name="supplierName" class="w-full bg-surface border border-danger/30 rounded-lg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-danger">
                </div>
                <div>
                  <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Cost</label>
                  <input type="number" step="0.01" name="unitPrice" required class="w-full bg-surface border border-danger/30 rounded-lg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-danger">
                </div>
                <div>
                  <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Qty</label>
                  <input type="number" name="quantity" value="1" min="1" required class="w-full bg-surface border border-danger/30 rounded-lg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-danger">
                </div>
                <div>
                  <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Date Occurred</label>
                  ${DateInput({ name: 'occurredAt', className: 'bg-surface border-danger/30 focus:border-danger focus:ring-danger' })}
                </div>
                <div class="md:col-span-6">
                  <label class="block text-xs font-bold text-danger uppercase tracking-wider mb-1">Note</label>
                  <textarea name="note" rows="2" class="w-full bg-surface border border-danger/30 rounded-lg px-3 py-2 text-text outline-none focus:ring-1 focus:ring-danger resize-none"></textarea>
                </div>
                <button type="submit" class="md:col-span-6 justify-self-end bg-danger text-white px-8 py-2.5 rounded-lg font-bold">Charge</button>
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
          </div>
          <div class="overflow-x-auto overflow-y-auto flex-1 h-full block">
            <table class="w-full text-left min-w-[1000px]">
              <thead class="bg-bg border-b border-border sticky top-0 z-10 w-full">
                <tr>
                  <th class="px-5 py-4 text-xs font-bold text-muted uppercase tracking-wider">Date & Time</th>
                  <th class="px-5 py-4 text-xs font-bold text-muted uppercase tracking-wider">Type</th>
                  <th class="px-5 py-4 text-xs font-bold text-muted uppercase tracking-wider">Selling Type</th>
                  <th class="px-5 py-4 text-xs font-bold text-muted uppercase tracking-wider">Item</th>
                  <th class="px-5 py-4 text-xs font-bold text-muted uppercase tracking-wider">Note</th>
                  <th class="px-5 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Qty/Price</th>
                  <th class="px-5 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Amount</th>
                  <th class="px-5 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Balance</th>
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
