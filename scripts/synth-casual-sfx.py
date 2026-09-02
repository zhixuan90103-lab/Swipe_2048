#!/usr/bin/env python3
"""Soft piano one-shots. Merge sample is C4; gameplay raises one semitone per tile.

44.1 kHz 16-bit mono. Hammer + inharmonic string, rolled off ~2.8 kHz.
"""

from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

FS = 44100
PI2 = 2.0 * math.pi
C4 = 261.63


def env_ad(t: float, attack: float, decay: float) -> float:
    if t < 0:
        return 0.0
    if t < attack:
        x = t / max(attack, 1e-5)
        return x * x * (3 - 2 * x)
    return math.exp(-(t - attack) / max(decay, 1e-4))


def onepole(buf: list[float], cutoff: float) -> list[float]:
    a = math.exp(-PI2 * cutoff / FS)
    y = 0.0
    out = [0.0] * len(buf)
    for i, x in enumerate(buf):
        y = (1 - a) * x + a * y
        out[i] = y
    return out


def piano(
    freq: float,
    dur: float,
    *,
    attack: float = 0.003,
    decay: float = 0.42,
    hammer: float = 0.14,
    brightness: float = 0.85,
    peak: float = 0.36,
    cutoff: float = 2800.0,
    seed: int = 1,
) -> list[float]:
    n = int(dur * FS)
    rng = random.Random(seed + int(freq))
    out = [0.0] * n
    # Inharmonicity ~ upright piano
    b = 0.00035
    ham_n = int(0.008 * FS)
    for i in range(n):
        t = i / FS
        e = env_ad(t, attack, decay)
        s = 0.0
        for k in range(1, 8):
            fn = freq * k * math.sqrt(1.0 + b * k * k)
            # Odd partials a bit stronger (felt piano).
            g = (1.15 if k % 2 else 0.7) / (k ** 1.35)
            g *= brightness if k > 2 else 1.0
            die = 0.55 + 0.5 * (k - 1)
            s += g * math.sin(PI2 * fn * t) * math.exp(-t * die / max(decay, 0.08))
        if i < ham_n:
            nt = 1.0 - i / ham_n
            s += hammer * (rng.random() * 2 - 1) * nt * nt
        out[i] = s * e

    out = onepole(onepole(out, cutoff), cutoff)

    r = 0.995
    x1 = y1 = 0.0
    for i, x in enumerate(out):
        y = x - x1 + r * y1
        x1, y1 = x, y
        out[i] = y

    mx = max((abs(v) for v in out), default=1.0) or 1.0
    g = peak / mx
    return [v * g for v in out]


def mix(*parts: tuple[list[float], int]) -> list[float]:
    length = 0
    for buf, off in parts:
        length = max(length, off + len(buf))
    out = [0.0] * length
    for buf, off in parts:
        for i, v in enumerate(buf):
            out[off + i] += v
    mx = max((abs(v) for v in out), default=1.0) or 1.0
    if mx > 0.44:
        s = 0.44 / mx
        out = [v * s for v in out]
    return out


def trim(buf: list[float], floor: float = 0.0007) -> list[float]:
    end = len(buf)
    while end > 64 and abs(buf[end - 1]) < floor:
        end -= 1
    fade = min(int(0.012 * FS), end // 4)
    for i in range(fade):
        buf[end - fade + i] *= 1.0 - (i + 1) / fade
    return buf[:end]


def write_wav(path: Path, buf: list[float]) -> None:
    buf = trim(buf)
    rng = random.Random(7)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(FS)
        frames = bytearray()
        for v in buf:
            d = (rng.random() + rng.random()) - 1.0
            x = max(-1.0, min(1.0, v + d / 32768.0))
            frames += struct.pack("<h", int(x * 32767.0))
        w.writeframes(bytes(frames))


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    dest = root / "public" / "sfx" / "v1"

    # One rendered note per merge step (C major). No playback-rate stretch.
    merge_hz = (
        261.63,
        293.66,
        329.63,
        349.23,
        392.00,
        440.00,
        493.88,
        523.25,
        587.33,
        659.25,
    )
    for i, hz in enumerate(merge_hz):
        buf = piano(hz, 0.78, decay=0.55, brightness=0.78, peak=0.38, cutoff=2500, seed=20 + i)
        write_wav(dest / f"merge-{i:02d}.wav", buf)
        if i == 0:
            write_wav(dest / "merge.wav", buf)
    write_wav(
        dest / "slide.wav",
        piano(C4 * 0.84, 0.55, decay=0.36, hammer=0.10, brightness=0.62, peak=0.34, cutoff=2200, seed=3),
    )
    write_wav(
        dest / "spawn.wav",
        piano(C4 * 1.25, 0.22, decay=0.12, hammer=0.07, brightness=0.55, peak=0.16, cutoff=2200, seed=4),
    )
    write_wav(
        dest / "nudge.wav",
        piano(C4 * 0.75, 0.40, decay=0.22, hammer=0.16, brightness=0.5, peak=0.34, cutoff=2000, seed=5),
    )
    write_wav(
        dest / "ui.wav",
        piano(C4 * 1.5, 0.12, decay=0.05, hammer=0.06, brightness=0.5, peak=0.16, cutoff=2400, seed=6),
    )
    write_wav(
        dest / "over.wav",
        mix(
            (piano(C4, 0.40, decay=0.28, brightness=0.5, peak=0.24, cutoff=2000, seed=7), 0),
            (piano(C4 * 0.75, 0.48, decay=0.34, brightness=0.4, peak=0.22, cutoff=1700, seed=8), int(0.12 * FS)),
        ),
    )
    write_wav(
        dest / "win.wav",
        mix(
            (piano(C4, 0.36, decay=0.26, brightness=0.7, peak=0.26, cutoff=2400, seed=9), 0),
            (piano(C4 * 1.25, 0.40, decay=0.28, brightness=0.75, peak=0.24, cutoff=2500, seed=10), int(0.09 * FS)),
            (piano(C4 * 1.5, 0.44, decay=0.30, brightness=0.7, peak=0.22, cutoff=2500, seed=11), int(0.18 * FS)),
        ),
    )

    for name in ("slide", "merge", "spawn", "nudge", "ui", "over", "win"):
        src = dest / f"{name}.wav"
        (root / "public" / "sfx" / f"{name}.wav").write_bytes(src.read_bytes())
        print(f"{name:6}  {src.stat().st_size:5} bytes")


if __name__ == "__main__":
    main()
