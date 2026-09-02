import { VECTORS, type Dir } from './board';

/** 涂色盘：行列固定；格子边长可在设置里改。与 2048 boardScale 无关。 */
export const AMAZE_W = 7;
export const AMAZE_H = 9;
export const AMAZE_CELL_DEFAULT = 46;
export const AMAZE_CELL_MIN = 24;
export const AMAZE_CELL_MAX = 56;
export const AMAZE_GAP = 4;
export const AMAZE_MOVE_MS_DEFAULT = 60;
export const AMAZE_MOVE_MS_MIN = 20;
export const AMAZE_MOVE_MS_MAX = 160;

const CELL_KEY = 'swipe2048.amaze.cell';
const MOVE_KEY = 'swipe2048.amaze.moveMs';

export function clampAmazeCell(n: number): number {
  if (!Number.isFinite(n)) return AMAZE_CELL_DEFAULT;
  return Math.min(AMAZE_CELL_MAX, Math.max(AMAZE_CELL_MIN, Math.round(n)));
}

export function getAmazeCell(): number {
  const n = Number(localStorage.getItem(CELL_KEY));
  return clampAmazeCell(Number.isFinite(n) ? n : AMAZE_CELL_DEFAULT);
}

export function setAmazeCell(n: number): number {
  const v = clampAmazeCell(n);
  localStorage.setItem(CELL_KEY, String(v));
  return v;
}

export function resetAmazeCell(): number {
  localStorage.removeItem(CELL_KEY);
  return AMAZE_CELL_DEFAULT;
}

export function clampAmazeMoveMs(n: number): number {
  if (!Number.isFinite(n)) return AMAZE_MOVE_MS_DEFAULT;
  return Math.min(AMAZE_MOVE_MS_MAX, Math.max(AMAZE_MOVE_MS_MIN, Math.round(n)));
}

export function getAmazeMoveMs(): number {
  const n = Number(localStorage.getItem(MOVE_KEY));
  return clampAmazeMoveMs(Number.isFinite(n) ? n : AMAZE_MOVE_MS_DEFAULT);
}

export function setAmazeMoveMs(n: number): number {
  const v = clampAmazeMoveMs(n);
  localStorage.setItem(MOVE_KEY, String(v));
  return v;
}

export type AmazeState = {
  w: number;
  h: number;
  /** 1 = 区域内可走 */
  floor: Uint8Array;
  x: number;
  y: number;
  startX: number;
  startY: number;
  previous: { x: number; y: number } | null;
  level: number;
  seed: number;
  score: number;
  total: number;
};

function idx(x: number, y: number, w = AMAZE_W): number {
  return y * w + x;
}

export function inAmaze(x: number, y: number, w = AMAZE_W, h = AMAZE_H): boolean {
  return x >= 0 && y >= 0 && x < w && y < h;
}

export function isFloor(s: Pick<AmazeState, 'floor' | 'w' | 'h'>, x: number, y: number): boolean {
  if (!inAmaze(x, y, s.w, s.h)) return false;
  return s.floor[idx(x, y, s.w)] === 1;
}

export function isBlock(s: Pick<AmazeState, 'floor' | 'w' | 'h'>, x: number, y: number): boolean {
  if (!inAmaze(x, y, s.w, s.h)) return false;
  return s.floor[idx(x, y, s.w)] === 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function floorCount(floor: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < floor.length; i++) if (floor[i]) n += 1;
  return n;
}

function connectedFrom(
  floor: Uint8Array,
  sx: number,
  sy: number,
  w: number,
  h: number,
): number {
  const seen = new Uint8Array(w * h);
  const q = [idx(sx, sy, w)];
  seen[idx(sx, sy, w)] = 1;
  let n = 0;
  const dirs = [0, 1, 0, -1, 0];
  while (q.length) {
    const i = q.pop()!;
    if (!floor[i]) continue;
    n += 1;
    const x = i % w;
    const y = (i / w) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = x + dirs[k]!;
      const ny = y + dirs[k + 1]!;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = idx(nx, ny, w);
      if (seen[j] || !floor[j]) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return n;
}

export type AmazeSlide = {
  x: number;
  y: number;
  moved: boolean;
  cells: number;
  path: { x: number; y: number }[];
};

export function slideAmaze(s: AmazeState, x: number, y: number, dir: Dir): AmazeSlide {
  const v = VECTORS[dir];
  const path: { x: number; y: number }[] = [];
  let cx = x;
  let cy = y;
  for (;;) {
    const nx = cx + v.x;
    const ny = cy + v.y;
    if (!isFloor(s, nx, ny)) break;
    cx = nx;
    cy = ny;
    path.push({ x: cx, y: cy });
  }
  return {
    x: cx,
    y: cy,
    moved: path.length > 0,
    cells: path.length,
    path,
  };
}

export function generateAmaze(level: number, seed: number): AmazeState {
  const lv = Math.max(1, level);
  const w = AMAZE_W;
  const h = AMAZE_H;
  const start = { x: Math.floor(w / 2), y: h - 1 };
  const want = Math.min(12, 3 + Math.floor((lv - 1) / 2));
  const rng = mulberry32((seed >>> 0) ^ (lv * 0x9e3779b9));
  let floor = new Uint8Array(w * h).fill(1);

  for (let attempt = 0; attempt < 40; attempt++) {
    floor = new Uint8Array(w * h).fill(1);
    let placed = 0;
    let guard = 0;
    while (placed < want && guard++ < 80) {
      const x = Math.floor(rng() * w);
      const y = Math.floor(rng() * h);
      if (x === start.x && y === start.y) continue;
      const i = idx(x, y, w);
      if (!floor[i]) continue;
      floor[i] = 0;
      const total = floorCount(floor);
      if (connectedFrom(floor, start.x, start.y, w, h) !== total) {
        floor[i] = 1;
        continue;
      }
      placed += 1;
    }
    const total = floorCount(floor);
    if (connectedFrom(floor, start.x, start.y, w, h) === total && placed > 0) break;
  }

  const total = floorCount(floor);
  return {
    w,
    h,
    floor,
    x: start.x,
    y: start.y,
    startX: start.x,
    startY: start.y,
    previous: null,
    level: lv,
    seed,
    score: 0,
    total,
  };
}

export function newAmazeRun(seed = Date.now() >>> 0): AmazeState {
  return generateAmaze(1, seed);
}

export function cloneAmaze(s: AmazeState): AmazeState {
  return {
    ...s,
    floor: s.floor.slice(),
    previous: s.previous ? { ...s.previous } : null,
  };
}

export function retryAmaze(s: AmazeState): AmazeState {
  const next = generateAmaze(s.level, s.seed);
  next.score = s.score;
  return next;
}

export function nextAmaze(s: AmazeState): AmazeState {
  const next = generateAmaze(s.level + 1, s.seed);
  next.score = s.score;
  return next;
}

export function moveAmaze(
  s: AmazeState,
  dir: Dir,
): { state: AmazeState; moved: boolean; scoreDelta: number } {
  const sl = slideAmaze(s, s.x, s.y, dir);
  if (!sl.moved) return { state: s, moved: false, scoreDelta: 0 };
  const scoreDelta = sl.cells;
  return {
    state: {
      ...s,
      x: sl.x,
      y: sl.y,
      previous: { x: s.x, y: s.y },
      score: s.score + scoreDelta,
    },
    moved: true,
    scoreDelta,
  };
}
