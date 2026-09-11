import {
  SLIDE_EASE_OPTIONS,
  applyFeelCss,
  defaultFeelForMode,
  fieldsFor,
  type Feel,
  type FeelMode,
  type SlideEase,
} from './feel';
import {
  HAPTIC_FIELDS,
  getHapticFeel,
  previewForField,
  resetHapticFeel,
  setHapticFeel,
  type HapticFeel,
} from './hapticFeel';
import { SFX_PACKS, isSfxPack } from '../audio/AudioCatalog';
import { gameSfx } from '../utils/gameSfx';
import { gameHaptics } from '../utils/gameHaptics';

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
        <div class="feel-schemes" id="feel-sfx">
          ${SFX_PACKS.map((p) => `<button type="button" data-sfx="${p.id}">${p.label}</button>`).join('')}
        </div>
        <div class="feel-schemes" id="feel-haptics" style="margin-top:8px">
          <button type="button" data-haptic="1">震动 开</button>
          <button type="button" data-haptic="0">震动 关</button>
        </div>
        <p class="feel-why" id="feel-sfx-why" style="margin:8px 0 0"></p>
        <p class="feel-why" id="feel-haptic-why" style="margin:4px 0 0">随系统触感；关音效不关震动。</p>
      </div>
      <div class="feel-list" id="feel-list"></div>
      <p class="feel-why" style="margin:12px 0 6px;font-weight:700;color:#776e65">震动参数</p>
      <div class="feel-list" id="feel-haptic-list"></div>
      <p class="feel-why" id="feel-haptic-api" style="margin:8px 0">松手预听一下，和棋盘相同（拖动时不连打）。数值原样进 API；合的中间档按上下限插值。</p>
      <button type="button" class="feel-reset" id="feel-haptic-reset">恢复震动默认</button>
      <button type="button" class="feel-reset" id="feel-reset">恢复手感默认</button>
    </div>
  `;
  host.appendChild(wrap);

  const list = wrap.querySelector('#feel-list')!;
  const hapticList = wrap.querySelector('#feel-haptic-list')!;
  const sheet = wrap.querySelector('#feel-sheet')!;
  const blurb = wrap.querySelector('#feel-blurb') as HTMLElement;

  const paintApi = () => {
    const el = wrap.querySelector('#feel-haptic-api') as HTMLElement | null;
    const s = gameHaptics.lastApi();
    if (!el || !s) return;
    if (s.extra && Number.isNaN(s.intensity)) {
      el.textContent = `上次 API：${s.id} ${s.extra}`;
      return;
    }
    el.textContent = `上次 API：${s.id}  intensity=${s.intensity.toFixed(2)}  sharpness=${s.sharpness.toFixed(2)}${s.extra ? `  ${s.extra}` : ''}`;
  };

  const previewHaptic = (key: keyof HapticFeel) => {
    if (!gameHaptics.isEnabled()) return;
    const p = previewForField(key);
    if (p.kind === 'slide') gameHaptics.slide(p.arg ?? 1);
    else if (p.kind === 'merge') gameHaptics.merge(p.arg ?? 4);
    else gameHaptics.nudge(feel.nudgeMs);
    queueMicrotask(() => queueMicrotask(paintApi));
  };

  const paint = () => {
    list.replaceChildren();
    blurb.textContent =
      mode === 'solo'
        ? '贪吃蛇 · 手感3：按住扇区转向。点左上角标题切 2048。'
        : '2048 · 手感2 甩动：够快才走，每次按下只一步。点左上角标题切贪吃蛇。';
    const pack = gameSfx.getPack();
    wrap.querySelectorAll('[data-sfx]').forEach((b) => {
      b.classList.toggle('on', Number((b as HTMLElement).dataset.sfx) === pack);
    });
    const why = wrap.querySelector('#feel-sfx-why') as HTMLElement | null;
    if (why) why.textContent = SFX_PACKS.find((p) => p.id === pack)?.why ?? '';
    wrap.querySelectorAll('[data-haptic]').forEach((b) => {
      const on = (b as HTMLElement).dataset.haptic === '1';
      b.classList.toggle('on', on === gameHaptics.isEnabled());
    });

    for (const f of fieldsFor(mode)) {
      const row = document.createElement('label');
      row.className = 'feel-row';
      const val = (feel as unknown as Record<string, unknown>)[f.key];
      if (f.kind === 'check') {
        row.innerHTML = `
          <div class="feel-name">${f.label}</div>
          <div class="feel-why">${f.why}</div>
          <input type="checkbox" data-key="${f.key}" ${val ? 'checked' : ''} />
        `;
      } else if (f.kind === 'choice' && f.key === 'slideEase') {
        row.innerHTML = `
          <div class="feel-name">${f.label}</div>
          <div class="feel-why">${f.why}</div>
          <div class="feel-schemes" data-choice="slideEase">
            ${SLIDE_EASE_OPTIONS.map(
              (o) =>
                `<button type="button" data-ease="${o.id}" class="${feel.scheme === 2 && feel.slideEase === o.id ? 'on' : ''}">${o.label}</button>`,
            ).join('')}
          </div>
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

    hapticList.replaceChildren();
    const hf = getHapticFeel();
    for (const f of HAPTIC_FIELDS) {
      const row = document.createElement('label');
      row.className = 'feel-row';
      const val = hf[f.key];
      row.innerHTML = `
        <div class="feel-name">${f.label} <em>${val.toFixed(f.step < 0.01 ? 3 : 2)}</em></div>
        <div class="feel-why">${f.why}</div>
        <input type="range" data-haptic-key="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${val}" />
      `;
      hapticList.appendChild(row);
    }
  };

  const emit = () => {
    applyFeelCss(feel);
    onChange(feel);
    paint();
  };

  hapticList.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement | null;
    const key = el?.dataset.hapticKey as keyof HapticFeel | undefined;
    if (!el || !key) return;
    const next = { ...getHapticFeel(), [key]: Number(el.value) };
    setHapticFeel(next);
    const em = el.parentElement?.querySelector('em');
    const spec = HAPTIC_FIELDS.find((x) => x.key === key);
    if (em) em.textContent = Number(el.value).toFixed((spec?.step ?? 0.01) < 0.01 ? 3 : 2);
  });

  hapticList.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement | null;
    const key = el?.dataset.hapticKey as keyof HapticFeel | undefined;
    if (!el || !key) return;
    previewHaptic(key);
  });

  list.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement | null;
    if (!el) return;
    const key = el.dataset.key;
    if (!key) return;
    const spec = fieldsFor(mode).find((x) => x.key === key);
    if (el.type === 'checkbox') {
      feel = { ...feel, [key]: el.checked } as Feel;
    } else {
      feel = { ...feel, [key]: Number(el.value) } as Feel;
    }
    applyFeelCss(feel);
    onChange(feel);
    const em = el.parentElement?.querySelector('em');
    const shown = (feel as unknown as Record<string, unknown>)[key];
    if (em && spec?.unit !== undefined) em.textContent = `${shown}${spec.unit}`;
  });

  list.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-ease]') as HTMLElement | null;
    if (!btn) return;
    const id = btn.dataset.ease as SlideEase;
    if (id !== 'out' && id !== 'soft' && id !== 'linear') return;
    if (feel.scheme !== 2) return;
    feel = { ...feel, slideEase: id };
    emit();
  });

  wrap.querySelector('#feel-sfx')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-sfx]') as HTMLElement | null;
    if (!btn) return;
    const n = Number(btn.dataset.sfx);
    if (!isSfxPack(n)) return;
    gameSfx.setPack(n);
    gameHaptics.previewMerge();
    paint();
  });

  wrap.querySelector('#feel-haptics')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-haptic]') as HTMLElement | null;
    if (!btn) return;
    gameHaptics.setEnabled(btn.dataset.haptic === '1');
    if (gameHaptics.isEnabled()) gameHaptics.previewMerge();
    paint();
  });

  wrap.querySelector('#feel-haptic-reset')!.addEventListener('click', () => {
    resetHapticFeel();
    paint();
    if (gameHaptics.isEnabled()) gameHaptics.previewMerge();
  });

  wrap.querySelector('#feel-reset')!.addEventListener('click', () => {
    feel = defaultFeelForMode(mode);
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
