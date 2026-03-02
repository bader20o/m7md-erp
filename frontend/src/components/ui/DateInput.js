export function DateInput({ id = '', name = '', min = '', value = '', onChangeAttr = '', className = '' } = {}) {
   const uniqueId = id || `date-${Math.random().toString(36).substr(2, 9)}`;
   const inputId = uniqueId;
   const popoverId = `${uniqueId}-popover`;
   const displayId = `${uniqueId}-display`;
   const gridId = `${uniqueId}-grid`;
   const monthYearId = `${uniqueId}-my`;

   if (typeof window !== 'undefined' && !window._dateInputV2Initialized) {
      window._dateInputV2Initialized = true;

      window.closeAllDatePopovers = () => {
         document.querySelectorAll('.custom-date-popover').forEach(p => p.classList.add('hidden'));
      };

      document.addEventListener('click', (e) => {
         if (!e.target.closest('.date-input-container')) {
            window.closeAllDatePopovers();
         }
      });

      window.toggleDatePopover = (popoverId, event, val, gridId, myId) => {
         if (event) {
            event.preventDefault();
            event.stopPropagation();
         }
         const el = document.getElementById(popoverId);
         if (el) {
            const isHidden = el.classList.contains('hidden');
            window.closeAllDatePopovers();
            if (isHidden) {
               el.classList.remove('hidden');
               window.renderCalendar(val, gridId, myId, popoverId);
            }
         }
      };

      window.renderCalendar = (currentVal, gridId, myId, popoverId, focusDateStr) => {
         const gridEl = document.getElementById(gridId);
         const myEl = document.getElementById(myId);
         if (!gridEl || !myEl) return;

         let focusDate = new Date();
         if (focusDateStr) {
            focusDate = new Date(focusDateStr);
         } else if (currentVal && !isNaN(new Date(currentVal).getTime())) {
            focusDate = new Date(currentVal);
         }

         const year = focusDate.getFullYear();
         const month = focusDate.getMonth();

         const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
         myEl.textContent = `${monthNames[month]} ${year}`;

         // prev/next month strings
         const prevMonthDate = new Date(year, month - 1, 1);
         const nextMonthDate = new Date(year, month + 1, 1);
         myEl.dataset.prev = prevMonthDate.toISOString();
         myEl.dataset.next = nextMonthDate.toISOString();

         const firstDay = new Date(year, month, 1).getDay();
         const daysInMonth = new Date(year, month + 1, 0).getDate();
         const daysInPrevMonth = new Date(year, month, 0).getDate();

         let html = '';
         // Days of week header
         const dows = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
         dows.forEach(d => {
            html += `<div class="text-[0.7rem] font-medium text-muted text-center w-8 h-8 flex items-center justify-center">${d}</div>`;
         });

         // Previous month overflow
         for (let i = 0; i < firstDay; i++) {
            const d = daysInPrevMonth - firstDay + i + 1;
            html += `<div class="w-8 h-8 flex items-center justify-center text-sm text-muted opacity-30">${d}</div>`;
         }

         const today = new Date();
         today.setHours(0, 0, 0, 0);

         let selectedDate = null;
         if (currentVal && !isNaN(new Date(currentVal).getTime())) {
            selectedDate = new Date(currentVal);
            selectedDate.setHours(0, 0, 0, 0);
         }

         // Current month days
         for (let i = 1; i <= daysInMonth; i++) {
            const cellDate = new Date(year, month, i);
            const isToday = cellDate.getTime() === today.getTime();
            const isSelected = selectedDate && cellDate.getTime() === selectedDate.getTime();
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

            let classes = "w-8 h-8 flex items-center justify-center rounded-md text-sm cursor-pointer transition-colors ";

            if (isSelected) {
               classes += "bg-primary text-white font-bold shadow-sm";
            } else if (isToday) {
               classes += "bg-white/5 font-semibold text-white hover:bg-white/10 border border-white/10";
            } else {
               classes += "text-muted hover:bg-white/10 hover:text-white";
            }

            // Inject the popoverId and gridId so selection knows where it came from
            html += `<button type="button" onclick="window.selectDate('${dateStr}', '${popoverId}')" class="${classes}">${i}</button>`;
         }

         gridEl.innerHTML = html;
      };

      window.changeMonth = (buttonEl, dir) => {
         const header = buttonEl.closest('.custom-date-popover').querySelector('.month-year-header');
         const grid = buttonEl.closest('.custom-date-popover').querySelector('.calendar-grid');
         const popoverId = buttonEl.closest('.custom-date-popover').id;
         const myId = header.id;
         const gridId = grid.id;

         const targetDateStr = dir < 0 ? header.dataset.prev : header.dataset.next;

         // find the input for currentVal
         const inputId = popoverId.replace('-popover', '');
         const currentVal = document.getElementById(inputId)?.value;

         window.renderCalendar(currentVal, gridId, myId, popoverId, targetDateStr);
      };

      window.selectDate = (dateStr, popoverId) => {
         const inputId = popoverId.replace('-popover', '');
         const displayId = popoverId.replace('-popover', '-display');
         const inputEl = document.getElementById(inputId);
         const displayEl = document.getElementById(displayId);

         if (inputEl) {
            inputEl.value = dateStr;
            // Dispatch native change event
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            if (inputEl.onchange) {
               inputEl.onchange({ target: inputEl });
            }
         }
         if (displayEl) {
            const d = new Date(dateStr);
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            displayEl.textContent = `${monthNames[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
            displayEl.classList.remove('text-muted');
            displayEl.classList.add('text-text');
         }

         window.closeAllDatePopovers();
      };
   }

   const inputOnChange = onChangeAttr ? `onchange="${onChangeAttr}"` : '';

   let displayStr = "Select a date";
   let textClass = "text-muted";
   if (value && !isNaN(new Date(value).getTime())) {
      const d = new Date(value);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      displayStr = `${monthNames[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${d.getFullYear()}`;
      textClass = "text-text";
   }

   return `
      <div class="relative flex items-center w-full date-input-container">
         <input 
            type="hidden" 
            id="${inputId}"
            ${name ? `name="${name}"` : ''}
            ${value ? `value="${value}"` : ''} 
            ${inputOnChange}
         >
         
         <div 
            onclick="window.toggleDatePopover('${popoverId}', event, '${value}', '${gridId}', '${monthYearId}')"
            class="peer w-full bg-transparent flex items-center justify-between cursor-pointer transition-all duration-200 ${className}"
            tabindex="0"
         >
            <span id="${displayId}" class="${textClass}">${displayStr}</span>
             <svg class="w-5 h-5 opacity-70 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
            </svg>
         </div>

         <!-- Custom Popover Menu -->
         <div id="${popoverId}" class="custom-date-popover hidden absolute top-[calc(100%+8px)] ltr:left-0 rtl:right-0 z-50 w-[280px] bg-slate-900 border border-white/10 rounded-2xl shadow-xl p-3 transition-all duration-200 animate-in fade-in slide-in-from-top-2">
            
            <div class="flex items-center justify-between mb-4">
                <button type="button" onclick="window.changeMonth(this, -1); event.stopPropagation();" class="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-muted hover:text-white">
                    <svg class="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                </button>
                <div id="${monthYearId}" class="month-year-header text-sm font-bold text-white"></div>
                <button type="button" onclick="window.changeMonth(this, 1); event.stopPropagation();" class="w-8 h-8 flex items-center justify-center rounded-md hover:bg-white/10 transition-colors text-muted hover:text-white">
                    <svg class="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                </button>
            </div>

            <div id="${gridId}" class="calendar-grid grid grid-cols-7 gap-y-1 gap-x-1 justify-items-center">
            </div>
            
         </div>
      </div>
    `;
}
