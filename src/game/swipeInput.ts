/**
 * Event layer: Pointer → evaluateSegment. Spec: docs/SWIPE-DESIGN.md
 */

import { DESIGN_WIDTH } from '../adapt/design';
import type { Dir } from './board';
import { FEEL_DEFAULT, type Feel } from './feel';
import {
  evaluateSegment,
  shouldInvalidOnLift,
  type Axis,
  type SegmentDecision,
} from './swipeSegment';
import { alongSpeed, createVelocityWindow } from './swipeVelocity';

export type SwipeInputOptions = {
  target: HTMLElement;
  getFeel?: () => Feel;
  isBlocked?: () => boolean;
  onMove: (dir: Dir) => void;
  onInvalid?: () => void;
};

export type SwipeHandle = {
  dispose: () => void;
  onMoveSettled: () => void;
};

function isChrome(el: EventTarget | null): boolean {
  return (
    el instanceof Element &&
    !!el.closest('button, a, input, #device-switcher, #feel-panel, #g-title')
  );
}

export function attachSwipeInput(opts: SwipeInputOptions): SwipeHandle {
  const { target, onMove, onInvalid, isBlocked } = opts;
  const feelOf = () => opts.getFeel?.() ?? FEEL_DEFAULT;
  let pid: number | null = null;
  let holding = false;
  let segX = 0;
  let segY = 0;
  let lastX = 0;
  let lastY = 0;
  let lastDir: Dir | null = null;
  let axis: Axis | null = null;
  let retryTimer = 0;
  const vel = createVelocityWindow();

  const scalePx = (designPx: number) => {
    const w = target.getBoundingClientRect().width;
    const s = w > 0 ? w / DESIGN_WIDTH : 1;
    return designPx * s;
  };

  const consumeSegment = () => {
    segX = lastX;
    segY = lastY;
    axis = null;
    vel.reset(performance.now(), lastX, lastY);
  };

  const applyDecision = (d: SegmentDecision) => {
    if (d.consume) {
      consumeSegment();
      if (d.fire !== null) {
        lastDir = d.fire;
        onMove(d.fire);
      }
      return;
    }
    axis = d.axis;
  };

  const scaledInput = () => {
    const feel = feelOf();
    const dx = lastX - segX;
    const dy = lastY - segY;
    const lock: Axis = axis ?? (Math.abs(dx) > Math.abs(dy) ? 1 : 0);
    return {
      dx,
      dy,
      axis,
      lastDir,
      slop: scalePx(feel.slopPx),
      commit: scalePx(feel.commitPx),
      axisRatio: feel.axisRatio,
      sameDirRepeat: feel.sameDirRepeat,
      scheme: feel.scheme,
      speed: alongSpeed(vel.axisSpeed(), lock),
      speedMin: scalePx(feel.speedPxS),
    };
  };

  const tryCommit = () => {
    if (!holding || isBlocked?.()) return;
    applyDecision(evaluateSegment(scaledInput()));
  };

  const armRetry = (ms: number) => {
    window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(() => {
      if (holding) tryCommit();
    }, ms);
  };

  const grab = (e: PointerEvent, fresh: boolean) => {
    pid = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    vel.reset(performance.now(), lastX, lastY);
    if (fresh || !holding) {
      segX = lastX;
      segY = lastY;
      lastDir = null;
      axis = null;
    } else {
      consumeSegment();
    }
    holding = true;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onMoveSettled = () => {
    consumeSegment();
    if (holding) armRetry(feelOf().rearmMs);
  };

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (isChrome(e.target)) return;
    e.preventDefault();
    grab(e, !holding);
    target.focus({ preventScroll: true });
  };

  const onMovePtr = (e: PointerEvent) => {
    if (!holding) return;
    if (pid === null || e.pointerId !== pid) grab(e, false);
    lastX = e.clientX;
    lastY = e.clientY;
    vel.push(performance.now(), lastX, lastY);
    tryCommit();
  };

  const endHold = (e: PointerEvent, fromCancel: boolean) => {
    if (!holding) return;
    if (pid !== null && e.pointerId !== pid && !fromCancel) return;
    lastX = e.clientX;
    lastY = e.clientY;
    vel.push(performance.now(), lastX, lastY);
    window.clearTimeout(retryTimer);

    if (fromCancel) {
      pid = null;
      return;
    }

    if (!isBlocked?.()) {
      const feel = feelOf();
      const slop = scalePx(feel.slopPx);
      const commit = scalePx(feel.commitPx);
      const dist = Math.max(Math.abs(lastX - segX), Math.abs(lastY - segY));
      if (shouldInvalidOnLift({ lastDir, dist, slop, commit })) {
        onInvalid?.();
      } else {
        tryCommit();
      }
    }
    holding = false;
    pid = null;
    lastDir = null;
  };

  const onUp = (e: PointerEvent) => endHold(e, false);
  const onCancel = (e: PointerEvent) => endHold(e, true);

  const onLostCapture = (e: PointerEvent) => {
    if (e.pointerId !== pid || !holding) return;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onTouchGuard = (e: TouchEvent) => {
    if (!holding) return;
    if (e.cancelable) e.preventDefault();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (isBlocked?.()) return;
    const map: Record<string, Dir> = {
      ArrowUp: 0,
      ArrowRight: 1,
      ArrowDown: 2,
      ArrowLeft: 3,
      w: 0,
      d: 1,
      s: 2,
      a: 3,
      W: 0,
      D: 1,
      S: 2,
      A: 3,
    };
    const dir = map[e.key];
    if (dir === undefined) return;
    e.preventDefault();
    onMove(dir);
  };

  const peOpts: AddEventListenerOptions = { capture: true, passive: false };
  target.tabIndex = 0;
  window.addEventListener('pointerdown', onDown, peOpts);
  window.addEventListener('pointermove', onMovePtr, peOpts);
  window.addEventListener('pointerup', onUp, peOpts);
  window.addEventListener('pointercancel', onCancel, peOpts);
  target.addEventListener('lostpointercapture', onLostCapture);
  window.addEventListener('touchstart', onTouchGuard, peOpts);
  window.addEventListener('touchmove', onTouchGuard, peOpts);
  window.addEventListener('keydown', onKey, true);

  return {
    onMoveSettled,
    dispose: () => {
      window.clearTimeout(retryTimer);
      window.removeEventListener('pointerdown', onDown, peOpts);
      window.removeEventListener('pointermove', onMovePtr, peOpts);
      window.removeEventListener('pointerup', onUp, peOpts);
      window.removeEventListener('pointercancel', onCancel, peOpts);
      target.removeEventListener('lostpointercapture', onLostCapture);
      window.removeEventListener('touchstart', onTouchGuard, peOpts);
      window.removeEventListener('touchmove', onTouchGuard, peOpts);
      window.removeEventListener('keydown', onKey, true);
    },
  };
}
