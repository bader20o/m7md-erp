import { apiFetch, buildQuery } from '../../lib/api.js';
import { TableRowSkeleton } from '../../components/ui/Skeleton.js';

const FILTER_STORAGE_KEY = 'admin.inventory.filters.v1';
const RECENTLY_MOVED_WINDOW_DAYS = 14;

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function sanitizeUiText(value) {
  if (!value) return '';
  return String(value)
    .replace(/\[seed-full-test-data\]/gi, '')
    .replace(/seed\s*service/gi, '')
    .replace(/\bseed\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function movementBadge(type) {
  if (type === 'IN') return 'bg-success/15 text-success';
  if (type === 'OUT') return 'bg-danger/15 text-danger';
  if (type === 'SALE') return 'bg-primary/15 text-primary';
  return 'bg-amber-500/15 text-amber-500';
}

function movementTypeLabel(type) {
  if (type === 'ADJUST') return 'ADJUSTMENT';
  return type || '-';
}

function normalizeCarType(value) {
  const key = String(value || '').toUpperCase();
  if (key === 'EV') return 'EV';
  if (key === 'HYBRID') return 'HYBRID';
  if (key === 'REGULAR' || key === 'FUEL' || key === 'GAS' || key === 'DIESEL' || key === 'PETROL') return 'FUEL';
  return 'UNIVERSAL';
}

function normalizeCategory(value) {
  const input = String(value || '').trim();
  if (!input) return 'OTHER';
  const key = input.toLowerCase();
  if (key.includes('climate') || key.includes('ac') || key.includes('a/c')) return 'CLIMATE';
  if (key.includes('brake')) return 'BRAKES';
  if (key.includes('fluid') || key.includes('oil') || key.includes('coolant')) return 'FLUIDS';
  if (key.includes('battery')) return 'BATTERY';
  if (key.includes('chemical') || key.includes('clean')) return 'CHEMICALS';
  return 'OTHER';
}

function partStatus(part) {
  if (Number(part.stockQty) <= 0) return 'OUT_OF_STOCK';
  if (Number(part.lowStock)) return 'LOW_STOCK';
  return 'OK';
}

function statusLabel(status) {
  if (status === 'OUT_OF_STOCK') return 'Out of Stock';
  if (status === 'LOW_STOCK') return 'Low Stock';
  return 'OK';
}

function parseDateStart(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function parseDateEnd(value) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function toYmd(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseYmd(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatYmdLabel(value) {
  const parsed = parseYmd(value);
  if (!parsed) return '';
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function buildCalendarCells(year, month) {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const firstCell = new Date(year, month, 1 - startWeekday);
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + i);
    cells.push({
      ymd: toYmd(date),
      day: date.getDate(),
      outside: date.getMonth() !== month
    });
  }
  return cells;
}

function movementCostCell(movement) {
  if (movement.unitCost == null && movement.totalCost == null) return '-';
  return `${Number(movement.unitCost || 0).toFixed(3)} / ${Number(movement.totalCost || 0).toFixed(2)} JOD`;
}

function recentlyMovedPartIds(movements) {
  const cutoff = Date.now() - RECENTLY_MOVED_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return new Set(
    movements
      .filter((movement) => {
        const time = new Date(movement.occurredAt).getTime();
        return !Number.isNaN(time) && time >= cutoff;
      })
      .map((movement) => movement.partId)
  );
}

function notesByPartId(movements) {
  const map = new Map();
  movements.forEach((movement) => {
    const note = sanitizeUiText(movement.note);
    if (!note) return;
    const list = map.get(movement.partId) || [];
    if (list.length < 10) list.push(note.toLowerCase());
    map.set(movement.partId, list);
  });
  return map;
}

function partMatchesQuery(part, query, partNotesText) {
  const status = statusLabel(partStatus(part));
  const haystack = [
    part.name,
    part.vehicleModel,
    normalizeCarType(part.vehicleType),
    part.category,
    part.unit,
    status,
    partNotesText
  ]
    .map((value) => sanitizeUiText(value).toLowerCase())
    .join(' ');
  return haystack.includes(query);
}

function buildPartDetails(part) {
  const model = sanitizeUiText(part.vehicleModel);
  const type = normalizeCarType(part.vehicleType);
  const raw = [model || 'Universal', type === 'UNIVERSAL' ? 'Universal' : type];
  const seen = new Set();
  const details = [];
  raw.forEach((value) => {
    const cleaned = sanitizeUiText(value);
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    details.push(cleaned);
  });
  return details;
}

function sortParts(parts, sortValue) {
  const cloned = [...parts];
  if (sortValue === 'STOCK_ASC') {
    return cloned.sort((a, b) => Number(a.stockQty) - Number(b.stockQty));
  }
  if (sortValue === 'STOCK_DESC') {
    return cloned.sort((a, b) => Number(b.stockQty) - Number(a.stockQty));
  }
  if (sortValue === 'UPDATED_DESC') {
    return cloned.sort((a, b) => {
      const at = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bt = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bt - at;
    });
  }
  return cloned.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function sanitizeMovementNote(movement) {
  const clean = sanitizeUiText(movement.note);
  return clean || '-';
}

function getMovementFilterType(type) {
  if (type === 'ADJUSTMENT') return 'ADJUST';
  return type;
}

export function AdminInventory() {
  window.onMount = async () => {
    const partRows = document.getElementById('inventory-parts-tbody');
    const alertsNode = document.getElementById('inventory-alerts');
    const alertsCountNode = document.getElementById('inventory-alerts-count');
    const detailsNode = document.getElementById('inventory-part-details');
    const searchInput = document.getElementById('inventory-search');
    const statusFilter = document.getElementById('inventory-filter-status');
    const carTypeFilter = document.getElementById('inventory-filter-car-type');
    const categoryFilter = document.getElementById('inventory-filter-category');
    const sortFilter = document.getElementById('inventory-filter-sort');
    const clearFiltersButton = document.getElementById('inventory-clear-filters');
    const resultsSummaryNode = document.getElementById('inventory-results-summary');
    const quickFilters = Array.from(document.querySelectorAll('[data-inventory-quick]'));
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
    const movementPricingModeInput = document.getElementById('inventory-movement-pricing-mode');
    const movementUnitCostWrap = document.getElementById('inventory-movement-unit-wrap');
    const movementTotalCostWrap = document.getElementById('inventory-movement-total-wrap');
    const movementUnitCostInput = document.getElementById('inventory-movement-unit-cost');
    const movementTotalCostInput = document.getElementById('inventory-movement-total-cost');
    const movementComputedText = document.getElementById('inventory-movement-computed');
    const movementNoteInput = document.getElementById('inventory-movement-note');

    const state = {
      allParts: [],
      parts: [],
      selectedPartId: null,
      movements: [],
      recentMovements: [],
      query: '',
      filterStatus: 'ALL',
      filterCarType: 'ALL',
      filterCategory: 'ALL',
      filterSort: 'NAME_ASC',
      filterRecentlyMoved: false,
      movementTypeFilter: 'ALL',
      movementDateFrom: '',
      movementDateTo: '',
      highlightedPartId: null,
      openRowMenuPartId: null,
      editingPartId: null,
      datePickerOpen: null,
      datePickerFromView: '',
      datePickerToView: ''
    };

    function selectedPart() {
      return state.parts.find((item) => item.id === state.selectedPartId) || null;
    }

    function closeMovementModal() {
      movementOverlay.classList.add('hidden');
      movementForm.reset();
      movementQtyInput.value = '1';
      movementTypeInput.value = '';
      movementPricingModeInput.value = 'UNIT';
      movementUnitCostWrap.classList.remove('hidden');
      movementTotalCostWrap.classList.add('hidden');
      movementComputedText.textContent = 'Computed Total: -';
    }

    function round(value, decimals) {
      const factor = 10 ** decimals;
      return Math.round((value + Number.EPSILON) * factor) / factor;
    }

    function latestUnitCostForPart(partId, fallback) {
      const movement = state.movements.find((item) => item.partId === partId && Number(item.unitCost) > 0);
      if (movement) return Number(movement.unitCost).toFixed(3);
      if (Number(fallback) > 0) return Number(fallback).toFixed(3);
      return '';
    }

    function updatePricingModeUI() {
      const quantity = Number(movementQtyInput.value || 0);
      const mode = movementPricingModeInput.value;
      const unitCost = Number(movementUnitCostInput.value || 0);
      const totalCost = Number(movementTotalCostInput.value || 0);

      movementUnitCostWrap.classList.toggle('hidden', mode !== 'UNIT');
      movementTotalCostWrap.classList.toggle('hidden', mode !== 'TOTAL');

      if (!quantity || quantity <= 0) {
        movementComputedText.textContent = mode === 'UNIT' ? 'Computed Total: -' : 'Computed Unit: -';
        return;
      }

      if (mode === 'UNIT') {
        const computedTotal = unitCost > 0 ? round(round(unitCost, 3) * quantity, 2).toFixed(2) : '-';
        movementComputedText.textContent = `Computed Total: ${computedTotal === '-' ? '-' : `${computedTotal} JOD`}`;
        return;
      }

      const computedUnit = totalCost > 0 ? round(round(totalCost, 2) / quantity, 3).toFixed(3) : '-';
      movementComputedText.textContent = `Computed Unit: ${computedUnit === '-' ? '-' : `${computedUnit} JOD`}`;
    }

    function openAddPartModal() {
      addPartOverlay.classList.remove('hidden');
      const nameInput = addPartForm.querySelector('[name="name"]');
      if (nameInput) nameInput.focus();
    }

    function closeAddPartModal(reset = true) {
      addPartOverlay.classList.add('hidden');
      if (reset) addPartForm.reset();
      state.editingPartId = null;
      const modalTitle = document.getElementById('inventory-add-part-title');
      const submitText = document.getElementById('inventory-add-part-submit-text');
      if (modalTitle) modalTitle.textContent = 'Add Inventory Item';
      if (submitText) submitText.textContent = 'Save Part';
    }

    function loadSavedFilters() {
      try {
        const raw = localStorage.getItem(FILTER_STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        state.query = typeof saved.query === 'string' ? saved.query : '';
        state.filterStatus = saved.filterStatus || 'ALL';
        state.filterCarType = saved.filterCarType || 'ALL';
        state.filterCategory = saved.filterCategory || 'ALL';
        state.filterSort = saved.filterSort || 'NAME_ASC';
        state.filterRecentlyMoved = Boolean(saved.filterRecentlyMoved);
      } catch {
        localStorage.removeItem(FILTER_STORAGE_KEY);
      }
    }

    function persistFilters() {
      localStorage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify({
          query: state.query,
          filterStatus: state.filterStatus,
          filterCarType: state.filterCarType,
          filterCategory: state.filterCategory,
          filterSort: state.filterSort,
          filterRecentlyMoved: state.filterRecentlyMoved
        })
      );
    }

    function syncFilterInputs() {
      searchInput.value = state.query;
      statusFilter.value = state.filterStatus;
      carTypeFilter.value = state.filterCarType;
      categoryFilter.value = state.filterCategory;
      sortFilter.value = state.filterSort;
    }

    function renderQuickFilters() {
      quickFilters.forEach((button) => {
        const key = button.dataset.inventoryQuick;
        const active =
          (key === 'low-stock' && state.filterStatus === 'LOW_STOCK') ||
          (key === 'out-of-stock' && state.filterStatus === 'OUT_OF_STOCK') ||
          (key === 'ev-only' && state.filterCarType === 'EV') ||
          (key === 'universal' && state.filterCarType === 'UNIVERSAL') ||
          (key === 'recently-moved' && state.filterRecentlyMoved);

        button.className = active
          ? 'px-3 py-1.5 rounded-full border border-primary/40 bg-primary/15 text-primary text-xs font-semibold transition-colors'
          : 'px-3 py-1.5 rounded-full border border-border text-muted text-xs font-semibold hover:border-primary/40 hover:text-text transition-colors';
      });
    }

    function applyPartFilters() {
      const query = state.query.trim().toLowerCase();
      const notesMap = notesByPartId(state.recentMovements);
      const movedIds = recentlyMovedPartIds(state.recentMovements);

      const filtered = state.allParts.filter((part) => {
        const status = partStatus(part);
        const carType = normalizeCarType(part.vehicleType);
        const category = normalizeCategory(part.category);
        if (state.filterStatus !== 'ALL' && status !== state.filterStatus) return false;
        if (state.filterCarType !== 'ALL' && carType !== state.filterCarType) return false;
        if (state.filterCategory !== 'ALL' && category !== state.filterCategory) return false;
        if (state.filterRecentlyMoved && !movedIds.has(part.id)) return false;

        if (!query) return true;
        const noteText = (notesMap.get(part.id) || []).join(' ');
        return partMatchesQuery(part, query, noteText);
      });

      state.parts = sortParts(filtered, state.filterSort);
      const lowStockCount = state.parts.filter((part) => partStatus(part) === 'LOW_STOCK').length;
      const outOfStockCount = state.parts.filter((part) => partStatus(part) === 'OUT_OF_STOCK').length;
      resultsSummaryNode.innerHTML = `
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>${state.parts.length} parts</span>
          <span>${lowStockCount} low stock</span>
          <span>${outOfStockCount} out of stock</span>
        </div>
      `;
      renderQuickFilters();
    }

    function clearFilters() {
      state.query = '';
      state.filterStatus = 'ALL';
      state.filterCarType = 'ALL';
      state.filterCategory = 'ALL';
      state.filterSort = 'NAME_ASC';
      state.filterRecentlyMoved = false;
      syncFilterInputs();
      applyPartFilters();
      persistFilters();
      renderParts();
      loadAlerts();
      loadMovements();
    }

    async function focusPartRow(partId, shouldHighlight = false) {
      if (!partId) return;
      state.selectedPartId = partId;
      state.openRowMenuPartId = null;
      state.datePickerOpen = null;
      if (shouldHighlight) {
        state.highlightedPartId = partId;
      }
      renderParts();
      await loadMovements();

      const row = document.getElementById(`inventory-row-${partId}`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      if (shouldHighlight) {
        setTimeout(() => {
          if (state.highlightedPartId === partId) {
            state.highlightedPartId = null;
            renderParts();
          }
        }, 1200);
      }
    }

    function openEditPartModal(partId) {
      const part = state.allParts.find((item) => item.id === partId);
      if (!part) return;
      state.editingPartId = partId;
      addPartForm.name.value = part.name || '';
      addPartForm.costPrice.value = part.costPrice ?? '';
      addPartForm.sellPrice.value = part.sellPrice ?? 0;
      addPartForm.minStock.value = part.lowStockThreshold ?? 0;
      addPartForm.vehicleType.value = part.vehicleType || 'EV';
      addPartForm.vehicleModel.value = part.vehicleModel || '';
      const modalTitle = document.getElementById('inventory-add-part-title');
      const submitText = document.getElementById('inventory-add-part-submit-text');
      if (modalTitle) modalTitle.textContent = 'Edit Inventory Item';
      if (submitText) submitText.textContent = 'Update Part';
      openAddPartModal();
    }

    function renderParts() {
      const items = state.parts;
      if (!items.length) {
        partRows.innerHTML = `
          <tr>
            <td colspan="7" class="text-center py-10">
              <div class="text-sm font-semibold text-text">No parts found</div>
              <div class="text-xs text-muted mt-1">Try adjusting filters</div>
              <button id="inventory-clear-filters-inline" class="mt-3 px-3 py-1.5 rounded-lg border border-border text-xs text-text hover:border-primary">Clear Filters</button>
            </td>
          </tr>
        `;
        document.getElementById('inventory-clear-filters-inline')?.addEventListener('click', clearFilters);
        return;
      }

      partRows.innerHTML = items
        .map((part) => {
          const active = part.id === state.selectedPartId;
          const highlighted = part.id === state.highlightedPartId;
          const status = partStatus(part);
          const statusClass =
            status === 'OUT_OF_STOCK'
              ? 'bg-danger/15 text-danger'
              : status === 'LOW_STOCK'
                ? 'bg-amber-500/15 text-amber-500'
                : 'bg-success/15 text-success';
          const detailTags = buildPartDetails(part);
          const isMenuOpen = state.openRowMenuPartId === part.id;
          return `
            <tr id="inventory-row-${part.id}" class="group border-b border-border transition-colors cursor-pointer ${active ? 'bg-primary/5' : 'hover:bg-bg/80'} ${highlighted ? 'bg-danger/10' : ''}" onclick="window.openInventoryPart('${part.id}')">
              <td class="px-3 py-2.5 align-top">
                <div class="text-sm font-semibold text-text">${esc(sanitizeUiText(part.name) || '-')}</div>
              </td>
              <td class="px-3 py-2.5 align-top text-center">
                ${detailTags.length
                  ? `<div class="flex flex-wrap justify-center gap-1">${detailTags
                    .map(
                      (detail) =>
                        `<span class="px-1.5 py-0.5 rounded-md border border-border bg-bg text-[10px] font-semibold text-muted">${esc(detail)}</span>`
                    )
                    .join('')}</div>`
                  : '<span class="text-xs text-muted">—</span>'}
              </td>
              <td class="px-3 py-2.5 align-top text-xs text-muted">${esc(sanitizeUiText(part.category) || 'Other')}</td>
              <td class="px-3 py-2.5 text-sm text-center font-bold ${status === 'OK' ? 'text-text' : 'text-danger'}">${part.stockQty} ${esc(part.unit || '')}</td>
              <td class="px-3 py-2.5 text-center">
                <span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase ${statusClass}">${statusLabel(status)}</span>
              </td>
              <td class="px-3 py-2.5 text-xs text-right text-muted">${formatDateTime(part.updatedAt || part.createdAt)}</td>
              <td class="px-3 py-2.5 text-right relative">
                <button type="button" class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-bg/40 text-muted/90 opacity-70 group-hover:opacity-100 hover:text-text hover:border-primary transition-all" onclick="window.toggleInventoryRowMenu(event, '${part.id}')">
                  <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                    <circle cx="5" cy="12" r="1.7"></circle>
                    <circle cx="12" cy="12" r="1.7"></circle>
                    <circle cx="19" cy="12" r="1.7"></circle>
                  </svg>
                </button>
                <div class="${isMenuOpen ? '' : 'hidden'} absolute right-3 top-10 z-20 w-40 rounded-lg border border-border bg-surface shadow-xl">
                  <button type="button" class="w-full px-3 py-2 text-left text-xs text-text hover:bg-bg" onclick="window.inventoryRowAction(event, '${part.id}', 'ADD_STOCK')">Add Stock</button>
                  <button type="button" class="w-full px-3 py-2 text-left text-xs text-text hover:bg-bg" onclick="window.inventoryRowAction(event, '${part.id}', 'REMOVE_STOCK')">Remove Stock</button>
                  <button type="button" class="w-full px-3 py-2 text-left text-xs text-text hover:bg-bg" onclick="window.inventoryRowAction(event, '${part.id}', 'EDIT_PART')">Edit Part</button>
                  <button type="button" class="w-full px-3 py-2 text-left text-xs text-text hover:bg-bg" onclick="window.inventoryRowAction(event, '${part.id}', 'VIEW_MOVEMENTS')">View Movements</button>
                </div>
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

      const movementRowsData = state.movements.filter((movement) => {
        if (state.movementTypeFilter !== 'ALL' && movement.type !== getMovementFilterType(state.movementTypeFilter)) {
          return false;
        }
        const timestamp = new Date(movement.occurredAt).getTime();
        const from = parseDateStart(state.movementDateFrom);
        const to = parseDateEnd(state.movementDateTo);
        if (from != null && (Number.isNaN(timestamp) || timestamp < from)) return false;
        if (to != null && (Number.isNaN(timestamp) || timestamp > to)) return false;
        return true;
      });

      const movementRows = movementRowsData.length
        ? movementRowsData
          .map(
            (movement) => `
                <tr class="border-b border-border hover:bg-bg/60">
                  <td class="px-3 py-2 text-xs">${formatDateTime(movement.occurredAt)}</td>
                  <td class="px-3 py-2 text-xs text-center">
                    <span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase ${movementBadge(movement.type)}">${movementTypeLabel(movement.type)}</span>
                  </td>
                  <td class="px-3 py-2 text-xs text-center font-semibold">${movement.quantity}</td>
                  <td class="px-3 py-2 text-xs text-center">${movementCostCell(movement)}</td>
                  <td class="px-3 py-2 text-xs">${esc(sanitizeMovementNote(movement))}</td>
                </tr>
              `
          )
          .join('')
        : '<tr><td colspan="5" class="px-3 py-6 text-center text-xs text-muted">No stock movements.</td></tr>';

      const qty = Number(part.stockQty || 0);
      const minQty = Number(part.lowStockThreshold || 0);
      const nearMinCutoff = minQty > 0 ? Math.ceil(minQty * 1.35) : 0;
      const stockToneClass = qty < minQty ? 'bg-danger/75' : qty <= nearMinCutoff ? 'bg-amber-500/75' : 'bg-success/75';
      const stockTextClass = qty < minQty ? 'text-danger' : qty <= nearMinCutoff ? 'text-amber-500' : 'text-success';
      const stockBarWidth = Math.max(
        6,
        Math.min(
          100,
          Math.round(((qty <= 0 ? 0 : qty) / (minQty > 0 ? minQty * 2 : Math.max(1, qty))) * 100)
        )
      );

      const todayYmd = toYmd(new Date());
      const weekLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      const getViewKey = (kind) => {
        const key = kind === 'from' ? 'datePickerFromView' : 'datePickerToView';
        if (state[key]) return state[key];
        const selected = kind === 'from' ? state.movementDateFrom : state.movementDateTo;
        const base = parseYmd(selected) || new Date();
        state[key] = `${base.getFullYear()}-${pad2(base.getMonth() + 1)}`;
        return state[key];
      };
      const renderDatePicker = (kind) => {
        const selected = kind === 'from' ? state.movementDateFrom : state.movementDateTo;
        const viewKey = getViewKey(kind);
        const [yearStr, monthStr] = viewKey.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr) - 1;
        const cells = buildCalendarCells(year, month);
        const isOpen = state.datePickerOpen === kind;
        return `
          <div class="relative z-30">
            <button type="button" id="inventory-movement-date-${kind}-trigger" class="w-full px-2.5 py-2 rounded-lg border border-border bg-surface text-xs text-left text-${selected ? 'text-text' : 'muted'} hover:border-primary">
              ${selected ? formatYmdLabel(selected) : kind === 'from' ? 'From date' : 'To date'}
            </button>
            <div class="${isOpen ? '' : 'hidden'} absolute left-0 top-full mt-2 z-50 w-[260px] rounded-xl border border-border bg-surface shadow-[0_22px_55px_-28px_rgba(2,6,23,0.8)] p-2">
              <div class="mb-2 flex items-center justify-between">
                <button type="button" data-picker-nav="${kind}:prev" class="h-7 w-7 rounded-md border border-border text-muted hover:text-text hover:border-primary">&#x2039;</button>
                <div class="text-xs font-semibold text-text">${monthLabel(year, month)}</div>
                <button type="button" data-picker-nav="${kind}:next" class="h-7 w-7 rounded-md border border-border text-muted hover:text-text hover:border-primary">&#x203A;</button>
              </div>
              <div class="grid grid-cols-7 gap-1 text-[10px] text-muted mb-1">
                ${weekLabels.map((label) => `<div class="text-center py-1">${label}</div>`).join('')}
              </div>
              <div class="grid grid-cols-7 gap-1">
                ${cells
                  .map((cell) => {
                    const isSelected = selected === cell.ymd;
                    const isToday = cell.ymd === todayYmd;
                    const dayClass = isSelected
                      ? 'bg-primary text-white border-primary'
                      : cell.outside
                        ? 'text-muted/50 border-transparent hover:text-muted hover:border-border'
                        : 'text-text border-transparent hover:bg-bg hover:border-border';
                    const todayRing = isToday && !isSelected ? ' ring-1 ring-primary/40' : '';
                    return `<button type="button" data-picker-day="${kind}:${cell.ymd}" class="h-8 rounded-md border text-xs transition-colors ${dayClass}${todayRing}">${cell.day}</button>`;
                  })
                  .join('')}
              </div>
            </div>
          </div>
        `;
      };

      detailsNode.innerHTML = `
        <div class="space-y-4">
          <div class="rounded-xl border border-border p-4 bg-bg">
            <div class="text-xs uppercase text-muted">Part</div>
            <div class="text-xl font-bold text-text mt-1">${esc(sanitizeUiText(part.name) || '-')}</div>
            <div class="mt-3 flex flex-wrap gap-2">
              <span class="px-2.5 py-1 rounded-md bg-surface border border-border text-xs font-semibold text-text">${esc(sanitizeUiText(part.vehicleModel) || 'Universal')}</span>
              <span class="px-2.5 py-1 rounded-md bg-surface border border-border text-xs font-semibold text-text">${normalizeCarType(part.vehicleType)}</span>
            </div>
            <div class="text-xs text-muted mt-2"><span class="font-semibold text-text">Category:</span> ${esc(sanitizeUiText(part.category) || 'Other')}</div>
            <div class="text-xs text-muted mt-1"><span class="font-semibold text-text">Unit:</span> ${esc(part.unit || '-')}</div>
            <div class="text-xs text-muted mt-1">Pricing: ${part.costPrice ? part.costPrice + ' JOD Cost / ' : ''}${part.sellPrice || 0} JOD Default Price</div>
            <div class="mt-3 text-xs text-muted uppercase tracking-wide">Stock Level</div>
            <div class="mt-1 h-2.5 w-full rounded-full bg-bg/80 border border-border overflow-hidden">
              <div class="h-full ${stockToneClass} transition-all" style="width: ${stockBarWidth}%"></div>
            </div>
            <div class="text-sm mt-2">
              <span class="${stockTextClass} font-bold">${part.stockQty}</span>
              <span class="text-muted"> in stock (min ${part.lowStockThreshold})</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <button class="px-4 py-2 rounded-lg border border-success text-success font-semibold hover:bg-success hover:text-white transition-colors" onclick="window.openInventoryMovement('IN')">+ Add Stock</button>
            <button class="px-4 py-2 rounded-lg border border-danger text-danger font-semibold hover:bg-danger hover:text-white transition-colors" onclick="window.openInventoryMovement('OUT')">- Remove Stock</button>
          </div>

          <div id="inventory-recent-movements-card" class="rounded-xl border border-border overflow-visible">
            <div class="px-4 py-3 border-b border-border bg-bg space-y-2">
              <div class="flex items-center justify-between gap-2">
                <div class="text-sm font-bold text-text">Recent Movements</div>
                <div class="text-xs text-muted">${movementRowsData.length} shown</div>
              </div>
              <div id="inventory-movement-date-filters" class="grid grid-cols-1 md:grid-cols-4 gap-2">
                <select id="inventory-movement-type-filter" class="w-full px-2.5 py-2 rounded-lg border border-border bg-surface text-xs">
                  <option value="ALL" ${state.movementTypeFilter === 'ALL' ? 'selected' : ''}>All Types</option>
                  <option value="IN" ${state.movementTypeFilter === 'IN' ? 'selected' : ''}>IN</option>
                  <option value="OUT" ${state.movementTypeFilter === 'OUT' ? 'selected' : ''}>OUT</option>
                  <option value="SALE" ${state.movementTypeFilter === 'SALE' ? 'selected' : ''}>SALE</option>
                  <option value="ADJUSTMENT" ${state.movementTypeFilter === 'ADJUSTMENT' ? 'selected' : ''}>ADJUSTMENT</option>
                </select>
                ${renderDatePicker('from')}
                ${renderDatePicker('to')}
                <button id="inventory-movement-filter-clear" type="button" class="px-2.5 py-2 rounded-lg border border-border text-xs text-text hover:border-primary">Clear</button>
              </div>
            </div>
            <div class="overflow-auto max-h-72">
              <table class="w-full text-left">
                <thead class="bg-bg border-b border-border sticky top-0">
                  <tr>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted">Date</th>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted text-center">Type</th>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted text-center">Qty</th>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted text-center">Cost</th>
                    <th class="px-3 py-2 text-[10px] uppercase text-muted">Note</th>
                  </tr>
                </thead>
                <tbody>${movementRows}</tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      const movementTypeFilter = document.getElementById('inventory-movement-type-filter');
      const movementFromTrigger = document.getElementById('inventory-movement-date-from-trigger');
      const movementToTrigger = document.getElementById('inventory-movement-date-to-trigger');
      const movementClearFilter = document.getElementById('inventory-movement-filter-clear');
      const movementDateFilters = document.getElementById('inventory-movement-date-filters');
      const pickerNavButtons = Array.from(document.querySelectorAll('[data-picker-nav]'));
      const pickerDayButtons = Array.from(document.querySelectorAll('[data-picker-day]'));

      movementTypeFilter?.addEventListener('change', (event) => {
        state.movementTypeFilter = event.target.value;
        renderDetails();
      });
      movementDateFilters?.addEventListener('click', (event) => event.stopPropagation());
      movementFromTrigger?.addEventListener('click', (event) => {
        event.stopPropagation();
        state.datePickerOpen = state.datePickerOpen === 'from' ? null : 'from';
        renderDetails();
      });
      movementToTrigger?.addEventListener('click', (event) => {
        event.stopPropagation();
        state.datePickerOpen = state.datePickerOpen === 'to' ? null : 'to';
        renderDetails();
      });
      pickerNavButtons.forEach((button) => {
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          const [kind, dir] = button.dataset.pickerNav.split(':');
          const key = kind === 'from' ? 'datePickerFromView' : 'datePickerToView';
          const [yearStr, monthStr] = (state[key] || getViewKey(kind)).split('-');
          const next = new Date(Number(yearStr), Number(monthStr) - 1, 1);
          next.setMonth(next.getMonth() + (dir === 'next' ? 1 : -1));
          state[key] = `${next.getFullYear()}-${pad2(next.getMonth() + 1)}`;
          renderDetails();
        });
      });
      pickerDayButtons.forEach((button) => {
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          const [kind, ymd] = button.dataset.pickerDay.split(':');
          if (kind === 'from') {
            state.movementDateFrom = ymd;
          } else {
            state.movementDateTo = ymd;
          }
          state.datePickerOpen = null;
          renderDetails();
        });
      });
      movementClearFilter?.addEventListener('click', () => {
        state.movementTypeFilter = 'ALL';
        state.movementDateFrom = '';
        state.movementDateTo = '';
        state.datePickerOpen = null;
        renderDetails();
      });
    }

    function loadAlerts() {
      const alerts = state.allParts
        .filter((part) => {
          const status = partStatus(part);
          return status === 'LOW_STOCK' || status === 'OUT_OF_STOCK';
        })
        .sort((a, b) => Number(a.stockQty) - Number(b.stockQty));

      alertsCountNode.textContent = `(${alerts.length})`;
      if (!alerts.length) {
        alertsNode.innerHTML = '<div class="text-xs text-success">No low stock alerts.</div>';
        return;
      }

      alertsNode.innerHTML = alerts
        .map((part) => {
          const status = partStatus(part);
          const remaining = status === 'OUT_OF_STOCK' ? 'out of stock' : `${part.stockQty} remaining`;
          return `
            <button type="button" class="w-full text-left flex items-center justify-between gap-3 rounded-md border-l border-danger/70 bg-danger/5 px-2.5 py-1.5 text-xs hover:bg-danger/10 transition-colors" onclick="window.focusInventoryPartFromAlert('${part.id}')">
              <div class="min-w-0 truncate text-text"><span class="font-semibold text-danger">&#9888; </span><span class="font-semibold">${esc(sanitizeUiText(part.name))}</span></div>
              <div class="whitespace-nowrap text-danger">${esc(remaining)}</div>
            </button>
          `;
        })
        .join('');
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
      partRows.innerHTML = TableRowSkeleton(6).repeat(6);
      try {
        const [partsResponse, movementResponse] = await Promise.all([
          apiFetch('/inventory/parts'),
          apiFetch(`/inventory/movements${buildQuery({ take: 300 })}`)
        ]);
        state.allParts = partsResponse.items || [];
        state.recentMovements = movementResponse.items || [];
        applyPartFilters();

        if (!state.parts.length) {
          state.selectedPartId = null;
        } else if (!state.selectedPartId || !state.parts.some((part) => part.id === state.selectedPartId)) {
          state.selectedPartId = state.parts[0].id;
        }

        renderParts();
        await loadMovements();
        loadAlerts();
      } catch (error) {
        partRows.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-10">${error.message || 'Failed to load parts.'}</td></tr>`;
      }
    }

    window.openInventoryPart = async (id) => {
      await focusPartRow(id, false);
    };

    window.focusInventoryPartFromAlert = async (id) => {
      await focusPartRow(id, true);
    };

    window.toggleInventoryRowMenu = (event, partId) => {
      event.stopPropagation();
      state.openRowMenuPartId = state.openRowMenuPartId === partId ? null : partId;
      renderParts();
    };

    window.inventoryRowAction = async (event, partId, action) => {
      event.stopPropagation();
      state.openRowMenuPartId = null;
      renderParts();

      if (action === 'ADD_STOCK') {
        await focusPartRow(partId, false);
        window.openInventoryMovement('IN');
        return;
      }
      if (action === 'REMOVE_STOCK') {
        await focusPartRow(partId, false);
        window.openInventoryMovement('OUT');
        return;
      }
      if (action === 'EDIT_PART') {
        openEditPartModal(partId);
        return;
      }
      if (action === 'VIEW_MOVEMENTS') {
        await focusPartRow(partId, false);
        document.getElementById('inventory-recent-movements-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    window.openInventoryMovement = (type) => {
      const part = selectedPart();
      if (!part) return;

      movementTypeInput.value = type;
      movementQtyInput.value = '1';
      movementPricingModeInput.value = 'UNIT';
      movementUnitCostInput.value = latestUnitCostForPart(part.id, part.costPrice);
      movementTotalCostInput.value = '';
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
      updatePricingModeUI();
      movementOverlay.classList.remove('hidden');
      movementNoteInput.focus();
    };

    async function applyFiltersAndRefreshDetails() {
      const previousSelected = state.selectedPartId;
      applyPartFilters();
      persistFilters();
      renderParts();
      loadAlerts();
      if (state.selectedPartId !== previousSelected) {
        await loadMovements();
      } else {
        renderDetails();
      }
    }

    searchInput.addEventListener('input', async (event) => {
      state.query = event.target.value;
      await applyFiltersAndRefreshDetails();
    });

    statusFilter.addEventListener('change', async (event) => {
      state.filterStatus = event.target.value;
      await applyFiltersAndRefreshDetails();
    });

    carTypeFilter.addEventListener('change', async (event) => {
      state.filterCarType = event.target.value;
      await applyFiltersAndRefreshDetails();
    });

    categoryFilter.addEventListener('change', async (event) => {
      state.filterCategory = event.target.value;
      await applyFiltersAndRefreshDetails();
    });

    sortFilter.addEventListener('change', async (event) => {
      state.filterSort = event.target.value;
      await applyFiltersAndRefreshDetails();
    });

    quickFilters.forEach((button) => {
      button.addEventListener('click', async () => {
        const key = button.dataset.inventoryQuick;
        if (key === 'low-stock') state.filterStatus = state.filterStatus === 'LOW_STOCK' ? 'ALL' : 'LOW_STOCK';
        if (key === 'out-of-stock') state.filterStatus = state.filterStatus === 'OUT_OF_STOCK' ? 'ALL' : 'OUT_OF_STOCK';
        if (key === 'ev-only') state.filterCarType = state.filterCarType === 'EV' ? 'ALL' : 'EV';
        if (key === 'universal') state.filterCarType = state.filterCarType === 'UNIVERSAL' ? 'ALL' : 'UNIVERSAL';
        if (key === 'recently-moved') state.filterRecentlyMoved = !state.filterRecentlyMoved;
        syncFilterInputs();
        await applyFiltersAndRefreshDetails();
      });
    });

    clearFiltersButton.addEventListener('click', clearFilters);

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
        const editingPart = state.editingPartId ? state.allParts.find((part) => part.id === state.editingPartId) : null;
        const endpoint = editingPart ? `/inventory/parts/${editingPart.id}` : '/inventory/parts';
        const method = editingPart ? 'PATCH' : 'POST';
        await apiFetch(endpoint, {
          method,
          body: {
            name,
            vehicleModel,
            vehicleType,
            unit: 'piece',
            costPrice: costPriceRaw !== '' ? Number(costPriceRaw) : undefined,
            sellPrice,
            stockQty: editingPart ? Number(editingPart.stockQty || 0) : 0,
            lowStockThreshold: minStock,
            isActive: true
          }
        });
        window.toast(editingPart ? 'Part updated.' : 'Part created.', 'success');
        closeAddPartModal(true);
        await loadParts();
      } catch (error) {
        window.toast(error.message || 'Failed to save part.', 'error');
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
            pricingMode: movementPricingModeInput.value,
            quantity: Number(movementQtyInput.value),
            unitCost: movementPricingModeInput.value === 'UNIT' ? Number(movementUnitCostInput.value) : undefined,
            totalCost: movementPricingModeInput.value === 'TOTAL' ? Number(movementTotalCostInput.value) : undefined,
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
    movementPricingModeInput.addEventListener('change', updatePricingModeUI);
    movementQtyInput.addEventListener('input', updatePricingModeUI);
    movementUnitCostInput.addEventListener('input', updatePricingModeUI);
    movementTotalCostInput.addEventListener('input', updatePricingModeUI);
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
    document.addEventListener('click', (event) => {
      const inDatePicker = event.target?.closest?.('#inventory-movement-date-filters');
      if (!inDatePicker && state.datePickerOpen) {
        state.datePickerOpen = null;
        renderDetails();
      }
      if (state.openRowMenuPartId) {
        state.openRowMenuPartId = null;
        renderParts();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (state.datePickerOpen) {
        state.datePickerOpen = null;
        renderDetails();
      }
      if (!addPartOverlay.classList.contains('hidden')) {
        closeAddPartModal(true);
      }
      if (!movementOverlay.classList.contains('hidden')) {
        closeMovementModal();
      }
    });

    loadSavedFilters();
    syncFilterInputs();
    renderQuickFilters();
    await loadParts();

    if (window.location.hash === '#add-part') {
      openAddPartModal();
    }
  };

  return `
    <div class="w-full h-full flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3 bg-surface border border-border p-3 rounded-xl">
        <div>
          <h1 class="text-2xl font-heading font-bold text-text">Inventory</h1>
          <p class="text-sm text-muted">Track parts stock and movement notes</p>
        </div>
        <button id="inventory-add-part-toggle" class="px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary-hover">+ Add Part</button>
      </div>

      <div class="bg-surface border border-border rounded-xl p-3">
        <div class="flex items-center justify-between gap-2 mb-2">
          <div class="text-sm font-bold text-text">Low Stock Alerts <span id="inventory-alerts-count" class="text-danger"></span></div>
        </div>
        <div id="inventory-alerts" class="max-h-36 overflow-auto space-y-2 pr-1"></div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-[1.45fr,1fr] gap-4">
        <div class="bg-surface border border-border rounded-xl overflow-hidden">
          <div class="p-3 border-b border-border bg-bg space-y-2.5">
            <div>
              <input id="inventory-search" placeholder="Search by part, model, type, category, unit, notes, status" class="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm">
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
              <select id="inventory-filter-status" class="w-full px-2.5 py-2 rounded-lg border border-border bg-surface text-xs">
                <option value="ALL">Status: All</option>
                <option value="LOW_STOCK">Low Stock</option>
                <option value="OK">OK</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>
              <select id="inventory-filter-car-type" class="w-full px-2.5 py-2 rounded-lg border border-border bg-surface text-xs">
                <option value="ALL">Car Type: All</option>
                <option value="EV">EV</option>
                <option value="HYBRID">Hybrid</option>
                <option value="FUEL">Fuel</option>
                <option value="UNIVERSAL">Universal</option>
              </select>
              <select id="inventory-filter-category" class="w-full px-2.5 py-2 rounded-lg border border-border bg-surface text-xs">
                <option value="ALL">Category: All</option>
                <option value="CLIMATE">Climate</option>
                <option value="BRAKES">Brakes</option>
                <option value="FLUIDS">Fluids</option>
                <option value="BATTERY">Battery</option>
                <option value="CHEMICALS">Chemicals</option>
                <option value="OTHER">Other</option>
              </select>
              <select id="inventory-filter-sort" class="w-full px-2.5 py-2 rounded-lg border border-border bg-surface text-xs">
                <option value="NAME_ASC">Sort: Name A-Z</option>
                <option value="STOCK_ASC">Sort: Stock low → high</option>
                <option value="STOCK_DESC">Sort: Stock high → low</option>
                <option value="UPDATED_DESC">Sort: Recently updated</option>
              </select>
              <button id="inventory-clear-filters" class="px-3 py-2 rounded-lg border border-border text-xs text-muted hover:text-text hover:border-primary">Clear Filters</button>
            </div>

            <div class="flex flex-wrap gap-2">
              <button data-inventory-quick="low-stock" class="px-3 py-1.5 rounded-full border border-border text-muted text-xs font-semibold hover:border-primary/40 hover:text-text transition-colors">Low Stock</button>
              <button data-inventory-quick="out-of-stock" class="px-3 py-1.5 rounded-full border border-border text-muted text-xs font-semibold hover:border-primary/40 hover:text-text transition-colors">Out of Stock</button>
              <button data-inventory-quick="ev-only" class="px-3 py-1.5 rounded-full border border-border text-muted text-xs font-semibold hover:border-primary/40 hover:text-text transition-colors">EV Only</button>
              <button data-inventory-quick="universal" class="px-3 py-1.5 rounded-full border border-border text-muted text-xs font-semibold hover:border-primary/40 hover:text-text transition-colors">Universal Parts</button>
              <button data-inventory-quick="recently-moved" class="px-3 py-1.5 rounded-full border border-border text-muted text-xs font-semibold hover:border-primary/40 hover:text-text transition-colors">Recently Moved</button>
            </div>
          </div>
          <div class="px-3 py-2 border-b border-border bg-surface/70">
            <div id="inventory-results-summary" class="text-xs text-muted">0 parts</div>
          </div>
          <div class="overflow-auto max-h-[620px]">
            <table class="w-full text-left min-w-[980px]">
              <thead class="bg-bg border-b border-border sticky top-0">
                <tr>
                  <th class="w-[26%] px-3 py-2 text-xs uppercase text-muted">Part</th>
                  <th class="w-[22%] px-3 py-2 text-xs uppercase text-muted text-center">Details</th>
                  <th class="px-3 py-2 text-xs uppercase text-muted">Category</th>
                  <th class="px-3 py-2 text-xs uppercase text-muted text-center">Stock</th>
                  <th class="px-3 py-2 text-xs uppercase text-muted text-center">Status</th>
                  <th class="px-3 py-2 text-xs uppercase text-muted text-right">Updated</th>
                  <th class="px-3 py-2 text-xs uppercase text-muted text-right">Actions</th>
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
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Quantity</label>
                <input id="inventory-movement-qty" type="number" min="1" required value="1" class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
              </div>
              <div>
                <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Pricing Mode</label>
                <select id="inventory-movement-pricing-mode" class="w-full px-3 py-2 rounded-lg border border-border bg-bg">
                  <option value="UNIT">UNIT</option>
                  <option value="TOTAL">TOTAL</option>
                </select>
              </div>
            </div>
            <div id="inventory-movement-unit-wrap">
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Unit Cost (JOD)</label>
              <input id="inventory-movement-unit-cost" type="number" min="0.001" step="0.001" class="w-full px-3 py-2 rounded-lg border border-border bg-bg" placeholder="0.000">
            </div>
            <div id="inventory-movement-total-wrap" class="hidden">
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Total Cost (JOD)</label>
              <input id="inventory-movement-total-cost" type="number" min="0.01" step="0.01" class="w-full px-3 py-2 rounded-lg border border-border bg-bg" placeholder="0.00">
            </div>
            <div id="inventory-movement-computed" class="text-xs text-muted">Computed Total: -</div>
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
            <h3 id="inventory-add-part-title" class="text-lg font-heading font-bold text-text">Add Inventory Item</h3>
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
              <button type="submit" class="px-5 py-2 rounded-lg bg-primary text-white font-semibold hover:bg-primary-hover"><span id="inventory-add-part-submit-text">Save Part</span></button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}









