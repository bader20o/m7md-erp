import { EmployeePermission, Role } from "@prisma/client";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";

export type Permission =
  | "accounting"
  | "warehouse"
  | "bookings"
  | "hr"
  | "memberships"
  | "analytics"
  | "services";

export const EMPLOYEE_PERMISSIONS: Permission[] = [
  "accounting",
  "warehouse",
  "bookings",
  "hr",
  "memberships",
  "analytics",
  "services"
];

const dbToAppPermission: Record<EmployeePermission, Permission> = {
  ACCOUNTING: "accounting",
  WAREHOUSE: "warehouse",
  BOOKINGS: "bookings",
  HR: "hr",
  MEMBERSHIPS: "memberships",
  ANALYTICS: "analytics",
  SERVICES: "services"
};

export const appToDbPermission: Record<Permission, EmployeePermission> = {
  accounting: EmployeePermission.ACCOUNTING,
  warehouse: EmployeePermission.WAREHOUSE,
  bookings: EmployeePermission.BOOKINGS,
  hr: EmployeePermission.HR,
  memberships: EmployeePermission.MEMBERSHIPS,
  analytics: EmployeePermission.ANALYTICS,
  services: EmployeePermission.SERVICES
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

export async function getPermissionsForUser(userId: string, role: Role): Promise<Permission[]> {
  if (role === Role.ADMIN) {
    return EMPLOYEE_PERMISSIONS;
  }

  if (role !== Role.EMPLOYEE) {
    return [];
  }

  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { permissionGrants: { select: { permission: true } } }
  });

  if (!employee) {
    return [];
  }

  return employee.permissionGrants.map((item) => dbToAppPermission[item.permission]);
}

export async function hasPermission(userId: string, role: Role, permission: Permission): Promise<boolean> {
  const permissions = await getPermissionsForUser(userId, role);
  return permissions.includes(permission);
}

export async function requirePermission(
  session: SessionPayload | null,
  permission: Permission
): Promise<SessionPayload> {
  const activeSession = requireSession(session);
  const allowed = await hasPermission(activeSession.sub, activeSession.role, permission);
  if (!allowed) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission for this resource.");
  }
  return activeSession;
}

export async function requireAnyPermission(
  session: SessionPayload | null,
  permissions: Permission[]
): Promise<SessionPayload> {
  const activeSession = requireSession(session);
  const granted = await getPermissionsForUser(activeSession.sub, activeSession.role);
  if (!permissions.some((permission) => granted.includes(permission))) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission for this resource.");
  }
  return activeSession;
}

