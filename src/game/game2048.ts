import { applyMove, canMove, newGame, type BoardState, type Dir } from './board';
import {
  applyFeelCss,
  loadFeelFor,
  saveFeelFor,
  SLIDE_EASE_CSS,
  type Feel,
} from './feel';
import { mountFeelPanel } from './feelPanel';
import { attachSwipeInput, type SwipeHandle } from './swipeInput';
import { maxTravelCells, parseTransformXY } from './motion';
import { gameSfx } from '../utils/gameSfx';
import { gameHaptics } from '../utils/gameHaptics';
import { nudgeBoard, paintBoard, slideDurationMs, type PaintAnim } from './view';
import {
  AMAZE_GAP,
  applySlide,
  cloneAmaze,
  dirsArePerpendicular,
  flightPivotIndex,
  getAmazeCell,
  getAmazeMoveMs,
  moveAmaze,
  newAmazeRun,
  nextAmaze,
  retryAmaze,
  slideAmaze,
  type AmazeState,
} from './amaze';
import { amazeCellPx, mountAmaze, paintAmaze } from './amazeView';
import { bindOverlay, OVERLAY_HTML } from './overlay';

type Mode = 'merge' | 'solo';

const BEST_KEY = 'swipe2048.best';
const SOLO_BEST_KEY = 'swipe2048.solo.best';

export type Game2048Handle = {
  dispose: () => void;
};

export function startGame2048(opts: {
  stage: HTMLElement;
  uiRoot: HTMLElement;
}): Game2048Handle {
  const { stage, uiRoot } = opts;

  uiRoot.innerHTML = `
    <div class="g2048">
      <header class="g-heading">
        <div class="g-logo" id="g-title">2048</div>
        <div class="g-heading-right">
          <div class="g-scores" id="g-scores">
            <div class="g-score">
              <span>分数</span>
              <strong id="g-score">0</strong>
            </div>
            <div class="g-score">
              <span>历史最高成绩</span>
              <strong id="g-best">0</strong>
            </div>
          </div>
          <div class="g-actions">
            <button type="button" id="g-new">菜单</button>
            <button type="button" id="g-settings">设置</button>
          </div>
        </div>
      </header>
      <p class="g-intro" id="g-intro">合并这些数字以得到2048方块！</p>
      <div class="g-board" id="g-board">
        <div class="g-grid"></div>
        <div class="g-tiles"></div>
      </div>
    </div>
    ${OVERLAY_HTML}
  `;

  const boardEl = uiRoot.querySelector('#g-board') as HTMLElement;
  const gridEl = boardEl.querySelector('.g-grid') as HTMLElement;
  const overlay = bindOverlay(uiRoot);
  const scoreEl = uiRoot.querySelector('#g-score') as HTMLElement;
  const bestEl = uiRoot.querySelector('#g-best') as HTMLElement;

  for (let i = 0; i < 16; i++) {
    const cell = document.createElement('div');
    cell.className = 'g-cell';
    gridEl.appendChild(cell);
  }

  const mazeEl = mountAmaze(boardEl.parentElement as HTMLElement);

  let mode: Mode = 'merge';
  let state: BoardState = newGame();
  let amaze: AmazeState = newAmazeRun();
  let feel: Feel = loadFeelFor('merge');
  let best = Number(localStorage.getItem(BEST_KEY) || '0');
  let soloBest = Number(localStorage.getItem(SOLO_BEST_KEY) || '0');
  let fxTimer = 0;
  let flight: {
    origin: AmazeState;
    from: { x: number; y: number };
    dir: Dir;
    path: { x: number; y: number }[];
    startedAt: number;
    msPerCell: number;
  } | null = null;
  let flightTimer = 0;
  let hopTimer = 0;
  let swipe: SwipeHandle;
  let pending:
    | { mode: 'merge'; state: BoardState; best: number }
    | { mode: 'solo'; amaze: AmazeState; best: number }
    | null = null;

  const titleEl = uiRoot.querySelector('#g-title') as HTMLElement;
  const introEl = uiRoot.querySelector('#g-intro') as HTMLElement;
  const settingsBtn = uiRoot.querySelector('#g-settings') as HTMLElement;

  const hud = () => {
    const isSolo = mode === 'solo';
    titleEl.textContent = isSolo ? '涂色' : '2048';
    titleEl.classList.toggle('g-logo-solo', isSolo);
    introEl.textContent = isSolo
      ? `第 ${amaze.level} 关 · ${amaze.moves} / ${amaze.par} 步`
      : '合并这些数字以得到2048方块！';
    if (isSolo) {
      scoreEl.textContent = String(amaze.score);
      if (amaze.score > soloBest) {
        soloBest = amaze.score;
        localStorage.setItem(SOLO_BEST_KEY, String(soloBest));
      }
      bestEl.textContent = String(soloBest);
      overlay.hide();
    } else {
      scoreEl.textContent = String(state.score);
      if (state.score > best) {
        best = state.score;
        localStorage.setItem(BEST_KEY, String(best));
      }
      bestEl.textContent = String(best);
      if (state.over) overlay.show(state.score, '没有可走的步了');
      else overlay.hide();
    }
  };

  const paintAnim = (): PaintAnim =>
    feel.scheme === 1
      ? { durationMs: feel.tileMoveMs, easing: 'linear', perCell: true }
      : {
          durationMs: feel.slideMs,
          easing: SLIDE_EASE_CSS[feel.slideEase],
          perCell: true,
          mergePopMs: feel.mergePopMs,
        };

  const scorePool: HTMLSpanElement[] = [];
  const floatScore = (delta: number) => {
    if (delta <= 0) return;
    const box = scoreEl.parentElement;
    if (!box) return;
    let el = scorePool.find((s) => s.dataset.busy !== '1');
    if (!el) {
      el = document.createElement('span');
      el.className = 'g-score-add';
      box.appendChild(el);
      scorePool.push(el);
      el.addEventListener('animationend', () => {
        el!.dataset.busy = '0';
        el!.style.visibility = 'hidden';
      });
    }
    el.dataset.busy = '1';
    el.textContent = `+${delta}`;
    el.style.visibility = 'visible';
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.removeProperty('animation');
  };

  const render = (animate: boolean) => {
    if (mode === 'solo') {
      boardEl.classList.add('hidden');
      mazeEl.classList.remove('hidden');
      paintAmaze(mazeEl, amaze, animate);
      hud();
      return;
    }
    mazeEl.classList.add('hidden');
    boardEl.classList.remove('hidden');
    paintBoard(boardEl, state, animate, paintAnim(), feel.boardScale);
    hud();
  };

  const playBoardSfx = (board: BoardState) => {
    const merges = board.tiles.filter((t) => t.mergedFrom);
    if (merges.length) {
      const t = merges.reduce((a, b) => (a.value >= b.value ? a : b));
      gameSfx.merge(t.value);
      gameHaptics.merge(t.value);
      return;
    }
    const cells = Math.max(1, maxTravelCells(board));
    gameSfx.slide(cells);
    gameHaptics.slide(cells);
  };

  const clearFlight = () => {
    flight = null;
    window.clearTimeout(flightTimer);
    window.clearTimeout(hopTimer);
  };

  const beginAmazeLeg = (
    origin: AmazeState,
    from: { x: number; y: number },
    dir: Dir,
    path: { x: number; y: number }[],
    fromPx: { x: number; y: number } | null,
    hopMs: number,
  ) => {
    window.clearTimeout(flightTimer);
    window.clearTimeout(hopTimer);
    flight = {
      origin,
      from,
      dir,
      path,
      startedAt: performance.now() + Math.max(0, hopMs),
      msPerCell: getAmazeMoveMs(),
    };
    const goDest = () => {
      if (flight) flight.startedAt = performance.now();
      const ms = paintAmaze(mazeEl, amaze, true);
      flightTimer = window.setTimeout(() => {
        flight = null;
      }, ms);
    };
    if (fromPx && hopMs > 12) {
      const hopState: AmazeState = {
        ...amaze,
        x: from.x,
        y: from.y,
        previous: { ...from },
      };
      paintAmaze(mazeEl, hopState, true, fromPx);
      hopTimer = window.setTimeout(goDest, hopMs);
    } else {
      goDest();
    }
  };

  const tryAmazeTurn = (dir: Dir): boolean => {
    if (!flight || !dirsArePerpendicular(flight.dir, dir)) return false;
    const elapsed = performance.now() - flight.startedAt;
    const idx = flightPivotIndex(elapsed, flight.msPerCell, flight.path.length);
    const pivot = idx < 0 ? flight.from : flight.path[idx]!;
    const prefix = idx < 0 ? [] : flight.path.slice(0, idx + 1);
    const atPivot = applySlide(cloneAmaze(flight.origin), flight.from, prefix);
    if (atPivot.won) {
      amaze = atPivot;
      clearFlight();
      paintAmaze(mazeEl, amaze, true);
      hud();
      gameSfx.win();
      gameHaptics.win(80);
      return true;
    }
    const sl = slideAmaze(atPivot, pivot.x, pivot.y, dir);
    if (!sl.moved) return true;
    const tile = mazeEl.querySelector('.maze-tile') as HTMLElement | null;
    const fromPx = tile ? parseTransformXY(getComputedStyle(tile).transform) : null;
    const beforePaint = atPivot.paintedCount;
    amaze = moveAmaze(atPivot, dir).state;
    const hop = fromPx ? amazeCellPx(pivot.x, pivot.y) : { x: 0, y: 0 };
    const hopDist = fromPx ? Math.hypot(fromPx.x - hop.x, fromPx.y - hop.y) : 0;
    const step = getAmazeCell() + AMAZE_GAP;
    const hopMs = step > 0 ? Math.round((hopDist / step) * getAmazeMoveMs()) : 0;
    mazeEl.classList.remove('g-nudge');
    beginAmazeLeg(cloneAmaze(atPivot), pivot, dir, sl.path, fromPx, hopMs);
    hud();
    floatScore(amaze.paintedCount - beforePaint);
    gameSfx.slide(Math.max(1, sl.cells));
    gameHaptics.slide(1);
    if (amaze.won) {
      gameSfx.win();
      gameHaptics.win(80);
    }
    return true;
  };

  const tryDir = (dir: Dir) => {
    if (mode === 'solo') {
      if (amaze.won) return;
      if (flight) {
        tryAmazeTurn(dir);
        return;
      }
      const origin = cloneAmaze(amaze);
      const sl = slideAmaze(amaze, amaze.x, amaze.y, dir);
      if (!sl.moved) {
        nudgeBoard(mazeEl, feel.nudgeMs, dir);
        gameSfx.nudge();
        gameHaptics.nudge(feel.nudgeMs);
        return;
      }
      if (swipe?.isHolding() && !pending) {
        pending = { mode: 'solo', amaze: origin, best: soloBest };
      }
      const played = moveAmaze(amaze, dir);
      amaze = played.state;
      mazeEl.classList.remove('g-nudge');
      beginAmazeLeg(origin, { x: origin.x, y: origin.y }, dir, sl.path, null, 0);
      hud();
      floatScore(played.scoreDelta);
      gameSfx.slide(Math.max(1, sl.cells));
      gameHaptics.slide(1);
      if (amaze.won) {
        gameSfx.win();
        gameHaptics.win(80);
      }
      return;
    }
    if (state.over) return;
    const wasWon = state.won;
    const { state: next, moved, scoreDelta } = applyMove(state, dir);
    if (!moved) {
      nudgeBoard(boardEl, feel.nudgeMs, dir);
      gameSfx.nudge();
      gameHaptics.nudge(feel.nudgeMs);
      return;
    }
    if (swipe?.isHolding() && !pending) {
      pending = { mode: 'merge', state, best };
    }
    state = next;
    boardEl.classList.remove('g-nudge');
    const anim = paintAnim();
    render(true);
    floatScore(scoreDelta);
    playBoardSfx(state);
    window.clearTimeout(fxTimer);
    if (state.won && !wasWon) {
      const travel = slideDurationMs(state, anim);
      fxTimer = window.setTimeout(() => gameSfx.win(), travel + 80);
      gameHaptics.win(travel + 80);
    }
    if (state.over) {
      gameSfx.over(1200);
      gameHaptics.over(1200);
    }
  };

  const reset = () => {
    window.clearTimeout(fxTimer);
    clearFlight();
    gameSfx.clearPending();
    gameHaptics.clearPending();
    overlay.hide();
    if (mode === 'solo') amaze = newAmazeRun();
    else state = newGame();
    render(false);
  };

  const setMode = (next: Mode) => {
    if (next === mode) return;
    saveFeelFor(mode, feel);
    mode = next;
    panel.set(loadFeelFor(mode), mode);
    reset();
  };

  titleEl.addEventListener('click', () => {
    gameSfx.ui();
    gameHaptics.ui();
    setMode(mode === 'solo' ? 'merge' : 'solo');
  });

  uiRoot.querySelector('#g-new')!.addEventListener('click', () => {
    gameSfx.ui();
    gameHaptics.ui();
    reset();
  });
  uiRoot.querySelector('#g-retry')!.addEventListener('click', () => {
    gameSfx.ui();
    gameHaptics.ui();
    reset();
  });
  mazeEl.querySelector('.maze-retry')!.addEventListener('click', () => {
    gameSfx.ui();
    gameHaptics.ui();
    clearFlight();
    amaze = amaze.won ? nextAmaze(amaze) : retryAmaze(amaze);
    render(false);
  });

  applyFeelCss(feel);
  render(false);

  const panel = mountFeelPanel(
    uiRoot,
    (next) => {
      feel = next;
      saveFeelFor(mode, next);
      render(false);
    },
    feel,
    mode,
    () => {
      render(false);
    },
  );

  settingsBtn.addEventListener('click', () => {
    gameSfx.ui();
    gameHaptics.ui();
    panel.toggle();
  });

  swipe = attachSwipeInput({
    target: stage,
    getFeel: () => feel,
    isBlocked: () => (mode === 'merge' && state.over) || (mode === 'solo' && amaze.won),
    onMove: tryDir,
    getLegal: () => (mode === 'merge' ? (dir: Dir) => canMove(state, dir) : undefined),
    onInvalid: (dir) => {
      nudgeBoard(mode === 'solo' ? mazeEl : boardEl, feel.nudgeMs, dir);
      gameSfx.nudge();
      gameHaptics.nudge(feel.nudgeMs);
    },
    onGestureCommit: () => {
      pending = null;
    },
    onBackgroundAbort: () => {
      if (!pending) return;
      window.clearTimeout(fxTimer);
      if (pending.mode === 'solo') {
        amaze = pending.amaze;
        soloBest = pending.best;
        localStorage.setItem(SOLO_BEST_KEY, String(soloBest));
      }
      else {
        state = pending.state;
        best = pending.best;
        localStorage.setItem(BEST_KEY, String(best));
      }
      pending = null;
      clearFlight();
      gameSfx.clearPending();
      gameHaptics.clearPending();
      render(false);
    },
  });

  return {
    dispose: () => {
      window.clearTimeout(fxTimer);
      clearFlight();
      gameSfx.clearPending();
      gameHaptics.clearPending();
      panel.dispose();
      swipe.dispose();
    },
  };
}
