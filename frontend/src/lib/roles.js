export const ROLES = {
  ADMIN: "ADMIN",
  EMPLOYEE: "EMPLOYEE",
  CUSTOMER: "CUSTOMER"
};

export const PERMISSIONS = {
  ACCOUNTING: "accounting",
  WAREHOUSE: "warehouse",
  BOOKINGS: "bookings",
  HR: "hr",
  MEMBERSHIPS: "memberships",
  ANALYTICS: "analytics",
  SERVICES: "services"
};

export function isAdminRole(role) {
  return role === ROLES.ADMIN;
}

export function isEmployeeRole(role) {
  return role === ROLES.EMPLOYEE;
}

export function isCustomerRole(role) {
  return role === ROLES.CUSTOMER;
}

export function isStaffRole(role) {
  return isAdminRole(role) || isEmployeeRole(role);
}

export function hasPermission(user, permission) {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  if (!isEmployeeRole(user.role)) return false;
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
}

function firstEmployeeRoute(user) {
  if (hasPermission(user, PERMISSIONS.ANALYTICS)) return "/admin/dashboard";
  if (hasPermission(user, PERMISSIONS.BOOKINGS)) return "/admin/bookings";
  if (hasPermission(user, PERMISSIONS.WAREHOUSE)) return "/admin/inventory";
  if (hasPermission(user, PERMISSIONS.ACCOUNTING)) return "/admin/accounting";
  if (hasPermission(user, PERMISSIONS.MEMBERSHIPS)) return "/admin/memberships";
  if (hasPermission(user, PERMISSIONS.SERVICES)) return "/admin/services";
  return "/admin/profile";
}

export function getDefaultRouteForUser(user) {
  if (!user) return "/login";
  if (isAdminRole(user.role)) return "/admin/dashboard";
  if (isCustomerRole(user.role)) return "/home";
  if (isEmployeeRole(user.role)) return firstEmployeeRoute(user);
  return "/login";
}
