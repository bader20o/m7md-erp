"use client";

import { useEffect, useMemo, useState } from "react";

type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "BLOCKED";
type EmployeeSubmitStatus = "DONE" | "BLOCKED";
type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueAt: string | null;
  updatedAt: string;
  completedAt: string | null;
  employeeNote: string | null;
};

type ToastState =
  | {
      tone: "success" | "error";
      message: string;
    }
  | null;

const tabs: Array<{ key: "ALL" | TaskStatus; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "TODO", label: "Todo" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "DONE", label: "Done" },
  { key: "BLOCKED", label: "Blocked" }
];

function toEmployeeSubmitStatus(status: TaskStatus): EmployeeSubmitStatus {
  return status === "BLOCKED" ? "BLOCKED" : "DONE";
}

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

export function EmployeeTasksBoard({ locale }: { locale: string }): React.ReactElement {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [filter, setFilter] = useState<"ALL" | TaskStatus>("ALL");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [drafts, setDrafts] = useState<Record<string, { status: EmployeeSubmitStatus; employeeNote: string }>>({});

  useEffect(() => {
    let active = true;

    async function loadTasks(): Promise<void> {
      setLoading(true);
      try {
        const response = await fetch("/api/tasks", { cache: "no-store" });
        const json = (await response.json()) as {
          data?: { items?: TaskItem[] };
          error?: { message?: string };
        };

        if (!response.ok) {
          throw new Error(json.error?.message ?? "Failed to load tasks.");
        }

        if (!active) {
          return;
        }

        const nextTasks = json.data?.items ?? [];
        setTasks(nextTasks);
        setDrafts(
          Object.fromEntries(
            nextTasks.map((task) => [
              task.id,
              {
                status: toEmployeeSubmitStatus(task.status),
                employeeNote: task.employeeNote ?? ""
              }
            ])
          )
        );
      } catch (error) {
        if (active) {
          setToast({ tone: "error", message: error instanceof Error ? error.message : "Failed to load tasks." });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadTasks();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => (filter === "ALL" ? true : task.status === filter));
  }, [filter, tasks]);

  async function saveTask(taskId: string): Promise<void> {
    const previousTasks = tasks;
    const draft = drafts[taskId];
    if (!draft) {
      return;
    }
    if (!draft.employeeNote.trim()) {
      setToast({ tone: "error", message: "A note is required when submitting a task update." });
      return;
    }

    const optimisticTasks = tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            status: draft.status,
            employeeNote: draft.employeeNote,
            updatedAt: new Date().toISOString(),
            completedAt: draft.status === "DONE" ? new Date().toISOString() : null
          }
        : task
    );

    setSavingId(taskId);
    setTasks(optimisticTasks);

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const json = (await response.json()) as {
        data?: { item?: TaskItem };
        error?: { message?: string };
      };

      if (!response.ok || !json.data?.item) {
        throw new Error(json.error?.message ?? "Failed to save task.");
      }

      setTasks((current) => current.map((task) => (task.id === taskId ? json.data!.item! : task)));
      setDrafts((current) => ({
        ...current,
        [taskId]: {
          status: toEmployeeSubmitStatus(json.data!.item!.status),
          employeeNote: json.data!.item!.employeeNote ?? ""
        }
      }));
      setToast({ tone: "success", message: "Task updated." });
    } catch (error) {
      setTasks(previousTasks);
      setToast({ tone: "error", message: error instanceof Error ? error.message : "Failed to save task." });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-white/10 bg-slate-950 px-6 py-6 text-white shadow-[0_30px_80px_-48px_rgba(15,23,42,0.9)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Inbox</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Assigned Tasks</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Update your task status, leave a note for the admin, and keep the queue current.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  filter === tab.key
                    ? "bg-white text-slate-950"
                    : "bg-slate-900 text-slate-300 ring-1 ring-white/10 hover:bg-slate-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-[24px] border border-white/10 bg-slate-950/80" />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <section className="rounded-[24px] border border-dashed border-slate-700 bg-slate-950/80 px-6 py-12 text-center text-slate-300">
          <h2 className="text-xl font-semibold text-white">No tasks assigned yet.</h2>
          <p className="mt-2 text-sm text-slate-400">Your inbox is empty right now.</p>
        </section>
      ) : (
        <div className="grid gap-4">
          {filteredTasks.map((task) => {
            const draft = drafts[task.id] ?? { status: toEmployeeSubmitStatus(task.status), employeeNote: task.employeeNote ?? "" };
            const isSaving = savingId === task.id;
            const isTerminal = task.status === "DONE" || task.status === "BLOCKED";
            const hasValidNote = draft.employeeNote.trim().length > 0;

            return (
              <article
                key={task.id}
                className="rounded-[24px] border border-white/10 bg-slate-950/95 p-5 text-slate-100 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.9)]"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-white">{task.title}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityClasses[task.priority]}`}>
                      {task.priority}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[task.status]}`}>
                      {labelize(task.status)}
                    </span>
                  </div>
                  {task.description ? <p className="max-w-3xl text-sm leading-6 text-slate-300">{task.description}</p> : null}
                  <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                    <span>Due: {task.dueAt ? new Date(task.dueAt).toLocaleString(locale) : "No deadline"}</span>
                    <span>Last updated: {new Date(task.updatedAt).toLocaleString(locale)}</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-[220px,1fr,120px]">
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [task.id]: { ...draft, status: event.target.value as EmployeeSubmitStatus }
                      }))
                    }
                    disabled={isTerminal}
                    className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
                  >
                    <option value="DONE">Done</option>
                    <option value="BLOCKED">Blocked</option>
                  </select>
                  <textarea
                    value={draft.employeeNote}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [task.id]: { ...draft, employeeNote: event.target.value }
                      }))
                    }
                    placeholder="Update / Note"
                    rows={4}
                    disabled={isTerminal}
                    className="min-h-28 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    disabled={isSaving || isTerminal || !hasValidNote}
                    onClick={() => void saveTask(task.id)}
                    className="rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isTerminal ? "Locked" : isSaving ? "Saving..." : "Save"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

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
