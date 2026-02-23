import { t } from "../../lib/i18n.js";
import { apiFetch } from "../../lib/api.js";
import { isAdminRole, isCustomerRole, isEmployeeRole } from "../../lib/roles.js";
import { store } from "../../lib/store.js";

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(canvas, type = "image/jpeg", quality = 0.9) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function uploadAvatar(blob) {
  const formData = new FormData();
  formData.append("file", new File([blob], `avatar_${Date.now()}.jpg`, { type: "image/jpeg" }));
  formData.append("folder", "avatars");
  const response = await fetch("/api/uploads/local", {
    method: "POST",
    credentials: "include",
    body: formData
  });
  const json = await response.json();
  if (!response.ok || !json?.success) {
    throw new Error(json?.error?.message || "Avatar upload failed.");
  }
  return json.data.fileUrl;
}

export function Profile() {
  const currentUser = store.state.user;
  const isCustomer = isCustomerRole(currentUser?.role);
  const isEmployee = isEmployeeRole(currentUser?.role);
  const isAdmin = isAdminRole(currentUser?.role);

  window.onMount = async () => {
    const logoutBtn = document.getElementById("logout-btn");
    const profileForm = document.getElementById("profile-form");
    const passwordForm = document.getElementById("password-form");
    const avatarInput = document.getElementById("avatar-file");
    const avatarPreview = document.getElementById("avatar-preview");
    const avatarImage = document.getElementById("avatar-crop-image");
    const zoomRange = document.getElementById("avatar-zoom");
    const saveAvatarBtn = document.getElementById("save-avatar-btn");
    const avatarField = document.getElementById("profile-avatar-url");
    const hrContainer = document.getElementById("hr-readonly");
    let sourceAvatarDataUrl = null;

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await store.logout();
        App.navigate("/login");
      });
    }

    try {
      const profile = await apiFetch("/profile");
      const user = profile.user;
      if (!user) return;
      store.setUser({ ...store.state.user, ...user });

      document.getElementById("profile-name").value = user.fullName || "";
      document.getElementById("profile-phone").value = user.phone || "";
      document.getElementById("profile-bio").value = user.bio || "";
      document.getElementById("profile-car-type").value = user.carType || "";
      document.getElementById("profile-location").value = user.location || "";
      document.getElementById("profile-avatar-url").value = user.avatarUrl || "";
      avatarPreview.innerHTML = user.avatarUrl
        ? `<img src="${user.avatarUrl}" class="w-20 h-20 rounded-full object-cover border border-border">`
        : `<div class="w-20 h-20 rounded-full bg-primary/10 text-primary text-3xl font-bold flex items-center justify-center border border-border">${(user.fullName || "U").charAt(0).toUpperCase()}</div>`;

      if (isAdmin) {
        document.getElementById("profile-lang").value = user.locale || "en";
        document.getElementById("profile-theme").value = user.theme || "system";
      }

      if (isEmployee && user.hr && hrContainer) {
        hrContainer.innerHTML = `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div class="rounded-lg border border-border p-3"><div class="text-muted uppercase">National ID</div><div class="font-semibold mt-1">${user.hr.nationalId}</div></div>
            <div class="rounded-lg border border-border p-3"><div class="text-muted uppercase">Birth Date</div><div class="font-semibold mt-1">${new Date(user.hr.birthDate).toLocaleDateString()}</div></div>
            <div class="rounded-lg border border-border p-3"><div class="text-muted uppercase">Job Title</div><div class="font-semibold mt-1">${user.hr.jobTitle}</div></div>
            <div class="rounded-lg border border-border p-3"><div class="text-muted uppercase">Permissions</div><div class="font-semibold mt-1">${(user.permissions || []).join(", ") || "-"}</div></div>
          </div>
        `;
      }
    } catch (error) {
      window.toast(error.message, "error");
    }

    avatarInput?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      sourceAvatarDataUrl = await toDataUrl(file);
      avatarImage.src = sourceAvatarDataUrl;
      avatarImage.classList.remove("hidden");
      saveAvatarBtn.disabled = false;
    });

    saveAvatarBtn?.addEventListener("click", async () => {
      if (!sourceAvatarDataUrl) return;

      try {
        const img = new Image();
        img.src = sourceAvatarDataUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        const zoom = Number(zoomRange.value || 1);
        const canvas = document.createElement("canvas");
        const size = 400;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, size, size);

        const minDimension = Math.min(img.width, img.height);
        const cropSize = Math.max(60, minDimension / zoom);
        const sx = (img.width - cropSize) / 2;
        const sy = (img.height - cropSize) / 2;
        ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, size, size);

        const blob = await canvasToBlob(canvas, "image/jpeg", 0.9);
        if (!blob) {
          throw new Error("Failed to crop avatar.");
        }

        const fileUrl = await uploadAvatar(blob);
        avatarField.value = fileUrl;
        avatarPreview.innerHTML = `<img src="${fileUrl}" class="w-20 h-20 rounded-full object-cover border border-border">`;
        window.toast("Avatar uploaded", "success");
      } catch (error) {
        window.toast(error.message, "error");
      }
    });

    profileForm?.addEventListener("submit", async (event) => {
      event.preventDefault();

      const payload = {
        action: "update_profile",
        fullName: document.getElementById("profile-name").value || undefined,
        avatarUrl: avatarField.value || undefined
      };

      if (isCustomer) {
        payload.bio = document.getElementById("profile-bio").value || null;
        payload.carType = document.getElementById("profile-car-type").value || null;
        payload.location = document.getElementById("profile-location").value || null;
      }

      if (isAdmin) {
        payload.locale = document.getElementById("profile-lang").value;
        payload.theme = document.getElementById("profile-theme").value;
      }

      try {
        await apiFetch("/profile", { method: "PATCH", body: payload });
        if (isAdmin && payload.theme) {
          store.setTheme(payload.theme);
        }
        if (isAdmin && payload.locale) {
          store.setLang(payload.locale);
        }
        window.toast("Profile updated", "success");
        await store.syncAuth();
        App.render();
      } catch (error) {
        window.toast(error.message, "error");
      }
    });

    passwordForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.target;
      try {
        await apiFetch("/profile", {
          method: "PATCH",
          body: {
            action: "change_password",
            oldPassword: form.oldPassword.value,
            newPassword: form.newPassword.value,
            confirmPassword: form.confirmPassword.value
          }
        });
        form.reset();
        window.toast("Password updated", "success");
      } catch (error) {
        window.toast(error.message, "error");
      }
    });
  };

  return `
    <div class="max-w-4xl mx-auto w-full flex flex-col gap-6">
      <div>
        <h1 class="text-3xl font-heading font-bold text-text">Profile</h1>
        <p class="text-muted mt-1">${
          isCustomer
            ? "Update your customer profile and account settings."
            : isEmployee
            ? "View HR information and manage your account security."
            : "Manage administrator profile and platform preferences."
        }</p>
      </div>

      <div class="bg-surface border border-border rounded-2xl p-6 space-y-6">
        <div class="flex items-center gap-4">
          <div id="avatar-preview"></div>
          <div class="flex-1">
            <div class="text-xs text-muted uppercase mb-2">Avatar</div>
            <input id="avatar-file" type="file" accept="image/*" class="text-xs">
            <div class="mt-3 flex items-center gap-3">
              <img id="avatar-crop-image" class="hidden w-20 h-20 rounded-lg object-cover border border-border" alt="crop">
              <div class="flex-1">
                <label class="text-xs text-muted uppercase">Zoom</label>
                <input id="avatar-zoom" type="range" min="1" max="3" step="0.1" value="1" class="w-full">
              </div>
              <button id="save-avatar-btn" type="button" class="px-3 py-2 rounded-lg border border-border text-sm hover:border-primary disabled:opacity-40" disabled>Crop + Upload</button>
            </div>
            <input id="profile-avatar-url" type="hidden">
          </div>
        </div>

        <form id="profile-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium mb-1">Full Name</label>
            <input id="profile-name" type="text" class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl">
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Phone</label>
            <input id="profile-phone" type="text" readonly class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl opacity-70 cursor-not-allowed">
          </div>

          <div class="${isCustomer ? "" : "hidden"}">
            <label class="block text-sm font-medium mb-1">Bio</label>
            <textarea id="profile-bio" rows="3" class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl"></textarea>
          </div>
          <div class="${isCustomer ? "" : "hidden"}">
            <label class="block text-sm font-medium mb-1">Car Type</label>
            <input id="profile-car-type" type="text" class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl">
          </div>
          <div class="${isCustomer ? "" : "hidden"} md:col-span-2">
            <label class="block text-sm font-medium mb-1">Location</label>
            <input id="profile-location" type="text" class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl">
          </div>

          <div class="${isAdmin ? "" : "hidden"}">
            <label class="block text-sm font-medium mb-1">Language</label>
            <select id="profile-lang" class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl">
              <option value="en">English</option>
              <option value="ar">Arabic</option>
            </select>
          </div>
          <div class="${isAdmin ? "" : "hidden"}">
            <label class="block text-sm font-medium mb-1">Theme</label>
            <select id="profile-theme" class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </select>
          </div>

          <div class="md:col-span-2">
            <button class="px-6 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover">Save Profile</button>
          </div>
        </form>
      </div>

      <div id="hr-readonly" class="${isEmployee ? "bg-surface border border-border rounded-2xl p-6" : "hidden"}">
        <h3 class="text-lg font-bold mb-3">HR Information (Read Only)</h3>
      </div>

      <div class="bg-surface border border-border rounded-2xl p-6">
        <h3 class="text-lg font-bold mb-4">Change Password</h3>
        <form id="password-form" class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input name="oldPassword" type="password" required placeholder="Old Password" class="px-4 py-2.5 bg-bg border border-border rounded-xl">
          <input name="newPassword" type="password" required placeholder="New Password" class="px-4 py-2.5 bg-bg border border-border rounded-xl">
          <input name="confirmPassword" type="password" required placeholder="Confirm Password" class="px-4 py-2.5 bg-bg border border-border rounded-xl">
          <button class="md:col-span-3 px-6 py-2.5 rounded-xl border border-border font-semibold hover:border-primary">Update Password</button>
        </form>
      </div>

      <div class="flex justify-end pt-2">
        <button id="logout-btn" class="px-6 py-3 bg-danger/10 text-danger hover:bg-danger hover:text-white rounded-xl font-bold transition-colors flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          ${t("common.logout")}
        </button>
      </div>
    </div>
  `;
}
