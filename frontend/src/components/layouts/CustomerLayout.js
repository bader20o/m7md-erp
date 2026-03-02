import { t } from "../../lib/i18n.js";
import { CUSTOMER_NAV_ITEMS } from "../../lib/navigation.js";
import { ROLES } from "../../lib/roles.js";
import { store } from "../../lib/store.js";
import { apiFetch } from "../../lib/api.js";

export function CustomerLayout(children) {
  const { user, lang, theme } = store.state;

  if (!user || user.role !== ROLES.CUSTOMER) {
    return "";
  }
  const initial = user.fullName ? user.fullName.charAt(0).toUpperCase() : "U";
  const sidebarAvatar = user.avatarUrl
    ? `<img src="${user.avatarUrl}" alt="${user.fullName || "User"}" class="w-10 h-10 rounded-full object-cover border border-border">`
    : `<div class="w-10 h-10 bg-gradient-to-tr from-primary to-blue-300 rounded-full flex items-center justify-center text-white font-bold">${initial}</div>`;
  const topAvatar = user.avatarUrl
    ? `<img src="${user.avatarUrl}" alt="${user.fullName || "User"}" class="w-8 h-8 rounded-full object-cover border border-border">`
    : `<div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">${initial}</div>`;

  window.navigate = (event, path) => {
    if (event) event.preventDefault();
    App.navigate(path);
  };

  const positionCustomerChatFab = () => {
    const fab = document.getElementById("customer-chat-fab");
    if (!fab) return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const nav = document.getElementById("customer-bottom-nav");
    const navHeight = isMobile && nav ? nav.offsetHeight : 0;
    const bottom = 20 + navHeight;
    fab.style.bottom = `${bottom}px`;
  };

  const updateCustomerChatFabUnread = async () => {
    try {
      const res = await apiFetch("/chat/unread-count");
      const dot = document.getElementById("customer-chat-fab-dot");
      if (!dot) return;
      if (Number(res?.unreadCount || 0) > 0) dot.classList.remove("hidden");
      else dot.classList.add("hidden");
    } catch {
      // Ignore unread badge errors in shell.
    }
  };

  if (window.__customerChatFabTimer) {
    window.clearInterval(window.__customerChatFabTimer);
  }
  window.setTimeout(() => {
    void updateCustomerChatFabUnread();
  }, 0);
  window.__customerChatFabTimer = window.setInterval(() => {
    void updateCustomerChatFabUnread();
  }, 15000);

  if (window.__customerChatFabPositionCleanup) {
    window.__customerChatFabPositionCleanup();
  }
  window.setTimeout(() => {
    positionCustomerChatFab();
  }, 0);
  const customerFabResizeHandler = () => positionCustomerChatFab();
  window.addEventListener("resize", customerFabResizeHandler);
  window.addEventListener("orientationchange", customerFabResizeHandler);
  window.__customerChatFabPositionCleanup = () => {
    window.removeEventListener("resize", customerFabResizeHandler);
    window.removeEventListener("orientationchange", customerFabResizeHandler);
  };

  window.handleLogout = async (event) => {
    if (event) event.preventDefault();
    await store.logout();
    App.navigate("/login");
  };

  window.handleLangChange = async (locale, event) => {
    if (event) event.stopPropagation();
    try {
      store.setLang(locale);
      await apiFetch("/profile", { method: "PATCH", body: { action: "update_profile", locale } });
      App.render();
    } catch (e) {
      console.error(e);
      window.toast?.(e.message, "error");
    }
  };

  window.handleThemeChange = async (selectedTheme, event) => {
    if (event) event.stopPropagation();
    try {
      store.setTheme(selectedTheme);
      await apiFetch("/profile", { method: "PATCH", body: { action: "update_profile", theme: selectedTheme } });
      App.render();
    } catch (e) {
      console.error(e);
      window.toast?.(e.message, "error");
    }
  };

  window.toggleCustomerProfileMenu = () => {
    const menu = document.getElementById("customer-profile-menu");
    if (menu) {
      menu.classList.toggle("hidden");
    }
  };

  // Close menu if clicking outside
  document.addEventListener('click', (e) => {
    const btn = document.getElementById('customer-profile-btn');
    const menu = document.getElementById('customer-profile-menu');
    if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });

  const buildNavLinks = (isMobile) =>
    CUSTOMER_NAV_ITEMS.map((item) => {
      const active = item.match.includes(App.currentPath);
      if (isMobile) {
        return `
          <a href="${item.path}" onclick="navigate(event, '${item.path}')" class="flex flex-col items-center justify-center w-full py-2 ${active ? "text-primary" : "text-muted hover:text-text"} transition-colors gap-1">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">${item.icon}</svg>
            <span class="text-[10px] font-medium">${item.label}</span>
          </a>
        `;
      }

      return `
        <a href="${item.path}" onclick="navigate(event, '${item.path}')" class="flex items-center gap-3 px-4 py-3 rounded-xl mb-2 ${active ? "bg-primary/10 text-primary font-semibold" : "text-muted hover:bg-surface hover:text-text"} transition-all">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">${item.icon}</svg>
          <span>${item.label}</span>
        </a>
      `;
    }).join("");

  return `
    <div class="min-h-screen bg-bg flex pb-16 md:pb-0">
      <aside class="hidden md:flex flex-col w-64 bg-surface border-r border-border h-screen sticky top-0">
        <div class="p-6 border-b border-border">
          <div class="flex items-center gap-3 cursor-pointer" onclick="navigate(event, '/home')">
            <div class="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md">EV</div>
            <span class="font-heading font-bold tracking-tight">Service Center</span>
          </div>
        </div>

        <div class="p-4 flex flex-col gap-1 flex-1 overflow-y-auto">
          <div class="text-xs font-semibold text-muted tracking-wider uppercase mb-4 px-4 mt-2">Main Menu</div>
          ${buildNavLinks(false)}
        </div>
      </aside>

      <main class="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
        <div class="flex justify-end mb-4 relative z-50">
          <button id="customer-profile-btn" onclick="toggleCustomerProfileMenu()" class="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 hover:border-primary transition-colors focus:outline-none">
            ${topAvatar}
            <span class="text-sm font-semibold text-text truncate max-w-[120px]">${user.fullName || "User"}</span>
            <svg class="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>

          <div id="customer-profile-menu" class="hidden absolute top-full right-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-xl overflow-hidden py-1">
            <div class="px-4 py-3 border-b border-border">
              <p class="text-sm font-semibold text-text truncate">${user.fullName || "User"}</p>
              <p class="text-xs text-muted truncate">${user.phone}</p>
            </div>
            <a href="/profile" onclick="navigate(event, '/profile'); toggleCustomerProfileMenu()" class="block px-4 py-2 text-sm text-text hover:bg-bg transition-colors">
              Profile Settings
            </a>
            <div class="px-4 py-2 flex items-center justify-between text-sm border-t border-border mt-1 pt-2">
              <span class="text-text">Language</span>
              <div class="flex gap-2 font-semibold">
                <button onclick="handleLangChange('en', event)" class="${lang === 'en' ? 'text-primary' : 'text-muted hover:text-text'} transition-colors">EN</button>
                <span class="text-border">|</span>
                <button onclick="handleLangChange('ar', event)" class="${lang === 'ar' ? 'text-primary' : 'text-muted hover:text-text'} transition-colors">AR</button>
              </div>
            </div>
            <div class="px-4 py-2 flex items-center justify-between text-sm">
              <span class="text-text">Theme</span>
              <select onchange="handleThemeChange(this.value, event)" class="bg-bg border border-border rounded px-2 py-1 text-xs text-text outline-none focus:border-primary">
                <option value="light" ${theme === 'light' ? 'selected' : ''}>Light</option>
                <option value="dark" ${theme === 'dark' ? 'selected' : ''}>Dark</option>
                <option value="system" ${theme === 'system' ? 'selected' : ''}>System</option>
              </select>
            </div>
            <div class="border-t border-border mt-1 pt-1">
              <button onclick="handleLogout(event)" class="w-full text-left px-4 py-2 text-sm text-danger hover:bg-danger/10 transition-colors">
                Logout
              </button>
            </div>
          </div>
        </div>
        ${children}
      </main>

      <nav id="customer-bottom-nav" class="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex justify-around items-center z-50 h-[72px] pb-safe">
        ${buildNavLinks(true)}
      </nav>

      <button
        id="customer-chat-fab"
        onclick="navigate(event, '/chat')"
        class="fixed right-5 z-40 h-14 w-14 rounded-full bg-primary text-white shadow-xl ring-1 ring-primary/30 hover:bg-primary-hover transition-colors flex items-center justify-center"
        title="Open Messages"
        aria-label="Open Messages"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h8M8 14h5m-9 6l2.5-3H19a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2h.5L4 20z"></path>
        </svg>
        <span id="customer-chat-fab-dot" class="hidden absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-white shadow"></span>
      </button>
    </div>
  `;
}
