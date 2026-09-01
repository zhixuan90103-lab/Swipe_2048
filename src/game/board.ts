/** 4×4 2048 rules. Grid is the source of truth; view only reads results. */

export const SIZE = 4;
export type Dir = 0 | 1 | 2 | 3; // up, right, down, left

export const VECTORS: Record<Dir, { x: number; y: number }> = {
  0: { x: 0, y: -1 },
  1: { x: 1, y: 0 },
  2: { x: 0, y: 1 },
  3: { x: -1, y: 0 },
};

export type Tile = {
  id: number;
  x: number;
  y: number;
  value: number;
  previous: { x: number; y: number } | null;
  mergedFrom: Tile[] | null;
  label?: string;
};

export type BoardState = {
  tiles: Tile[];
  score: number;
  won: boolean;
  over: boolean;
  nextId: number;
};

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

function mapTiles(tiles: Tile[]): Map<string, Tile> {
  const m = new Map<string, Tile>();
  for (const t of tiles) m.set(key(t.x, t.y), t);
  return m;
}

function emptyCells(tiles: Tile[]): { x: number; y: number }[] {
  const occ = new Set(tiles.map((t) => key(t.x, t.y)));
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!occ.has(key(x, y))) out.push({ x, y });
    }
  }
  return out;
}

export function spawnRandom(state: BoardState, rng = Math.random): BoardState {
  const spots = emptyCells(state.tiles);
  if (spots.length === 0) return state;
  const spot = spots[Math.floor(rng() * spots.length)]!;
  const value = rng() < 0.9 ? 2 : 4;
  return {
    ...state,
    nextId: state.nextId + 1,
    tiles: [
      ...state.tiles,
      {
        id: state.nextId,
        x: spot.x,
        y: spot.y,
        value,
        previous: null,
        mergedFrom: null,
      },
    ],
  };
}

export function newGame(rng = Math.random): BoardState {
  let state: BoardState = {
    tiles: [],
    score: 0,
    won: false,
    over: false,
    nextId: 1,
  };
  state = spawnRandom(state, rng);
  state = spawnRandom(state, rng);
  return state;
}

function prepare(tiles: Tile[]): Tile[] {
  return tiles.map((t) => ({
    ...t,
    previous: { x: t.x, y: t.y },
    mergedFrom: null,
  }));
}

function traversals(dir: Dir): { xs: number[]; ys: number[] } {
  const xs = [0, 1, 2, 3];
  const ys = [0, 1, 2, 3];
  const v = VECTORS[dir];
  if (v.x === 1) xs.reverse();
  if (v.y === 1) ys.reverse();
  return { xs, ys };
}

function farthest(
  occ: Map<string, Tile>,
  x: number,
  y: number,
  dir: Dir,
): { fx: number; fy: number; nx: number; ny: number } {
  const v = VECTORS[dir];
  let cx = x;
  let cy = y;
  let px = x;
  let py = y;
  do {
    px = cx;
    py = cy;
    cx = px + v.x;
    cy = py + v.y;
  } while (inBounds(cx, cy) && !occ.has(key(cx, cy)));
  return { fx: px, fy: py, nx: cx, ny: cy };
}

export function canMove(state: BoardState, dir: Dir): boolean {
  return applyMove(state, dir).moved;
}

export function anyMove(state: BoardState): boolean {
  return ( [0, 1, 2, 3] as Dir[]).some((d) => canMove(state, d));
}

export function applyMove(
  state: BoardState,
  dir: Dir,
): { state: BoardState; moved: boolean; scoreDelta: number } {
  if (state.over) return { state, moved: false, scoreDelta: 0 };

  const tiles = prepare(state.tiles);
  let occ = mapTiles(tiles);
  const { xs, ys } = traversals(dir);
  let moved = false;
  let scoreDelta = 0;
  let nextId = state.nextId;
  let won = state.won;

  for (const x of xs) {
    for (const y of ys) {
      const tile = occ.get(key(x, y));
      if (!tile) continue;
      const { fx, fy, nx, ny } = farthest(occ, x, y, dir);
      const next = inBounds(nx, ny) ? occ.get(key(nx, ny)) : undefined;

      if (next && next.value === tile.value && !next.mergedFrom) {
        occ.delete(key(tile.x, tile.y));
        const merged: Tile = {
          id: nextId++,
          x: nx,
          y: ny,
          value: tile.value * 2,
          previous: { x: tile.x, y: tile.y },
          mergedFrom: [
            { ...tile, x: nx, y: ny },
            { ...next, previous: { x: next.x, y: next.y } },
          ],
        };
        occ.delete(key(next.x, next.y));
        occ.set(key(nx, ny), merged);
        scoreDelta += merged.value;
        if (merged.value === 2048) won = true;
        moved = true;
      } else {
        occ.delete(key(tile.x, tile.y));
        tile.x = fx;
        tile.y = fy;
        occ.set(key(fx, fy), tile);
        if (fx !== x || fy !== y) moved = true;
      }
    }
  }

  let nextState: BoardState = {
    tiles: [...occ.values()],
    score: state.score + scoreDelta,
    won,
    over: false,
    nextId,
  };

  if (moved) {
    nextState = spawnRandom(nextState);
    if (!anyMove(nextState)) nextState = { ...nextState, over: true };
  }

  return { state: nextState, moved, scoreDelta };
}
