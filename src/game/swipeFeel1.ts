import type { Dir } from './board';
import {
  dirAlongAxis,
  resolveAxis,
  type Axis,
  type SegmentDecision,
} from './swipeAxis';

/** 手感1：距离出手。涂色默认。 */
export type Feel1Input = {
  dx: number;
  dy: number;
  axis: Axis | null;
  lastDir: Dir | null;
  slop: number;
  commit: number;
  axisRatio: number;
  sameDirRepeat: boolean;
};

export function evaluateFeel1(s: Feel1Input): SegmentDecision {
  const ax = Math.abs(s.dx);
  const ay = Math.abs(s.dy);
  const axis = resolveAxis(s);
  if (axis === null) {
    return { axis: null, fire: null, consume: false };
  }

  const along = axis === 1 ? ax : ay;
  if (along <= 0 || along < s.commit) {
    return { axis, fire: null, consume: false };
  }

  const dir = dirAlongAxis(s.dx, s.dy, axis);
  if (dir === s.lastDir && !s.sameDirRepeat) {
    return { axis, fire: null, consume: true };
  }
  return { axis, fire: dir, consume: true };
}
