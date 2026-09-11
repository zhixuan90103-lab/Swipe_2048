import { VECTORS, type Dir } from './board';

export const SNAKE_W = 13;
export const SNAKE_H = 15;
export const SNAKE_CELL = 24;
export const SNAKE_GAP = 3;
export const SNAKE_TICK_START = 240;
export const SNAKE_TICK_MIN = 90;
/** 每吃一个缩短的间隔 */
export const SNAKE_TICK_PER_FOOD = 12;

export function snakeTickMs(score: number): number {
  const n = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  return Math.max(SNAKE_TICK_MIN, SNAKE_TICK_START - n * SNAKE_TICK_PER_FOOD);
}

export type SnakeCell = { x: number; y: number };

export const SNAKE_INTENT_MAX = 2;
/** 贪吃蛇按住转向死区（设计 px），小于手感1 默认 slop */
export const SNAKE_STEER_SLOP = 4;

export type SnakeState = {
  w: number;
  h: number;
  body: SnakeCell[];
  dir: Dir;
  /** 最多 2 个即将执行的转向，相对末项必须 90° */
  queued: Dir[];
  food: SnakeCell;
  score: number;
  dead: boolean;
};

function key(c: SnakeCell): string {
  return `${c.x},${c.y}`;
}

function inBoard(s: Pick<SnakeState, 'w' | 'h'>, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < s.w && y < s.h;
}

export function dirsArePerpendicular(a: Dir, b: Dir): boolean {
  return (a & 1) !== (b & 1);
}

function spawnFood(s: Omit<SnakeState, 'food'>): SnakeCell {
  const taken = new Set(s.body.map(key));
  const free: SnakeCell[] = [];
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      if (!taken.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) return { x: s.body[0]!.x, y: s.body[0]!.y };
  return free[(Math.random() * free.length) | 0]!;
}

export function newSnake(): SnakeState {
  const w = SNAKE_W;
  const h = SNAKE_H;
  const cx = (w / 2) | 0;
  const cy = (h / 2) | 0;
  const body: SnakeCell[] = [
    { x: cx, y: cy },
    { x: cx, y: cy + 1 },
    { x: cx, y: cy + 2 },
  ];
  const base = {
    w,
    h,
    body,
    dir: 0 as Dir,
    queued: [] as Dir[],
    score: 0,
    dead: false,
  };
  return { ...base, food: spawnFood(base) };
}

function lastIntent(s: SnakeState): Dir {
  return s.queued.length > 0 ? s.queued[s.queued.length - 1]! : s.dir;
}

/** 入队转向。相对队列末项须 90°；已满 2 则丢掉。同向/掉头静默忽略。 */
export function queueSnakeTurn(s: SnakeState, dir: Dir): SnakeState {
  if (s.dead) return s;
  const last = lastIntent(s);
  if (dir === last || !dirsArePerpendicular(last, dir)) return s;
  const imminentWall = stepHitsWall(s, s.dir);
  if (imminentWall && dirsArePerpendicular(s.dir, dir) && !stepHitsWall(s, dir) && !stepHitsBody(s, dir)) {
    return stepSnake({ ...s, queued: [dir] });
  }
  if (s.queued.length >= SNAKE_INTENT_MAX) return s;
  return { ...s, queued: [...s.queued, dir] };
}

function stepHitsWall(s: SnakeState, dir: Dir): boolean {
  const head = s.body[0]!;
  const v = VECTORS[dir];
  return !inBoard(s, head.x + v.x, head.y + v.y);
}

function stepHitsBody(s: SnakeState, dir: Dir): boolean {
  const head = s.body[0]!;
  const v = VECTORS[dir];
  const nx = head.x + v.x;
  const ny = head.y + v.y;
  return s.body.some((c, i) => i < s.body.length - 1 && c.x === nx && c.y === ny);
}

export function stepSnake(s: SnakeState): SnakeState {
  if (s.dead) return s;
  const queued = s.queued.slice();
  let dir = queued.length > 0 ? queued.shift()! : s.dir;

  if (stepHitsWall(s, dir)) {
    while (queued.length > 0 && stepHitsWall(s, queued[0]!)) queued.shift();
    if (queued.length > 0 && !stepHitsWall(s, queued[0]!)) {
      dir = queued.shift()!;
    } else {
      return { ...s, dir, queued, dead: true };
    }
  }

  if (stepHitsBody(s, dir)) {
    return { ...s, dir, queued, dead: true };
  }
  const head = s.body[0]!;
  const v = VECTORS[dir];
  const nx = head.x + v.x;
  const ny = head.y + v.y;
  const eat = nx === s.food.x && ny === s.food.y;
  const body = [{ x: nx, y: ny }, ...s.body];
  if (!eat) body.pop();
  const next = {
    ...s,
    body,
    dir,
    queued,
    score: eat ? s.score + 1 : s.score,
    dead: false,
  };
  if (eat) next.food = spawnFood(next);
  return next;
}
