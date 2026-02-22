import { t } from '../../lib/i18n.js';
import { store } from '../../lib/store.js';

export function CustomerLayout(children) {
    const { user, lang } = store.state;

    if (!user) {
        App.navigate('/login');
        return '';
    }

    // Common navigation helper
    window.navigate = (e, path) => {
        e.preventDefault();
        App.navigate(path);
    };

    const navItems = [
        { path: '/dashboard', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>', label: t('nav.home') },
        { path: '/book', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>', label: 'Book' },
        { path: '/my-bookings', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/>', label: 'History' },
        { path: '/chat', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>', label: 'Chat' },
        { path: '/profile', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>', label: 'Profile' }
    ];

    const buildNavLinks = (isMobile) => navItems.map(item => {
        const active = App.currentPath === item.path;
        if (isMobile) {
            return `
        <a href="${item.path}" onclick="navigate(event, '${item.path}')" class="flex flex-col items-center justify-center w-full py-2 ${active ? 'text-primary' : 'text-muted hover:text-text'} transition-colors gap-1">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">${item.icon}</svg>
          <span class="text-[10px] font-medium">${item.label}</span>
        </a>
      `;
        }
        return `
      <a href="${item.path}" onclick="navigate(event, '${item.path}')" class="flex items-center gap-3 px-4 py-3 rounded-xl mb-2 ${active ? 'bg-primary/10 text-primary font-semibold' : 'text-muted hover:bg-surface hover:text-text'} transition-all">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">${item.icon}</svg>
        <span>${item.label}</span>
      </a>
    `;
    }).join('');

    return `
    <div class="min-h-screen bg-bg flex fade-in pb-16 md:pb-0">
      
      <!-- Desktop Sidebar Navigation -->
      <aside class="hidden md:flex flex-col w-64 bg-surface border-r border-border h-screen sticky top-0">
        <div class="p-6 border-b border-border">
          <div class="flex items-center gap-3 cursor-pointer" onclick="navigate(event, '/')">
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
               ${user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
             </div>
             <div class="overflow-hidden">
               <div class="text-sm font-semibold text-text truncate">${user.fullName || 'User'}</div>
               <div class="text-xs text-muted truncate">${user.phone}</div>
             </div>
           </div>
        </div>
      </aside>

      <!-- Main Content Area -->
      <main class="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
        ${children}
      </main>

      <!-- Mobile Bottom Navigation -->
      <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex justify-around items-center z-50 h-[72px] pb-safe">
        ${buildNavLinks(true)}
      </nav>

    </div>
  `;
}
