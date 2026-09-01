import {
  FEEL_DEFAULT,
  FEEL_FIELDS,
  applyFeelCss,
  loadFeel,
  saveFeel,
  type Feel,
} from './feel';

export function mountFeelPanel(
  host: HTMLElement,
  onChange: (feel: Feel) => void,
): { get: () => Feel; dispose: () => void } {
  let feel = loadFeel();
  applyFeelCss(feel);

  const wrap = document.createElement('div');
  wrap.id = 'feel-panel';
  wrap.className = 'feel-panel';
  wrap.innerHTML = `
    <button type="button" class="feel-toggle" id="feel-toggle">手感</button>
    <div class="feel-sheet hidden" id="feel-sheet">
      <div class="feel-head">
        <strong>手感调参</strong>
        <span>每项只改一件事 · 立刻生效</span>
      </div>
      <div class="feel-list" id="feel-list"></div>
      <button type="button" class="feel-reset" id="feel-reset">恢复默认</button>
    </div>
  `;
  host.appendChild(wrap);

  const list = wrap.querySelector('#feel-list')!;
  const sheet = wrap.querySelector('#feel-sheet')!;

  const paint = () => {
    list.replaceChildren();
    for (const f of FEEL_FIELDS) {
      const row = document.createElement('label');
      row.className = 'feel-row';
      const val = feel[f.key];
      if (f.kind === 'check') {
        row.innerHTML = `
          <div class="feel-name">${f.label}</div>
          <div class="feel-why">${f.why}</div>
          <input type="checkbox" data-key="${f.key}" ${val ? 'checked' : ''} />
        `;
      } else {
        row.innerHTML = `
          <div class="feel-name">${f.label} <em>${val}${f.unit ?? ''}</em></div>
          <div class="feel-why">${f.why}</div>
          <input type="range" data-key="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${val}" />
        `;
      }
      list.appendChild(row);
    }
  };

  const emit = () => {
    applyFeelCss(feel);
    saveFeel(feel);
    onChange(feel);
    paint();
  };

  list.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement | null;
    const key = el?.dataset.key as keyof Feel | undefined;
    if (!el || !key) return;
    if (el.type === 'checkbox') feel = { ...feel, [key]: el.checked };
    else feel = { ...feel, [key]: Number(el.value) };
    applyFeelCss(feel);
    saveFeel(feel);
    onChange(feel);
    const em = el.parentElement?.querySelector('em');
    const spec = FEEL_FIELDS.find((x) => x.key === key);
    if (em && spec?.unit !== undefined) em.textContent = `${feel[key]}${spec.unit}`;
  });

  wrap.querySelector('#feel-toggle')!.addEventListener('click', () => {
    sheet.classList.toggle('hidden');
  });
  wrap.querySelector('#feel-reset')!.addEventListener('click', () => {
    feel = { ...FEEL_DEFAULT };
    emit();
  });

  paint();
  onChange(feel);

  return {
    get: () => feel,
    dispose: () => wrap.remove(),
  };
}
