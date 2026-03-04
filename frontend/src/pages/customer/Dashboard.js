import { apiFetch } from '../../lib/api.js';
import { store } from '../../lib/store.js';
import {
  renderServiceCard,
  sanitizeServiceText
} from '../../components/services/ServiceCard.js';

function getStatusTone(status) {
  if (status === 'APPROVED') return 'bg-sky-500/12 text-sky-300 border-sky-400/20';
  if (status === 'PENDING') return 'bg-amber-500/12 text-amber-300 border-amber-400/20';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'bg-rose-500/12 text-rose-300 border-rose-400/20';
  return 'bg-muted/10 text-muted border-border';
}

function getBadgeLabel(carType) {
  if (carType === 'HYBRID') return 'Hybrid';
  if (carType === 'FUEL') return 'Fuel';
  return 'EV';
}

function renderPopularSkeletons() {
  return Array.from({ length: 4 }, () => `
    <div class="min-w-0">
      <div class="overflow-hidden rounded-2xl border border-border bg-surface">
        <div class="skeleton aspect-[16/9] w-full"></div>
        <div class="p-4">
          <div class="skeleton h-4 w-2/3 rounded"></div>
          <div class="mt-3 skeleton h-3 w-full rounded"></div>
          <div class="mt-2 skeleton h-3 w-4/5 rounded"></div>
          <div class="mt-4 skeleton h-7 w-32 rounded-full"></div>
        </div>
      </div>
    </div>
  `).join('');
}

function renderPopularServiceCard(service) {
  const badge = getBadgeLabel(service.carType);
  const title = sanitizeServiceText(service.title);
  const description = sanitizeServiceText(service.description);

  return `
    <div class="min-w-0">
      ${renderServiceCard({
        service: {
          ...service,
          basePrice: service.price,
          imageUrl: service.imageUrl || service.image
        },
        title,
        description,
        badgeLabel: badge,
        onClick: `navigate(event, '/book?serviceId=${service.id}')`,
        dark: true
      })}
    </div>
  `;
}

export function CustomerDashboard() {
  window.onMount = async () => {
    const nextBookingContainer = document.getElementById('next-booking');
    const membershipContainer = document.getElementById('membership-summary');
    const popularContainer = document.getElementById('popular-services');
    const kpiContainer = document.getElementById('home-kpis');

    popularContainer.innerHTML = `<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">${renderPopularSkeletons()}</div>`;

    try {
      const [bookings, memberships, popular] = await Promise.all([
        apiFetch('/bookings'),
        apiFetch('/memberships/orders'),
        apiFetch('/services/popular')
      ]);

      const bookingItems = bookings?.items || [];
      const membershipItems = memberships?.items || [];
      const popularItems = (popular?.items || []).map((item) => {
        const title = store.state.lang === 'ar' ? (item.titleAr || item.title) : item.title;
        const description = store.state.lang === 'ar' ? (item.descriptionAr || item.description) : item.description;
        return {
          ...item,
          title,
          description
        };
      });

      const upcoming = bookingItems
        .filter((booking) => ['PENDING', 'APPROVED'].includes(booking.status))
        .sort((a, b) => new Date(a.appointmentAt) - new Date(b.appointmentAt))[0];

      const totalVisits = bookingItems.filter((booking) => booking.status === 'COMPLETED').length;
      if (totalVisits > 0) {
        kpiContainer.innerHTML = `
          <div class="rounded-2xl border border-border bg-surface px-5 py-4">
            <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Total Visits</p>
            <p class="mt-2 font-heading text-4xl font-bold leading-none text-text">${totalVisits}</p>
            <p class="mt-1 text-xs text-muted">Completed workshop appointments</p>
          </div>
        `;
        kpiContainer.classList.remove('hidden');
      } else {
        kpiContainer.classList.add('hidden');
      }

      if (upcoming) {
        const appointmentDate = new Date(upcoming.appointmentAt);
        nextBookingContainer.innerHTML = `
          <div class="rounded-xl border border-primary/15 bg-bg/70 p-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-muted">Next Appointment</p>
              <h4 class="card-title mt-1 font-heading leading-tight text-text">${store.state.lang === 'ar' ? upcoming.serviceNameSnapshotAr : upcoming.serviceNameSnapshotEn}</h4>
              <div class="mt-2 flex items-center gap-2 text-sm text-muted">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                ${appointmentDate.toLocaleDateString()} at ${appointmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <span class="inline-flex shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] ${getStatusTone(upcoming.status)}">${upcoming.status}</span>
          </div>
          <button onclick="navigate(event, '/my-bookings')" class="mt-4 w-full rounded-lg border border-border py-2 text-sm font-medium text-text transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">View Details</button>
          </div>
        `;
      } else {
        nextBookingContainer.innerHTML = `
          <div class="py-4 text-center">
            <p class="mb-4 text-sm text-muted">No upcoming appointments</p>
            <button onclick="navigate(event, '/book')" class="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">Book a Service</button>
          </div>
        `;
      }

      const activeMembership = membershipItems.find((item) => item.status === 'ACTIVE');
      if (activeMembership) {
        const usedVisits = Array.isArray(activeMembership.usages) ? activeMembership.usages.length : 0;
        const startDate = new Date(activeMembership.startDate);
        const endDate = new Date(activeMembership.endDate);
        const totalDuration = Math.max(1, endDate - startDate);
        const elapsedDuration = Math.min(totalDuration, Math.max(0, Date.now() - startDate.getTime()));
        const progressPercent = Math.min(100, Math.round((elapsedDuration / totalDuration) * 100));

        membershipContainer.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-muted">Active Plan</span>
            <span class="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300">Active</span>
          </div>
          <h4 class="card-title mt-3 font-heading text-text">${store.state.lang === 'ar' ? activeMembership.plan.nameAr : activeMembership.plan.nameEn} Plan</h4>
          <p class="mt-1 text-xs text-muted">Valid until ${new Date(activeMembership.endDate).toLocaleDateString()}</p>
          <div class="mt-4 rounded-xl border border-white/5 bg-bg/70 p-3">
            <div class="mb-2 flex items-center justify-between text-xs text-muted">
              <span>${usedVisits} visits used</span>
              <span>${progressPercent}%</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-white/8">
              <div class="h-full rounded-full bg-gradient-to-r from-purple-400 to-sky-400" style="width:${progressPercent}%"></div>
            </div>
          </div>
          <button onclick="navigate(event, '/membership')" class="mt-4 w-full rounded-lg border border-border bg-surface py-2 text-sm font-medium text-text transition-colors hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">View Benefits</button>
        `;
      } else {
        membershipContainer.innerHTML = `
          <div class="py-2">
            <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path></svg>
            </div>
            <p class="card-title text-text">Upgrade your Care</p>
            <p class="card-description mt-1">Join our membership for exclusive benefits</p>
            <div class="mt-4 rounded-xl border border-white/5 bg-bg/70 p-3">
              <div class="mb-2 flex items-center justify-between text-xs text-muted">
                <span>Join to unlock benefits</span>
                <span>0%</span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-white/8">
                <div class="h-full w-1/4 rounded-full bg-gradient-to-r from-white/10 to-white/20"></div>
              </div>
            </div>
            <button onclick="navigate(event, '/membership')" class="mt-4 rounded-lg border border-primary/40 px-5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">View Plans</button>
          </div>
        `;
      }

      if (popularItems.length > 0) {
        popularContainer.innerHTML = `<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">${popularItems.map(renderPopularServiceCard).join('')}</div>`;
        document.getElementById('popular-services-section').classList.remove('hidden');
      } else {
        document.getElementById('popular-services-section').classList.add('hidden');
      }
    } catch (error) {
      console.error('Dashboard load error', error);
      document.getElementById('popular-services-section').classList.add('hidden');
    }
  };

  const { user } = store.state;

  return `
    <div class="flex flex-col gap-6">
      <div class="mb-2 flex items-center justify-between">
        <div>
          <h1 class="font-heading text-2xl font-bold text-text md:text-3xl">Welcome back, ${user.fullName ? user.fullName.split(' ')[0] : 'User'}</h1>
          <p class="mt-1 text-muted">Here is what's happening with your EV today.</p>
        </div>
        <div class="hidden h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary to-blue-400 text-lg font-bold text-white shadow-md sm:flex">
          ${user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
        </div>
      </div>

      <div id="home-kpis" class="hidden grid grid-cols-1 gap-4 md:grid-cols-2"></div>

      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <button onclick="navigate(event, '/book')" class="group cursor-pointer rounded-2xl border border-border bg-surface p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:border-primary/40 hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
          </div>
          <span class="mt-3 block text-sm font-semibold text-text">Book Service</span>
        </button>
        <button onclick="navigate(event, '/my-bookings')" class="group cursor-pointer rounded-2xl border border-border bg-surface p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:border-primary/40 hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 transition-transform duration-200 group-hover:scale-105">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
          </div>
          <span class="mt-3 block text-sm font-semibold text-text">My Bookings</span>
        </button>
        <button onclick="navigate(event, '/membership')" class="group cursor-pointer rounded-2xl border border-border bg-surface p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:border-primary/40 hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/10 text-sky-400 transition-transform duration-200 group-hover:scale-105">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg>
          </div>
          <span class="mt-3 block text-sm font-semibold text-text">Membership</span>
        </button>
        <button onclick="navigate(event, '/chat')" class="group cursor-pointer rounded-2xl border border-border bg-surface p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:border-primary/40 hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 transition-transform duration-200 group-hover:scale-105">
            <svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
          </div>
          <span class="mt-3 block text-sm font-semibold text-text">Chat Support</span>
        </button>
      </div>

      <section id="popular-services-section" class="hidden">
        <div class="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 class="section-title font-heading text-text">Most Popular Services</h2>
            <p class="mt-1 text-sm text-muted">Most booked services this period</p>
          </div>
          <button onclick="navigate(event, '/book')" class="hidden items-center gap-1 text-sm font-medium text-primary transition-all hover:text-sky-300 hover:underline md:inline-flex">
            Browse all
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
          </button>
        </div>
        <div id="popular-services"></div>
      </section>

      <div class="mt-2 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div class="rounded-2xl border border-border bg-surface p-6 shadow-[0_16px_40px_-32px_rgba(14,116,144,0.4)]">
          <h3 class="section-title mb-4 flex items-center gap-2 border-b border-border pb-2 font-heading text-text">
            <svg class="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            Upcoming Booking
          </h3>
          <div id="next-booking">
            <div class="skeleton h-[100px] w-full rounded-lg"></div>
          </div>
        </div>

        <div class="relative overflow-hidden rounded-2xl border border-border bg-surface p-6">
          <div class="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-sky-500/5 blur-2xl"></div>
          <div class="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-sky-500/6 via-transparent to-transparent"></div>
          <h3 class="section-title relative z-10 mb-4 flex items-center gap-2 border-b border-border pb-2 font-heading text-text">
            <svg class="h-5 w-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"></path></svg>
            Membership Status
          </h3>
          <div id="membership-summary" class="relative z-10">
            <div class="skeleton h-[100px] w-full rounded-lg"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}
