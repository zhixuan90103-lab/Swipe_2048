import type { Dir } from './board';
import {
  DIAGONAL_FORK_RATIO,
  axisOf,
  dirAlongAxis,
  resolveAxis,
  type Axis,
  type SegmentDecision,
} from './swipeAxis';

/** 手感2：甩动。2048 默认。每次按下只一步；慢滑锁死后本按下不再出手。 */
export type Feel2Input = {
  dx: number;
  dy: number;
  axis: Axis | null;
  lastDir: Dir | null;
  slop: number;
  commit: number;
  axisRatio: number;
  speed: number;
  speedMin: number;
  speedX: number;
  speedY: number;
  legal?: (dir: Dir) => boolean;
  slowDrag: boolean;
};

function dirReady(s: Feel2Input, dir: Dir): boolean {
  if (!s.legal?.(dir)) return false;
  const spd = dir === 1 || dir === 3 ? s.speedX : s.speedY;
  return spd >= s.speedMin;
}

/** 未锁轴且两轴都够 commit、偏角 ≥ 40°：只走「唯一能走的那一向」。 */
function diagonalFork(s: Feel2Input): SegmentDecision | null {
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
    if (dir === s.lastDir) {
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

export function evaluateFeel2(s: Feel2Input): SegmentDecision {
  if (s.lastDir !== null || s.slowDrag) {
    return { axis: s.axis, fire: null, consume: false };
  }

  const ax = Math.abs(s.dx);
  const ay = Math.abs(s.dy);
  let axis = resolveAxis(s);
  if (axis === null) {
    return diagonalFork(s) ?? { axis: null, fire: null, consume: false };
  }

  const along = axis === 1 ? ax : ay;
  if (along <= 0 || along < s.commit) {
    return { axis, fire: null, consume: false };
  }

  if (s.speed < s.speedMin) {
    return { axis, fire: null, consume: false };
  }

  const dir = dirAlongAxis(s.dx, s.dy, axis);
  return { axis, fire: dir, consume: true };
}
