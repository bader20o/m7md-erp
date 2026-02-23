import { apiFetch } from '../../lib/api.js';
import { openImageCropper } from '../../components/ui/ImageCropper.js';
import { CardSkeleton } from '../../components/ui/Skeleton.js';
import { uploadLocalFile } from '../../lib/uploads.js';

export function AdminMemberships() {
  window.onMount = async () => {
    const grid = document.getElementById('plans-grid');
    const formContainer = document.getElementById('creation-form-container');
    const createBtn = document.getElementById('create-plan-btn');
    const planForm = document.getElementById('plan-form');
    const imageInput = document.getElementById('plan-image-file');
    const imageUrlField = document.getElementById('plan-image-url');
    const imagePreview = document.getElementById('plan-image-preview');
    const imageHint = document.getElementById('plan-image-hint');
    const editOverlay = document.getElementById('plan-edit-overlay');
    const editForm = document.getElementById('plan-edit-form');
    const editImageInput = document.getElementById('plan-edit-image-file');
    const editImageUrlField = document.getElementById('plan-edit-image-url');
    const editImagePreview = document.getElementById('plan-edit-image-preview');
    const editImageHint = document.getElementById('plan-edit-image-hint');

    let plans = [];
    let editingPlanId = null;

    function showImage(previewNode, url, label = 'No image') {
      if (!previewNode) return;
      if (!url) {
        previewNode.innerHTML = `<div class="w-full h-full flex items-center justify-center text-[10px] text-muted">${label}</div>`;
        return;
      }
      previewNode.innerHTML = `<img src="${url}" alt="Plan image" class="w-full h-full object-cover">`;
    }

    async function cropAndUpload(file, title) {
      const cropped = await openImageCropper({
        file,
        title,
        aspectRatio: 4 / 3,
        outputType: 'image/jpeg',
        outputSize: 1200
      });
      if (!cropped) return null;
      const uploadFile = new File([cropped], `membership_${Date.now()}.jpg`, {
        type: cropped.type || 'image/jpeg'
      });
      return uploadLocalFile(uploadFile, { folder: 'memberships' });
    }

    function resetCreateImage() {
      imageUrlField.value = '';
      showImage(imagePreview, '', 'No image');
      imageHint.textContent = 'Choose image to crop and upload.';
      if (imageInput) imageInput.value = '';
    }

    function closeEditModal() {
      editOverlay.classList.add('hidden');
      editForm.reset();
      editingPlanId = null;
      editImageUrlField.value = '';
      showImage(editImagePreview, '', 'No image');
      editImageHint.textContent = 'Choose image to crop and upload.';
      if (editImageInput) editImageInput.value = '';
    }

    createBtn.addEventListener('click', () => {
      formContainer.classList.toggle('hidden');
    });

    function renderCards() {
      if (!plans.length) {
        grid.innerHTML = '<div class="col-span-full py-14 text-center text-muted">No plans found. Create a new membership plan.</div>';
        return;
      }

      grid.innerHTML = plans
        .map(
          (plan) => `
            <article class="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col">
              <div class="h-48 bg-bg border-b border-border overflow-hidden">
                ${
                  plan.imageUrl
                    ? `<img src="${plan.imageUrl}" alt="${plan.nameEn}" class="w-full h-full object-cover">`
                    : `<div class="w-full h-full flex items-center justify-center text-muted text-sm">No image</div>`
                }
              </div>
              <div class="p-5 flex flex-col gap-3 flex-1">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <h3 class="text-lg font-heading font-bold text-text">${plan.nameEn}</h3>
                    <div class="text-xs text-muted">${plan.nameAr}</div>
                  </div>
                  <span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                    plan.isActive ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
                  }">${plan.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <p class="text-sm text-muted leading-relaxed flex-1">${plan.descriptionEn || 'No description provided.'}</p>
                <div class="text-2xl font-extrabold text-primary">${Number(plan.price).toFixed(2)} JOD</div>
                <div class="text-xs text-muted">Duration: ${Math.max(1, Math.round(plan.durationDays / 30))} month(s)</div>
                <div class="flex items-center gap-2 pt-2">
                  <button class="flex-1 px-3 py-2 rounded-lg border border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors" onclick="window.openPlanEditor('${plan.id}')">Edit</button>
                  <button class="px-3 py-2 rounded-lg border ${
                    plan.isActive ? 'border-danger text-danger hover:bg-danger hover:text-white' : 'border-success text-success hover:bg-success hover:text-white'
                  } font-semibold transition-colors" onclick="window.togglePlanStatus('${plan.id}', ${!plan.isActive})">
                    ${plan.isActive ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            </article>
          `
        )
        .join('');
    }

    async function load() {
      grid.innerHTML = Array(6).fill(CardSkeleton()).join('');
      try {
        const res = await apiFetch('/memberships/plans');
        plans = res?.items || [];
        renderCards();
      } catch (error) {
        grid.innerHTML = `<div class="col-span-full py-14 text-center text-danger">${error.message || 'Unable to load plans.'}</div>`;
      }
    }

    window.openPlanEditor = (id) => {
      const plan = plans.find((item) => item.id === id);
      if (!plan) return;

      editingPlanId = id;
      editForm.tier.value = plan.tier || '';
      editForm.color.value = plan.color || '#3B82F6';
      editForm.nameEn.value = plan.nameEn || '';
      editForm.nameAr.value = plan.nameAr || '';
      editForm.price.value = Number(plan.price || 0);
      editForm.durationMonths.value = Math.max(1, Math.round((plan.durationDays || 30) / 30));
      editForm.descriptionEn.value = plan.descriptionEn || '';
      editForm.descriptionAr.value = plan.descriptionAr || '';
      editImageUrlField.value = plan.imageUrl || '';
      showImage(editImagePreview, plan.imageUrl, 'No image');
      editImageHint.textContent = 'Update image if needed.';
      editOverlay.classList.remove('hidden');
    };

    window.togglePlanStatus = async (id, isActive) => {
      try {
        await apiFetch(`/memberships/plans/${id}`, {
          method: 'PATCH',
          body: { isActive }
        });
        window.toast('Plan status updated.', 'success');
        await load();
      } catch (error) {
        window.toast(error.message || 'Failed to update status.', 'error');
      }
    };

    imageInput?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        imageHint.textContent = 'Processing image...';
        const fileUrl = await cropAndUpload(file, 'Crop membership image');
        if (!fileUrl) {
          imageHint.textContent = 'Upload cancelled.';
          return;
        }
        imageUrlField.value = fileUrl;
        showImage(imagePreview, fileUrl);
        imageHint.textContent = 'Image uploaded.';
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
        const fileUrl = await cropAndUpload(file, 'Crop membership image');
        if (!fileUrl) {
          editImageHint.textContent = 'Upload cancelled.';
          return;
        }
        editImageUrlField.value = fileUrl;
        showImage(editImagePreview, fileUrl);
        editImageHint.textContent = 'Image uploaded.';
      } catch (error) {
        editImageHint.textContent = 'Upload failed.';
        window.toast(error.message || 'Failed to upload image.', 'error');
      } finally {
        event.target.value = '';
      }
    });

    planForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.target;

      try {
        await apiFetch('/memberships/plans', {
          method: 'POST',
          body: {
            tier: form.tier.value,
            color: form.color.value,
            nameEn: form.nameEn.value,
            nameAr: form.nameAr.value,
            imageUrl: form.imageUrl.value || undefined,
            price: parseFloat(form.price.value),
            durationDays: parseInt(form.durationMonths.value, 10) * 30,
            descriptionEn: form.descriptionEn.value || undefined,
            descriptionAr: form.descriptionAr.value || undefined
          }
        });
        window.toast('Membership plan created.', 'success');
        form.reset();
        resetCreateImage();
        formContainer.classList.add('hidden');
        await load();
      } catch (error) {
        window.toast(error.message || 'Failed to create plan.', 'error');
      }
    });

    editForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!editingPlanId) return;

      try {
        await apiFetch(`/memberships/plans/${editingPlanId}`, {
          method: 'PATCH',
          body: {
            tier: editForm.tier.value,
            color: editForm.color.value,
            nameEn: editForm.nameEn.value,
            nameAr: editForm.nameAr.value,
            imageUrl: editForm.imageUrl.value || null,
            price: parseFloat(editForm.price.value),
            durationDays: parseInt(editForm.durationMonths.value, 10) * 30,
            descriptionEn: editForm.descriptionEn.value || null,
            descriptionAr: editForm.descriptionAr.value || null
          }
        });
        window.toast('Membership plan updated.', 'success');
        closeEditModal();
        await load();
      } catch (error) {
        window.toast(error.message || 'Failed to update plan.', 'error');
      }
    });

    document.getElementById('plan-edit-close')?.addEventListener('click', closeEditModal);
    document.getElementById('plan-edit-cancel')?.addEventListener('click', closeEditModal);
    editOverlay?.addEventListener('click', (event) => {
      if (event.target === editOverlay) {
        closeEditModal();
      }
    });

    resetCreateImage();
    await load();
  };

  return `
    <div class="w-full h-full flex flex-col gap-6 fade-in">
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface border border-border p-6 rounded-xl shadow-sm">
        <div>
          <h1 class="text-2xl font-heading font-bold text-text">Membership Plans</h1>
          <p class="text-sm text-muted mt-1">Large card view with image, description, and fixed JOD pricing.</p>
        </div>
        <button id="create-plan-btn" class="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-sm flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
          Create Plan
        </button>
      </div>

      <div id="creation-form-container" class="hidden bg-surface border border-border rounded-xl p-6 shadow-sm">
        <h3 class="font-heading font-bold text-lg mb-4 text-text">Add Membership Plan</h3>
        <form id="plan-form" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Tier</label>
              <input type="text" name="tier" required class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text">
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Theme Color</label>
              <input type="color" name="color" value="#3B82F6" class="w-full bg-bg border border-border rounded-lg h-[42px] px-1 py-1">
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Name (EN)</label>
              <input type="text" name="nameEn" required class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text">
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Name (AR)</label>
              <input type="text" name="nameAr" required class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-right text-text">
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Price (JOD)</label>
              <input type="number" step="0.01" name="price" required class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text">
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Duration (Months)</label>
              <input type="number" name="durationMonths" required min="1" value="12" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text">
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Description (EN)</label>
              <textarea name="descriptionEn" rows="3" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text resize-none"></textarea>
            </div>
            <div>
              <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Description (AR)</label>
              <textarea name="descriptionAr" rows="3" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-right text-text resize-none"></textarea>
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-muted uppercase tracking-wider mb-1">Plan Image</label>
            <input id="plan-image-file" type="file" accept="image/*" class="hidden">
            <input id="plan-image-url" name="imageUrl" type="hidden">
            <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <label for="plan-image-file" class="inline-flex items-center px-4 py-2 rounded-lg border border-border text-sm font-semibold text-text hover:border-primary hover:text-primary cursor-pointer transition-colors">Choose File</label>
              <div id="plan-image-preview" class="w-24 h-24 rounded-lg border border-border bg-bg overflow-hidden"></div>
              <div id="plan-image-hint" class="text-xs text-muted">Choose image to crop and upload.</div>
            </div>
          </div>
          <div class="flex justify-end">
            <button type="submit" class="bg-success hover:bg-green-600 text-white px-8 py-2.5 rounded-lg font-bold text-sm transition-colors">Save Plan</button>
          </div>
        </form>
      </div>

      <section id="plans-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"></section>

      <div id="plan-edit-overlay" class="hidden fixed inset-0 z-[75] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="w-full max-w-3xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
          <div class="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 class="text-lg font-heading font-bold text-text">Edit Membership Plan</h3>
            <button id="plan-edit-close" type="button" class="w-8 h-8 rounded-full border border-border text-muted hover:text-text hover:border-text">&times;</button>
          </div>
          <form id="plan-edit-form" class="p-5 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" name="tier" required class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text" placeholder="Tier">
              <input type="color" name="color" class="w-full bg-bg border border-border rounded-lg h-[42px] px-1 py-1">
              <input type="text" name="nameEn" required class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text" placeholder="Name EN">
              <input type="text" name="nameAr" required class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-right text-text" placeholder="Name AR">
              <input type="number" step="0.01" name="price" required class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text" placeholder="Price">
              <input type="number" min="1" name="durationMonths" required class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text" placeholder="Duration (Months)">
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <textarea name="descriptionEn" rows="3" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-text resize-none" placeholder="Description EN"></textarea>
              <textarea name="descriptionAr" rows="3" class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-right text-text resize-none" placeholder="Description AR"></textarea>
            </div>
            <div>
              <input id="plan-edit-image-file" type="file" accept="image/*" class="hidden">
              <input id="plan-edit-image-url" name="imageUrl" type="hidden">
              <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <label for="plan-edit-image-file" class="inline-flex items-center px-4 py-2 rounded-lg border border-border text-sm font-semibold text-text hover:border-primary hover:text-primary cursor-pointer transition-colors">Choose File</label>
                <div id="plan-edit-image-preview" class="w-24 h-24 rounded-lg border border-border bg-bg overflow-hidden"></div>
                <div id="plan-edit-image-hint" class="text-xs text-muted">Choose image to crop and upload.</div>
              </div>
            </div>
            <div class="flex justify-end gap-3">
              <button id="plan-edit-cancel" type="button" class="px-4 py-2 rounded-lg border border-border text-text hover:border-text">Cancel</button>
              <button type="submit" class="px-6 py-2.5 rounded-lg bg-primary text-white font-semibold hover:bg-primary-hover">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}
