import { t } from '../../lib/i18n.js';

/**
 * Reusable Confirmation Modal
 * @param {Object} options 
 * @param {string} options.title 
 * @param {string} options.message 
 * @param {string} options.confirmText 
 * @param {string} options.cancelText 
 * @param {'danger'|'primary'} options.intent
 * @returns {Promise<boolean>}
 */
export function ConfirmModal({ title, message, confirmText, cancelText, intent = 'primary' }) {
    return new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.className = 'fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300 opacity-0';

        const intentColors = {
            primary: 'bg-primary hover:bg-primary-hover text-white',
            danger: 'bg-danger hover:bg-red-600 text-white'
        };

        const confirmBtnClass = intentColors[intent] || intentColors.primary;

        backdrop.innerHTML = `
      <div class="bg-surface rounded-xl shadow-2xl max-w-sm w-full p-6 transform scale-95 transition-transform duration-300">
        <h3 class="font-heading font-semibold text-xl text-text mb-2">${title}</h3>
        <p class="text-muted text-sm mb-6">${message}</p>
        <div class="flex justify-end gap-3">
          <button id="modal-cancel" class="px-4 py-2 text-sm font-medium text-text bg-border hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors">
            ${cancelText || t('common.cancel')}
          </button>
          <button id="modal-confirm" class="px-4 py-2 text-sm font-medium rounded-lg transition-colors ${confirmBtnClass}">
            ${confirmText || t('common.confirm')}
          </button>
        </div>
      </div>
    `;

        document.body.appendChild(backdrop);

        // Animate in
        requestAnimationFrame(() => {
            backdrop.classList.remove('opacity-0');
            backdrop.querySelector('.bg-surface').classList.remove('scale-95');
            backdrop.querySelector('.bg-surface').classList.add('scale-100');
        });

        const close = (result) => {
            // Animate out
            backdrop.classList.add('opacity-0');
            backdrop.querySelector('.bg-surface').classList.remove('scale-100');
            backdrop.querySelector('.bg-surface').classList.add('scale-95');

            setTimeout(() => {
                backdrop.remove();
                resolve(result);
            }, 300);
        };

        backdrop.querySelector('#modal-cancel').addEventListener('click', () => close(false));
        backdrop.querySelector('#modal-confirm').addEventListener('click', () => close(true));
    });
}
