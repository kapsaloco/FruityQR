type SaturationValue = { s: number; v: number };

function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function paintSaturationValue(area: HTMLElement, { h, s, v }: SaturationValue & { h: number }) {
  area.style.setProperty('--fr-picker-hue', String(h));
  area.style.setProperty('--fr-picker-x', String(s * 100) + '%');
  area.style.setProperty('--fr-picker-y', String((1 - v) * 100) + '%');
}

/** The host owns color state, readable value text, and gesture history. */
export function bindSaturationValue(area: HTMLElement, options: {
  read: () => SaturationValue;
  change: (value: SaturationValue, pointer: boolean) => void;
  start?: () => void;
  end?: () => void;
}) {
  const controller = new AbortController();
  const { signal } = controller;
  function point(event: PointerEvent) {
    const rect = area.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    options.change({
      s: clampUnit((event.clientX - rect.left) / rect.width),
      v: clampUnit(1 - (event.clientY - rect.top) / rect.height),
    }, true);
  }

  area.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    area.focus();
    area.setPointerCapture(event.pointerId);
    options.start?.();
    point(event);
  }, { signal });
  area.addEventListener('pointermove', event => {
    if (area.hasPointerCapture(event.pointerId)) point(event);
  }, { signal });
  area.addEventListener('pointerup', event => {
    if (!area.hasPointerCapture(event.pointerId)) return;
    point(event);
    area.releasePointerCapture(event.pointerId);
  }, { signal });
  area.addEventListener('pointercancel', event => {
    if (area.hasPointerCapture(event.pointerId)) area.releasePointerCapture(event.pointerId);
  }, { signal });
  area.addEventListener('lostpointercapture', () => options.end?.(), { signal });
  area.addEventListener('keydown', event => {
    const step = event.shiftKey ? .1 : .01;
    const delta = {
      ArrowLeft: [-step, 0], ArrowRight: [step, 0],
      ArrowUp: [0, step], ArrowDown: [0, -step],
    }[event.key];
    if (!Array.isArray(delta)) return;
    event.preventDefault();
    const { s, v } = options.read();
    options.change({ s: clampUnit(s + delta[0]), v: clampUnit(v + delta[1]) }, false);
  }, { signal });
  return () => controller.abort();
}

/** Adds wrapping degree steps to a native range input. */
export function bindHueKeyboard(input: HTMLInputElement, read: () => number, change: (hue: number) => void) {
  const onKey = (event: KeyboardEvent) => {
    const direction = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
    let next: number;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 359;
    else if (typeof direction === 'number') next = (360 + read() + direction * (event.shiftKey ? 10 : 1)) % 360;
    else return;
    event.preventDefault();
    change(next);
  };
  input.addEventListener('keydown', onKey);
  return () => input.removeEventListener('keydown', onKey);
}
