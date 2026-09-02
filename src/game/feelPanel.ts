import {
  FEEL_FIELDS,
  SLIDE_EASE_OPTIONS,
  applyFeelCss,
  defaultsFor,
  type Feel,
  type FeelMode,
  type FeelScheme,
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
import {
  AMAZE_CELL_MAX,
  AMAZE_CELL_MIN,
  AMAZE_MOVE_MS_MAX,
  AMAZE_MOVE_MS_MIN,
  getAmazeCell,
  getAmazeMoveMs,
  setAmazeCell,
  setAmazeMoveMs,
} from './amaze';

export function mountFeelPanel(
  host: HTMLElement,
  onChange: (feel: Feel) => void,
  initial: Feel,
  initialMode: FeelMode,
  onAmazeSize?: () => void,
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
        <div class="feel-schemes" id="feel-sfx" style="margin-top:8px">
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
        ? '单块：慢划也能走。手感2 要甩，每次按下只一步。'
        : '2048：每格滑移越长，走得远的越晚到。手感2 要甩，每次按下只一步。';
    wrap.querySelectorAll('[data-scheme]').forEach((b) => {
      b.classList.toggle('on', Number((b as HTMLElement).dataset.scheme) === feel.scheme);
    });
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
      } else if (f.kind === 'choice' && f.key === 'slideEase') {
        row.innerHTML = `
          <div class="feel-name">${f.label}</div>
          <div class="feel-why">${f.why}</div>
          <div class="feel-schemes" data-choice="slideEase">
            ${SLIDE_EASE_OPTIONS.map(
              (o) =>
                `<button type="button" data-ease="${o.id}" class="${feel.slideEase === o.id ? 'on' : ''}">${o.label}</button>`,
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

    const mazeCell = getAmazeCell();
    const mazeRow = document.createElement('label');
    mazeRow.className = 'feel-row';
    mazeRow.innerHTML = `
      <div class="feel-name">涂色格子边长 <em>${mazeCell}设计px</em></div>
      <div class="feel-why">只改涂色盘大小，7×9 格数不变。与 2048 棋盘缩放无关。</div>
      <input type="range" data-amaze-cell="1" min="${AMAZE_CELL_MIN}" max="${AMAZE_CELL_MAX}" step="1" value="${mazeCell}" />
    `;
    list.appendChild(mazeRow);
    const moveMs = getAmazeMoveMs();
    const moveRow = document.createElement('label');
    moveRow.className = 'feel-row';
    moveRow.innerHTML = `
      <div class="feel-name">涂色移动速度 <em>${moveMs}ms/格</em></div>
      <div class="feel-why">数字越小滑得越快。只改涂色方块，与 2048 每格滑移无关。</div>
      <input type="range" data-amaze-move="1" min="${AMAZE_MOVE_MS_MIN}" max="${AMAZE_MOVE_MS_MAX}" step="5" value="${moveMs}" />
    `;
    list.appendChild(moveRow);

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
    if (el.dataset.amazeCell) {
      const v = setAmazeCell(Number(el.value));
      const em = el.parentElement?.querySelector('em');
      if (em) em.textContent = `${v}设计px`;
      onAmazeSize?.();
      return;
    }
    if (el.dataset.amazeMove) {
      const v = setAmazeMoveMs(Number(el.value));
      const em = el.parentElement?.querySelector('em');
      if (em) em.textContent = `${v}ms/格`;
      onAmazeSize?.();
      return;
    }
    const key = el?.dataset.key as keyof Feel | undefined;
    if (!key) return;
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
      slideEase: feel.slideEase,
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

  list.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-ease]') as HTMLElement | null;
    if (!btn) return;
    const id = btn.dataset.ease as SlideEase;
    if (id !== 'out' && id !== 'soft' && id !== 'linear') return;
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
