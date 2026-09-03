import type { BoardState, Dir, Tile } from './board';
import {
  CELL,
  boardTravelMs,
  catchUpMs,
  cellTranslate,
  mergeStart,
  parseTransformXY,
  popDelayMs,
  tileColor,
  tileFontPx,
  tileTravelMs,
  type PaintAnim,
} from './motion';
import {
  acquireTile,
  beginFrame,
  kickClass,
  poolFor,
  recycleIdle,
} from './tilePool';

export {
  BOARD_PX,
  CELL,
  TILE_FONT_1,
  TILE_FONT_3,
  TILE_FONT_4,
  boardTravelMs as slideDurationMs,
  type PaintAnim,
} from './motion';

function fillTile(el: HTMLDivElement, t: Tile, scale: number): HTMLElement {
  const inner = el.firstElementChild as HTMLElement;
  el.classList.remove('g-tile-new', 'g-tile-merge');
  el.className = 'g-tile';
  el.dataset.id = String(t.id);
  const c = tileColor(t.value);
  const px = CELL * scale;
  el.style.width = `${px}px`;
  el.style.height = `${px}px`;
  inner.style.background = c.bg;
  inner.style.color = c.fg;
  inner.textContent = t.label ?? String(t.value);
  inner.style.removeProperty('animation-delay');
  inner.style.fontSize = `${tileFontPx(t.value, scale)}px`;
  return inner;
}

function snapshotVisuals(layer: HTMLElement): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  for (const node of layer.querySelectorAll('.g-tile')) {
    const el = node as HTMLElement;
    if (el.style.visibility === 'hidden') continue;
    const id = el.dataset.id;
    if (!id) continue;
    const xy = parseTransformXY(getComputedStyle(el).transform);
    if (xy) out.set(id, xy);
  }
  return out;
}

export function paintBoard(
  host: HTMLElement,
  state: BoardState,
  animate: boolean,
  anim: PaintAnim,
  scale = 1,
): void {
  const layer = host.querySelector('.g-tiles') as HTMLElement;
  const pool = poolFor(layer);
  const visuals = snapshotVisuals(layer);
  beginFrame(pool);

  const boardMs = animate ? boardTravelMs(state, anim) : 0;
  host.style.setProperty('--g-slide-ms', `${boardMs}ms`);

  const visualOf = (t: Tile): { x: number; y: number } | null => {
    const self = visuals.get(String(t.id));
    if (self) return self;
    if (!t.mergedFrom) return null;
    let best: { x: number; y: number } | null = null;
    let bestD = -1;
    for (const src of t.mergedFrom) {
      const v = visuals.get(String(src.id));
      if (!v) continue;
      const from = src.previous ?? { x: src.x, y: src.y };
      const d = Math.abs(from.x - t.x) + Math.abs(from.y - t.y);
      if (d > bestD) {
        bestD = d;
        best = v;
      }
    }
    return best;
  };

  const slide = (
    el: HTMLElement,
    fromCell: { x: number; y: number },
    to: { x: number; y: number },
    fromPx: { x: number; y: number } | null,
  ) => {
    el.style.transition = 'none';
    if (fromPx) el.style.transform = `translate(${fromPx.x}px, ${fromPx.y}px)`;
    else el.style.transform = cellTranslate(fromCell.x, fromCell.y, scale);
    void el.offsetWidth;
    const ms = fromPx ? catchUpMs(fromPx, to, anim, scale) : tileTravelMs(fromCell, to, anim);
    el.style.transition = `transform ${ms}ms ${anim.easing}`;
    el.style.transform = cellTranslate(to.x, to.y, scale);
  };

  for (const t of state.tiles) {
    const fromPx = animate ? visualOf(t) : null;
    if (t.mergedFrom) {
      const { from, travel } = mergeStart(t);
      const el = acquireTile(layer, pool, String(t.id));
      const inner = fillTile(el, t, scale);
      const moving = travel > 0 || !!fromPx;
      const popMs = anim.mergePopMs ?? 0;
      if (popMs > 0 && !fromPx) {
        const ownMs = travel > 0 ? tileTravelMs(from, t, anim) : 0;
        inner.style.animationDelay = `${popDelayMs(ownMs, popMs)}ms`;
        kickClass(el, 'g-tile-merge');
      }
      if (moving) slide(el, from, t, fromPx);
      else {
        el.style.transition = 'none';
        el.style.transform = cellTranslate(t.x, t.y, scale);
      }
    } else if (t.previous && (t.previous.x !== t.x || t.previous.y !== t.y)) {
      const el = acquireTile(layer, pool, String(t.id));
      fillTile(el, t, scale);
      slide(el, t.previous, t, fromPx);
    } else {
      const el = acquireTile(layer, pool, String(t.id));
      const inner = fillTile(el, t, scale);
      if (fromPx && (fromPx.x !== 0 || fromPx.y !== 0)) {
        slide(el, { x: t.x, y: t.y }, t, fromPx);
      } else {
        el.style.transition = 'none';
        el.style.transform = cellTranslate(t.x, t.y, scale);
        if (!t.previous && animate && !fromPx) {
          inner.style.animationDelay = `${boardMs}ms`;
          kickClass(el, 'g-tile-new');
        }
      }
    }
  }
  recycleIdle(pool);
}

/** 沿 dir 顶一下再弹回（左只有 X，上只有 Y）。 */
export function nudgeBoard(host: HTMLElement, ms = 140, dir: Dir = 1): void {
  const dx = dir === 1 ? 1 : dir === 3 ? -1 : 0;
  const dy = dir === 2 ? 1 : dir === 0 ? -1 : 0;
  host.style.setProperty('--g-nudge-dx', `calc(${dx} * var(--g-nudge-px, 5px))`);
  host.style.setProperty('--g-nudge-dy', `calc(${dy} * var(--g-nudge-px, 5px))`);
  host.classList.remove('g-nudge');
  void host.offsetWidth;
  host.classList.add('g-nudge');
  window.setTimeout(() => host.classList.remove('g-nudge'), ms);
}
