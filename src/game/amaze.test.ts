import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dirsArePerpendicular,
  flightPivotIndex,
  generateAmaze,
  isFloor,
  moveAmaze,
  slideAmaze,
} from './amaze';

describe('amaze', () => {
  it('滑到区域边界停下', () => {
    const s = generateAmaze(1, 1);
    s.floor.fill(0);
    s.floor[1 * s.w + 1] = 1;
    s.floor[1 * s.w + 2] = 1;
    s.floor[1 * s.w + 3] = 1;
    s.x = 1;
    s.y = 1;
    const sl = slideAmaze(s, 1, 1, 1);
    assert.equal(sl.x, 3);
    assert.equal(sl.moved, true);
    assert.equal(isFloor(s, 4, 1), false);
  });

  it('路过涂色，再走同一路不重复计数', () => {
    const s = generateAmaze(1, 7);
    s.floor.fill(0);
    s.y = 1;
    s.x = 0;
    s.startX = 0;
    s.startY = 1;
    for (let x = 0; x < 3; x++) s.floor[1 * s.w + x] = 1;
    s.total = 99;
    s.painted.fill(0);
    s.painted[1 * s.w + 0] = 1;
    s.paintedCount = 1;
    s.won = false;
    const r = moveAmaze(s, 1);
    assert.equal(r.state.x, 2);
    assert.ok(r.moved);
    assert.equal(r.state.moves, 1);
    assert.equal(r.state.paintedCount, 3);
    const back = moveAmaze(r.state, 3);
    assert.equal(back.state.x, 0);
    assert.equal(back.state.paintedCount, 3);
    assert.equal(back.state.moves, 2);
  });

  it('障碍格不能走进去，可走格仍连通', () => {
    const m = generateAmaze(1, 20);
    assert.ok(m.total < 7 * 9);
    assert.equal(m.floor[m.y * m.w + m.x], 1);
    const sl = slideAmaze(m, m.x, m.y, 0);
    if (sl.moved) {
      assert.equal(m.floor[sl.y * m.w + sl.x], 1);
    }
  });

  it('撞障碍停下', () => {
    const s = generateAmaze(1, 1);
    s.floor.fill(1);
    s.floor[1 * s.w + 4] = 0;
    s.x = 1;
    s.y = 1;
    const sl = slideAmaze(s, 1, 1, 1);
    assert.equal(sl.x, 3);
    assert.equal(sl.moved, true);
  });

  it('90° 为垂直，180° 不是', () => {
    assert.equal(dirsArePerpendicular(0, 1), true);
    assert.equal(dirsArePerpendicular(0, 2), false);
    assert.equal(dirsArePerpendicular(1, 3), false);
  });

  it('飞行轴上取将到达的格，不后退', () => {
    assert.equal(flightPivotIndex(0, 20, 4), -1);
    assert.equal(flightPivotIndex(1, 20, 4), 0);
    assert.equal(flightPivotIndex(20, 20, 4), 0);
    assert.equal(flightPivotIndex(21, 20, 4), 1);
    assert.equal(flightPivotIndex(1000, 20, 4), 3);
  });
});
