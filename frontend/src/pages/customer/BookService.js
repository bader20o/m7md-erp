import { t } from '../../lib/i18n.js';
import { apiFetch } from '../../lib/api.js';
import { store } from '../../lib/store.js';
import { CardSkeleton } from '../../components/ui/Skeleton.js';

export function BookService() {

    let currentStep = 1;
    let selectedService = null;
    let selectedDate = null;
    let selectedTime = null;
    let servicesParams = [];

    window.onMount = async () => {
        loadServices();

        document.getElementById('date-input').addEventListener('change', (e) => {
            selectedDate = e.target.value;
            if (selectedDate) generateTimeSlots();
        });
    };

    async function loadServices() {
        const list = document.getElementById('step-1-list');
        list.innerHTML = Array(3).fill(CardSkeleton()).join('');
        try {
            const res = await apiFetch('/services');
            if (res && res.items) {
                servicesParams = res.items.filter(s => s.isActive);
                const lang = store.state.lang;

                list.className = 'grid grid-cols-1 md:grid-cols-3 gap-4';
                list.innerHTML = servicesParams.map(s => {
                    const title = lang === 'ar' ? s.nameAr : s.nameEn;
                    const price = s.basePrice ? `From ${s.basePrice} JOD` : 'Variable';
                    return `
            <div id="service-card-${s.id}" class="bg-surface border border-border rounded-xl p-5 cursor-pointer transition-all hover:border-primary group" onclick="window.selectService('${s.id}')">
              <h4 class="font-heading font-bold text-text mb-2 group-hover:text-primary transition-colors">${title}</h4>
              <p class="text-xs text-muted mb-4 line-clamp-2">${lang === 'ar' ? (s.descriptionAr || '') : (s.descriptionEn || '')}</p>
              <div class="flex justify-between items-center mt-auto">
                <span class="text-xs font-semibold px-2 py-1 bg-muted/10 rounded">${s.durationMinutes} min</span>
                <span class="text-sm font-bold text-text">${price}</span>
              </div>
            </div>
          `;
                }).join('');
            }
        } catch (e) {
            list.innerHTML = `<div class="text-danger p-4 container text-center">${t('common.error')}</div>`;
        }
    }

    window.selectService = (id) => {
        // Clear previous selection
        document.querySelectorAll('[id^="service-card-"]').forEach(el => {
            el.classList.remove('border-primary', 'bg-primary/5', 'ring-2', 'ring-primary/20');
            el.classList.add('border-border');
        });

        selectedService = servicesParams.find(s => s.id === id);
        const card = document.getElementById(`service-card-${id}`);
        card.classList.remove('border-border');
        card.classList.add('border-primary', 'bg-primary/5', 'ring-2', 'ring-primary/20');

        document.getElementById('step-1-next').disabled = false;
    };

    window.nextStep = (step) => {
        document.getElementById(`step-${currentStep}`).classList.add('hidden');
        document.getElementById(`step-${step}`).classList.remove('hidden');

        // Update Stepper UI
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

        timeGrid.innerHTML = slots.map(t => `
      <div id="slot-${t.replace(':', '')}" class="p-3 border border-border rounded-xl text-center cursor-pointer hover:border-primary transition-colors text-sm font-medium" onclick="window.selectTime('${t}')">
        ${t}
      </div>
    `).join('');
    }

    window.selectTime = (time) => {
        selectedTime = time;
        document.querySelectorAll('[id^="slot-"]').forEach(el => {
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
        document.getElementById('conf-service').textContent = lang === 'ar' ? selectedService.nameAr : selectedService.nameEn;
        document.getElementById('conf-datetime').textContent = `${selectedDate} at ${selectedTime}`;
        document.getElementById('conf-price').textContent = selectedService.basePrice ? `${selectedService.basePrice} JOD` : 'Variable';
    }

    window.submitBooking = async () => {
        const notes = document.getElementById('booking-notes').value;
        const btn = document.getElementById('submit-btn');

        // Combine Date & Time to ISO
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
                    branchId: 'MAIN' // Assuming MAIN default
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

      <!-- Stepper Header -->
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

      <!-- STEP 1: Service Selection -->
      <div id="step-1" class="fade-in">
        <div class="bg-surface border border-border rounded-xl p-6 mb-6">
          <h2 class="text-lg font-bold text-text mb-4">What does your EV need?</h2>
          <div id="step-1-list" class="flex flex-col gap-4">
             <!-- Skeletons loaded via JS -->
          </div>
        </div>
        <div class="flex justify-end">
          <button id="step-1-next" disabled onclick="nextStep(2)" class="px-6 py-2.5 bg-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-hover text-white rounded-lg font-semibold transition-all">Proceed to Time Slot</button>
        </div>
      </div>

      <!-- STEP 2: Date & Time -->
      <div id="step-2" class="hidden fade-in">
        <div class="bg-surface border border-border rounded-xl p-6 mb-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 class="text-lg font-bold text-text mb-4">Choose a Date</h2>
            <input type="date" id="date-input" min="${minDate}" class="w-full px-4 py-3 bg-bg border border-border rounded-xl focus:border-primary outline-none transition-colors text-text custom-calendar-icon">
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

      <!-- STEP 3: Confirm -->
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
                <p class="text-xs text-muted uppercase tracking-wider font-semibold mb-1">Est. Price</p>
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
