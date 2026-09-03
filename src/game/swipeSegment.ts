import type { Dir } from './board';

export type Axis = 0 | 1; // 0 竖 1 横

/** 未锁轴斜滑分叉：偏角 ≥ 40°（副/主 ≥ tan40°）。小于此仍等锁轴，不改判。 */
export const DIAGONAL_FORK_RATIO = Math.tan((40 * Math.PI) / 180);

export type SegmentInput = {
  dx: number;
  dy: number;
  axis: Axis | null;
  lastDir: Dir | null;
  slop: number;
  commit: number;
  axisRatio: number;
  sameDirRepeat: boolean;
  /** 1 距离出手；2 轴上窗速度 ≥ speedMin 才出手 */
  scheme?: 1 | 2;
  /** 已 scale 的沿将锁/已锁轴 client px/秒（窗净位移） */
  speed?: number;
  speedMin?: number;
  /** 横/竖轴窗速度，仅未锁轴 40°–45° 分叉用 */
  speedX?: number;
  speedY?: number;
  /** 2048 只读：该向是否能动。缺省则不做斜滑分叉（涂色/测试旧合同）。 */
  legal?: (dir: Dir) => boolean;
  /** 手感2：本按下已经出现过「够远但不够快」的慢滑，本按下不再出手 */
  slowDrag?: boolean;
};

/** 沿轴已达出手距离、窗速度仍低于门槛 → 本按下锁成慢滑。 */
export function shouldLatchSlowDrag(
  along: number,
  speed: number,
  commit: number,
  speedMin: number,
): boolean {
  return along >= commit && speed < speedMin;
}

export type SegmentDecision = {
  axis: Axis | null;
  fire: Dir | null;
  consume: boolean;
  /** 斜滑两向都不能走：按较长轴 nudge，不走棋 */
  dead?: Dir;
};

export function dirFromDelta(dx: number, dy: number, axisRatio: number): Dir | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const major = Math.max(ax, ay);
  const minor = Math.min(ax, ay);
  if (major === 0) return null;
  if (major < minor * axisRatio) return null;
  return ax > ay ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
}

function axisOf(dir: Dir): Axis {
  return dir === 1 || dir === 3 ? 1 : 0;
}

function dirReady(s: SegmentInput, dir: Dir): boolean {
  if (!s.legal?.(dir)) return false;
  if ((s.scheme ?? 1) !== 2) return true;
  const spd = dir === 1 || dir === 3 ? (s.speedX ?? 0) : (s.speedY ?? 0);
  return spd >= (s.speedMin ?? 0);
}

/** 未锁轴且两轴都够 commit、偏角 ≥ 40°：只走「唯一能走的那一向」。 */
function diagonalFork(s: SegmentInput): SegmentDecision | null {
  if (!s.legal) return null;
  const ax = Math.abs(s.dx);
  const ay = Math.abs(s.dy);
  if (ax < s.commit || ay < s.commit) return null;
  const major = Math.max(ax, ay);
  const minor = Math.min(ax, ay);
  if (major <= 0 || minor / major < DIAGONAL_FORK_RATIO) return null;

  const h: Dir = s.dx > 0 ? 1 : 3;
  const v: Dir = s.dy > 0 ? 2 : 0;
  const hOk = dirReady(s, h);
  const vOk = dirReady(s, v);

  if (hOk !== vOk) {
    const dir = hOk ? h : v;
    if (dir === s.lastDir && !s.sameDirRepeat) {
      return { axis: axisOf(dir), fire: null, consume: true };
    }
    return { axis: axisOf(dir), fire: dir, consume: true };
  }
  if (hOk && vOk) return { axis: null, fire: null, consume: false };

  const hLegal = s.legal(h);
  const vLegal = s.legal(v);
  if (!hLegal && !vLegal) {
    if (s.lastDir !== null) return { axis: null, fire: null, consume: false };
    return { axis: null, fire: null, consume: true, dead: ay >= ax ? v : h };
  }
  return { axis: null, fire: null, consume: false };
}

export function evaluateSegment(s: SegmentInput): SegmentDecision {
  if ((s.scheme ?? 1) === 2 && (s.lastDir !== null || s.slowDrag)) {
    return { axis: s.axis, fire: null, consume: false };
  }

  const ax = Math.abs(s.dx);
  const ay = Math.abs(s.dy);
  const dist = Math.max(ax, ay);
  let axis = s.axis;

  if (axis === null) {
    if (dist < s.slop) {
      return { axis: null, fire: null, consume: false };
    }
    const guess = dirFromDelta(s.dx, s.dy, s.axisRatio);
    if (guess === null) {
      return diagonalFork(s) ?? { axis: null, fire: null, consume: false };
    }
    axis = axisOf(guess);
  } else {
    const along0 = axis === 1 ? ax : ay;
    const other = axis === 1 ? ay : ax;
    if (along0 < s.commit && other >= s.slop && other >= along0 * s.axisRatio) {
      axis = axis === 1 ? 0 : 1;
    }
  }

  const along = axis === 1 ? ax : ay;
  if (along <= 0 || along < s.commit) {
    return { axis, fire: null, consume: false };
  }

  if ((s.scheme ?? 1) === 2) {
    const spd = s.speed ?? 0;
    const need = s.speedMin ?? 0;
    if (spd < need) {
      return { axis, fire: null, consume: false };
    }
  }

  const dir: Dir = axis === 1 ? (s.dx > 0 ? 1 : 3) : s.dy > 0 ? 2 : 0;
  if (dir === s.lastDir && !s.sameDirRepeat) {
    return { axis, fire: null, consume: true };
  }
  return { axis, fire: dir, consume: true };
}

export function shouldInvalidOnLift(opts: {
  lastDir: Dir | null;
  dist: number;
  slop: number;
  commit: number;
}): boolean {
  return opts.lastDir === null && opts.dist >= opts.slop && opts.dist < opts.commit;
}
