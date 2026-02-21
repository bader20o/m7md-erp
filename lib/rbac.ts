import type { Role } from "@prisma/client";
import { ApiError } from "@/lib/api";
import type { SessionPayload } from "@/lib/auth";

export type Permission =
  | "bookings.manage"
  | "bookings.walkin"
  | "customers.manage"
  | "reviews.moderate"
  | "membership.manage"
  | "membership.adjust"
  | "users.manage"
  | "attendance.own"
  | "attendance.manage"
  | "salaries.manage"
  | "services.manage"
  | "offers.manage"
  | "about.manage"
  | "hours.manage"
  | "ledger.read"
  | "ledger.write"
  | "reports.read"
  | "suppliers.manage"
  | "invoices.manage"
  | "audit.read"
  | "backup.manage"
  | "system.admin";

const ALL_PERMISSIONS: Permission[] = [
  "bookings.manage",
  "bookings.walkin",
  "customers.manage",
  "reviews.moderate",
  "membership.manage",
  "membership.adjust",
  "users.manage",
  "attendance.own",
  "attendance.manage",
  "salaries.manage",
  "services.manage",
  "offers.manage",
  "about.manage",
  "hours.manage",
  "ledger.read",
  "ledger.write",
  "reports.read",
  "suppliers.manage",
  "invoices.manage",
  "audit.read",
  "backup.manage",
  "system.admin"
];

export const rolePermissions: Record<Role, Permission[]> = {
  CUSTOMER: [],
  EMPLOYEE: ["attendance.own"],
  RECEPTION: ["bookings.walkin", "bookings.manage", "customers.manage", "attendance.manage", "ledger.write"],
  ACCOUNTANT: ["ledger.read", "ledger.write", "reports.read", "suppliers.manage", "invoices.manage", "salaries.manage"],
  MANAGER: [
    "bookings.manage",
    "bookings.walkin",
    "customers.manage",
    "reviews.moderate",
    "membership.manage",
    "attendance.manage",
    "salaries.manage",
    "services.manage",
    "offers.manage",
    "about.manage",
    "hours.manage",
    "ledger.read",
    "ledger.write",
    "reports.read",
    "suppliers.manage",
    "invoices.manage"
  ],
  ADMIN: ALL_PERMISSIONS
};

export function requireSession(session: SessionPayload | null): SessionPayload {
  if (!session) {
    throw new ApiError(401, "UNAUTHENTICATED", "You must be logged in.");
  }
  return session;
}

export function requireRoles(session: SessionPayload | null, allowed: Role[]): SessionPayload {
  const activeSession = requireSession(session);
  if (!allowed.includes(activeSession.role)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission for this resource.");
  }
  return activeSession;
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function requirePermission(session: SessionPayload | null, permission: Permission): SessionPayload {
  const activeSession = requireSession(session);
  if (!hasPermission(activeSession.role, permission)) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission for this resource.");
  }
  return activeSession;
}
