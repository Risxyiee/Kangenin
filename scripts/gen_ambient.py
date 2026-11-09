"""Generate musik ambient lo-fi 30 detik untuk video Kangenin (royalty-free).
Progresi: Am7 -> Fmaj7 -> Cmaj9 -> Gadd9, sine pads + bass + sparkle.
Output: kangenin-video/public/audio/ambient.wav (44100 Hz, 16-bit stereo).
"""
import numpy as np
import wave

SR = 44100
DUR = 30.0
N = int(SR * DUR)
t = np.arange(N) / SR

# ── Chords (bass, pad notes) ────────────────────────────────────────────────
chords = [
    (110.00, [220.00, 261.63, 329.63, 392.00]),   # Am7
    (87.31,  [174.61, 220.00, 261.63, 329.63]),   # Fmaj7
    (130.81, [164.81, 196.00, 246.94, 293.66]),   # Cmaj9
    (98.00,  [196.00, 246.94, 293.66, 440.00]),   # Gadd9
]
seg = DUR / len(chords)  # 7.5 s per chord


def env_ar(n_len, attack, release, sr=SR):
    """Attack-release envelope sederhana."""
    e = np.ones(n_len)
    na = int(attack * sr)
    nr = int(release * sr)
    if na > 0:
        e[:na] = np.linspace(0, 1, na)
    if nr > 0:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def pad_voice(freq, detune, start, end):
    """Satin pad: sine utama + oktaf lembut + pasangan detune (chorus)."""
    i0, i1 = int(start * SR), int(end * SR)
    n = i1 - i0
    tt = np.arange(n) / SR
    f = freq * (1 + detune)
    v = np.sin(2 * np.pi * f * tt)
    v += 0.35 * np.sin(2 * np.pi * f * 2 * tt)      # oktaf, lembut
    v += 0.18 * np.sin(2 * np.pi * f * 0.5 * tt)    # sub, warm
    e = env_ar(n, attack=1.6, release=1.8)
    return i0, v * e


def render_channel(detune_pad, detune_pad2):
    out = np.zeros(N)
    for ci, (bass, pads) in enumerate(chords):
        start = ci * seg
        end = min((ci + 1) * seg + 1.2, DUR)  # overlap crossfade antar chord
        for pi, pf in enumerate(pads):
            g = 0.16 if pi < 3 else 0.11
            i0, v = pad_voice(pf, detune_pad, start, end)
            out[i0:i0 + len(v)] += g * v
        # pasangan detune kedua biar lebar
        for pi, pf in enumerate(pads):
            g = 0.10 if pi < 3 else 0.07
            i0, v = pad_voice(pf, detune_pad2, start, end)
            out[i0:i0 + len(v)] += g * v
        # bass
        i0, v = pad_voice(bass, 0.0, start, end)
        out[i0:i0 + len(v)] += 0.22 * v
    return out


L = render_channel(+0.0016, -0.0009)
R = render_channel(-0.0016, +0.0011)

# ── Sparkle: nada tinggi lembut tiap 2.5 dtk ────────────────────────────────
sparks = [659.26, 880.00, 523.25, 783.99, 659.26, 880.00, 987.77, 659.26,
          523.25, 880.00, 1046.50, 783.99]
for si, sf in enumerate(sparks):
    st = 0.8 + si * 2.5
    if st > DUR - 1.5:
        break
    i0 = int(st * SR)
    n = int(1.4 * SR)
    tt = np.arange(n) / SR
    v = np.sin(2 * np.pi * sf * tt) * np.exp(-3.2 * tt) * 0.045
    idx = i0 + np.arange(n)
    valid = idx < N
    L[idx[valid]] += v[valid] * 0.9
    R[idx[valid]] += v[valid] * 1.1

# ── Master: fade in/out + normalisasi + dither kecil ────────────────────────
master_fade = env_ar(N, attack=1.5, release=2.8)
L *= master_fade
R *= master_fade
peak = max(np.abs(L).max(), np.abs(R).max())
L = L / peak * 0.30
R = R / peak * 0.30

data = np.empty((N, 2), dtype=np.int16)
data[:, 0] = np.clip(L * 32767, -32768, 32767).astype(np.int16)
data[:, 1] = np.clip(R * 32767, -32768, 32767).astype(np.int16)

with wave.open("/home/z/my-project/kangenin-video/public/audio/ambient.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(data.tobytes())

print(f"ambient.wav: {DUR}s, peak {peak:.3f} -> 0.30, {N} samples")
