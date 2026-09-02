import { Capacitor } from '@capacitor/core';
import { AudioBatcher } from './AudioBatcher';
import {
  SFX_BY_ID,
  isSfxPack,
  type PlaySfxOpts,
  type SfxEvent,
  type SfxId,
  type SfxPack,
} from './AudioCatalog';
import { IosBackend } from './IosBackend';
import { WebBackend } from './WebBackend';

const PACK_KEY = 'swipe2048.sfx.pack';

type Backend = {
  preload(): Promise<void>;
  unlock(): void;
  setMasterVolume(v: number): void;
  flushSfx(events: SfxEvent[]): void;
  stopAll(): void;
  resume(): void;
  setPack?(pack: SfxPack): void;
  ensurePack?(pack: SfxPack): Promise<void>;
};

function readPack(): SfxPack {
  try {
    const n = Number(localStorage.getItem(PACK_KEY));
    return isSfxPack(n) ? n : 2;
  } catch {
    return 2;
  }
}

const nativeIos =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

class AudioManager {
  private backend: Backend;
  private batcher: AudioBatcher;
  private enabled = true;
  private ready = false;
  private pack: SfxPack = readPack();
  private pending: { id: SfxId; opts: PlaySfxOpts }[] = [];

  constructor() {
    this.backend = nativeIos ? new IosBackend() : new WebBackend();
    this.backend.setPack?.(this.pack);
    this.batcher = new AudioBatcher((events) => this.backend.flushSfx(events));
  }

  getPack(): SfxPack {
    return this.pack;
  }

  setPack(pack: SfxPack): void {
    this.pack = isSfxPack(pack) ? pack : 2;
    this.backend.setPack?.(this.pack);
    void this.backend.ensurePack?.(this.pack);
    try {
      localStorage.setItem(PACK_KEY, String(this.pack));
    } catch {
      /* ignore */
    }
  }

  async preload(): Promise<void> {
    try {
      await this.backend.preload();
    } catch (err) {
      console.warn('[audio] preload', err);
    }
    this.ready = true;
    for (const p of this.pending) this.batcher.enqueue(p.id, p.opts);
    this.pending = [];
  }

  unlock(): void {
    this.backend.unlock();
  }

  playSfx(id: SfxId, opts: PlaySfxOpts = {}): void {
    if (!this.enabled) return;
    if (!SFX_BY_ID[id]) return;
    if (!this.ready) {
      this.pending.push({ id, opts });
      return;
    }
    this.batcher.enqueue(id, opts);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.backend.stopAll();
  }

  setMasterVolume(v: number): void {
    this.backend.setMasterVolume(v);
  }

  dispose(): void {
    this.pending = [];
    this.batcher.dispose();
    this.backend.stopAll();
  }
}

export const audio = new AudioManager();
