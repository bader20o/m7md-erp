"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">{locale === "ar" ? "المستخدمون" : "Users"}</h1>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {ROLES.map((role) => (
          <article key={role} className="rounded-xl border border-slate-200 bg-white p-3">
            <h2 className="text-xs font-semibold text-slate-500">{role}</h2>
            <p className="mt-1 text-2xl font-bold text-brand-800">{roleCounts[role]}</p>
          </article>
        ))}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {success ? <p className="text-sm text-green-700">{success}</p> : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Locale</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => {
              const selectedRole = draftRoles[user.id] ?? user.role;
              const changed = selectedRole !== user.role;
              const isSaving = savingId === user.id;

              return (
                <tr key={user.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{user.fullName || "-"}</td>
                  <td className="px-3 py-2">{user.phone}</td>
                  <td className="px-3 py-2">
                    {canEditRoles ? (
                      <select
                        value={selectedRole}
                        onChange={(event) =>
                          setDraftRoles((prev) => ({
                            ...prev,
                            [user.id]: event.target.value as UserRole
                          }))
                        }
                        className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    ) : (
                      user.role
                    )}
                  </td>
                  <td className="px-3 py-2">{user.locale}</td>
                  <td className="px-3 py-2">{user.isActive ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">{new Date(user.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    {canEditRoles ? (
                      <button
                        type="button"
                        onClick={() => void onSave(user.id)}
                        disabled={!changed || isSaving}
                        className="rounded-md bg-brand-700 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">Read only</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
