import type { Role } from "@prisma/client";

export type MenuGroupKey = "main" | "customers" | "employees" | "center" | "accounting" | "system";

export type MenuIconKey =
  | "LayoutDashboard"
  | "MessageSquare"
  | "CalendarPlus"
  | "CalendarCheck"
  | "CreditCard"
  | "UserRound"
  | "CalendarRange"
  | "BadgeDollarSign"
  | "UsersRound"
  | "ScanLine"
  | "Wallet"
  | "Wrench"
  | "Presentation"
  | "Settings2"
  | "Clock3"
  | "Boxes"
  | "Landmark"
  | "Receipt"
  | "Truck"
  | "ChartNoAxesCombined"
  | "ShieldCheck"
  | "DatabaseBackup";

export type MenuItemConfig = {
  key: string;
  labelKey: string;
  href: string;
  rolesAllowed: Role[];
  group: MenuGroupKey;
  icon?: MenuIconKey;
};

export const ADMIN_GROUP_ORDER: Exclude<MenuGroupKey, "main">[] = [
  "customers",
  "employees",
  "center",
  "accounting",
  "system"
];

export const menuItems: MenuItemConfig[] = [
  {
    key: "dashboard",
    labelKey: "menuDashboard",
    href: "/",
    rolesAllowed: ["CUSTOMER", "EMPLOYEE", "RECEPTION", "ACCOUNTANT", "MANAGER", "ADMIN"],
    group: "main",
    icon: "LayoutDashboard"
  },
  {
    key: "book_service",
    labelKey: "menuBookService",
    href: "/bookings/new",
    rolesAllowed: ["CUSTOMER"],
    group: "main",
    icon: "CalendarPlus"
  },
  {
    key: "my_bookings",
    labelKey: "menuMyBookings",
    href: "/my-bookings",
    rolesAllowed: ["CUSTOMER"],
    group: "main",
    icon: "CalendarCheck"
  },
  {
    key: "memberships",
    labelKey: "menuMemberships",
    href: "/memberships",
    rolesAllowed: ["CUSTOMER"],
    group: "main",
    icon: "CreditCard"
  },
  {
    key: "profile",
    labelKey: "menuProfile",
    href: "/profile",
    rolesAllowed: ["CUSTOMER", "EMPLOYEE", "RECEPTION", "ACCOUNTANT", "MANAGER", "ADMIN"],
    group: "main",
    icon: "UserRound"
  },
  {
    key: "chat",
    labelKey: "menuChat",
    href: "/chat",
    rolesAllowed: ["CUSTOMER", "EMPLOYEE", "RECEPTION", "ACCOUNTANT", "MANAGER", "ADMIN"],
    group: "main",
    icon: "MessageSquare"
  },
  {
    key: "admin_bookings",
    labelKey: "menuBookings",
    href: "/admin/bookings",
    rolesAllowed: ["RECEPTION", "MANAGER", "ADMIN"],
    group: "customers",
    icon: "CalendarRange"
  },
  {
    key: "admin_reviews",
    labelKey: "menuReviews",
    href: "/admin/reviews",
    rolesAllowed: ["MANAGER", "ADMIN"],
    group: "customers",
    icon: "MessageSquare"
  },
  {
    key: "admin_membership_orders",
    labelKey: "menuMembershipOrders",
    href: "/admin/membership-orders",
    rolesAllowed: ["RECEPTION", "MANAGER", "ADMIN"],
    group: "customers",
    icon: "BadgeDollarSign"
  },
  {
    key: "admin_users",
    labelKey: "menuUsers",
    href: "/admin/users",
    rolesAllowed: ["MANAGER", "ADMIN"],
    group: "customers",
    icon: "UsersRound"
  },
  {
    key: "admin_attendance",
    labelKey: "menuAttendance",
    href: "/admin/attendance",
    rolesAllowed: ["RECEPTION", "MANAGER", "ADMIN"],
    group: "employees",
    icon: "ScanLine"
  },
  {
    key: "admin_salaries",
    labelKey: "menuSalaries",
    href: "/admin/salaries",
    rolesAllowed: ["ACCOUNTANT", "MANAGER", "ADMIN"],
    group: "employees",
    icon: "Wallet"
  },
  {
    key: "admin_services",
    labelKey: "menuServices",
    href: "/admin/services",
    rolesAllowed: ["MANAGER", "ADMIN"],
    group: "center",
    icon: "Wrench"
  },
  {
    key: "admin_offers",
    labelKey: "menuOffersSlider",
    href: "/admin/offers",
    rolesAllowed: ["MANAGER", "ADMIN"],
    group: "center",
    icon: "Presentation"
  },
  {
    key: "admin_about_settings",
    labelKey: "menuAboutSettings",
    href: "/admin/about-settings",
    rolesAllowed: ["MANAGER", "ADMIN"],
    group: "center",
    icon: "Settings2"
  },
  {
    key: "admin_working_hours",
    labelKey: "menuWorkingHours",
    href: "/admin/working-hours",
    rolesAllowed: ["MANAGER", "ADMIN"],
    group: "center",
    icon: "Clock3"
  },
  {
    key: "admin_inventory",
    labelKey: "menuInventory",
    href: "/admin/inventory",
    rolesAllowed: ["MANAGER", "ADMIN"],
    group: "center",
    icon: "Boxes"
  },
  {
    key: "admin_transactions",
    labelKey: "menuTransactions",
    href: "/admin/transactions",
    rolesAllowed: ["ACCOUNTANT", "MANAGER", "ADMIN"],
    group: "accounting",
    icon: "Landmark"
  },
  {
    key: "admin_invoices",
    labelKey: "menuInvoices",
    href: "/admin/invoices",
    rolesAllowed: ["ACCOUNTANT", "MANAGER", "ADMIN"],
    group: "accounting",
    icon: "Receipt"
  },
  {
    key: "admin_suppliers",
    labelKey: "menuSuppliers",
    href: "/admin/suppliers",
    rolesAllowed: ["ACCOUNTANT", "MANAGER", "ADMIN"],
    group: "accounting",
    icon: "Truck"
  },
  {
    key: "admin_reports",
    labelKey: "menuReports",
    href: "/admin/reports/analytics",
    rolesAllowed: ["ACCOUNTANT", "MANAGER", "ADMIN"],
    group: "accounting",
    icon: "ChartNoAxesCombined"
  },
  {
    key: "admin_analytics",
    labelKey: "menuAnalytics",
    href: "/admin/analytics",
    rolesAllowed: ["ADMIN"],
    group: "accounting",
    icon: "ChartNoAxesCombined"
  },
  {
    key: "admin_audit_logs",
    labelKey: "menuAuditLogs",
    href: "/admin/audit-logs",
    rolesAllowed: ["ADMIN"],
    group: "system",
    icon: "ShieldCheck"
  },
  {
    key: "admin_backups",
    labelKey: "menuBackups",
    href: "/admin/backups",
    rolesAllowed: ["ADMIN"],
    group: "system",
    icon: "DatabaseBackup"
  }
];

export function getVisibleMenuItems(role: Role): MenuItemConfig[] {
  return menuItems.filter((item) => item.rolesAllowed.includes(role));
}

export function isAdminRole(role: Role): boolean {
  return role === "RECEPTION" || role === "ACCOUNTANT" || role === "MANAGER" || role === "ADMIN";
}

export function withLocale(locale: string, href: string): string {
  if (href === "/") {
    return `/${locale}`;
  }
  return `/${locale}${href}`;
}
