import {
  AMAZE_GAP,
  AMAZE_H,
  AMAZE_W,
  getAmazeCell,
  getAmazeMoveMs,
  type AmazeState,
} from './amaze';
import { CATCH_UP_MIN_MS, parseTransformXY } from './motion';

function translate(x: number, y: number, cell: number): string {
  const g = AMAZE_GAP;
  return `translate(${g + x * (cell + g)}px, ${g + y * (cell + g)}px)`;
}

export function mountAmaze(parent: HTMLElement): HTMLElement {
  let root = parent.querySelector('#maze-board') as HTMLElement | null;
  if (root) return root;
  root = document.createElement('div');
  root.id = 'maze-board';
  root.className = 'maze-root hidden';
  root.innerHTML = `
    <div class="maze-grid"></div>
    <div class="maze-hero"></div>
    <div class="maze-overlay hidden">
      <p class="maze-over-msg">涂满了</p>
      <button type="button" class="maze-retry">再来</button>
    </div>
  `;
  const grid = root.querySelector('.maze-grid') as HTMLElement;
  for (let i = 0; i < AMAZE_W * AMAZE_H; i++) {
    const cell = document.createElement('div');
    cell.className = 'maze-cell';
    grid.appendChild(cell);
  }
  const hero = document.createElement('div');
  hero.className = 'maze-tile';
  root.querySelector('.maze-hero')!.appendChild(hero);
  parent.appendChild(root);
  return root;
}

export function layoutAmaze(root: HTMLElement): void {
  const cell = getAmazeCell();
  const gap = AMAZE_GAP;
  root.style.setProperty('--maze-cell', `${cell}px`);
  root.style.setProperty('--maze-gap', `${gap}px`);
  root.style.setProperty('--maze-cols', String(AMAZE_W));
  root.style.setProperty('--maze-rows', String(AMAZE_H));
  root.style.width = `${AMAZE_W * cell + (AMAZE_W + 1) * gap}px`;
  root.style.height = `${AMAZE_H * cell + (AMAZE_H + 1) * gap}px`;
}

export function paintAmaze(root: HTMLElement, s: AmazeState, animate: boolean): number {
  layoutAmaze(root);
  const cell = getAmazeCell();
  const grid = root.querySelector('.maze-grid') as HTMLElement;
  for (let i = 0; i < s.w * s.h; i++) {
    const el = grid.children[i] as HTMLElement;
    el.className = 'maze-cell';
    if (!s.floor[i]) {
      el.classList.add('maze-block');
      continue;
    }
    el.classList.add('maze-floor');
  }
  const tile = root.querySelector('.maze-tile') as HTMLElement;
  tile.style.width = `${cell}px`;
  tile.style.height = `${cell}px`;
  const from = s.previous ?? { x: s.x, y: s.y };
  const dist = Math.abs(s.x - from.x) + Math.abs(s.y - from.y);
  const g = AMAZE_GAP;
  const rest = { x: g + from.x * (cell + g), y: g + from.y * (cell + g) };
  const cur = parseTransformXY(getComputedStyle(tile).transform);
  const flying = !!cur && Math.hypot(cur.x - rest.x, cur.y - rest.y) > 2;
  const ms = animate && dist > 0 ? dist * getAmazeMoveMs() : 0;
  const catchMs =
    animate && flying && dist > 0
      ? Math.max(CATCH_UP_MIN_MS, Math.round(dist * getAmazeMoveMs() * 0.55))
      : ms;
  if (catchMs > 0) {
    tile.style.transition = 'none';
    if (flying && cur) tile.style.transform = `translate(${cur.x}px, ${cur.y}px)`;
    else tile.style.transform = translate(from.x, from.y, cell);
    void tile.offsetWidth;
    tile.style.transition = `transform ${catchMs}ms linear`;
    tile.style.transform = translate(s.x, s.y, cell);
  } else {
    tile.style.transition = 'none';
    tile.style.transform = translate(s.x, s.y, cell);
  }
  const overlay = root.querySelector('.maze-overlay') as HTMLElement;
  overlay.classList.add('hidden');
  return ms;
}
