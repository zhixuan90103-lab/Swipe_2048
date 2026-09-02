import { Capacitor, registerPlugin } from '@capacitor/core';
import { SFX_PACKS, preloadItems, sfxBufferId, type SfxEvent, type SfxPack } from './AudioCatalog';

type NativeAudioPlugin = {
  preloadCatalog(opts: {
    items: { id: string; path: string; volume: number; cooldownMs: number; maxVoices: number }[];
  }): Promise<void>;
  flushSfx(opts: { events: { id: string; volume: number; rate: number }[] }): Promise<void>;
  setMasterVolume(opts: { volume: number }): Promise<void>;
  stopAll(): Promise<void>;
  resume(): Promise<void>;
};

const NativeAudio = registerPlugin<NativeAudioPlugin>('NativeAudio');

export class IosBackend {
  private pack: SfxPack = 2;

  setPack(pack: SfxPack): void {
    this.pack = pack;
  }

  async preload(): Promise<void> {
    if (!Capacitor.isPluginAvailable('NativeAudio')) {
      console.warn('[audio] NativeAudio plugin unavailable');
      return;
    }
    const items = SFX_PACKS.flatMap((p) => preloadItems(p.id));
    try {
      await NativeAudio.preloadCatalog({ items });
    } catch (err) {
      console.warn('[audio] ios preload', err);
    }
  }

  unlock(): void {
    void NativeAudio.resume?.().catch(() => undefined);
  }

  setMasterVolume(v: number): void {
    void NativeAudio.setMasterVolume({ volume: v }).catch(() => undefined);
  }

  flushSfx(events: SfxEvent[]): void {
    void NativeAudio.flushSfx({
      events: events.map((e) => ({
        id: sfxBufferId(this.pack, e.id, e.step),
        volume: e.volume,
        rate: 1,
      })),
    });
  }

  stopAll(): void {
    void NativeAudio.stopAll().catch(() => undefined);
  }

  resume(): void {
    void NativeAudio.resume().catch(() => undefined);
  }
}
