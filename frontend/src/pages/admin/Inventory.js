import { apiFetch, buildQuery } from '../../lib/api.js';
import { TableRowSkeleton } from '../../components/ui/Skeleton.js';

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function movementBadge(type) {
  if (type === 'IN') return 'bg-success/15 text-success';
  if (type === 'OUT') return 'bg-danger/15 text-danger';
  return 'bg-primary/15 text-primary';
}

export function AdminInventory() {
  window.onMount = async () => {
    const partRows = document.getElementById('inventory-parts-tbody');
    const alertsNode = document.getElementById('inventory-alerts');
    const detailsNode = document.getElementById('inventory-part-details');
    const searchInput = document.getElementById('inventory-search');
    const addPartToggle = document.getElementById('inventory-add-part-toggle');
    const addPartOverlay = document.getElementById('inventory-add-part-overlay');
    const addPartForm = document.getElementById('inventory-add-part-modal-form');
    const addPartClose = document.getElementById('inventory-add-part-close');
    const addPartCancel = document.getElementById('inventory-add-part-cancel');
    const movementOverlay = document.getElementById('inventory-movement-overlay');
    const movementForm = document.getElementById('inventory-movement-form');
    const movementTitle = document.getElementById('inventory-movement-title');
    const movementNoteLabel = document.getElementById('inventory-movement-note-label');
    const movementTypeInput = document.getElementById('inventory-movement-type');
    const movementQtyInput = document.getElementById('inventory-movement-qty');
    const movementNoteInput = document.getElementById('inventory-movement-note');

    const state = {
      parts: [],
      selectedPartId: null,
      movements: [],
      query: ''
    };

    function selectedPart() {
      return state.parts.find((item) => item.id === state.selectedPartId) || null;
    }

    function closeMovementModal() {
      movementOverlay.classList.add('hidden');
      movementForm.reset();
      movementQtyInput.value = '1';
      movementTypeInput.value = '';
    }

    function openAddPartModal() {
      addPartOverlay.classList.remove('hidden');
      const nameInput = addPartForm.querySelector('[name="name"]');
      if (nameInput) nameInput.focus();
    }

    function closeAddPartModal(reset = true) {
      addPartOverlay.classList.add('hidden');
      if (reset) addPartForm.reset();
    }

    function renderParts() {
      const items = state.parts;
      if (!items.length) {
        partRows.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-10">No parts found.</td></tr>';
        return;
      }

      partRows.innerHTML = items
        .map((part) => {
          const active = part.id === state.selectedPartId;
          return `
            <tr class="border-b border-border transition-colors cursor-pointer ${active ? 'bg-primary/5' : 'hover:bg-bg'}" onclick="window.openInventoryPart('${part.id}')">
              <td class="px-4 py-3">
                <div class="text-sm font-semibold text-text">${part.name}</div>
                <div class="text-xs text-muted">${part.vehicleModel || '-'} &bull; ${part.vehicleType || '-'} &bull; ${part.category || '-'} &bull; ${part.unit}</div>
              </td>
              <td class="px-4 py-3 text-sm text-center font-bold ${part.lowStock ? 'text-danger' : 'text-text'}">${part.stockQty}</td>
              <td class="px-4 py-3 text-sm text-center">${part.lowStockThreshold}</td>
              <td class="px-4 py-3 text-center">
                ${part.lowStock
              ? '<span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-danger/15 text-danger">Low</span>'
              : '<span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-success/15 text-success">OK</span>'
            }
              </td>
            </tr>
          `;
        })
        .join('');
    }

    function renderDetails() {
      const part = selectedPart();
      if (!part) {
        detailsNode.innerHTML = '<div class="text-sm text-muted py-8 text-center">Select a part to view details.</div>';
        return;
      }

      const movementRows = state.movements.length
        ? state.movements
          .map(
            (movement) => `
                <tr class="border-b border-border">
                  <td class="px-3 py-2 text-xs">${formatDateTime(movement.occurredAt)}</td>
                  <td class="px-3 py-2 text-xs text-center">
                    <span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase ${movementBadge(movement.type)}">${movement.type}</span>
                  </td>
                  <td class="px-3 py-2 text-xs text-center font-semibold">${movement.quantity}</td>
                  <td class="px-3 py-2 text-xs">${movement.note || '-'}</td>
                </tr>
              `
          )
          .join('')
        : '<tr><td colspan="4" class="px-3 py-6 text-center text-xs text-muted">No stock movements.</td></tr>';

      detailsNode.innerHTML = `
        <div class="space-y-4">
          <div class="rounded-xl border border-border p-4 bg-bg">
            <div class="text-xs uppercase text-muted">Part</div>
            <div class="text-xl font-bold text-text mt-1">${part.name}</div>
            <div class="text-xs text-muted mt-1">Car Model: ${part.vehicleModel || '-'} (${part.vehicleType || '-'})</div>
            <div class="text-xs text-muted mt-1">Category & Unit: ${part.category || '-'} &bull; ${part.unit}</div>
            <div class="text-xs text-muted mt-1">Pricing: ${part.costPrice ? part.costPrice + ' JOD Cost / ' : ''}${part.sellPrice || 0} JOD Default Price</div>
            <div class="text-sm mt-2">
              <span class="font-semibold text-text">Current stock:</span>
              <span class="${part.lowStock ? 'text-danger font-bold' : 'text-success font-bold'}">${part.stockQty}</span>
            </div>
            <div class="text-xs text-muted mt-1">Min stock: ${part.lowStockThreshold}</div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <button class="px-4 py-2 rounded-lg border border-success text-success font-semibold hover:bg-success hover:text-white transition-colors" onclick="window.openInventoryMovement('IN')">+ Add Stock</button>
            <button class="px-4 py-2 rounded-lg border border-danger text-danger font-semibold hover:bg-danger hover:text-white transition-colors" onclick="window.openInventoryMovement('OUT')">- Remove Stock</button>
          </div>

          <div class="rounded-xl border border-border overflow-hidden">
            <div class="px-4 py-3 border-b border-border bg-bg">
              <div class="text-sm font-bold text-text">Recent Movements</div>
            </div>
            <div class="overflow-auto max-h-72">
              <table class="w-full text-left">
                <thead class="bg-bg border-b border-border sticky top-0">
                  <tr>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted">Date</th>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted text-center">Type</th>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted text-center">Qty</th>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted">Note</th>
                  </tr>
                </thead>
                <tbody>${movementRows}</tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }

    async function loadAlerts() {
      try {
        const response = await apiFetch('/inventory/alerts');
        const alerts = response.items || [];
        if (!alerts.length) {
          alertsNode.innerHTML = '<div class="text-xs text-success">No low stock alerts.</div>';
          return;
        }

        alertsNode.innerHTML = alerts
          .map(
            (part) => `
              <div class="text-xs rounded-lg border border-danger/30 bg-danger/10 text-danger px-3 py-2">
                <span class="font-semibold">${part.name}</span>: ${part.stockQty} remaining (min ${part.lowStockThreshold})
              </div>
            `
          )
          .join('');
      } catch (error) {
        alertsNode.innerHTML = `<div class="text-xs text-danger">${error.message || 'Failed to load alerts.'}</div>`;
      }
    }

    async function loadMovements() {
      const part = selectedPart();
      if (!part) {
        state.movements = [];
        renderDetails();
        return;
      }

      try {
        const query = buildQuery({ partId: part.id, take: 40 });
        const response = await apiFetch(`/inventory/movements${query}`);
        state.movements = response.items || [];
      } catch (error) {
        window.toast(error.message || 'Failed to load stock movements.', 'error');
        state.movements = [];
      }
      renderDetails();
    }

    async function loadParts() {
      partRows.innerHTML = TableRowSkeleton(4).repeat(6);
      try {
        const query = buildQuery({ q: state.query || undefined });
        const response = await apiFetch(`/inventory/parts${query}`);
        state.parts = response.items || [];

        if (!state.parts.length) {
          state.selectedPartId = null;
        } else if (!state.selectedPartId || !state.parts.some((part) => part.id === state.selectedPartId)) {
          state.selectedPartId = state.parts[0].id;
        }

        renderParts();
        await loadMovements();
        await loadAlerts();
      } catch (error) {
        partRows.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-10">${error.message || 'Failed to load parts.'}</td></tr>`;
      }
    }

    window.openInventoryPart = async (id) => {
      state.selectedPartId = id;
      renderParts();
      await loadMovements();
    };

    window.openInventoryMovement = (type) => {
      const part = selectedPart();
      if (!part) return;

      movementTypeInput.value = type;
      movementQtyInput.value = '1';
      movementNoteInput.value = '';
      if (type === 'IN') {
        movementTitle.textContent = `Add Stock - ${part.name}`;
        movementNoteLabel.textContent = 'Source note (required)';
        movementNoteInput.placeholder = 'From where did this addition come?';
      } else {
        movementTitle.textContent = `Remove Stock - ${part.name}`;
        movementNoteLabel.textContent = 'Destination note (required)';
        movementNoteInput.placeholder = 'Where did this reduction go?';
      }
      movementOverlay.classList.remove('hidden');
      movementNoteInput.focus();
    };

    searchInput.addEventListener('input', (event) => {
      state.query = event.target.value.trim();
      loadParts();
    });

    addPartToggle.addEventListener('click', openAddPartModal);

    addPartForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.target;
      const name = (form.name.value || '').trim();
      const vehicleModel = (form.vehicleModel.value || '').trim();
      const vehicleType = (form.vehicleType.value || '').trim();
      const sellPriceRaw = form.sellPrice.value;
      const minStockRaw = form.minStock.value;
      const costPriceRaw = form.costPrice.value;
      const sellPrice = Number(sellPriceRaw);
      const minStock = Number(minStockRaw);

      if (!name) {
        window.toast('Item is required.', 'error');
        return;
      }
      if (!vehicleModel) {
        window.toast('Car name is required.', 'error');
        return;
      }
      if (!['EV', 'HYBRID', 'REGULAR'].includes(vehicleType)) {
        window.toast('Car type is invalid.', 'error');
        return;
      }
      if (sellPriceRaw === '' || Number.isNaN(sellPrice) || sellPrice < 0) {
        window.toast('Price must be 0 or greater.', 'error');
        return;
      }
      if (minStockRaw === '' || Number.isNaN(minStock) || minStock < 0 || !Number.isInteger(minStock)) {
        window.toast('Minimum quantity must be a whole number 0 or greater.', 'error');
        return;
      }
      if (costPriceRaw !== '' && (Number.isNaN(Number(costPriceRaw)) || Number(costPriceRaw) < 0)) {
        window.toast('Cost must be 0 or greater.', 'error');
        return;
      }

      try {
        await apiFetch('/inventory/parts', {
          method: 'POST',
          body: {
            name,
            vehicleModel,
            vehicleType,
            unit: 'piece',
            costPrice: costPriceRaw !== '' ? Number(costPriceRaw) : undefined,
            sellPrice,
            stockQty: 0,
            lowStockThreshold: minStock
          }
        });
        window.toast('Part created.', 'success');
        closeAddPartModal(true);
        await loadParts();
      } catch (error) {
        window.toast(error.message || 'Failed to create part.', 'error');
      }
    });

    movementForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const type = movementTypeInput.value;
      const note = movementNoteInput.value.trim();
      const part = selectedPart();

      if (!part) return;
      if (!note) {
        window.toast('Note is required for stock movement.', 'error');
        return;
      }

      try {
        await apiFetch('/inventory/movements', {
          method: 'POST',
          body: {
            partId: part.id,
            type,
            quantity: Number(movementQtyInput.value),
            note,
            occurredAt: new Date().toISOString()
          }
        });
        window.toast(type === 'IN' ? 'Stock added.' : 'Stock removed.', 'success');
        closeMovementModal();
        await loadParts();
      } catch (error) {
        window.toast(error.message || 'Failed to update stock.', 'error');
      }
    });

    document.getElementById('inventory-movement-cancel').addEventListener('click', closeMovementModal);
    document.getElementById('inventory-movement-close').addEventListener('click', closeMovementModal);
    addPartClose.addEventListener('click', () => closeAddPartModal(true));
    addPartCancel.addEventListener('click', () => closeAddPartModal(true));
    movementOverlay.addEventListener('click', (event) => {
      if (event.target === movementOverlay) {
        closeMovementModal();
      }
    });
    addPartOverlay.addEventListener('click', (event) => {
      if (event.target === addPartOverlay) {
        closeAddPartModal(true);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!addPartOverlay.classList.contains('hidden')) {
        closeAddPartModal(true);
      }
      if (!movementOverlay.classList.contains('hidden')) {
        closeMovementModal();
      }
    });

    await loadParts();

    if (window.location.hash === '#add-part') {
      openAddPartModal();
    }
  };

  return `
    <div class="w-full h-full flex flex-col gap-6">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-surface border border-border p-4 rounded-xl">
        <div>
          <h1 class="text-2xl font-heading font-bold text-text">Inventory</h1>
          <p class="text-sm text-muted">Track parts stock and movement notes.</p>
        </div>
        <button id="inventory-add-part-toggle" class="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary-hover">Add Part</button>
      </div>

      <div class="bg-surface border border-border rounded-xl p-4">
        <div class="text-xs uppercase text-muted mb-2">Low Stock Alerts</div>
        <div id="inventory-alerts" class="flex flex-wrap gap-2"></div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div class="bg-surface border border-border rounded-xl overflow-hidden">
          <div class="p-3 border-b border-border bg-bg">
            <input id="inventory-search" placeholder="Search parts..." class="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm">
          </div>
          <div class="overflow-auto max-h-[560px]">
            <table class="w-full text-left min-w-[540px]">
              <thead class="bg-bg border-b border-border sticky top-0">
                <tr>
                  <th class="px-4 py-3 text-xs uppercase text-muted">Part</th>
                  <th class="px-4 py-3 text-xs uppercase text-muted text-center">Stock</th>
                  <th class="px-4 py-3 text-xs uppercase text-muted text-center">Min</th>
                  <th class="px-4 py-3 text-xs uppercase text-muted text-center">Status</th>
                </tr>
              </thead>
              <tbody id="inventory-parts-tbody"></tbody>
            </table>
          </div>
        </div>

        <div id="inventory-part-details" class="bg-surface border border-border rounded-xl p-4"></div>
      </div>

      <div id="inventory-movement-overlay" class="hidden fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 id="inventory-movement-title" class="text-lg font-heading font-bold text-text">Stock Movement</h3>
            <button id="inventory-movement-close" type="button" class="w-8 h-8 rounded-full border border-border text-muted hover:text-text hover:border-text">&times;</button>
          </div>
          <form id="inventory-movement-form" class="p-5 space-y-4">
            <input id="inventory-movement-type" type="hidden">
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Quantity</label>
              <input id="inventory-movement-qty" type="number" min="1" required value="1" class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
            </div>
            <div>
              <label id="inventory-movement-note-label" class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Note</label>
              <textarea id="inventory-movement-note" rows="3" required class="w-full px-3 py-2 rounded-lg border border-border bg-bg resize-none" placeholder="Required note"></textarea>
            </div>
            <div class="flex justify-end gap-3">
              <button id="inventory-movement-cancel" type="button" class="px-4 py-2 rounded-lg border border-border text-text hover:border-text">Cancel</button>
              <button type="submit" class="px-5 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary-hover">Confirm</button>
            </div>
          </form>
        </div>
      </div>

      <div id="inventory-add-part-overlay" class="hidden fixed inset-0 z-[75] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="w-full max-w-4xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 class="text-lg font-heading font-bold text-text">Add Inventory Item</h3>
            <button id="inventory-add-part-close" type="button" class="w-8 h-8 rounded-full border border-border text-muted hover:text-text hover:border-text">&times;</button>
          </div>
          <form id="inventory-add-part-modal-form" class="p-5 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Item</label>
                <input name="name" required placeholder="Item name" class="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text">
              </div>
              <div>
                <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Cost</label>
                <input name="costPrice" type="number" step="0.01" min="0" placeholder="0.00" class="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text">
              </div>
              <div>
                <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Price</label>
                <input name="sellPrice" type="number" step="0.01" min="0" required placeholder="0.00" class="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text">
              </div>
              <div>
                <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Minimum Quantity</label>
                <input name="minStock" type="number" min="0" required placeholder="0" class="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text">
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Car Type</label>
                <select name="vehicleType" required class="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text">
                  <option value="EV">EV</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="REGULAR">Regular Fuel</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Car Name</label>
                <input name="vehicleModel" required placeholder="Toyota Camry 2011" class="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text">
              </div>
            </div>

            <div class="flex justify-end gap-3 pt-1">
              <button id="inventory-add-part-cancel" type="button" class="px-4 py-2 rounded-lg border border-border text-text hover:border-text">Cancel</button>
              <button type="submit" class="px-5 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary-hover">Save Part</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}
