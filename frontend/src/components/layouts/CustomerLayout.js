import { t } from "../../lib/i18n.js";
import { CUSTOMER_NAV_ITEMS } from "../../lib/navigation.js";
import { ROLES } from "../../lib/roles.js";
import { store } from "../../lib/store.js";

export function CustomerLayout(children) {
  const { user } = store.state;

  if (!user || user.role !== ROLES.CUSTOMER) {
    return "";
  }

  window.navigate = (event, path) => {
    if (event) event.preventDefault();
    App.navigate(path);
  };

  window.handleLogout = async (event) => {
    if (event) event.preventDefault();
    await store.logout();
    App.navigate("/login");
  };

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
    <div class="min-h-screen bg-bg flex fade-in pb-16 md:pb-0">
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

        <div class="p-4 border-t border-border">
          <div class="bg-bg rounded-xl p-4 border border-border flex items-center gap-3">
            <div class="w-10 h-10 bg-gradient-to-tr from-primary to-blue-300 rounded-full flex items-center justify-center text-white font-bold">
              ${user.fullName ? user.fullName.charAt(0).toUpperCase() : "U"}
            </div>
            <div class="overflow-hidden">
              <div class="text-sm font-semibold text-text truncate">${user.fullName || "User"}</div>
              <div class="text-xs text-muted truncate">${user.phone}</div>
            </div>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2">
            <a href="/profile" onclick="navigate(event, '/profile')" class="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-border text-xs font-semibold text-text hover:bg-surface transition-colors">Profile</a>
            <button onclick="handleLogout(event)" class="inline-flex items-center justify-center px-3 py-2 rounded-lg border border-danger/30 text-xs font-semibold text-danger hover:bg-danger hover:text-white transition-colors">${t("common.logout")}</button>
          </div>
        </div>
      </aside>

      <main class="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
        ${children}
      </main>

      <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex justify-around items-center z-50 h-[72px] pb-safe">
        ${buildNavLinks(true)}
      </nav>
    </div>
  `;
}
