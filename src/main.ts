import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { version } from '../package.json';
import appLicense from '../LICENSE?raw';
import { decimal, formatColor, fromRGB, parseHex, type Color } from './color';
import { copyQR, saveQR } from './export';
import { fitsRaster, generateQR, paintQR, scanColorWarnings, urlPayload, wifiPayload, type QR } from './qr';
import { initFruity } from './styles/fruity/v1.1/components';
import { bindHueKeyboard, bindSaturationValue, paintSaturationValue } from './styles/fruity/v1.1/color-controls';
import { enhanceSelect } from './styles/fruity/v1.1/select';
import { FRUITY_UI_LABEL, FRUITY_UI_VERSION } from './styles/fruity/v1.1/version';
import uiLicense from './styles/fruity/LICENSE?raw';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T;
const editor = el<HTMLFormElement>('editor');
const url = el<HTMLInputElement>('url');
const text = el<HTMLTextAreaElement>('text');
const ssid = el<HTMLInputElement>('ssid');
const password = el<HTMLInputElement>('password');
const security = el<HTMLSelectElement>('security');
const size = el<HTMLSelectElement>('size');
const margin = el<HTMLSelectElement>('margin');
const correction = el<HTMLSelectElement>('correction');
const hiddenNetwork = el<HTMLInputElement>('hidden-network');
const preview = el('preview');
const canvas = el<HTMLCanvasElement>('matrix');
const empty = el('empty-preview');
const previewHint = el('preview-hint');
const example = el<HTMLButtonElement>('try-example');
const copy = el<HTMLButtonElement>('copy');
const savePng = el<HTMLButtonElement>('save-png');
const saveSvg = el<HTMLButtonElement>('save-svg');
const status = el('status');
const warning = el('scan-warning');
const warningMessage = el('scan-warning-message');
const warningSwap = el<HTMLButtonElement>('warning-swap');
const warningReset = el<HTMLButtonElement>('warning-reset');

const defaults = { foreground: '#000000', background: '#FFFFFF' };
const colors = { ...defaults };
let current: QR | undefined;
let busy = false;
let generation: ReturnType<typeof setTimeout>;
let previous: { payload: string; correction: string; matrix: QR['matrix'] } | undefined;

function showMessage(region: HTMLElement, message: string) {
  region.hidden = !message;
  if (region.textContent !== message) region.textContent = message;
}

const selectSync = [security, size, margin, correction].map(select => {
  const id = select.id;
  // FruityUI 1.1 pairs the native select with these overlay elements.
  select.setAttribute('aria-labelledby', id + '-label');
  select.insertAdjacentHTML('afterend',
    '<div class="fr-glass-select" id="' + id + '-control" hidden>' +
    '<button class="fr-button fr-glass-select__trigger" id="' + id + '-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + id + '-menu" aria-labelledby="' + id + '-label ' + id + '-value">' +
    '<span id="' + id + '-value"></span><span aria-hidden="true">▾</span></button>' +
    '<div class="fr-glass-select__menu" id="' + id + '-menu" role="listbox" aria-labelledby="' + id + '-label" hidden></div></div>');
  return enhanceSelect(select);
});

const mode = () => editor.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')!.id;
const outputSize = () => Number(size.value);

function readPayload() {
  const urlError = el('url-error');
  showMessage(urlError, '');
  url.removeAttribute('aria-invalid');
  switch (mode()) {
    case 'url-tab':
      if (!url.value.trim()) return { hint: 'Enter a web address to get started.' };
      try {
        return { payload: urlPayload(url.value) };
      } catch {
        showMessage(urlError, 'Enter a valid web address such as example.com or https://example.com.');
        url.setAttribute('aria-invalid', 'true');
        return { hint: 'Enter a valid web address to preview your QR code.' };
      }
    case 'text-tab':
      return text.value.trim() ? { payload: text.value } : { hint: 'Enter text to preview your QR code.' };
    default:
      if (!ssid.value) return { hint: 'Enter a network name to get started.' };
      if (security.value !== 'nopass' && !password.value) {
        return { hint: 'Enter the network password to preview your QR code.' };
      }
      return { payload: wifiPayload(ssid.value, security.value, password.value, hiddenNetwork.checked) };
  }
}

function updateActions() {
  const rasterAvailable = current !== undefined && fitsRaster(current, outputSize());
  copy.disabled = savePng.disabled = busy || !rasterAvailable;
  saveSvg.disabled = busy || current === undefined;
  warningSwap.disabled = warningReset.disabled = busy || current === undefined;
}

function drawPreview() {
  if (!current) return;
  const logicalSize = Math.min(preview.clientWidth, preview.clientHeight);
  if (!logicalSize) return;
  const ratio = window.devicePixelRatio || 1;
  const pixels = Math.floor(logicalSize * ratio);
  const fits = fitsRaster(current, pixels);
  canvas.hidden = !fits;
  empty.hidden = fits;
  if (!fits) {
    previewHint.textContent = 'Enlarge the window to preview this QR code.';
    return;
  }
  canvas.style.width = canvas.style.height = (pixels / ratio) + 'px';
  paintQR(canvas, current, pixels);
}

function render() {
  clearTimeout(generation);
  preview.removeAttribute('aria-busy');
  const { payload, hint } = readPayload();
  example.hidden = mode() !== 'url-tab' || !!url.value.trim();
  current = undefined;
  let message = hint ?? '';
  if (payload !== undefined) {
    try {
      if (!previous || previous.payload !== payload || previous.correction !== correction.value) {
        previous = { payload, correction: correction.value, matrix: generateQR(payload, correction.value as 'L' | 'M' | 'Q' | 'H') };
      }
      current = { ...colors, margin: Number(margin.value), matrix: previous.matrix };
    } catch {
      previous = undefined;
      message = 'This content does not fit in a QR code. Shorten it or lower error correction.';
    }
  } else {
    previous = undefined;
  }

  if (current) {
    drawPreview();
  } else {
    canvas.hidden = true;
    empty.hidden = false;
    previewHint.textContent = message;
  }
  updateActions();

  const { inverted, lowContrast } = scanColorWarnings(colors);
  const warnings: string[] = [];
  warningSwap.hidden = !current || !inverted;
  warningReset.hidden = !current || !lowContrast;
  if (current && inverted) {
    warnings.push('The foreground is lighter than the background.');
  }
  if (current && lowContrast) {
    warnings.push('These colors may be too similar for scanners to read.');
  }
  if (current && !fitsRaster(current, outputSize())) {
    warnings.push('Choose a larger PNG size to fit the QR code and quiet zone.');
  }
  warning.hidden = warnings.length === 0;
  warningMessage.textContent = warnings.join(' ');
}

function scheduleRender() {
  current = undefined;
  preview.setAttribute('aria-busy', 'true');
  example.hidden = true;
  updateActions();
  showMessage(status, '');
  warning.hidden = true;
  clearTimeout(generation);
  generation = setTimeout(render, 120);
}

function refresh() {
  showMessage(status, '');
  render();
}

const dialog = el<HTMLDialogElement>('color-dialog');
const area = el('color-area');
const hue = el<HTMLInputElement>('color-hue');
const hex = el<HTMLInputElement>('color-hex');
const apply = el<HTMLButtonElement>('apply-color');
let colorSlot: keyof typeof colors = 'foreground';
let draft: Color = { h: 0, s: 0, v: 0 };

function updateColorButtons() {
  for (const slot of ['foreground', 'background'] as const) {
    const button = el(slot);
    button.querySelector<HTMLElement>('.fr-color-chip')!.style.setProperty('--fr-swatch-color', colors[slot]);
    button.setAttribute('aria-label', (slot === 'foreground' ? 'Foreground' : 'Background') + ' color ' + colors[slot]);
  }
}

function drawPicker(updateHex = true) {
  paintSaturationValue(area, draft);
  hue.value = String(draft.h);
  if (updateHex) hex.value = formatColor(draft, 'HEX');
  hex.removeAttribute('aria-invalid');
  showMessage(el('color-error'), '');
  apply.disabled = false;
  el('color-value').textContent = 'Saturation ' + decimal(draft.s * 100) + '%, brightness ' + decimal(draft.v * 100) + '%.';
}

for (const slot of ['foreground', 'background'] as const) {
  el(slot).addEventListener('click', () => {
    colorSlot = slot;
    dialog.returnValue = '';
    el('color-heading').textContent = slot === 'foreground' ? 'Foreground color' : 'Background color';
    draft = fromRGB(parseHex(colors[slot])!, { h: 0, s: 0, v: 0 });
    drawPicker();
  });
}
bindSaturationValue(area, { read: () => draft, change: value => { draft = { ...draft, ...value }; drawPicker(); } });
function setHue(h: number) {
  draft = { ...draft, h };
  drawPicker();
}
hue.addEventListener('input', () => setHue(hue.valueAsNumber));
bindHueKeyboard(hue, () => draft.h, setHue);
hex.addEventListener('input', () => {
  const rgb = parseHex(hex.value);
  if (rgb) {
    draft = fromRGB(rgb, draft);
    drawPicker(false);
  } else {
    apply.disabled = true;
    hex.setAttribute('aria-invalid', 'true');
    showMessage(el('color-error'), 'Enter three or six hexadecimal digits.');
  }
});
dialog.addEventListener('close', () => {
  if (dialog.returnValue !== 'apply' || apply.disabled) return;
  colors[colorSlot] = formatColor(draft, 'HEX');
  updateColorButtons();
  refresh();
});

initFruity();
editor.addEventListener('submit', event => event.preventDefault());
const contentTabs = editor.querySelector<HTMLElement>('[data-fr-tabs]')!;
contentTabs.addEventListener('click', event => {
  if ((event.target as HTMLElement).closest('[role="tab"]')) refresh();
});
contentTabs.addEventListener('keydown', event => {
  if (event.defaultPrevented) refresh();
});
for (const field of [url, text, ssid, password]) field.addEventListener('input', scheduleRender);
example.addEventListener('click', () => {
  url.value = 'kapsalakos.com';
  url.focus();
  refresh();
});
for (const control of [size, margin, correction, hiddenNetwork]) control.addEventListener('change', refresh);
security.addEventListener('change', () => {
  el('password-field').hidden = password.disabled = security.value === 'nopass';
  refresh();
});

function resetAppearance() {
  Object.assign(colors, defaults);
  for (const select of [size, margin, correction]) {
    select.selectedIndex = Array.from(select.options).findIndex(option => option.defaultSelected);
    if (select.selectedIndex < 0) select.selectedIndex = 0;
  }
  selectSync.forEach(sync => sync());
  updateColorButtons();
  refresh();
}

el('reset-appearance').addEventListener('click', resetAppearance);
function swapColors() {
  const foreground = colors.foreground;
  colors.foreground = colors.background;
  colors.background = foreground;
  updateColorButtons();
  refresh();
}
const swap = el('swap-colors');
swap.addEventListener('click', swapColors);
warningSwap.addEventListener('click', () => {
  swapColors();
  swap.focus();
});
warningReset.addEventListener('click', () => {
  Object.assign(colors, defaults);
  updateColorButtons();
  refresh();
  el('foreground').focus();
});
el('reset').addEventListener('click', () => {
  editor.reset();
  el('password-field').hidden = password.disabled = false;
  resetAppearance();
  el('url-tab').click();
  url.focus();
});

async function output(action: 'copy' | 'png' | 'svg') {
  if (!current || busy) return;
  const qr = current;
  const rasterSize = outputSize();
  if (action !== 'svg' && !fitsRaster(qr, rasterSize)) return;
  busy = true;
  editor.inert = true;
  updateActions();
  showMessage(status, '');
  try {
    if (action === 'copy') {
      await copyQR(qr, rasterSize);
      showMessage(status, 'QR image copied.');
    } else if (await saveQR(qr, rasterSize, action)) {
      showMessage(status, action.toUpperCase() + ' saved.');
    }
  } catch {
    showMessage(status, action === 'copy'
      ? 'Could not copy the QR image. Use Save PNG instead.'
      : isTauri() ? 'Could not save the file. Check the destination and try again.'
        : 'Open FruityQR in the desktop app to save files.');
  } finally {
    busy = false;
    editor.inert = false;
    updateActions();
    if (document.activeElement === document.body) {
      (action === 'copy' ? copy : action === 'png' ? savePng : saveSvg).focus();
    }
  }
}

copy.addEventListener('click', () => void output('copy'));
savePng.addEventListener('click', () => void output('png'));
saveSvg.addEventListener('click', () => void output('svg'));
new ResizeObserver(drawPreview).observe(preview);
window.addEventListener('resize', drawPreview);

el('app-version').textContent = version;
el('ui-version').textContent = FRUITY_UI_VERSION;
el('footer-ui-version').textContent = FRUITY_UI_LABEL;
el('app-license').textContent = appLicense;
el('ui-license').textContent = uiLicense;
updateColorButtons();
render();

if (isTauri()) {
  const appWindow = getCurrentWindow();
  const report = () => showMessage(status, 'Could not complete the window action.');
  if (/Windows/i.test(navigator.userAgent)) {
    el('window-controls').hidden = false;
    el('minimize').addEventListener('click', () => void appWindow.minimize().catch(report));
    el('close').addEventListener('click', () => void appWindow.close().catch(report));
    el('window-drag').addEventListener('mousedown', event => {
      if (event.button === 0 && event.detail === 1) {
        event.preventDefault();
        void appWindow.startDragging().catch(report);
      }
    });
  }
  void appWindow.show().catch(report);
}
