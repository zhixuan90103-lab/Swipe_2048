/**
 * 现行唯一套装：短 UI tick（UI SFX Minimal / 音效2）。
 * 合优先于滑；多组合并只播最高档；出手即播。
 */

export const MAX_SFX_PER_FRAME = 8;
export const NORMAL_MAX_SFX_PER_FRAME = 5;
export const BUSY_MAX_SFX_PER_FRAME = 3;
export const BUSY_WINDOW_MS = 260;

export type SfxId =
  | 'slide'
  | 'merge'
  | 'spawn'
  | 'nudge'
  | 'over'
  | 'win'
  | 'ui';

export type SfxPack = 1;

export const SFX_DIR = 'sfx/v2';

/** 4→档0 … 2048→档9。相对 snap 升音，不用运行时变速。 */
export const MERGE_STEP_MAX = 9;

export function mergeStepFromValue(value: number): number {
  const steps = Math.round(Math.log2(Math.max(4, value))) - 2;
  return Math.max(0, Math.min(MERGE_STEP_MAX, steps));
}

export type SfxDef = {
  id: SfxId;
  volume: number;
  cooldownMs: number;
  priority: number;
  maxVoices: number;
};

export const SFX_CATALOG: readonly SfxDef[] = [
  { id: 'win', volume: 0.4, cooldownMs: 400, priority: 2, maxVoices: 1 },
  { id: 'over', volume: 0.36, cooldownMs: 400, priority: 3, maxVoices: 1 },
  { id: 'merge', volume: 0.42, cooldownMs: 24, priority: 10, maxVoices: 1 },
  { id: 'ui', volume: 0.22, cooldownMs: 24, priority: 12, maxVoices: 1 },
  { id: 'nudge', volume: 0.42, cooldownMs: 50, priority: 14, maxVoices: 1 },
  { id: 'slide', volume: 0.4, cooldownMs: 24, priority: 22, maxVoices: 1 },
  { id: 'spawn', volume: 0.2, cooldownMs: 40, priority: 28, maxVoices: 1 },
];

export function mergeFileStep(step: number): string {
  const n = Math.max(0, Math.min(MERGE_STEP_MAX, Math.round(step)));
  return n.toString().padStart(2, '0');
}

export function isNoteId(id: SfxId): boolean {
  return id === 'merge' || id === 'slide';
}

export function sfxPath(_pack: SfxPack, id: SfxId, step = 0): string {
  if (isNoteId(id)) return `${SFX_DIR}/merge-${mergeFileStep(step)}.wav`;
  return `${SFX_DIR}/${id}.wav`;
}

export function sfxBufferId(_pack: SfxPack, id: SfxId, step = 0): string {
  if (isNoteId(id)) return `tick_merge_${mergeFileStep(step)}`;
  return `tick_${id}`;
}

export function eventKey(id: SfxId, step = 0): string {
  if (id === 'merge') return `merge:${mergeFileStep(step)}`;
  if (id === 'slide') return `slide:${mergeFileStep(step)}`;
  return id;
}

export type PreloadItem = {
  id: string;
  path: string;
  volume: number;
  cooldownMs: number;
  maxVoices: number;
};

export function preloadItems(): PreloadItem[] {
  const items: PreloadItem[] = [];
  for (const d of SFX_CATALOG) {
    if (d.id === 'slide') continue;
    if (d.id === 'merge') {
      for (let s = 0; s <= MERGE_STEP_MAX; s++) {
        items.push({
          id: sfxBufferId(1, 'merge', s),
          path: sfxPath(1, 'merge', s),
          volume: d.volume,
          cooldownMs: d.cooldownMs,
          maxVoices: 1,
        });
      }
    } else {
      items.push({
        id: sfxBufferId(1, d.id),
        path: sfxPath(1, d.id),
        volume: d.volume,
        cooldownMs: d.cooldownMs,
        maxVoices: d.maxVoices,
      });
    }
  }
  return items;
}

export const SFX_BY_ID: Record<SfxId, SfxDef> = Object.fromEntries(
  SFX_CATALOG.map((d) => [d.id, d]),
) as Record<SfxId, SfxDef>;

export type PlaySfxOpts = {
  volume?: number;
  step?: number;
};

export type SfxEvent = {
  id: SfxId;
  volume: number;
  rate: number;
  step: number;
};
