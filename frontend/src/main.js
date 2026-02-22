import { store } from './lib/store.js';
import { apiFetch } from './lib/api.js';
import { Toast } from './components/ui/Toast.js';

import { PublicLayout } from './components/layouts/PublicLayout.js';
import { CustomerLayout } from './components/layouts/CustomerLayout.js';
import { AdminLayout } from './components/layouts/AdminLayout.js';

import { Home } from './pages/public/Home.js';
import { Services } from './pages/public/Services.js';
import { Login, Register } from './pages/public/Auth.js';
import { Contact } from './pages/public/Contact.js';

import { CustomerDashboard } from './pages/customer/Dashboard.js';
import { BookService } from './pages/customer/BookService.js';
import { MyBookings } from './pages/customer/MyBookings.js';
import { Chat } from './pages/customer/Chat.js';
import { Membership } from './pages/customer/Membership.js';
import { Profile } from './pages/customer/Profile.js';

import { AdminAnalytics } from './pages/admin/Analytics.js';
import { AdminBookings } from './pages/admin/Bookings.js';
import { AdminServices } from './pages/admin/Services.js';
import { AdminEmployees } from './pages/admin/Employees.js';
import { AdminAccounting } from './pages/admin/Accounting.js';
import { AdminUsers } from './pages/admin/Users.js';
import { AdminMemberships } from './pages/admin/Memberships.js';

// --- Antigravity SPA Core setup simulation ---
const App = {
    routes: {},
    currentPath: window.location.pathname,

    register(path, componentFn) {
        this.routes[path] = componentFn;
    },

    async navigate(path) {
        window.history.pushState({}, '', path);
        this.currentPath = path;
        await this.render();
    },

    async render() {
        const appDiv = document.getElementById('app');
        const component = this.routes[this.currentPath] || this.routes['/404'];

        if (component) {
            const html = await component();
            appDiv.innerHTML = html;

            // Execute any dom-ready scripts strictly returned or attached by components
            if (typeof window.onMount === 'function') {
                window.onMount();
                window.onMount = null;
            }
        } else {
            const isCustomer = this.currentPath.startsWith('/dashboard') || this.currentPath.startsWith('/book') || this.currentPath.startsWith('/my-bookings') || this.currentPath.startsWith('/chat') || this.currentPath.startsWith('/membership') || this.currentPath.startsWith('/profile');
            const isAdmin = this.currentPath.startsWith('/admin');

            const errorHtml = `<div class="p-10 text-center flex-1 flex flex-col items-center justify-center min-h-[50vh]"><h1 class="text-4xl font-bold text-text mb-4">404 - Not Found</h1><p class="text-muted mt-2 text-lg">The page <code class="bg-surface px-2 py-1 rounded text-primary">${this.currentPath}</code> does not exist.</p><button onclick="window.navigate(event, '/')" class="mt-8 px-6 py-2.5 bg-primary hover:bg-primary-hover transition-colors text-white rounded-lg font-bold">Go Home</button></div>`;

            let finalHtml = errorHtml;
            if (isAdmin) {
                finalHtml = AdminLayout(() => errorHtml);
            } else if (isCustomer) {
                finalHtml = CustomerLayout(() => errorHtml);
            } else {
                finalHtml = PublicLayout(() => errorHtml);
            }

            // We must handle layout wrapping strings vs returning string directly
            appDiv.innerHTML = typeof finalHtml === 'string' ? finalHtml : errorHtml;
        }
    },

    async init() {
        store.init();

        try {
            // App Init Requirement: Fetch /api/auth/me
            const data = await apiFetch('/auth/me');
            if (data && data.user) {
                store.setUser(data.user);
            }
        } catch (e) {
            console.warn('Silent auth check failed. User is not logged in.');
        }

        window.addEventListener('popstate', () => {
            this.currentPath = window.location.pathname;
            this.render();
        });

        await this.render();

        // Remove global loader
        const loader = document.getElementById('global-loader');
        if (loader) {
            loader.classList.add('opacity-0');
            setTimeout(() => loader.remove(), 300);
        }
    }
};

window.App = App;
window.navigate = (event, path) => {
    if (event) event.preventDefault();
    App.navigate(path);
};

// --- Route Registration ---
App.register('/', () => PublicLayout(Home()));
App.register('/services', () => PublicLayout(Services()));
App.register('/login', () => PublicLayout(Login()));
App.register('/register', () => PublicLayout(Register()));
App.register('/contact', () => PublicLayout(Contact()));

App.register('/dashboard', () => CustomerLayout(CustomerDashboard()));
App.register('/book', () => CustomerLayout(BookService()));
App.register('/my-bookings', () => CustomerLayout(MyBookings()));
App.register('/chat', () => CustomerLayout(Chat()));
App.register('/membership', () => CustomerLayout(Membership()));
App.register('/profile', () => CustomerLayout(Profile()));

App.register('/admin/analytics', () => AdminLayout(AdminAnalytics()));
App.register('/admin/bookings', () => AdminLayout(AdminBookings()));
App.register('/admin/services', () => AdminLayout(AdminServices()));
App.register('/admin/employees', () => AdminLayout(AdminEmployees()));
App.register('/admin/accounting', () => AdminLayout(AdminAccounting()));
App.register('/admin/users', () => AdminLayout(AdminUsers()));
App.register('/admin/memberships', () => AdminLayout(AdminMemberships()));

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
