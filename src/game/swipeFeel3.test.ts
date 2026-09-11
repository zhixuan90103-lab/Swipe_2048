import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateFeel3, snapCardinal } from './swipeFeel3.ts';

describe('evaluateFeel3', () => {
  it('atan2 扇区切四向', () => {
    assert.equal(snapCardinal(10, 0), 1);
    assert.equal(snapCardinal(0, 10), 2);
    assert.equal(snapCardinal(-10, 0), 3);
    assert.equal(snapCardinal(0, -10), 0);
  });

  it('死区内不认', () => {
    const d = evaluateFeel3({ dx: 2, dy: 0, lastDir: null, slop: 4, hystDeg: 14 });
    assert.equal(d.fire, null);
  });

  it('过死区认最近向', () => {
    const d = evaluateFeel3({ dx: 12, dy: 2, lastDir: null, slop: 4, hystDeg: 14 });
    assert.equal(d.fire, 1);
    assert.equal(d.consume, true);
  });

  it('滞回：略过对角线不换向', () => {
    const d = evaluateFeel3({
      dx: 10,
      dy: 12,
      lastDir: 1,
      slop: 4,
      hystDeg: 14,
    });
    assert.equal(d.fire, null);
  });

  it('明显越过对角线才换向', () => {
    const d = evaluateFeel3({
      dx: 4,
      dy: 20,
      lastDir: 1,
      slop: 4,
      hystDeg: 14,
    });
    assert.equal(d.fire, 2);
  });

  it('短窗优先于整段', () => {
    const d = evaluateFeel3({
      dx: 40,
      dy: 0,
      winDx: 0,
      winDy: -20,
      lastDir: 1,
      slop: 4,
      hystDeg: 14,
    });
    assert.equal(d.fire, 0);
  });
});
