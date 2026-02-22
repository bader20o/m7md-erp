import { store } from '../../lib/store.js';
import { apiFetch } from '../../lib/api.js';
import { t } from '../../lib/i18n.js';

export function Profile() {

    window.onMount = () => {
        // Populate form with store user data
        const user = store.state.user;
        if (user) {
            document.getElementById('profile-name').value = user.fullName || '';
            document.getElementById('profile-phone').value = user.phone || '';
            // We assume an update endpoint exists or we just show them readonly for now based on spec constraints
        }

        document.getElementById('logout-btn').addEventListener('click', async () => {
            try {
                await apiFetch('/auth/logout', { method: 'POST' });
                store.setUser(null);
                window.toast('Logged out successfully', 'success');
                App.navigate('/login');
            } catch (e) {
                window.toast('Error logging out', 'error');
            }
        });

        document.getElementById('theme-select').addEventListener('change', (e) => {
            store.setTheme(e.target.value);
        });
        document.getElementById('theme-select').value = store.state.theme;

        document.getElementById('lang-select').addEventListener('change', (e) => {
            store.setLang(e.target.value);
            App.render(); // immediately re-render full layout
        });
        document.getElementById('lang-select').value = store.state.lang;
    };

    return `
    <div class="max-w-3xl mx-auto w-full flex flex-col gap-8">
      <div>
        <h1 class="text-3xl font-heading font-bold text-text">Account Settings</h1>
        <p class="text-muted mt-1">Manage your profile, preferences, and account security.</p>
      </div>

      <div class="bg-surface border border-border rounded-2xl p-6 md:p-8">
        <h3 class="text-lg font-bold text-text mb-6">Personal Information</h3>
        
        <div class="flex items-center gap-6 mb-8 border-b border-border pb-8">
          <div class="w-20 h-20 rounded-full bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center text-white text-3xl font-bold shadow-md">
            ${store.state.user.fullName ? store.state.user.fullName.charAt(0) : 'U'}
          </div>
          <div>
            <h4 class="font-bold text-text text-lg">${store.state.user.fullName || 'User'}</h4>
            <span class="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-bold uppercase tracking-widest mt-1 inline-block">${store.state.user.role}</span>
          </div>
        </div>

        <form class="space-y-6" onsubmit="event.preventDefault(); window.toast('Profile update endpoint required', 'warning');">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-text mb-2">Full Name</label>
              <input type="text" id="profile-name" class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl focus:border-primary outline-none transition-colors text-text" readonly>
            </div>
            <div>
              <label class="block text-sm font-medium text-text mb-2">Phone Number</label>
              <input type="tel" id="profile-phone" class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl focus:border-primary outline-none transition-colors text-text" readonly>
            </div>
          </div>
          <p class="text-xs text-muted">To change your phone number, please contact support.</p>
        </form>
      </div>

      <div class="bg-surface border border-border rounded-2xl p-6 md:p-8">
         <h3 class="text-lg font-bold text-text mb-6">App Preferences</h3>
         
         <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-medium text-text mb-2">Theme</label>
              <select id="theme-select" class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl focus:border-primary outline-none transition-colors text-text">
                <option value="light">Light Mode</option>
                <option value="dark">Dark Mode</option>
                <option value="system">System Default</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-text mb-2">Language</label>
              <select id="lang-select" class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl focus:border-primary outline-none transition-colors text-text">
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
            </div>
         </div>
      </div>

      <div class="flex justify-end pt-4">
        <button id="logout-btn" class="px-6 py-3 bg-danger/10 text-danger hover:bg-danger hover:text-white rounded-xl font-bold transition-colors flex items-center gap-2">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          ${t('common.logout')}
        </button>
      </div>

    </div>
  `;
}
