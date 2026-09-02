/**
 * Board haptics: same events as gameSfx, one pulse per flush, merge kills slide.
 */

import { gameSfx } from './gameSfx';
import { haptics } from './haptics';
import {
  mergePulse,
  nudgePattern,
  slidePulse,
  type HapticPulse,
  type NudgeHapticPattern,
} from '../game/hapticFeel';

const ENABLED_KEY = 'swipe2048.haptics.enabled';

export type HapticId = 'slide' | 'merge' | 'nudge' | 'ui' | 'win' | 'over';

const COOLDOWN_MS: Record<HapticId, number> = {
  win: 400,
  over: 400,
  merge: 24,
  ui: 24,
  nudge: 50,
  slide: 24,
};

const PRIORITY: Record<HapticId, number> = {
  win: 2,
  over: 3,
  merge: 10,
  ui: 12,
  nudge: 14,
  slide: 22,
};

type Job = { id: HapticId; pulse?: HapticPulse; pattern?: NudgeHapticPattern };

export type HapticApiShot = {
  id: HapticId;
  intensity: number;
  sharpness: number;
  extra?: string;
};

let lastApi: HapticApiShot | null = null;

const lastPlayed = new Map<HapticId, number>();
const queued = new Map<HapticId, Job>();
const delays = new Set<number>();
let scheduled = false;
let enabled = readEnabled();

function readEnabled(): boolean {
  try {
    const v = localStorage.getItem(ENABLED_KEY);
    if (v === '0') return false;
    if (v === '1') return true;
  } catch {
    /* ignore */
  }
  return true;
}

function persistEnabled(): void {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}

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

function enqueue(job: Job): void {
  if (!enabled) return;
  const t = performance.now();
  const last = lastPlayed.get(job.id) ?? -1e9;
  if (t - last < COOLDOWN_MS[job.id]) return;
  if (job.id === 'slide' && queued.has('merge')) return;
  if (job.id === 'merge') queued.delete('slide');
  queued.set(job.id, job);
  if (!scheduled) {
    scheduled = true;
    queueMicrotask(flush);
  }
}

function flush(): void {
  scheduled = false;
  if (queued.size === 0) return;
  const jobs = [...queued.values()].sort((a, b) => PRIORITY[a.id] - PRIORITY[b.id]);
  queued.clear();
  const job = jobs[0];
  if (!job) return;
  const t = performance.now();
  lastPlayed.set(job.id, t);
  void play(job);
}

function play(job: Job): Promise<{ ok: boolean; reason?: string }> {
  if (job.id === 'ui') {
    lastApi = { id: 'ui', intensity: NaN, sharpness: NaN, extra: 'selection()' };
    return haptics.selection();
  }
  if (job.id === 'win') {
    lastApi = { id: 'win', intensity: NaN, sharpness: NaN, extra: "notification('success')" };
    return haptics.notification('success');
  }
  if (job.id === 'over') {
    lastApi = { id: 'over', intensity: NaN, sharpness: NaN, extra: "notification('error')" };
    return haptics.notification('error');
  }
  if (job.pattern?.events.length) {
    const a = job.pattern.events[0]!;
    const tail = job.pattern.events.find((e) => e.type === 'continuous');
    lastApi = {
      id: job.id,
      intensity: a.intensity,
      sharpness: a.sharpness,
      extra: tail
        ? `tail I=${tail.intensity.toFixed(2)} ${tail.duration?.toFixed(2)}s`
        : undefined,
    };
    return haptics.playPattern(job.pattern.events, job.pattern.curves);
  }
  const p = job.pulse;
  if (!p) return Promise.resolve({ ok: false, reason: 'no_pulse' });
  lastApi = { id: job.id, intensity: p.intensity, sharpness: p.sharpness };
  return haptics.stackImpact(p.intensity, p.sharpness);
}

function pack() {
  return gameSfx.getPack();
}

export const gameHaptics = {
  isEnabled: () => enabled,
  lastApi: () => lastApi,

  setEnabled(on: boolean): void {
    enabled = on;
    persistEnabled();
    haptics.setEnabled(on);
    if (!on) {
      queued.clear();
      scheduled = false;
    }
  },

  slide(cells: number): void {
    enqueue({ id: 'slide', pulse: slidePulse(cells, pack()) });
  },

  merge(value: number): void {
    enqueue({ id: 'merge', pulse: mergePulse(value, pack()) });
  },

  nudge(durationMs = 350): void {
    enqueue({ id: 'nudge', pattern: nudgePattern(durationMs, pack()) });
  },

  ui(): void {
    enqueue({ id: 'ui' });
  },

  win(delayMs = 0): void {
    later(delayMs, () => enqueue({ id: 'win' }));
  },

  over(delayMs = 0): void {
    later(delayMs, () => enqueue({ id: 'over' }));
  },

  previewMerge(): void {
    enqueue({ id: 'merge', pulse: mergePulse(4, pack()) });
  },

  clearPending(): void {
    for (const id of delays) window.clearTimeout(id);
    delays.clear();
    queued.clear();
    scheduled = false;
  },
};

haptics.setEnabled(enabled);
