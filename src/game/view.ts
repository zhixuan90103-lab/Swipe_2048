import type { BoardState, Tile } from './board';
import {
  CELL,
  boardTravelMs,
  cellTranslate,
  mergeStart,
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

function fillTile(
  el: HTMLDivElement,
  t: Tile,
  at: { x: number; y: number },
  scale: number,
): HTMLElement {
  const inner = el.firstElementChild as HTMLElement;
  el.className = 'g-tile';
  el.dataset.id = String(t.id);
  const c = tileColor(t.value);
  const px = CELL * scale;
  el.style.width = `${px}px`;
  el.style.height = `${px}px`;
  el.style.transform = cellTranslate(at.x, at.y, scale);
  el.style.transition = 'none';
  inner.style.background = c.bg;
  inner.style.color = c.fg;
  inner.textContent = t.label ?? String(t.value);
  inner.style.removeProperty('animation-delay');
  inner.style.fontSize = `${tileFontPx(t.value, scale)}px`;
  return inner;
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
  beginFrame(pool);

  const boardMs = animate ? boardTravelMs(state, anim) : 0;
  host.style.setProperty('--g-slide-ms', `${boardMs}ms`);

  const slide = (el: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ms = tileTravelMs(from, to, anim);
    el.style.transition = 'none';
    el.style.transform = cellTranslate(from.x, from.y, scale);
    void el.offsetWidth;
    el.style.transition = `transform ${ms}ms ${anim.easing}`;
    el.style.transform = cellTranslate(to.x, to.y, scale);
  };

  for (const t of state.tiles) {
    if (t.mergedFrom) {
      const { from, travel } = mergeStart(t);
      const el = acquireTile(layer, pool);
      const inner = fillTile(el, t, from, scale);
      const popMs = anim.mergePopMs ?? 0;
      if (popMs > 0) {
        const ownMs = travel > 0 ? tileTravelMs(from, t, anim) : 0;
        inner.style.animationDelay = `${popDelayMs(ownMs, popMs)}ms`;
        kickClass(el, 'g-tile-merge');
      }
      if (travel > 0) slide(el, from, t);
    } else if (t.previous && (t.previous.x !== t.x || t.previous.y !== t.y)) {
      const el = acquireTile(layer, pool);
      fillTile(el, t, t.previous, scale);
      slide(el, t.previous, t);
    } else {
      const el = acquireTile(layer, pool);
      const inner = fillTile(el, t, { x: t.x, y: t.y }, scale);
      if (!t.previous && animate) {
        inner.style.animationDelay = `${boardMs}ms`;
        kickClass(el, 'g-tile-new');
      }
    }
  }
  recycleIdle(pool);
}

export function nudgeBoard(host: HTMLElement, ms = 140): void {
  host.classList.remove('g-nudge');
  void host.offsetWidth;
  host.classList.add('g-nudge');
  window.setTimeout(() => host.classList.remove('g-nudge'), ms);
}
