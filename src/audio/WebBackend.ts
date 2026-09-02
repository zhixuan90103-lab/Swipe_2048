import {
  SFX_BY_ID,
  isNoteId,
  preloadItems,
  sfxBufferId,
  type SfxEvent,
} from './AudioCatalog';

function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || './';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}${path.replace(/^\//, '')}`;
}

export class WebBackend {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private voices = new Map<string, number>();
  private live: { src: AudioBufferSourceNode; gain: GainNode }[] = [];
  private loading = new Map<string, Promise<void>>();

  async preload(): Promise<void> {
    await Promise.all(preloadItems().map((it) => this.loadOne(it.id, it.path)));
  }

  private loadOne(key: string, path: string): Promise<void> {
    if (this.buffers.has(key)) return Promise.resolve();
    const hit = this.loading.get(key);
    if (hit) return hit;
    const job = (async () => {
      try {
        const ctx = this.ensureCtx();
        const res = await fetch(assetUrl(path));
        if (!res.ok) throw new Error(`${res.status} ${path}`);
        const raw = await res.arrayBuffer();
        if (raw.byteLength < 44) throw new Error(`short ${path}`);
        this.buffers.set(key, await ctx.decodeAudioData(raw.slice(0)));
      } catch (err) {
        console.warn('[audio] skip', key, err);
      } finally {
        this.loading.delete(key);
      }
    })();
    this.loading.set(key, job);
    return job;
  }

  unlock(): void {
    const ctx = this.ensureCtx();
    if (ctx.state === 'suspended') void ctx.resume();
  }

  setMasterVolume(v: number): void {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v));
  }

  flushSfx(events: SfxEvent[]): void {
    const ctx = this.ensureCtx();
    if (ctx.state === 'suspended') void ctx.resume();
    const missing = events.some((e) => !this.buffers.has(sfxBufferId(1, e.id, e.step)));
    if (missing) {
      void this.preload().then(() => {
        for (const e of events) this.playOne(e);
      });
      return;
    }
    for (const e of events) this.playOne(e);
  }

  stopAll(): void {
    if (this.ctx) this.ctx.suspend().catch(() => undefined);
  }

  resume(): void {
    if (this.ctx) void this.ctx.resume();
  }

  private playOne(e: SfxEvent): void {
    const key = sfxBufferId(1, e.id, e.step);
    const buf = this.buffers.get(key);
    const ctx = this.ctx;
    const gainBus = this.sfxGain;
    if (!buf || !ctx || !gainBus) return;
    const n = this.voices.get(key) ?? 0;
    const cap = SFX_BY_ID[e.id]?.maxVoices ?? 1;
    if (n >= cap) return;
    const now = ctx.currentTime;
    if (isNoteId(e.id)) {
      const steal = 0.018;
      for (const v of this.live) {
        v.gain.gain.cancelScheduledValues(now);
        v.gain.gain.setValueAtTime(v.gain.gain.value, now);
        v.gain.gain.linearRampToValueAtTime(0, now + steal);
        try {
          v.src.stop(now + steal + 0.008);
        } catch {
          /* already stopped */
        }
      }
      this.live = [];
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = Math.max(0, Math.min(1, e.volume));
    src.connect(g);
    g.connect(gainBus);
    this.voices.set(key, n + 1);
    if (isNoteId(e.id)) this.live.push({ src, gain: g });
    src.onended = () => {
      this.voices.set(key, Math.max(0, (this.voices.get(key) ?? 1) - 1));
      this.live = this.live.filter((x) => x.src !== src);
    };
    src.start();
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(this.master);
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }
}
