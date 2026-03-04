import { ADMIN_NAV_ITEMS } from "../../lib/navigation.js";
import { hasPermission, isAdminRole } from "../../lib/roles.js";
import { store } from "../../lib/store.js";
import { apiFetch } from "../../lib/api.js";

export function AdminLayout(children) {
  const { user, lang, theme } = store.state;
  if (!user) return "";
  const isRtl = document.documentElement.dir === "rtl";
  const isDesktop = window.matchMedia("(min-width: 768px)").matches;
  const drawerHiddenClass = isRtl ? "translate-x-full" : "-translate-x-full";
  const drawerBaseStateClass = isDesktop ? "translate-x-0" : drawerHiddenClass;
  const drawerEdgeClass = isRtl ? "right-0 border-l" : "left-0 border-r";
  const contentOffsetClass = isDesktop ? (isRtl ? "pr-64" : "pl-64") : "";
  const overlayStateClass = isDesktop ? "hidden pointer-events-none" : "opacity-0 pointer-events-none";
  const mobileOnlyClass = isDesktop ? "hidden" : "";
  const headerJustifyClass = isDesktop ? "justify-end" : "justify-between";
  const initial = user.fullName ? user.fullName.charAt(0).toUpperCase() : "U";
  const sidebarAvatar = user.avatarUrl
    ? `<img src="${user.avatarUrl}" alt="${user.fullName || "User"}" class="w-8 h-8 rounded-full object-cover border border-border shrink-0">`
    : `<div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">${initial}</div>`;
  const headerAvatar = user.avatarUrl
    ? `<img src="${user.avatarUrl}" alt="${user.fullName || "User"}" class="w-7 h-7 rounded-full object-cover border border-border shrink-0">`
    : `<div class="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">${initial}</div>`;

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

  const positionAdminChatFab = () => {
    const fab = document.getElementById("admin-chat-fab");
    if (!fab) return;
    const vv = window.visualViewport;
    const keyboardOffset = vv ? Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)) : 0;
    fab.style.bottom = `${20 + keyboardOffset}px`;
  };

  const updateAdminChatFabUnread = async () => {
    try {
      const res = await apiFetch("/chat/unread-count");
      const dot = document.getElementById("admin-chat-fab-dot");
      if (!dot) return;
      if (Number(res?.unreadCount || 0) > 0) dot.classList.remove("hidden");
      else dot.classList.add("hidden");
    } catch {
      // Ignore unread badge errors in shell.
    }
  };

  if (window.__adminChatFabTimer) {
    window.clearInterval(window.__adminChatFabTimer);
  }
  window.setTimeout(() => {
    void updateAdminChatFabUnread();
  }, 0);
  window.__adminChatFabTimer = window.setInterval(() => {
    void updateAdminChatFabUnread();
  }, 15000);

  if (window.__adminChatFabPositionCleanup) {
    window.__adminChatFabPositionCleanup();
  }
  window.setTimeout(() => {
    positionAdminChatFab();
  }, 0);
  const adminFabResizeHandler = () => positionAdminChatFab();
  window.addEventListener("resize", adminFabResizeHandler);
  window.addEventListener("orientationchange", adminFabResizeHandler);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", adminFabResizeHandler);
    window.visualViewport.addEventListener("scroll", adminFabResizeHandler);
  }
  window.__adminChatFabPositionCleanup = () => {
    window.removeEventListener("resize", adminFabResizeHandler);
    window.removeEventListener("orientationchange", adminFabResizeHandler);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", adminFabResizeHandler);
      window.visualViewport.removeEventListener("scroll", adminFabResizeHandler);
    }
  };

  window.toggleTheme = async () => {
    const newTheme = isDark ? "light" : "dark";
    store.setTheme(newTheme);
    try {
      await apiFetch("/profile", { method: "PATCH", body: { action: "update_profile", theme: newTheme } });
    } catch (e) {
      console.error(e);
      window.toast?.(e.message, "error");
    }
    App.render();
  };

  window.toggleLang = async () => {
    const newLang = lang === "en" ? "ar" : "en";
    store.setLang(newLang);
    try {
      await apiFetch("/profile", { method: "PATCH", body: { action: "update_profile", locale: newLang } });
    } catch (e) {
      console.error(e);
      window.toast?.(e.message, "error");
    }
    App.render();
  };

  window.handleLogout = async (event) => {
    if (event) event.preventDefault();
    await store.logout();
    App.navigate("/login");
  };

  window.toggleAdminDrawer = () => {
    if (isDesktop) return;
    const drawer = document.getElementById("admin-drawer");
    const overlay = document.getElementById("admin-drawer-overlay");
    if (!drawer || !overlay) return;

    if (drawer.classList.contains(drawerHiddenClass)) {
      drawer.classList.remove(drawerHiddenClass);
      overlay.classList.remove("opacity-0", "pointer-events-none");
    } else {
      drawer.classList.add(drawerHiddenClass);
      overlay.classList.add("opacity-0", "pointer-events-none");
    }
  };

  window.toggleAdminProfileMenu = () => {
    const menu = document.getElementById("admin-profile-menu");
    if (menu) {
      menu.classList.toggle("hidden");
    }
  };

  document.addEventListener('click', (e) => {
    const btn = document.getElementById('admin-profile-btn');
    const menu = document.getElementById('admin-profile-menu');
    if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });

  const filteredNav = ADMIN_NAV_ITEMS.filter((item) => {
    if (!item.roles.includes(user.role)) return false;
    if (typeof item.isVisible === "function" && !item.isVisible(user)) return false;
    if (!item.permission) return true;
    if (isAdminRole(user.role)) return true;
    return hasPermission(user, item.permission);
  });

  const listNav = filteredNav.map((item) => {
    const active = item.match.includes(App.currentPath.split(/[?#]/)[0]);
    return `
      <a href="${item.path}" onclick="navigate(event, '${item.path}')" class="flex items-center gap-3 px-4 py-3 rounded-xl mb-1 ${active ? "bg-primary text-white font-medium shadow-md" : "text-muted hover:bg-surface hover:text-text"} transition-all">
        <svg class="w-5 h-5 ${active ? "text-white" : ""}" fill="none" stroke="currentColor" viewBox="0 0 24 24">${item.icon}</svg>
        <span class="font-bold">${item.label}</span>
      </a>
    `;
  }).join("");

  return `
    <div class="min-h-screen bg-bg flex">
      <div id="admin-drawer-overlay" class="fixed inset-0 bg-black/50 z-40 ${overlayStateClass} transition-opacity duration-300" onclick="toggleAdminDrawer()"></div>

      <aside id="admin-drawer" class="fixed inset-y-0 ${drawerEdgeClass} w-64 bg-surface border-border h-screen z-50 transform ${drawerBaseStateClass} transition-transform duration-300 flex flex-col">
        <div class="px-6 h-16 border-b border-border flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-gray-900 dark:bg-gray-100 rounded-lg flex items-center justify-center text-surface dark:text-gray-900 font-bold text-sm shadow">CMD</div>
            <span class="font-heading font-bold tracking-tight">Admin Center</span>
          </div>
          <button class="${mobileOnlyClass} text-muted" onclick="toggleAdminDrawer()">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <div class="p-4 flex flex-col gap-1 flex-1 overflow-y-auto">
          <div class="text-xs font-semibold text-muted tracking-wide uppercase mb-3 px-2 mt-2">Modules</div>
          ${listNav}
        </div>
      </aside>

      <div class="flex-1 flex flex-col w-full min-w-0 ${contentOffsetClass}">
        <header class="h-16 shrink-0 bg-surface border-b border-border flex items-center px-4 md:px-8 lg:px-10 sticky top-0 z-30 ${headerJustifyClass}">
          <div class="${mobileOnlyClass ? `${mobileOnlyClass} ` : ""}flex items-center gap-3">
            <button onclick="toggleAdminDrawer()" class="p-2 -ml-2 text-text">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            <div class="font-heading font-bold">Admin Center</div>
          </div>
          <div class="flex items-center gap-4 relative mr-2 md:mr-4">
            <button id="admin-profile-btn" onclick="toggleAdminProfileMenu()" class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border hover:border-primary transition-colors focus:outline-none" title="Profile Menu">
              ${headerAvatar}
              <span class="text-sm font-semibold text-text truncate hidden sm:block max-w-[150px]">${user.fullName || "User"}</span>
              <svg class="w-4 h-4 text-muted hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>

            <div id="admin-profile-menu" class="hidden absolute top-full mt-2 w-56 ltr:right-1 rtl:left-1 md:ltr:right-2 md:rtl:left-2 bg-surface border border-border rounded-xl shadow-xl overflow-hidden pt-1 z-50">
              <div class="px-4 py-3 border-b border-border bg-bg">
                <p class="text-sm font-semibold text-text truncate">${user.fullName || "User"}</p>
                <p class="text-xs text-muted truncate">${user.phone}</p>
                <p class="text-[10px] uppercase font-bold text-primary mt-1">${user.role}</p>
              </div>
              
              <div class="py-1">
                <a href="/admin/profile" onclick="navigate(event, '/admin/profile'); toggleAdminProfileMenu()" class="flex items-center gap-3 px-4 py-2 text-sm text-text hover:bg-bg transition-colors">
                  <svg class="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                  Profile Settings
                </a>
                
                <button onclick="window.toggleLang(); toggleAdminProfileMenu()" class="w-full flex items-center justify-between px-4 py-2 text-sm text-text hover:bg-bg transition-colors">
                  <span class="flex items-center gap-3">
                    <svg class="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path></svg>
                    Language
                  </span>
                  <span class="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">${langIcon}</span>
                </button>

                <button onclick="window.toggleTheme(); toggleAdminProfileMenu()" class="w-full flex items-center justify-between px-4 py-2 text-sm text-text hover:bg-bg transition-colors">
                  <span class="flex items-center gap-3">
                    ${themeIcon}
                    Theme
                  </span>
                  <span class="text-xs text-muted capitalize">${isDark ? 'Dark' : 'Light'}</span>
                </button>
              </div>

              <div class="border-t border-border mt-1 py-1">
                <button onclick="handleLogout(event)" class="w-full flex items-center gap-3 px-4 py-2 text-sm text-danger hover:bg-danger/10 transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        <main class="flex-1 overflow-x-hidden p-4 md:p-8 lg:p-10">
          ${children}
        </main>

        <button
          id="admin-chat-fab"
          onclick="navigate(event, '/admin/chat')"
          class="fixed right-5 z-40 h-14 w-14 rounded-full bg-primary text-white shadow-xl ring-1 ring-primary/30 hover:bg-primary-hover transition-colors flex items-center justify-center"
          title="Open Messages"
          aria-label="Open Messages"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h8M8 14h5m-9 6l2.5-3H19a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2h.5L4 20z"></path>
          </svg>
          <span id="admin-chat-fab-dot" class="hidden absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-white shadow"></span>
        </button>
      </div>
    </div>
  `;
}
