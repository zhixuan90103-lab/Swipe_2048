import {
  AMAZE_GAP,
  AMAZE_H,
  AMAZE_W,
  getAmazeCell,
  getAmazeMoveMs,
  type AmazeState,
} from './amaze';


export function amazeCellPx(x: number, y: number, cell = getAmazeCell()): { x: number; y: number } {
  const g = AMAZE_GAP;
  return { x: g + x * (cell + g), y: g + y * (cell + g) };
}

function translate(x: number, y: number, cell: number): string {
  const p = amazeCellPx(x, y, cell);
  return `translate(${p.x}px, ${p.y}px)`;
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

export function paintAmaze(
  root: HTMLElement,
  s: AmazeState,
  animate: boolean,
  fromPx?: { x: number; y: number } | null,
): number {
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
    if (s.painted[i]) el.classList.add('maze-on');
  }
  const tile = root.querySelector('.maze-tile') as HTMLElement;
  tile.style.width = `${cell}px`;
  tile.style.height = `${cell}px`;
  const from = s.previous ?? { x: s.x, y: s.y };
  const dest = amazeCellPx(s.x, s.y, cell);
  const startPx = fromPx ?? amazeCellPx(from.x, from.y, cell);
  const step = cell + AMAZE_GAP;
  const distCells =
    step > 0 ? Math.hypot(dest.x - startPx.x, dest.y - startPx.y) / step : 0;
  const ms = animate && distCells > 0.02 ? Math.round(distCells * getAmazeMoveMs()) : 0;
  if (ms > 0) {
    tile.style.transition = 'none';
    tile.style.transform = `translate(${startPx.x}px, ${startPx.y}px)`;
    void tile.offsetWidth;
    tile.style.transition = `transform ${ms}ms linear`;
    tile.style.transform = `translate(${dest.x}px, ${dest.y}px)`;
  } else {
    tile.style.transition = 'none';
    tile.style.transform = translate(s.x, s.y, cell);
  }
  const overlay = root.querySelector('.maze-overlay') as HTMLElement;
  const msg = overlay.querySelector('.maze-over-msg') as HTMLElement | null;
  const btn = overlay.querySelector('.maze-retry') as HTMLElement | null;
  if (s.won) {
    if (msg) msg.textContent = `涂满了 · ${s.moves} 步（参考 ${s.par}）`;
    if (btn) btn.textContent = '下一关';
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
    if (btn) btn.textContent = '再来';
  }
  return ms;
}
