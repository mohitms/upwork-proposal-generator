export async function createProposalModal({ onRetry, onCopy, onClose }) {
  const html = await fetch(chrome.runtime.getURL('popup.html')).then((r) => r.text());
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();

  const overlay = document.createElement('div');
  overlay.id = 'upg-modal-overlay';
  overlay.appendChild(tpl.content.cloneNode(true));

  const get = (sel) => overlay.querySelector(sel);
  const states = {
    loading: get('[data-state="loading"]'),
    error: get('[data-state="error"]'),
    result: get('[data-state="result"]')
  };

  const errorText = get('[data-role="error-text"]');
  const proposalText = get('[data-role="proposal"]');
  const copyStatus = get('[data-role="copy-status"]');

  const showState = (targetState) => {
    Object.entries(states).forEach(([name, node]) => {
      if (!node) return;
      node.hidden = name !== targetState;
    });
  };

  const setLoading = () => {
    showState('loading');
    copyStatus.hidden = true;
  };

  const setError = (message) => {
    errorText.textContent = message || 'Unable to generate proposal right now. Please try again.';
    showState('error');
  };

  const setResult = (proposal) => {
    proposalText.value = proposal || '';
    showState('result');
  };

  const handleClose = () => {
    overlay.remove();
    onClose?.();
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      handleClose();
    }
  });

  overlay.querySelectorAll('[data-action="close"]').forEach((btn) => {
    btn.addEventListener('click', handleClose);
  });

  get('[data-action="retry"]')?.addEventListener('click', () => onRetry?.());

  get('[data-action="copy"]')?.addEventListener('click', async () => {
    const text = proposalText.value || '';
    await onCopy?.(text);
    copyStatus.textContent = 'Copied!';
    copyStatus.hidden = false;
    setTimeout(() => {
      copyStatus.hidden = true;
    }, 1600);
  });

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  });

  return {
    element: overlay,
    setLoading,
    setError,
    setResult,
    focus() {
      get('[data-action="close"]')?.focus();
    }
  };
}
