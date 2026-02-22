import { t } from '../../lib/i18n.js';
import { store } from '../../lib/store.js';
import { apiFetch } from '../../lib/api.js';
import { KPISkeleton } from '../../components/ui/Skeleton.js';

export function CustomerDashboard() {
    window.onMount = async () => {
        const nextBookingContainer = document.getElementById('next-booking');
        const membershipContainer = document.getElementById('membership-summary');

        // Quick fetches for summary
        try {
            const [bookings, memberships] = await Promise.all([
                apiFetch('/bookings'),
                apiFetch('/memberships/orders')
            ]);

            // Handle next booking
            if (bookings && bookings.items) {
                const upcoming = bookings.items
                    .filter(b => ['PENDING', 'APPROVED'].includes(b.status))
                    .sort((a, b) => new Date(a.appointmentAt) - new Date(b.appointmentAt))[0];

                if (upcoming) {
                    const d = new Date(upcoming.appointmentAt);
                    nextBookingContainer.innerHTML = `
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs text-muted font-semibold uppercase tracking-wider mb-1">Next Appointment</p>
                <h4 class="font-heading font-bold text-lg text-text leading-tight">${store.state.lang === 'ar' ? upcoming.serviceNameSnapshotAr : upcoming.serviceNameSnapshotEn}</h4>
                <div class="text-sm text-muted mt-1 flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  ${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <span class="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase">${upcoming.status}</span>
            </div>
            <button onclick="navigate(event, '/my-bookings')" class="mt-4 w-full py-2 border border-border rounded-lg text-sm font-medium hover:bg-surface transition-colors">View Details</button>
          `;
                } else {
                    nextBookingContainer.innerHTML = `
            <div class="text-center py-4">
              <p class="text-muted text-sm mb-4">No upcoming appointments</p>
              <button onclick="navigate(event, '/book')" class="px-5 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">Book a Service</button>
            </div>
          `;
                }
            }

            // Handle membership
            if (memberships && memberships.items) {
                const active = memberships.items.find(m => m.status === 'ACTIVE');
                if (active) {
                    membershipContainer.innerHTML = `
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs text-muted font-semibold uppercase tracking-wider">Active Plan</span>
              <span class="bg-green-500/10 text-green-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase">ACTIVE</span>
            </div>
            <h4 class="font-heading font-bold text-xl text-text mb-1">${store.state.lang === 'ar' ? active.plan.nameAr : active.plan.nameEn} Plan</h4>
            <p class="text-xs text-muted mb-4">Valid until ${new Date(active.endDate).toLocaleDateString()}</p>
            <button onclick="navigate(event, '/membership')" class="w-full py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">View Benefits</button>
          `;
                } else {
                    membershipContainer.innerHTML = `
            <div class="text-center py-4">
              <div class="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-3">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
              </div>
              <p class="text-sm font-semibold text-text mb-1">Upgrade your Care</p>
              <p class="text-xs text-muted mb-4">Join our membership for exclusive benefits</p>
              <button onclick="navigate(event, '/membership')" class="px-5 py-2 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary/5 transition-colors">View Plans</button>
            </div>
          `;
                }
            }
        } catch (e) {
            console.error('Dashboard load error', e);
        }
    };

    const { user } = store.state;

    return `
    <div class="flex flex-col gap-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-2">
        <div>
          <h1 class="text-2xl md:text-3xl font-heading font-bold text-text">Welcome back, ${user.fullName ? user.fullName.split(' ')[0] : 'User'}</h1>
          <p class="text-muted mt-1">Here is what's happening with your EV today.</p>
        </div>
        <div class="w-12 h-12 bg-gradient-to-tr from-primary to-blue-400 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-md hidden sm:flex">
          ${user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
        </div>
      </div>

      <!-- Quick Actions Grid -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button onclick="navigate(event, '/book')" class="bg-surface border border-border p-4 rounded-2xl flex flex-col items-center gap-3 card-hover text-center">
          <div class="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          </div>
          <span class="font-semibold text-sm text-text">Book Service</span>
        </button>
        <button onclick="navigate(event, '/my-bookings')" class="bg-surface border border-border p-4 rounded-2xl flex flex-col items-center gap-3 card-hover text-center">
          <div class="w-12 h-12 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
          </div>
          <span class="font-semibold text-sm text-text">My Bookings</span>
        </button>
        <button onclick="navigate(event, '/membership')" class="bg-surface border border-border p-4 rounded-2xl flex flex-col items-center gap-3 card-hover text-center">
          <div class="w-12 h-12 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
          </div>
          <span class="font-semibold text-sm text-text">Membership</span>
        </button>
        <button onclick="navigate(event, '/chat')" class="bg-surface border border-border p-4 rounded-2xl flex flex-col items-center gap-3 card-hover text-center relative">
          <div class="w-12 h-12 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
          </div>
          <span class="font-semibold text-sm text-text">Chat Support</span>
        </button>
      </div>

      <!-- Widgets Row -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
        
        <!-- Next Booking Widget -->
        <div class="bg-surface border border-border rounded-2xl p-6">
          <h3 class="font-heading font-bold gap-2 text-text mb-4 border-b border-border pb-2 flex items-center">
            <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            Upcoming Booking
          </h3>
          <div id="next-booking">
             <div class="skeleton h-[100px] rounded-lg w-full"></div>
          </div>
        </div>

        <!-- Active Membership Widget -->
        <div class="bg-surface border border-border rounded-2xl p-6 relative overflow-hidden">
          <!-- decorative bg -->
          <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-purple-500/5 rounded-full blur-2xl"></div>
          <h3 class="font-heading font-bold gap-2 text-text mb-4 border-b border-border pb-2 flex items-center">
            <svg class="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path></svg>
            Membership Status
          </h3>
          <div id="membership-summary" class="relative z-10">
             <div class="skeleton h-[100px] rounded-lg w-full"></div>
          </div>
        </div>

      </div>

    </div>
  `;
}
