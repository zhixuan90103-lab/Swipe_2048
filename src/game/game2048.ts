import { applyMove, newGame, type BoardState, type Dir } from './board';
import {
  applyFeelCss,
  loadFeelFor,
  saveFeelFor,
  SLIDE_EASE_CSS,
  type Feel,
} from './feel';
import { mountFeelPanel } from './feelPanel';
import { moveSolo, newSolo, soloAsBoard, type SoloState } from './solo';
import { attachSwipeInput, type SwipeHandle } from './swipeInput';
import { nudgeBoard, paintBoard, slideDurationMs, type PaintAnim } from './view';

type Mode = 'merge' | 'solo';

const BEST_KEY = 'swipe2048.best';

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
        <div class="g-overlay hidden" id="g-overlay">
          <p id="g-over-msg">没有可走的步了</p>
          <button type="button" id="g-retry">再来</button>
        </div>
      </div>
    </div>
  `;

  const boardEl = uiRoot.querySelector('#g-board') as HTMLElement;
  const gridEl = boardEl.querySelector('.g-grid') as HTMLElement;
  const overlay = uiRoot.querySelector('#g-overlay') as HTMLElement;
  const overMsg = uiRoot.querySelector('#g-over-msg') as HTMLElement;
  const scoreEl = uiRoot.querySelector('#g-score') as HTMLElement;
  const bestEl = uiRoot.querySelector('#g-best') as HTMLElement;

  for (let i = 0; i < 16; i++) {
    const cell = document.createElement('div');
    cell.className = 'g-cell';
    gridEl.appendChild(cell);
  }

  let mode: Mode = 'merge';
  let state: BoardState = newGame();
  let solo: SoloState = newSolo();
  let busy = false;
  let feel: Feel = loadFeelFor('merge');
  let best = Number(localStorage.getItem(BEST_KEY) || '0');
  let lockTimer = 0;
  let swipe: SwipeHandle;
  let pending:
    | { mode: 'merge'; state: BoardState; best: number }
    | { mode: 'solo'; solo: SoloState }
    | null = null;

  const titleEl = uiRoot.querySelector('#g-title') as HTMLElement;
  const scoresEl = uiRoot.querySelector('#g-scores') as HTMLElement;
  const introEl = uiRoot.querySelector('#g-intro') as HTMLElement;
  const settingsBtn = uiRoot.querySelector('#g-settings') as HTMLElement;

  const hud = () => {
    const solo = mode === 'solo';
    titleEl.textContent = solo ? '单块' : '2048';
    titleEl.classList.toggle('g-logo-solo', solo);
    scoresEl.style.visibility = solo ? 'hidden' : 'visible';
    introEl.textContent = solo
      ? '把方块滑到墙，一次滑到底。'
      : '合并这些数字以得到2048方块！';
    scoreEl.textContent = String(state.score);
    if (state.score > best) {
      best = state.score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    bestEl.textContent = String(best);
    if (state.over) {
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
    const board = mode === 'solo' ? soloAsBoard(solo) : state;
    paintBoard(boardEl, board, animate, paintAnim(), feel.boardScale);
    hud();
  };

  const tryDir = (dir: Dir) => {
    if (busy) return;
    if (mode === 'solo') {
      const { state: next, moved } = moveSolo(solo, dir);
      if (!moved) {
        nudgeBoard(boardEl, feel.nudgeMs);
        return;
      }
      if (swipe?.isHolding() && !pending) pending = { mode: 'solo', solo };
      solo = next;
      busy = true;
      render(true);
      const travel = slideDurationMs(soloAsBoard(solo), paintAnim());
      window.clearTimeout(lockTimer);
      lockTimer = window.setTimeout(() => {
        busy = false;
        swipe.onMoveSettled();
      }, travel + feel.inputLockMs);
      return;
    }
    if (state.over) return;
    const { state: next, moved, scoreDelta } = applyMove(state, dir);
    if (!moved) {
      nudgeBoard(boardEl, feel.nudgeMs);
      return;
    }
    if (swipe?.isHolding() && !pending) {
      pending = { mode: 'merge', state, best };
    }
    state = next;
    busy = true;
    render(true);
    floatScore(scoreDelta);
    const travel = slideDurationMs(state, paintAnim());
    window.clearTimeout(lockTimer);
    lockTimer = window.setTimeout(() => {
      busy = false;
      swipe.onMoveSettled();
    }, travel + feel.inputLockMs);
  };

  const reset = () => {
    busy = false;
    overlay.classList.add('hidden');
    if (mode === 'solo') solo = newSolo();
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

  titleEl.addEventListener('click', () => setMode(mode === 'solo' ? 'merge' : 'solo'));

  uiRoot.querySelector('#g-new')!.addEventListener('click', reset);
  uiRoot.querySelector('#g-retry')!.addEventListener('click', reset);

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
  );

  settingsBtn.addEventListener('click', () => panel.toggle());

  swipe = attachSwipeInput({
    target: stage,
    getFeel: () => feel,
    isBlocked: () => busy || (mode === 'merge' && state.over),
    onMove: tryDir,
    onInvalid: () => {
      if (!busy) nudgeBoard(boardEl, feel.nudgeMs);
    },
    onGestureCommit: () => {
      pending = null;
    },
    onBackgroundAbort: () => {
      if (!pending) return;
      window.clearTimeout(lockTimer);
      busy = false;
      if (pending.mode === 'solo') solo = pending.solo;
      else {
        state = pending.state;
        best = pending.best;
        localStorage.setItem(BEST_KEY, String(best));
      }
      pending = null;
      render(false);
    },
  });

  return {
    dispose: () => {
      window.clearTimeout(lockTimer);
      panel.dispose();
      swipe.dispose();
    },
  };
}
