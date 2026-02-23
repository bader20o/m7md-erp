import { t } from '../../lib/i18n.js';
import { apiFetch } from '../../lib/api.js';
import { CardSkeleton } from '../../components/ui/Skeleton.js';
import { store } from '../../lib/store.js';

function rankTopServices(items) {
  return [...items].sort((a, b) => {
    const aPrice = Number(a.basePrice || 0);
    const bPrice = Number(b.basePrice || 0);
    if (bPrice !== aPrice) return bPrice - aPrice;
    return Number(a.durationMinutes || 0) - Number(b.durationMinutes || 0);
  });
}

export function Services() {
  window.onMount = async () => {
    const container = document.getElementById('services-grid');
    const searchInput = document.getElementById('search-services');
    const topBtn = document.getElementById('services-filter-top');
    const allBtn = document.getElementById('services-filter-all');

    let allServices = [];
    let mode = 'top';

    container.innerHTML = Array(6).fill(CardSkeleton()).join('');

    try {
      const response = await apiFetch('/services');
      allServices = (response?.items || []).filter((service) => service.isActive);
      renderCurrent();
    } catch (error) {
      container.innerHTML = `<div class="col-span-12 text-center text-danger py-10">${error.message || t('common.error')}</div>`;
    }

    function setModeStyles() {
      const topActive = mode === 'top';
      topBtn.className = `px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
        topActive ? 'bg-primary text-white' : 'border border-border text-text hover:border-primary'
      }`;
      allBtn.className = `px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
        !topActive ? 'bg-primary text-white' : 'border border-border text-text hover:border-primary'
      }`;
    }

    function getVisibleServices() {
      const query = searchInput.value.trim().toLowerCase();
      const searched = allServices.filter(
        (service) =>
          (service.nameEn && service.nameEn.toLowerCase().includes(query)) ||
          (service.nameAr && service.nameAr.toLowerCase().includes(query))
      );

      if (mode === 'all') {
        return searched;
      }

      return rankTopServices(searched).slice(0, 6);
    }

    function renderCurrent() {
      setModeStyles();
      renderServices(getVisibleServices());
    }

    function renderServices(services) {
      if (!services.length) {
        container.innerHTML = '<div class="col-span-12 text-center text-muted py-10">No services match this filter.</div>';
        return;
      }

      const lang = store.state.lang;
      container.innerHTML = services
        .map((service) => {
          const title = lang === 'ar' ? service.nameAr : service.nameEn;
          const desc = lang === 'ar' ? service.descriptionAr || '' : service.descriptionEn || '';
          const hasPrice = service.basePrice !== null && service.basePrice !== undefined;
          const priceText = hasPrice
            ? `${Number(service.basePrice).toFixed(2)} JOD`
            : '\u063A\u064A\u0631 \u0645\u062D\u062F\u062F';

          return `
            <article class="bg-surface border border-border rounded-2xl overflow-hidden flex flex-col card-hover h-full">
              <div class="h-44 bg-bg border-b border-border overflow-hidden">
                ${
                  service.imageUrl
                    ? `<img src="${service.imageUrl}" alt="${title}" class="w-full h-full object-cover">`
                    : '<div class="w-full h-full flex items-center justify-center text-muted text-sm">No image</div>'
                }
              </div>
              <div class="p-6 flex flex-col gap-4 flex-1">
                <div class="flex items-start justify-between gap-3">
                  <h3 class="font-heading font-bold text-lg text-text leading-tight">${title}</h3>
                  ${
                    service.category
                      ? `<span class="bg-muted/10 text-muted px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider">${service.category}</span>`
                      : ''
                  }
                </div>
                <p class="text-sm text-muted flex-1">${desc || 'No description available.'}</p>
                <div class="flex items-center justify-between gap-3">
                  <div class="text-sm text-text">
                    <span class="font-semibold">${t('services.duration', { min: service.durationMinutes })}</span>
                  </div>
                  <div class="text-base font-extrabold ${hasPrice ? 'text-primary' : 'text-muted'}">${priceText}</div>
                </div>
                <button onclick="navigate(event, '/login')" class="w-full py-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl font-semibold transition-colors">
                  ${t('services.book')}
                </button>
              </div>
            </article>
          `;
        })
        .join('');
    }

    searchInput.addEventListener('input', renderCurrent);
    topBtn.addEventListener('click', () => {
      mode = 'top';
      renderCurrent();
    });
    allBtn.addEventListener('click', () => {
      mode = 'all';
      renderCurrent();
    });
  };

  return `
    <div class="flex-1 w-full max-w-7xl mx-auto px-4 py-12 md:py-20 flex flex-col items-center">
      <div class="text-center mb-10 max-w-2xl mx-auto">
        <h1 class="text-4xl md:text-5xl font-heading font-bold text-text mb-4">${t('services.title')}</h1>
        <p class="text-lg text-muted">Browse our specialized maintenance and repair services for EV and hybrid vehicles.</p>
      </div>

      <div class="w-full flex flex-col lg:flex-row items-center justify-between gap-4 mb-10">
        <div class="w-full max-w-md relative">
          <input type="text" id="search-services" placeholder="${t('common.search')}" class="w-full pl-12 pr-4 py-3 bg-surface border border-border rounded-xl text-text focus:outline-none focus:border-primary transition-colors shadow-sm">
          <svg class="w-5 h-5 text-muted absolute left-4 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
        </div>
        <div class="flex items-center gap-2">
          <button id="services-filter-top" class="px-4 py-2 rounded-lg border border-border text-text text-sm font-semibold">Top Services</button>
          <button id="services-filter-all" class="px-4 py-2 rounded-lg border border-border text-text text-sm font-semibold">All Services</button>
        </div>
      </div>

      <div id="services-grid" class="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"></div>
    </div>
  `;
}
