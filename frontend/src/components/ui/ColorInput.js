export function ColorInput({ id = '', name = '', value = '#3B82F6', className = '', onChangeAttr = '' } = {}) {
    const uniqueId = id || `color-${Math.random().toString(36).substr(2, 9)}`;
    const textId = `${uniqueId}-text`;
    const popoverId = `${uniqueId}-popover`;
    const swatchId = `${uniqueId}-swatch`;
    const errorId = `${uniqueId}-error`;

    const PRESET_COLORS = [
        "#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6",
        "#2563eb", "#1d4ed8", "#1e40af", "#0ea5e9", "#0284c7",
        "#0369a1", "#7dd3fc", "#38bdf8", "#22d3ee", "#818cf8",
        "#a5b4fc", "#94a3b8", "#64748b", "#334155", "#0f172a"
    ];

    if (typeof window !== 'undefined' && !window._colorInputV2Initialized) {
        window._colorInputV2Initialized = true;

        window.toggleColorPopover = (popoverId, event) => {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }
            const el = document.getElementById(popoverId);
            if (el) {
                const isHidden = el.classList.contains('hidden');
                document.querySelectorAll('.custom-color-popover').forEach(p => p.classList.add('hidden'));

                if (isHidden) {
                    el.classList.remove('hidden');
                }
            }
        };

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.color-input-container')) {
                document.querySelectorAll('.custom-color-popover').forEach(p => p.classList.add('hidden'));
            }
        });

        window.handleColorChangeCore = (val, textId, swatchId, errorId, userOnChange) => {
            const isValid = /^#([0-9A-F]{3}){1,2}$/i.test(val);
            const errorEl = document.getElementById(errorId);
            const swatchEl = document.getElementById(swatchId);
            const textEl = document.getElementById(textId);

            if (textEl && textEl.value !== val) {
                textEl.value = val;
            }

            if (isValid) {
                if (errorEl) errorEl.classList.add('hidden');
                if (textEl) textEl.classList.remove('border-danger', 'text-danger');
                if (swatchEl) {
                    swatchEl.style.backgroundColor = val;
                    // update the inner popover preview as well
                    const popPreview = document.getElementById(swatchId + '-preview');
                    if (popPreview) popPreview.style.backgroundColor = val;
                    const popInput = document.getElementById(textId + '-pop');
                    if (popInput && popInput.value !== val) popInput.value = val;
                }

                if (userOnChange && textEl) {
                    // Create a simulated event object if the string expects `event` or `this`
                    const func = new Function('event', userOnChange).bind(textEl);
                    func({ target: textEl });
                }
            } else {
                if (val !== '') {
                    if (errorEl) errorEl.classList.remove('hidden');
                    if (textEl) textEl.classList.add('border-danger', 'text-danger');
                } else {
                    if (errorEl) errorEl.classList.add('hidden');
                    if (textEl) textEl.classList.remove('border-danger', 'text-danger');
                }
                if (swatchEl) swatchEl.style.backgroundColor = 'transparent';
            }
        };

        window.handleColorTextChange = (inputEl, swatchId, errorId, userOnChange) => {
            let val = inputEl.value.trim();
            if (val.length > 0 && !val.startsWith('#')) {
                val = '#' + val;
                inputEl.value = val;
            }
            window.handleColorChangeCore(val, inputEl.id, swatchId, errorId, userOnChange);
        };

        window.handlePresetClick = (val, textId, swatchId, errorId, popoverId, userOnChange) => {
            window.handleColorChangeCore(val, textId, swatchId, errorId, userOnChange);
            document.getElementById(popoverId)?.classList.add('hidden');
        };
    }

    const textOnChange = `window.handleColorTextChange(this, '${swatchId}', '${errorId}', \`${onChangeAttr}\`)`;
    const popInputOnChange = `window.handleColorTextChange(this, '${swatchId}', '${errorId}', \`${onChangeAttr}\`)`;

    const presetsHtml = PRESET_COLORS.map(c =>
        `<button type="button" onclick="window.handlePresetClick('${c}', '${textId}', '${swatchId}', '${errorId}', '${popoverId}', \`${onChangeAttr}\`)" class="w-8 h-8 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary hover:scale-110 hover:shadow-md transition-all duration-200" style="background-color: ${c}"></button>`
    ).join('');

    return `
      <div class="relative flex flex-col w-full color-input-container">
         <div class="flex items-center w-full bg-bg border border-border rounded-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all duration-200 shadow-sm hover:shadow ${className}">
            
            <input 
                type="text" 
                id="${textId}"
                ${name ? `name="${name}"` : ''}
                value="${value}" 
                placeholder="#RRGGBB"
                oninput="${textOnChange}"
                class="flex-1 bg-transparent px-4 py-3 text-text placeholder-muted focus:outline-none uppercase"
            >
            
            <button 
                type="button"
                onclick="window.toggleColorPopover('${popoverId}', event)"
                class="relative flex items-center justify-center p-3 ltr:border-l rtl:border-r border-border hover:bg-primary/10 transition-colors rounded-e-xl cursor-pointer"
            >
                <div 
                    id="${swatchId}"
                    class="w-6 h-6 rounded-md shadow-sm border border-border overflow-hidden flex-shrink-0 pointer-events-none"
                    style="background-color: ${value};"
                ></div>
            </button>
         </div>

         <!-- Custom Popover Menu -->
         <div id="${popoverId}" class="custom-color-popover hidden absolute top-[calc(100%+8px)] ltr:right-0 rtl:left-0 z-50 w-64 bg-surface border border-primary/20 rounded-xl shadow-xl p-4 animate-in fade-in slide-in-from-top-2">
            <div class="mb-3">
                <label class="text-xs font-semibold text-muted mb-2 block">Preset Colors</label>
                <div class="grid grid-cols-5 gap-2">
                    ${presetsHtml}
                </div>
            </div>
            <div class="border-t border-border pt-3">
                <label class="text-xs font-semibold text-muted mb-2 block">Custom Hex</label>
                <div class="flex items-center gap-2">
                   <div 
                      id="${swatchId}-preview"
                      class="w-8 h-8 rounded-md shadow-inner border border-border flex-shrink-0"
                      style="background-color: ${value};"
                   ></div>
                   <input
                    type="text"
                    id="${textId}-pop"
                    value="${value}"
                    oninput="${popInputOnChange}"
                    class="flex-1 bg-bg border border-border rounded-md px-3 py-1.5 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                  >
                </div>
            </div>
         </div>

         <span id="${errorId}" class="hidden text-[10px] text-danger mt-1 ltr:ml-1 rtl:mr-1 absolute -bottom-5">Invalid hex color</span>
      </div>
    `;
}
