import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  evaluateSegment,
  shouldInvalidOnLift,
  type SegmentInput,
} from './swipeSegment.ts';

const base: Omit<SegmentInput, 'dx' | 'dy' | 'axis'> & { axis: null } = {
  lastDir: null,
  axis: null,
  slop: 10,
  commit: 16,
  axisRatio: 1.55,
  sameDirRepeat: false,
};

function ev(partial: Partial<SegmentInput> & Pick<SegmentInput, 'dx' | 'dy'>) {
  return evaluateSegment({ ...base, ...partial });
}

describe('evaluateSegment', () => {
  it('T1a 45° 长滑等待不清段', () => {
    assert.deepEqual(ev({ dx: 80, dy: 80 }), {
      axis: null,
      fire: null,
      consume: false,
    });
  });

  it('T1b 长斜抬手不 invalid', () => {
    assert.equal(
      shouldInvalidOnLift({ lastDir: null, dist: 80, slop: 10, commit: 16 }),
      false,
    );
  });

  it('T2 同段划直后出手右', () => {
    assert.deepEqual(ev({ dx: 12, dy: 12 }), {
      axis: null,
      fire: null,
      consume: false,
    });
    assert.deepEqual(ev({ dx: 40, dy: 12 }), {
      axis: 1,
      fire: 1,
      consume: true,
    });
  });

  it('T3 出手前 relock 竖且 fire 下', () => {
    assert.deepEqual(ev({ axis: 1, dx: 10, dy: 40 }), {
      axis: 0,
      fire: 2,
      consume: true,
    });
  });

  it('T3b 仅 relock 未够 commit', () => {
    assert.deepEqual(ev({ axis: 1, dx: 8, dy: 14 }), {
      axis: 0,
      fire: null,
      consume: false,
    });
  });

  it('T4 同向吞掉', () => {
    const d = ev({ axis: 1, dx: 20, dy: 0, lastDir: 1, sameDirRepeat: false });
    assert.equal(d.fire, null);
    assert.equal(d.consume, true);
  });

  it('T5 同向连走', () => {
    const d = ev({ axis: 1, dx: 20, dy: 0, lastDir: 1, sameDirRepeat: true });
    assert.equal(d.fire, 1);
    assert.equal(d.consume, true);
  });

  it('T6a consume 后轴必须 null 再判下一段', () => {
    assert.deepEqual(ev({ axis: null, lastDir: 1, dx: 10, dy: 40 }), {
      axis: 0,
      fire: 2,
      consume: true,
    });
  });

  it('T9 点按抬手不 invalid', () => {
    assert.equal(
      shouldInvalidOnLift({ lastDir: null, dist: 5, slop: 10, commit: 16 }),
      false,
    );
  });

  it('T10 短滑未出手抬手 invalid', () => {
    assert.equal(
      shouldInvalidOnLift({ lastDir: null, dist: 12, slop: 10, commit: 16 }),
      true,
    );
  });

  it('T10b 已锁但 along 不够不 fire', () => {
    const d = ev({ axis: 1, dx: 12, dy: 0 });
    assert.equal(d.fire, null);
    assert.equal(d.consume, false);
    assert.equal(
      shouldInvalidOnLift({ lastDir: null, dist: 12, slop: 10, commit: 16 }),
      true,
    );
  });

  it('T11 已出手过的短尾巴不 invalid', () => {
    assert.equal(
      shouldInvalidOnLift({ lastDir: 1, dist: 12, slop: 10, commit: 16 }),
      false,
    );
  });

  it('T12 已锁横 dx=0 竖分量够则 relock 下', () => {
    assert.deepEqual(ev({ axis: 1, dx: 0, dy: 20 }), {
      axis: 0,
      fire: 2,
      consume: true,
    });
  });

  it('T12b 已锁横 dx=0 竖分量 < slop 则 along=0 不 fire', () => {
    const d = ev({ axis: 1, dx: 0, dy: 5 });
    assert.equal(d.fire, null);
    assert.equal(d.consume, false);
    assert.equal(d.axis, 1);
  });

  it('T13 axisRatio=1 平手锁竖下', () => {
    assert.deepEqual(ev({ axisRatio: 1, dx: 20, dy: 20 }), {
      axis: 0,
      fire: 2,
      consume: true,
    });
  });

  it('T13b 默认 ratio 平手等待', () => {
    assert.deepEqual(ev({ dx: 20, dy: 20 }), {
      axis: null,
      fire: null,
      consume: false,
    });
  });

  it('T14 抬手同向 consume 不 fire', () => {
    const d = ev({ lastDir: 1, axis: 1, dx: 20, dy: 0 });
    assert.equal(d.consume, true);
    assert.equal(d.fire, null);
  });

  it('手感2 慢滑再远也不出手', () => {
    const d = ev({
      scheme: 2,
      commit: 36,
      speedMin: 400,
      speed: 80,
      dx: 120,
      dy: 0,
    });
    assert.equal(d.fire, null);
    assert.equal(d.consume, false);
    assert.equal(d.axis, 1);
  });

  it('手感2 本按下已出手则不再走', () => {
    const d = ev({
      scheme: 2,
      lastDir: 1,
      commit: 36,
      speedMin: 400,
      speed: 800,
      dx: 80,
      dy: 0,
    });
    assert.equal(d.fire, null);
    assert.equal(d.consume, false);
  });

  it('手感2 够快且约半格出手', () => {
    const d = ev({
      scheme: 2,
      commit: 36,
      speedMin: 400,
      speed: 500,
      dx: 36,
      dy: 0,
    });
    assert.deepEqual(d, { axis: 1, fire: 1, consume: true });
  });
});
