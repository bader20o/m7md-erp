import { t } from '../../lib/i18n.js';
import { apiFetch } from '../../lib/api.js';
import { CardSkeleton } from '../../components/ui/Skeleton.js';
import { store } from '../../lib/store.js';

export function Services() {

    window.onMount = async () => {
        const container = document.getElementById('services-grid');
        const searchInput = document.getElementById('search-services');
        let allServices = [];

        // Load state
        container.innerHTML = Array(6).fill(CardSkeleton()).join('');

        try {
            const response = await apiFetch('/services');
            if (response && response.items) {
                allServices = response.items.filter(s => s.isActive);
                renderServices(allServices);
            } else {
                container.innerHTML = `<div class="col-span-12 text-center text-muted py-10">No services found</div>`;
            }
        } catch (e) {
            container.innerHTML = `<div class="col-span-12 text-center text-danger py-10">${t('common.error')}</div>`;
        }

        searchInput.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtered = allServices.filter(s =>
                (s.nameEn && s.nameEn.toLowerCase().includes(q)) ||
                (s.nameAr && s.nameAr.toLowerCase().includes(q))
            );
            renderServices(filtered);
        });

        function renderServices(services) {
            if (services.length === 0) {
                container.innerHTML = `<div class="col-span-12 text-center text-muted py-10">No results match your search</div>`;
                return;
            }

            const lang = store.state.lang;
            container.innerHTML = services.map(s => {
                const title = lang === 'ar' ? s.nameAr : s.nameEn;
                const desc = lang === 'ar' ? (s.descriptionAr || '') : (s.descriptionEn || '');
                const price = s.basePrice ? t('services.price', { price: s.basePrice }) : 'Price varies';

                return `
          <div class="bg-surface border border-border rounded-2xl p-6 flex flex-col card-hover h-full">
            <div class="flex items-start justify-between mb-4">
              <h3 class="font-heading font-bold text-lg text-text leading-tight">${title}</h3>
              ${s.category ? `<span class="bg-muted/10 text-muted px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider">${s.category}</span>` : ''}
            </div>
            <p class="text-sm text-muted mb-6 flex-1 line-clamp-3">${desc}</p>
            
            <div class="mt-auto">
              <div class="flex items-center gap-4 text-sm font-medium text-text mb-4">
                <div class="flex items-center gap-1.5">
                  <svg class="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  ${t('services.duration', { min: s.durationMinutes })}
                </div>
                <div class="flex items-center gap-1.5">
                  <svg class="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  ${price}
                </div>
              </div>
              <button onclick="navigate(event, '/login')" class="w-full py-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl font-semibold transition-colors">
                ${t('services.book')}
              </button>
            </div>
          </div>
        `;
            }).join('');
        }
    };

    return `
    <div class="flex-1 w-full max-w-7xl mx-auto px-4 py-12 md:py-20 flex flex-col items-center">
      <div class="text-center mb-12 max-w-2xl mx-auto">
        <h1 class="text-4xl md:text-5xl font-heading font-bold text-text mb-4">${t('services.title')}</h1>
        <p class="text-lg text-muted">Browse our comprehensive list of specialized maintenance and repair services for EV and Hybrid vehicles.</p>
      </div>

      <div class="w-full max-w-md mb-12 relative">
        <input type="text" id="search-services" placeholder="${t('common.search')}" class="w-full pl-12 pr-4 py-3 bg-surface border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors shadow-sm">
        <svg class="w-5 h-5 text-muted absolute left-4 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
      </div>

      <div id="services-grid" class="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Rendered dynamically -->
      </div>
    </div>
  `;
}
