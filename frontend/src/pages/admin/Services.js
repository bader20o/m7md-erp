import { apiFetch } from '../../lib/api.js';
import { TableRowSkeleton } from '../../components/ui/Skeleton.js';
import { t } from '../../lib/i18n.js';

export function AdminServices() {

  window.onMount = async () => {
    const tbody = document.getElementById('services-tbody');
    let allServices = [];

    async function load() {
      tbody.innerHTML = TableRowSkeleton(5).repeat(5);

      try {
        const res = await apiFetch('/services');
        if (res && res.items) {
          allServices = res.items;
          renderTable();
        }
      } catch (e) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-danger">Failed to load services</td></tr>`;
      }
    }

    function renderTable() {
      if (allServices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-12 text-center text-muted font-medium text-sm">No services found. Click "New Service" to add one.</td></tr>`;
        return;
      }

      tbody.innerHTML = allServices.map(s => `
        <tr class="group border-b border-border bg-surface hover:bg-bg transition-colors">
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-bold text-text">${s.nameEn}</div>
            <div class="text-[10px] text-muted">${s.nameAr}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2.5 py-1 bg-muted/15 text-muted rounded-md text-[10px] font-bold uppercase tracking-wider">${s.category || 'N/A'}</span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-semibold text-text">${s.basePrice ? s.basePrice + ' JOD' : 'Variable'}</div>
            <div class="text-[10px] text-muted">${s.durationMinutes} min</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            ${s.isActive
          ? `<span class="px-2.5 py-1 bg-success/15 text-success rounded-md text-[10px] font-bold uppercase">Active</span>`
          : `<span class="px-2.5 py-1 bg-danger/15 text-danger rounded-md text-[10px] font-bold uppercase">Inactive</span>`
        }
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm pr-6">
            <button class="text-primary hover:text-primary-hover font-semibold mr-4 p-2" onclick="window.editService('${s.id}')">Edit</button>
            <button class="${s.isActive ? 'text-danger hover:text-red-700' : 'text-success hover:text-green-600'} font-semibold p-2" onclick="window.toggleService('${s.id}', ${!s.isActive})">
              ${s.isActive ? 'Disable' : 'Enable'}
            </button>
          </td>
        </tr>
      `).join('');
    }

    window.toggleService = async (id, isActive) => {
      try {
        await apiFetch(`/services/${id}`, {
          method: 'PATCH',
          body: { isActive }
        });
        window.toast(`Service ${isActive ? 'enabled' : 'disabled'}`, 'success');
        load();
      } catch (e) {
        window.toast(e.message, 'error');
      }
    };

    window.editService = (id) => {
      // In a full app, this opens a modal populated with the service data.
      // For this spec, we will alert that the form opens.
      alert(`Open Edit form for ${id}. Similar implementation to Creation form.`);
    };

    document.getElementById('create-btn').addEventListener('click', () => {
      const formContainer = document.getElementById('creation-form-container');
      formContainer.classList.toggle('hidden');
    });

    document.getElementById('service-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;

      const body = {
        nameEn: form.nameEn.value,
        nameAr: form.nameAr.value,
        category: form.category.value || null,
        basePrice: form.basePrice.value || null,
        durationMinutes: parseInt(form.durationMinutes.value, 10),
        descriptionEn: form.descriptionEn.value || null,
        descriptionAr: form.descriptionAr.value || null,
      };

      try {
        await apiFetch('/services', { method: 'POST', body });
        window.toast('Service created successfully', 'success');
        form.reset();
        document.getElementById('creation-form-container').classList.add('hidden');
        load();
      } catch (err) {
        window.toast(err.message || 'Creation failed', 'error');
      }
    });

    load();
  };

  return `
    <div class="w-full h-full flex flex-col gap-6">
      
      <div class="flex justify-between items-center bg-surface border border-border p-4 rounded-xl">
        <div>
          <h1 class="text-2xl font-heading font-bold text-text">Service Catalog</h1>
        </div>
        <button id="create-btn" class="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-sm flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
          New Service
        </button>
      </div>

      <!-- Creation Form -->
      <div id="creation-form-container" class="hidden bg-surface border border-border rounded-xl p-6 shadow-sm">
        <h3 class="font-heading font-bold text-lg mb-4 text-text">Add New Service</h3>
        <form id="service-form" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Name (EN)</label>
              <input type="text" name="nameEn" required class="w-full bg-bg border border-border rounded-lg px-3 py-2 focus:border-primary outline-none transition-colors text-text">
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Name (AR)</label>
              <input type="text" name="nameAr" required class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-right focus:border-primary outline-none transition-colors text-text">
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Category</label>
              <input type="text" name="category" placeholder="e.g. Electrical, Mechanical" class="w-full bg-bg border border-border rounded-lg px-3 py-2 focus:border-primary outline-none transition-colors text-text">
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Duration (Mins)</label>
              <input type="number" name="durationMinutes" required min="1" class="w-full bg-bg border border-border rounded-lg px-3 py-2 focus:border-primary outline-none transition-colors text-text">
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Base Price (JOD)</label>
              <input type="number" step="0.01" name="basePrice" placeholder="Leave empty if variable" class="w-full bg-bg border border-border rounded-lg px-3 py-2 focus:border-primary outline-none transition-colors text-text">
            </div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Desc (EN)</label>
              <textarea name="descriptionEn" rows="2" class="w-full bg-bg border border-border rounded-lg px-3 py-2 focus:border-primary outline-none transition-colors text-text resize-none"></textarea>
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Desc (AR)</label>
              <textarea name="descriptionAr" rows="2" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-right focus:border-primary outline-none transition-colors text-text resize-none"></textarea>
            </div>
          </div>
          
          <div class="flex justify-end pt-2">
             <button type="submit" class="bg-success hover:bg-green-600 text-white px-8 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-sm">Save Service</button>
          </div>
        </form>
      </div>

      <div class="bg-surface border border-border rounded-xl overflow-hidden shadow-sm flex-1 flex flex-col min-h-0">
        <div class="overflow-x-auto overflow-y-auto block h-full flex-1">
          <table class="w-full text-left min-w-[800px]">
            <thead class="bg-bg border-b border-border sticky top-0 z-10 w-full">
              <tr>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Service</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Category</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Metrics</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                <th class="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody id="services-tbody" class="divide-y divide-border">
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}
