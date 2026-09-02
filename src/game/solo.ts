import { SIZE, VECTORS, type BoardState, type Dir, type Tile } from './board';

export type SoloState = {
  x: number;
  y: number;
  id: number;
  previous: { x: number; y: number } | null;
  score: number;
};

export function newSolo(): SoloState {
  return { x: 1, y: 1, id: 1, previous: null, score: 0 };
}

export function moveSolo(
  s: SoloState,
  dir: Dir,
): { state: SoloState; moved: boolean; scoreDelta: number } {
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
  if (x === s.x && y === s.y) return { state: s, moved: false, scoreDelta: 0 };
  const scoreDelta = Math.abs(x - s.x) + Math.abs(y - s.y);
  return {
    state: {
      x,
      y,
      id: s.id,
      previous: { x: s.x, y: s.y },
      score: s.score + scoreDelta,
    },
    moved: true,
    scoreDelta,
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
    score: s.score,
    won: false,
    over: false,
    nextId: s.id + 1,
  };
}
