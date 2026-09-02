import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  HAPTIC_FEEL_DEFAULT,
  mergeAtStep,
  mergePulse,
  nudgePattern,
  nudgePulse,
  slidePulse,
} from './hapticFeel';

const d = HAPTIC_FEEL_DEFAULT;

describe('hapticFeel', () => {
  it('slide is a single base pulse below merge min', () => {
    const s1 = slidePulse(1, 2, d);
    const s3 = slidePulse(3, 2, d);
    assert.equal(s1.intensity, s3.intensity);
    assert.equal(s1.sharpness, s3.sharpness);
    assert.ok(s1.intensity <= mergePulse(4, 2, d).intensity);
  });

  it('merge spans min→max over pitch steps with shared growth', () => {
    const lo = mergePulse(4, 2, d);
    const hi = mergePulse(2048, 2, d);
    const mid = mergePulse(64, 2, d);
    assert.ok(Math.abs(lo.intensity - d.mergeIMin) < 1e-6);
    assert.ok(Math.abs(hi.intensity - d.mergeIMax) < 1e-6);
    assert.ok(lo.intensity < mid.intensity && mid.intensity < hi.intensity);
    assert.ok(lo.sharpness < hi.sharpness);
    assert.equal(mergeAtStep(0, d).intensity, lo.intensity);
    const midT = 4 / 9;
    assert.ok(Math.abs(mid.intensity - (d.mergeIMin + (d.mergeIMax - d.mergeIMin) * midT)) < 1e-6);
  });

  it('nudge uses its own sharpness', () => {
    assert.equal(nudgePulse(2, d).sharpness, d.nudgeS);
  });

  it('nudge pattern hits then decays a continuous tail with the animation', () => {
    const p = nudgePattern(350, 2, d);
    const hit = p.events.find((e) => e.type === 'transient');
    const tail = p.events.find((e) => e.type === 'continuous');
    assert.ok(hit);
    assert.ok(tail);
    assert.ok(Math.abs(hit!.relativeTime - 0.35 * 0.22) < 1e-6);
    assert.ok(tail!.duration && tail!.duration > 0.2);
    assert.ok(p.curves.length >= 1);
    assert.equal(p.curves[0]!.controlPoints.at(-1)?.parameterValue, 0);
  });
});
