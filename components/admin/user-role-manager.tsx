"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ResponsiveDataTable } from "@/components/ui/responsive-data-table";

type UserRole = "CUSTOMER" | "EMPLOYEE" | "ADMIN";

type UserRow = {
  id: string;
  fullName: string | null;
  phone: string;
  role: UserRole;
  locale: string;
  isActive: boolean;
  createdAt: string;
};

type Props = {
  users: UserRow[];
  locale: string;
  canEditRoles: boolean;
};

type ApiErrorPayload = {
  error?: { message?: string };
};

const ROLES: UserRole[] = ["CUSTOMER", "EMPLOYEE", "ADMIN"];

function getErrorMessage(payload: unknown, fallback: string): string {
  const typed = payload as ApiErrorPayload;
  return typed?.error?.message ?? fallback;
}

export function UserRoleManager({ users, locale, canEditRoles }: Props): React.ReactElement {
  const router = useRouter();
  const [rows, setRows] = useState(users);
  const [draftRoles, setDraftRoles] = useState<Record<string, UserRole>>(
    Object.fromEntries(users.map((user) => [user.id, user.role])) as Record<string, UserRole>
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const roleCounts = ROLES.reduce<Record<UserRole, number>>((acc, role) => {
    acc[role] = rows.filter((row) => row.role === role).length;
    return acc;
  }, {} as Record<UserRole, number>);

  function renderRoleSelect(user: UserRow, compact = false): React.ReactNode {
    const selectedRole = draftRoles[user.id] ?? user.role;

    if (!canEditRoles) {
      return user.role;
    }

    return (
      <select
        value={selectedRole}
        onChange={(event) =>
          setDraftRoles((prev) => ({
            ...prev,
            [user.id]: event.target.value as UserRole
          }))
        }
        className={`min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ${compact ? "w-full" : ""}`.trim()}
      >
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
    );
  }

  async function onSave(userId: string): Promise<void> {
    const nextRole = draftRoles[userId];
    const user = rows.find((row) => row.id === userId);
    if (!user || !nextRole || nextRole === user.role) {
      return;
    }

    setSavingId(userId);
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        role: nextRole
      })
    });
    const json = (await response.json()) as unknown;
    setSavingId(null);

    if (!response.ok) {
      setError(getErrorMessage(json, "Failed to update user role."));
      return;
    }

    setRows((prev) =>
      prev.map((item) =>
        item.id === userId
          ? {
              ...item,
              role: nextRole
            }
          : item
      )
    );
    setSuccess("Role updated.");
    router.refresh();
  }

  function renderSaveAction(user: UserRow, fullWidth = false): React.ReactNode {
    const selectedRole = draftRoles[user.id] ?? user.role;
    const changed = selectedRole !== user.role;
    const isSaving = savingId === user.id;

    if (!canEditRoles) {
      return <span className="text-xs text-slate-500">Read only</span>;
    }

    return (
      <button
        type="button"
        onClick={() => void onSave(user.id)}
        disabled={!changed || isSaving}
        className={`rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50 ${fullWidth ? "w-full" : ""}`.trim()}
      >
        {isSaving ? "Saving..." : "Save Role"}
      </button>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{locale === "ar" ? "Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙˆÙ†" : "Users"}</h1>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {ROLES.map((role) => (
          <article key={role} className="rounded-xl border border-slate-200 bg-white p-3">
            <h2 className="text-xs font-semibold text-slate-500">{role}</h2>
            <p className="mt-1 text-2xl font-bold text-brand-800">{roleCounts[role]}</p>
          </article>
        ))}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}

      <ResponsiveDataTable
        items={rows}
        getKey={(user) => user.id}
        emptyState="No users found."
        tableClassName="border border-slate-200 bg-white"
        columns={[
          {
            key: "name",
            header: "Name",
            cell: (user) => user.fullName || "-"
          },
          {
            key: "phone",
            header: "Phone",
            cell: (user) => user.phone
          },
          {
            key: "role",
            header: "Role",
            cell: (user) => renderRoleSelect(user)
          },
          {
            key: "locale",
            header: "Locale",
            cell: (user) => user.locale
          },
          {
            key: "active",
            header: "Active",
            cell: (user) => (user.isActive ? "Yes" : "No")
          },
          {
            key: "created",
            header: "Created",
            cell: (user) => new Date(user.createdAt).toLocaleString()
          },
          {
            key: "actions",
            header: "Actions",
            cell: (user) => renderSaveAction(user)
          }
        ]}
        cardTitle={(user) => user.fullName || user.phone}
        cardBadge={(user) => (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {draftRoles[user.id] ?? user.role}
          </span>
        )}
        cardSubtitle={(user) => user.phone}
        cardFields={[
          {
            key: "locale",
            label: "Locale",
            value: (user) => user.locale
          },
          {
            key: "active",
            label: "Active",
            value: (user) => (user.isActive ? "Yes" : "No")
          },
          {
            key: "created",
            label: "Created",
            value: (user) => new Date(user.createdAt).toLocaleString()
          },
          {
            key: "role-edit",
            label: "Role",
            value: (user) => renderRoleSelect(user, true)
          }
        ]}
        cardActions={(user) => renderSaveAction(user, true)}
      />
    </section>
  );
}
