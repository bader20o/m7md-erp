import { t } from '../../lib/i18n.js';
import { apiFetch } from '../../lib/api.js';
import { store } from '../../lib/store.js';
import { CardSkeleton } from '../../components/ui/Skeleton.js';
import { DateInput } from '../../components/ui/DateInput.js';
import {
  formatDuration,
  getPriceText,
  parseSupportedCarTypes,
  renderPriceBadge,
  renderServiceCard,
  sanitizeServiceText
} from '../../components/services/ServiceCard.js';

const CAR_TYPE_TABS = [
  { value: 'ALL', label: 'All' },
  { value: 'EV', label: 'EV' },
  { value: 'HYBRID', label: 'Hybrid' },
  { value: 'FUEL', label: 'Fuel' }
];

export function BookService() {
  let currentStep = 1;
  let selectedService = null;
  let selectedDate = null;
  let selectedTime = null;
  let servicesParams = [];
  let activeCarType = 'ALL';
  let appliedInitialServiceId = false;

  window.onMount = async () => {
    loadServices();

    document.getElementById('date-input').addEventListener('change', (e) => {
      selectedDate = e.target.value;
      if (selectedDate) generateTimeSlots();
    });
  };

  function serviceMatchesCarType(service, carType) {
    if (carType === 'ALL') return true;
    const supported = parseSupportedCarTypes(service.supportedCarTypes);
    if (supported.length === 0) return true;
    return supported.includes(carType);
  }

  function getServiceCardBadge(service) {
    const supported = parseSupportedCarTypes(service.supportedCarTypes);
    const preferred = activeCarType !== 'ALL' && supported.includes(activeCarType)
      ? activeCarType
      : supported[0];

    if (preferred === 'HYBRID') return 'Hybrid';
    if (preferred === 'FUEL') return 'Fuel';
    if (preferred === 'EV') return 'EV';

    const category = String(service.category || '').toLowerCase();
    if (category.includes('hybrid')) return 'Hybrid';
    if (category.includes('fuel') || category.includes('engine')) return 'Fuel';
    return 'EV';
  }

  function renderCarTypeTabs() {
    const tabs = CAR_TYPE_TABS.map((tab) => {
      const activeClass = activeCarType === tab.value
        ? 'border-sky-500 bg-sky-500 text-white shadow-sm'
        : 'border-border bg-transparent text-muted hover:border-primary/30 hover:text-text';
      return `
        <button
          type="button"
          class="flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${activeClass}"
          onclick="window.setBookCarType('${tab.value}')"
        >
          ${tab.label}
        </button>
      `;
    }).join('');

    return `<div class="flex gap-1 rounded-xl border border-border bg-bg/80 p-1 mb-4">${tabs}</div>`;
  }

  function renderSelectedServiceSummary(service, isRtl) {
    if (!service) return '';

    const title = sanitizeServiceText(isRtl ? service.nameAr : service.nameEn);
    const duration = formatDuration(service.durationMinutes);
    const priceMarkup = renderPriceBadge(service.basePrice);

    return `
      <div class="mt-4 flex items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-500/10 px-4 py-3 ${isRtl ? 'flex-row-reverse' : ''}">
        <div class="${isRtl ? 'text-right' : ''}">
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">Selected</p>
          <p class="text-sm font-semibold text-text">${title}</p>
        </div>
        <div class="flex items-center gap-2 ${isRtl ? 'flex-row-reverse' : ''}">
          <span class="rounded-full bg-muted/10 px-2.5 py-1 text-xs font-semibold text-text">${duration}</span>
          ${priceMarkup}
        </div>
      </div>
    `;
  }

  function applyInitialServiceSelection() {
    if (appliedInitialServiceId || selectedService) return;

    const initialServiceId = new URLSearchParams(window.location.search).get('serviceId');
    if (!initialServiceId) return;

    const match = servicesParams.find((service) => service.id === initialServiceId);
    if (!match) return;

    selectedService = match;
    appliedInitialServiceId = true;
  }

  function renderServiceCards() {
    const list = document.getElementById('step-1-list');
    const lang = store.state.lang;
    const isRtl = lang === 'ar';
    const filtered = servicesParams.filter((service) => serviceMatchesCarType(service, activeCarType));

    list.className = 'space-y-4';

    if (filtered.length === 0) {
      list.innerHTML = `
        ${renderCarTypeTabs()}
        <div class="rounded-xl border border-border bg-bg px-4 py-8 text-center text-sm text-muted">
          No services available for this car type.
        </div>
      `;
      return;
    }

    const cards = filtered.map((service) => {
      const selected = selectedService?.id === service.id;
      const title = sanitizeServiceText(lang === 'ar' ? service.nameAr : service.nameEn);
      const description = sanitizeServiceText(lang === 'ar' ? service.descriptionAr : service.descriptionEn);
      const badgeLabel = getServiceCardBadge(service);

      return `
        ${renderServiceCard({
          service,
          title,
          description,
          badgeLabel,
          selected,
          selectedLabel: 'Selected',
          onClick: `window.selectService('${service.id}')`,
          className: isRtl ? 'text-right' : '',
          dark: true
        })}
      `;
    }).join('');

    list.innerHTML = `
      ${renderCarTypeTabs()}
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">${cards}</div>
      ${renderSelectedServiceSummary(selectedService, isRtl)}
    `;
  }

  async function loadServices() {
    const list = document.getElementById('step-1-list');
    list.innerHTML = Array(3).fill(CardSkeleton()).join('');

    try {
      const res = await apiFetch('/services');
      if (res && res.items) {
        servicesParams = res.items.filter((service) => service.isActive);
        applyInitialServiceSelection();
        renderServiceCards();
        document.getElementById('step-1-next').disabled = !selectedService;
      }
    } catch (e) {
      list.innerHTML = `<div class="text-danger p-4 container text-center">${t('common.error')}</div>`;
    }
  }

  window.setBookCarType = (carType) => {
    activeCarType = carType;

    if (selectedService && !serviceMatchesCarType(selectedService, activeCarType)) {
      selectedService = null;
      document.getElementById('step-1-next').disabled = true;
    }

    renderServiceCards();
  };

  window.selectService = (id) => {
    selectedService = servicesParams.find((service) => service.id === id) || null;
    renderServiceCards();
    document.getElementById('step-1-next').disabled = !selectedService;
  };

  window.nextStep = (step) => {
    document.getElementById(`step-${currentStep}`).classList.add('hidden');
    document.getElementById(`step-${step}`).classList.remove('hidden');

    document.getElementById(`stepper-num-${currentStep}`).classList.remove('bg-primary', 'text-white');
    document.getElementById(`stepper-num-${currentStep}`).classList.add('bg-muted/20', 'text-muted');
    document.getElementById(`stepper-num-${step}`).classList.remove('bg-muted/20', 'text-muted');
    document.getElementById(`stepper-num-${step}`).classList.add('bg-primary', 'text-white');

    currentStep = step;

    if (step === 3) populateConfirmation();
  };

  window.prevStep = (step) => {
    window.nextStep(step);
  };

  function generateTimeSlots() {
    const timeGrid = document.getElementById('time-grid');
    const slots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

    timeGrid.innerHTML = slots.map((time) => `
      <div id="slot-${time.replace(':', '')}" class="p-3 border border-border rounded-xl text-center cursor-pointer hover:border-primary transition-colors text-sm font-medium" onclick="window.selectTime('${time}')">
        ${time}
      </div>
    `).join('');
  }

  window.selectTime = (time) => {
    selectedTime = time;
    document.querySelectorAll('[id^="slot-"]').forEach((el) => {
      el.classList.remove('border-primary', 'bg-primary/10', 'text-primary');
      el.classList.add('border-border');
    });
    const slot = document.getElementById(`slot-${time.replace(':', '')}`);
    slot.classList.remove('border-border');
    slot.classList.add('border-primary', 'bg-primary/10', 'text-primary');
    document.getElementById('step-2-next').disabled = false;
  };

  function populateConfirmation() {
    const lang = store.state.lang;
    const title = sanitizeServiceText(lang === 'ar' ? selectedService.nameAr : selectedService.nameEn);
    document.getElementById('conf-service').textContent = title;
    document.getElementById('conf-datetime').textContent = `${selectedDate} at ${selectedTime}`;
    document.getElementById('conf-price').textContent = getPriceText(selectedService.basePrice);
  }

  window.submitBooking = async () => {
    const notes = document.getElementById('booking-notes').value;
    const btn = document.getElementById('submit-btn');

    const appointmentAt = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();

    try {
      btn.disabled = true;
      btn.innerHTML = `<span class="skeleton w-5 h-5 rounded-full border-2 border-white/30 border-t-white !bg-transparent animate-spin"></span>`;

      await apiFetch('/bookings', {
        method: 'POST',
        body: {
          serviceId: selectedService.id,
          appointmentAt,
          notes,
          branchId: 'MAIN'
        }
      });

      window.toast('Booking confirmed successfully!', 'success');
      App.navigate('/my-bookings');
    } catch (e) {
      window.toast(e.message || t('common.error'), 'error');
      btn.disabled = false;
      btn.innerHTML = 'Confirm & Book';
    }
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return `
    <div class="flex flex-col gap-6 w-full max-w-4xl mx-auto">
      <div>
        <h1 class="text-2xl md:text-3xl font-heading font-bold text-text">Book highly-trained experts</h1>
        <p class="text-muted mt-1">Select your service, choose a time, and drop off your vehicle.</p>
      </div>

      <div class="flex items-center justify-between bg-surface border border-border p-4 rounded-xl mb-4">
        <div class="flex items-center gap-3">
          <div id="stepper-num-1" class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm transition-colors">1</div>
          <span class="font-medium text-sm hidden sm:block">Select Service</span>
        </div>
        <div class="flex-1 h-px bg-border mx-4"></div>
        <div class="flex items-center gap-3">
          <div id="stepper-num-2" class="w-8 h-8 rounded-full bg-muted/20 text-muted flex items-center justify-center font-bold text-sm transition-colors">2</div>
          <span class="font-medium text-sm hidden sm:block text-muted">Date & Time</span>
        </div>
        <div class="flex-1 h-px bg-border mx-4"></div>
        <div class="flex items-center gap-3">
          <div id="stepper-num-3" class="w-8 h-8 rounded-full bg-muted/20 text-muted flex items-center justify-center font-bold text-sm transition-colors">3</div>
          <span class="font-medium text-sm hidden sm:block text-muted">Confirm</span>
        </div>
      </div>

      <div id="step-1" class="fade-in">
        <div class="bg-surface border border-border rounded-xl p-6 mb-6">
          <h2 class="text-lg font-bold text-text mb-4">What does your EV need?</h2>
          <div id="step-1-list" class="flex flex-col gap-4">
          </div>
        </div>
        <div class="flex justify-end">
          <button id="step-1-next" disabled onclick="nextStep(2)" class="px-6 py-2.5 bg-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-hover text-white rounded-lg font-semibold transition-all">Proceed to Time Slot</button>
        </div>
      </div>

      <div id="step-2" class="hidden fade-in">
        <div class="bg-surface border border-border rounded-xl p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 class="text-lg font-bold text-text mb-4">Choose a Date</h2>
            ${DateInput({ id: 'date-input', min: minDate })}
          </div>
          <div>
             <h2 class="text-lg font-bold text-text mb-4">Available Slots</h2>
             <div id="time-grid" class="grid grid-cols-3 gap-3">
               <div class="col-span-3 text-sm text-center text-muted py-6">Please select a date first.</div>
             </div>
          </div>
        </div>
        <div class="flex justify-between">
          <button onclick="prevStep(1)" class="px-6 py-2.5 border border-border text-text rounded-lg font-medium hover:bg-surface transition-all">Back</button>
          <button id="step-2-next" disabled onclick="nextStep(3)" class="px-6 py-2.5 bg-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-hover text-white rounded-lg font-semibold transition-all">Review Booking</button>
        </div>
      </div>

      <div id="step-3" class="hidden fade-in">
        <div class="bg-surface border border-border rounded-xl p-6 mb-6">
          <h2 class="text-lg font-bold text-text mb-6">Review your Booking</h2>
          
          <div class="bg-bg border border-border rounded-xl p-5 space-y-4 mb-6">
            <div class="flex justify-between items-start border-b border-border pb-4">
              <div>
                <p class="text-xs text-muted uppercase tracking-wider font-semibold mb-1">Service</p>
                <div id="conf-service" class="font-heading font-bold text-lg text-text"></div>
              </div>
              <div class="text-right">
                <p class="text-xs text-muted uppercase tracking-wider font-semibold mb-1">Price</p>
                <div id="conf-price" class="font-bold text-primary"></div>
              </div>
            </div>
            <div>
              <p class="text-xs text-muted uppercase tracking-wider font-semibold mb-1">Schedule</p>
              <div id="conf-datetime" class="font-medium text-text flex items-center gap-2"></div>
            </div>
          </div>

          <div>
             <label class="block text-sm font-medium text-text mb-2">Optional Notes (Issues, branch preference, etc.)</label>
             <textarea id="booking-notes" rows="3" class="w-full px-4 py-3 bg-bg border border-border rounded-xl focus:border-primary outline-none transition-colors text-text resize-none" placeholder="Is there anything specific we should know about?"></textarea>
          </div>
        </div>
        
        <div class="flex justify-between">
          <button onclick="prevStep(2)" class="px-6 py-2.5 border border-border text-text rounded-lg font-medium hover:bg-surface transition-all">Back</button>
          <button id="submit-btn" onclick="submitBooking()" class="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white justify-center flex items-center w-40 rounded-lg font-bold transition-all shadow-md">Confirm & Book</button>
        </div>
      </div>
    </div>
  `;
}
