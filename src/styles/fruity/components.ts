/** Optional, dependency-free interactions. CSS and native controls work separately. */
export function initFruity(root: Document | HTMLElement = document): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const cleanups: (() => void)[] = [];
  root.querySelectorAll<HTMLElement>('[data-fr-tabs]').forEach(group => {
    const tabs = Array.from(group.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .filter(tab => tab.closest('[data-fr-tabs]') === group);
    const select = (selected: HTMLButtonElement) => {
      tabs.forEach(tab => {
        const active = tab === selected;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        const panel = document.getElementById(tab.getAttribute('aria-controls') ?? '');
        if (panel && group.contains(panel)) panel.hidden = !active;
      });
    };
    const initial = tabs.find(tab => !tab.disabled && tab.getAttribute('aria-selected') === 'true')
      ?? tabs.find(tab => !tab.disabled);
    if (initial) select(initial);
    tabs.forEach(tab => {
      tab.addEventListener('click', () => select(tab), { signal });
      tab.addEventListener('keydown', event => {
        const available = tabs.filter(item => !item.disabled);
        const index = available.indexOf(tab);
        let next: HTMLButtonElement | undefined;
        if (event.key === 'ArrowRight') next = available[(index + 1) % available.length];
        if (event.key === 'ArrowLeft') next = available[(index - 1 + available.length) % available.length];
        if (event.key === 'Home') next = available[0];
        if (event.key === 'End') next = available[available.length - 1];
        if (next) { event.preventDefault(); select(next); next.focus(); }
      }, { signal });
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-fr-open-dialog]').forEach(button => {
    const dialog = document.getElementById(button.dataset.frOpenDialog ?? '');
    if (!(dialog instanceof HTMLDialogElement)) return;
    button.addEventListener('click', () => {
      if (dialog.open) return;
      dialog.addEventListener('close', () => button.focus(), { once: true, signal });
      dialog.showModal();
    }, { signal });
  });
  root.querySelectorAll<HTMLElement>('[data-fr-tooltip]').forEach(trigger => {
    const tip = document.getElementById(trigger.dataset.frTooltip ?? '');
    if (!tip) return;
    let hovered = false, focused = false, overTip = false, dismissed = false;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    const position = () => {
      const rect = trigger.getBoundingClientRect();
      const box = tip.getBoundingClientRect();
      tip.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - box.width - 12))}px`;
      tip.style.top = `${Math.max(12, rect.bottom + box.height + 20 < innerHeight ? rect.bottom + 8 : rect.top - box.height - 8)}px`;
    };
    const update = () => {
      clearTimeout(hideTimer);
      if ((hovered || focused || overTip) && !dismissed) { tip.hidden = false; position(); }
      else { hideTimer = setTimeout(() => { tip.hidden = true; }, 100); }
    };
    trigger.addEventListener('pointerenter', () => { hovered = true; dismissed = false; update(); }, { signal });
    trigger.addEventListener('pointerleave', () => { hovered = false; update(); }, { signal });
    trigger.addEventListener('focus', () => { focused = true; dismissed = false; update(); }, { signal });
    trigger.addEventListener('blur', () => { focused = false; update(); }, { signal });
    tip.addEventListener('pointerenter', () => { overTip = true; update(); }, { signal });
    tip.addEventListener('pointerleave', () => { overTip = false; update(); }, { signal });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') { dismissed = true; tip.hidden = true; clearTimeout(hideTimer); }
    }, { signal });
    window.addEventListener('resize', () => { if (!tip.hidden) position(); }, { signal });
    window.addEventListener('scroll', () => { if (!tip.hidden) position(); }, { capture: true, signal });
    cleanups.push(() => { clearTimeout(hideTimer); tip.hidden = true; });
  });
  return () => { controller.abort(); cleanups.forEach(cleanup => cleanup()); };
}

/** Persistent until dismissed: no short timer to race against reading. */
export function showFruityToast(region: HTMLElement, message: string): void {
  const toast = document.createElement('div');
  toast.className = 'fr-toast';
  const text = document.createElement('p');
  text.className = 'fr-toast__message';
  text.setAttribute('role', 'status');
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'fr-button fr-button--compact';
  dismiss.textContent = 'Dismiss';
  dismiss.addEventListener('click', () => {
    const next = toast.nextElementSibling?.querySelector<HTMLButtonElement>('button')
      ?? toast.previousElementSibling?.querySelector<HTMLButtonElement>('button');
    toast.remove();
    if (next) next.focus();
    else region.focus();
  });
  toast.append(text, dismiss);
  region.append(toast);
  // Populate after insertion so assistive technology can observe the live update.
  requestAnimationFrame(() => { if (toast.isConnected) text.textContent = message; });
}

/** Clipboard transport is injected so this helper works with native adapters too. */
export function bindFruityCopy(
  button: HTMLButtonElement,
  getValue: () => string,
  writeText: (value: string) => Promise<void>,
  announce: (message: string) => void,
): () => void {
  const original = button.textContent ?? 'Copy';
  const originalDisabled = button.disabled;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  let copying = false;
  const copy = async () => {
    if (copying || disposed) return;
    copying = true;
    clearTimeout(timer);
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      await writeText(getValue());
      if (!disposed) { button.textContent = 'Copied'; announce('Copied to clipboard.'); }
    } catch {
      if (!disposed) { button.textContent = original; announce('Could not copy. Select the value and copy it manually.'); }
    } finally {
      copying = false;
      if (!disposed) {
        button.disabled = originalDisabled;
        button.removeAttribute('aria-busy');
        timer = setTimeout(() => { button.textContent = original; }, 1500);
      }
    }
  };
  button.addEventListener('click', copy);
  return () => {
    disposed = true;
    clearTimeout(timer);
    button.removeEventListener('click', copy);
    button.textContent = original;
    button.disabled = originalDisabled;
    button.removeAttribute('aria-busy');
  };
}
