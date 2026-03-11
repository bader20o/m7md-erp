import { AdminLayout } from "./components/layouts/AdminLayout.js";
import { CustomerLayout } from "./components/layouts/CustomerLayout.js";
import { PublicLayout } from "./components/layouts/PublicLayout.js";
import "./components/ui/Toast.js";
import {
  ADMIN_ONLY_ROUTES,
  ADMIN_ROUTE_ACCESS,
  CUSTOMER_ROUTES,
  PUBLIC_ROUTES,
  isAllowedAdminRoute
} from "./lib/navigation.js";
import { getDefaultRouteForUser, isAdminRole, isCustomerRole, isEmployeeRole, isStaffRole } from "./lib/roles.js";
import { store } from "./lib/store.js";
import { AdminAccounting } from "./pages/admin/Accounting.js";
import { AdminAnalytics } from "./pages/admin/Analytics.js";
import { AdminBookings } from "./pages/admin/Bookings.js";
import { AdminCustomers } from "./pages/admin/Customers.js";
import { AdminAttendance } from "./pages/admin/Attendance.js";
import { AdminEmployees } from "./pages/admin/Employees.js";
import { AdminInventory } from "./pages/admin/Inventory.js";
import { AdminMemberships } from "./pages/admin/Memberships.js";
import { AdminProfile } from "./pages/admin/Profile.js";
import { AdminServices } from "./pages/admin/Services.js";
import { AdminSettings } from "./pages/admin/Settings.js";
import { AdminTasks } from "./pages/admin/Tasks.js";
import { AdminRewards } from "./pages/admin/Rewards.js";
import { EmployeeQrScan } from "./pages/employee/QrScan.js";
import { Profile } from "./pages/customer/Profile.js";
import { BookService } from "./pages/customer/BookService.js";
import { Chat } from "./pages/customer/Chat.js";
import { CustomerDashboard } from "./pages/customer/Dashboard.js";
import { Membership } from "./pages/customer/Membership.js";
import { MyBookings } from "./pages/customer/MyBookings.js";
import { CustomerRewards } from "./pages/customer/Rewards.js";
import { CustomerVisitScan } from "./pages/customer/VisitScan.js";
import { ForbiddenPage } from "./pages/shared/Forbidden.js";
import { Login, Register } from "./pages/public/Auth.js";
import { Contact } from "./pages/public/Contact.js";
import { Home } from "./pages/public/Home.js";
import { Services } from "./pages/public/Services.js";

const PATH_ALIASES = {
  "/dashboard": "/home",
  "/my-bookings": "/history",
  "/admin": "/admin/dashboard",
  "/employee/tasks": "/tasks"
};

const ADMIN_ROUTES = new Set(Object.keys(ADMIN_ROUTE_ACCESS));

function normalizePath(path) {
  if (!path) return "/";
  // Extract just the pathname for normalization
  const [base, ...rest] = path.split(/[?#]/);
  let normal = base;
  if (normal.length > 1 && normal.endsWith("/")) {
    normal = normal.slice(0, -1);
  }
  // Reattach query/hash if present (though navigate handles this mostly)
  return normal + (rest.length ? path.substring(base.length) : '');
}

function canonicalizePath(path) {
  const normalized = normalizePath(path);
  return PATH_ALIASES[normalized] || normalized;
}

function inferRouteScope(pathname) {
  if (PUBLIC_ROUTES.has(pathname)) return "public";
  if (CUSTOMER_ROUTES.has(pathname)) return "customer";
  if (ADMIN_ROUTES.has(pathname) || pathname.startsWith("/admin") || pathname === "/forbidden") {
    return "admin";
  }
  return "unknown";
}

function createNotFoundHtml(pathname) {
  return `<div class="p-10 text-center flex-1 flex flex-col items-center justify-center min-h-[50vh]"><h1 class="text-4xl font-bold text-text mb-4">404 - Not Found</h1><p class="text-muted mt-2 text-lg">The page <code class="bg-surface px-2 py-1 rounded text-primary">${pathname}</code> does not exist.</p><button onclick="window.navigate(event, '/')" class="mt-8 px-6 py-2.5 bg-primary hover:bg-primary-hover transition-colors text-white rounded-lg font-bold">Go Home</button></div>`;
}

const App = {
  routes: {},
  currentPath: normalizePath(window.location.pathname),
  lastAuthSyncPath: null,

  register(path, config) {
    this.routes[path] = config;
  },

  getRoute(path) {
    const basePath = path.split(/[?#]/)[0];
    return this.routes[basePath] || null;
  },

  async navigate(path, { replace = false } = {}) {
    const basePath = path.split(/[?#]/)[0];
    const hashPart = path.includes('#') ? '#' + path.split('#')[1] : '';
    const queryPart = path.includes('?') && !path.includes('#') ? '?' + path.split('?')[1] : '';
    const targetPath = canonicalizePath(basePath) + queryPart + hashPart;

    if (replace) {
      window.history.replaceState({}, "", targetPath);
    } else {
      window.history.pushState({}, "", targetPath);
    }
    this.currentPath = targetPath;
    await this.render();
  },

  async syncAuthForPath(pathname) {
    if (this.lastAuthSyncPath === pathname) return;
    await store.syncAuth();
    this.lastAuthSyncPath = pathname;
  },

  resolveGuard(pathname, routeScope) {
    const user = store.state.user;
    const role = user?.role;

    if (!user) {
      if (routeScope === "public") return { allow: true, path: pathname };
      return { allow: false, redirect: "/login" };
    }

    if (routeScope === "public") {
      return { allow: false, redirect: getDefaultRouteForUser(user) };
    }

    if (user.mustChangePassword) {
      if (isCustomerRole(role) && pathname !== "/profile") {
        return { allow: false, redirect: "/profile" };
      }
      if (isStaffRole(role) && pathname !== "/admin/profile") {
        return { allow: false, redirect: "/admin/profile" };
      }
    }

    if (routeScope === "customer") {
      if (isCustomerRole(role)) return { allow: true, path: pathname };
      if (isAdminRole(role)) return { allow: false, redirect: "/admin/dashboard" };
      if (isEmployeeRole(role)) return { allow: false, redirect: getDefaultRouteForUser(user) };
      return { allow: false, redirect: "/login" };
    }

    if (routeScope === "admin") {
      if (isCustomerRole(role)) return { allow: false, redirect: "/home" };

      if (isStaffRole(role)) {
        if (!ADMIN_ROUTES.has(pathname)) {
          return { allow: true, path: pathname };
        }

        if (!isAllowedAdminRoute(pathname, user)) {
          if (!isAdminRole(role) && ADMIN_ONLY_ROUTES.has(pathname)) {
            return { allow: false, redirect: "/forbidden" };
          }
          return { allow: false, redirect: getDefaultRouteForUser(user) };
        }
        return { allow: true, path: pathname };
      }
    }

    return { allow: true, path: pathname };
  },

  renderWithRoleLayout(pathname, html) {
    const role = store.state.user?.role;

    if (isCustomerRole(role)) {
      return CustomerLayout(html);
    }

    if (isStaffRole(role)) {
      return AdminLayout(html);
    }

    return PublicLayout(html);
  },

  async render(depth = 0) {
    if (depth > 10) return;

    const appDiv = document.getElementById("app");
    if (!appDiv) return;

    if (typeof window.__pageCleanup === "function") {
      window.__pageCleanup();
      window.__pageCleanup = null;
    }

    const canonicalPath = canonicalizePath(this.currentPath);
    if (canonicalPath !== this.currentPath) {
      window.history.replaceState({}, "", canonicalPath);
      this.currentPath = canonicalPath;
    }

    const basePath = canonicalPath.split(/[?#]/)[0];
    await this.syncAuthForPath(basePath);

    const route = this.getRoute(basePath);
    const scope = route?.scope || inferRouteScope(basePath);
    const guard = this.resolveGuard(basePath, scope);

    if (guard.redirect) {
      const target = canonicalizePath(guard.redirect);
      if (target !== canonicalPath) {
        this.lastAuthSyncPath = null;
        await this.navigate(target, { replace: true });
        return;
      }
    }

    if (!route) {
      const notFound = createNotFoundHtml(canonicalPath);
      appDiv.innerHTML = this.renderWithRoleLayout(canonicalPath, notFound);
    } else {
      const html = await route.render();
      appDiv.innerHTML = html;
    }

    if (typeof window.onMount === "function") {
      window.onMount();
      window.onMount = null;
    }
  },

  async init() {
    store.init();
    this.currentPath = canonicalizePath(window.location.pathname + window.location.hash);
    await this.syncAuthForPath(this.currentPath.split(/[?#]/)[0]);

    window.addEventListener("popstate", async () => {
      this.currentPath = canonicalizePath(window.location.pathname + window.location.hash);
      this.lastAuthSyncPath = null;
      await this.render();
    });

    await this.render();

    const loader = document.getElementById("global-loader");
    if (loader) {
      loader.classList.add("opacity-0");
      setTimeout(() => loader.remove(), 300);
    }
  }
};

window.App = App;
window.navigate = (event, path) => {
  if (event) event.preventDefault();
  App.navigate(path);
};

function adminRoute(renderFn) {
  return {
    scope: "admin",
    render: () => AdminLayout(renderFn())
  };
}

function customerRoute(renderFn) {
  return {
    scope: "customer",
    render: () => CustomerLayout(renderFn())
  };
}

function publicRoute(renderFn) {
  return {
    scope: "public",
    render: () => PublicLayout(renderFn())
  };
}

App.register("/", publicRoute(Home));
App.register("/services", publicRoute(Services));
App.register("/login", publicRoute(Login));
App.register("/register", publicRoute(Register));
App.register("/contact", publicRoute(Contact));

App.register("/home", customerRoute(CustomerDashboard));
App.register("/book", customerRoute(BookService));
App.register("/history", customerRoute(MyBookings));
App.register("/chat", customerRoute(Chat));
App.register("/membership", customerRoute(Membership));
App.register("/rewards", customerRoute(CustomerRewards));
App.register("/rewards/scan", customerRoute(CustomerVisitScan));
App.register("/profile", customerRoute(Profile));

App.register("/admin/dashboard", adminRoute(AdminAnalytics));
App.register("/admin/analytics", adminRoute(AdminAnalytics));
App.register("/admin/customers", adminRoute(AdminCustomers));
App.register("/admin/attendance", adminRoute(AdminAttendance));
App.register("/admin/bookings", adminRoute(AdminBookings));
App.register("/admin/chat", adminRoute(Chat));
App.register("/admin/inventory", adminRoute(AdminInventory));
App.register("/admin/services", adminRoute(AdminServices));
App.register("/admin/employees", adminRoute(AdminEmployees));
App.register("/admin/accounting", adminRoute(AdminAccounting));
App.register("/admin/memberships", adminRoute(AdminMemberships));
App.register("/tasks", adminRoute(AdminTasks));
App.register("/admin/tasks", adminRoute(AdminTasks));
App.register("/admin/rewards", adminRoute(AdminRewards));
App.register("/admin/settings", adminRoute(AdminSettings));
App.register("/admin/profile", adminRoute(AdminProfile));
App.register("/employee/qr-scan", adminRoute(EmployeeQrScan));
App.register("/forbidden", adminRoute(ForbiddenPage));

if (document.readyState === 'loading') {
  document.addEventListener("DOMContentLoaded", () => App.init());
} else {
  App.init();
}
