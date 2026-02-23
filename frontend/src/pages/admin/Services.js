import { apiFetch } from '../../lib/api.js';
import { openImageCropper } from '../../components/ui/ImageCropper.js';
import { TableRowSkeleton } from '../../components/ui/Skeleton.js';
import { t } from '../../lib/i18n.js';
import { uploadLocalFile } from '../../lib/uploads.js';

export function AdminServices() {

  window.onMount = async () => {
    const tbody = document.getElementById('services-tbody');
    const imageInput = document.getElementById('service-image-file');
    const imagePreview = document.getElementById('service-image-preview');
    const imageHint = document.getElementById('service-image-hint');
    const imageUrlField = document.getElementById('service-image-url');
    const editOverlay = document.getElementById('service-edit-overlay');
    const editForm = document.getElementById('service-edit-form');
    const editImageInput = document.getElementById('service-edit-image-file');
    const editImagePreview = document.getElementById('service-edit-image-preview');
    const editImageHint = document.getElementById('service-edit-image-hint');
    const editImageUrlField = document.getElementById('service-edit-image-url');
    let allServices = [];
    let editingServiceId = null;

    function showImagePreview(previewNode, url, altText = 'Image') {
      if (!previewNode) return;
      if (!url) {
        previewNode.innerHTML = '<div class="w-full h-full flex items-center justify-center text-[10px] text-muted">No image</div>';
        return;
      }
      previewNode.innerHTML = `<img src="${url}" alt="${altText}" class="w-full h-full object-cover">`;
    }

    async function cropAndUploadImage(file, folder, title) {
      const cropped = await openImageCropper({
        file,
        title,
        aspectRatio: 16 / 10,
        outputType: 'image/jpeg',
        outputSize: 1200
      });
      if (!cropped) return null;

      const uploadFile = new File([cropped], `service_${Date.now()}.jpg`, {
        type: cropped.type || 'image/jpeg'
      });
      return uploadLocalFile(uploadFile, { folder });
    }

    function resetImagePicker() {
      imageUrlField.value = '';
      showImagePreview(imagePreview, '');
      imageHint.textContent = 'Choose image to crop and upload.';
      if (imageInput) {
        imageInput.value = '';
      }
    }

    function closeEditModal() {
      if (!editOverlay) return;
      editOverlay.classList.add('hidden');
      editingServiceId = null;
      editForm?.reset();
      editImageUrlField.value = '';
      showImagePreview(editImagePreview, '');
      editImageHint.textContent = 'Choose image to crop and upload.';
      if (editImageInput) {
        editImageInput.value = '';
      }
    }

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
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-lg border border-border bg-bg overflow-hidden shrink-0">
                ${
                  s.imageUrl
                    ? `<img src="${s.imageUrl}" alt="${s.nameEn}" class="w-full h-full object-cover">`
                    : '<div class="w-full h-full flex items-center justify-center text-[10px] text-muted">No image</div>'
                }
              </div>
              <div>
                <div class="text-sm font-bold text-text">${s.nameEn}</div>
                <div class="text-[10px] text-muted">${s.nameAr}</div>
              </div>
            </div>
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
      const service = allServices.find((item) => item.id === id);
      if (!service || !editOverlay || !editForm) return;

      editingServiceId = id;
      editForm.nameEn.value = service.nameEn || '';
      editForm.nameAr.value = service.nameAr || '';
      editForm.category.value = service.category || '';
      editForm.basePrice.value = service.basePrice ?? '';
      editForm.durationMinutes.value = service.durationMinutes || '';
      editForm.descriptionEn.value = service.descriptionEn || '';
      editForm.descriptionAr.value = service.descriptionAr || '';
      editImageUrlField.value = service.imageUrl || '';
      showImagePreview(editImagePreview, service.imageUrl, service.nameEn || 'Service image');
      editImageHint.textContent = 'Update image if needed.';

      editOverlay.classList.remove('hidden');
    };

    document.getElementById('create-btn').addEventListener('click', () => {
      const formContainer = document.getElementById('creation-form-container');
      formContainer.classList.toggle('hidden');
    });

    imageInput?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        imageHint.textContent = 'Processing image...';
        const fileUrl = await cropAndUploadImage(file, 'services', 'Crop service image');
        if (!fileUrl) {
          imageHint.textContent = 'Upload cancelled.';
          return;
        }

        imageUrlField.value = fileUrl;
        showImagePreview(imagePreview, fileUrl, 'Service image');
        imageHint.textContent = 'Image uploaded.';
        window.toast('Service image uploaded.', 'success');
      } catch (error) {
        imageHint.textContent = 'Upload failed.';
        window.toast(error.message || 'Failed to upload image.', 'error');
      } finally {
        event.target.value = '';
      }
    });

    editImageInput?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        editImageHint.textContent = 'Processing image...';
        const fileUrl = await cropAndUploadImage(file, 'services', 'Crop service image');
        if (!fileUrl) {
          editImageHint.textContent = 'Upload cancelled.';
          return;
        }

        editImageUrlField.value = fileUrl;
        showImagePreview(editImagePreview, fileUrl, 'Service image');
        editImageHint.textContent = 'Image uploaded.';
        window.toast('Service image uploaded.', 'success');
      } catch (error) {
        editImageHint.textContent = 'Upload failed.';
        window.toast(error.message || 'Failed to upload image.', 'error');
      } finally {
        event.target.value = '';
      }
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
        imageUrl: form.imageUrl.value || undefined,
        descriptionEn: form.descriptionEn.value || null,
        descriptionAr: form.descriptionAr.value || null,
      };

      try {
        await apiFetch('/services', { method: 'POST', body });
        window.toast('Service created successfully', 'success');
        form.reset();
        resetImagePicker();
        document.getElementById('creation-form-container').classList.add('hidden');
        load();
      } catch (err) {
        window.toast(err.message || 'Creation failed', 'error');
      }
    });

    editForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!editingServiceId) return;

      const body = {
        nameEn: editForm.nameEn.value,
        nameAr: editForm.nameAr.value,
        category: editForm.category.value || null,
        basePrice: editForm.basePrice.value || null,
        durationMinutes: parseInt(editForm.durationMinutes.value, 10),
        imageUrl: editForm.imageUrl.value || null,
        descriptionEn: editForm.descriptionEn.value || null,
        descriptionAr: editForm.descriptionAr.value || null
      };

      try {
        await apiFetch(`/services/${editingServiceId}`, {
          method: 'PATCH',
          body
        });
        window.toast('Service updated.', 'success');
        closeEditModal();
        await load();
      } catch (error) {
        window.toast(error.message || 'Update failed.', 'error');
      }
    });

    document.getElementById('service-edit-close')?.addEventListener('click', closeEditModal);
    document.getElementById('service-edit-cancel')?.addEventListener('click', closeEditModal);
    editOverlay?.addEventListener('click', (event) => {
      if (event.target === editOverlay) {
        closeEditModal();
      }
    });

    load();
    resetImagePicker();
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

          <div>
            <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Service Image</label>
            <input id="service-image-file" type="file" accept="image/*" class="hidden">
            <input id="service-image-url" name="imageUrl" type="hidden">
            <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <label for="service-image-file" class="inline-flex items-center px-4 py-2 rounded-lg border border-border text-sm font-semibold text-text hover:border-primary hover:text-primary cursor-pointer transition-colors">Choose File</label>
              <div id="service-image-preview" class="w-24 h-24 rounded-lg border border-border bg-bg overflow-hidden"></div>
              <div id="service-image-hint" class="text-xs text-muted">Choose image to crop and upload.</div>
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

      <div id="service-edit-overlay" class="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm hidden flex items-center justify-center p-4">
        <div class="w-full max-w-3xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 class="text-lg font-heading font-bold text-text">Edit Service</h3>
            <button id="service-edit-close" type="button" class="w-8 h-8 rounded-full border border-border text-muted hover:text-text hover:border-text transition-colors">&times;</button>
          </div>
          <form id="service-edit-form" class="p-5 space-y-4">
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
                <input type="text" name="category" class="w-full bg-bg border border-border rounded-lg px-3 py-2 focus:border-primary outline-none transition-colors text-text">
              </div>
              <div>
                <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Duration (Mins)</label>
                <input type="number" name="durationMinutes" required min="1" class="w-full bg-bg border border-border rounded-lg px-3 py-2 focus:border-primary outline-none transition-colors text-text">
              </div>
              <div>
                <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Base Price (JOD)</label>
                <input type="number" step="0.01" name="basePrice" class="w-full bg-bg border border-border rounded-lg px-3 py-2 focus:border-primary outline-none transition-colors text-text">
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Service Image</label>
              <input id="service-edit-image-file" type="file" accept="image/*" class="hidden">
              <input id="service-edit-image-url" name="imageUrl" type="hidden">
              <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <label for="service-edit-image-file" class="inline-flex items-center px-4 py-2 rounded-lg border border-border text-sm font-semibold text-text hover:border-primary hover:text-primary cursor-pointer transition-colors">Choose File</label>
                <div id="service-edit-image-preview" class="w-24 h-24 rounded-lg border border-border bg-bg overflow-hidden"></div>
                <div id="service-edit-image-hint" class="text-xs text-muted">Choose image to crop and upload.</div>
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

            <div class="flex justify-end gap-3 pt-2">
              <button id="service-edit-cancel" type="button" class="px-4 py-2 rounded-lg border border-border text-text hover:border-text transition-colors">Cancel</button>
              <button type="submit" class="px-6 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary-hover transition-colors">Save Changes</button>
            </div>
          </form>
        </div>
      </div>

    </div>
  `;
}
