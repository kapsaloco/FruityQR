import '../../src/styles/fruity/v1.1/index.css';
import { FRUITY_UI_LABEL } from '../../src/styles/fruity/v1.1/version';
const version = '1.0.0';
document.querySelectorAll('[data-fruity-ui-version]').forEach(node => { node.textContent = FRUITY_UI_LABEL; });
document.querySelectorAll('[data-app-version]').forEach(node => { node.textContent = `v${version.replace(/\.0$/, '')}`; });
import './fruity-preview.css';
import { initFruity, bindFruityCopy } from '../../src/styles/fruity/v1.1/components';
const controller = new AbortController();
const signal = controller.signal;
const cleanups = [initFruity()];
function el<T extends HTMLElement = HTMLElement>(id: string): T { return document.getElementById(id) as T; }
const announce = (message: string) => { el('workflow-announcement').textContent = message; };
const sha256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
const sha512 = 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f';
for (const [algorithm, digest] of [['sha256', sha256], ['sha512', sha512]]) {
  el(`${algorithm}-value`).textContent = digest;
  cleanups.push(bindFruityCopy(el<HTMLButtonElement>(`copy-${algorithm}`), () => digest,
    value => navigator.clipboard.writeText(value), message => { el('copy-status').textContent = message; }));
}
const selection = el<HTMLSelectElement>('drop-state');
function showSelection(state: string) {
  selection.value = state;
  const selected = state === 'selected';
  el('file-drop').hidden = selected;
  el('selected-file').hidden = !selected;
  el('file-drop').dataset.state = state;
  el('drop-title').textContent = state === 'dragging' ? 'Drop to choose a file' : state === 'rejected' ? 'Choose one file at a time' : state === 'locked' ? 'Calculation in progress' : 'Drop a file here';
  el('drop-description').textContent = state === 'locked' ? 'Cancel the current calculation before choosing another file.' : state === 'rejected' ? 'Folders and multiple files are not supported.' : 'Choose one regular file from your computer.';
  el<HTMLButtonElement>('fixture-choose').disabled = state === 'locked';
}
selection.addEventListener('change', () => showSelection(selection.value), { signal });
el('fixture-choose').addEventListener('click', () => { showSelection('selected'); el('fixture-change').focus(); announce('Example file selected.'); }, { signal });
for (const id of ['fixture-change', 'fixture-clear']) el(id).addEventListener('click', () => { showSelection('empty'); el('fixture-choose').focus(); announce('Example file cleared.'); }, { signal });
const phase = el<HTMLSelectElement>('operation-state');
const phaseText: Record<string, [string, string, string]> = {
  ready: ['Ready to calculate', 'SHA-256 selected · Preview data only', 'Calculate hashes'],
  starting: ['Opening file…', 'Registering the operation · Preview data only', 'Cancel'],
  hashing: ['Calculating hashes…', 'One streaming read · Preview data only', 'Cancel'],
  canceling: ['Canceling…', 'Waiting for the worker to settle.', 'Canceling…'],
  canceled: ['Calculation canceled', 'No results were kept.', 'Calculate again'],
  failed: ['Could not read the file', 'Check access to the file, then try again. No results were kept.', 'Try again'],
  succeeded: ['Calculation complete', 'All selected checksums are ready · Preview data only', 'Calculate again'],
};
function showPhase(state: string) {
  phase.value = state;
  const [title, description, action] = phaseText[state];
  el('operation').dataset.state = state;
  el('operation').setAttribute('aria-busy', String(['starting', 'hashing', 'canceling'].includes(state)));
  el('operation-title').textContent = title;
  el('operation-description').textContent = description;
  const button = el<HTMLButtonElement>('operation-action');
  button.textContent = action;
  button.disabled = state === 'canceling';
  button.classList.toggle('fr-button--primary', !['starting', 'hashing', 'canceling'].includes(state));
  const progressing = ['starting', 'hashing', 'canceling', 'succeeded'].includes(state);
  el('operation-progress').hidden = !progressing;
  const meter = el('operation-meter');
  meter.dataset.state = state === 'starting' ? 'indeterminate' : state === 'hashing' ? 'active' : state === 'succeeded' ? 'complete' : 'paused';
  meter.style.setProperty('--fr-progress-value', state === 'succeeded' ? '100%' : '42%');
  meter.setAttribute('aria-valuemin', '0'); meter.setAttribute('aria-valuemax', '100');
  if (state === 'starting') meter.removeAttribute('aria-valuenow');
  else meter.setAttribute('aria-valuenow', state === 'succeeded' ? '100' : '42');
  el('operation-bytes').textContent = state === 'starting' ? 'Opening file…' : state === 'succeeded' ? '512 MiB of 512 MiB · 4.8 s' : '216 MiB of 512 MiB · 2.1 s';
  el('operation-percent').textContent = state === 'starting' ? '' : state === 'succeeded' ? '100%' : '42%';
}
phase.addEventListener('change', () => showPhase(phase.value), { signal });
el('operation-action').addEventListener('click', () => {
  const state = phase.value;
  showPhase(['starting', 'hashing'].includes(state) ? 'canceling' : 'starting');
  if (phase.value === 'canceling') phase.focus();
  announce(phaseText[phase.value][0]);
}, { signal });
const expected = el<HTMLTextAreaElement>('expected');
function compare(validate: boolean) {
  const value = expected.value.replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g, '').toLowerCase();
  const algorithm = ({32: 'MD5', 40: 'SHA-1', 64: 'SHA-256', 128: 'SHA-512'} as Record<number, string>)[value.length];
  const valid = Boolean(algorithm) && /^[0-9a-f]+$/.test(value);
  let state = 'waiting', message = 'Paste an expected checksum to compare.';
  el('detected').textContent = valid ? algorithm : 'No algorithm detected';
  expected.removeAttribute('aria-invalid');
  if (value && !valid && validate) { state = 'invalid'; message = 'Enter a hexadecimal MD5, SHA-1, SHA-256 or SHA-512 checksum.'; expected.setAttribute('aria-invalid', 'true'); }
  else if (valid && (algorithm === 'MD5' || algorithm === 'SHA-1')) message = `${algorithm} was not calculated. Select it and calculate again.`;
  else if (valid) {
    const match = value === (algorithm === 'SHA-256' ? sha256 : sha512);
    state = match ? 'match' : 'mismatch'; message = match ? 'Checksums match' : 'Checksums do not match';
  } else if (value) message = 'Finish entering the expected checksum.';
  el('comparison').dataset.state = state;
  el('comparison-message').textContent = message;
  el('comparison-verdict').dataset.state = state;
  el('comparison-badge').textContent = valid ? algorithm : '';
  if (validate) announce(message);
}
expected.addEventListener('input', () => compare(false), { signal });
expected.addEventListener('blur', () => compare(true), { signal });
el('compare').addEventListener('click', () => compare(true), { signal });
for (const [id, value] of [['fixture-match', sha256], ['fixture-mismatch', '0'.repeat(64)]]) {
  el(id).addEventListener('click', () => { expected.value = value; compare(true); }, { signal });
}
if (import.meta.hot) import.meta.hot.dispose(() => { controller.abort(); cleanups.forEach(dispose => dispose()); });



