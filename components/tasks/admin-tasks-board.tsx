"use client";

import { useEffect, useMemo, useState } from "react";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";
type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

type EmployeeOption = {
  id: string;
  userId: string;
  fullName: string | null;
  phone: string;
};

type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string | null;
  updatedAt: string;
  createdAt: string;
  completedAt: string | null;
  employeeNote: string | null;
  adminNote: string | null;
  assignedToId: string;
  assignedTo: {
    id: string;
    fullName: string | null;
    phone: string;
    avatarUrl: string | null;
  };
  createdBy: {
    id: string;
    fullName: string | null;
    phone: string;
  };
};

type FormState = {
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string;
  assignedToId: string;
  adminNote: string;
};

type ToastState =
  | {
      tone: "success" | "error";
      message: string;
    }
  | null;

const statusClasses: Record<TaskStatus, string> = {
  TODO: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30",
  IN_PROGRESS: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/30",
  DONE: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30",
  BLOCKED: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30"
};

const priorityClasses: Record<TaskPriority, string> = {
  LOW: "bg-slate-700 text-slate-200",
  MEDIUM: "bg-amber-500/20 text-amber-200",
  HIGH: "bg-rose-500/20 text-rose-200"
};

function labelize(value: string): string {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function toDateTimeLocal(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fromTask(task: TaskItem): FormState {
  return {
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    status: task.status,
    dueAt: toDateTimeLocal(task.dueAt),
    assignedToId: task.assignedToId,
    adminNote: task.adminNote ?? ""
  };
}

export function AdminTasksBoard({ locale }: { locale: string }): React.ReactElement {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [employeeFilter, setEmployeeFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [detailForm, setDetailForm] = useState<FormState | null>(null);
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM" as TaskPriority,
    dueAt: "",
    assignedToId: ""
  });

  async function loadData(): Promise<void> {
    setLoading(true);
    try {
      const [taskResponse, employeeResponse] = await Promise.all([
        fetch("/api/tasks", { cache: "no-store" }),
        fetch("/api/employees", { cache: "no-store" })
      ]);

      const taskJson = (await taskResponse.json()) as {
        data?: { items?: TaskItem[] };
        error?: { message?: string };
      };
      const employeeJson = (await employeeResponse.json()) as {
        data?: { items?: EmployeeOption[] };
        error?: { message?: string };
      };

      if (!taskResponse.ok) {
        throw new Error(taskJson.error?.message ?? "Failed to load tasks.");
      }
      if (!employeeResponse.ok) {
        throw new Error(employeeJson.error?.message ?? "Failed to load employees.");
      }

      const nextTasks = taskJson.data?.items ?? [];
      const nextEmployees = employeeJson.data?.items ?? [];
      setTasks(nextTasks);
      setEmployees(nextEmployees);
      setCreateForm((current) => ({
        ...current,
        assignedToId: current.assignedToId || nextEmployees[0]?.userId || ""
      }));
      const nextSelected = selectedTaskId
        ? nextTasks.find((task) => task.id === selectedTaskId) ?? nextTasks[0] ?? null
        : nextTasks[0] ?? null;
      setSelectedTaskId(nextSelected?.id ?? null);
      setDetailForm(nextSelected ? fromTask(nextSelected) : null);
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Failed to load tasks." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      if (statusFilter && task.status !== statusFilter) {
        return false;
      }
      if (employeeFilter && task.assignedToId !== employeeFilter) {
        return false;
      }
      if (!query) {
        return true;
      }

      return (
        task.title.toLowerCase().includes(query) ||
        (task.description ?? "").toLowerCase().includes(query) ||
        (task.assignedTo.fullName ?? task.assignedTo.phone).toLowerCase().includes(query)
      );
    });
  }, [employeeFilter, search, statusFilter, tasks]);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks]
  );

  function selectTask(task: TaskItem): void {
    setSelectedTaskId(task.id);
    setDetailForm(fromTask(task));
  }

  async function createTask(): Promise<void> {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createForm.title,
          description: createForm.description || undefined,
          priority: createForm.priority,
          dueAt: createForm.dueAt ? new Date(createForm.dueAt).toISOString() : undefined,
          assignedToId: createForm.assignedToId
        })
      });

      const json = (await response.json()) as {
        data?: { item?: TaskItem };
        error?: { message?: string };
      };

      if (!response.ok || !json.data?.item) {
        throw new Error(json.error?.message ?? "Failed to create task.");
      }

      const nextTask = json.data.item;
      setTasks((current) => [nextTask, ...current]);
      selectTask(nextTask);
      setCreateForm({
        title: "",
        description: "",
        priority: "MEDIUM",
        dueAt: "",
        assignedToId: createForm.assignedToId
      });
      setShowCreate(false);
      setToast({ tone: "success", message: "Task created." });
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Failed to create task." });
    } finally {
      setSaving(false);
    }
  }

  async function saveSelectedTask(): Promise<void> {
    if (!selectedTask || !detailForm) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: detailForm.title,
          description: detailForm.description || null,
          priority: detailForm.priority,
          status: detailForm.status,
          dueAt: detailForm.dueAt ? new Date(detailForm.dueAt).toISOString() : null,
          assignedToId: detailForm.assignedToId,
          adminNote: detailForm.adminNote || null
        })
      });

      const json = (await response.json()) as {
        data?: { item?: TaskItem };
        error?: { message?: string };
      };

      if (!response.ok || !json.data?.item) {
        throw new Error(json.error?.message ?? "Failed to update task.");
      }

      const nextTask = json.data.item;
      setTasks((current) => current.map((task) => (task.id === nextTask.id ? nextTask : task)));
      setDetailForm(fromTask(nextTask));
      setToast({ tone: "success", message: "Task updated." });
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Failed to update task." });
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedTask(): Promise<void> {
    if (!selectedTask) {
      return;
    }

    setDeleteBusy(true);
    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}`, { method: "DELETE" });
      const json = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(json.error?.message ?? "Failed to delete task.");
      }

      const remaining = tasks.filter((task) => task.id !== selectedTask.id);
      setTasks(remaining);
      const nextSelected = remaining[0] ?? null;
      setSelectedTaskId(nextSelected?.id ?? null);
      setDetailForm(nextSelected ? fromTask(nextSelected) : null);
      setToast({ tone: "success", message: "Task deleted." });
    } catch (error) {
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Failed to delete task." });
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-slate-950 px-6 py-6 text-white shadow-[0_30px_80px_-48px_rgba(15,23,42,0.9)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Admin Console</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Employee Tasks</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Assign tasks, monitor progress, and review employee notes from one queue.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            Create Task
          </button>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <div className="space-y-4">
          <div className="grid gap-3 rounded-[24px] border border-white/10 bg-slate-950/95 p-4 md:grid-cols-3">
            <select
              value={employeeFilter}
              onChange={(event) => setEmployeeFilter(event.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
            >
              <option value="">All employees</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.userId}>
                  {employee.fullName || employee.phone}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
            >
              <option value="">All statuses</option>
              <option value="TODO">Todo</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DONE">Done</option>
              <option value="BLOCKED">Blocked</option>
            </select>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title or description"
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse rounded-[22px] border border-white/10 bg-slate-950/80" />
              ))
            ) : filteredTasks.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-700 bg-slate-950/80 px-6 py-12 text-center text-slate-300">
                No tasks found.
              </div>
            ) : (
              filteredTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => selectTask(task)}
                  className={`w-full rounded-[22px] border p-4 text-left transition ${
                    selectedTaskId === task.id
                      ? "border-sky-400/50 bg-slate-900 text-white"
                      : "border-white/10 bg-slate-950/95 text-slate-200 hover:border-white/20 hover:bg-slate-900/90"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{task.title}</h2>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClasses[task.priority]}`}>
                          {task.priority}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[task.status]}`}>
                          {labelize(task.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">{task.assignedTo.fullName || task.assignedTo.phone}</p>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <p>Due {task.dueAt ? new Date(task.dueAt).toLocaleString(locale) : "Any time"}</p>
                      <p className="mt-1">Updated {new Date(task.updatedAt).toLocaleString(locale)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-slate-950/95 p-5 text-white">
          {!selectedTask || !detailForm ? (
            <div className="flex h-full min-h-80 items-center justify-center text-center text-slate-400">
              Select a task to inspect employee progress and edit details.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Task Detail</p>
                  <h2 className="mt-2 text-2xl font-semibold">{selectedTask.title}</h2>
                </div>
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={() => void deleteSelectedTask()}
                  className="rounded-2xl border border-rose-500/30 px-4 py-2 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-60"
                >
                  {deleteBusy ? "Deleting..." : "Delete"}
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={detailForm.title}
                  onChange={(event) => setDetailForm({ ...detailForm, title: event.target.value })}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                />
                <select
                  value={detailForm.assignedToId}
                  onChange={(event) => setDetailForm({ ...detailForm, assignedToId: event.target.value })}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                >
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.userId}>
                      {employee.fullName || employee.phone}
                    </option>
                  ))}
                </select>
                <select
                  value={detailForm.priority}
                  onChange={(event) => setDetailForm({ ...detailForm, priority: event.target.value as TaskPriority })}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
                <select
                  value={detailForm.status}
                  onChange={(event) => setDetailForm({ ...detailForm, status: event.target.value as TaskStatus })}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                >
                  <option value="TODO">Todo</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                  <option value="BLOCKED">Blocked</option>
                </select>
                <input
                  type="datetime-local"
                  value={detailForm.dueAt}
                  onChange={(event) => setDetailForm({ ...detailForm, dueAt: event.target.value })}
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white md:col-span-2"
                />
                <textarea
                  value={detailForm.description}
                  onChange={(event) => setDetailForm({ ...detailForm, description: event.target.value })}
                  rows={4}
                  placeholder="Task description"
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500 md:col-span-2"
                />
                <textarea
                  value={detailForm.adminNote}
                  onChange={(event) => setDetailForm({ ...detailForm, adminNote: event.target.value })}
                  rows={3}
                  placeholder="Admin note"
                  className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500 md:col-span-2"
                />
              </div>

              <div className="rounded-[20px] border border-white/10 bg-slate-900/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Employee Update</h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[selectedTask.status]}`}>
                    {labelize(selectedTask.status)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  {selectedTask.employeeNote?.trim() ? selectedTask.employeeNote : "No employee note yet."}
                </p>
                <div className="mt-4 grid gap-2 text-xs text-slate-500">
                  <span>Created {new Date(selectedTask.createdAt).toLocaleString(locale)}</span>
                  <span>Last status update {new Date(selectedTask.updatedAt).toLocaleString(locale)}</span>
                  <span>Completed {selectedTask.completedAt ? new Date(selectedTask.completedAt).toLocaleString(locale) : "Not completed"}</span>
                </div>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => void saveSelectedTask()}
                className="w-full rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>
      </section>

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-slate-950 p-6 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">New Assignment</p>
                <h2 className="mt-2 text-2xl font-semibold">Create Task</h2>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-slate-400 hover:text-white">
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <select
                value={createForm.assignedToId}
                onChange={(event) => setCreateForm({ ...createForm, assignedToId: event.target.value })}
                className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
              >
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.userId}>
                    {employee.fullName || employee.phone}
                  </option>
                ))}
              </select>
              <select
                value={createForm.priority}
                onChange={(event) => setCreateForm({ ...createForm, priority: event.target.value as TaskPriority })}
                className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
              <input
                value={createForm.title}
                onChange={(event) => setCreateForm({ ...createForm, title: event.target.value })}
                placeholder="Task title"
                className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500 md:col-span-2"
              />
              <textarea
                value={createForm.description}
                onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })}
                rows={4}
                placeholder="Description"
                className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500 md:col-span-2"
              />
              <input
                type="datetime-local"
                value={createForm.dueAt}
                onChange={(event) => setCreateForm({ ...createForm, dueAt: event.target.value })}
                className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white md:col-span-2"
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !createForm.title.trim() || !createForm.assignedToId}
                onClick={() => void createTask()}
                className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
              >
                {saving ? "Creating..." : "Create Task"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-5 right-5 z-50 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${
            toast.tone === "success" ? "bg-emerald-500 text-slate-950" : "bg-rose-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
