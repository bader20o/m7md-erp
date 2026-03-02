import { apiFetch, buildQuery } from "../../lib/api.js";
import { DateInput } from "../../components/ui/DateInput.js";
import { TableRowSkeleton } from "../../components/ui/Skeleton.js";
import { AlertModal, ConfirmActionModal, ConfirmKeywordModal, ConfirmModal } from "../../components/ui/Modal.js";
import { uploadLocalFile } from "../../lib/uploads.js";

const LOCAL_PHONE_REGEX = /^07\d{8}$/;
const CREATE_PERMISSIONS = ["accounting", "warehouse", "bookings", "hr", "memberships", "analytics", "services"];

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const dt = (value) => (value ? new Date(value).toLocaleString() : "Not available");
const d = (value) => (value ? new Date(value).toLocaleDateString() : "-");

const isZeroLike = (value) => ["0", "0.0", "0.00", "0 min", "0.0 min", "0.00 min"].includes(String(value ?? "").trim());
const formatIpAddress = (value) => (value && value !== "::1" ? value : "Not available");
const formatDeviceBrowser = (security) => (security?.device && security?.browser ? `${security.device} / ${security.browser}` : "Not available");
const formatSuspendedUntil = (value) => (value ? `Suspended until ${new Date(value).toLocaleDateString()}` : "Suspended");
const disableClass = "disabled:cursor-not-allowed disabled:opacity-50";

function getStatusMeta(item) {
  if (item.status === "BANNED") return { badge: toneBadge("BANNED", "danger"), detail: "Account permanently disabled.", tone: "text-danger" };
  if (item.status === "SUSPENDED") {
    return {
      badge: toneBadge("SUSPENDED", "warn"),
      detail: formatSuspendedUntil(item.suspendedUntil),
      tone: "text-amber-500"
    };
  }
  if (item.status === "ON_LEAVE") return { badge: toneBadge("ON_LEAVE", "info"), detail: "", tone: "text-blue-500" };
  return { badge: toneBadge("ACTIVE", "success"), detail: "", tone: "text-emerald-500" };
}

function normalizeKpiCards(performance) {
  const cards = performance?.cards || [];
  const hasRows = Boolean(performance?.rows?.length);
  return cards.map((card) => ({
    ...card,
    value: !hasRows && isZeroLike(card.value) ? "No data yet" : card.value
  }));
}

function avatarMarkup(name, url, small = false) {
  const cls = small ? "w-10 h-10 text-sm rounded-xl" : "w-20 h-20 text-3xl rounded-2xl";
  return url
    ? `<img src="${url}" alt="${esc(name || "Employee")}" class="${cls} border border-border object-cover">`
    : `<div class="${cls} border border-border bg-bg flex items-center justify-center font-bold text-primary">${esc((name || "E").charAt(0).toUpperCase())}</div>`;
}

function toneBadge(label, type) {
  const tone =
    type === "danger"
      ? "border-danger/30 bg-danger/10 text-danger"
      : type === "warn"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
        : type === "info"
          ? "border-blue-500/30 bg-blue-500/10 text-blue-500"
          : type === "success"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
            : "border-border bg-bg text-text";
  return `<span class="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${tone}">${esc(label)}</span>`;
}

function statusBadge(status) {
  if (status === "banned") return toneBadge("BANNED", "danger");
  if (status === "suspended") return toneBadge("SUSPENDED", "warn");
  if (status === "on_leave") return toneBadge("ON_LEAVE", "info");
  return toneBadge("ACTIVE", "success");
}

function roleBadge(role) {
  return toneBadge(role || "EMPLOYEE");
}

function kpiCard(card) {
  return `<div class="rounded-2xl border border-border px-4 py-4"><div class="text-xs uppercase tracking-wide text-muted">${esc(card.label)}</div><div class="mt-2 text-2xl font-semibold text-text">${esc(card.value)}</div></div>`;
}

function infoRow(label, value) {
  return `<div class="flex items-start justify-between gap-4 border-b border-border/70 py-3 last:border-b-0"><span class="text-xs uppercase tracking-wide text-muted">${label}</span><span class="text-sm text-right text-text">${esc(value || "-")}</span></div>`;
}

function actionButton(label, attrs = "", extraClass = "") {
  return `<button type="button" ${attrs} class="rounded-xl border border-border px-4 py-3 text-sm font-medium text-text hover:border-text ${disableClass} ${extraClass}">${label}</button>`;
}

export function AdminEmployees() {
  window.onMount = () => {
    const tbody = document.getElementById("employees-tbody");
    const pagination = document.getElementById("employees-pagination");
    const createForm = document.getElementById("employee-create-form");
    const createContainer = document.getElementById("employee-create-container");
    const warning = document.getElementById("employee-duplicate-warning");
    const state = { q: "", status: "", joinFrom: "", joinTo: "", page: 1, limit: 10, total: 0, loading: false, quickItem: null };

    const pickPermissions = (selector) => Array.from(document.querySelectorAll(selector)).filter((i) => i.checked).map((i) => i.value);
    const setPreview = (id, url, label) => {
      const node = document.getElementById(id);
      node.innerHTML = url ? `<img src="${url}" alt="${label}" class="h-full w-full object-cover">` : `<div class="flex h-full w-full items-center justify-center text-[10px] text-muted">No image</div>`;
    };

    async function loadEmployees() {
      if (state.loading) return;
      state.loading = true;
      tbody.innerHTML = TableRowSkeleton(6).repeat(5);
      try {
        const res = await apiFetch(`/admin/employees${buildQuery({ q: state.q, status: state.status, joinFrom: state.joinFrom, joinTo: state.joinTo, page: state.page, limit: state.limit })}`);
        state.total = res.total || 0;
        const items = res.items || [];
        tbody.innerHTML = items.length
          ? items
              .map(
                (item) => `
                  <tr class="border-b border-border text-center hover:bg-bg">
                    <td class="px-4 py-3 text-left">
                      <button type="button" data-open="${item.id}" class="flex w-full items-center gap-3 text-left">
                        ${avatarMarkup(item.fullName, item.avatar, true)}
                        <div>
                          <div class="text-sm font-semibold text-text">${esc(item.fullName || "Unnamed Employee")}</div>
                          <div class="text-xs text-muted">${esc(item.phone)}</div>
                        </div>
                      </button>
                    </td>
                    <td class="px-4 py-3 text-sm">${esc(item.phone)}</td>
                    <td class="px-4 py-3 text-sm">${roleBadge(item.roleProfile)}</td>
                    <td class="px-4 py-3 text-sm">${statusBadge(item.status)}</td>
                    <td class="px-4 py-3 text-sm">${d(item.joinedAt)}</td>
                    <td class="px-4 py-3 text-sm"><button type="button" data-open="${item.id}" class="font-semibold text-primary">View</button></td>
                  </tr>
                `
              )
              .join("")
          : `<tr><td colspan="6" class="py-12 text-center text-sm text-muted">No employees found.</td></tr>`;
      } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-sm text-danger">${esc(error.message)}</td></tr>`;
      } finally {
        state.loading = false;
        renderPagination();
      }
    }

    function renderPagination() {
      const pages = Math.max(1, Math.ceil(state.total / state.limit));
      pagination.innerHTML = `
        <div class="text-xs text-muted">Page ${state.page} of ${pages} (${state.total} employees)</div>
        <div class="flex items-center gap-2">
          <button id="employees-prev" class="rounded-xl border border-border px-3 py-2 text-sm ${state.page <= 1 ? "pointer-events-none opacity-50" : ""}">Prev</button>
          <button id="employees-next" class="rounded-xl border border-border px-3 py-2 text-sm ${state.page >= pages ? "pointer-events-none opacity-50" : ""}">Next</button>
        </div>
      `;
      pagination.querySelector("#employees-prev").addEventListener("click", () => { state.page -= 1; loadEmployees(); });
      pagination.querySelector("#employees-next").addEventListener("click", () => { state.page += 1; loadEmployees(); });
    }

    function renderQuickPanel() {
      const modal = document.getElementById("employee-quick-modal");
      const content = document.getElementById("employee-quick-content");
      if (!state.quickItem) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
        return;
      }
      const item = state.quickItem;
      const security = item.security || {};
      const statusMeta = getStatusMeta(item);
      const editingDisabled = item.status === "BANNED";
      const kpis = normalizeKpiCards(item.performance);
      const attendanceSnapshot = item.attendance?.snapshot || {};
      content.innerHTML = `
        <div class="space-y-6">
          <div class="flex flex-col gap-4 rounded-[24px] border border-border px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex items-start gap-4">
              ${avatarMarkup(item.fullName, item.avatar)}
              <div class="space-y-2">
                <div class="text-2xl font-semibold text-text">${esc(item.fullName || "Employee")}</div>
                <div class="text-sm text-muted">${esc(item.phone || "-")}</div>
                <div class="flex flex-wrap gap-2">${roleBadge(item.roleProfile)} ${statusMeta.badge}</div>
                ${statusMeta.detail ? `<div class="text-sm font-medium ${statusMeta.tone}">${esc(statusMeta.detail)}</div>` : ""}
              </div>
            </div>
            <div class="flex flex-wrap gap-3">
              ${item.status === "ACTIVE" ? actionButton("Suspend 1 day", `data-action="suspend" data-days="1" ${editingDisabled ? "disabled" : ""}`) : ""}
              ${item.status === "ACTIVE" ? actionButton("Suspend 7 days", `data-action="suspend" data-days="7" ${editingDisabled ? "disabled" : ""}`) : ""}
              ${item.status === "ACTIVE" ? actionButton("Suspend 30 days", `data-action="suspend" data-days="30" ${editingDisabled ? "disabled" : ""}`) : ""}
              ${item.status !== "ACTIVE" ? actionButton("Activate", `data-action="activate"`) : ""}
              ${actionButton("Ban", `data-action="ban" ${editingDisabled ? "disabled" : ""}`, "border-danger/30 text-danger hover:border-danger")}
            </div>
          </div>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3">${kpis.map(kpiCard).join("") || `<div class="rounded-2xl border border-border px-4 py-10 text-center text-sm text-muted md:col-span-3">No performance data available.</div>`}</div>
          <div class="rounded-[24px] border border-border px-6 py-6">
            <div class="mb-4 text-sm font-semibold text-text">Attendance Snapshot</div>
            ${
              attendanceSnapshot.lastCheckInAt || attendanceSnapshot.lastCheckOutAt
                ? `${infoRow("Last Check-in", dt(attendanceSnapshot.lastCheckInAt))}${infoRow("Last Check-out", dt(attendanceSnapshot.lastCheckOutAt))}`
                : `<div class="text-sm text-muted">No attendance records yet.</div>`
            }
          </div>
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div class="rounded-[24px] border border-border px-6 py-6">
              <div class="mb-4 text-sm font-semibold text-text">Security Snapshot</div>
              ${infoRow("Last login", dt(security.lastLoginAt))}
              ${infoRow("Last active", dt(security.lastActiveAt))}
              ${infoRow("Device / Browser", formatDeviceBrowser(security))}
              ${infoRow("IP address", formatIpAddress(security.ipAddress))}
            </div>
            <div class="rounded-[24px] border border-border px-6 py-6">
              <div class="mb-4 text-sm font-semibold text-text">Recent Activity</div>
              <div class="space-y-3">${(item.recentActivity || []).length ? item.recentActivity.map((entry) => `<div class="rounded-2xl border border-border px-4 py-3"><div class="text-sm font-medium text-text">${esc(entry.action)}</div><div class="text-xs text-muted">${dt(entry.createdAt)}</div></div>`).join("") : `<div class="text-sm text-muted">No recent activity.</div>`}</div>
            </div>
          </div>
          <div class="rounded-[24px] border border-border px-6 py-6">
            <div class="mb-4 text-sm font-semibold text-text">Actions</div>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              ${actionButton("Reset password", `data-action="reset_password" ${editingDisabled ? "disabled" : ""}`)}
              ${actionButton("Resend credentials", `data-action="resend_credentials" ${editingDisabled ? "disabled" : ""}`)}
              ${actionButton("Edit permissions", `data-open-tab="permissions" ${editingDisabled ? "disabled" : ""}`)}
              ${actionButton("Edit HR", `data-open-tab="hr" ${editingDisabled ? "disabled" : ""}`)}
              ${actionButton("Open Full Profile", `data-open-tab="profile"`)}
            </div>
            <div class="mt-4 text-xs text-muted">Suspend = temporary restriction. Ban = permanent disable until manually reactivated.</div>
          </div>
        </div>
      `;
      modal.classList.remove("hidden");
      modal.classList.add("flex");

      content.querySelectorAll("[data-open-tab]").forEach((button) =>
        button.addEventListener("click", () => {
          if (button.disabled) return;
          window.navigate(null, `/admin/profile?employeeId=${item.id}&tab=${button.dataset.openTab}`);
        })
      );
      content.querySelectorAll("[data-action]").forEach((button) =>
        button.addEventListener("click", () => {
          if (button.disabled) return;
          runQuickAction(item.id, button.dataset.action, button.dataset.days);
        })
      );
    }

    async function openQuickPanel(id) {
      document.getElementById("employee-quick-content").innerHTML = `<div class="py-16 text-center text-sm text-muted">Loading employee details...</div>`;
      document.getElementById("employee-quick-modal").classList.remove("hidden");
      document.getElementById("employee-quick-modal").classList.add("flex");
      try {
        state.quickItem = (await apiFetch(`/admin/employees/${id}`)).item;
        renderQuickPanel();
      } catch (error) {
        document.getElementById("employee-quick-content").innerHTML = `<div class="py-16 text-center text-sm text-danger">${esc(error.message)}</div>`;
      }
    }

    async function runQuickAction(id, action, days) {
      try {
        if (action === "ban") {
          const result = await ConfirmKeywordModal({
            title: "Ban Employee",
            message: "This employee account will be permanently disabled until manually reactivated.",
            warning: "This action permanently disables the account.",
            keyword: "BAN",
            inputLabel: "Type",
            confirmText: "Ban",
            cancelText: "Cancel",
            intent: "danger"
          });
          if (!result.confirmed) return;
          await apiFetch(`/admin/employees/${id}`, { method: "PATCH", body: { action } });
        } else if (action === "reset_password" || action === "resend_credentials") {
          const confirmed = await ConfirmModal({ title: action === "reset_password" ? "Reset Password" : "Resend Credentials", message: "A temporary password will be generated for this employee.", confirmText: "Continue", cancelText: "Cancel", intent: "primary" });
          if (!confirmed) return;
          const res = await apiFetch(`/admin/employees/${id}`, { method: "PATCH", body: { action } });
          if (res.temporaryPassword) await AlertModal({ title: "Temporary Password", message: res.temporaryPassword, intent: "success", confirmText: "Close" });
        } else if (action === "suspend") {
          const result = await ConfirmActionModal({ title: "Suspend Employee", message: `Suspend this employee for ${days} day(s)?`, notePlaceholder: "Suspension reason", confirmText: "Suspend", cancelText: "Cancel", intent: "danger" });
          if (!result.confirmed) return;
          await apiFetch(`/admin/employees/${id}`, { method: "PATCH", body: { action, durationDays: Number(days), reason: result.note || undefined } });
        } else {
          await apiFetch(`/admin/employees/${id}`, { method: "PATCH", body: { action } });
        }
        window.toast("Employee updated", "success");
        await loadEmployees();
        await openQuickPanel(id);
      } catch (error) {
        window.toast(error.message, "error");
      }
    }

    document.getElementById("employees-tbody").addEventListener("click", (event) => {
      const button = event.target.closest("[data-open]");
      if (!button) return;
      openQuickPanel(button.dataset.open);
    });
    document.getElementById("close-employee-quick").addEventListener("click", () => {
      state.quickItem = null;
      renderQuickPanel();
    });

    document.getElementById("employees-search").addEventListener("input", (event) => { state.q = event.target.value.trim(); state.page = 1; loadEmployees(); });
    document.getElementById("employees-status").addEventListener("change", (event) => { state.status = event.target.value; state.page = 1; loadEmployees(); });
    document.getElementById("employees-join-from").addEventListener("change", (event) => { state.joinFrom = event.target.value; state.page = 1; loadEmployees(); });
    document.getElementById("employees-join-to").addEventListener("change", (event) => { state.joinTo = event.target.value; state.page = 1; loadEmployees(); });

    document.getElementById("toggle-employee-create").addEventListener("click", () => {
      createContainer.classList.remove("hidden");
      createContainer.classList.add("flex");
    });
    window.closeEmployeeCreateModal = () => {
      createContainer.classList.add("hidden");
      createContainer.classList.remove("flex");
      createForm.reset();
      warning.classList.add("hidden");
      setPreview("employee-id-card-preview", "", "ID Card");
      setPreview("employee-profile-photo-preview", "", "Profile");
      document.getElementById("employee-id-card-url").value = "";
      document.getElementById("employee-profile-photo-url").value = "";
    };

    ["employee-id-card-file", "employee-profile-photo-file"].forEach((inputId) => {
      document.getElementById(inputId).addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          const folder = inputId.includes("id-card") ? "employee-id-cards" : "employee-profiles";
          const url = await uploadLocalFile(file, { folder });
          const hiddenId = inputId.includes("id-card") ? "employee-id-card-url" : "employee-profile-photo-url";
          const previewId = inputId.includes("id-card") ? "employee-id-card-preview" : "employee-profile-photo-preview";
          document.getElementById(hiddenId).value = url;
          setPreview(previewId, url, "Employee image");
          window.toast("Image uploaded", "success");
        } catch (error) {
          window.toast(error.message, "error");
        } finally {
          event.target.value = "";
        }
      });
    });

    createForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.target;
      if (!LOCAL_PHONE_REGEX.test(form.phone.value.trim())) return window.toast("Phone must start with 07 and contain 10 digits.", "error");
      if (!form.birthDate.value) return window.toast("Birth date is required.", "error");
      if (!document.getElementById("employee-id-card-url").value || !document.getElementById("employee-profile-photo-url").value) return window.toast("Choose ID card and profile images.", "error");
      try {
        await apiFetch("/admin/employees", {
          method: "POST",
          body: {
            fullName: form.fullName.value,
            phone: form.phone.value,
            nationalId: form.nationalId.value,
            birthDate: form.birthDate.value,
            jobTitle: form.jobTitle.value,
            idCardImageUrl: document.getElementById("employee-id-card-url").value,
            profilePhotoUrl: document.getElementById("employee-profile-photo-url").value,
            permissions: pickPermissions(".employee-permission-checkbox"),
            defaultSalaryInfo: { monthlyBase: form.monthlyBase.value ? Number(form.monthlyBase.value) : undefined },
            workSchedule: { text: form.workSchedule.value }
          }
        }).then(async (res) => {
          if (res?.item?.temporaryPassword) await AlertModal({ title: "Employee Created", message: res.item.temporaryPassword, intent: "success", confirmText: "Close" });
        });
        window.closeEmployeeCreateModal();
        window.toast("Employee created", "success");
        await loadEmployees();
      } catch (error) {
        window.toast(error.message, "error");
      }
    });

    loadEmployees();
    setPreview("employee-id-card-preview", "", "ID Card");
    setPreview("employee-profile-photo-preview", "", "Profile");
  };

  return `
    <div class="flex w-full flex-col gap-5">
      <div class="relative rounded-[24px] border border-border bg-surface px-6 py-6">
        <div class="text-center">
          <h1 class="text-2xl font-heading font-bold text-text">Employees</h1>
          <p class="mt-1 text-sm text-muted">Manage employees, account controls, permissions, and HR records.</p>
        </div>
        <div class="mt-4 flex justify-center md:absolute md:right-6 md:top-1/2 md:mt-0 md:-translate-y-1/2">
          <button id="toggle-employee-create" class="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white">Create Employee</button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 md:grid-cols-5">
        <input id="employees-search" placeholder="Search by name or phone" class="md:col-span-2 rounded-xl border border-border bg-surface px-4 py-3">
        <select id="employees-status" class="rounded-xl border border-border bg-surface px-4 py-3">
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
          <option value="on_leave">On leave</option>
        </select>
        <div>${DateInput({ id: "employees-join-from", className: "employee-date-input w-full rounded-xl border border-border bg-surface px-4 py-3" })}</div>
        <div>${DateInput({ id: "employees-join-to", className: "employee-date-input w-full rounded-xl border border-border bg-surface px-4 py-3" })}</div>
      </div>

      <div class="overflow-hidden rounded-[24px] border border-border bg-surface">
        <div class="overflow-auto">
          <table class="min-w-[960px] w-full text-left">
            <thead class="bg-bg">
              <tr>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted">Employee</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted">Phone</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted">Role</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted">Status</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted">Joined</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted">Action</th>
              </tr>
            </thead>
            <tbody id="employees-tbody"></tbody>
          </table>
        </div>
      </div>

      <div id="employees-pagination" class="flex items-center justify-between"></div>

      <div id="employee-create-container" class="fixed inset-0 z-[100] hidden items-center justify-center bg-black/50 px-4 py-10">
        <div class="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[24px] border border-border bg-surface px-6 py-6">
          <div class="mb-4 flex items-center justify-between">
            <h3 class="text-xl font-semibold text-text">Create Employee</h3>
            <button type="button" onclick="window.closeEmployeeCreateModal()" class="rounded-xl border border-border px-3 py-2 text-sm text-text">Close</button>
          </div>
          <form id="employee-create-form" class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input name="fullName" required placeholder="Full Name (4 parts)" class="rounded-xl border border-border bg-bg px-4 py-3">
            <input name="phone" required maxlength="10" placeholder="07XXXXXXXX" class="rounded-xl border border-border bg-bg px-4 py-3">
            <input name="nationalId" required placeholder="National ID" class="rounded-xl border border-border bg-bg px-4 py-3">
            ${DateInput({ id: "employee-birthdate", name: "birthDate", className: "employee-date-input w-full rounded-xl border border-border bg-bg px-4 py-3" })}
            <input name="jobTitle" required placeholder="Job Title" class="rounded-xl border border-border bg-bg px-4 py-3">
            <input name="monthlyBase" type="number" step="0.01" placeholder="Default Salary Monthly Base" class="rounded-xl border border-border bg-bg px-4 py-3">
            <div class="rounded-2xl border border-border bg-bg px-4 py-4">
              <div class="mb-3 text-xs uppercase tracking-wide text-muted">ID Card Image</div>
              <input id="employee-id-card-file" type="file" accept="image/*" class="hidden">
              <input id="employee-id-card-url" type="hidden">
              <label for="employee-id-card-file" class="inline-flex cursor-pointer rounded-xl border border-border px-4 py-2 text-sm font-medium text-text">Choose file</label>
              <div id="employee-id-card-preview" class="mt-3 h-20 w-20 overflow-hidden rounded-xl border border-border bg-surface"></div>
            </div>
            <div class="rounded-2xl border border-border bg-bg px-4 py-4">
              <div class="mb-3 text-xs uppercase tracking-wide text-muted">Profile Photo</div>
              <input id="employee-profile-photo-file" type="file" accept="image/*" class="hidden">
              <input id="employee-profile-photo-url" type="hidden">
              <label for="employee-profile-photo-file" class="inline-flex cursor-pointer rounded-xl border border-border px-4 py-2 text-sm font-medium text-text">Choose file</label>
              <div id="employee-profile-photo-preview" class="mt-3 h-20 w-20 overflow-hidden rounded-xl border border-border bg-surface"></div>
            </div>
            <input name="workSchedule" placeholder="Work Schedule" class="md:col-span-2 rounded-xl border border-border bg-bg px-4 py-3">
            <div class="md:col-span-2 rounded-2xl border border-border bg-bg px-4 py-4">
              <div class="mb-3 text-xs uppercase tracking-wide text-muted">Initial permissions</div>
              <div class="grid grid-cols-2 gap-3 md:grid-cols-4">${CREATE_PERMISSIONS.map((p) => `<label class="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-text"><input type="checkbox" value="${p}" class="employee-permission-checkbox h-4 w-4 rounded border-border bg-bg text-primary"><span>${p}</span></label>`).join("")}</div>
            </div>
            <div id="employee-duplicate-warning" class="hidden md:col-span-2 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger"></div>
            <div class="md:col-span-2 flex justify-end gap-3">
              <button type="button" onclick="window.closeEmployeeCreateModal()" class="rounded-xl border border-border px-4 py-3 text-sm font-medium text-text">Cancel</button>
              <button class="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white">Save Employee</button>
            </div>
          </form>
        </div>
      </div>

      <div id="employee-quick-modal" class="fixed inset-0 z-[90] hidden items-center justify-center bg-black/50 px-4 py-10">
        <div class="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-[28px] border border-border bg-surface px-6 py-6">
          <div class="mb-4 flex items-center justify-between">
            <div>
              <h3 class="text-xl font-semibold text-text">Quick Employee Control Panel</h3>
              <p class="mt-1 text-sm text-muted">Security, performance, and account actions in one place.</p>
            </div>
            <button id="close-employee-quick" type="button" class="rounded-xl border border-border px-3 py-2 text-sm text-text">Close</button>
          </div>
          <div id="employee-quick-content"></div>
        </div>
      </div>
    </div>
  `;
}
