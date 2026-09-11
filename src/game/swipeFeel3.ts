import type { Dir } from './board';
import { axisOf, type SegmentDecision } from './swipeAxis';

/** 手感3：贪吃蛇按住四向。扇区切向 + 滞回，不用轴比锁轴。 */
export type Feel3Input = {
  dx: number;
  dy: number;
  lastDir: Dir | null;
  slop: number;
  hystDeg: number;
  /** 短窗位移，够长则优先于整段 */
  winDx?: number;
  winDy?: number;
};

export function snapCardinal(dx: number, dy: number): Dir {
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (deg >= -45 && deg < 45) return 1;
  if (deg >= 45 && deg < 135) return 2;
  if (deg >= 135 || deg < -135) return 3;
  return 0;
}

function dirDeg(d: Dir): number {
  return d === 1 ? 0 : d === 2 ? 90 : d === 3 ? 180 : -90;
}

function angAbsDiff(a: number, b: number): number {
  let d = a - b;
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return Math.abs(d);
}

export function evaluateFeel3(s: Feel3Input): SegmentDecision {
  const winDist = Math.hypot(s.winDx ?? 0, s.winDy ?? 0);
  const useWin = winDist >= s.slop;
  const vx = useWin ? (s.winDx ?? 0) : s.dx;
  const vy = useWin ? (s.winDy ?? 0) : s.dy;
  const dist = Math.hypot(vx, vy);
  if (dist < s.slop) {
    return { axis: null, fire: null, consume: false };
  }

  const nearest = snapCardinal(vx, vy);
  if (s.lastDir != null) {
    const a = (Math.atan2(vy, vx) * 180) / Math.PI;
    if (angAbsDiff(a, dirDeg(s.lastDir)) < 45 + s.hystDeg) {
      return { axis: axisOf(s.lastDir), fire: null, consume: false };
    }
  }
  if (nearest === s.lastDir) {
    return { axis: axisOf(nearest), fire: null, consume: false };
  }
  return { axis: axisOf(nearest), fire: nearest, consume: true };
}
