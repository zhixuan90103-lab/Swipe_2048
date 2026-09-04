/**
 * Event layer: Pointer → evaluateSegment.
 * Spec: docs/SWIPE-DESIGN.md · docs/FEEL-LOOP.md
 */

import { DESIGN_WIDTH } from '../adapt/design';
import type { Dir } from './board';
import { FEEL1_DEFAULT, type Feel } from './feel';
import { evaluateFeel1 } from './swipeFeel1';
import { evaluateFeel2 } from './swipeFeel2';
import {
  shouldInvalidOnLift,
  shouldLatchSlowDrag,
  type Axis,
  type SegmentDecision,
} from './swipeAxis';
import { alongSpeed, createVelocityWindow, liftTailMs } from './swipeVelocity';

export type SwipeInputOptions = {
  target: HTMLElement;
  getFeel?: () => Feel;
  isBlocked?: () => boolean;
  onMove: (dir: Dir) => void;
  onInvalid?: (dir: Dir) => void;
  /** 2048：该向盘面是否能动。不传则不做 40°–45° 斜滑分叉。 */
  getLegal?: () => ((dir: Dir) => boolean) | undefined;
  /** 本按下已走棋且尚未抬手时进后台：撤回盘面 */
  onBackgroundAbort?: () => void;
  /** 正常抬手，本按下的走棋生效 */
  onGestureCommit?: () => void;
};

export type SwipeHandle = {
  dispose: () => void;
  onMoveSettled: () => void;
  isHolding: () => boolean;
};

function isChrome(el: EventTarget | null): boolean {
  return (
    el instanceof Element &&
    !!el.closest('button, a, input, #device-switcher, #feel-panel, #g-title')
  );
}

export function attachSwipeInput(opts: SwipeInputOptions): SwipeHandle {
  const { target, onMove, onInvalid, isBlocked, onBackgroundAbort, onGestureCommit, getLegal } =
    opts;
  let firedThisHold = false;
  const feelOf = () => opts.getFeel?.() ?? FEEL1_DEFAULT;
  let pid: number | null = null;
  let holding = false;
  let segX = 0;
  let segY = 0;
  let lastX = 0;
  let lastY = 0;
  let lastDir: Dir | null = null;
  let axis: Axis | null = null;
  let retryTimer = 0;
  let commitTimer = 0;
  let lastFireAt = 0;
  let holdStart = 0;
  let ignoreFire = false;
  let slowDrag = false;
  /** busy 期间已抬手、本段还没走棋：settle 后立刻判定，不清段 */
  let liftQueued = false;
  const vel = createVelocityWindow();
  const BG_GUARD_MS = 800;

  const cssPx = (name: string, fallback: number) => {
    const n = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  /** 顶/底安全区起手：整次按下不走棋，避免和系统手势叠在一起。 */
  const inSystemEdge = (clientY: number) => {
    const top = cssPx('--safe-top', 59) + 4;
    const bottom = cssPx('--safe-bottom', 34) + 4;
    return clientY < top || clientY > window.innerHeight - bottom;
  };

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
    if (d.dead != null) {
      consumeSegment();
      lastDir = d.dead;
      if (!ignoreFire) onInvalid?.(d.dead);
      return;
    }
    if (d.consume) {
      consumeSegment();
      if (d.fire !== null) {
        lastDir = d.fire;
        if (ignoreFire) return;
        firedThisHold = true;
        lastFireAt = performance.now();
        onMove(d.fire);
      }
      return;
    }
    axis = d.axis;
  };

  const tryCommit = (fromLift = false) => {
    if (ignoreFire) return;
    if (isBlocked?.()) return;
    if (!fromLift && !holding) return;
    const feel = feelOf();
    const dx = lastX - segX;
    const dy = lastY - segY;
    const slop = scalePx(feel.slopPx);
    const commit = scalePx(feel.commitPx);
    const axisRatio = feel.axisRatio;

    if (feel.scheme === 2) {
      const lock: Axis = axis ?? (Math.abs(dx) > Math.abs(dy) ? 1 : 0);
      const now = performance.now();
      const spd = vel.axisSpeed(now, fromLift ? liftTailMs(now - holdStart) : 0);
      const speed = alongSpeed(spd, lock);
      const speedMin = scalePx(feel.speedPxS);
      if (!fromLift && !slowDrag) {
        const along = Math.max(Math.abs(dx), Math.abs(dy));
        if (shouldLatchSlowDrag(along, speed, commit, speedMin)) slowDrag = true;
      }
      applyDecision(
        evaluateFeel2({
          dx,
          dy,
          axis,
          lastDir,
          slop,
          commit,
          axisRatio,
          speed,
          speedMin,
          speedX: Math.abs(spd.x),
          speedY: Math.abs(spd.y),
          legal: getLegal?.(),
          slowDrag,
        }),
      );
      return;
    }

    applyDecision(
      evaluateFeel1({
        dx,
        dy,
        axis,
        lastDir,
        slop,
        commit,
        axisRatio,
        sameDirRepeat: feel.sameDirRepeat,
      }),
    );
  };

  const commitOnLift = () => {
    if (ignoreFire) return;
    const feel = feelOf();
    const slop = scalePx(feel.slopPx);
    const commit = scalePx(feel.commitPx);
    const dist = Math.max(Math.abs(lastX - segX), Math.abs(lastY - segY));
    if (shouldInvalidOnLift({ lastDir, dist, slop, commit })) {
      const dx = lastX - segX;
      const dy = lastY - segY;
      const dir: Dir =
        Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 1 : 3) : dy >= 0 ? 2 : 0;
      onInvalid?.(dir);
    } else {
      tryCommit(true);
    }
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
      window.clearTimeout(commitTimer);
      if (firedThisHold) onGestureCommit?.();
      segX = lastX;
      segY = lastY;
      lastDir = null;
      axis = null;
      firedThisHold = false;
      slowDrag = false;
      liftQueued = false;
      holdStart = performance.now();
      ignoreFire = inSystemEdge(lastY);
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
    if (liftQueued) {
      liftQueued = false;
      commitOnLift();
      return;
    }
    if (holding && lastDir === null) {
      tryCommit();
      return;
    }
    consumeSegment();
    if (holding) armRetry(feelOf().rearmMs);
  };

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (isChrome(e.target)) return;
    e.preventDefault();
    grab(e, true);
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
    window.clearTimeout(retryTimer);

    if (fromCancel) {
      pid = null;
      return;
    }

    if (isBlocked?.()) {
      if (lastDir === null && !firedThisHold) liftQueued = true;
    } else {
      commitOnLift();
    }
    holding = false;
    pid = null;
    lastDir = null;
    window.clearTimeout(commitTimer);
    commitTimer = window.setTimeout(() => {
      firedThisHold = false;
      onGestureCommit?.();
    }, BG_GUARD_MS);
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

  const dropHoldForBackground = (force = false) => {
    if (!force && document.visibilityState === 'visible') return;
    const recent = firedThisHold && (holding || performance.now() - lastFireAt < BG_GUARD_MS);
    holding = false;
    pid = null;
    lastDir = null;
    firedThisHold = false;
    window.clearTimeout(retryTimer);
    window.clearTimeout(commitTimer);
    if (recent) onBackgroundAbort?.();
    else onGestureCommit?.();
  };

  const onVis = () => {
    if (document.visibilityState === 'hidden') dropHoldForBackground();
  };

  const onPageHide = () => dropHoldForBackground(true);
  const onBlur = () => dropHoldForBackground(true);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('blur', onBlur);
  document.addEventListener('freeze', onPageHide);

  return {
    onMoveSettled,
    isHolding: () => holding,
    dispose: () => {
      window.clearTimeout(retryTimer);
      window.clearTimeout(commitTimer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('freeze', onPageHide);
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
