/**
 * 唯一套装：短 UI tick。合优先于滑；多组合并只播最高档；合后滑沿用该档。
 */

import { audio } from '../audio/AudioManager';
import { mergeStepFromValue } from '../audio/AudioCatalog';

const delays = new Set<number>();
let phraseStep = 0;

function later(ms: number, fn: () => void): void {
  if (ms <= 0) {
    fn();
    return;
  }
  const id = window.setTimeout(() => {
    delays.delete(id);
    fn();
  }, ms);
  delays.add(id);
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

export const gameSfx = {
  slide(cells: number): void {
    const c = clamp(cells, 1, 3);
    audio.playSfx('slide', { volume: 0.7 + (c - 1) * 0.08, step: phraseStep });
  },

  merge(value: number): void {
    const step = mergeStepFromValue(value);
    phraseStep = step;
    audio.playSfx('merge', { volume: 1, step });
  },

  spawn(delayMs: number): void {
    later(delayMs, () => audio.playSfx('spawn', { volume: 0.45 }));
  },

  nudge(): void {
    audio.playSfx('nudge', { volume: 1 });
  },

  over(delayMs: number): void {
    later(delayMs, () => audio.playSfx('over'));
  },

  win(): void {
    audio.playSfx('win', { volume: 1 });
  },

  ui(): void {
    audio.playSfx('ui', { volume: 0.9 });
  },

  clearPending(): void {
    for (const id of delays) window.clearTimeout(id);
    delays.clear();
    phraseStep = 0;
  },
};
