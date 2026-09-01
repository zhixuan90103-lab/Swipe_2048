import type { Dir } from './board';

export type Axis = 0 | 1; // 0 竖 1 横

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
};

export type SegmentDecision = {
  axis: Axis | null;
  fire: Dir | null;
  consume: boolean;
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

export function evaluateSegment(s: SegmentInput): SegmentDecision {
  if ((s.scheme ?? 1) === 2 && s.lastDir !== null) {
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
      return { axis: null, fire: null, consume: false };
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
