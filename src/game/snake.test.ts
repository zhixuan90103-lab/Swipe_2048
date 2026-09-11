import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { newSnake, queueSnakeTurn, snakeTickMs, SNAKE_TICK_MIN, SNAKE_TICK_START, stepSnake } from './snake';

describe('snake', () => {
  it('默认向上，掉头不进队', () => {
    const s = newSnake();
    assert.equal(s.dir, 0);
    const t = queueSnakeTurn(s, 2);
    assert.deepEqual(t.queued, []);
    const ok = queueSnakeTurn(s, 1);
    assert.deepEqual(ok.queued, [1]);
  });

  it('最多两步意图，第三下丢掉', () => {
    let s = newSnake();
    s = queueSnakeTurn(s, 1);
    s = queueSnakeTurn(s, 2);
    assert.deepEqual(s.queued, [1, 2]);
    const extra = queueSnakeTurn(s, 3);
    assert.deepEqual(extra.queued, [1, 2]);
  });

  it('相对队列末项禁 180，可先上再右', () => {
    let s = newSnake();
    s = queueSnakeTurn(s, 1);
    const reverseQueued = queueSnakeTurn(s, 3);
    assert.deepEqual(reverseQueued.queued, [1]);
    s = queueSnakeTurn(s, 2);
    assert.deepEqual(s.queued, [1, 2]);
  });

  it('每拍只消耗一个意图', () => {
    let s = newSnake();
    s = queueSnakeTurn(s, 1);
    s = queueSnakeTurn(s, 2);
    s = {
      ...s,
      food: { x: 0, y: 0 },
    };
    s = stepSnake(s);
    assert.equal(s.dir, 1);
    assert.deepEqual(s.queued, [2]);
    s = stepSnake(s);
    assert.equal(s.dir, 2);
    assert.deepEqual(s.queued, []);
  });

  it('一步走一格，吃到变长', () => {
    let s = newSnake();
    s = { ...s, food: { x: s.body[0]!.x, y: s.body[0]!.y - 1 } };
    const len = s.body.length;
    s = stepSnake(s);
    assert.equal(s.body.length, len + 1);
    assert.equal(s.score, 1);
    assert.equal(s.dead, false);
  });

  it('分数越高节拍越短，有下限', () => {
    assert.equal(snakeTickMs(0), SNAKE_TICK_START);
    assert.ok(snakeTickMs(5) < snakeTickMs(0));
    assert.equal(snakeTickMs(99), SNAKE_TICK_MIN);
  });

  it('下一步出界且无转向则立刻死，不停在墙上', () => {
    let s = newSnake();
    s = {
      ...s,
      body: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      ],
      dir: 0,
      queued: [],
    };
    s = stepSnake(s);
    assert.equal(s.dead, true);
    assert.equal(s.body[0]!.y, 0);
  });

  it('刚要出界时直角滑立刻拐走', () => {
    let s = newSnake();
    s = {
      ...s,
      body: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      ],
      dir: 0,
      queued: [],
      food: { x: 5, y: 5 },
    };
    s = queueSnakeTurn(s, 1);
    assert.equal(s.dead, false);
    assert.equal(s.dir, 1);
    assert.equal(s.body[0]!.x, 1);
    assert.equal(s.body[0]!.y, 0);
  });

  it('贴墙时队列里有可走的直角则走那向', () => {
    let s = newSnake();
    s = {
      ...s,
      body: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      ],
      dir: 0,
      queued: [1],
    };
    s = stepSnake(s);
    assert.equal(s.dead, false);
    assert.equal(s.dir, 1);
    assert.equal(s.body[0]!.x, 1);
  });

});
