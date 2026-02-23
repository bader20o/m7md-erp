import { ADMIN_NAV_ITEMS } from "../../lib/navigation.js";
import { hasPermission, isAdminRole } from "../../lib/roles.js";
import { store } from "../../lib/store.js";

export function AdminLayout(children) {
  const { user, lang, theme } = store.state;
  if (!user) return "";

  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const themeIcon = isDark
    ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>'
    : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>';

  const langIcon = lang === "en" ? "AR" : "EN";

  window.navigate = (event, path) => {
    if (event) event.preventDefault();
    App.navigate(path);
  };

  window.toggleTheme = () => {
    store.setTheme(isDark ? "light" : "dark");
    App.render();
  };

  window.toggleLang = () => {
    store.setLang(lang === "en" ? "ar" : "en");
    App.render();
  };

  window.handleLogout = async (event) => {
    if (event) event.preventDefault();
    await store.logout();
    App.navigate("/login");
  };

  window.toggleAdminDrawer = () => {
    const drawer = document.getElementById("admin-drawer");
    const overlay = document.getElementById("admin-drawer-overlay");
    if (!drawer || !overlay) return;

    if (drawer.classList.contains("-translate-x-full")) {
      drawer.classList.remove("-translate-x-full");
      overlay.classList.remove("opacity-0", "pointer-events-none");
    } else {
      drawer.classList.add("-translate-x-full");
      overlay.classList.add("opacity-0", "pointer-events-none");
    }
  };

  const filteredNav = ADMIN_NAV_ITEMS.filter((item) => {
    if (!item.roles.includes(user.role)) return false;
    if (!item.permission) return true;
    if (isAdminRole(user.role)) return true;
    return hasPermission(user, item.permission);
  });

  const listNav = filteredNav.map((item) => {
    const active = item.match.includes(App.currentPath);
    return `
      <a href="${item.path}" onclick="navigate(event, '${item.path}')" class="flex items-center gap-3 px-4 py-3 rounded-xl mb-1 ${active ? "bg-primary text-white font-medium shadow-md" : "text-muted hover:bg-surface hover:text-text"} transition-all">
        <svg class="w-5 h-5 ${active ? "text-white" : ""}" fill="none" stroke="currentColor" viewBox="0 0 24 24">${item.icon}</svg>
        <span>${item.label}</span>
      </a>
    `;
  }).join("");

  return `
    <div class="min-h-screen bg-bg flex fade-in">
      <div id="admin-drawer-overlay" class="fixed inset-0 bg-black/50 z-40 opacity-0 pointer-events-none transition-opacity duration-300 md:hidden" onclick="toggleAdminDrawer()"></div>

      <aside id="admin-drawer" class="fixed md:static inset-y-0 left-0 w-64 bg-surface border-r border-border h-screen z-50 transform -translate-x-full md:translate-x-0 transition-transform duration-300 flex flex-col">
        <div class="p-6 border-b border-border flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-gray-900 dark:bg-gray-100 rounded-lg flex items-center justify-center text-surface dark:text-gray-900 font-bold text-sm shadow">CMD</div>
            <span class="font-heading font-bold tracking-tight">Admin Center</span>
          </div>
          <button class="md:hidden text-muted" onclick="toggleAdminDrawer()">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div class="p-4 flex flex-col gap-1 flex-1 overflow-y-auto">
          <div class="text-xs font-semibold text-muted tracking-wide uppercase mb-3 px-2 mt-2">Modules</div>
          ${listNav}
        </div>

        <div class="p-4 border-t border-border">
          <div class="flex items-center justify-between bg-bg rounded-xl p-3 border border-border">
            <div class="flex items-center gap-3 overflow-hidden cursor-pointer" onclick="navigate(event, '/admin/profile')" title="View Profile">
              <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                ${user.fullName ? user.fullName.charAt(0).toUpperCase() : "U"}
              </div>
              <div class="overflow-hidden">
                <div class="text-xs font-bold text-text truncate hover:text-primary transition-colors">${user.fullName || "User"}</div>
                <div class="text-[10px] uppercase font-semibold text-primary truncate">${user.role}</div>
              </div>
            </div>
            <button onclick="handleLogout(event)" class="text-muted hover:text-danger p-2 transition-colors ml-1" title="Logout">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            </button>
          </div>
        </div>
      </aside>

      <div class="flex-1 flex flex-col w-full min-w-0">
        <header class="h-16 bg-surface border-b border-border flex items-center px-4 sticky top-0 z-30 justify-between md:justify-end">
          <div class="flex items-center gap-3 md:hidden">
            <button onclick="toggleAdminDrawer()" class="p-2 -ml-2 text-text">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            <div class="font-heading font-bold">Admin Center</div>
          </div>
          <div class="flex items-center gap-4">
            <a href="/admin/profile" onclick="navigate(event, '/admin/profile')" class="inline-flex items-center justify-center w-8 h-8 rounded-full border border-border text-muted hover:text-primary hover:border-primary transition-colors" title="Profile">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
            </a>
            <button onclick="handleLogout(event)" class="inline-flex items-center justify-center w-8 h-8 rounded-full border border-border text-muted hover:text-danger hover:border-danger transition-colors" title="Logout">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            </button>
            <button onclick="window.toggleLang()" class="text-xs font-bold text-muted hover:text-text transition-colors w-8 h-8 rounded-full border border-border flex items-center justify-center">${langIcon}</button>
            <button onclick="window.toggleTheme()" class="text-muted hover:text-primary transition-colors focus:outline-none">
              ${themeIcon}
            </button>
          </div>
        </header>

        <main class="flex-1 overflow-x-hidden p-4 md:p-8">
          ${children}
        </main>
      </div>
    </div>
  `;
}
