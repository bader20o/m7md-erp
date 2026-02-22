import { t } from '../../lib/i18n.js';

export function Home() {
    // We attach a small animation script or logic if needed, but for simplicity, css covers most of it.

    return `
    <div class="flex-1 w-full flex flex-col items-center">
      
      <!-- Hero Section -->
      <section class="w-full bg-surface border-b border-border py-20 px-4 md:py-32 relative overflow-hidden">
        <!-- Background decorative elements -->
        <div class="absolute top-0 right-0 -m-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        <div class="absolute bottom-0 left-0 -m-32 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
        
        <div class="max-w-4xl mx-auto text-center relative z-10 flex flex-col items-center">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
            <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            Next-Gen EV Service
          </div>
          
          <h1 class="text-4xl md:text-6xl font-heading font-bold text-text mb-6 leading-tight">
            ${t('hero.title')}
          </h1>
          
          <p class="text-lg md:text-xl text-muted mb-10 max-w-2xl leading-relaxed">
            ${t('hero.subtitle')}
          </p>
          
          <div class="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <button onclick="navigate(event, '/login')" class="px-8 py-3.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-semibold shadow-lg shadow-primary/30 transition-all card-hover text-lg">
              ${t('hero.book_now')}
            </button>
            <button onclick="navigate(event, '/services')" class="px-8 py-3.5 bg-surface border-2 border-border hover:border-text text-text rounded-xl font-semibold transition-all card-hover text-lg">
              ${t('hero.view_services')}
            </button>
          </div>
        </div>
      </section>

      <!-- Highlights / Trust Section -->
      <section class="w-full max-w-7xl mx-auto px-4 py-20">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <!-- Card 1 -->
          <div class="bg-surface border border-border rounded-2xl p-8 flex flex-col items-center text-center card-hover">
            <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            </div>
            <h3 class="text-xl font-heading font-bold text-text mb-3">Lightning Fast</h3>
            <p class="text-muted leading-relaxed">Most diagnostics and routing maintenance performed within an hour, minimizing your downtime.</p>
          </div>
          
          <!-- Card 2 -->
          <div class="bg-surface border border-border rounded-2xl p-8 flex flex-col items-center text-center card-hover">
            <div class="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-6">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            </div>
            <h3 class="text-xl font-heading font-bold text-text mb-3">Dealer-Level Trust</h3>
            <p class="text-muted leading-relaxed">Certified technicians using official OEM diagnostic tools and protocols for your vehicle.</p>
          </div>

          <!-- Card 3 -->
          <div class="bg-surface border border-border rounded-2xl p-8 flex flex-col items-center text-center card-hover">
            <div class="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-6">
              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h3 class="text-xl font-heading font-bold text-text mb-3">Transparent Pricing</h3>
            <p class="text-muted leading-relaxed">No hidden fees, no unnecessary upsells. What you see is what you pay, guaranteed.</p>
          </div>
        </div>
      </section>

      <!-- Membership Banner CTA -->
      <section class="w-full bg-text text-bg py-16 px-4">
        <div class="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <div>
            <h2 class="text-3xl font-heading font-bold mb-2">Join our Elite Membership</h2>
            <p class="text-gray-400 max-w-md">Get free towing, quarterly checkups, and exclusive discounts on all parts and labor.</p>
          </div>
          <button onclick="navigate(event, '/register')" class="bg-primary hover:bg-primary-hover text-white px-8 py-3 rounded-xl font-bold whitespace-nowrap transition-colors">
            View Plans
          </button>
        </div>
      </section>

    </div>
  `;
}
