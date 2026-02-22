import { t } from '../../lib/i18n.js';
import { store } from '../../lib/store.js';

export function PublicLayout(children) {
    const { user, lang, theme } = store.state;
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const themeIcon = isDark
        ? `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`
        : `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>`;

    const langIcon = lang === 'en' ? 'عربي' : 'EN';

    // Handlers attached globally for Antigravity simplicity
    window.toggleTheme = () => {
        store.setTheme(isDark ? 'light' : 'dark');
        App.render();
    };

    window.toggleLang = () => {
        store.setLang(lang === 'en' ? 'ar' : 'en');
        App.render();
    };

    window.navigate = (e, path) => {
        e.preventDefault();
        App.navigate(path);
    };

    const navLinks = `
    <a href="/" onclick="navigate(event, '/')" class="${App.currentPath === '/' ? 'text-primary font-semibold' : 'text-text hover:text-primary transition-colors'}">${t('nav.home')}</a>
    <a href="/services" onclick="navigate(event, '/services')" class="${App.currentPath === '/services' ? 'text-primary font-semibold' : 'text-text hover:text-primary transition-colors'}">${t('nav.services')}</a>
    <a href="/contact" onclick="navigate(event, '/contact')" class="${App.currentPath === '/contact' ? 'text-primary font-semibold' : 'text-text hover:text-primary transition-colors'}">${t('nav.contact')}</a>
  `;

    const authSection = user
        ? `<a href="/dashboard" onclick="navigate(event, '/dashboard')" class="bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-full font-medium transition-colors shadow-sm">${t('nav.dashboard')}</a>`
        : `
       <a href="/login" onclick="navigate(event, '/login')" class="text-text hover:text-primary font-medium transition-colors hidden sm:block">${t('nav.login')}</a>
       <a href="/register" onclick="navigate(event, '/register')" class="bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-full font-medium transition-colors shadow-sm">${t('nav.register')}</a>
      `;

    return `
    <div class="min-h-screen flex flex-col pt-20">
      <!-- Top Navbar -->
      <nav class="fixed top-0 left-0 right-0 h-20 bg-surface/90 glass border-b border-border z-40">
        <div class="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          
          <div class="flex items-center gap-2 cursor-pointer" onclick="navigate(event, '/')">
            <div class="w-10 h-10 bg-gradient-to-br from-primary to-blue-400 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md">
              EV
            </div>
            <span class="font-heading font-bold text-xl tracking-tight hidden sm:block">Service Center</span>
          </div>

          <div class="hidden md:flex items-center gap-8 font-medium">
            ${navLinks}
          </div>

          <div class="flex items-center gap-4">
            <button onclick="toggleLang()" class="text-xs font-bold text-muted hover:text-text transition-colors w-8 h-8 rounded-full border border-border flex items-center justify-center">${langIcon}</button>
            <button onclick="toggleTheme()" class="text-muted hover:text-primary transition-colors focus:outline-none">
              ${themeIcon}
            </button>
            <div class="w-px h-6 bg-border mx-1 hidden sm:block"></div>
            ${authSection}
          </div>
        </div>
      </nav>

      <!-- Main Content -->
      <main class="flex-grow flex flex-col fade-in">
        ${children}
      </main>

      <!-- Footer -->
      <footer class="bg-surface border-t border-border py-12 mt-auto">
        <div class="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div class="flex items-center gap-2 mb-4">
              <div class="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold">EV</div>
              <span class="font-heading font-bold text-lg">Service Center</span>
            </div>
            <p class="text-sm text-muted">Premium care for electric and hybrid vehicles, providing next-generation diagnostics and maintenance.</p>
          </div>
          <div>
            <h4 class="font-semibold text-text mb-4">Quick Links</h4>
            <ul class="space-y-2 text-sm text-muted">
              <li><a href="#" class="hover:text-primary transition-colors">${t('nav.home')}</a></li>
              <li><a href="#" class="hover:text-primary transition-colors">${t('nav.services')}</a></li>
              <li><a href="#" class="hover:text-primary transition-colors">${t('nav.about')}</a></li>
            </ul>
          </div>
          <div>
            <h4 class="font-semibold text-text mb-4">Legal</h4>
            <ul class="space-y-2 text-sm text-muted">
              <li><a href="#" class="hover:text-primary transition-colors">Privacy Policy</a></li>
              <li><a href="#" class="hover:text-primary transition-colors">Terms of Service</a></li>
            </ul>
          </div>
          <div>
            <h4 class="font-semibold text-text mb-4">Contact</h4>
            <p class="text-sm text-muted mb-1">Amman, Jordan</p>
            <p class="text-sm text-muted mb-1">+962 79 000 0000</p>
            <p class="text-sm text-muted">info@evcare.jo</p>
          </div>
        </div>
      </footer>
    </div>
  `;
}
