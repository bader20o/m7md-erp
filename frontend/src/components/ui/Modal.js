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
    backdrop.className = 'fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300 opacity-0';

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

/**
 * Reusable Alert Modal
 * @param {Object} options 
 * @param {string} options.title 
 * @param {string} options.message 
 * @param {string} options.confirmText 
 * @param {'danger'|'primary'|'success'} options.intent
 * @returns {Promise<void>}
 */
export function AlertModal({ title, message, confirmText, intent = 'primary' }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300 opacity-0';

    const intentColors = {
      primary: 'bg-primary hover:bg-primary-hover text-white',
      danger: 'bg-danger hover:bg-red-600 text-white',
      success: 'bg-success hover:bg-[#15803d] text-white'
    };

    const confirmBtnClass = intentColors[intent] || intentColors.primary;

    backdrop.innerHTML = `
      <div class="bg-surface rounded-xl shadow-2xl max-w-sm w-full p-6 transform scale-95 transition-transform duration-300">
        <h3 class="font-heading font-semibold text-xl text-text mb-2">${title}</h3>
        <p class="text-muted text-sm mb-6 select-all whitespace-pre-wrap">${message}</p>
        <div class="flex justify-end gap-3">
          <button id="alert-confirm" class="px-4 py-2 text-sm font-medium rounded-lg transition-colors ${confirmBtnClass}">
            ${confirmText || t('common.ok') || 'OK'}
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

    const close = () => {
      // Animate out
      backdrop.classList.add('opacity-0');
      backdrop.querySelector('.bg-surface').classList.remove('scale-100');
      backdrop.querySelector('.bg-surface').classList.add('scale-95');

      setTimeout(() => {
        backdrop.remove();
        resolve();
      }, 300);
    };

    backdrop.querySelector('#alert-confirm').addEventListener('click', close);
  });
}

/**
 * Confirmation modal that collects an optional note before confirming.
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} options.notePlaceholder
 * @param {string} options.confirmText
 * @param {string} options.cancelText
 * @param {'danger'|'primary'} options.intent
 * @returns {Promise<{ confirmed: boolean; note: string }>}
 */
export function ConfirmActionModal({
  title,
  message,
  notePlaceholder = 'Optional note',
  confirmText,
  cancelText,
  intent = 'primary'
}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300 opacity-0';

    const intentColors = {
      primary: 'bg-primary hover:bg-primary-hover text-white',
      danger: 'bg-danger hover:bg-red-600 text-white'
    };

    backdrop.innerHTML = `
      <div class="bg-surface rounded-xl shadow-2xl max-w-md w-full p-6 transform scale-95 transition-transform duration-300 border border-border">
        <h3 class="font-heading font-semibold text-xl text-text mb-2">${title}</h3>
        <p class="text-muted text-sm mb-4">${message}</p>
        <textarea id="action-note-input" rows="3" placeholder="${notePlaceholder}" class="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text resize-none mb-5"></textarea>
        <div class="flex justify-end gap-3">
          <button id="action-modal-cancel" class="px-4 py-2 text-sm font-medium text-text bg-border hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors">
            ${cancelText || t('common.cancel')}
          </button>
          <button id="action-modal-confirm" class="px-4 py-2 text-sm font-medium rounded-lg transition-colors ${intentColors[intent] || intentColors.primary}">
            ${confirmText || t('common.confirm')}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    requestAnimationFrame(() => {
      backdrop.classList.remove('opacity-0');
      backdrop.querySelector('.bg-surface').classList.remove('scale-95');
      backdrop.querySelector('.bg-surface').classList.add('scale-100');
    });

    const close = (confirmed) => {
      const note = (backdrop.querySelector('#action-note-input')?.value || '').trim();
      backdrop.classList.add('opacity-0');
      backdrop.querySelector('.bg-surface').classList.remove('scale-100');
      backdrop.querySelector('.bg-surface').classList.add('scale-95');

      setTimeout(() => {
        backdrop.remove();
        resolve({ confirmed, note });
      }, 300);
    };

    backdrop.querySelector('#action-modal-cancel').addEventListener('click', () => close(false));
    backdrop.querySelector('#action-modal-confirm').addEventListener('click', () => close(true));
  });
}

/**
 * Confirmation modal that requires a specific keyword before enabling confirm.
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} options.warning
 * @param {string} options.keyword
 * @param {string} options.inputLabel
 * @param {string} options.confirmText
 * @param {string} options.cancelText
 * @param {'danger'|'primary'} options.intent
 * @returns {Promise<{ confirmed: boolean; value: string }>}
 */
export function ConfirmKeywordModal({
  title,
  message,
  warning = '',
  keyword = 'CONFIRM',
  inputLabel = 'Type to confirm',
  confirmText,
  cancelText,
  intent = 'danger'
}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300 opacity-0';

    const intentColors = {
      primary: 'bg-primary hover:bg-primary-hover text-white disabled:cursor-not-allowed disabled:opacity-50',
      danger: 'bg-danger hover:bg-red-600 text-white disabled:cursor-not-allowed disabled:opacity-50'
    };

    backdrop.innerHTML = `
      <div class="bg-surface rounded-xl shadow-2xl max-w-md w-full p-6 transform scale-95 transition-transform duration-300 border border-border">
        <h3 class="font-heading font-semibold text-xl text-text mb-2">${title}</h3>
        <p class="text-muted text-sm mb-3">${message}</p>
        ${warning ? `<div class="mb-4 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">${warning}</div>` : ''}
        <label class="mb-5 block text-sm text-text">
          <span class="mb-2 block">${inputLabel} <span class="font-semibold">${keyword}</span></span>
          <input id="keyword-confirm-input" class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text" autocomplete="off">
        </label>
        <div class="flex justify-end gap-3">
          <button id="keyword-modal-cancel" class="px-4 py-2 text-sm font-medium text-text bg-border hover:bg-gray-300 dark:hover:bg-gray-700 rounded-lg transition-colors">
            ${cancelText || t('common.cancel')}
          </button>
          <button id="keyword-modal-confirm" disabled class="px-4 py-2 text-sm font-medium rounded-lg transition-colors ${intentColors[intent] || intentColors.primary}">
            ${confirmText || t('common.confirm')}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    requestAnimationFrame(() => {
      backdrop.classList.remove('opacity-0');
      backdrop.querySelector('.bg-surface').classList.remove('scale-95');
      backdrop.querySelector('.bg-surface').classList.add('scale-100');
    });

    const input = backdrop.querySelector('#keyword-confirm-input');
    const confirmButton = backdrop.querySelector('#keyword-modal-confirm');
    const syncState = () => {
      confirmButton.disabled = input.value.trim().toUpperCase() !== keyword.toUpperCase();
    };

    const close = (confirmed) => {
      const value = input.value.trim();
      backdrop.classList.add('opacity-0');
      backdrop.querySelector('.bg-surface').classList.remove('scale-100');
      backdrop.querySelector('.bg-surface').classList.add('scale-95');

      setTimeout(() => {
        backdrop.remove();
        resolve({ confirmed, value });
      }, 300);
    };

    input.addEventListener('input', syncState);
    backdrop.querySelector('#keyword-modal-cancel').addEventListener('click', () => close(false));
    backdrop.querySelector('#keyword-modal-confirm').addEventListener('click', () => close(true));
  });
}

/**
 * Generic Modal with custom content
 * @param {Object} options
 * @param {string} options.title
 * @param {string} options.content HTML string
 * @param {string} [options.size='max-w-md'] Tailwind max-w-* class
 * @param {Function} [options.onRender] Callback after element is added to DOM
 * @returns {{ close: Function }} 
 */
export function Modal({ title, content, size = 'max-w-md', onRender }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300 opacity-0';

  backdrop.innerHTML = `
    <div class="bg-surface rounded-xl shadow-2xl ${size} max-h-[90vh] overflow-y-auto w-full p-6 transform scale-95 transition-transform duration-300 border border-border">
      <div class="flex justify-between items-center mb-4 sticky top-0 bg-surface z-10 pb-2">
        <h3 class="font-heading font-semibold text-xl text-text">${title}</h3>
        <button type="button" class="modal-close text-muted hover:text-text transition-colors">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      <div class="modal-content">${content}</div>
    </div>
  `;

  document.body.appendChild(backdrop);

  requestAnimationFrame(() => {
    backdrop.classList.remove('opacity-0');
    backdrop.querySelector('.bg-surface').classList.remove('scale-95');
    backdrop.querySelector('.bg-surface').classList.add('scale-100');
  });

  const close = () => {
    backdrop.classList.add('opacity-0');
    backdrop.querySelector('.bg-surface').classList.remove('scale-100');
    backdrop.querySelector('.bg-surface').classList.add('scale-95');

    setTimeout(() => {
      backdrop.remove();
    }, 300);
  };

  backdrop.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', close));

  if (onRender) {
    onRender(backdrop);
  }

  return { close };
}
