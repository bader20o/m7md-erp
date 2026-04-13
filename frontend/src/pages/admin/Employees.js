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
const formatDepartmentLabel = (value) => String(value || "").replaceAll("_", " ") || "Not assigned";
const formatEmploymentType = (value) => String(value || "").replaceAll("_", " ") || "Not specified";
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
    value: !hasRows && isZeroLike(card.value) ? "Awaiting tracked work data" : card.value
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
    const summaryChips = document.getElementById("employees-summary-chips");
    const createForm = document.getElementById("employee-create-form");
    const createContainer = document.getElementById("employee-create-container");
    const warning = document.getElementById("employee-duplicate-warning");
    const state = { q: "", status: "", joinFrom: "", joinTo: "", page: 1, limit: 10, total: 0, loading: false, quickItem: null };

    const pickPermissions = (selector) => Array.from(document.querySelectorAll(selector)).filter((i) => i.checked).map((i) => i.value);
    const setPreview = (id, url, label) => {
      const node = document.getElementById(id);
      node.innerHTML = url ? `<img src="${url}" alt="${label}" class="h-full w-full object-cover">` : `<div class="flex h-full w-full items-center justify-center text-[10px] text-muted">No image</div>`;
    };
    const normalizeStatus = (value) => String(value || "").toUpperCase();
    const normalizeRole = (value) => String(value || "").toUpperCase();

    function renderSummaryChips(items = [], summary = {}) {
      const active = Number(summary.active ?? items.filter((i) => normalizeStatus(i.status) === "ACTIVE").length);
      const suspended = Number(summary.suspended ?? items.filter((i) => normalizeStatus(i.status) === "SUSPENDED").length);
      const managerCount = Number(summary.managers ?? summary.manager ?? items.filter((i) => normalizeRole(i.roleProfile).includes("MANAGER")).length);
      const technicianCount = Number(summary.technicians ?? summary.technician ?? items.filter((i) => normalizeRole(i.roleProfile).includes("TECHNICIAN")).length);
      const receptionCount = Number(summary.reception ?? items.filter((i) => normalizeRole(i.roleProfile).includes("RECEPTION")).length);

      summaryChips.innerHTML = `
        <div class="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-bg/30 px-3 py-2 text-xs">
          <span class="text-muted uppercase tracking-wider">Total employees</span>
          <span class="font-semibold text-text tabular-nums">${state.total}</span>
        </div>
        <div class="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-500">
          <span class="uppercase tracking-wider">Active</span>
          <span class="font-semibold tabular-nums">${active}</span>
        </div>
        <div class="inline-flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
          <span class="uppercase tracking-wider">Suspended</span>
          <span class="font-semibold tabular-nums">${suspended}</span>
        </div>
        <div class="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-bg/30 px-3 py-2 text-xs">
          <span class="text-muted uppercase tracking-wider">Managers</span>
          <span class="font-semibold text-text tabular-nums">${managerCount}</span>
        </div>
        <div class="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-bg/30 px-3 py-2 text-xs">
          <span class="text-muted uppercase tracking-wider">Technicians</span>
          <span class="font-semibold text-text tabular-nums">${technicianCount}</span>
        </div>
        <div class="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-bg/30 px-3 py-2 text-xs">
          <span class="text-muted uppercase tracking-wider">Reception</span>
          <span class="font-semibold text-text tabular-nums">${receptionCount}</span>
        </div>
      `;
    }

    async function loadEmployees() {
      if (state.loading) return;
      state.loading = true;
      tbody.innerHTML = TableRowSkeleton(6).repeat(5);
      try {
        const res = await apiFetch(`/admin/employees${buildQuery({ q: state.q, status: state.status, joinFrom: state.joinFrom, joinTo: state.joinTo, page: state.page, limit: state.limit })}`);
        state.total = res.total || 0;
        const items = res.items || [];
        renderSummaryChips(items, res.summary || res.stats || {});
        tbody.innerHTML = items.length
          ? items
              .map(
                (item) => `
                  <tr class="border-b border-white/10 text-left transition-colors hover:bg-slate-800/45">
                    <td class="px-4 py-3.5">
                      <button type="button" data-open="${item.id}" class="flex w-full items-center gap-3.5 text-left">
                        ${avatarMarkup(item.fullName, item.avatar, true)}
                        <div>
                          <div class="text-sm font-semibold text-text leading-tight">${esc(item.fullName || "Unnamed Employee")}</div>
                          <div class="text-xs text-muted mt-1">${esc(item.phone)}</div>
                        </div>
                      </button>
                    </td>
                    <td class="px-4 py-3.5 text-sm text-muted">${esc(item.phone)}</td>
                    <td class="px-4 py-3.5 text-sm">${roleBadge(item.roleProfile)}</td>
                    <td class="px-4 py-3.5 text-sm">${statusBadge(item.status)}</td>
                    <td class="px-4 py-3.5 text-sm whitespace-nowrap text-muted">${d(item.joinedAt)}</td>
                    <td class="px-4 py-3.5 text-sm text-right"><button type="button" data-open="${item.id}" class="inline-flex rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 font-semibold text-primary">View</button></td>
                  </tr>
                `
              )
              .join("")
          : `<tr><td colspan="6" class="py-12 text-center text-sm text-muted">No employees found.</td></tr>`;
      } catch (error) {
        summaryChips.innerHTML = "";
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
      const department = item.profile?.department || item.department || "Not assigned";
      const employmentType = item.profile?.employmentType || item.employmentType || "Not specified";
      const employeeCode = item.employeeCode || item.employeeId || item.id;
      const taskList = item.tasks || item.assignedTasks || [];
      const lastTaskLabel = item.currentTask?.title || item.lastTask?.title || taskList?.[0]?.title || "No assigned tasks";
      const workloadOpen = item.workload?.openTasks ?? item.taskStats?.pending ?? item.openTasks ?? null;
      const payrollStatus = item.hr?.lastPayrollStatus || item.payroll?.status || item.lastPayrollStatus || "Not available";
      const payrollUpdatedAt = item.hr?.lastPayrollUpdatedAt || item.payroll?.updatedAt || null;
      const alerts = [
        item.status === "SUSPENDED" ? formatSuspendedUntil(item.suspendedUntil) : "",
        item.status === "BANNED" ? "Account is banned and restricted from operational access." : "",
        security?.lastLoginAt ? "" : "No login recorded yet.",
        attendanceSnapshot.lastCheckInAt ? "" : "No recent attendance check-in found."
      ].filter(Boolean);
      content.innerHTML = `
        <div class="space-y-4">
          <div class="rounded-2xl border border-white/10 px-4 py-4">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div class="flex items-start gap-3">
                ${avatarMarkup(item.fullName, item.avatar)}
                <div class="space-y-1.5">
                  <div class="text-xl font-semibold text-text">${esc(item.fullName || "Employee")}</div>
                  <div class="text-sm text-muted">${esc(item.phone || "-")}</div>
                  <div class="flex flex-wrap gap-2">${roleBadge(item.roleProfile)} ${statusMeta.badge}</div>
                  <div class="grid grid-cols-1 gap-1 text-xs text-muted sm:grid-cols-2">
                    <div>Employee ID: <span class="text-text font-mono">${esc(employeeCode)}</span></div>
                    <div>Department: <span class="text-text">${esc(formatDepartmentLabel(department))}</span></div>
                    <div>Employment: <span class="text-text">${esc(formatEmploymentType(employmentType))}</span></div>
                    <div>Last task: <span class="text-text">${esc(lastTaskLabel)}</span></div>
                  </div>
                  ${workloadOpen != null ? `<div class="text-xs text-muted">Current workload: <span class="text-text font-semibold">${esc(String(workloadOpen))} open task(s)</span></div>` : ""}
                  <div class="text-xs text-muted">Last payroll status: <span class="text-text">${esc(payrollStatus)}</span>${payrollUpdatedAt ? ` <span class="text-muted">(${esc(d(payrollUpdatedAt))})</span>` : ""}</div>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2 lg:w-[19rem]">
                ${item.status === "ACTIVE" ? actionButton("Suspend 1 day", `data-action="suspend" data-days="1" ${editingDisabled ? "disabled" : ""}`) : ""}
                ${item.status === "ACTIVE" ? actionButton("Suspend 7 days", `data-action="suspend" data-days="7" ${editingDisabled ? "disabled" : ""}`) : ""}
                ${item.status === "ACTIVE" ? actionButton("Suspend 30 days", `data-action="suspend" data-days="30" ${editingDisabled ? "disabled" : ""}`) : ""}
                ${item.status !== "ACTIVE" ? actionButton("Activate", `data-action="activate"`) : ""}
                ${actionButton("Ban", `data-action="ban" ${editingDisabled ? "disabled" : ""}`, "border-danger/30 text-danger hover:border-danger col-span-2")}
              </div>
            </div>
            ${statusMeta.detail ? `<div class="mt-3 text-sm font-medium ${statusMeta.tone}">${esc(statusMeta.detail)}</div>` : ""}
          </div>

          <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
            ${
              kpis.length
                ? kpis
                    .map((card) => `<div class="rounded-xl border border-white/10 bg-bg/30 px-3 py-3"><div class="text-[10px] uppercase tracking-wide text-muted">${esc(card.label)}</div><div class="mt-1 text-lg font-semibold text-text tabular-nums">${esc(card.value)}</div></div>`)
                    .join("")
                : `<div class="rounded-xl border border-white/10 px-4 py-8 text-center text-sm text-muted md:col-span-4">Performance KPIs will appear here once this employee starts receiving tracked assignments.</div>`
            }
          </div>

          ${
            alerts.length
              ? `<div class="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3"><div class="mb-2 text-xs uppercase tracking-wide text-amber-500">Operational Alerts</div>${alerts.map((a) => `<div class="text-sm text-amber-500 py-1">${esc(a)}</div>`).join("")}</div>`
              : `<div class="rounded-2xl border border-white/10 bg-bg/30 px-4 py-3 text-sm text-muted">No account risks are currently flagged for this employee.</div>`
          }

          <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div class="rounded-2xl border border-white/10 px-4 py-4">
              <div class="mb-3 text-sm font-semibold text-text">Attendance Snapshot</div>
              ${
                attendanceSnapshot.lastCheckInAt || attendanceSnapshot.lastCheckOutAt
                  ? `${infoRow("Last Check-in", dt(attendanceSnapshot.lastCheckInAt))}${infoRow("Last Check-out", dt(attendanceSnapshot.lastCheckOutAt))}`
                  : `<div class="text-sm text-muted">Attendance check-ins and check-outs will appear here once this employee starts scanning attendance.</div>`
              }
            </div>
            <div class="rounded-2xl border border-white/10 px-4 py-4">
              <div class="mb-3 text-sm font-semibold text-text">Security Snapshot</div>
              ${infoRow("Last login", dt(security.lastLoginAt))}
              ${infoRow("Last active", dt(security.lastActiveAt))}
              ${infoRow("Device / Browser", formatDeviceBrowser(security))}
              ${infoRow("IP address", formatIpAddress(security.ipAddress))}
            </div>
          </div>

          <div class="rounded-2xl border border-white/10 px-4 py-4">
            <div class="mb-3 text-sm font-semibold text-text">Recent Activity</div>
            <div class="space-y-2">${
              (item.recentActivity || []).length
                ? item.recentActivity
                    .slice(0, 5)
                    .map(
                      (entry) => `<div class="rounded-xl border border-white/10 px-3 py-2"><div class="text-sm font-medium text-text">${esc(entry.action)}</div><div class="text-xs text-muted">${dt(entry.createdAt)}</div></div>`
                    )
                    .join("")
                : `<div class="text-sm text-muted">Recent account and admin events will appear here as operational activity is recorded.</div>`
            }</div>
          </div>

          <div class="rounded-2xl border border-white/10 px-4 py-4">
            <div class="mb-3 text-sm font-semibold text-text">Actions</div>
            <div class="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              ${actionButton("Reset password", `data-action="reset_password" ${editingDisabled ? "disabled" : ""}`)}
              ${actionButton("Resend credentials", `data-action="resend_credentials" ${editingDisabled ? "disabled" : ""}`)}
              ${actionButton("Edit permissions", `data-open-tab="permissions" ${editingDisabled ? "disabled" : ""}`)}
              ${actionButton("Edit HR", `data-open-tab="hr" ${editingDisabled ? "disabled" : ""}`)}
              ${actionButton("Open Full Profile", `data-open-tab="profile"`)}
            </div>
            <div class="mt-3 text-xs text-muted">Suspend is temporary access restriction. Ban disables the account until manual reactivation.</div>
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
        <input id="employees-search" placeholder="Search by name or phone" class="md:col-span-2 h-11 rounded-xl border border-white/10 bg-surface px-4 text-sm">
        <select id="employees-status" class="h-11 rounded-xl border border-white/10 bg-surface px-4 text-sm">
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
          <option value="on_leave">On leave</option>
        </select>
        <div>${DateInput({ id: "employees-join-from", className: "employee-date-input h-11 w-full rounded-xl border border-white/10 bg-surface px-4 text-sm" })}</div>
        <div>${DateInput({ id: "employees-join-to", className: "employee-date-input h-11 w-full rounded-xl border border-white/10 bg-surface px-4 text-sm" })}</div>
      </div>

      <div id="employees-summary-chips" class="flex flex-wrap gap-2"></div>

      <div class="overflow-hidden rounded-[24px] border border-border bg-surface">
        <div class="overflow-auto">
          <table class="min-w-[960px] w-full text-left">
            <thead class="bg-bg border-b border-white/10">
              <tr>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted w-[34%]">Employee</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted w-[18%]">Phone</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted w-[16%]">Role</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted w-[16%]">Status</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted w-[10%]">Joined</th>
                <th class="px-4 py-3 text-xs uppercase tracking-wide text-muted text-right w-[6%]">Action</th>
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
        <div class="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-[28px] border border-white/10 bg-surface px-5 py-5">
          <div class="mb-3 flex items-center justify-between">
            <div>
              <h3 class="text-xl font-semibold text-text">Quick Employee Control Panel</h3>
              <p class="mt-1 text-xs text-muted">Operations snapshot, risks, and account controls.</p>
            </div>
            <button id="close-employee-quick" type="button" class="rounded-xl border border-white/10 px-3 py-2 text-sm text-text">Close</button>
          </div>
          <div id="employee-quick-content"></div>
        </div>
      </div>
    </div>
  `;
}
