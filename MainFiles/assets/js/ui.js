window.LaunchFlow = window.LaunchFlow || {};
window.LaunchFlow.UI = (() => {
  const modalRoot = () => document.getElementById('modal-root');
  const toastRoot = () => document.getElementById('toast-root');
  const escapeHtml = (value) => `${value || ''}`.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const modalState = {
    activeId: null,
    options: {},
    lastFocused: null,
    cleanup: null,
    listenersBound: false,
    sequence: 0
  };

  function activeModalCard() {
    return modalRoot()?.querySelector('.modal-card');
  }

  function removeOrphanedOverlays() {
    document.querySelectorAll('.modal-backdrop').forEach((node) => {
      if (!modalRoot()?.contains(node)) node.remove();
    });
  }

  function syncModalRoot(open) {
    const root = modalRoot();
    if (!root) return;
    root.classList.toggle('is-open', open);
    root.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.classList.toggle('modal-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    if (!open) {
      document.body.style.removeProperty('overflow');
    }
  }

  function focusModal() {
    const modal = activeModalCard();
    if (!modal) return;
    const target = modal.querySelector('[autofocus], button, input, select, textarea, [tabindex]:not([tabindex="-1"])') || modal;
    window.requestAnimationFrame(() => target.focus({ preventScroll: true }));
  }

  function renderModalMarkup(title, body, actions = '', options = {}) {
    const modalClass = options.modalClass ? ` ${escapeHtml(options.modalClass)}` : '';
    const backdropClass = options.backdropClass ? ` ${escapeHtml(options.backdropClass)}` : '';
    const modalId = escapeHtml(options.modalId || modalState.activeId || '');
    const closeOnOverlay = options.closeOnOverlay === false ? 'false' : 'true';
    return `
      <div class="modal-backdrop${backdropClass}" data-modal-id="${modalId}" data-close-on-overlay="${closeOnOverlay}">
        <div class="modal-card${modalClass}" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}" tabindex="-1">
          <div class="surface-header">
            <div>
              <p class="eyebrow">${escapeHtml(options.eyebrow || 'Workspace Action')}</p>
              <h3>${escapeHtml(title)}</h3>
            </div>
            <button class="ghost-btn" type="button" data-action="close-modal">Close</button>
          </div>
          <div class="stack">${body}</div>
          <div class="row-between">${actions}</div>
        </div>
      </div>`;
  }

  function toast(message, tone = 'info') {
    const node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = `<strong>${tone.toUpperCase()}</strong><div>${escapeHtml(message)}</div>`;
    toastRoot().appendChild(node);
    setTimeout(() => node.remove(), 3400);
  }

  function openModal(title, body, actions = '', options = {}) {
    closeModal();
    removeOrphanedOverlays();
    modalState.sequence += 1;
    modalState.activeId = `modal-${modalState.sequence}`;
    modalState.options = {
      closeOnEscape: options.closeOnEscape !== false,
      closeOnOverlay: options.closeOnOverlay !== false
    };
    modalState.lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalRoot().innerHTML = renderModalMarkup(title, body, actions, { ...options, modalId: modalState.activeId });
    syncModalRoot(true);
    focusModal();
    return modalState.activeId;
  }

  function setModalContent(title, body, actions = '', options = {}) {
    if (!modalState.activeId || !modalRoot().innerHTML) return null;
    if (options.modalId && options.modalId !== modalState.activeId) return null;
    modalRoot().innerHTML = renderModalMarkup(title, body, actions, { ...options, modalId: modalState.activeId });
    syncModalRoot(true);
    focusModal();
    return modalState.activeId;
  }

  function closeModal(modalId = '') {
    if (modalId && modalState.activeId && modalId !== modalState.activeId) return false;
    if (typeof modalState.cleanup === 'function') {
      try {
        modalState.cleanup();
      } catch (error) {
        console.error(error);
      }
    }
    modalState.cleanup = null;
    modalRoot().innerHTML = '';
    syncModalRoot(false);
    removeOrphanedOverlays();
    const restoreTarget = modalState.lastFocused;
    modalState.activeId = null;
    modalState.options = {};
    modalState.lastFocused = null;
    if (restoreTarget && restoreTarget.isConnected) {
      window.requestAnimationFrame(() => restoreTarget.focus({ preventScroll: true }));
    }
    return true;
  }

  function handleGlobalClick(event) {
    if (!modalState.activeId) return;
    const backdrop = event.target.closest('.modal-backdrop');
    if (!backdrop || !modalRoot().contains(backdrop)) return;
    const clickedBackdrop = event.target === backdrop;
    if (clickedBackdrop && backdrop.dataset.closeOnOverlay !== 'false') {
      closeModal(modalState.activeId);
    }
  }

  function handleGlobalKeydown(event) {
    if (event.key !== 'Escape' || !modalState.activeId || modalState.options.closeOnEscape === false) return;
    closeModal(modalState.activeId);
  }

  function initModalSystem() {
    if (modalState.listenersBound) return;
    modalState.listenersBound = true;
    syncModalRoot(false);
    removeOrphanedOverlays();
    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('keydown', handleGlobalKeydown);
  }

  function registerModalCleanup(fn) {
    modalState.cleanup = typeof fn === 'function' ? fn : null;
  }

  function isModalActive(modalId) {
    return !!modalState.activeId && modalState.activeId === modalId;
  }

  function getActiveModalId() {
    return modalState.activeId;
  }

  function formatDate(date) {
    if (!date) return 'Not set';
    const parsed = new Date(date);
    return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateTime(date) {
    if (!date) return 'Not set';
    return new Date(date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function daysUntil(date) {
    if (!date) return null;
    const ms = new Date(date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
    return Math.round(ms / 86400000);
  }

  function badge(text, className = '') {
    return `<span class="badge ${className}">${escapeHtml(text)}</span>`;
  }

  function severityBadge(level) {
    return `<span class="severity severity-${level}">${escapeHtml(level)}</span>`;
  }

  function emptyState(title, text, actionLabel, action) {
    return `<div class="empty-state"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p>${actionLabel ? `<button class="primary-btn" data-action="${action}">${escapeHtml(actionLabel)}</button>` : ''}</div>`;
  }

  return {
    toast,
    openModal,
    setModalContent,
    closeModal,
    initModalSystem,
    registerModalCleanup,
    isModalActive,
    getActiveModalId,
    formatDate,
    formatDateTime,
    daysUntil,
    badge,
    severityBadge,
    emptyState,
    escapeHtml
  };
})();
