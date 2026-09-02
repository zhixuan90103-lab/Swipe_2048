#!/usr/bin/env python3
"""iOS long-press icon pop: ~2 kHz dry tick, ~90 ms, almost no tail."""

from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

FS = 44100
PI2 = 2.0 * math.pi


def env(t: float, attack: float, decay: float) -> float:
    if t < 0:
        return 0.0
    if t < attack:
        x = t / max(attack, 1e-5)
        return x * x * (3 - 2 * x)
    return math.exp(-(t - attack) / max(decay, 1e-4))


def pop(hz: float, dur: float, *, peak: float = 0.42, thud: float = 0.18) -> list[float]:
    n = int(dur * FS)
    out = [0.0] * n
    for i in range(n):
        t = i / FS
        # Round the hit: 8ms attack is what kills "sharp", pitch stays hz.
        e = env(t, 0.008, 0.055)
        s = math.sin(PI2 * hz * t) * math.exp(-t * 26)
        s += thud * math.sin(PI2 * 150 * t) * math.exp(-t * 28)
        out[i] = s * e
    a_lp = math.exp(-PI2 * 2200 / FS)
    y = y2 = y3 = 0.0
    for i, x in enumerate(out):
        y = (1 - a_lp) * x + a_lp * y
        y2 = (1 - a_lp) * y + a_lp * y2
        y3 = (1 - a_lp) * y2 + a_lp * y3
        out[i] = y3
    mx = max((abs(v) for v in out), default=1.0) or 1.0
    g = peak / mx
    return [v * g for v in out]


def mix(*parts: tuple[list[float], int]) -> list[float]:
    length = max(off + len(buf) for buf, off in parts)
    out = [0.0] * length
    for buf, off in parts:
        for i, v in enumerate(buf):
            out[off + i] += v
    mx = max((abs(v) for v in out), default=1.0) or 1.0
    if mx > 0.45:
        s = 0.45 / mx
        out = [v * s for v in out]
    return out


def write_wav(path: Path, buf: list[float]) -> None:
    fade = min(int(0.006 * FS), len(buf) // 5)
    for i in range(fade):
        buf[-fade + i] *= 1.0 - (i + 1) / fade
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(FS)
        frames = bytearray()
        rng = random.Random(3)
        for v in buf:
            d = (rng.random() + rng.random()) - 1.0
            x = max(-1.0, min(1.0, v + d / 32768.0))
            frames += struct.pack("<h", int(x * 32767.0))
        w.writeframes(bytes(frames))


def main() -> None:
    dest = Path(__file__).resolve().parents[1] / "public" / "sfx" / "v3"
    # ~2 kHz base (screen recording autocorr ≈ 2004 Hz), then C-major steps.
    base = 2004.0
    ratios = (1.0, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8, 2.0, 9 / 4, 5 / 2)
    for i, r in enumerate(ratios):
        hz = min(base * r, 3200)
        buf = pop(hz, 0.11, peak=0.42 if i == 0 else 0.38, thud=0.22)
        write_wav(dest / f"merge-{i:02d}.wav", buf)
        if i == 0:
            write_wav(dest / "merge.wav", buf)
    write_wav(dest / "ui.wav", pop(2004, 0.08, peak=0.26, thud=0.16))
    write_wav(dest / "nudge.wav", pop(1480, 0.12, peak=0.34, thud=0.28))
    write_wav(dest / "spawn.wav", pop(2240, 0.09, peak=0.20, thud=0.12))
    write_wav(
        dest / "over.wav",
        mix((pop(1680, 0.12, peak=0.26, thud=0.22), 0), (pop(1260, 0.14, peak=0.24, thud=0.26), int(0.06 * FS))),
    )
    write_wav(
        dest / "win.wav",
        mix((pop(2004, 0.10, peak=0.30, thud=0.18), 0), (pop(2520, 0.11, peak=0.28, thud=0.14), int(0.055 * FS))),
    )
    for name in ("merge-00", "ui", "nudge"):
        p = dest / f"{name}.wav" if name != "merge-00" else dest / "merge-00.wav"
        print(name, p.stat().st_size)


if __name__ == "__main__":
    main()
