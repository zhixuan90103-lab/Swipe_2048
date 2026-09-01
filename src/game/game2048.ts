import { applyMove, newGame, type BoardState, type Dir } from './board';
import { FEEL_DEFAULT, type Feel } from './feel';
import { mountFeelPanel } from './feelPanel';
import { moveSolo, newSolo, soloAsBoard, type SoloState } from './solo';
import { attachSwipeInput, type SwipeHandle } from './swipeInput';
import { BOARD_PX, maxTravelCells, nudgeBoard, paintBoard } from './view';

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
      <header class="g-bar">
        <div>
          <h1 id="g-title">2048</h1>
          <div class="g-modes" id="g-modes">
            <button type="button" data-mode="merge" class="on">2048</button>
            <button type="button" data-mode="solo">单块</button>
          </div>
        </div>
        <div class="g-scores" id="g-scores">
          <div class="g-score">分 <strong id="g-score">0</strong></div>
          <div class="g-score">佳 <strong id="g-best">0</strong></div>
        </div>
        <button type="button" id="g-new">新局</button>
      </header>
      <div class="g-board" id="g-board" style="width:${BOARD_PX}px;height:${BOARD_PX}px">
        <div class="g-grid"></div>
        <div class="g-tiles"></div>
      </div>
      <div class="g-overlay hidden" id="g-overlay">
        <p id="g-over-msg">没有可走的步了</p>
        <button type="button" id="g-retry">再来</button>
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
  let feel: Feel = FEEL_DEFAULT;
  let best = Number(localStorage.getItem(BEST_KEY) || '0');
  let lockTimer = 0;
  let swipe: SwipeHandle;

  const titleEl = uiRoot.querySelector('#g-title') as HTMLElement;
  const scoresEl = uiRoot.querySelector('#g-scores') as HTMLElement;

  const hud = () => {
    titleEl.textContent = mode === 'solo' ? '单块' : '2048';
    scoresEl.style.display = mode === 'solo' ? 'none' : 'flex';
    scoreEl.textContent = String(state.score);
    if (state.score > best) {
      best = state.score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    bestEl.textContent = String(best);
    overlay.classList.toggle('hidden', !state.over && !state.won);
    if (state.over) overMsg.textContent = '没有可走的步了';
    else if (state.won) overMsg.textContent = '到 2048 了，还可继续';
    if (state.won && !state.over) overlay.classList.add('hidden');
  };

  const render = (animate: boolean) => {
    paintBoard(
      boardEl,
      mode === 'solo' ? soloAsBoard(solo) : state,
      animate,
      feel.tileMoveMs,
    );
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
      solo = next;
      busy = true;
      render(true);
      const travel = maxTravelCells(soloAsBoard(solo)) * feel.tileMoveMs;
      window.clearTimeout(lockTimer);
      lockTimer = window.setTimeout(() => {
        busy = false;
        swipe.onMoveSettled();
      }, travel + feel.inputLockMs);
      return;
    }
    if (state.over) return;
    const { state: next, moved } = applyMove(state, dir);
    if (!moved) {
      nudgeBoard(boardEl, feel.nudgeMs);
      return;
    }
    state = next;
    busy = true;
    render(true);
    const travel = maxTravelCells(state) * feel.tileMoveMs;
    window.clearTimeout(lockTimer);
    lockTimer = window.setTimeout(() => {
      busy = false;
      hud();
      if (state.over) overlay.classList.remove('hidden');
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
    mode = next;
    uiRoot.querySelectorAll('[data-mode]').forEach((b) => {
      b.classList.toggle('on', (b as HTMLElement).dataset.mode === mode);
    });
    reset();
  };

  uiRoot.querySelector('#g-modes')!.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('[data-mode]') as HTMLElement | null;
    if (!btn?.dataset.mode) return;
    setMode(btn.dataset.mode as Mode);
  });

  uiRoot.querySelector('#g-new')!.addEventListener('click', reset);
  uiRoot.querySelector('#g-retry')!.addEventListener('click', reset);

  render(false);

  const panel = mountFeelPanel(uiRoot, (next) => {
    feel = next;
  });

  swipe = attachSwipeInput({
    target: stage,
    getFeel: () => feel,
    isBlocked: () => busy || (mode === 'merge' && state.over),
    onMove: tryDir,
    onInvalid: () => {
      if (!busy) nudgeBoard(boardEl, feel.nudgeMs);
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
