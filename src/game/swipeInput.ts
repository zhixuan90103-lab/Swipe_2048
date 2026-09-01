/**
 * Incremental pan: consume a segment then reset origin (setTranslation(0)).
 * Per-segment axis lock at slop (WWDC hysteresis): end-of-stroke drift
 * cannot flip H/V. Diagonal until clear → no snap. pointercancel does not
 * end the hold.
 */

import { DESIGN_WIDTH } from '../adapt/design';
import type { Dir } from './board';
import { FEEL_DEFAULT, type Feel } from './feel';

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

function dirFromDelta(dx: number, dy: number, axisRatio: number): Dir | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const major = Math.max(ax, ay);
  const minor = Math.min(ax, ay);
  if (major < minor * axisRatio) return null;
  return ax > ay ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
}

function isChrome(el: EventTarget | null): boolean {
  return (
    el instanceof Element &&
    !!el.closest('button, a, input, #device-switcher, #feel-panel')
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
  /** 0 = 竖轴, 1 = 横轴；本段未看清前为 null */
  let axis: 0 | 1 | null = null;
  let retryTimer = 0;
  let notedDiag = false;

  const scalePx = (designPx: number) => {
    const w = target.getBoundingClientRect().width;
    const s = w > 0 ? w / DESIGN_WIDTH : 1;
    return designPx * s;
  };

  const consumeSegment = () => {
    segX = lastX;
    segY = lastY;
    axis = null;
    notedDiag = false;
  };

  const armRetry = (ms: number) => {
    window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(() => {
      if (holding) commitIfReady();
    }, ms);
  };

  const grab = (e: PointerEvent, fresh: boolean) => {
    pid = e.pointerId;
    lastX = e.clientX;
    lastY = e.clientY;
    if (fresh || !holding) {
      segX = lastX;
      segY = lastY;
      lastDir = null;
      axis = null;
      notedDiag = false;
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

  const commitIfReady = () => {
    if (!holding || isBlocked?.()) return;
    const feel = feelOf();
    const slop = scalePx(feel.slopPx);
    const commit = scalePx(feel.commitPx);
    const dx = lastX - segX;
    const dy = lastY - segY;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const dist = Math.max(ax, ay);

    if (axis === null) {
      if (dist < slop) return;
      const guess = dirFromDelta(dx, dy, feel.axisRatio);
      if (guess === null) {
        if (dist >= commit) {
          if (!notedDiag) {
            notedDiag = true;
            onInvalid?.();
          }
          consumeSegment();
        }
        return;
      }
      axis = guess === 1 || guess === 3 ? 1 : 0;
    } else {
      const along = axis === 1 ? ax : ay;
      const other = axis === 1 ? ay : ax;
      if (along < commit && other >= slop && other >= along * feel.axisRatio) {
        axis = axis === 1 ? 0 : 1;
      }
    }

    const along = axis === 1 ? ax : ay;
    if (along < commit) return;

    const dir: Dir = axis === 1 ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
    if (dir === lastDir && !feel.sameDirRepeat) {
      consumeSegment();
      return;
    }

    lastDir = dir;
    consumeSegment();
    onMove(dir);
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
    commitIfReady();
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

    if (!isBlocked?.()) {
      const feel = feelOf();
      const dist = Math.max(Math.abs(lastX - segX), Math.abs(lastY - segY));
      if (lastDir === null && dist >= scalePx(feel.slopPx) && dist < scalePx(feel.commitPx)) {
        onInvalid?.();
      } else {
        commitIfReady();
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
