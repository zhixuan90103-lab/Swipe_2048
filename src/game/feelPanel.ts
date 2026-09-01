import {
  FEEL_FIELDS,
  applyFeelCss,
  defaultsFor,
  type Feel,
  type FeelMode,
  type FeelScheme,
} from './feel';

export function mountFeelPanel(
  host: HTMLElement,
  onChange: (feel: Feel) => void,
  initial: Feel,
  initialMode: FeelMode,
): {
  get: () => Feel;
  set: (next: Feel, mode?: FeelMode) => void;
  toggle: () => void;
  dispose: () => void;
} {
  let feel = initial;
  let mode = initialMode;
  applyFeelCss(feel);

  const wrap = document.createElement('div');
  wrap.id = 'feel-panel';
  wrap.className = 'feel-panel';
  wrap.innerHTML = `
    <div class="feel-sheet hidden" id="feel-sheet">
      <div class="feel-head">
        <strong>设置</strong>
        <span id="feel-blurb"></span>
        <div class="feel-schemes" id="feel-schemes">
          <button type="button" data-scheme="1">手感1 距离</button>
          <button type="button" data-scheme="2">手感2 甩动</button>
        </div>
      </div>
      <div class="feel-list" id="feel-list"></div>
      <button type="button" class="feel-reset" id="feel-reset">恢复默认</button>
    </div>
  `;
  host.appendChild(wrap);

  const list = wrap.querySelector('#feel-list')!;
  const sheet = wrap.querySelector('#feel-sheet')!;
  const blurb = wrap.querySelector('#feel-blurb') as HTMLElement;

  const paint = () => {
    list.replaceChildren();
    blurb.textContent =
      mode === 'solo'
        ? '单块：慢划也能走。手感2 要甩，每次按下只一步。'
        : '2048：每格滑移越长，走得远的越晚到。手感2 要甩，每次按下只一步。';
    wrap.querySelectorAll('[data-scheme]').forEach((b) => {
      b.classList.toggle('on', Number((b as HTMLElement).dataset.scheme) === feel.scheme);
    });
    for (const f of FEEL_FIELDS) {
      if (f.schemes && !f.schemes.includes(feel.scheme)) continue;
      if (f.modes && !f.modes.includes(mode)) continue;
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
    onChange(feel);
    const em = el.parentElement?.querySelector('em');
    const spec = FEEL_FIELDS.find((x) => x.key === key);
    if (em && spec?.unit !== undefined) em.textContent = `${feel[key]}${spec.unit}`;
  });

  wrap.querySelector('#feel-schemes')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-scheme]') as HTMLElement | null;
    if (!btn) return;
    const scheme = Number(btn.dataset.scheme) as FeelScheme;
    if (scheme !== 1 && scheme !== 2) return;
    const keep = {
      tileMoveMs: feel.tileMoveMs,
      slideMs: feel.slideMs,
      appearMs: feel.appearMs,
      mergePopMs: feel.mergePopMs,
      inputLockMs: feel.inputLockMs,
      rearmMs: feel.rearmMs,
      nudgePx: feel.nudgePx,
      nudgeMs: feel.nudgeMs,
      sameDirRepeat: feel.sameDirRepeat,
      slopPx: feel.slopPx,
      axisRatio: feel.axisRatio,
      boardY: feel.boardY,
      boardScale: feel.boardScale,
    };
    feel = { ...defaultsFor(scheme), ...keep, scheme };
    emit();
  });
  wrap.querySelector('#feel-reset')!.addEventListener('click', () => {
    feel = defaultsFor(feel.scheme);
    emit();
  });

  paint();
  onChange(feel);

  return {
    get: () => feel,
    set: (next: Feel, nextMode?: FeelMode) => {
      feel = next;
      if (nextMode) mode = nextMode;
      emit();
    },
    toggle: () => {
      sheet.classList.toggle('hidden');
    },
    dispose: () => wrap.remove(),
  };
}
