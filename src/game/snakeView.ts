import {
  SNAKE_CELL,
  SNAKE_GAP,
  SNAKE_H,
  SNAKE_W,
  type SnakeState,
} from './snake';

export function mountSnake(parent: HTMLElement): HTMLElement {
  let root = parent.querySelector('#snake-board') as HTMLElement | null;
  if (root) return root;
  root = document.createElement('div');
  root.id = 'snake-board';
  root.className = 'snake-root hidden';
  root.innerHTML = `
    <div class="snake-grid"></div>
    <div class="snake-overlay hidden">
      <p class="snake-over-msg">撞到了</p>
      <button type="button" class="snake-retry">再来</button>
    </div>
  `;
  const grid = root.querySelector('.snake-grid') as HTMLElement;
  for (let i = 0; i < SNAKE_W * SNAKE_H; i++) {
    const cell = document.createElement('div');
    cell.className = 'snake-cell';
    grid.appendChild(cell);
  }
  parent.appendChild(root);
  layoutSnake(root);
  return root;
}

export function layoutSnake(root: HTMLElement): void {
  const cell = SNAKE_CELL;
  const gap = SNAKE_GAP;
  root.style.setProperty('--snake-cell', `${cell}px`);
  root.style.setProperty('--snake-gap', `${gap}px`);
  root.style.setProperty('--snake-cols', String(SNAKE_W));
  root.style.setProperty('--snake-rows', String(SNAKE_H));
  root.style.width = `${SNAKE_W * cell + (SNAKE_W + 1) * gap}px`;
  root.style.height = `${SNAKE_H * cell + (SNAKE_H + 1) * gap}px`;
}

export function paintSnake(root: HTMLElement, s: SnakeState): void {
  layoutSnake(root);
  const grid = root.querySelector('.snake-grid') as HTMLElement;
  const occ = new Map<string, 'head' | 'body' | 'food'>();
  occ.set(`${s.food.x},${s.food.y}`, 'food');
  for (let i = s.body.length - 1; i >= 0; i--) {
    const c = s.body[i]!;
    occ.set(`${c.x},${c.y}`, i === 0 ? 'head' : 'body');
  }
  for (let i = 0; i < s.w * s.h; i++) {
    const el = grid.children[i] as HTMLElement;
    const x = i % s.w;
    const y = (i / s.w) | 0;
    const kind = occ.get(`${x},${y}`);
    el.className = 'snake-cell';
    if (kind) el.classList.add(`snake-${kind}`);
  }
  const overlay = root.querySelector('.snake-overlay') as HTMLElement;
  overlay.classList.toggle('hidden', !s.dead);
}
