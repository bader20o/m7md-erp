import { PERMISSIONS, ROLES, hasPermission, isAdminRole } from "./roles.js";

export const PUBLIC_ROUTES = new Set(["/", "/services", "/contact", "/login", "/register"]);

export const CUSTOMER_ROUTES = new Set([
  "/home",
  "/dashboard",
  "/book",
  "/history",
  "/my-bookings",
  "/chat",
  "/membership",
  "/profile"
]);

export const ADMIN_ROUTE_ACCESS = {
  "/admin/dashboard": {
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE],
    permission: PERMISSIONS.ANALYTICS
  },
  "/admin/analytics": {
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE],
    permission: PERMISSIONS.ANALYTICS
  },
  "/admin/customers": {
    roles: [ROLES.ADMIN]
  },
  "/admin/employees": {
    roles: [ROLES.ADMIN]
  },
  "/admin/bookings": {
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE],
    permission: PERMISSIONS.BOOKINGS
  },
  "/admin/chat": {
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE]
  },
  "/admin/inventory": {
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE],
    permission: PERMISSIONS.WAREHOUSE
  },
  "/admin/accounting": {
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE],
    permission: PERMISSIONS.ACCOUNTING
  },
  "/admin/memberships": {
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE],
    permission: PERMISSIONS.MEMBERSHIPS
  },
  "/admin/services": {
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE],
    permission: PERMISSIONS.SERVICES
  },
  "/admin/settings": {
    roles: [ROLES.ADMIN]
  },
  "/admin/profile": {
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE]
  },
  "/forbidden": {
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE]
  }
};

export const ADMIN_ONLY_ROUTES = new Set(["/admin/settings"]);

export const CUSTOMER_NAV_ITEMS = [
  {
    path: "/profile",
    match: ["/profile"],
    label: "Profile",
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>'
  },
  {
    path: "/home",
    match: ["/home", "/dashboard"],
    label: "Home",
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>'
  },
  {
    path: "/book",
    match: ["/book"],
    label: "Book",
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>'
  },
  {
    path: "/history",
    match: ["/history", "/my-bookings"],
    label: "History",
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>'
  },
  {
    path: "/chat",
    match: ["/chat"],
    label: "Chat",
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>'
  },
  {
    path: "/membership",
    match: ["/membership"],
    label: "Membership",
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>'
  }
];

export const ADMIN_NAV_ITEMS = [
  {
    path: "/admin/dashboard",
    match: ["/admin/dashboard", "/admin/analytics"],
    label: "Dashboard",
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE],
    permission: PERMISSIONS.ANALYTICS,
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>'
  },
  {
    path: "/admin/customers",
    match: ["/admin/customers"],
    label: "Customers",
    roles: [ROLES.ADMIN],
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>'
  },
  {
    path: "/admin/employees",
    match: ["/admin/employees"],
    label: "Employees",
    roles: [ROLES.ADMIN],
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>'
  },
  {
    path: "/admin/bookings",
    match: ["/admin/bookings"],
    label: "Bookings",
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE],
    permission: PERMISSIONS.BOOKINGS,
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>'
  },
  {
    path: "/admin/chat",
    match: ["/admin/chat"],
    label: "Chat",
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE],
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5l-2 2V6a2 2 0 012-2h14a2 2 0 012 2v7a2 2 0 01-2 2h-5l-3 3v-3z"/>'
  },
  {
    path: "/admin/inventory",
    match: ["/admin/inventory"],
    label: "Inventory",
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE],
    permission: PERMISSIONS.WAREHOUSE,
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0v10l-8 4m8-14l-8 4m0 10L4 17V7m8 4v10"/>'
  },
  {
    path: "/admin/accounting",
    match: ["/admin/accounting"],
    label: "Accounting",
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE],
    permission: PERMISSIONS.ACCOUNTING,
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>'
  },
  {
    path: "/admin/memberships",
    match: ["/admin/memberships"],
    label: "Memberships",
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE],
    permission: PERMISSIONS.MEMBERSHIPS,
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>'
  },
  {
    path: "/admin/services",
    match: ["/admin/services"],
    label: "Services",
    roles: [ROLES.ADMIN, ROLES.EMPLOYEE],
    permission: PERMISSIONS.SERVICES,
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>'
  },
  {
    path: "/admin/settings",
    match: ["/admin/settings"],
    label: "Settings",
    roles: [ROLES.ADMIN],
    icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-1.14 1.603-1.14 1.902 0a1 1 0 00.95.69 1 1 0 01.995 1.1l-.08.871a1 1 0 00.293.832l.617.618a1 1 0 001.117.21l.803-.34a1 1 0 011.273.583l.348.803a1 1 0 01-.211 1.117l-.617.617a1 1 0 00-.293.833l.08.87a1 1 0 01-.995 1.101 1 1 0 00-.95.69c-.3 1.139-1.603 1.139-1.902 0a1 1 0 00-.95-.69 1 1 0 01-.995-1.1l.08-.871a1 1 0 00-.293-.832l-.617-.618a1 1 0 00-1.117-.21l-.803.34a1 1 0 01-1.273-.583l-.348-.803a1 1 0 01.211-1.117l.617-.617a1 1 0 00.293-.833l-.08-.87a1 1 0 01.995-1.101 1 1 0 00.95-.69z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>'
  }
];

export function isAllowedAdminRoute(pathname, user) {
  const config = ADMIN_ROUTE_ACCESS[pathname];
  if (!config || !user) return false;
  if (!config.roles.includes(user.role)) return false;
  if (!config.permission) return true;
  if (isAdminRole(user.role)) return true;
  return hasPermission(user, config.permission);
}
