/** Windowed pointer speed (Android VelocityTracker-style). Not last-frame, not lift-only. */

const WINDOW_MS = 80;
const MIN_DT_MS = 12;
/** 短于 MIN_DT 时，位移够大仍算速度（超级快甩往往 <12ms）。 */
const MIN_DIST_FOR_SHORT_DT = 8;
/** 抬手揭指：不算进速度窗的末尾（ms）。慢滑 + 抬手假甩不应出手。 */
export const LIFT_SPEED_TAIL_MS = 32;
/** 整段按下短于此则不剥揭指尾巴（快甩本身就在末 32ms 里）。 */
export const LIFT_TAIL_MIN_HOLD_MS = 120;

export function liftTailMs(holdMs: number): number {
  return holdMs >= LIFT_TAIL_MIN_HOLD_MS ? LIFT_SPEED_TAIL_MS : 0;
}

type Sample = { t: number; x: number; y: number };

export type AxisSpeed = { x: number; y: number; ok: boolean };

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
    /**
     * client px / s，窗内净位移 / 时间。样本不足则为 0。
     * `ignoreTailMs`：丢掉此刻之前这一段样本（抬手揭指）。
     */
    axisSpeed(now = samples.length ? samples[samples.length - 1].t : 0, ignoreTailMs = 0): AxisSpeed {
      const cutoff = now - ignoreTailMs;
      let i0 = 0;
      let i1 = samples.length - 1;
      while (i0 < samples.length && now - samples[i0]!.t > WINDOW_MS) i0 += 1;
      while (i1 >= i0 && samples[i1]!.t > cutoff) i1 -= 1;
      if (i1 - i0 < 1) return { x: 0, y: 0, ok: false };
      const a = samples[i0]!;
      const b = samples[i1]!;
      const dt = b.t - a.t;
      if (dt <= 0) return { x: 0, y: 0, ok: false };
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      if (dt < MIN_DT_MS && dist < MIN_DIST_FOR_SHORT_DT) {
        return { x: 0, y: 0, ok: false };
      }
      const k = 1000 / dt;
      return { x: (b.x - a.x) * k, y: (b.y - a.y) * k, ok: true };
    },
  };
}

export function alongSpeed(spd: AxisSpeed, axis: 0 | 1): number {
  return Math.abs(axis === 1 ? spd.x : spd.y);
}
