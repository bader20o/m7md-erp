import { apiFetch, buildQuery } from "../../lib/api.js";
import { TableRowSkeleton } from "../../components/ui/Skeleton.js";

const PERMISSIONS = [
  "accounting",
  "warehouse",
  "bookings",
  "hr",
  "memberships",
  "analytics",
  "services"
];

function statusBadge(status) {
  if (status === "banned") return `<span class="px-2.5 py-1 bg-danger/15 text-danger rounded-md text-[10px] font-bold uppercase tracking-wider">Banned</span>`;
  if (status === "suspended") return `<span class="px-2.5 py-1 bg-amber-500/15 text-amber-500 rounded-md text-[10px] font-bold uppercase tracking-wider">Suspended</span>`;
  return `<span class="px-2.5 py-1 bg-success/15 text-success rounded-md text-[10px] font-bold uppercase tracking-wider">Active</span>`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function permissionChips(permissions) {
  if (!permissions || !permissions.length) {
    return `<span class="text-xs text-muted">No permissions</span>`;
  }
  return permissions
    .map(
      (permission) =>
        `<span class="px-2 py-1 bg-primary/10 text-primary rounded-md text-[10px] uppercase font-semibold">${permission}</span>`
    )
    .join(" ");
}

function avatarFor(fullName, avatarUrl) {
  if (avatarUrl) {
    return `<img src="${avatarUrl}" class="w-10 h-10 rounded-full object-cover border border-border" alt="avatar">`;
  }
  return `<div class="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center border border-border">${(fullName || "E").charAt(0).toUpperCase()}</div>`;
}

export function AdminEmployees() {
  window.onMount = () => {
    const tbody = document.getElementById("employees-tbody");
    const pagination = document.getElementById("employees-pagination");
    const queryInput = document.getElementById("employees-search");
    const statusFilter = document.getElementById("employees-status");
    const joinFromFilter = document.getElementById("employees-join-from");
    const joinToFilter = document.getElementById("employees-join-to");
    const createToggle = document.getElementById("toggle-employee-create");
    const createContainer = document.getElementById("employee-create-container");
    const createForm = document.getElementById("employee-create-form");
    const fullNameInput = document.getElementById("employee-full-name");
    const phoneInput = document.getElementById("employee-phone");
    const nationalIdInput = document.getElementById("employee-national-id");
    const duplicateWarning = document.getElementById("employee-duplicate-warning");

    const state = {
      q: "",
      status: "",
      joinFrom: "",
      joinTo: "",
      page: 1,
      limit: 10,
      total: 0,
      loading: false,
      duplicateBlocked: false,
      permissionsByEmployee: {}
    };

    let searchDebounce = null;
    let duplicateDebounce = null;

    function getSelectedPermissions() {
      return Array.from(document.querySelectorAll(".employee-permission-checkbox"))
        .filter((input) => input.checked)
        .map((input) => input.value);
    }

    function renderPagination() {
      const pages = Math.max(1, Math.ceil(state.total / state.limit));
      pagination.innerHTML = `
        <div class="text-xs text-muted">Page ${state.page} of ${pages} (${state.total} employees)</div>
        <div class="flex items-center gap-2">
          <button id="employees-prev-page" class="px-3 py-1.5 rounded-lg border border-border text-sm ${state.page <= 1 ? "opacity-50 cursor-not-allowed" : "hover:border-primary"}">Prev</button>
          <button id="employees-next-page" class="px-3 py-1.5 rounded-lg border border-border text-sm ${state.page >= pages ? "opacity-50 cursor-not-allowed" : "hover:border-primary"}">Next</button>
        </div>
      `;

      document.getElementById("employees-prev-page").addEventListener("click", () => {
        if (state.page <= 1) return;
        state.page -= 1;
        loadEmployees();
      });

      document.getElementById("employees-next-page").addEventListener("click", () => {
        if (state.page >= pages) return;
        state.page += 1;
        loadEmployees();
      });
    }

    async function checkDuplicates() {
      const phone = phoneInput.value.trim();
      const nationalId = nationalIdInput.value.trim();
      const fullName = fullNameInput.value.trim();

      if (!phone && !nationalId && !fullName) {
        duplicateWarning.classList.add("hidden");
        duplicateWarning.textContent = "";
        state.duplicateBlocked = false;
        return;
      }

      try {
        const query = buildQuery({
          phone: phone || undefined,
          nationalId: nationalId || undefined,
          fullName: fullName || undefined
        });
        const result = await apiFetch(`/admin/users/check-duplicate${query}`);
        const messages = [];

        if (result.phone?.exists) {
          messages.push(`Phone exists (${result.phone.profile.fullName || result.phone.profile.phone}).`);
        }
        if (result.nationalId?.exists) {
          messages.push(`National ID already belongs to ${result.nationalId.profile.fullName || "an employee"}.`);
        }
        if (result.nameWarnings?.length) {
          messages.push(`Similar names detected: ${result.nameWarnings.map((item) => item.fullName).join(", ")}.`);
        }

        if (messages.length) {
          duplicateWarning.classList.remove("hidden");
          duplicateWarning.textContent = messages.join(" ");
          state.duplicateBlocked = true;
        } else {
          duplicateWarning.classList.add("hidden");
          duplicateWarning.textContent = "";
          state.duplicateBlocked = false;
        }
      } catch (error) {
        duplicateWarning.classList.add("hidden");
        duplicateWarning.textContent = "";
        state.duplicateBlocked = false;
      }
    }

    async function loadEmployees() {
      if (state.loading) return;
      state.loading = true;
      tbody.innerHTML = TableRowSkeleton(6).repeat(5);

      try {
        const query = buildQuery({
          q: state.q,
          status: state.status,
          joinFrom: state.joinFrom,
          joinTo: state.joinTo,
          page: state.page,
          limit: state.limit
        });
        const response = await apiFetch(`/admin/employees${query}`);
        state.total = response.total || 0;
        const items = response.items || [];

        if (!items.length) {
          tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-muted text-sm">No employees found.</td></tr>`;
        } else {
          tbody.innerHTML = items
            .map(
              (item) => `
            <tr class="border-b border-border hover:bg-bg cursor-pointer transition-colors" onclick="window.openEmployeeDetails('${item.id}')">
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  ${avatarFor(item.fullName, item.avatar)}
                  <div>
                    <div class="text-sm font-semibold text-text">${item.fullName || "Unnamed Employee"}</div>
                    <div class="text-xs text-muted">${item.phone}</div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3 text-sm">${item.phone}</td>
              <td class="px-4 py-3 text-sm">${formatDate(item.joinedAt)}</td>
              <td class="px-4 py-3">${statusBadge(item.status)}</td>
              <td class="px-4 py-3 text-xs">${permissionChips(item.permissions)}</td>
              <td class="px-4 py-3 text-right text-sm text-primary font-semibold">View</td>
            </tr>
          `
            )
            .join("");
        }
      } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-12 text-center text-danger text-sm">${error.message}</td></tr>`;
      } finally {
        state.loading = false;
        renderPagination();
      }
    }

    async function loadEmployeeDetails(id) {
      const drawer = document.getElementById("employee-details-drawer");
      const content = document.getElementById("employee-details-content");
      const title = document.getElementById("employee-drawer-title");
      drawer.classList.remove("translate-x-full");
      content.innerHTML = `<div class="py-10 text-center text-muted">Loading...</div>`;

      try {
        const response = await apiFetch(`/admin/employees/${id}`);
        const employee = response.item;
        state.permissionsByEmployee[id] = employee.permissions || [];
        title.textContent = employee.fullName || "Employee";
        content.innerHTML = `
          <div class="space-y-5">
            <div class="flex items-center gap-3">
              ${avatarFor(employee.fullName, employee.hr.profilePhotoUrl)}
              <div>
                <div class="text-base font-bold">${employee.fullName || "Unnamed"}</div>
                <div class="text-xs text-muted">${employee.phone}</div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3 text-xs">
              <div class="rounded-lg border border-border p-3">
                <div class="text-muted uppercase">Joined</div>
                <div class="font-semibold mt-1">${formatDate(employee.joinedAt)}</div>
              </div>
              <div class="rounded-lg border border-border p-3">
                <div class="text-muted uppercase">Status</div>
                <div class="mt-1">${statusBadge(employee.status)}</div>
              </div>
            </div>

            <div class="rounded-lg border border-border p-3 text-xs space-y-2">
              <div><span class="text-muted uppercase">National ID:</span> <span class="font-semibold">${employee.hr.nationalId}</span></div>
              <div><span class="text-muted uppercase">Birth Date:</span> <span class="font-semibold">${formatDate(employee.hr.birthDate)}</span></div>
              <div><span class="text-muted uppercase">Job Title:</span> <span class="font-semibold">${employee.hr.jobTitle}</span></div>
              <div><span class="text-muted uppercase">Permissions:</span> ${permissionChips(employee.permissions)}</div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <button class="px-3 py-2 rounded-lg border border-border text-sm hover:border-primary" onclick="window.employeeAction('${id}','suspend')">Suspend</button>
              <button class="px-3 py-2 rounded-lg border border-border text-sm hover:border-primary" onclick="window.employeeAction('${id}','ban')">Ban</button>
              <button class="px-3 py-2 rounded-lg border border-border text-sm hover:border-primary" onclick="window.employeeAction('${id}','reset_password')">Reset Password</button>
              <button class="px-3 py-2 rounded-lg border border-border text-sm hover:border-primary" onclick="window.employeeAction('${id}','resend_credentials')">Resend Credentials</button>
              <button class="px-3 py-2 rounded-lg border border-border text-sm hover:border-primary col-span-2" onclick="window.employeeAction('${id}','activate')">Activate</button>
              <button class="px-3 py-2 rounded-lg border border-border text-sm hover:border-primary col-span-2" onclick="window.employeeEditPermissions('${id}')">Edit Permissions</button>
              <button class="px-3 py-2 rounded-lg border border-border text-sm hover:border-primary col-span-2" onclick="window.employeeEditHr('${id}')">Edit HR</button>
            </div>
          </div>
        `;
      } catch (error) {
        content.innerHTML = `<div class="py-10 text-center text-danger text-sm">${error.message}</div>`;
      }
    }

    window.openEmployeeDetails = (id) => {
      loadEmployeeDetails(id);
    };

    window.employeeAction = async (id, action) => {
      try {
        if (action === "suspend") {
          const reason = prompt("Suspension reason (optional):") || undefined;
          await apiFetch(`/admin/employees/${id}`, { method: "PATCH", body: { action, reason } });
        } else if (action === "ban") {
          const durationInput = prompt("Ban duration in days (leave empty for permanent):");
          const banMessage = prompt("Ban message shown to employee (optional):") || undefined;
          const banReason = prompt("Internal reason (optional):") || undefined;
          await apiFetch(`/admin/employees/${id}`, {
            method: "PATCH",
            body: {
              action,
              durationDays: durationInput ? Number(durationInput) : undefined,
              banReason,
              banMessage
            }
          });
        } else if (action === "reset_password" || action === "resend_credentials") {
          const response = await apiFetch(`/admin/employees/${id}`, {
            method: "PATCH",
            body: { action }
          });
          if (response.temporaryPassword) {
            alert(`Temporary password: ${response.temporaryPassword}`);
          }
        } else {
          await apiFetch(`/admin/employees/${id}`, { method: "PATCH", body: { action } });
        }
        window.toast("Employee updated", "success");
        await loadEmployees();
        await loadEmployeeDetails(id);
      } catch (error) {
        window.toast(error.message, "error");
      }
    };

    window.employeeEditPermissions = async (id) => {
      const currentPermissions = state.permissionsByEmployee[id] || [];
      const input = prompt(
        "Permissions (comma separated): accounting, warehouse, bookings, hr, memberships, analytics, services",
        currentPermissions.join(", ")
      );
      if (input === null) return;
      const permissions = input
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);

      try {
        await apiFetch(`/admin/employees/${id}`, {
          method: "PATCH",
          body: {
            action: "update_permissions",
            permissions
          }
        });
        window.toast("Permissions updated", "success");
        await loadEmployees();
        await loadEmployeeDetails(id);
      } catch (error) {
        window.toast(error.message, "error");
      }
    };

    window.employeeEditHr = async (id) => {
      try {
        const details = await apiFetch(`/admin/employees/${id}`);
        const employee = details.item;

        const fullName = prompt("Full name (4 parts):", employee.fullName || "");
        if (fullName === null) return;
        const nationalId = prompt("National ID:", employee.hr.nationalId || "");
        if (nationalId === null) return;
        const birthDate = prompt("Birth date (YYYY-MM-DD):", employee.hr.birthDate ? employee.hr.birthDate.slice(0, 10) : "");
        if (birthDate === null) return;
        const jobTitle = prompt("Job title:", employee.hr.jobTitle || "");
        if (jobTitle === null) return;

        await apiFetch(`/admin/employees/${id}`, {
          method: "PATCH",
          body: {
            action: "update_hr",
            data: {
              fullName: fullName || undefined,
              nationalId: nationalId || undefined,
              birthDate: birthDate || undefined,
              jobTitle: jobTitle || undefined
            }
          }
        });
        window.toast("HR updated", "success");
        await loadEmployees();
        await loadEmployeeDetails(id);
      } catch (error) {
        window.toast(error.message, "error");
      }
    };

    document.getElementById("close-employee-drawer").addEventListener("click", () => {
      document.getElementById("employee-details-drawer").classList.add("translate-x-full");
    });

    queryInput.addEventListener("input", (event) => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        state.q = event.target.value.trim();
        state.page = 1;
        loadEmployees();
      }, 300);
    });

    statusFilter.addEventListener("change", (event) => {
      state.status = event.target.value;
      state.page = 1;
      loadEmployees();
    });

    joinFromFilter.addEventListener("change", (event) => {
      state.joinFrom = event.target.value;
      state.page = 1;
      loadEmployees();
    });

    joinToFilter.addEventListener("change", (event) => {
      state.joinTo = event.target.value;
      state.page = 1;
      loadEmployees();
    });

    createToggle.addEventListener("click", () => {
      createContainer.classList.toggle("hidden");
    });

    phoneInput.addEventListener("input", () => {
      clearTimeout(duplicateDebounce);
      duplicateDebounce = setTimeout(checkDuplicates, 250);
    });

    nationalIdInput.addEventListener("input", () => {
      clearTimeout(duplicateDebounce);
      duplicateDebounce = setTimeout(checkDuplicates, 250);
    });

    fullNameInput.addEventListener("input", () => {
      clearTimeout(duplicateDebounce);
      duplicateDebounce = setTimeout(checkDuplicates, 250);
    });

    createForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.target;

      if (state.duplicateBlocked) {
        window.toast("Duplicate phone or national ID detected.", "error");
        return;
      }

      try {
        const payload = {
          fullName: form.fullName.value,
          phone: form.phone.value,
          nationalId: form.nationalId.value,
          birthDate: form.birthDate.value,
          jobTitle: form.jobTitle.value,
          idCardImageUrl: form.idCardImageUrl.value,
          profilePhotoUrl: form.profilePhotoUrl.value,
          permissions: getSelectedPermissions(),
          defaultSalaryInfo: {
            monthlyBase: form.monthlyBase.value ? Number(form.monthlyBase.value) : undefined
          },
          workSchedule: {
            text: form.workSchedule.value
          }
        };

        const response = await apiFetch("/admin/employees", {
          method: "POST",
          body: payload
        });

        form.reset();
        createContainer.classList.add("hidden");
        duplicateWarning.classList.add("hidden");
        duplicateWarning.textContent = "";
        state.duplicateBlocked = false;
        window.toast("Employee created", "success");
        if (response?.item?.temporaryPassword) {
          alert(`Temporary password: ${response.item.temporaryPassword}`);
        }
        loadEmployees();
      } catch (error) {
        window.toast(error.message, "error");
      }
    });

    loadEmployees();
  };

  const permissionCheckboxes = PERMISSIONS.map(
    (permission) => `
      <label class="inline-flex items-center gap-2 text-xs">
        <input type="checkbox" value="${permission}" class="employee-permission-checkbox">
        <span class="uppercase">${permission}</span>
      </label>
    `
  ).join("");

  return `
    <div class="w-full flex flex-col gap-5 relative">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-surface border border-border rounded-xl p-4">
        <div>
          <h1 class="text-2xl font-heading font-bold">Employees</h1>
          <p class="text-sm text-muted">Manage employees, HR fields, permissions, and account controls.</p>
        </div>
        <button id="toggle-employee-create" class="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-hover">Create Employee</button>
      </div>

      <div id="employee-create-container" class="hidden bg-surface border border-border rounded-xl p-4">
        <form id="employee-create-form" class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input id="employee-full-name" name="fullName" required placeholder="Full Name (4 parts)" class="px-3 py-2 rounded-lg border border-border bg-bg">
          <input id="employee-phone" name="phone" required placeholder="Phone" class="px-3 py-2 rounded-lg border border-border bg-bg">
          <input id="employee-national-id" name="nationalId" required placeholder="National ID" class="px-3 py-2 rounded-lg border border-border bg-bg">
          <input name="birthDate" type="date" required class="px-3 py-2 rounded-lg border border-border bg-bg">
          <input name="jobTitle" required placeholder="Job Title" class="px-3 py-2 rounded-lg border border-border bg-bg">
          <input name="monthlyBase" type="number" step="0.01" placeholder="Default Salary Monthly Base" class="px-3 py-2 rounded-lg border border-border bg-bg">
          <input name="idCardImageUrl" required placeholder="ID Card Image URL" class="px-3 py-2 rounded-lg border border-border bg-bg">
          <input name="profilePhotoUrl" required placeholder="Profile Photo URL" class="px-3 py-2 rounded-lg border border-border bg-bg">
          <input name="workSchedule" placeholder="Work Schedule (text)" class="px-3 py-2 rounded-lg border border-border bg-bg">
          <div class="md:col-span-3 rounded-lg border border-border p-3 bg-bg">
            <div class="text-xs uppercase text-muted mb-2">Permissions</div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2">${permissionCheckboxes}</div>
          </div>
          <div id="employee-duplicate-warning" class="hidden md:col-span-3 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2"></div>
          <button class="md:col-span-3 px-4 py-2 rounded-lg bg-primary text-white font-semibold">Save Employee</button>
        </form>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input id="employees-search" placeholder="Search by name or phone" class="md:col-span-2 px-3 py-2 rounded-lg border border-border bg-surface">
        <select id="employees-status" class="px-3 py-2 rounded-lg border border-border bg-surface">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>
        <div class="grid grid-cols-2 gap-2">
          <input id="employees-join-from" type="date" class="px-3 py-2 rounded-lg border border-border bg-surface">
          <input id="employees-join-to" type="date" class="px-3 py-2 rounded-lg border border-border bg-surface">
        </div>
      </div>

      <div class="bg-surface border border-border rounded-xl overflow-hidden">
        <div class="overflow-auto">
          <table class="w-full min-w-[980px] text-left">
            <thead class="bg-bg border-b border-border">
              <tr>
                <th class="px-4 py-3 text-xs uppercase text-muted">Employee</th>
                <th class="px-4 py-3 text-xs uppercase text-muted">Phone</th>
                <th class="px-4 py-3 text-xs uppercase text-muted">Joined</th>
                <th class="px-4 py-3 text-xs uppercase text-muted">Status</th>
                <th class="px-4 py-3 text-xs uppercase text-muted">Permissions</th>
                <th class="px-4 py-3 text-xs uppercase text-muted text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="employees-tbody"></tbody>
          </table>
        </div>
      </div>

      <div id="employees-pagination" class="flex items-center justify-between"></div>

      <aside id="employee-details-drawer" class="fixed top-0 right-0 h-full w-full max-w-lg bg-surface border-l border-border z-[70] p-5 overflow-y-auto transform translate-x-full transition-transform duration-300">
        <div class="flex items-center justify-between mb-4">
          <h3 id="employee-drawer-title" class="text-lg font-bold">Employee</h3>
          <button id="close-employee-drawer" class="w-8 h-8 rounded-full border border-border hover:border-primary">×</button>
        </div>
        <div id="employee-details-content"></div>
      </aside>
    </div>
  `;
}
