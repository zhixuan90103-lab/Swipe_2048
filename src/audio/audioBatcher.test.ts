import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AudioBatcher } from './AudioBatcher';
import type { SfxEvent } from './AudioCatalog';

describe('AudioBatcher', () => {
  it('同 id 本帧只留先到的一次', () => {
    const flushed: SfxEvent[][] = [];
    let t = 1000;
    const cbs: Array<() => void> = [];
    const b = new AudioBatcher(
      (e) => flushed.push(e),
      () => t,
      (cb) => {
        cbs.push(cb);
        return cbs.length;
      },
      () => undefined,
    );
    b.enqueue('slide', { volume: 1 });
    b.enqueue('slide', { volume: 2 });
    cbs.pop()?.();
    assert.equal(flushed.length, 1);
    assert.equal(flushed[0]!.length, 1);
    assert.equal(flushed[0]![0]!.id, 'slide');
  });

  it('cooldown 内丢掉第二次', () => {
    const flushed: SfxEvent[][] = [];
    let t = 0;
    const cbs: Array<() => void> = [];
    const b = new AudioBatcher(
      (e) => flushed.push(e),
      () => t,
      (cb) => {
        cbs.push(cb);
        return 1;
      },
      () => undefined,
    );
    b.enqueue('nudge');
    cbs.pop()?.();
    t = 40;
    b.enqueue('nudge');
    assert.equal(cbs.length, 0);
    assert.equal(flushed.length, 1);
  });

  it('忙窗口截成更少条，且优先高优先级', () => {
    const flushed: SfxEvent[][] = [];
    let t = 0;
    const cbs: Array<() => void> = [];
    const b = new AudioBatcher(
      (e) => flushed.push(e),
      () => t,
      (cb) => {
        cbs.push(cb);
        return 1;
      },
      () => undefined,
    );
    b.markBusyWindow(260);
    b.enqueue('spawn');
    b.enqueue('merge');
    b.enqueue('slide');
    b.enqueue('win');
    b.enqueue('nudge');
    cbs.pop()?.();
    const ids = flushed[0]!.map((e) => e.id);
    assert.equal(ids.length, 3);
    assert.deepEqual(ids, ['win', 'merge', 'nudge']);
  });

  it('不同合并档同一帧都保留', () => {
    const flushed: SfxEvent[][] = [];
    let t = 0;
    const cbs: Array<() => void> = [];
    const b = new AudioBatcher(
      (e) => flushed.push(e),
      () => t,
      (cb) => {
        cbs.push(cb);
        return 1;
      },
      () => undefined,
    );
    b.enqueue('merge', { step: 0 });
    b.enqueue('merge', { step: 1 });
    cbs.pop()?.();
    assert.equal(flushed[0]!.length, 2);
    assert.deepEqual(
      flushed[0]!.map((e) => e.step).sort(),
      [0, 1],
    );
  });
});
