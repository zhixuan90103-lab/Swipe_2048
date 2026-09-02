import { Capacitor } from '@capacitor/core';
import { AudioBatcher } from './AudioBatcher';
import { SFX_BY_ID, type PlaySfxOpts, type SfxEvent, type SfxId } from './AudioCatalog';
import { IosBackend } from './IosBackend';
import { WebBackend } from './WebBackend';

type Backend = {
  preload(): Promise<void>;
  unlock(): void;
  setMasterVolume(v: number): void;
  flushSfx(events: SfxEvent[]): void;
  stopAll(): void;
  resume(): void;
};

const nativeIos =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

class AudioManager {
  private backend: Backend;
  private batcher: AudioBatcher;
  private enabled = true;
  private ready = false;
  private pending: { id: SfxId; opts: PlaySfxOpts }[] = [];

  constructor() {
    this.backend = nativeIos ? new IosBackend() : new WebBackend();
    this.batcher = new AudioBatcher((events) => this.backend.flushSfx(events));
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
