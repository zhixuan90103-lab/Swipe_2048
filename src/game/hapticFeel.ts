/**
 * Play-layer haptic mapping.
 * Slide: one intensity + one sharpness.
 * Merge: min/max intensity, min/max sharpness, one growth curve over pitch steps 0–9.
 */

import { mergeStepFromValue, type SfxPack } from '../audio/AudioCatalog';

export type HapticPulse = {
  intensity: number;
  sharpness: number;
};

export type HapticFeel = {
  slideI: number;
  slideS: number;
  mergeIMin: number;
  mergeIMax: number;
  mergeSMin: number;
  mergeSMax: number;
  /** 0–1. 0.5 = even across 10 pitch steps; >0.5 later tiles ramp faster. */
  mergeGrowth: number;
  nudgeI: number;
  nudgeBounceI: number;
  nudgeS: number;
  /** Continuous tail after the hit, 0 = off. */
  nudgeTailI: number;
};

export const HAPTIC_FEEL_DEFAULT: HapticFeel = {
  slideI: 0.7,
  slideS: 0.7,
  mergeIMin: 0.7,
  mergeIMax: 0.95,
  mergeSMin: 0.7,
  mergeSMax: 1,
  mergeGrowth: 0.5,
  nudgeI: 0.7,
  nudgeBounceI: 0.4,
  nudgeS: 0.7,
  nudgeTailI: 0.14,
};

/** Keep in sync with `@keyframes g-nudge` in style.css */
export const NUDGE_HIT_T = 0.22;
export const NUDGE_BOUNCE_T = 0.48;

const KEY = 'swipe2048.haptics.feel';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
}

function parseFeel(raw: unknown): HapticFeel | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.slideI !== 'number' || typeof o.mergeIMin !== 'number') {
    return { ...HAPTIC_FEEL_DEFAULT };
  }
  const next = { ...HAPTIC_FEEL_DEFAULT };
  for (const k of Object.keys(HAPTIC_FEEL_DEFAULT) as (keyof HapticFeel)[]) {
    if (typeof o[k] !== 'number' || !Number.isFinite(o[k])) continue;
    next[k] = clamp01(o[k] as number);
  }
  if (typeof o.mergeGrowth === 'number' && o.mergeGrowth > 1) {
    next.mergeGrowth = HAPTIC_FEEL_DEFAULT.mergeGrowth;
  }
  if (next.slideI <= 0.28 && next.mergeIMin <= 0.4) {
    next.slideI = HAPTIC_FEEL_DEFAULT.slideI;
    next.slideS = HAPTIC_FEEL_DEFAULT.slideS;
    next.mergeIMin = HAPTIC_FEEL_DEFAULT.mergeIMin;
    next.mergeIMax = HAPTIC_FEEL_DEFAULT.mergeIMax;
    next.mergeSMin = HAPTIC_FEEL_DEFAULT.mergeSMin;
    next.mergeSMax = HAPTIC_FEEL_DEFAULT.mergeSMax;
    next.nudgeI = HAPTIC_FEEL_DEFAULT.nudgeI;
    next.nudgeBounceI = HAPTIC_FEEL_DEFAULT.nudgeBounceI;
    next.nudgeS = HAPTIC_FEEL_DEFAULT.nudgeS;
  }
  if (next.mergeIMax < next.mergeIMin) next.mergeIMax = next.mergeIMin;
  if (next.mergeSMax < next.mergeSMin) next.mergeSMax = next.mergeSMin;
  return next;
}

function loadFeel(): HapticFeel {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...HAPTIC_FEEL_DEFAULT };
    return parseFeel(JSON.parse(raw)) ?? { ...HAPTIC_FEEL_DEFAULT };
  } catch {
    return { ...HAPTIC_FEEL_DEFAULT };
  }
}

let current: HapticFeel = loadFeel();

export function getHapticFeel(): HapticFeel {
  return current;
}

export function setHapticFeel(next: HapticFeel): void {
  current = { ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
}

export function resetHapticFeel(): void {
  setHapticFeel({ ...HAPTIC_FEEL_DEFAULT });
}

export const HAPTIC_FIELDS: {
  key: keyof HapticFeel;
  label: string;
  why: string;
  min: number;
  max: number;
  step: number;
  preview: 'slide' | 'mergeLow' | 'mergeMid' | 'mergeHigh' | 'nudge';
}[] = [
  {
    key: 'slideI',
    label: '滑 强度',
    why: '无合的有效滑，固定一下。应低于合强度下限。',
    min: 0,
    max: 1,
    step: 0.01,
    preview: 'slide',
  },
  {
    key: 'slideS',
    label: '滑 锐度',
    why: '无合滑的质感。0.5–0.7 较稳。',
    min: 0,
    max: 1,
    step: 0.01,
    preview: 'slide',
  },
  {
    key: 'mergeIMin',
    label: '合 强度下限',
    why: '合成 4（音阶第 0 级）。',
    min: 0,
    max: 1,
    step: 0.01,
    preview: 'mergeLow',
  },
  {
    key: 'mergeIMax',
    label: '合 强度上限',
    why: '合成 2048（第 9 级）。中间档由增长系数铺开。',
    min: 0,
    max: 1,
    step: 0.01,
    preview: 'mergeHigh',
  },
  {
    key: 'mergeSMin',
    label: '合 锐度下限',
    why: '合成 4 的质感。',
    min: 0,
    max: 1,
    step: 0.01,
    preview: 'mergeLow',
  },
  {
    key: 'mergeSMax',
    label: '合 锐度上限',
    why: '合成 2048 的质感。超过约 0.73 会变薄。',
    min: 0,
    max: 1,
    step: 0.01,
    preview: 'mergeHigh',
  },
  {
    key: 'mergeGrowth',
    label: '合 增长',
    why: '0–1。0.5=十档匀速；越大后面的合升得越猛。',
    min: 0,
    max: 1,
    step: 0.01,
    preview: 'mergeMid',
  },
  {
    key: 'nudgeI',
    label: '回弹撞墙 强度',
    why: '无效步顶到头（动画 22%）。',
    min: 0,
    max: 1,
    step: 0.01,
    preview: 'nudge',
  },
  {
    key: 'nudgeBounceI',
    label: '回弹反弹 强度',
    why: '弹回（动画 48%）。0 则只有撞墙一下。',
    min: 0,
    max: 1,
    step: 0.01,
    preview: 'nudge',
  },
  {
    key: 'nudgeS',
    label: '回弹 锐度',
    why: '墙感，宜比滑略钝。',
    min: 0,
    max: 1,
    step: 0.01,
    preview: 'nudge',
  },
  {
    key: 'nudgeTailI',
    label: '回弹余韵 强度',
    why: '撞墙后叠一条衰减的持续震，时长跟回弹动画剩下的时间。0 关掉。',
    min: 0,
    max: 1,
    step: 0.01,
    preview: 'nudge',
  },
];

/** User 0–1 → curve g (0.5 → 1 = linear). */
function growthExponent(u01: number): number {
  return 2 ** (2 * (clamp01(u01) - 0.5));
}

function growthWeight(step: number, growth01: number): number {
  const t = Math.max(0, Math.min(9, step)) / 9;
  const g = growthExponent(growth01);
  if (Math.abs(g - 1) < 1e-6) return t;
  return (g ** t - 1) / (g - 1);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function drive(pulse: HapticPulse): HapticPulse {
  return {
    intensity: clamp01(pulse.intensity),
    sharpness: clamp01(pulse.sharpness),
  };
}

export function mergeAtStep(step: number, feel: HapticFeel = current): HapticPulse {
  const w = growthWeight(step, feel.mergeGrowth);
  return drive({
    intensity: lerp(feel.mergeIMin, feel.mergeIMax, w),
    sharpness: lerp(feel.mergeSMin, feel.mergeSMax, w),
  });
}

export function slidePulse(
  _cells: number,
  _pack: SfxPack = 2,
  feel: HapticFeel = current,
): HapticPulse {
  return drive({ intensity: feel.slideI, sharpness: feel.slideS });
}

export function mergePulse(
  value: number,
  _pack: SfxPack = 2,
  feel: HapticFeel = current,
): HapticPulse {
  return mergeAtStep(mergeStepFromValue(value), feel);
}

export function nudgePulse(_pack: SfxPack = 2, feel: HapticFeel = current): HapticPulse {
  return drive({ intensity: feel.nudgeI, sharpness: feel.nudgeS });
}

export type NudgeHapticEvent = {
  type: 'transient' | 'continuous';
  relativeTime: number;
  duration?: number;
  intensity: number;
  sharpness: number;
  decayTime?: number;
  releaseTime?: number;
};

export type NudgeHapticCurve = {
  parameterID: 'hapticIntensity' | 'hapticSharpness';
  relativeTime: number;
  controlPoints: { relativeTime: number; parameterValue: number }[];
};

export type NudgeHapticPattern = {
  events: NudgeHapticEvent[];
  curves: NudgeHapticCurve[];
};

export function nudgePattern(
  durationMs: number,
  pack: SfxPack = 2,
  feel: HapticFeel = current,
): NudgeHapticPattern {
  const hit = nudgePulse(pack, feel);
  const dur = Math.max(80, durationMs) / 1000;
  const hitAt = dur * NUDGE_HIT_T;
  const events: NudgeHapticEvent[] = [
    {
      type: 'transient',
      relativeTime: hitAt,
      intensity: hit.intensity,
      sharpness: hit.sharpness,
    },
  ];
  const curves: NudgeHapticCurve[] = [];

  if (feel.nudgeBounceI > 0.001) {
    events.push({
      type: 'transient',
      relativeTime: dur * NUDGE_BOUNCE_T,
      intensity: clamp01(feel.nudgeBounceI),
      sharpness: hit.sharpness,
    });
  }

  const tailI = clamp01(feel.nudgeTailI);
  const tailDur = Math.max(0.04, dur * (1 - NUDGE_HIT_T));
  if (tailI > 0.001) {
    events.push({
      type: 'continuous',
      relativeTime: hitAt,
      duration: tailDur,
      intensity: tailI,
      sharpness: clamp01(hit.sharpness * 0.75),
      decayTime: 0.7,
      releaseTime: 0.85,
    });
    curves.push({
      parameterID: 'hapticIntensity',
      relativeTime: hitAt,
      controlPoints: [
        { relativeTime: 0, parameterValue: 1 },
        { relativeTime: tailDur * 0.45, parameterValue: 0.35 },
        { relativeTime: tailDur, parameterValue: 0 },
      ],
    });
  }

  return { events, curves };
}

export function previewForField(
  key: keyof HapticFeel,
): { kind: 'slide' | 'merge' | 'nudge'; arg?: number } {
  const spec = HAPTIC_FIELDS.find((f) => f.key === key);
  switch (spec?.preview) {
    case 'slide':
      return { kind: 'slide', arg: 1 };
    case 'mergeMid':
      return { kind: 'merge', arg: 64 };
    case 'mergeHigh':
      return { kind: 'merge', arg: 1024 };
    case 'nudge':
      return { kind: 'nudge' };
    default:
      return { kind: 'merge', arg: 4 };
  }
}
