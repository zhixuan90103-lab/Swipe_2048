import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  boardTravelMs,
  cellsBetween,
  mergeStart,
  popDelayMs,
  tileFontPx,
  tileTravelMs,
  type PaintAnim,
} from './motion';
import type { Tile } from './board';

const per: PaintAnim = { durationMs: 75, easing: 'ease-out', perCell: true };

describe('motion', () => {
  it('路程 3 格是 1 格的三倍时长', () => {
    assert.equal(tileTravelMs({ x: 0, y: 0 }, { x: 1, y: 0 }, per), 75);
    assert.equal(tileTravelMs({ x: 0, y: 0 }, { x: 3, y: 0 }, per), 225);
    assert.equal(cellsBetween({ x: 0, y: 0 }, { x: 3, y: 0 }), 3);
  });

  it('整盘锁等到最远块', () => {
    const a = {
      tiles: [
        { previous: { x: 0, y: 0 }, x: 2, y: 0, mergedFrom: null },
        { previous: { x: 1, y: 1 }, x: 1, y: 1, mergedFrom: null },
      ],
    };
    assert.equal(boardTravelMs(a as never, per), 150);
  });

  it('合并起点取走得更远的源块', () => {
    const t = {
      x: 3,
      y: 0,
      mergedFrom: [
        { previous: { x: 3, y: 0 }, x: 3, y: 0 },
        { previous: { x: 0, y: 0 }, x: 3, y: 0 },
      ],
    } as Tile;
    const { from, travel } = mergeStart(t);
    assert.equal(travel, 3);
    assert.equal(from.x, 0);
  });

  it('弹峰对准该块滑移 60%', () => {
    assert.equal(popDelayMs(225, 200), Math.max(0, Math.round(225 * 0.6) - Math.round(200 * 0.28)));
    assert.equal(popDelayMs(100, 0), 0);
  });

  it('1/2 位同字号，3 位更小', () => {
    assert.equal(tileFontPx(2, 1), tileFontPx(16, 1));
    assert.ok(tileFontPx(128, 1) < tileFontPx(16, 1));
    assert.ok(tileFontPx(1024, 1) < tileFontPx(128, 1));
  });
});
