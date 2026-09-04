import type { Dir } from './board';

export type Axis = 0 | 1; // 0 竖 1 横

/** 未锁轴斜滑分叉：偏角 ≥ 40°（副/主 ≥ tan40°）。小于此仍等锁轴，不改判。 */
export const DIAGONAL_FORK_RATIO = Math.tan((40 * Math.PI) / 180);

export type SegmentDecision = {
  axis: Axis | null;
  fire: Dir | null;
  consume: boolean;
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

export function axisOf(dir: Dir): Axis {
  return dir === 1 || dir === 3 ? 1 : 0;
}

export function shouldInvalidOnLift(opts: {
  lastDir: Dir | null;
  dist: number;
  slop: number;
  commit: number;
}): boolean {
  return opts.lastDir === null && opts.dist >= opts.slop && opts.dist < opts.commit;
}

/** 沿轴已达出手距离、窗速度仍低于门槛 → 本按下锁成慢滑。 */
export function shouldLatchSlowDrag(
  along: number,
  speed: number,
  commit: number,
  speedMin: number,
): boolean {
  return along >= commit && speed < speedMin;
}

export type AxisLockInput = {
  dx: number;
  dy: number;
  axis: Axis | null;
  slop: number;
  commit: number;
  axisRatio: number;
};

/** 段内锁轴 / 出手前 relock。太斜返回 axis null（未锁）。 */
export function resolveAxis(s: AxisLockInput): Axis | null {
  const ax = Math.abs(s.dx);
  const ay = Math.abs(s.dy);
  const dist = Math.max(ax, ay);
  let axis = s.axis;

  if (axis === null) {
    if (dist < s.slop) return null;
    const guess = dirFromDelta(s.dx, s.dy, s.axisRatio);
    if (guess === null) return null;
    return axisOf(guess);
  }

  const along0 = axis === 1 ? ax : ay;
  const other = axis === 1 ? ay : ax;
  if (along0 < s.commit && other >= s.slop && other >= along0 * s.axisRatio) {
    return axis === 1 ? 0 : 1;
  }
  return axis;
}

export function dirAlongAxis(dx: number, dy: number, axis: Axis): Dir {
  return axis === 1 ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
}
