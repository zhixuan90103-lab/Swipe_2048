import { applyMove, newGame, type BoardState, type Dir } from './board';
import {
  applyFeelCss,
  loadFeelFor,
  saveFeelFor,
  SLIDE_EASE_CSS,
  type Feel,
} from './feel';
import { mountFeelPanel } from './feelPanel';
import { attachSwipeInput, type SwipeHandle } from './swipeInput';
import { maxTravelCells } from './motion';
import { gameSfx } from '../utils/gameSfx';
import { gameHaptics } from '../utils/gameHaptics';
import { nudgeBoard, paintBoard, slideDurationMs, type PaintAnim } from './view';
import {
  cloneAmaze,
  moveAmaze,
  newAmazeRun,
  retryAmaze,
  type AmazeState,
} from './amaze';
import { mountAmaze, paintAmaze } from './amazeView';

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
    <div class="g-overlay hidden" id="g-overlay">
      <div class="g-over-top">
        <p class="g-over-score-label">本局分数</p>
        <p class="g-over-score" id="g-over-score">0</p>
        <p class="g-over-msg" id="g-over-msg">没有可走的步了</p>
      </div>
      <div class="g-over-bottom">
        <button type="button" id="g-retry">再来</button>
      </div>
    </div>
  `;

  const boardEl = uiRoot.querySelector('#g-board') as HTMLElement;
  const gridEl = boardEl.querySelector('.g-grid') as HTMLElement;
  const overlay = uiRoot.querySelector('#g-overlay') as HTMLElement;
  const overMsg = uiRoot.querySelector('#g-over-msg') as HTMLElement;
  const overScore = uiRoot.querySelector('#g-over-score') as HTMLElement;
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
  let busy = false;
  let feel: Feel = loadFeelFor('merge');
  let best = Number(localStorage.getItem(BEST_KEY) || '0');
  let soloBest = Number(localStorage.getItem(SOLO_BEST_KEY) || '0');
  let lockTimer = 0;
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
      ? `第 ${amaze.level} 关 · 滑到边，躲开带 X 的格子`
      : '合并这些数字以得到2048方块！';
    if (isSolo) {
      scoreEl.textContent = String(amaze.score);
      if (amaze.score > soloBest) {
        soloBest = amaze.score;
        localStorage.setItem(SOLO_BEST_KEY, String(soloBest));
      }
      bestEl.textContent = String(soloBest);
      overlay.classList.add('hidden');
      overlay.classList.remove('g-overlay-in');
    } else {
      scoreEl.textContent = String(state.score);
      if (state.score > best) {
        best = state.score;
        localStorage.setItem(BEST_KEY, String(best));
      }
      bestEl.textContent = String(best);
      if (state.over) {
        overScore.textContent = String(state.score);
        overMsg.textContent = '没有可走的步了';
        overlay.classList.remove('hidden');
        overlay.classList.add('g-overlay-in');
      } else if (state.won) {
        overMsg.textContent = '到 2048 了，还可继续';
        overlay.classList.add('hidden');
        overlay.classList.remove('g-overlay-in');
      } else {
        overlay.classList.add('hidden');
        overlay.classList.remove('g-overlay-in');
      }
    }
  };

  const paintAnim = (): PaintAnim =>
    mode === 'solo'
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

  const tryDir = (dir: Dir) => {
    if (busy) return;
    if (mode === 'solo') {
      const { state: next, moved, scoreDelta } = moveAmaze(amaze, dir);
      if (!moved) {
        nudgeBoard(mazeEl, feel.nudgeMs, dir);
        gameSfx.nudge();
        gameHaptics.nudge(feel.nudgeMs);
        return;
      }
      if (swipe?.isHolding() && !pending) {
        pending = { mode: 'solo', amaze: cloneAmaze(amaze), best: soloBest };
      }
      amaze = next;
      busy = true;
      const travel = paintAmaze(mazeEl, amaze, true);
      hud();
      floatScore(scoreDelta);
      gameSfx.slide(Math.max(1, Math.abs((amaze.previous?.x ?? amaze.x) - amaze.x) + Math.abs((amaze.previous?.y ?? amaze.y) - amaze.y)));
      gameHaptics.slide(1);
      window.clearTimeout(lockTimer);
      lockTimer = window.setTimeout(() => {
        busy = false;
        swipe.onMoveSettled();
      }, travel + feel.inputLockMs);
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
    busy = true;
    const anim = paintAnim();
    render(true);
    floatScore(scoreDelta);
    playBoardSfx(state);
    if (state.won && !wasWon) {
      const travel = slideDurationMs(state, anim);
      window.setTimeout(() => gameSfx.win(), travel + 80);
      gameHaptics.win(travel + 80);
    }
    if (state.over) {
      gameSfx.over(1200);
      gameHaptics.over(1200);
    }
    const travel = slideDurationMs(state, anim);
    window.clearTimeout(lockTimer);
    lockTimer = window.setTimeout(() => {
      busy = false;
      swipe.onMoveSettled();
    }, travel + feel.inputLockMs);
  };

  const reset = () => {
    busy = false;
    gameSfx.clearPending();
    gameHaptics.clearPending();
    overlay.classList.add('hidden');
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
    busy = false;
    amaze = retryAmaze(amaze);
    render(false);
  });

  applyFeelCss(feel);
  render(false);

  const panel = mountFeelPanel(
    uiRoot,
    (next) => {
      feel = next;
      saveFeelFor(mode, next);
      if (!busy) render(false);
    },
    feel,
    mode,
    () => {
      if (!busy) render(false);
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
    isBlocked: () => busy || (mode === 'merge' && state.over),
    onMove: tryDir,
    onInvalid: (dir) => {
      if (!busy) {
        nudgeBoard(mode === 'solo' ? mazeEl : boardEl, feel.nudgeMs, dir);
        gameSfx.nudge();
        gameHaptics.nudge(feel.nudgeMs);
      }
    },
    onGestureCommit: () => {
      pending = null;
    },
    onBackgroundAbort: () => {
      if (!pending) return;
      window.clearTimeout(lockTimer);
      busy = false;
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
      gameSfx.clearPending();
      gameHaptics.clearPending();
      render(false);
    },
  });

  return {
    dispose: () => {
      window.clearTimeout(lockTimer);
      gameSfx.clearPending();
      gameHaptics.clearPending();
      panel.dispose();
      swipe.dispose();
    },
  };
}
