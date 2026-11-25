import { initFruity, showFruityToast } from '../../src/styles/fruity/v1.1/components';
import { FRUITY_UI_LABEL } from '../../src/styles/fruity/v1.1/version';
document.querySelectorAll('[data-fruity-ui-version]').forEach(node => { node.textContent = FRUITY_UI_LABEL; });
const dispose = initFruity();
const controller = new AbortController();
const region = document.querySelector<HTMLElement>('#preview-toasts')!;
document.querySelectorAll<HTMLButtonElement>('[data-preview-toast]').forEach(button => {
  button.addEventListener('click', () => {
    showFruityToast(region, button.dataset.previewToast!);
  }, { signal: controller.signal });
});
if (import.meta.hot) import.meta.hot.dispose(() => { dispose(); controller.abort(); });

