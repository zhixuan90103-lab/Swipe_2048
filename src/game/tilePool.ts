import { SIZE } from './board';

export type TileEl = HTMLDivElement;

function makeTile(): TileEl {
  const el = document.createElement('div');
  el.className = 'g-tile';
  el.dataset.busy = '0';
  const inner = document.createElement('div');
  inner.className = 'g-tile-inner';
  el.appendChild(inner);
  return el;
}

const pools = new WeakMap<HTMLElement, TileEl[]>();

export function poolFor(layer: HTMLElement): TileEl[] {
  let pool = pools.get(layer);
  if (!pool) {
    pool = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      const el = makeTile();
      el.style.visibility = 'hidden';
      layer.appendChild(el);
      pool.push(el);
    }
    pools.set(layer, pool);
  }
  return pool;
}

export function beginFrame(pool: TileEl[]): void {
  for (const el of pool) el.dataset.busy = '0';
}

export function acquireTile(layer: HTMLElement, pool: TileEl[], preferId?: string): TileEl {
  let el =
    preferId !== undefined
      ? pool.find((e) => e.dataset.busy !== '1' && e.dataset.id === preferId)
      : undefined;
  if (!el) el = pool.find((e) => e.dataset.busy !== '1');
  if (!el) {
    el = makeTile();
    pool.push(el);
    layer.appendChild(el);
  }
  el.dataset.busy = '1';
  el.style.visibility = 'visible';
  return el;
}

export function recycleIdle(pool: TileEl[]): void {
  for (const el of pool) {
    if (el.dataset.busy === '1') continue;
    el.style.visibility = 'hidden';
    el.style.transition = 'none';
    el.className = 'g-tile';
    const inner = el.firstElementChild as HTMLElement;
    inner.style.removeProperty('animation-delay');
  }
}

export function kickClass(el: HTMLElement, name: string): void {
  el.classList.remove('g-tile-new', 'g-tile-merge');
  void el.offsetWidth;
  el.classList.add(name);
}
