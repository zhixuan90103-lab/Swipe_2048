/** Windowed pointer speed (Android VelocityTracker-style). Not last-frame, not lift-only. */

const WINDOW_MS = 80;
const MIN_DT_MS = 12;

type Sample = { t: number; x: number; y: number };

export type AxisSpeed = { x: number; y: number };

export function createVelocityWindow() {
  const samples: Sample[] = [];

  const trim = (now: number) => {
    while (samples.length > 0 && now - samples[0].t > WINDOW_MS) {
      samples.shift();
    }
  };

  return {
    reset(t: number, x: number, y: number) {
      samples.length = 0;
      samples.push({ t, x, y });
    },
    push(t: number, x: number, y: number) {
      if (samples.length > 0) {
        const last = samples[samples.length - 1];
        if (t <= last.t) return;
      }
      samples.push({ t, x, y });
      trim(t);
    },
    /** client px / s，窗内净位移 / 时间。样本不足则为 0。 */
    axisSpeed(): AxisSpeed {
      if (samples.length < 2) return { x: 0, y: 0 };
      const a = samples[0];
      const b = samples[samples.length - 1];
      const dt = b.t - a.t;
      if (dt < MIN_DT_MS) return { x: 0, y: 0 };
      const k = 1000 / dt;
      return { x: (b.x - a.x) * k, y: (b.y - a.y) * k };
    },
  };
}

export function alongSpeed(spd: AxisSpeed, axis: 0 | 1): number {
  return Math.abs(axis === 1 ? spd.x : spd.y);
}
