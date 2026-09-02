import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateAmaze, isFloor, moveAmaze, slideAmaze } from './amaze';

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

  it('滑过不涂色', () => {
    const s = generateAmaze(1, 7);
    s.floor.fill(1);
    s.x = 1;
    s.y = 1;
    const r = moveAmaze(s, 1);
    assert.equal(r.state.x, s.w - 1);
    assert.ok(r.moved);
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
});
