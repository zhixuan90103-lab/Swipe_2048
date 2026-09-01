import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { alongSpeed, createVelocityWindow } from './swipeVelocity.ts';

describe('velocity window', () => {
  it('样本不足为 0', () => {
    const v = createVelocityWindow();
    v.reset(0, 0, 0);
    assert.deepEqual(v.axisSpeed(), { x: 0, y: 0 });
  });

  it('80ms 窗内沿轴净位移 / 时间', () => {
    const v = createVelocityWindow();
    v.reset(0, 0, 0);
    v.push(40, 20, 0);
    const s = v.axisSpeed();
    assert.equal(Math.round(s.x), 500);
    assert.equal(s.y, 0);
    assert.equal(alongSpeed(s, 1), 500);
    assert.equal(alongSpeed(s, 0), 0);
  });

  it('超出窗的旧点丢掉，慢爬速度掉下来', () => {
    const v = createVelocityWindow();
    v.reset(0, 0, 0);
    v.push(40, 40, 0);
    v.push(200, 42, 0);
    const s = v.axisSpeed();
    assert.ok(Math.abs(s.x) < 80);
  });
});
