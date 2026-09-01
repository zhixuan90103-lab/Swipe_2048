import { SIZE, type BoardState, type Tile } from './board';

const CELL = 72;
const GAP = 8;
/** 格 72px 时的字号。原版 1/2 位同高约 36% 格，3 位约 31% 格（对照截图）。 */
export const TILE_FONT_1 = 37;
export const TILE_FONT_3 = 30;
export const TILE_FONT_4 = 24;
export const BOARD_PX = SIZE * CELL + (SIZE + 1) * GAP;

const COLORS: Record<number, { bg: string; fg: string }> = {
  2: { bg: '#eee4da', fg: '#776e65' },
  4: { bg: '#ede0c8', fg: '#776e65' },
  8: { bg: '#f2b179', fg: '#f9f6f2' },
  16: { bg: '#f59563', fg: '#f9f6f2' },
  32: { bg: '#f67c5f', fg: '#f9f6f2' },
  64: { bg: '#f65e3b', fg: '#f9f6f2' },
  128: { bg: '#edcf72', fg: '#f9f6f2' },
  256: { bg: '#edcc61', fg: '#f9f6f2' },
  512: { bg: '#edc850', fg: '#f9f6f2' },
  1024: { bg: '#edc53f', fg: '#f9f6f2' },
  2048: { bg: '#edc22e', fg: '#f9f6f2' },
};

export function cellsBetween(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function maxTravelCells(state: BoardState): number {
  let n = 0;
  for (const t of state.tiles) {
    if (t.previous) n = Math.max(n, cellsBetween(t.previous, t));
    if (t.mergedFrom) {
      for (const s of t.mergedFrom) {
        const from = s.previous ?? { x: s.x, y: s.y };
        n = Math.max(n, cellsBetween(from, t));
      }
    }
  }
  return n;
}

function pos(x: number, y: number, scale: number): string {
  const c = CELL * scale;
  const g = GAP * scale;
  const left = g + x * (c + g);
  const top = g + y * (c + g);
  return `translate(${left}px, ${top}px)`;
}

function tileEl(t: Tile, at: { x: number; y: number }, scale: number): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'g-tile';
  el.dataset.id = String(t.id);
  const c = COLORS[t.value] ?? { bg: '#3c3a32', fg: '#f9f6f2' };
  const px = CELL * scale;
  el.style.width = `${px}px`;
  el.style.height = `${px}px`;
  el.style.transform = pos(at.x, at.y, scale);
  const inner = document.createElement('div');
  inner.className = 'g-tile-inner';
  inner.style.background = c.bg;
  inner.style.color = c.fg;
  inner.textContent = t.label ?? String(t.value);
  let fs = TILE_FONT_1 * scale;
  if (t.value >= 100) fs = TILE_FONT_3 * scale;
  if (t.value >= 1000) fs = TILE_FONT_4 * scale;
  inner.style.fontSize = `${fs}px`;
  el.appendChild(inner);
  return el;
}

/** 默认每格滑移（设置 `slideMs` 覆盖） */
export const MERGE_SLIDE_MS = 80;
/** 先快后慢：出手立刻冲出，到位减速贴格 */
export const MERGE_SLIDE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

export type PaintAnim = {
  /** perCell 时为每格 ms；否则为整次滑动 ms */
  durationMs: number;
  easing: string;
  perCell: boolean;
  mergePopMs?: number;
};

export function slideDurationMs(state: BoardState, anim: PaintAnim): number {
  if (!anim.perCell) return anim.durationMs;
  return Math.max(1, maxTravelCells(state)) * anim.durationMs;
}

export function paintBoard(
  host: HTMLElement,
  state: BoardState,
  animate: boolean,
  anim: PaintAnim,
  scale = 1,
): void {
  const layer = host.querySelector('.g-tiles') as HTMLElement;
  layer.replaceChildren();

  const slideMs = animate ? slideDurationMs(state, anim) : 0;
  host.style.setProperty('--g-slide-ms', `${slideMs}ms`);

  const tileMs = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dist = Math.max(1, cellsBetween(from, to));
    return anim.perCell ? dist * anim.durationMs : anim.durationMs;
  };

  const slide = (el: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ms = tileMs(from, to);
    el.style.transition = 'none';
    el.style.transform = pos(from.x, from.y, scale);
    void el.offsetWidth;
    el.style.transition = `transform ${ms}ms ${anim.easing}`;
    el.style.transform = pos(to.x, to.y, scale);
  };

  for (const t of state.tiles) {
    if (t.mergedFrom) {
      let from = { x: t.x, y: t.y };
      let travel = 0;
      for (const src of t.mergedFrom) {
        const p = src.previous ?? { x: src.x, y: src.y };
        const d = cellsBetween(p, t);
        if (d > travel) {
          travel = d;
          from = p;
        }
      }
      const el = tileEl(t, from, scale);
      const popMs = anim.mergePopMs ?? 0;
      if (popMs > 0) {
        el.classList.add('g-tile-merge');
        const inner = el.firstElementChild as HTMLElement;
        // 峰值对准滑移约 60%（快落到格），不要等滑完再弹
        const ownMs = travel > 0 ? tileMs(from, t) : 0;
        const peakAt = Math.round(ownMs * 0.6);
        const peakIn = Math.round(popMs * 0.28);
        inner.style.animationDelay = `${Math.max(0, peakAt - peakIn)}ms`;
      }
      layer.appendChild(el);
      if (travel > 0) slide(el, from, t);
    } else if (t.previous && (t.previous.x !== t.x || t.previous.y !== t.y)) {
      const el = tileEl(t, t.previous, scale);
      layer.appendChild(el);
      slide(el, t.previous, t);
    } else {
      const el = tileEl(t, { x: t.x, y: t.y }, scale);
      if (!t.previous && animate) {
        el.classList.add('g-tile-new');
        const inner = el.firstElementChild as HTMLElement;
        inner.style.animationDelay = `${slideMs}ms`;
      }
      layer.appendChild(el);
    }
  }
}

export function nudgeBoard(host: HTMLElement, ms = 140): void {
  host.classList.remove('g-nudge');
  void host.offsetWidth;
  host.classList.add('g-nudge');
  window.setTimeout(() => host.classList.remove('g-nudge'), ms);
}
