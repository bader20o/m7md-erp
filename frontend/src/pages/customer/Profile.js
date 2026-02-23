import { t } from "../../lib/i18n.js";
import { apiFetch } from "../../lib/api.js";
import { openImageCropper } from "../../components/ui/ImageCropper.js";
import { isAdminRole, isCustomerRole, isEmployeeRole } from "../../lib/roles.js";
import { store } from "../../lib/store.js";
import { uploadLocalFile } from "../../lib/uploads.js";

function avatarPreviewMarkup(fullName, avatarUrl) {
  if (avatarUrl) {
    return `<img src="${avatarUrl}" class="w-20 h-20 rounded-full object-cover border border-border" alt="Avatar">`;
  }

  return `<div class="w-20 h-20 rounded-full bg-primary/10 text-primary text-3xl font-bold flex items-center justify-center border border-border">${(fullName || "U").charAt(0).toUpperCase()}</div>`;
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
    const avatarHint = document.getElementById("avatar-upload-hint");
    const avatarField = document.getElementById("profile-avatar-url");
    const hrContainer = document.getElementById("hr-readonly");

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
      avatarPreview.innerHTML = avatarPreviewMarkup(user.fullName, user.avatarUrl);

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

      try {
        if (avatarHint) avatarHint.textContent = "Cropping image...";
        const croppedBlob = await openImageCropper({
          file,
          title: "Crop avatar",
          aspectRatio: 1,
          outputType: "image/jpeg",
          outputSize: 640
        });
        if (!croppedBlob) {
          if (avatarHint) avatarHint.textContent = "Upload cancelled.";
          return;
        }

        if (avatarHint) avatarHint.textContent = "Uploading image...";
        const uploadFile = new File([croppedBlob], `avatar_${Date.now()}.jpg`, {
          type: croppedBlob.type || "image/jpeg"
        });
        const fileUrl = await uploadLocalFile(uploadFile, { folder: "avatars" });

        avatarField.value = fileUrl;
        avatarPreview.innerHTML = avatarPreviewMarkup(
          document.getElementById("profile-name").value || store.state.user?.fullName,
          fileUrl
        );

        await apiFetch("/profile", {
          method: "PATCH",
          body: {
            action: "update_profile",
            avatarUrl: fileUrl
          }
        });

        await store.syncAuth();
        if (avatarHint) avatarHint.textContent = "Avatar updated.";
        window.toast("Avatar updated.", "success");
        await App.render();
      } catch (error) {
        if (avatarHint) avatarHint.textContent = "Upload failed.";
        window.toast(error.message, "error");
      } finally {
        event.target.value = "";
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
            <input id="avatar-file" type="file" accept="image/*" class="hidden">
            <div class="flex items-center gap-3">
              <label for="avatar-file" class="inline-flex items-center px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:border-primary hover:text-primary cursor-pointer transition-colors">Choose File</label>
              <div id="avatar-upload-hint" class="text-xs text-muted">Selecting an image opens cropper before upload.</div>
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
