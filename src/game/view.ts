import { SIZE, type BoardState, type Tile } from './board';

const CELL = 72;
const GAP = 8;
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

function pos(x: number, y: number): string {
  const left = GAP + x * (CELL + GAP);
  const top = GAP + y * (CELL + GAP);
  return `translate(${left}px, ${top}px)`;
}

function tileEl(t: Tile, at: { x: number; y: number }): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'g-tile';
  el.dataset.id = String(t.id);
  const c = COLORS[t.value] ?? { bg: '#3c3a32', fg: '#f9f6f2' };
  el.style.background = c.bg;
  el.style.color = c.fg;
  el.style.width = `${CELL}px`;
  el.style.height = `${CELL}px`;
  el.style.transform = pos(at.x, at.y);
  const inner = document.createElement('span');
  inner.textContent = t.label ?? String(t.value);
  if (t.value >= 100) inner.style.fontSize = '22px';
  if (t.value >= 1000) inner.style.fontSize = '18px';
  el.appendChild(inner);
  return el;
}

export function paintBoard(
  host: HTMLElement,
  state: BoardState,
  animate: boolean,
  msPerCell = 100,
): void {
  const layer = host.querySelector('.g-tiles') as HTMLElement;
  layer.replaceChildren();

  const slide = (el: HTMLElement, from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dist = Math.max(1, cellsBetween(from, to));
    el.style.transition = 'none';
    el.style.transform = pos(from.x, from.y);
    void el.offsetWidth;
    el.style.transition = `transform ${dist * msPerCell}ms linear`;
    el.style.transform = pos(to.x, to.y);
  };

  for (const t of state.tiles) {
    if (t.mergedFrom) {
      for (const src of t.mergedFrom) {
        const from = src.previous ?? { x: src.x, y: src.y };
        const el = tileEl({ ...src, value: src.value }, from);
        layer.appendChild(el);
        slide(el, from, t);
      }
      const pop = tileEl(t, { x: t.x, y: t.y });
      pop.classList.add('g-tile-merge');
      layer.appendChild(pop);
    } else if (t.previous && (t.previous.x !== t.x || t.previous.y !== t.y)) {
      const el = tileEl(t, t.previous);
      layer.appendChild(el);
      slide(el, t.previous, t);
    } else {
      const el = tileEl(t, { x: t.x, y: t.y });
      if (!t.previous && animate) el.classList.add('g-tile-new');
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
