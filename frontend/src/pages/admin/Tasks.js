import { apiFetch, buildQuery } from "../../lib/api.js";
import { Modal } from "../../components/ui/Modal.js";
import { store } from "../../lib/store.js";
import { isAdminRole, isEmployeeRole } from "../../lib/roles.js";

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "BLOCKED"];
const EMPLOYEE_TASK_STATUSES = ["DONE", "BLOCKED"];
const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

function labelize(value) {
  if (value === "BLOCKED") return "Cancelled";
  return String(value || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isTerminalTask(taskOrStatus) {
  const status = typeof taskOrStatus === "string" ? taskOrStatus : taskOrStatus?.status;
  return status === "DONE" || status === "BLOCKED";
}

function statusTone(status) {
  if (status === "TODO") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (status === "IN_PROGRESS") return "border-sky-500/30 bg-sky-500/10 text-sky-300";
  if (status === "DONE") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  return "border-danger/30 bg-danger/10 text-danger";
}

function priorityTone(priority) {
  if (priority === "HIGH") return "border-danger/30 bg-danger/10 text-danger";
  if (priority === "MEDIUM") return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  return "border-border bg-bg text-text";
}

function badge(label, tone) {
  return `<span class="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${tone}">${esc(label)}</span>`;
}

function dateTime(value) {
  return value ? new Date(value).toLocaleString() : "No deadline";
}

function dateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function employeeLabel(employee) {
  return employee?.fullName || employee?.phone || "Unknown";
}

function buildEmployeeDraft(task) {
  return {
    status: isTerminalTask(task.status) ? task.status : "DONE",
    employeeNote: task.employeeNote || ""
  };
}

function buildAdminDraft(task) {
  return {
    title: task.title,
    description: task.description || "",
    priority: task.priority,
    status: task.status,
    dueAt: dateTimeInput(task.dueAt),
    assignedToId: task.assignedToId,
    adminNote: task.adminNote || ""
  };
}

export function AdminTasks() {
  const me = store.state.user;
  if (!isAdminRole(me?.role) && !isEmployeeRole(me?.role)) {
    return `<div class="p-10 text-center text-muted">Access Denied.</div>`;
  }

  window.onMount = async () => {
    const root = document.getElementById("admin-tasks-root");
    const state = {
      me,
      loading: true,
      saving: false,
      deleting: false,
      error: "",
      tasks: [],
      employees: [],
      selectedTaskId: null,
      employeeFilter: "",
      statusFilter: "",
      search: "",
      tab: "ALL",
      drafts: {}
    };

    function cloneTasks(tasks) {
      return tasks.map((task) => ({ ...task }));
    }

    function requestAdminPassword(task) {
      return new Promise((resolve) => {
        let settled = false;
        const modal = Modal({
          title: "Confirm Admin Password",
          size: "max-w-md",
          content: `
            <form id="task-admin-password-form" class="space-y-4">
              <p class="text-sm text-muted">
                This task is ${esc(labelize(task.status))}. Enter your admin password to change its information.
              </p>
              <input
                id="task-admin-password-input"
                name="adminPassword"
                type="password"
                required
                minlength="8"
                placeholder="Admin password"
                class="w-full rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-text shadow-sm"
              >
              <div class="flex justify-end gap-3">
                <button type="button" class="modal-close rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-text hover:bg-surface">Cancel</button>
                <button type="submit" class="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm">Confirm</button>
              </div>
            </form>
          `,
          onRender: (modalEl) => {
            const input = modalEl.querySelector("#task-admin-password-input");
            input?.focus();
            modalEl.querySelector("#task-admin-password-form")?.addEventListener("submit", (event) => {
              event.preventDefault();
              settled = true;
              resolve(input.value);
              modal.close();
            });
            modalEl.querySelector(".modal-close")?.addEventListener("click", () => {
              settled = true;
              resolve(null);
            });
          }
        });

        setTimeout(() => {
          const backdrop = document.querySelector(".fixed.inset-0.z-\\[100\\]");
          backdrop?.addEventListener(
            "click",
            () => {
              if (!settled) {
                settled = true;
                resolve(null);
              }
            },
            { once: true }
          );
        }, 0);
      });
    }

    function selectedTask() {
      return state.tasks.find((task) => task.id === state.selectedTaskId) || null;
    }

    function filteredTasks() {
      const query = state.search.trim().toLowerCase();
      return state.tasks.filter((task) => {
        if (isEmployeeRole(state.me.role) && state.tab !== "ALL" && task.status !== state.tab) {
          return false;
        }
        if (isAdminRole(state.me.role) && state.statusFilter && task.status !== state.statusFilter) {
          return false;
        }
        if (isAdminRole(state.me.role) && state.employeeFilter && task.assignedToId !== state.employeeFilter) {
          return false;
        }
        if (!query) return true;

        return (
          String(task.title || "").toLowerCase().includes(query) ||
          String(task.description || "").toLowerCase().includes(query) ||
          String(employeeLabel(task.assignedTo)).toLowerCase().includes(query)
        );
      });
    }

    function syncDraft(task) {
      if (!task) return;
      state.drafts[task.id] = isAdminRole(state.me.role) ? buildAdminDraft(task) : buildEmployeeDraft(task);
    }

    async function loadData() {
      state.loading = true;
      state.error = "";
      render();
      try {
        const requests = [apiFetch(`/tasks${buildQuery(isAdminRole(state.me.role) ? {} : {})}`)];
        if (isAdminRole(state.me.role)) {
          requests.push(apiFetch("/employees"));
        }

        const [taskRes, employeeRes] = await Promise.all(requests);
        state.tasks = taskRes.items || [];
        state.employees = employeeRes?.items || [];

        if (!state.tasks.some((task) => task.id === state.selectedTaskId)) {
          state.selectedTaskId = state.tasks[0]?.id || null;
        }

        state.tasks.forEach(syncDraft);
      } catch (error) {
        state.error = error.message;
      } finally {
        state.loading = false;
        render();
      }
    }

    function selectTask(taskId) {
      state.selectedTaskId = taskId;
      const task = selectedTask();
      syncDraft(task);
      render();
    }

    async function saveEmployeeTask(taskId) {
      const draft = state.drafts[taskId];
      const task = state.tasks.find((item) => item.id === taskId);
      if (!task) return;
      if (isTerminalTask(task)) {
        window.toast("Completed or cancelled tasks cannot be changed.", "error");
        return;
      }
      if (!draft.employeeNote.trim()) {
        window.toast("A note is required when finishing or cancelling a task.", "error");
        return;
      }

      const previous = cloneTasks(state.tasks);
      const now = new Date().toISOString();

      state.saving = true;
      state.tasks = state.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              status: draft.status,
              employeeNote: draft.employeeNote,
              updatedAt: now,
              completedAt: draft.status === "DONE" ? now : null
            }
          : task
      );
      render();

      try {
        const result = await apiFetch(`/tasks/${taskId}`, {
          method: "PATCH",
          body: draft
        });
        state.tasks = state.tasks.map((task) => (task.id === taskId ? result.item : task));
        syncDraft(result.item);
        window.toast("Task updated.", "success");
      } catch (error) {
        state.tasks = previous;
        window.toast(error.message, "error");
      } finally {
        state.saving = false;
        render();
      }
    }

    async function saveAdminTask() {
      const task = selectedTask();
      if (!task) return;

      state.saving = true;
      render();
      try {
        const draft = state.drafts[task.id];
        let adminPassword;
        if (isTerminalTask(task)) {
          adminPassword = await requestAdminPassword(task);
          if (!adminPassword) {
            return;
          }
        }

        const result = await apiFetch(`/tasks/${task.id}`, {
          method: "PATCH",
          body: {
            title: draft.title,
            description: draft.description || null,
            priority: draft.priority,
            status: draft.status,
            dueAt: draft.dueAt ? new Date(draft.dueAt).toISOString() : null,
            assignedToId: draft.assignedToId,
            adminNote: draft.adminNote || null,
            adminPassword
          }
        });
        state.tasks = state.tasks.map((item) => (item.id === task.id ? result.item : item));
        syncDraft(result.item);
        window.toast("Task updated.", "success");
      } catch (error) {
        window.toast(error.message, "error");
      } finally {
        state.saving = false;
        render();
      }
    }

    async function deleteTask() {
      const task = selectedTask();
      if (!task) return;
      if (isTerminalTask(task)) {
        window.toast("Completed or cancelled tasks cannot be deleted from this screen.", "error");
        return;
      }

      state.deleting = true;
      render();
      try {
        await apiFetch(`/tasks/${task.id}`, { method: "DELETE" });
        state.tasks = state.tasks.filter((item) => item.id !== task.id);
        state.selectedTaskId = state.tasks[0]?.id || null;
        window.toast("Task deleted.", "success");
      } catch (error) {
        window.toast(error.message, "error");
      } finally {
        state.deleting = false;
        render();
      }
    }

    function openCreateModal() {
      const modalHtml = `
        <form id="create-task-form" class="space-y-4">
          <div>
            <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Assign To *</label>
            <select name="assignedToId" required class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary transition-all">
              <option value="">Select Employee</option>
              ${state.employees.map((employee) => `<option value="${employee.userId}">${esc(employeeLabel(employee))}</option>`).join("")}
            </select>
          </div>
          <div>
            <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Task Title *</label>
            <input name="title" required placeholder="Task title" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary transition-all">
          </div>
          <div>
            <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Description</label>
            <textarea name="description" rows="4" placeholder="Optional details..." class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary transition-all"></textarea>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Priority</label>
              <select name="priority" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary transition-all">
                ${TASK_PRIORITIES.map((priority) => `<option value="${priority}" ${priority === "MEDIUM" ? "selected" : ""}>${labelize(priority)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">Due Date</label>
              <input name="dueAt" type="datetime-local" class="w-full rounded-xl border border-border bg-surface px-4 py-3 shadow-sm focus:border-primary transition-all">
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button type="button" class="modal-close rounded-xl border border-border px-5 py-2.5 text-sm font-bold text-text hover:bg-surface">Cancel</button>
            <button type="submit" class="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:scale-105 transition-transform">Create Task</button>
          </div>
        </form>
      `;

      Modal({
        title: "Create Task",
        content: modalHtml,
        size: "max-w-xl",
        onRender: (modalEl) => {
          modalEl.querySelector("#create-task-form").addEventListener("submit", async (event) => {
            event.preventDefault();
            const form = event.target;
            const submitButton = form.querySelector("button[type='submit']");
            submitButton.disabled = true;
            submitButton.textContent = "Creating...";
            try {
              const result = await apiFetch("/admin/tasks", {
                method: "POST",
                body: {
                  title: form.title.value.trim(),
                  description: form.description.value.trim() || undefined,
                  priority: form.priority.value,
                  dueAt: form.dueAt.value ? new Date(form.dueAt.value).toISOString() : undefined,
                  assignedToId: form.assignedToId.value
                }
              });
              state.tasks.unshift(result.item);
              state.selectedTaskId = result.item.id;
              syncDraft(result.item);
              modalEl.querySelector(".modal-close")?.click();
              window.toast("Task created.", "success");
              render();
            } catch (error) {
              window.toast(error.message, "error");
              submitButton.disabled = false;
              submitButton.textContent = "Create Task";
            }
          });
        }
      });
    }

    function bindEmployeeEvents() {
      root.querySelectorAll("[data-tab]").forEach((button) => {
        button.addEventListener("click", () => {
          state.tab = button.dataset.tab;
          render();
        });
      });

      root.querySelectorAll("[data-task-status]").forEach((select) => {
        select.addEventListener("change", (event) => {
          const taskId = select.dataset.taskStatus;
          state.drafts[taskId] = {
            ...state.drafts[taskId],
            status: event.target.value
          };
        });
      });

      root.querySelectorAll("[data-task-note]").forEach((textarea) => {
        textarea.addEventListener("input", (event) => {
          const taskId = textarea.dataset.taskNote;
          state.drafts[taskId] = {
            ...state.drafts[taskId],
            employeeNote: event.target.value
          };
        });
      });

      root.querySelectorAll("[data-save-task]").forEach((button) => {
        button.addEventListener("click", () => {
          void saveEmployeeTask(button.dataset.saveTask);
        });
      });
    }

    function bindAdminEvents() {
      root.querySelector("#btn-create-task")?.addEventListener("click", openCreateModal);
      root.querySelector("#filter-status")?.addEventListener("change", (event) => {
        state.statusFilter = event.target.value;
        render();
      });
      root.querySelector("#filter-employee")?.addEventListener("change", (event) => {
        state.employeeFilter = event.target.value;
        render();
      });
      root.querySelector("#task-search")?.addEventListener("input", (event) => {
        state.search = event.target.value;
        render();
      });
      root.querySelectorAll("[data-open-task]").forEach((button) => {
        button.addEventListener("click", () => selectTask(button.dataset.openTask));
      });

      const task = selectedTask();
      if (task) {
        root.querySelector("#detail-title")?.addEventListener("input", (event) => {
          state.drafts[task.id].title = event.target.value;
        });
        root.querySelector("#detail-description")?.addEventListener("input", (event) => {
          state.drafts[task.id].description = event.target.value;
        });
        root.querySelector("#detail-priority")?.addEventListener("change", (event) => {
          state.drafts[task.id].priority = event.target.value;
        });
        root.querySelector("#detail-status")?.addEventListener("change", (event) => {
          state.drafts[task.id].status = event.target.value;
        });
        root.querySelector("#detail-assignee")?.addEventListener("change", (event) => {
          state.drafts[task.id].assignedToId = event.target.value;
        });
        root.querySelector("#detail-dueAt")?.addEventListener("change", (event) => {
          state.drafts[task.id].dueAt = event.target.value;
        });
        root.querySelector("#detail-admin-note")?.addEventListener("input", (event) => {
          state.drafts[task.id].adminNote = event.target.value;
        });
        root.querySelector("#btn-save-task")?.addEventListener("click", () => void saveAdminTask());
        root.querySelector("#btn-delete-task")?.addEventListener("click", () => void deleteTask());
      }
    }

    function renderEmployeeView() {
      const items = filteredTasks();
      root.innerHTML = `
        <div class="mx-auto w-full max-w-7xl space-y-6">
          <section class="rounded-[32px] border border-border bg-surface p-6 shadow-xl shadow-black/10">
            <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.28em] text-muted">Inbox</p>
                <h1 class="mt-2 text-3xl font-heading font-black tracking-tight text-text">Assigned Tasks</h1>
                <p class="mt-2 text-sm text-muted">Only your assigned tasks appear here. Choose Done or Cancelled, then send a note to the admin.</p>
              </div>
              <div class="flex flex-wrap gap-2">
                ${["ALL", ...TASK_STATUSES]
                  .map(
                    (tab) => `
                      <button data-tab="${tab}" class="rounded-full px-4 py-2 text-sm font-bold transition-all ${
                        state.tab === tab ? "bg-primary text-white shadow-md" : "border border-border bg-bg text-text hover:border-text"
                      }">
                        ${tab === "ALL" ? "All" : labelize(tab)}
                      </button>
                    `
                  )
                  .join("")}
              </div>
            </div>
          </section>

          ${
            items.length === 0
              ? `
                <div class="rounded-[32px] border border-dashed border-border bg-surface py-24 text-center">
                  <h2 class="text-2xl font-heading font-black text-text">No tasks assigned yet.</h2>
                  <p class="mt-2 text-sm text-muted">Your queue is empty for now.</p>
                </div>
              `
              : `
                <div class="grid gap-4">
                  ${items
                    .map((task) => {
                      const draft = state.drafts[task.id] || buildEmployeeDraft(task);
                      return `
                        <article class="rounded-[28px] border border-border bg-surface p-5 shadow-lg shadow-black/5">
                          <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div>
                              <div class="flex flex-wrap items-center gap-2">
                                <h2 class="text-xl font-heading font-black text-text">${esc(task.title)}</h2>
                                ${badge(task.priority, priorityTone(task.priority))}
                                ${badge(labelize(task.status), statusTone(task.status))}
                              </div>
                              <p class="mt-3 text-sm leading-6 text-muted">${esc(task.description || "No description provided.")}</p>
                              <div class="mt-4 flex flex-wrap gap-4 text-xs font-semibold text-muted">
                                <span>Due: ${esc(dateTime(task.dueAt))}</span>
                                <span>Last updated: ${esc(dateTime(task.updatedAt))}</span>
                              </div>
                            </div>
                          </div>
                          <div class="mt-5 grid gap-3 lg:grid-cols-[220px,1fr,140px]">
                            <select data-task-status="${task.id}" class="rounded-2xl border border-border bg-bg px-4 py-3 text-sm font-semibold text-text shadow-sm" ${isTerminalTask(task) ? "disabled" : ""}>
                              ${EMPLOYEE_TASK_STATUSES.map((status) => `<option value="${status}" ${draft.status === status ? "selected" : ""}>${labelize(status)}</option>`).join("")}
                            </select>
                            <textarea data-task-note="${task.id}" rows="4" class="min-h-[120px] rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-text shadow-sm" placeholder="Required note" ${isTerminalTask(task) ? "disabled" : ""}>${esc(draft.employeeNote)}</textarea>
                            <button data-save-task="${task.id}" class="rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-primary-hover disabled:opacity-60" ${state.saving || isTerminalTask(task) ? "disabled" : ""}>
                              ${isTerminalTask(task) ? "Locked" : state.saving ? "Saving..." : "Submit"}
                            </button>
                          </div>
                          <p class="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                            ${isTerminalTask(task) ? "This task is locked and can no longer be changed by the employee." : "Employees can only finish or cancel a task, with a note."}
                          </p>
                        </article>
                      `;
                    })
                    .join("")}
                </div>
              `
          }
        </div>
      `;

      bindEmployeeEvents();
    }

    function renderAdminView() {
      const items = filteredTasks();
      const task = selectedTask();
      const draft = task ? state.drafts[task.id] || buildAdminDraft(task) : null;

      root.innerHTML = `
        <div class="mx-auto w-full max-w-7xl space-y-6">
          <section class="rounded-[32px] border border-border bg-surface p-6 shadow-xl shadow-black/10">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.28em] text-muted">Admin Console</p>
                <h1 class="mt-2 text-3xl font-heading font-black tracking-tight text-text">Employee Tasks</h1>
                <p class="mt-2 text-sm text-muted">Create assignments, filter the queue, and review employee updates.</p>
              </div>
              <button id="btn-create-task" class="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-md hover:scale-105 transition-all">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"></path></svg>
                Create Task
              </button>
            </div>
          </section>

          <section class="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
            <div class="space-y-4">
              <div class="grid gap-3 rounded-[24px] border border-border bg-surface p-4 md:grid-cols-3">
                <select id="filter-employee" class="rounded-2xl border border-border bg-bg px-4 py-3 text-sm font-semibold text-text shadow-sm">
                  <option value="">All employees</option>
                  ${state.employees.map((employee) => `<option value="${employee.userId}" ${state.employeeFilter === employee.userId ? "selected" : ""}>${esc(employeeLabel(employee))}</option>`).join("")}
                </select>
                <select id="filter-status" class="rounded-2xl border border-border bg-bg px-4 py-3 text-sm font-semibold text-text shadow-sm">
                  <option value="">All statuses</option>
                  ${TASK_STATUSES.map((status) => `<option value="${status}" ${state.statusFilter === status ? "selected" : ""}>${labelize(status)}</option>`).join("")}
                </select>
                <input id="task-search" value="${esc(state.search)}" placeholder="Search title or description" class="rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-text shadow-sm">
              </div>

              ${
                items.length === 0
                  ? `
                    <div class="rounded-[28px] border border-dashed border-border bg-surface py-24 text-center">
                      <h2 class="text-xl font-heading font-black text-text">No tasks found</h2>
                      <p class="mt-2 text-sm text-muted">Create a new assignment to get started.</p>
                    </div>
                  `
                  : `
                    <div class="grid gap-3">
                      ${items
                        .map(
                          (item) => `
                            <button data-open-task="${item.id}" class="w-full rounded-[24px] border p-4 text-left transition-all ${
                              state.selectedTaskId === item.id
                                ? "border-primary bg-primary/5 shadow-md"
                                : "border-border bg-surface hover:border-text"
                            }">
                              <div class="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div class="flex flex-wrap items-center gap-2">
                                    <h2 class="text-lg font-heading font-black text-text">${esc(item.title)}</h2>
                                    ${badge(item.priority, priorityTone(item.priority))}
                                    ${badge(labelize(item.status), statusTone(item.status))}
                                  </div>
                                  <p class="mt-2 text-sm text-muted">${esc(employeeLabel(item.assignedTo))}</p>
                                </div>
                                <div class="text-right text-xs font-semibold text-muted">
                                  <p>Due ${esc(dateTime(item.dueAt))}</p>
                                  <p class="mt-1">Updated ${esc(dateTime(item.updatedAt))}</p>
                                </div>
                              </div>
                            </button>
                          `
                        )
                        .join("")}
                    </div>
                  `
              }
            </div>

            <div class="rounded-[28px] border border-border bg-surface p-5 shadow-lg shadow-black/5">
              ${
                !task
                  ? `
                    <div class="flex min-h-[420px] items-center justify-center text-center text-muted">
                      Select a task to inspect employee progress and edit task details.
                    </div>
                  `
                  : `
                    <div class="space-y-5">
                      <div class="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p class="text-xs font-bold uppercase tracking-[0.28em] text-muted">Task Detail</p>
                          <h2 class="mt-2 text-2xl font-heading font-black text-text">${esc(task.title)}</h2>
                        </div>
                        <button id="btn-delete-task" class="rounded-2xl border border-danger/30 px-4 py-2 text-sm font-bold text-danger hover:bg-danger/10" ${state.deleting ? "disabled" : ""}>
                          ${state.deleting ? "Deleting..." : isTerminalTask(task) ? "Delete Disabled" : "Delete"}
                        </button>
                      </div>

                      <div class="grid gap-3 md:grid-cols-2">
                        <input id="detail-title" value="${esc(draft.title)}" class="rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-text shadow-sm">
                        <select id="detail-assignee" class="rounded-2xl border border-border bg-bg px-4 py-3 text-sm font-semibold text-text shadow-sm">
                          ${state.employees.map((employee) => `<option value="${employee.userId}" ${draft.assignedToId === employee.userId ? "selected" : ""}>${esc(employeeLabel(employee))}</option>`).join("")}
                        </select>
                        <select id="detail-priority" class="rounded-2xl border border-border bg-bg px-4 py-3 text-sm font-semibold text-text shadow-sm">
                          ${TASK_PRIORITIES.map((priority) => `<option value="${priority}" ${draft.priority === priority ? "selected" : ""}>${labelize(priority)}</option>`).join("")}
                        </select>
                        <select id="detail-status" class="rounded-2xl border border-border bg-bg px-4 py-3 text-sm font-semibold text-text shadow-sm">
                          ${TASK_STATUSES.map((status) => `<option value="${status}" ${draft.status === status ? "selected" : ""}>${labelize(status)}</option>`).join("")}
                        </select>
                        <input id="detail-dueAt" type="datetime-local" value="${esc(draft.dueAt)}" class="rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-text shadow-sm md:col-span-2">
                        <textarea id="detail-description" rows="4" class="rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-text shadow-sm md:col-span-2" placeholder="Task description">${esc(draft.description)}</textarea>
                        <textarea id="detail-admin-note" rows="3" class="rounded-2xl border border-border bg-bg px-4 py-3 text-sm text-text shadow-sm md:col-span-2" placeholder="Admin note">${esc(draft.adminNote)}</textarea>
                      </div>

                      <div class="rounded-[22px] border border-border bg-bg p-4">
                        <div class="flex flex-wrap items-center justify-between gap-3">
                          <h3 class="text-sm font-bold uppercase tracking-[0.28em] text-muted">Employee Update</h3>
                          ${badge(labelize(task.status), statusTone(task.status))}
                        </div>
                        <p class="mt-3 text-sm leading-6 text-text">${esc(task.employeeNote || "No employee note yet.")}</p>
                        <div class="mt-4 grid gap-2 text-xs font-semibold text-muted">
                          <span>Created ${esc(dateTime(task.createdAt))}</span>
                          <span>Last status update ${esc(dateTime(task.updatedAt))}</span>
                          <span>Completed ${esc(dateTime(task.completedAt))}</span>
                        </div>
                      </div>

                      ${
                        isTerminalTask(task)
                          ? `<div class="rounded-[22px] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">This task is locked for employees. Admin edits require password confirmation.</div>`
                          : ""
                      }

                      <button id="btn-save-task" class="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-primary-hover disabled:opacity-60" ${state.saving ? "disabled" : ""}>
                        ${state.saving ? "Saving..." : isTerminalTask(task) ? "Save Changes (Password Required)" : "Save Changes"}
                      </button>
                    </div>
                  `
              }
            </div>
          </section>
        </div>
      `;

      bindAdminEvents();
    }

    function render() {
      if (state.loading) {
        root.innerHTML = `<div class="py-20 text-center text-sm font-medium text-muted animate-pulse">Loading tasks...</div>`;
        return;
      }

      if (state.error) {
        root.innerHTML = `<div class="py-20 text-center text-sm font-medium text-danger bg-danger/5 rounded-2xl border border-danger/10">${esc(state.error)}</div>`;
        return;
      }

      if (isEmployeeRole(state.me.role)) {
        renderEmployeeView();
        return;
      }

      renderAdminView();
    }

    await loadData();
  };

  return `
    <div class="mx-auto w-full max-w-7xl">
      <div id="admin-tasks-root"></div>
    </div>
  `;
}
