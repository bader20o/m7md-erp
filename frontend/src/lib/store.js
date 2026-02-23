import { apiFetch } from "./api.js";
import { hasPermission, isAdminRole, isCustomerRole, isEmployeeRole, isStaffRole } from "./roles.js";

function buildAuthSnapshot(state) {
  const user = state.user ?? null;
  const role = user?.role ?? null;
  return {
    user,
    isLoggedIn: () => Boolean(user),
    hasRole: (targetRole) => role === targetRole,
    isAdmin: () => isAdminRole(role),
    isEmployee: () => isEmployeeRole(role),
    isCustomer: () => isCustomerRole(role),
    isStaff: () => isStaffRole(role),
    hasPermission: (permission) => hasPermission(user, permission)
  };
}

export const store = {
  state: {
    user: null,
    lang: "en",
    theme: "system",
    isReady: false
  },
  listeners: [],
  authSyncPromise: null,

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  },

  emit() {
    this.listeners.forEach((listener) => listener(this.state));
  },

  updateAuthGlobal() {
    window.__auth = buildAuthSnapshot(this.state);
  },

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.updateAuthGlobal();
    this.emit();
  },

  setUser(user) {
    this.setState({ user });
  },

  isLoggedIn() {
    return Boolean(this.state.user);
  },

  hasRole(role) {
    return this.state.user?.role === role;
  },

  isAdmin() {
    return isAdminRole(this.state.user?.role);
  },

  isEmployee() {
    return isEmployeeRole(this.state.user?.role);
  },

  isCustomer() {
    return isCustomerRole(this.state.user?.role);
  },

  isStaff() {
    return isStaffRole(this.state.user?.role);
  },

  hasPermission(permission) {
    return hasPermission(this.state.user, permission);
  },

  async syncAuth() {
    if (this.authSyncPromise) return this.authSyncPromise;

    this.authSyncPromise = (async () => {
      try {
        const data = await apiFetch("/auth/me");
        this.setUser(data?.user ? { ...data.user, permissions: data.user.permissions || [] } : null);
      } catch {
        this.setUser(null);
      } finally {
        this.authSyncPromise = null;
      }
      return this.state.user;
    })();

    return this.authSyncPromise;
  },

  async logout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // Ignore API failure; local state still needs to be reset.
    }
    this.setUser(null);
  },

  setLang(lang) {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    localStorage.setItem("sc_lang", lang);
    this.setState({ lang });
  },

  setTheme(theme) {
    this.setState({ theme });
    localStorage.setItem("sc_theme", theme);
    this.applyTheme();
  },

  applyTheme() {
    const isDark =
      this.state.theme === "dark" ||
      (this.state.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  },

  init() {
    const savedLang = localStorage.getItem("sc_lang") || "en";
    const savedTheme = localStorage.getItem("sc_theme") || "system";
    this.setLang(savedLang);
    this.setTheme(savedTheme);
    this.setState({ isReady: true });
  }
};
