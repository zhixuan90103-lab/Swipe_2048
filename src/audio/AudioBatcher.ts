import {
  BUSY_MAX_SFX_PER_FRAME,
  BUSY_WINDOW_MS,
  NORMAL_MAX_SFX_PER_FRAME,
  SFX_BY_ID,
  eventKey,
  type PlaySfxOpts,
  type SfxEvent,
  type SfxId,
} from './AudioCatalog';

export type BatcherClock = () => number;
export type FlushFn = (events: SfxEvent[]) => void;

export class AudioBatcher {
  private queued = new Map<string, SfxEvent>();
  private lastPlayed = new Map<string, number>();
  private scheduled = false;
  private busyUntil = 0;
  private rafId = 0;

  constructor(
    private readonly flushFn: FlushFn,
    private readonly now: BatcherClock = () => performance.now(),
    private readonly schedule: (cb: () => void) => number = (cb) => {
      queueMicrotask(cb);
      return 0;
    },
    private readonly cancel: (id: number) => void = (id) => cancelAnimationFrame(id),
  ) {}

  markBusyWindow(ms = BUSY_WINDOW_MS): void {
    this.busyUntil = Math.max(this.busyUntil, this.now() + ms);
  }

  enqueue(id: SfxId, opts: PlaySfxOpts = {}): void {
    const def = SFX_BY_ID[id];
    if (!def) return;
    const step = opts.step ?? 0;
    const key = eventKey(id, step);
    if (this.queued.has(key)) return;
    if (id === 'slide' && [...this.queued.values()].some((e) => e.id === 'merge')) return;
    const t = this.now();
    const last = this.lastPlayed.get(key) ?? -1e9;
    if (t - last < def.cooldownMs) return;
    if (id === 'merge') {
      for (const [k, e] of this.queued) {
        if (e.id === 'slide') this.queued.delete(k);
      }
    }
    this.queued.set(key, {
      id,
      volume: (opts.volume ?? 1) * def.volume,
      rate: 1,
      step,
    });
    if (!this.scheduled) {
      this.scheduled = true;
      this.rafId = this.schedule(() => this.flush());
    }
  }

  flush(): void {
    this.scheduled = false;
    if (this.queued.size === 0) return;
    const t = this.now();
    const cap =
      t < this.busyUntil ? BUSY_MAX_SFX_PER_FRAME : NORMAL_MAX_SFX_PER_FRAME;
    const events = [...this.queued.values()].sort(
      (a, b) => SFX_BY_ID[a.id].priority - SFX_BY_ID[b.id].priority,
    );
    this.queued.clear();
    const kept = events.slice(0, cap);
    for (const e of kept) this.lastPlayed.set(eventKey(e.id, e.step), t);
    if (kept.length) this.flushFn(kept);
  }

  dispose(): void {
    this.queued.clear();
    if (this.scheduled) this.cancel(this.rafId);
    this.scheduled = false;
  }
}
