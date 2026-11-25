import { decimal, formatColor, fromRGB, parseHex } from '../../src/color';
import { bindHueKeyboard, bindSaturationValue, paintSaturationValue } from '../../src/styles/fruity/v1.1/color-controls';
import { enhanceSelect } from '../../src/styles/fruity/v1.1/select';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T;
enhanceSelect(el<HTMLSelectElement>('demo-select'));

const area = el('demo-sv');
const hue = el<HTMLInputElement>('demo-hue');
const status = el('demo-status');
let color = fromRGB([0, 174, 239], { h: 0, s: 0, v: 0 });

function render() {
  const hex = formatColor(color, 'HEX');
  paintSaturationValue(area, color);
  hue.value = String(color.h);
  el('demo-swatch').style.setProperty('--fr-swatch-color', hex);
  el('demo-chip').style.setProperty('--fr-swatch-color', hex);
  el('demo-hex').textContent = hex;
  el('demo-sv-value').textContent = 'Saturation ' + decimal(color.s * 100) + '%, value ' + decimal(color.v * 100) + '%.';
  status.textContent = 'Picked ' + hex + '.';
}

bindSaturationValue(area, {
  read: () => color,
  change: (value) => { color = { ...color, ...value }; render(); },
});
function setHue(h: number) { color = { ...color, h }; render(); }
hue.addEventListener('input', () => setHue(hue.valueAsNumber));
bindHueKeyboard(hue, () => color.h, setHue);

document.querySelectorAll<HTMLButtonElement>('[data-demo-color]').forEach(button => {
  button.addEventListener('click', () => {
    const rgb = parseHex(button.dataset.demoColor ?? '');
    if (rgb) { color = fromRGB(rgb, color); render(); }
  });
});

const hexInput = el<HTMLInputElement>('demo-hex-input');
hexInput.addEventListener('input', () => {
  if (parseHex(hexInput.value)) {
    el('demo-hex-error').textContent = '';
    hexInput.removeAttribute('aria-invalid');
  } else {
    el('demo-hex-error').textContent = 'Enter three or six hexadecimal digits.';
    hexInput.setAttribute('aria-invalid', 'true');
  }
});

const notice = el('demo-notice');
const restart = el('demo-restart');
function cancelNotice() {
  notice.hidden = true;
  status.textContent = 'Screen picking canceled.';
  restart.focus();
}
el('demo-cancel').addEventListener('click', cancelNotice);
notice.addEventListener('keydown', event => {
  if (event.key === 'Escape') cancelNotice();
});
restart.addEventListener('click', () => {
  notice.hidden = false;
  status.textContent = 'Screen picking is active.';
  el('demo-cancel').focus();
});

const dialog = el<HTMLDialogElement>('demo-delete-dialog');
dialog.addEventListener('close', () => {
  status.textContent = dialog.returnValue === 'delete' ? 'Confirmed demo action.' : 'Delete canceled.';
  dialog.returnValue = '';
});

render();
