import { SIZE, VECTORS, type BoardState, type Dir, type Tile } from './board';

export type SoloState = {
  x: number;
  y: number;
  id: number;
  previous: { x: number; y: number } | null;
};

export function newSolo(): SoloState {
  return { x: 1, y: 1, id: 1, previous: null };
}

export function moveSolo(
  s: SoloState,
  dir: Dir,
): { state: SoloState; moved: boolean } {
  const v = VECTORS[dir];
  let x = s.x;
  let y = s.y;
  for (;;) {
    const nx = x + v.x;
    const ny = y + v.y;
    if (nx < 0 || nx >= SIZE || ny < 0 || ny >= SIZE) break;
    x = nx;
    y = ny;
  }
  if (x === s.x && y === s.y) return { state: s, moved: false };
  return {
    state: { x, y, id: s.id, previous: { x: s.x, y: s.y } },
    moved: true,
  };
}

export function soloAsBoard(s: SoloState): BoardState {
  const tile: Tile = {
    id: s.id,
    x: s.x,
    y: s.y,
    value: 8,
    previous: s.previous,
    mergedFrom: null,
    label: '●',
  };
  return {
    tiles: [tile],
    score: 0,
    won: false,
    over: false,
    nextId: s.id + 1,
  };
}
