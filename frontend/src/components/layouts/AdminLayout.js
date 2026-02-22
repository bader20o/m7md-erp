import { store } from '../../lib/store.js';

export function AdminLayout(children) {
  const { user, lang, theme } = store.state;
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const themeIcon = isDark
    ? `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`
    : `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>`;

  const langIcon = lang === 'en' ? 'عربي' : 'EN';

  window.toggleTheme = () => {
    store.setTheme(isDark ? 'light' : 'dark');
    App.render();
  };

  window.toggleLang = () => {
    store.setLang(lang === 'en' ? 'ar' : 'en');
    App.render();
  };

  // Handle mobile drawer
  window.toggleAdminDrawer = () => {
    const drawer = document.getElementById('admin-drawer');
    const overlay = document.getElementById('admin-drawer-overlay');

    if (drawer.classList.contains('-translate-x-full')) {
      drawer.classList.remove('-translate-x-full');
      overlay.classList.remove('opacity-0', 'pointer-events-none');
    } else {
      drawer.classList.add('-translate-x-full');
      overlay.classList.add('opacity-0', 'pointer-events-none');
    }
  };

  const navItems = [
    { path: '/admin/analytics', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>', label: 'Dashboard', roles: ['ADMIN', 'MANAGER'] },
    { path: '/admin/users', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>', label: 'Users', roles: ['ADMIN', 'MANAGER'] },
    { path: '/admin/bookings', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>', label: 'Bookings', roles: ['ADMIN', 'MANAGER', 'RECEPTION'] },
    { path: '/admin/services', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>', label: 'Services Config', roles: ['ADMIN', 'MANAGER'] },
    { path: '/admin/employees', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>', label: 'HR / Employees', roles: ['ADMIN', 'MANAGER', 'RECEPTION'] },
    { path: '/admin/accounting', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>', label: 'Accounting', roles: ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'RECEPTION'] },
    { path: '/admin/memberships', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>', label: 'Memberships', roles: ['ADMIN', 'MANAGER'] },
  ];

  const filteredNav = navItems.filter(i => i.roles.includes(user.role));

  const listNav = filteredNav.map(item => {
    const active = App.currentPath === item.path;
    return `
      <a href="${item.path}" onclick="navigate(event, '${item.path}')" class="flex items-center gap-3 px-4 py-3 rounded-xl mb-1 ${active ? 'bg-primary text-white font-medium shadow-md' : 'text-muted hover:bg-surface hover:text-text'} transition-all">
        <svg class="w-5 h-5 ${active ? 'text-white' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">${item.icon}</svg>
        <span>${item.label}</span>
      </a>
    `;
  }).join('');

  return `
    <div class="min-h-screen bg-bg flex fade-in">
      
      <!-- Mobile Drawer Overlay -->
      <div id="admin-drawer-overlay" class="fixed inset-0 bg-black/50 z-40 opacity-0 pointer-events-none transition-opacity duration-300 md:hidden" onclick="toggleAdminDrawer()"></div>

      <!-- Sidebar Container -->
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
        
        <!-- Profile / Logout bottom area -->
        <div class="p-4 border-t border-border">
           <div class="flex items-center justify-between bg-bg rounded-xl p-3 border border-border">
             <div class="flex items-center gap-3 overflow-hidden cursor-pointer" onclick="navigate(event, '/profile')" title="View Profile">
               <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                 ${user.fullName ? user.fullName.charAt(0) : 'A'}
               </div>
               <div class="overflow-hidden">
                 <div class="text-xs font-bold text-text truncate hover:text-primary transition-colors">${user.fullName}</div>
                 <div class="text-[10px] uppercase font-semibold text-primary truncate">${user.role}</div>
               </div>
             </div>
             <button onclick="store.logout(); App.navigate('/')" class="text-muted hover:text-danger p-2 transition-colors ml-1" title="Logout">
               <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
             </button>
           </div>
        </div>
      </aside>

      <!-- Main Content Container Wrapper -->
      <div class="flex-1 flex flex-col w-full min-w-0">
        <!-- Topbar globally for language and theme -->
        <header class="h-16 bg-surface border-b border-border flex items-center px-4 sticky top-0 z-30 justify-between md:justify-end">
          <div class="flex items-center gap-3 md:hidden">
            <button onclick="toggleAdminDrawer()" class="p-2 -ml-2 text-text">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            <div class="font-heading font-bold">Admin Center</div>
          </div>
          <div class="flex items-center gap-4">
            <button onclick="window.toggleLang()" class="text-xs font-bold text-muted hover:text-text transition-colors w-8 h-8 rounded-full border border-border flex items-center justify-center">${langIcon}</button>
            <button onclick="window.toggleTheme()" class="text-muted hover:text-primary transition-colors focus:outline-none">
              ${themeIcon}
            </button>
          </div>
        </header>

        <!-- Main Workspace -->
        <main class="flex-1 overflow-x-hidden p-4 md:p-8">
          ${children}
        </main>
      </div>

    </div>
  `;
}
