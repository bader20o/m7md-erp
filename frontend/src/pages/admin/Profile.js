import { apiFetch, buildQuery } from "../../lib/api.js";
import { openImageCropper } from "../../components/ui/ImageCropper.js";
import { uploadLocalFile } from "../../lib/uploads.js";
import { isAdminRole, isEmployeeRole } from "../../lib/roles.js";
import { store } from "../../lib/store.js";
import { ConfirmModal, AlertModal, Modal } from "../../components/ui/Modal.js";
import { Profile as LegacyProfile } from "../customer/Profile.js";

const PHONE_REGEX = /^07\d{8}$/;
const DEPARTMENTS = [
  ["OPERATIONS", "Operations"],
  ["HR", "HR"],
  ["FINANCE", "Finance"],
  ["FRONT_DESK", "Front Desk"],
  ["TECHNICAL_SERVICE", "Technical Service"],
  ["INVENTORY", "Inventory"],
  ["CUSTOMER_SUPPORT", "Customer Support"]
];

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const dt = (value) => (value ? new Date(value).toLocaleString() : "Not available");
const d = (value) => (value ? new Date(value).toLocaleDateString() : "Not available");
const isZeroLike = (value) => ["0", "0.0", "0.00", "0 min", "0.0 min", "0.00 min"].includes(String(value ?? "").trim());
const formatDepartmentLabel = (value) => DEPARTMENTS.find(([key]) => key === value)?.[1] || value || "Not assigned";
const formatEmploymentType = (value) => String(value || "").replaceAll("_", " ");
const formatIpAddress = (value) => (value && value !== "::1" ? value : "Not available");
const formatDeviceBrowser = (security) => (security?.device && security?.browser ? `${security.device} / ${security.browser}` : "Not available");
const timeAgo = (dateStr) => {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
};

const sparklineSvg = (trend) => {
  const isUp = trend >= 0;
  const strokeColor = isUp ? "stroke-emerald-500" : "stroke-danger";
  const path = isUp ? "M0 20 L 10 15 L 20 18 L 30 10 L 40 12 L 50 2" : "M0 5 L 10 10 L 20 8 L 30 15 L 40 12 L 50 20";
  return `<svg class="w-16 h-8 ${strokeColor} opacity-70" fill="none" viewBox="0 0 50 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));"><path d="${path}" /></svg>`;
};

const emptyAttendance = { snapshot: { lastCheckInAt: null, lastCheckOutAt: null }, log: [], monthlySummary: null };

function getStatusTone(status) {
  if (status === "BANNED") return "border-danger/30 bg-danger/10 text-danger";
  if (status === "SUSPENDED") return "border-amber-500/30 bg-amber-500/10 text-amber-500";
  if (status === "ON_LEAVE") return "border-blue-500/30 bg-blue-500/10 text-blue-500";
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-500";
}

function getStatusBanner(item) {
  if (item.status === "BANNED") {
    return `<div class="rounded-2xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">This employee is banned. Profile fields are read-only while the account remains disabled.</div>`;
  }
  if (item.status === "SUSPENDED") {
    return `<div class="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">${esc(item.suspendedUntil ? `Suspended until ${d(item.suspendedUntil)}.` : "This employee is suspended.")}</div>`;
  }
  return "";
}

function renderFieldError(errors, field) {
  return errors?.[field] ? `<div class="mt-1 text-xs text-danger">${esc(errors[field])}</div>` : "";
}

function badge(label, tone = "border-border bg-bg text-text") {
  return `<span class="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${tone}">${esc(label)}</span>`;
}

function avatar(name, url, size = "w-24 h-24 text-3xl") {
  return url
    ? `<img src="${url}" alt="${esc(name || "Employee")}" class="${size} rounded-2xl border border-border object-cover">`
    : `<div class="${size} rounded-2xl border border-border bg-bg flex items-center justify-center font-bold text-primary">${esc((name || "E").charAt(0).toUpperCase())}</div>`;
}

function normalizeSelf(res) {
  const hr = res.user.hr || {};
  return {
    id: hr.id,
    fullName: res.user.fullName,
    phone: res.user.phone,
    joinedAt: res.user.joinedAt,
    roleProfile: hr.roleProfile || "EMPLOYEE",
    status: hr.employmentStatus || "ACTIVE",
    suspendedUntil: hr.suspendedUntil || null,
    bannedUntil: hr.bannedUntil || null,
    avatar: hr.profilePhotoUrl || res.user.avatarUrl,
    profile: {
      avatar: hr.profilePhotoUrl || res.user.avatarUrl,
      fullName: res.user.fullName,
      phone: res.user.phone,
      jobTitle: hr.jobTitle || "",
      department: hr.department || "",
      employmentType: hr.employmentType || "FULL_TIME",
      startDate: hr.startDate || "",
      emergencyContact: hr.emergencyContact || "",
      address: hr.address || "",
      status: hr.employmentStatus || "ACTIVE"
    },
    permissions: {
      roleProfile: hr.roleProfile || "EMPLOYEE",
      overrides: hr.permissionOverrides || {},
      legacyPermissions: res.user.permissions || []
    },
    performance: hr.performance || { cards: [], rows: [] },
    security: hr.security || {},
    recentActivity: hr.recentActivity || [],
    activityLog: hr.activityLog || [],
    sessions: hr.sessions || [],
    attendance: hr.attendance || emptyAttendance,
    hr: {
      salary: hr.salary ?? "",
      paymentFrequency: hr.paymentFrequency || "",
      leaveBalance: hr.leaveBalance || { annual: 0, sick: 0 },
      bonusHistory: hr.bonusHistory || [],
      deductions: hr.deductions || [],
      internalNotes: hr.internalNotes || ""
    }
  };
}

function renderRows(items, empty) {
  if (!items?.length) return `<div class="text-sm text-muted">${empty}</div>`;
  return `<div class="relative border-l-2 border-border/50 pl-6 py-2 ml-4 space-y-6">` + items
    .map(
      (item) => {
        const actionStr = String(item.action).toLowerCase();
        const isRisky = actionStr.includes("force") || actionStr.includes("banned") || actionStr.includes("suspended") || actionStr.includes("reset");
        const dotColor = isRisky ? 'border-danger bg-surface' : 'border-primary bg-surface';
        const textColor = isRisky ? 'text-danger' : 'text-text';
        return `
        <div class="relative transition-all duration-300 hover:scale-[1.01]">
          <div class="absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 ${dotColor} shadow-sm z-10"></div>
          <div class="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm hover:border-text transition-all group">
            <div>
              <div class="text-sm font-bold ${textColor}">${esc(item.action)}</div>
              <div class="text-xs text-muted opacity-80 mt-0.5">${esc(item.entity || formatIpAddress(item.ipAddress))}</div>
            </div>
            <div class="text-xs text-muted font-semibold bg-bg px-2 py-1 rounded-lg">${timeAgo(item.createdAt)}</div>
          </div>
        </div>
      `
      }
    )
    .join("") + `</div>`;
}

function normalizePerformance(performance) {
  const hasRows = Boolean(performance?.rows?.length);
  return {
    cards: (performance?.cards || []).map((card) => ({
      ...card,
      value: !hasRows && isZeroLike(card.value) ? "No data yet" : card.value
    })),
    rows: performance?.rows || []
  };
}

function renderTable(rows, emptyMessage = "No activity in this range.") {
  if (!rows?.length) return `<div class="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">${emptyMessage}</div>`;
  const headers = Object.keys(rows[0]);
  return `
    <div class="overflow-auto rounded-2xl border border-border">
      <table class="min-w-full text-sm">
        <thead class="bg-bg"><tr>${headers.map((h) => `<th class="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted">${esc(h)}</th>`).join("")}</tr></thead>
        <tbody>${rows
      .map(
        (row) => `<tr class="border-t border-border">${headers
          .map((h) => `<td class="px-4 py-3 text-text">${esc(h.toLowerCase().includes("date") || h.toLowerCase().includes("time") ? dt(row[h]) : row[h] ?? "Not available")}</td>`)
          .join("")}</tr>`
      )
      .join("")}</tbody>
      </table>
    </div>
  `;
}

function renderAttendanceTable(log) {
  const heatmapDays = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const hasLog = log?.some(r => r.date === dateStr || (r.time && String(r.time).startsWith(dateStr)));
    return { date: dateStr, present: hasLog };
  });

  const heatmapHtml = `
    <div class="mb-6 rounded-[24px] border border-border bg-surface p-6 shadow-sm">
      <div class="mb-4 flex items-center justify-between">
        <span class="text-xs font-bold uppercase tracking-widest text-muted">30-Day Heatmap</span>
        <div class="flex gap-4">
           <span class="flex items-center gap-1.5 text-xs font-medium text-text"><div class="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm"></div> Present</span>
           <span class="flex items-center gap-1.5 text-xs font-medium text-text"><div class="h-2.5 w-2.5 rounded-full bg-danger/20 shadow-sm"></div> Absent</span>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        ${heatmapDays.map(d => `<div class="h-8 w-8 rounded-xl ${d.present ? 'bg-emerald-500 shadow-sm border border-emerald-600/20' : 'bg-danger/10 border border-danger/20'} transition-all duration-300 hover:scale-[1.15] hover:shadow-md cursor-pointer" title="${d.date}"></div>`).join("")}
      </div>
    </div>
  `;

  if (!log?.length) {
    return heatmapHtml + `<div class="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">No attendance records yet.</div>`;
  }
  return heatmapHtml + `
    <div class="overflow-auto rounded-[24px] border border-border bg-surface shadow-sm">
      <table class="min-w-full text-sm">
        <thead class="bg-bg">
          <tr>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted">Date</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted">Action</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted">Time</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted">Source</th>
            <th class="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted">IP</th>
          </tr>
        </thead>
        <tbody>
          ${log
      .map(
        (row) => `
                <tr class="border-t border-border">
                  <td class="px-4 py-3 text-text">${esc(d(row.time || row.date))}</td>
                  <td class="px-4 py-3 text-text">${esc(row.action)}</td>
                  <td class="px-4 py-3 text-text">${esc(dt(row.time))}</td>
                  <td class="px-4 py-3 text-text">${esc(row.source || "Not available")}</td>
                  <td class="px-4 py-3 text-text">${esc(formatIpAddress(row.ipAddress))}</td>
                </tr>
              `
      )
      .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function getProfileSnapshot(item) {
  return JSON.stringify({
    fullName: item.profile.fullName || "",
    phone: item.profile.phone || "",
    jobTitle: item.profile.jobTitle || "",
    department: item.profile.department || "",
    employmentType: item.profile.employmentType || "FULL_TIME",
    startDate: item.profile.startDate ? item.profile.startDate.slice(0, 10) : "",
    status: item.profile.status || "ACTIVE",
    emergencyContact: item.profile.emergencyContact || "",
    address: item.profile.address || "",
    avatarUrl: item.profile.avatar || ""
  });
}

function getPermissionsSnapshot(item) {
  return JSON.stringify({
    roleProfile: item.permissions.roleProfile,
    ...item.permissions.overrides
  });
}

function getHrSnapshot(item) {
  const leave = item.hr.leaveBalance || { annual: 0, sick: 0 };
  return JSON.stringify({
    salary: item.hr.salary ?? "",
    paymentFrequency: item.hr.paymentFrequency || "",
    leaveAnnual: String(Number(leave.annual ?? 0)),
    leaveSick: String(Number(leave.sick ?? 0)),
    internalNotes: item.hr.internalNotes || ""
  });
}

function mapValidationErrors(error) {
  if (!Array.isArray(error?.details)) return {};
  return error.details.reduce((acc, issue) => {
    const key = Array.isArray(issue.path) ? issue.path[issue.path.length - 1] : null;
    if (key && !acc[key]) acc[key] = issue.message;
    return acc;
  }, {});
}

function syncDirtyState(form, button, initialSnapshot, transform) {
  if (!form || !button) return;
  const update = () => {
    const data = Object.fromEntries(new FormData(form).entries());
    const next = transform ? transform(form, data) : data;
    button.disabled = JSON.stringify(next) === initialSnapshot;
  };
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
}

function section(title, body) {
  return `<div class="rounded-[24px] border border-border bg-surface px-6 py-6"><div class="mb-4 text-sm font-semibold text-text">${title}</div>${body}</div>`;
}

export function AdminProfile() {
  const me = store.state.user;
  const qs = new URLSearchParams(window.location.search);
  const employeeId = qs.get("employeeId");
  if (isAdminRole(me?.role) && !employeeId) return LegacyProfile();

  window.onMount = async () => {
    const root = document.getElementById("employee-profile-root");
    const state = {
      tab: qs.get("tab") || "profile",
      performanceFrom: "",
      performanceTo: "",
      activityFrom: "",
      activityTo: "",
      attendanceFrom: "",
      attendanceTo: "",
      item: null,
      error: "",
      loading: true,
      savingForm: "",
      tasksData: null,
      tasksError: "",
      viewTaskId: null,
      validation: {
        profile: {},
        hr: {}
      }
    };
    const canEditPartial = isEmployeeRole(me?.role);
    const canEditFull = isAdminRole(me?.role) && Boolean(employeeId);
    const canEditHr = canEditFull;

    async function fetchTasks() {
      if (!employeeId) return;
      try {
        state.tasksData = await apiFetch(`/admin/employees/${employeeId}/tasks?limit=50`);
        state.tasksError = "";
      } catch (err) {
        state.tasksError = err.message;
      }
    }

    function openAssignTaskModal() {
      const modalHtml = `
        <form id="assign-task-form" class="space-y-4">
          <div>
            <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Task Title *</label>
            <input name="title" required placeholder="Task title" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary transition-all">
          </div>
          <div>
            <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Description</label>
            <textarea name="description" rows="3" placeholder="Task details..." class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary transition-all"></textarea>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Priority</label>
              <select name="priority" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary transition-all">
                <option value="LOW">Low</option>
                <option value="MEDIUM" selected>Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Due Date *</label>
              <input name="dueAt" type="date" required class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary transition-all">
            </div>
          </div>
          <label class="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm cursor-pointer hover:border-text transition-colors">
            <input type="checkbox" name="requireImages" class="h-4 w-4 rounded border-border text-primary cursor-pointer">
            <span class="text-sm font-semibold text-text">Require images for submission</span>
          </label>
          <div class="mt-6 flex justify-end gap-3">
            <button type="button" class="modal-close rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-text hover:bg-surface">Cancel</button>
            <button type="submit" class="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:scale-105 transition-transform">Assign Task</button>
          </div>
        </form>
      `;

      const { close } = Modal({
        title: `Assign Task to ${state.item?.fullName || "Employee"}`,
        content: modalHtml,
        size: "max-w-md",
        onRender: (modalEl) => {
          modalEl.querySelector("#assign-task-form")?.addEventListener("submit", async (event) => {
            event.preventDefault();
            const form = event.target;
            const submitBtn = form.querySelector("button[type='submit']");
            submitBtn.disabled = true;
            submitBtn.textContent = "Assigning...";
            try {
              await apiFetch("/admin/tasks", {
                method: "POST",
                body: {
                  title: form.title.value.trim(),
                  description: form.description.value.trim() || undefined,
                  priority: form.priority.value,
                  dueAt: new Date(form.dueAt.value).toISOString(),
                  assignedToId: employeeId,
                  requireImages: form.requireImages.checked
                }
              });
              close();
              window.toast("Task assigned successfully.", "success");
              state.tab = "tasks";
              state.viewTaskId = null;
              await fetchTasks();
              render();
            } catch (error) {
              submitBtn.disabled = false;
              submitBtn.textContent = "Assign Task";
              window.toast(error.message, "error");
            }
          });
        }
      });
    }

    async function fetchItem() {
      state.loading = true;
      render();
      try {
        if (employeeId) {
          state.item = (
            await apiFetch(
              `/admin/employees/${employeeId}${buildQuery({
                from: state.performanceFrom || undefined,
                to: state.performanceTo || undefined,
                activityFrom: state.activityFrom || undefined,
                activityTo: state.activityTo || undefined,
                attendanceFrom: state.attendanceFrom || undefined,
                attendanceTo: state.attendanceTo || undefined
              })}`
            )
          ).item;
          try {
            state.insights = (await apiFetch(`/admin/employees/${employeeId}/insights`)).item;
          } catch (e) {
            state.insights = { performanceScore: 0, attendanceRate: 0, revenueTrend: 0, riskLevel: "Healthy", inactivityDays: 0, flags: [] };
          }
        } else {
          state.item = normalizeSelf(
            await apiFetch(
              `/profile${buildQuery({
                from: state.performanceFrom || undefined,
                to: state.performanceTo || undefined,
                activityFrom: state.activityFrom || undefined,
                activityTo: state.activityTo || undefined,
                attendanceFrom: state.attendanceFrom || undefined,
                attendanceTo: state.attendanceTo || undefined
              })}`
            )
          );
        }
        state.error = "";
      } catch (error) {
        state.error = error.message;
      } finally {
        state.loading = false;
        render();
      }
    }

    async function patch(body) {
      if (employeeId) return apiFetch(`/admin/employees/${employeeId}`, { method: "PATCH", body });
      return apiFetch("/profile", { method: "PATCH", body });
    }

    function render() {
      if (state.loading) {
        root.innerHTML = section("Employee Profile", `<div class="py-16 text-center text-sm text-muted">Loading employee profile...</div>`);
        return;
      }
      if (state.error) {
        root.innerHTML = section("Employee Profile", `<div class="py-16 text-center text-sm text-danger">${esc(state.error)}</div>`);
        return;
      }
      const item = state.item;
      const performance = normalizePerformance(item.performance);
      const tone = getStatusTone(item.status);
      const isLocked = item.status === "BANNED";
      const warningBanner = getStatusBanner(item);
      const tabs = ["profile", "permissions", "performance", "tasks", "activity", "attendance", ...(canEditHr ? ["hr"] : [])];

      let body = `
        <div class="space-y-4">
          ${warningBanner}
          <form id="emp-profile-form" class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div class="lg:col-span-2 rounded-2xl border border-border px-4 py-4">
              <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div id="emp-avatar-preview">${avatar(item.fullName, item.profile.avatar)}</div>
                <div class="space-y-2">
                  <input id="emp-avatar-url" name="avatarUrl" type="hidden" value="${esc(item.profile.avatar || "")}">
                  <input id="emp-avatar-file" type="file" accept="image/*" class="hidden">
                  <label for="emp-avatar-file" class="inline-flex cursor-pointer items-center rounded-xl border border-border px-4 py-2 text-sm font-medium ${canEditPartial || canEditFull ? "hover:border-text" : "pointer-events-none opacity-60"} ${isLocked ? "pointer-events-none opacity-60" : ""}">Upload avatar</label>
                </div>
              </div>
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Full Name</label>
              <input name="fullName" value="${esc(item.profile.fullName || "")}" placeholder="Full name" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" ${!(canEditPartial || canEditFull) || isLocked ? "readonly" : ""}>
              ${renderFieldError(state.validation.profile, "fullName")}
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Phone Number</label>
              <input name="phone" value="${esc(item.profile.phone || "")}" placeholder="Phone" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" ${!(canEditPartial || canEditFull) || isLocked ? "readonly" : ""}>
              ${renderFieldError(state.validation.profile, "phone")}
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Job Title</label>
              <input name="jobTitle" value="${esc(item.profile.jobTitle || "")}" placeholder="Job title" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" ${!canEditFull || isLocked ? "readonly" : ""}>
              ${renderFieldError(state.validation.profile, "jobTitle")}
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Department</label>
              <select name="department" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" ${!canEditFull || isLocked ? "disabled" : ""}>
                <option value="">Select department</option>
                ${DEPARTMENTS.map(([value, label]) => `<option value="${value}" ${item.profile.department === value ? "selected" : ""}>${label}</option>`).join("")}
              </select>
              ${renderFieldError(state.validation.profile, "department")}
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Employment Type</label>
              <select name="employmentType" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" ${!canEditFull || isLocked ? "disabled" : ""}>${["FULL_TIME", "PART_TIME", "CONTRACT"].map((v) => `<option value="${v}" ${item.profile.employmentType === v ? "selected" : ""}>${v.replace("_", " ")}</option>`).join("")}</select>
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Start Date</label>
              <input name="startDate" type="date" value="${item.profile.startDate ? item.profile.startDate.slice(0, 10) : ""}" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" ${!canEditFull || isLocked ? "readonly" : ""}>
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Status</label>
              <select name="status" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" ${!canEditFull || isLocked ? "disabled" : ""}>${["ACTIVE", "SUSPENDED", "BANNED", "ON_LEAVE"].map((v) => `<option value="${v}" ${item.profile.status === v ? "selected" : ""}>${v}</option>`).join("")}</select>
              ${item.status === "SUSPENDED" ? `<div class="mt-1 text-xs text-amber-500">${esc(item.suspendedUntil ? `Suspended until ${d(item.suspendedUntil)}` : "Suspended")}</div>` : ""}
              ${renderFieldError(state.validation.profile, "status")}
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Emergency Contact</label>
              <input name="emergencyContact" value="${esc(item.profile.emergencyContact || "")}" placeholder="Emergency contact" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" ${!canEditFull || isLocked ? "readonly" : ""}>
              ${renderFieldError(state.validation.profile, "emergencyContact")}
            </div>
            <div class="lg:col-span-2">
              <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Address</label>
              <textarea name="address" rows="3" placeholder="Address" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" ${!canEditFull || isLocked ? "readonly" : ""}>${esc(item.profile.address || "")}</textarea>
              ${renderFieldError(state.validation.profile, "address")}
            </div>
            <div class="lg:col-span-2 flex justify-end ${!(canEditPartial || canEditFull) ? "hidden" : ""}">
              <button id="emp-profile-save" ${isLocked || state.savingForm === "profile" ? "disabled" : "disabled"} class="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">${state.savingForm === "profile" ? "Saving..." : "Save profile"}</button>
            </div>
          </form>
        </div>
      `;

      if (state.tab === "permissions") {
        const o = item.permissions.overrides || {};
        body = `
          <div class="space-y-4">
            ${warningBanner}
            <form id="emp-permissions-form" class="space-y-4">
            <select name="roleProfile" class="w-full rounded-xl border border-border bg-surface px-4 py-3" ${!canEditFull || isLocked ? "disabled" : ""}>${["ADMIN", "MANAGER", "RECEPTION", "ACCOUNTANT", "TECHNICIAN", "EMPLOYEE"].map((v) => `<option value="${v}" ${item.permissions.roleProfile === v ? "selected" : ""}>${v}</option>`).join("")}</select>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">${[
            ["canManageBookings", "Manage bookings"],
            ["canAccessAccounting", "Access accounting"],
            ["canEditInventory", "Edit inventory"],
            ["canManageEmployees", "Manage employees"],
            ["canViewReports", "View reports"],
            ["canIssueRefunds", "Issue refunds"]
          ]
            .map(([key, label]) => `<label class="flex items-center justify-between rounded-2xl border border-border px-4 py-3"><span class="text-sm text-text">${label}</span><input type="checkbox" name="${key}" ${o[key] ? "checked" : ""} ${!canEditFull || isLocked ? "disabled" : ""} class="h-4 w-4 rounded border-border bg-bg text-primary"></label>`)
            .join("")}</div>
            <div class="text-sm text-muted">Role sets defaults. Overrides customize access for this employee.</div>
            <div class="flex justify-end ${!canEditFull ? "hidden" : ""}"><button id="emp-permissions-save" ${isLocked || state.savingForm === "permissions" ? "disabled" : "disabled"} class="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">${state.savingForm === "permissions" ? "Saving..." : "Save permissions"}</button></div>
            </form>
          </div>
        `;
      }

      if (state.tab === "performance") {
        body = `
          <form id="emp-performance-range-form" class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4 lg:col-span-3">
            <div>
              <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">From Date</label>
              <input name="from" type="date" value="${esc(state.performanceFrom)}" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm hover:border-primary transition-colors focus:ring focus:ring-primary/20">
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">To Date</label>
              <input name="to" type="date" value="${esc(state.performanceTo)}" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm hover:border-primary transition-colors focus:ring focus:ring-primary/20">
            </div>
            <div class="flex items-end">
              <button class="w-full rounded-xl border border-border border-b-[3px] bg-bg px-4 py-3 text-sm font-bold text-text hover:bg-surface transition-all active:translate-y-[1px] active:border-b shadow-sm">Apply Range</button>
            </div>
            <div class="flex items-end">
              <button type="button" class="w-full rounded-xl border border-primary/30 border-b-[3px] bg-primary/10 px-4 py-3 text-sm font-bold text-primary hover:bg-primary/20 transition-all active:translate-y-[1px] active:border-b shadow-sm">Compare Team</button>
            </div>
          </form>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-3 lg:col-span-3">
             ${performance.cards.map((card, i) => {
          const trend = card.label.toLowerCase().includes('revenue') ? (state.insights?.revenueTrend || 0) : (i === 0 ? 12 : -5);
          const isUp = trend >= 0;
          return `
                 <div class="group relative overflow-hidden rounded-[24px] border border-border bg-surface px-6 py-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-border/50">
                   <div class="text-[10px] font-bold uppercase tracking-widest text-muted">${esc(card.label)}</div>
                   <div class="mt-2 text-4xl font-black text-text font-heading tracking-tight">${esc(card.value)}</div>
                   <div class="mt-5 flex items-center justify-between">
                      <div class="flex items-center gap-1.5 text-xs font-bold ${isUp ? 'text-emerald-500' : 'text-danger'} bg-bg px-2.5 py-1.5 rounded-lg border border-border/50">
                        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="${isUp ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}"></path></svg>
                        <span>${Math.abs(trend)}% vs last</span>
                      </div>
                      ${sparklineSvg(trend)}
                   </div>
                 </div>`;
        }).join("")}
          </div>
          <div class="mt-6 lg:col-span-3 rounded-[24px] overflow-hidden shadow-sm border border-border">
             ${renderTable(performance.rows || [], "No activity recorded for this period.")}
          </div>
        `;
      }

      if (state.tab === "activity") {
        body = `
          <form id="emp-activity-range-form" class="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
             <div>
               <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">From Date</label>
               <input name="from" type="date" value="${esc(state.activityFrom)}" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm">
             </div>
             <div>
               <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">To Date</label>
               <input name="to" type="date" value="${esc(state.activityTo)}" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm">
             </div>
             <div class="flex items-end">
               <button class="w-full rounded-xl border border-border px-4 py-3 text-sm font-bold text-text bg-bg hover:bg-surface transition-all shadow-sm">Apply filter</button>
             </div>
          </form>
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            ${section("Security Snapshot", `<div class="space-y-3 text-sm"><div>Last login: <span class="text-muted">${dt(item.security.lastLoginAt)}</span></div><div>Last active: <span class="text-muted">${dt(item.security.lastActiveAt)}</span></div><div>Device / Browser: <span class="text-muted">${esc(formatDeviceBrowser(item.security))}</span></div><div>IP address: <span class="text-muted">${esc(formatIpAddress(item.security.ipAddress))}</span></div></div>`)}
            ${section("Admin Controls", `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 ${!canEditHr || isLocked ? "hidden" : ""}"><button type="button" data-action="force_logout_all" class="rounded-xl border border-border px-4 py-3 text-sm font-medium text-text">Force logout all sessions</button><button type="button" data-action="force_password_reset" class="rounded-xl border border-border px-4 py-3 text-sm font-medium text-text">Force password reset</button><button type="button" data-action="reset_password" class="rounded-xl border border-border px-4 py-3 text-sm font-medium text-text">Reset password</button></div>${isLocked ? `<div class="text-sm text-muted">Admin actions are disabled while the employee is banned.</div>` : ""}`)}
          </div>
          <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            ${section("Sessions", renderRows(item.sessions, "No sessions logged."))}
            ${section("Action History", renderRows(item.activityLog, "No activity recorded for this period."))}
          </div>
        `;
      }

      if (state.tab === "attendance") {
        const attendance = item.attendance || emptyAttendance;
        body = `
          <form id="emp-attendance-range-form" class="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
             <div>
               <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">From Date</label>
               <input name="from" type="date" value="${esc(state.attendanceFrom)}" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm">
             </div>
             <div>
               <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">To Date</label>
               <input name="to" type="date" value="${esc(state.attendanceTo)}" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm">
             </div>
             <div class="flex items-end">
               <button class="w-full rounded-xl border border-border px-4 py-3 text-sm font-bold text-text bg-bg hover:bg-surface transition-all shadow-sm">Apply filter</button>
             </div>
          </form>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="rounded-2xl border border-border px-4 py-4"><div class="text-xs uppercase tracking-wide text-muted">Last Check-in</div><div class="mt-2 text-lg font-semibold text-text">${esc(dt(attendance.snapshot?.lastCheckInAt))}</div></div>
            <div class="rounded-2xl border border-border px-4 py-4"><div class="text-xs uppercase tracking-wide text-muted">Last Check-out</div><div class="mt-2 text-lg font-semibold text-text">${esc(dt(attendance.snapshot?.lastCheckOutAt))}</div></div>
          </div>
          <div class="mt-4">${attendance.monthlySummary ? `<div class="rounded-2xl border border-border px-4 py-4 text-sm text-text">Monthly summary (${esc(attendance.monthlySummary.month)}): ${esc(`${attendance.monthlySummary.presentDays} present days, ${attendance.monthlySummary.completedShifts} completed shifts, ${attendance.monthlySummary.totalWorkedHours}`)}</div>` : `<div class="rounded-2xl border border-dashed border-border px-4 py-4 text-sm text-muted">No attendance records yet.</div>`}</div>
          <div class="mt-4">${renderAttendanceTable(attendance.log)}</div>
        `;
      }

      const insights = state.insights || { performanceScore: 0, attendanceRate: 0, revenueTrend: 0, riskLevel: "Healthy", inactivityDays: 0, flags: [] };
      const isHealthy = insights.riskLevel === "Healthy";
      const isWarning = insights.riskLevel === "Warning";
      const isCritical = insights.riskLevel === "Critical";
      const riskTheme = isCritical
        ? "border-danger/20 bg-gradient-to-br from-danger/20 via-danger/5 to-bg text-danger shadow-[0_0_30px_rgba(239,68,68,0.15)]"
        : isWarning
          ? "border-amber-500/30 bg-gradient-to-br from-amber-500/20 via-amber-500/5 to-bg text-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.15)]"
          : "border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-bg text-primary shadow-[0_0_30px_rgba(var(--primary-rgb),0.1)]";

      const badgeTone = isCritical ? "border-danger text-danger bg-danger/10" : isWarning ? "border-amber-500 text-amber-500 bg-amber-500/10" : "border-emerald-500 text-emerald-500 bg-emerald-500/10";

      const intelligenceBanner = `
        <div class="relative overflow-hidden rounded-[32px] border-2 ${riskTheme} px-8 py-8 transition-all duration-500 mb-6 group">
           <div class="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl group-hover:bg-white/10 transition-colors duration-700"></div>
           <div class="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div class="flex items-center gap-6">
                 ${avatar(item.fullName, item.avatar, "w-24 h-24 text-4xl shadow-xl ring-4 ring-bg")}
                 <div class="space-y-1.5">
                    <div class="text-3xl font-heading font-black text-text tracking-tight">${esc(item.fullName || "Employee")}</div>
                    <div class="flex items-center gap-3 mt-1">
                       <span class="rounded-xl border border-border bg-surface px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text shadow-sm">${esc(item.roleProfile)}</span>
                       <span class="rounded-xl border ${badgeTone} px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                         <span class="relative flex h-2 w-2">
                           <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 object-cover ${isCritical ? 'bg-danger' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}"></span>
                           <span class="relative inline-flex rounded-full h-2 w-2 ${isCritical ? 'bg-danger' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'}"></span>
                         </span>
                         ${insights.riskLevel}
                       </span>
                    </div>
                    <div class="text-xs font-semibold opacity-70 mt-2">
                      ${insights.inactivityDays > 0 ? `Last active ${insights.inactivityDays} days ago` : 'Active today'}
                    </div>
                 </div>
              </div>
              <div class="flex items-center gap-8 lg:ml-auto">
                 <div class="flex flex-col border-l-2 border-border/50 pl-6">
                    <span class="text-[10px] font-bold uppercase tracking-widest opacity-60">Performance</span>
                    <span class="text-4xl font-black font-heading tracking-tight flex items-baseline gap-1">${insights.performanceScore}<span class="text-sm font-semibold opacity-50">/100</span></span>
                 </div>
                 <div class="flex flex-col border-l-2 border-border/50 pl-6">
                    <span class="text-[10px] font-bold uppercase tracking-widest opacity-60">Attendance</span>
                    <span class="text-4xl font-black font-heading tracking-tight flex items-baseline gap-1">${insights.attendanceRate}<span class="text-sm font-semibold opacity-50">%</span></span>
                 </div>
              </div>
           </div>
        </div>
      `;

      const flagItems = insights.flags.length > 0
        ? insights.flags.map(f => `<div class="mb-3 flex items-start gap-3 rounded-2xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm font-medium text-danger shadow-sm"><svg class="mt-0.5 h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>${esc(f)}</div>`).join("")
        : `<div class="text-sm text-muted bg-surface border border-border px-4 py-3 rounded-2xl shadow-sm">No active flags. Employee is healthy.</div>`;

      let recommendations = "";
      if (insights.attendanceRate < 70) recommendations += `<button type="button" class="w-full mb-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 px-4 py-3.5 text-sm font-bold text-amber-500 transition-all hover:bg-amber-500/20 hover:scale-[1.02] shadow-sm">Review Attendance</button>`;
      if (insights.revenueTrend < 0) recommendations += `<button type="button" class="w-full mb-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 px-4 py-3.5 text-sm font-bold text-blue-500 transition-all hover:bg-blue-500/20 hover:scale-[1.02] shadow-sm">Review Performance</button>`;
      if (insights.riskLevel === "Critical") recommendations += `<button type="button" class="w-full mb-3 rounded-2xl bg-danger/10 border border-danger/20 px-4 py-3.5 text-sm font-bold text-danger transition-all hover:bg-danger/20 hover:scale-[1.02] shadow-sm" data-action="suspend" data-days="3">Recommend: 3-Day Suspension</button>`;

      const adminAttentionPanel = `
        <div class="rounded-[32px] border border-border bg-surface p-6 shadow-md transition-all duration-300 hover:shadow-lg">
          <h3 class="font-heading text-xl font-black text-text mb-6">Insights Engine</h3>
          <div class="mb-8">
            <h4 class="text-[10px] uppercase tracking-widest text-muted mb-4 font-bold opacity-80">Detected Rules</h4>
            ${flagItems}
          </div>
          <div>
            <h4 class="text-[10px] uppercase tracking-widest text-muted mb-4 font-bold opacity-80">Smart Actions</h4>
            ${recommendations || `<div class="text-sm text-muted bg-bg border border-border px-4 py-3 rounded-2xl shadow-sm">No actions required.</div>`}
          </div>
        </div>
      `;

      if (state.tab === "hr" && canEditHr) {
        const leave = item.hr.leaveBalance || { annual: 0, sick: 0 };
        body = `
          <div class="space-y-4">
            ${warningBanner}
            <form id="emp-hr-form" class="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Salary</label>
                <input name="salary" type="number" step="0.01" value="${esc(item.hr.salary || "")}" placeholder="Salary" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" ${isLocked ? "readonly" : ""}>
              </div>
              <div>
                <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Payment Frequency</label>
                <input name="paymentFrequency" value="${esc(item.hr.paymentFrequency || "")}" placeholder="Payment frequency" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" ${isLocked ? "readonly" : ""}>
              </div>
              <div>
                <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Annual Leave Days</label>
                <input name="leaveAnnual" type="number" step="0.5" value="${esc(leave.annual ?? 0)}" placeholder="Annual leave" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" ${isLocked ? "readonly" : ""}>
              </div>
              <div>
                <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Sick Leave Days</label>
                <input name="leaveSick" type="number" step="0.5" value="${esc(leave.sick ?? 0)}" placeholder="Sick leave" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" ${isLocked ? "readonly" : ""}>
              </div>
              <div class="rounded-2xl border border-border px-4 py-4 text-sm text-muted">
                <div class="mb-2 text-xs font-bold uppercase tracking-wide text-text/70">Bonus History</div>
                ${item.hr.bonusHistory?.length ? item.hr.bonusHistory.map((entry) => `<div>${esc(JSON.stringify(entry))}</div>`).join("") : "No bonus history recorded."}
              </div>
              <div class="rounded-2xl border border-border px-4 py-4 text-sm text-muted">
                <div class="mb-2 text-xs font-bold uppercase tracking-wide text-text/70">Deductions</div>
                ${item.hr.deductions?.length ? item.hr.deductions.map((entry) => `<div>${esc(JSON.stringify(entry))}</div>`).join("") : "No deductions recorded."}
              </div>
              <div class="lg:col-span-2">
                <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Internal Notes</label>
                <textarea name="internalNotes" rows="5" placeholder="Internal notes" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all" ${isLocked ? "readonly" : ""}>${esc(item.hr.internalNotes || "")}</textarea>
                ${renderFieldError(state.validation.hr, "internalNotes")}
              </div>
              <div class="lg:col-span-2 flex justify-end"><button id="emp-hr-save" ${isLocked || state.savingForm === "hr" ? "disabled" : "disabled"} class="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">${state.savingForm === "hr" ? "Saving..." : "Save HR"}</button></div>
            </form>
          </div>
        `;
      }

      if (state.tab === "tasks") {
        if (!state.tasksData) {
          body = `<div class="py-16 text-center text-sm text-muted">Loading tasks...</div>`;
        } else if (state.tasksError) {
          body = `<div class="py-16 text-center text-sm text-danger">${esc(state.tasksError)}</div>`;
        } else if (state.viewTaskId) {
          const t = state.tasksData.data.find((x) => x.id === state.viewTaskId);
          if (!t) {
            body = `<div class="py-16 text-center text-sm text-muted">Task not found.</div>`;
          } else {
            const sub = t.submissions?.[0];
            const isEmployee = me?.role !== "ADMIN";
            const canSubmit = t.status === "NOT_STARTED" || t.status === "IN_PROGRESS" || t.status === "REJECTED" || t.status === "OVERDUE";

            body = `
               <div class="mb-4 flex items-center gap-3">
                 <button type="button" id="emp-task-back" class="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted hover:text-text hover:border-text transition-all shadow-sm">
                    <svg class="h-5 w-5 -translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg>
                 </button>
                 <h2 class="text-xl font-bold text-text">Task Details</h2>
               </div>
               
               <div class="rounded-[24px] border border-border bg-surface p-6 shadow-sm mb-6">
                 <div class="flex items-center gap-2 mb-4">
                    ${badge(t.priority, t.priority === "HIGH" ? "border-danger text-danger bg-danger/10" : t.priority === "MEDIUM" ? "border-amber-500 text-amber-500 bg-amber-500/10" : "border-emerald-500 text-emerald-500 bg-emerald-500/10")}
                    ${badge(t.status.replace("_", " "), t.status === "APPROVED" ? "border-emerald-500 text-emerald-500 bg-emerald-500/10" : (t.status === "REJECTED" || t.status === "OVERDUE" ? "border-danger text-danger bg-danger/10" : "border-amber-500 text-amber-500 bg-amber-500/10"))}
                 </div>
                 <div class="text-2xl font-black font-heading tracking-tight text-text mb-2">${esc(t.title)}</div>
                 <div class="text-sm text-text bg-bg p-4 rounded-2xl border border-border/50 text-wrap whitespace-pre-wrap">${esc(t.description || "")}</div>
                 <div class="mt-4 flex gap-6 text-sm text-muted">
                    <div><span class="font-bold">Assigned by:</span> ${esc(t.assignedBy?.fullName || 'Admin')}</div>
                    <div><span class="font-bold">Due:</span> ${dt(t.dueAt)}</div>
                 </div>
               </div>
               
               ${sub ? `
                 <div class="rounded-[24px] border-2 border-primary/20 bg-primary/5 p-6 shadow-sm mb-6">
                   <h3 class="text-sm font-bold uppercase tracking-widest text-primary mb-3">Submission Details</h3>
                   <div class="text-sm text-text mb-4 bg-surface p-4 rounded-xl border border-primary/10 whitespace-pre-wrap">${esc(sub.reportText)}</div>
                   <div class="text-xs text-muted font-medium">Submitted at ${dt(sub.submittedAt)}</div>
                 </div>
               ` : ''}

               ${sub?.adminComment ? `
                 <div class="rounded-[24px] border border-danger/20 bg-danger/5 p-6 shadow-sm mb-6">
                   <h3 class="text-sm font-bold uppercase tracking-widest text-danger mb-3">Admin Feedback</h3>
                   <div class="text-sm text-danger font-medium">${esc(sub.adminComment)}</div>
                 </div>
               ` : ''}

               ${canSubmit && isEmployee ? `
                 <form id="emp-task-submit-form" class="rounded-[24px] border border-border bg-surface p-6 shadow-sm">
                   <h3 class="text-lg font-bold text-text mb-4">Submit Work</h3>
                   <div class="mb-4">
                     <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Work Report</label>
                     <textarea name="reportText" rows="4" class="w-full rounded-xl border border-border bg-bg px-4 py-3 shadow-sm focus:border-primary transition-all" placeholder="Describe what was done..." required></textarea>
                   </div>
                   <div class="flex justify-end">
                     <button class="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white shadow-sm hover:scale-105 transition-transform" ${state.savingForm === "task_submit" ? "disabled" : ""}>${state.savingForm === "task_submit" ? "Submitting..." : "Submit Task"}</button>
                   </div>
                 </form>
               ` : ''}

               ${t.status === "SUBMITTED" && !isEmployee ? `
                 <form id="emp-task-review-form" class="rounded-[24px] border border-border bg-surface p-6 shadow-sm">
                   <h3 class="text-lg font-bold text-text mb-4">Admin Review</h3>
                   <div class="mb-4">
                     <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Feedback / Comments (Optional)</label>
                     <textarea name="adminComment" rows="3" class="w-full rounded-xl border border-border bg-bg px-4 py-3 shadow-sm focus:border-primary transition-all" placeholder="Any notes for the employee..."></textarea>
                   </div>
                   <div class="flex gap-3 justify-end mt-6">
                     <button type="button" id="emp-task-reject" class="rounded-xl bg-danger/10 border border-danger/20 text-danger px-6 py-3 text-sm font-bold shadow-sm hover:bg-danger/20 transition-all">Reject Work</button>
                     <button type="button" id="emp-task-revision" class="rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 px-6 py-3 text-sm font-bold shadow-sm hover:bg-amber-500/20 transition-all">Request Revision</button>
                     <button type="submit" class="rounded-xl bg-emerald-500 text-white px-6 py-3 text-sm font-bold shadow-sm hover:scale-105 transition-all">Approve Task</button>
                   </div>
                 </form>
               ` : ''}
            `;
          }
        } else {
          const tasks = state.tasksData.data || [];
          const total = tasks.length;
          const completed = tasks.filter(t => t.status === "APPROVED" || t.status === "SUBMITTED").length;
          const pending = tasks.filter(t => t.status === "NOT_STARTED" || t.status === "IN_PROGRESS").length;
          const overdue = tasks.filter(t => t.status === "OVERDUE").length;

          const summaryHTML = `
            <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div class="grid grid-cols-2 gap-4 md:grid-cols-4 flex-1">
               ${[
              { label: "Total Tasks", value: total },
              { label: "Completed", value: completed, color: "text-emerald-500" },
              { label: "Pending", value: pending, color: "text-amber-500" },
              { label: "Overdue", value: overdue, color: "text-danger" }
            ].map(c => `
                 <div class="rounded-2xl border border-border bg-surface px-4 py-4 text-center shadow-sm">
                   <div class="text-[10px] uppercase font-bold tracking-widest text-muted">${c.label}</div>
                   <div class="mt-2 text-3xl font-black font-heading tracking-tight ${c.color || 'text-text'}">${c.value}</div>
                 </div>
               `).join("")}
              </div>
              ${me?.role === "ADMIN" ? `
                <button id="emp-task-create" type="button" class="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-md hover:scale-105 transition-all">
                  <span>Assign Task</span>
                </button>
              ` : ""}
            </div>
          `;

          const listHTML = state.tasksError
            ? `<div class="text-center py-10 text-danger border border-danger/20 rounded-2xl bg-danger/5">${esc(state.tasksError)}</div>`
            : tasks.length === 0 ? `<div class="text-center py-10 text-muted border border-dashed border-border rounded-2xl bg-surface">No tasks assigned.</div>` : `
            <div class="grid gap-3">
               ${tasks.map(t => {
            const priorityTone = t.priority === "HIGH" ? "border-danger text-danger bg-danger/10" : t.priority === "MEDIUM" ? "border-amber-500 text-amber-500 bg-amber-500/10" : "border-emerald-500 text-emerald-500 bg-emerald-500/10";
            const statusTone = t.status === "APPROVED" ? "border-emerald-500 text-emerald-500 bg-emerald-500/10" : t.status === "REJECTED" || t.status === "OVERDUE" ? "border-danger text-danger bg-danger/10" : "border-amber-500 text-amber-500 bg-amber-500/10";
            return `
                   <div class="rounded-2xl border border-border bg-surface p-5 shadow-sm hover:border-text transition-all cursor-pointer flex justify-between items-center group" data-view-task="${t.id}">
                      <div>
                        <div class="flex items-center gap-2 mb-2">
                           ${badge(t.priority, priorityTone)}
                           ${badge(t.status.replace("_", " "), statusTone)}
                        </div>
                        <div class="text-lg font-bold text-text group-hover:text-primary transition-colors">${esc(t.title)}</div>
                        <div class="text-sm text-muted mt-1 max-w-2xl truncate">${esc(t.description || "No description provided.")}</div>
                        <div class="text-xs text-muted font-semibold mt-3 flex items-center gap-2">
                           Due ${d(t.dueAt)}
                        </div>
                      </div>
                      <div class="h-10 w-10 flex items-center justify-center rounded-full bg-bg border border-border group-hover:bg-primary/10 group-hover:border-primary/20 group-hover:text-primary transition-colors text-muted">
                        &rarr;
                      </div>
                   </div>
                 `;
          }).join("")}
            </div>
          `;

          body = `<div>${summaryHTML}${listHTML}</div>`;
        }
      }

      root.innerHTML = `
        <div class="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          ${intelligenceBanner}
          
          <div class="grid grid-cols-1 gap-8 lg:grid-cols-4">
             <div class="lg:col-span-3 space-y-6">
                <!-- Navigation Tabs -->
                <div class="flex flex-wrap gap-2 bg-surface p-2 rounded-[24px] border border-border shadow-sm">
                   ${tabs.map((tab) => `
                     <button type="button" data-tab="${tab}" class="rounded-2xl px-6 py-3 text-sm font-bold tracking-wide transition-all duration-300 flex-1 min-w-[120px] ${state.tab === tab ? "bg-primary text-white shadow-md scale-100" : "text-muted hover:text-text hover:bg-bg"}">
                        ${tab === "activity" ? "Timeline" : tab === "hr" ? "Payroll/HR" : tab[0].toUpperCase() + tab.slice(1)}
                     </button>
                   `).join("")}
                </div>
                
                <div class="animate-in fade-in duration-300">
                  ${body}
                </div>
             </div>
             
             <div class="lg:col-span-1 space-y-6">
                ${adminAttentionPanel}
                
                <div class="rounded-[32px] border border-border bg-surface p-6 shadow-md">
                   <h4 class="text-[10px] uppercase tracking-widest text-muted mb-4 font-bold opacity-80">System Controls</h4>
                   <div class="flex flex-col gap-3">
                     ${canEditHr && !isLocked ? `<button type="button" data-action="reset_password" class="w-full rounded-2xl border border-border bg-bg px-4 py-3.5 text-sm font-bold text-text transition-all hover:bg-surface hover:-translate-y-0.5 shadow-sm">Reset Password</button>` : ""}
                     ${employeeId ? `<button type="button" id="back-employees" class="w-full rounded-2xl border border-border bg-bg px-4 py-3.5 text-sm font-bold text-text transition-all hover:bg-surface hover:-translate-y-0.5 shadow-sm">Back to Directory</button>` : ""}
                   </div>
                </div>
             </div>
          </div>
        </div>
      `;

      root.querySelectorAll("[data-tab]").forEach((button) =>
        button.addEventListener("click", () => {
          state.tab = button.dataset.tab;
          state.viewTaskId = null;
          state.validation.profile = {};
          state.validation.hr = {};
          if (state.tab === "tasks" && !state.tasksData) {
            fetchTasks().then(render);
          } else {
            render();
          }
        })
      );
      root.querySelector("#back-employees")?.addEventListener("click", () => window.navigate(null, "/admin/employees"));
      root.querySelector("#emp-performance-range-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        state.performanceFrom = event.target.from.value;
        state.performanceTo = event.target.to.value;
        await fetchItem();
      });
      root.querySelector("#emp-activity-range-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        state.activityFrom = event.target.from.value;
        state.activityTo = event.target.to.value;
        await fetchItem();
      });
      root.querySelector("#emp-attendance-range-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        state.attendanceFrom = event.target.from.value;
        state.attendanceTo = event.target.to.value;
        await fetchItem();
      });

      const profileForm = root.querySelector("#emp-profile-form");
      const permissionsForm = root.querySelector("#emp-permissions-form");
      const hrForm = root.querySelector("#emp-hr-form");

      syncDirtyState(profileForm, root.querySelector("#emp-profile-save"), getProfileSnapshot(item));
      syncDirtyState(
        permissionsForm,
        root.querySelector("#emp-permissions-save"),
        getPermissionsSnapshot(item),
        (form, data) => ({
          ...data,
          canManageBookings: form.canManageBookings.checked,
          canAccessAccounting: form.canAccessAccounting.checked,
          canEditInventory: form.canEditInventory.checked,
          canManageEmployees: form.canManageEmployees.checked,
          canViewReports: form.canViewReports.checked,
          canIssueRefunds: form.canIssueRefunds.checked
        })
      );
      syncDirtyState(hrForm, root.querySelector("#emp-hr-save"), getHrSnapshot(item));
      profileForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        const validation = {};
        if (!form.fullName.value.trim()) validation.fullName = "Full name is required.";
        if (!PHONE_REGEX.test(form.phone.value.trim())) validation.phone = "Phone must start with 07 and contain 10 digits.";
        state.validation.profile = validation;
        if (Object.keys(validation).length) {
          render();
          return;
        }
        state.savingForm = "profile";
        render();
        try {
          await patch(
            employeeId
              ? { action: "update_profile", data: { fullName: form.fullName.value.trim(), phone: form.phone.value.trim(), jobTitle: form.jobTitle.value.trim() || undefined, department: form.department.value || null, employmentType: form.employmentType.value, startDate: form.startDate.value || null, status: form.status.value, emergencyContact: form.emergencyContact.value.trim() || null, address: form.address.value.trim() || null, avatarUrl: form.avatarUrl.value || null } }
              : { action: "update_profile", fullName: form.fullName.value.trim(), phone: form.phone.value.trim(), avatarUrl: form.avatarUrl.value || null }
          );
          if (!employeeId) await store.syncAuth();
          window.toast("Profile updated", "success");
          await fetchItem();
        } catch (error) {
          state.savingForm = "";
          state.validation.profile = mapValidationErrors(error);
          if (!Object.keys(state.validation.profile).length) window.toast(error.message, "error");
          render();
        }
      });
      permissionsForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        state.savingForm = "permissions";
        render();
        try {
          await patch({ action: "update_role_permissions", data: { roleProfile: form.roleProfile.value, overrides: { canManageBookings: form.canManageBookings.checked, canAccessAccounting: form.canAccessAccounting.checked, canEditInventory: form.canEditInventory.checked, canManageEmployees: form.canManageEmployees.checked, canViewReports: form.canViewReports.checked, canIssueRefunds: form.canIssueRefunds.checked } } });
          window.toast("Permissions updated", "success");
          await fetchItem();
        } catch (error) {
          state.savingForm = "";
          window.toast(error.message, "error");
          render();
        }
      });
      hrForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        state.savingForm = "hr";
        state.validation.hr = {};
        render();
        try {
          await patch({ action: "update_hr", data: { salary: form.salary.value ? Number(form.salary.value) : null, paymentFrequency: form.paymentFrequency.value || null, leaveBalance: { annual: Number(form.leaveAnnual.value || 0), sick: Number(form.leaveSick.value || 0) }, internalNotes: form.internalNotes.value || null } });
          window.toast("HR updated", "success");
          await fetchItem();
        } catch (error) {
          state.savingForm = "";
          state.validation.hr = mapValidationErrors(error);
          if (!Object.keys(state.validation.hr).length) window.toast(error.message, "error");
          render();
        }
      });
      root.querySelector("#emp-avatar-file")?.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          const blob = await openImageCropper({ file, title: "Crop avatar", aspectRatio: 1, outputType: "image/jpeg", outputSize: 640, cropShape: "round" });
          if (!blob) return;
          const url = await uploadLocalFile(new File([blob], `employee_${Date.now()}.jpg`, { type: "image/jpeg" }), { folder: "employee-profiles" });
          root.querySelector("#emp-avatar-url").value = url;
          root.querySelector("#emp-avatar-preview").innerHTML = avatar(state.item.fullName, url);
          root.querySelector("#emp-profile-save")?.removeAttribute("disabled");
          window.toast("Avatar uploaded", "success");
        } catch (error) {
          window.toast(error.message, "error");
        } finally {
          event.target.value = "";
        }
      });
      root.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", async () => {
        try {
          if (isLocked) return;
          if (button.dataset.action === "reset_password") {
            const confirmed = await ConfirmModal({ title: "Reset Password", message: "Generate a temporary password for this employee?", confirmText: "Reset", cancelText: "Cancel", intent: "primary" });
            if (!confirmed) return;
          }
          const response = await patch({ action: button.dataset.action });
          if (response.temporaryPassword) await AlertModal({ title: "Temporary Password", message: response.temporaryPassword, intent: "success", confirmText: "Close" });
          window.toast("Action completed", "success");
          await fetchItem();
        } catch (error) {
          window.toast(error.message, "error");
        }
      }));

      // Tasks Event Listeners
      root.querySelectorAll("[data-view-task]").forEach(el =>
        el.addEventListener("click", () => {
          state.viewTaskId = el.dataset.viewTask;
          render();
        })
      );
      root.querySelector("#emp-task-create")?.addEventListener("click", openAssignTaskModal);
      root.querySelector("#emp-task-back")?.addEventListener("click", () => {
        state.viewTaskId = null;
        render();
      });
      root.querySelector("#emp-task-submit-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.target;
        state.savingForm = "task_submit";
        render();
        try {
          await apiFetch(`/admin/employees/${employeeId}/tasks/${state.viewTaskId}/submit`, {
            method: "PATCH",
            body: { reportText: form.reportText.value.trim() }
          });
          window.toast("Task submitted successfully!", "success");
          await fetchTasks();
          render();
        } catch (err) {
          window.toast(err.message, "error");
          state.savingForm = "";
          render();
        }
      });

      const reviewForm = root.querySelector("#emp-task-review-form");
      if (reviewForm) {
        const handleReview = async (status) => {
          state.savingForm = "task_review";
          const buttons = reviewForm.querySelectorAll('button');
          buttons.forEach(b => b.disabled = true);
          try {
            await apiFetch(`/admin/employees/${employeeId}/tasks/${state.viewTaskId}/review`, {
              method: "PATCH",
              body: { status, adminComment: reviewForm.adminComment.value.trim() }
            });
            window.toast(`Task marked as ${status.toLowerCase()}`, "success");
            await fetchTasks();
            render();
          } catch (err) {
            window.toast(err.message, "error");
            state.savingForm = "";
            buttons.forEach(b => b.disabled = false);
          }
        };
        root.querySelector("#emp-task-reject")?.addEventListener("click", () => handleReview("REJECTED"));
        root.querySelector("#emp-task-revision")?.addEventListener("click", () => handleReview("IN_PROGRESS"));
        reviewForm.addEventListener("submit", (e) => { e.preventDefault(); handleReview("APPROVED"); });
      }

    }

    await fetchItem();
  };

  return `
    <div class="mx-auto w-full max-w-7xl">
      <div class="mb-6">
        <h1 class="text-3xl font-heading font-bold text-text">Employee Profile</h1>
        <p class="mt-2 text-sm text-muted">Manage profile details, permissions, performance, activity, attendance, and HR controls.</p>
      </div>
      <div id="employee-profile-root"></div>
    </div>
  `;
}
