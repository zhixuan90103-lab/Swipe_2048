import { SIZE, type BoardState, type Tile } from './board';

export const CELL = 72;
export const GAP = 8;
export const BOARD_PX = SIZE * CELL + (SIZE + 1) * GAP;

export const TILE_FONT_1 = 37;
export const TILE_FONT_3 = 30;
export const TILE_FONT_4 = 24;

/** 合并弹 keyframe 峰值所在比例（见 style.css g-pop） */
export const POP_PEAK_KEY = 0.28;
/** 峰值对准该块滑移进度 */
export const POP_ALIGN = 0.6;

export const COLORS: Record<number, { bg: string; fg: string }> = {
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

export type PaintAnim = {
  durationMs: number;
  easing: string;
  perCell: boolean;
  mergePopMs?: number;
};

export type Cell = { x: number; y: number };

export function cellsBetween(a: Cell, b: Cell): number {
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

export function tileTravelMs(from: Cell, to: Cell, anim: PaintAnim): number {
  const dist = Math.max(1, cellsBetween(from, to));
  return anim.perCell ? dist * anim.durationMs : anim.durationMs;
}

export function boardTravelMs(state: BoardState, anim: PaintAnim): number {
  if (!anim.perCell) return anim.durationMs;
  return Math.max(1, maxTravelCells(state)) * anim.durationMs;
}

export function popDelayMs(ownTravelMs: number, popMs: number): number {
  if (popMs <= 0) return 0;
  const peakAt = Math.round(ownTravelMs * POP_ALIGN);
  const peakIn = Math.round(popMs * POP_PEAK_KEY);
  return Math.max(0, peakAt - peakIn);
}

export function mergeStart(t: Tile): { from: Cell; travel: number } {
  let from = { x: t.x, y: t.y };
  let travel = 0;
  if (!t.mergedFrom) return { from, travel };
  for (const src of t.mergedFrom) {
    const p = src.previous ?? { x: src.x, y: src.y };
    const d = cellsBetween(p, t);
    if (d > travel) {
      travel = d;
      from = p;
    }
  }
  return { from, travel };
}

export function tileFontPx(value: number, scale: number): number {
  if (value >= 1000) return TILE_FONT_4 * scale;
  if (value >= 100) return TILE_FONT_3 * scale;
  return TILE_FONT_1 * scale;
}

export function tileColor(value: number): { bg: string; fg: string } {
  return COLORS[value] ?? { bg: '#3c3a32', fg: '#f9f6f2' };
}

export function cellTranslate(x: number, y: number, scale: number): string {
  const c = CELL * scale;
  const g = GAP * scale;
  return `translate(${g + x * (c + g)}px, ${g + y * (c + g)}px)`;
}
