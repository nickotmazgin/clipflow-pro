#!/usr/bin/env python3
"""Original background music for the demo video, synthesised from scratch.

No samples or third-party audio: every sound is generated here, so the track
is free to use anywhere (YouTube, LinkedIn, other social networks) with no
licence or attribution needed. Usage:
  make_music.py <out.wav> <seconds> [seed]
"""
import sys
import wave

import numpy as np

SR = 44100
BPM = 104
BEAT = 60 / BPM
BAR = BEAT * 4
# I–V–vi–IV in C major, voiced around middle C.
CHORDS = [
    (48, [60, 64, 67, 72]),   # C
    (43, [59, 62, 67, 71]),   # G
    (45, [57, 60, 64, 69]),   # Am
    (41, [57, 60, 65, 69]),   # F
]


def hz(note):
    return 440.0 * 2 ** ((note - 69) / 12)


def env(n, attack, release):
    e = np.ones(n)
    a = min(n, int(attack * SR))
    r = min(n - a, int(release * SR))
    if a:
        e[:a] = np.linspace(0, 1, a)
    if r:
        e[n - r:] = np.linspace(1, 0, r)
    return e


def lowpass(x, cutoff):
    alpha = 1 - np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += alpha * (v - acc)
        y[i] = acc
    return y


def pad(notes, dur):
    t = np.arange(int(dur * SR)) / SR
    x = np.zeros_like(t)
    for n in notes:
        for detune in (-0.12, 0.12):
            f = hz(n + detune)
            x += 2 * ((t * f) % 1) - 1
    x = lowpass(x / (len(notes) * 2), 1400)
    return x * env(len(t), 0.25, 0.4)


def pluck(note, dur, rng):
    n = int(dur * SR)
    period = int(SR / hz(note))
    buf = rng.uniform(-1, 1, period)
    out = np.empty(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = 0.996 * 0.5 * (buf[i % period] + buf[(i + 1) % period])
    return out * env(n, 0.002, 0.05)


def bass(note, dur):
    t = np.arange(int(dur * SR)) / SR
    f = hz(note)
    x = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)
    return np.tanh(1.5 * x) * env(len(t), 0.005, 0.06)


def kick():
    t = np.arange(int(0.35 * SR)) / SR
    f = 45 + 80 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def snare(rng):
    t = np.arange(int(0.22 * SR)) / SR
    noise = rng.uniform(-1, 1, len(t))
    noise -= lowpass(noise, 1800)
    return (0.7 * noise + 0.3 * np.sin(2 * np.pi * 190 * t)) * np.exp(-t * 18)


def hat(rng):
    t = np.arange(int(0.05 * SR)) / SR
    noise = rng.uniform(-1, 1, len(t))
    return (noise - lowpass(noise, 7000)) * np.exp(-t * 90)


def add(track, sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= track.shape[0]:
        return
    sig = sig[: track.shape[0] - i]
    track[i:i + len(sig), 0] += sig * gain * (1 - max(0, pan))
    track[i:i + len(sig), 1] += sig * gain * (1 + min(0, pan))


def main():
    out, seconds = sys.argv[1], float(sys.argv[2])
    rng = np.random.default_rng(int(sys.argv[3]) if len(sys.argv) > 3 else 2026)
    bars = int(np.ceil(seconds / BAR)) + 1
    track = np.zeros((int(bars * BAR * SR), 2))
    k, h = kick(), hat(rng)
    pad_cache, pluck_cache, bass_cache = {}, {}, {}
    arp = [0, 1, 2, 3, 2, 1, 2, 3]
    for b in range(bars):
        root, notes = CHORDS[b % 4]
        t0 = b * BAR
        intro, outro = b < 2, b >= bars - 2
        key = tuple(notes)
        if key not in pad_cache:
            pad_cache[key] = pad(notes, BAR)
        add(track, pad_cache[key], t0, 0.22)
        for s in range(8):
            note = notes[arp[s]] + 12
            if note not in pluck_cache:
                pluck_cache[note] = pluck(note, BEAT * 0.9, rng)
            add(track, pluck_cache[note], t0 + s * BEAT / 2, 0.16, pan=0.35 if s % 2 else -0.35)
        if intro:
            continue
        for s in range(8):
            if root not in bass_cache:
                bass_cache[root] = bass(root, BEAT / 2 * 0.9)
            add(track, bass_cache[root], t0 + s * BEAT / 2, 0.30)
            add(track, h, t0 + s * BEAT / 2 + (0.02 if s % 2 else 0), 0.10 if s % 2 else 0.06, pan=0.2)
        if outro:
            continue
        for beat in (0, 2):
            add(track, k, t0 + beat * BEAT, 0.55)
        add(track, k, t0 + 2.5 * BEAT, 0.35)
        for beat in (1, 3):
            add(track, snare(rng), t0 + beat * BEAT, 0.25)
    n = int(seconds * SR)
    track = track[:n]
    fade = min(n, int(3 * SR))
    track[-fade:] *= np.linspace(1, 0, fade)[:, None]
    track[: int(1.5 * SR)] *= np.linspace(0, 1, int(1.5 * SR))[:, None]
    track /= np.max(np.abs(track)) / 0.89
    pcm = (track * 32767).astype('<i2')
    with wave.open(out, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f'Wrote {out} ({seconds:.1f}s, {BPM} BPM)')


if __name__ == '__main__':
    main()
