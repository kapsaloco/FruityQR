import { initFruity as initFoundation } from '../components';

export { bindFruityCopy, showFruityToast } from '../components';

/** Initialize the foundation interactions and the 1.1.1 tab highlight. */
export function initFruity(root: Document | HTMLElement = document): () => void {
  const disposeFoundation = initFoundation(root);
  if (typeof ResizeObserver === 'undefined') return disposeFoundation;

  const lists = root.querySelectorAll<HTMLElement>('[data-fr-tabs] .fr-tabs__list[role="tablist"]');
  const disposers = Array.from(lists, list => {
    const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .filter(tab => tab.closest('[role="tablist"]') === list);

    function positionHighlight() {
      const selected = tabs.find(tab => !tab.disabled && tab.getAttribute('aria-selected') === 'true');
      // Wrapped tabs retain their individual selected style.
      if (!selected?.offsetWidth || tabs.some(tab => tab.offsetWidth && tab.offsetTop !== selected.offsetTop)) {
        delete list.dataset.frTabHighlight;
        return;
      }

      list.style.setProperty('--fr-tab-highlight-left', selected.offsetLeft + 'px');
      list.style.setProperty('--fr-tab-highlight-top', selected.offsetTop + 'px');
      list.style.setProperty('--fr-tab-highlight-width', selected.offsetWidth + 'px');
      list.style.setProperty('--fr-tab-highlight-height', selected.offsetHeight + 'px');
      list.dataset.frTabHighlight = '';
    }

    const selection = new MutationObserver(positionHighlight);
    selection.observe(list, { subtree: true, attributeFilter: ['aria-selected', 'disabled'] });
    const layout = new ResizeObserver(positionHighlight);
    layout.observe(list);
    tabs.forEach(tab => layout.observe(tab));
    positionHighlight();

    return () => {
      selection.disconnect();
      layout.disconnect();
      delete list.dataset.frTabHighlight;
      for (const dimension of ['left', 'top', 'width', 'height']) {
        list.style.removeProperty('--fr-tab-highlight-' + dimension);
      }
    };
  });

  return () => {
    disposers.forEach(dispose => dispose());
    disposeFoundation();
  };
}
