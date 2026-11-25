export function enhanceSelect(select: HTMLSelectElement) {
  const control = document.getElementById(select.id + '-control')!;
  const trigger = document.getElementById(select.id + '-trigger')! as HTMLButtonElement;
  const menu = document.getElementById(select.id + '-menu')!;
  const label = document.getElementById(select.id + '-value')!;
  const options = Array.from(select.options, option => {
    const item = document.createElement('button');
    item.type = 'button';
    item.role = 'option';
    item.tabIndex = -1;
    item.textContent = option.text;
    item.addEventListener('click', () => {
      select.value = option.value;
      select.dispatchEvent(new Event('change'));
      close(true);
    });
    return item;
  });
  menu.append(...options);

  function sync() {
    label.textContent = select.selectedOptions[0]?.text ?? '';
    options.forEach((item, i) => item.setAttribute('aria-selected', String(i === select.selectedIndex)));
  }

  function close(restoreFocus = false) {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus();
  }

  function open() {
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    options[select.selectedIndex]?.focus();
  }

  trigger.addEventListener('click', () => menu.hidden ? open() : close());
  trigger.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open();
    }
  });
  menu.addEventListener('keydown', event => {
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === 'Tab') {
      close(true);
      return;
    }
    const last = options.length - 1;
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? last :
      event.key === 'ArrowDown' ? Math.min(last, current + 1) :
      event.key === 'ArrowUp' ? Math.max(0, current - 1) : -1;
    if (index >= 0) {
      event.preventDefault();
      options[index].focus();
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!menu.hidden && !control.contains(event.target as Node)) close();
  });
  control.addEventListener('focusout', event => {
    if (!menu.hidden && event.relatedTarget && !control.contains(event.relatedTarget as Node)) close();
  });

  select.hidden = true;
  control.hidden = false;
  select.addEventListener('change', sync);
  sync();
  return sync;
}

