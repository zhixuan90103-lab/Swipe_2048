/**
 * 手势判定入口。手感1 / 手感2 各一份实现：
 * `swipeFeel1.ts` 距离出手 · `swipeFeel2.ts` 甩动。
 */
import type { Dir } from './board';
import { evaluateFeel1, type Feel1Input } from './swipeFeel1';
import { evaluateFeel2, type Feel2Input } from './swipeFeel2';
import type { Axis, SegmentDecision } from './swipeAxis';

export type { Axis, SegmentDecision } from './swipeAxis';
export {
  DIAGONAL_FORK_RATIO,
  dirFromDelta,
  shouldInvalidOnLift,
  shouldLatchSlowDrag,
} from './swipeAxis';
export { evaluateFeel1 } from './swipeFeel1';
export { evaluateFeel2 } from './swipeFeel2';

/** 测试与旧接线用的并集。运行时按 scheme 分到两套函数。 */
export type SegmentInput = {
  dx: number;
  dy: number;
  axis: Axis | null;
  lastDir: Dir | null;
  slop: number;
  commit: number;
  axisRatio: number;
  sameDirRepeat: boolean;
  scheme?: 1 | 2;
  speed?: number;
  speedMin?: number;
  speedX?: number;
  speedY?: number;
  legal?: (dir: Dir) => boolean;
  slowDrag?: boolean;
};

export function evaluateSegment(s: SegmentInput): SegmentDecision {
  if (s.scheme === 2) {
    const input: Feel2Input = {
      dx: s.dx,
      dy: s.dy,
      axis: s.axis,
      lastDir: s.lastDir,
      slop: s.slop,
      commit: s.commit,
      axisRatio: s.axisRatio,
      speed: s.speed ?? 0,
      speedMin: s.speedMin ?? 0,
      speedX: s.speedX ?? 0,
      speedY: s.speedY ?? 0,
      legal: s.legal,
      slowDrag: Boolean(s.slowDrag),
    };
    return evaluateFeel2(input);
  }
  const input: Feel1Input = {
    dx: s.dx,
    dy: s.dy,
    axis: s.axis,
    lastDir: s.lastDir,
    slop: s.slop,
    commit: s.commit,
    axisRatio: s.axisRatio,
    sameDirRepeat: s.sameDirRepeat,
  };
  return evaluateFeel1(input);
}
