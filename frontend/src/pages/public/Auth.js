import { t } from '../../lib/i18n.js';
import { apiFetch } from '../../lib/api.js';
import { store } from '../../lib/store.js';

export function Login() {
  window.onMount = () => {
    const form = document.getElementById('login-form');
    const btn = document.getElementById('login-btn');
    const btnText = document.getElementById('btn-text');
    const btnLoader = document.getElementById('btn-loader');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const phone = form.phone.value;
      const password = form.password.value;

      try {
        btn.disabled = true;
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');

        const data = await apiFetch('/auth/login', {
          method: 'POST',
          body: { phone, password }
        });
        const user = data?.user;

        if (user) {
          store.setUser(user);
          window.toast('Login successful', 'success');

          // Role-based redirect
          if (['ADMIN', 'MANAGER', 'RECEPTION', 'ACCOUNTANT'].includes(user.role)) {
            App.navigate('/admin/analytics');
          } else {
            App.navigate('/dashboard');
          }
        }
      } catch (err) {
        window.toast(err.message || t('common.error'), 'error');
        btn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
      }
    });
  };

  return `
    <div class="flex-1 w-full max-w-md mx-auto px-4 py-20 flex flex-col justify-center">
      <div class="bg-surface border border-border rounded-2xl p-8 shadow-sm">
        <div class="text-center mb-8">
          <div class="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4 tracking-tighter">EV</div>
          <h1 class="text-2xl font-heading font-bold text-text">${t('auth.login_title')}</h1>
        </div>

        <form id="login-form" class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-text mb-1">${t('auth.phone')}</label>
            <input type="tel" name="phone" required class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors" placeholder="+962790000000">
          </div>
          <div>
            <label class="block text-sm font-medium text-text mb-1">${t('auth.password')}</label>
            <input type="password" name="password" required class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors">
          </div>
          
          <button id="login-btn" type="submit" class="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-semibold transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed mt-2">
            <span id="btn-text">${t('nav.login')}</span>
            <span id="btn-loader" class="hidden skeleton w-5 h-5 rounded-full border-2 border-white/30 border-t-white !bg-transparent animate-spin"></span>
          </button>
        </form>

        <div class="mt-6 text-center text-sm text-muted">
          ${t('auth.no_account')} <a href="/register" onclick="navigate(event, '/register')" class="text-primary font-semibold hover:underline">${t('nav.register')}</a>
        </div>
      </div>
    </div>
  `;
}

export function Register() {
  window.onMount = () => {
    const form = document.getElementById('register-form');
    const btn = document.getElementById('register-btn');
    const btnText = document.getElementById('btn-text');
    const btnLoader = document.getElementById('btn-loader');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fullName = form.fullName.value;
      const phone = form.phone.value;
      const password = form.password.value;

      try {
        btn.disabled = true;
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');

        const data = await apiFetch('/auth/register', {
          method: 'POST',
          body: { fullName, phone, password }
        });
        const user = data?.user;

        if (user) {
          store.setUser(user);
          window.toast('Account created successfully', 'success');
          App.navigate('/dashboard');
        }
      } catch (err) {
        window.toast(err.message || t('common.error'), 'error');
        btn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
      }
    });
  };

  return `
    <div class="flex-1 w-full max-w-md mx-auto px-4 py-20 flex flex-col justify-center">
      <div class="bg-surface border border-border rounded-2xl p-8 shadow-sm">
        <div class="text-center mb-8">
          <div class="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4 tracking-tighter">EV</div>
          <h1 class="text-2xl font-heading font-bold text-text">${t('auth.register_title')}</h1>
        </div>

        <form id="register-form" class="space-y-5">
          <div>
             <label class="block text-sm font-medium text-text mb-1">${t('auth.fullName')}</label>
             <input type="text" name="fullName" required class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors" placeholder="John Doe">
          </div>
          <div>
            <label class="block text-sm font-medium text-text mb-1">${t('auth.phone')}</label>
            <input type="tel" name="phone" required class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors" placeholder="+962790000000">
          </div>
          <div>
            <label class="block text-sm font-medium text-text mb-1">${t('auth.password')}</label>
            <input type="password" name="password" required class="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors">
          </div>
          
          <button id="register-btn" type="submit" class="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-semibold transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed mt-2">
            <span id="btn-text">${t('nav.register')}</span>
            <span id="btn-loader" class="hidden skeleton w-5 h-5 rounded-full border-2 border-white/30 border-t-white !bg-transparent animate-spin"></span>
          </button>
        </form>

        <div class="mt-6 text-center text-sm text-muted">
          ${t('auth.have_account')} <a href="/login" onclick="navigate(event, '/login')" class="text-primary font-semibold hover:underline">${t('nav.login')}</a>
        </div>
      </div>
    </div>
  `;
}
