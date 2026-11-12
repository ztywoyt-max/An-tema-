"""Sintetiza todos os sons do jogo (efeitos, ambiente e uma música curta).

Uso:  python gerar_audio.py <pasta_de_saida>
Dependências: numpy, scipy; ffmpeg (para converter os sons longos em .ogg)
"""
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from scipy import signal

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "../../game/assets/audio")
OUT.mkdir(parents=True, exist_ok=True)
SR = 44100
rng = np.random.default_rng(42)


# --------------------------------------------------------------------------- blocos

def t_of(dur):
    return np.arange(int(dur * SR)) / SR


def sine(freq, dur, phase=0.0):
    """freq pode ser número ou array (varredura)."""
    n = int(dur * SR)
    f = np.full(n, freq, dtype=float) if np.isscalar(freq) else np.resize(np.asarray(freq, dtype=float), n)
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)


def tri(freq, dur):
    return 2 / np.pi * np.arcsin(sine(freq, dur))


def noise(dur):
    return rng.uniform(-1, 1, int(dur * SR))


def lin(a, b, dur):
    return np.linspace(a, b, int(dur * SR))


def expo(a, b, dur):
    return a * (b / a) ** np.linspace(0, 1, int(dur * SR))


def decay(dur, tau):
    return np.exp(-t_of(dur) / tau)


def adsr(dur, a=0.01, d=0.05, s=0.6, r=0.1):
    n = int(dur * SR)
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    ns = max(n - na - nd - nr, 0)
    env = np.concatenate([np.linspace(0, 1, max(na, 1)), np.linspace(1, s, max(nd, 1)), np.full(ns, s), np.linspace(s, 0, max(nr, 1))])
    return np.resize(env, n) if len(env) >= n else np.pad(env, (0, n - len(env)))


def band(x, lo, hi, order=2):
    lo = max(lo, 20.0)
    hi = min(hi, SR / 2 - 100)
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def lowp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, min(f, SR / 2 - 100), btype="low", fs=SR, output="sos"), x)


def highp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="high", fs=SR, output="sos"), x)


def sweep_filter(x, f0, f1, q=3.0, curve=1.0):
    """Passa-banda cujo centro varre de f0 a f1 (filtro de estado variável)."""
    n = len(x)
    k = np.linspace(0, 1, n) ** curve
    fc = f0 * (f1 / f0) ** k
    f = 2 * np.sin(np.pi * np.minimum(fc, SR / 6) / SR)
    low = bandv = 0.0
    out = np.zeros(n)
    damp = 1.0 / q
    for i in range(n):
        low += f[i] * bandv
        high = x[i] - low - damp * bandv
        bandv += f[i] * high
        out[i] = bandv
    return out


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[:len(p)] += p
    return out


def at(x, delay):
    return np.concatenate([np.zeros(int(delay * SR)), x])


def fade(x, fin=0.004, fout=0.01):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a > 0:
        x[:a] *= np.linspace(0, 1, a)
    if b > 0:
        x[-b:] *= np.linspace(1, 0, b)
    return x


def norm(x, peak=0.9):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 1e-9 else x


def soft(x, drive=1.5):
    return np.tanh(x * drive) / np.tanh(drive)


def reverb(x, dur=0.5, mix_amt=0.25, seed=1):
    """Reverberação barata: convolução com ruído que decai."""
    r = np.random.default_rng(seed)
    ir = r.normal(0, 1, int(dur * SR)) * np.exp(-np.arange(int(dur * SR)) / (dur * SR * 0.28))
    ir = lowp(ir, 6000)
    wet = signal.fftconvolve(x, ir)[:len(x) + len(ir)]
    wet = wet / (np.max(np.abs(wet)) + 1e-9) * np.max(np.abs(x))
    dry = np.pad(x, (0, len(wet) - len(x)))
    return dry * (1 - mix_amt * 0.4) + wet * mix_amt


def save(name, x, peak=0.9, ogg=False):
    x = norm(fade(np.asarray(x, dtype=float)), peak)
    data = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    path = OUT / f"{name}.wav"
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    if ogg:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(path), "-c:a", "libvorbis", "-q:a", "5", str(OUT / f"{name}.ogg")], check=True)
        path.unlink()
    print("ok", name, f"{len(x) / SR:.2f}s")


def loopable(x, xf=0.5):
    """Faz o fim se fundir com o começo (laço sem emenda)."""
    n = int(xf * SR)
    head, tail = x[:n], x[-n:]
    k = np.linspace(0, 1, n)
    body = x[n:-n]
    blend = tail * (1 - k) + head * k
    return np.concatenate([blend, body])


def bell(freq, dur, bright=1.0):
    ratios = [1.0, 2.76, 5.4, 8.93]
    amps = [1.0, 0.5 * bright, 0.25 * bright, 0.12 * bright]
    out = np.zeros(int(dur * SR))
    for r, a in zip(ratios, amps):
        out += a * sine(freq * r, dur) * decay(dur, dur * 0.22 / (r ** 0.6))
    return out


def pluck(freq, dur, tone=0.5):
    """Tecla de marimba/kalimba."""
    return (sine(freq, dur) + tone * sine(freq * 4.0, dur) * decay(dur, 0.03) + 0.2 * sine(freq * 2.0, dur)) * decay(dur, dur * 0.25)


def whoosh(dur, f0, f1, q=2.5, curve=1.0, peak_at=0.4):
    n = int(dur * SR)
    env = np.sin(np.pi * np.linspace(0, 1, n) ** (np.log(0.5) / np.log(peak_at))) ** 1.5
    return sweep_filter(noise(dur), f0, f1, q, curve) * env


# --------------------------------------------------------------------------- movimento

save("step", mix(lowp(noise(0.07), 900) * decay(0.07, 0.015), sine(expo(140, 70, 0.06), 0.06) * decay(0.06, 0.02) * 0.6), 0.6)
save("step_water", mix(band(noise(0.22), 500, 5000) * decay(0.22, 0.05), sine(expo(500, 250, 0.1), 0.1) * decay(0.1, 0.03) * 0.3), 0.6)
save("jump", mix(whoosh(0.2, 300, 1400, 2.0), sine(expo(180, 320, 0.12), 0.12) * decay(0.12, 0.05) * 0.25), 0.55)
save("double_jump", reverb(mix(whoosh(0.32, 500, 3200, 2.5, 0.7), sine(expo(520, 1040, 0.25), 0.25) * decay(0.25, 0.09) * 0.3), 0.3, 0.2), 0.7)
save("land", mix(sine(expo(120, 45, 0.16), 0.16) * decay(0.16, 0.05), lowp(noise(0.12), 700) * decay(0.12, 0.03) * 0.6), 0.8)
save("dash", whoosh(0.24, 600, 4200, 2.2, 0.6, 0.25), 0.75)
save("burst", reverb(mix(whoosh(0.6, 250, 5000, 1.8, 0.5, 0.2), sine(expo(90, 40, 0.4), 0.4) * decay(0.4, 0.14) * 0.9), 0.5, 0.25), 0.95)
save("charge", mix(whoosh(0.95, 200, 2600, 3.0, 1.6, 0.85), sine(expo(160, 520, 0.95), 0.95) * lin(0, 1, 0.95) ** 2 * 0.25), 0.6)
save("slide", band(noise(0.5), 300, 2600) * adsr(0.5, 0.03, 0.1, 0.5, 0.3), 0.45)
save("glide_open", mix(whoosh(0.35, 250, 1500, 1.6, 1.0, 0.3), lowp(noise(0.08), 500) * decay(0.08, 0.02) * 0.7), 0.6)
save("grab", mix(lowp(noise(0.06), 1200) * decay(0.06, 0.012), sine(180, 0.05) * decay(0.05, 0.015) * 0.5), 0.6)
save("mantle", mix(whoosh(0.28, 200, 900, 1.5), at(lowp(noise(0.06), 800) * decay(0.06, 0.015), 0.2)), 0.5)

# --------------------------------------------------------------------------- água

def bubbles(dur, count, lo=500, hi=1800):
    out = np.zeros(int(dur * SR))
    for _ in range(count):
        d = rng.uniform(0.02, 0.06)
        f = rng.uniform(lo, hi)
        b = sine(expo(f, f * 1.6, d), d) * np.hanning(int(d * SR))
        i = rng.integers(0, len(out) - len(b))
        out[i:i + len(b)] += b * rng.uniform(0.3, 1.0)
    return out

save("splash", reverb(mix(highp(noise(0.7), 900) * decay(0.7, 0.16), lowp(noise(0.3), 400) * decay(0.3, 0.07) * 1.2, bubbles(0.7, 26) * 0.35 * decay(0.7, 0.3)), 0.4, 0.2), 0.9)
save("surface", mix(highp(noise(0.4), 1200) * decay(0.4, 0.1), bubbles(0.4, 12) * 0.4), 0.6)
save("orb", mix(sine(expo(300, 900, 0.22), 0.22) * decay(0.22, 0.09), bubbles(0.25, 8) * 0.4), 0.7)
save("water_cast", mix(whoosh(0.4, 500, 3500, 1.8, 0.7, 0.3), highp(noise(0.35), 1500) * decay(0.35, 0.08) * 0.6, bubbles(0.35, 10) * 0.3), 0.8)

# --------------------------------------------------------------------------- combate

save("swing", whoosh(0.2, 700, 3800, 3.0, 0.8, 0.45), 0.6)
save("swing_heavy", mix(whoosh(0.34, 300, 2600, 2.4, 0.9, 0.5), sine(expo(110, 70, 0.2), 0.2) * decay(0.2, 0.08) * 0.3), 0.75)

def impact(low=120, dur=0.16, bite=1.0):
    return mix(sine(expo(low, low * 0.4, dur), dur) * decay(dur, dur * 0.3),
               band(noise(0.06), 900, 5000) * decay(0.06, 0.012) * bite,
               band(noise(0.1), 200, 900) * decay(0.1, 0.03) * 0.7)

save("hit", soft(impact(150, 0.14, 1.0), 2.0), 0.85)
save("hit_heavy", soft(mix(impact(95, 0.26, 1.2), at(band(noise(0.12), 300, 2000) * decay(0.12, 0.04) * 0.5, 0.02)), 2.2), 0.95)
save("hurt", soft(mix(impact(80, 0.22, 0.6), sine(expo(260, 120, 0.18), 0.18) * decay(0.18, 0.06) * 0.4), 1.8), 0.9)
save("block", mix(bell(520, 0.28, 0.5) * 0.7, band(noise(0.05), 800, 4000) * decay(0.05, 0.012), sine(expo(160, 90, 0.1), 0.1) * decay(0.1, 0.03) * 0.5), 0.8)
save("parry", reverb(mix(bell(1250, 0.5, 1.0), bell(1880, 0.4, 0.8) * 0.5, band(noise(0.04), 2000, 9000) * decay(0.04, 0.01)), 0.5, 0.3), 0.9)
save("parry_perfect", reverb(mix(bell(1250, 0.7, 1.2), bell(1875, 0.6, 1.0) * 0.6, at(bell(2500, 0.6, 1.0) * 0.5, 0.07), at(bell(3750, 0.5, 0.8) * 0.35, 0.14),
                                 band(noise(0.05), 2000, 10000) * decay(0.05, 0.012), whoosh(0.5, 400, 4000, 1.5, 0.5, 0.2) * 0.5), 0.8, 0.35), 0.95)
save("guard_break", soft(mix(impact(70, 0.35, 1.0), bell(300, 0.5, 1.5) * 0.6, band(noise(0.3), 300, 3000) * decay(0.3, 0.08) * 0.7), 2.0), 0.95)
save("slam", reverb(soft(mix(sine(expo(85, 30, 0.5), 0.5) * decay(0.5, 0.16), lowp(noise(0.4), 500) * decay(0.4, 0.1), band(noise(0.25), 500, 3000) * decay(0.25, 0.06) * 0.6), 2.0), 0.5, 0.25), 0.98)
save("telegraph", reverb(mix(sine(1760, 0.25) * decay(0.25, 0.06), sine(3520, 0.2) * decay(0.2, 0.04) * 0.4), 0.3, 0.3), 0.6)
save("telegraph_red", reverb(mix(sine(660, 0.4) * decay(0.4, 0.12), sine(933, 0.4) * decay(0.4, 0.12) * 0.8, sine(expo(1320, 990, 0.3), 0.3) * decay(0.3, 0.08) * 0.4), 0.4, 0.3), 0.75)
save("perfect", reverb(mix(whoosh(0.45, 600, 6000, 1.6, 0.5, 0.2) * 0.6, bell(1568, 0.5, 0.8) * 0.5, at(bell(2093, 0.5, 0.8) * 0.4, 0.06)), 0.5, 0.3), 0.75)
save("death", reverb(mix(sine(expo(330, 82, 1.0), 1.0) * decay(1.0, 0.4) * 0.6, sine(expo(165, 41, 1.2), 1.2) * decay(1.2, 0.5), lowp(noise(1.0), 600) * decay(1.0, 0.3) * 0.5), 0.9, 0.35), 0.85)
save("enemy_death", reverb(mix(whoosh(0.9, 3000, 300, 1.6, 0.8, 0.2), sine(expo(440, 110, 0.7), 0.7) * decay(0.7, 0.25) * 0.3), 0.6, 0.3), 0.75)
save("summon", reverb(mix(whoosh(0.7, 200, 2400, 2.0, 1.5, 0.8), sine(expo(60, 120, 0.7), 0.7) * lin(0, 1, 0.7) * 0.6, at(impact(90, 0.2, 0.8), 0.62)), 0.5, 0.3), 0.85)

# --------------------------------------------------------------------------- itens, interface, mundo

def gulp(f):
    return sine(expo(f, f * 0.55, 0.09), 0.09) * np.hanning(int(0.09 * SR))

save("drink", mix(gulp(420), at(gulp(380), 0.22), at(gulp(440), 0.44)), 0.55)
save("heal", reverb(mix(pluck(784, 0.5), at(pluck(988, 0.5), 0.08), at(pluck(1175, 0.6), 0.16), at(pluck(1568, 0.7), 0.24)), 0.6, 0.35), 0.7)
save("pickup", reverb(mix(pluck(988, 0.3), at(pluck(1480, 0.5), 0.07)), 0.4, 0.3), 0.65)
save("rank_up", reverb(mix(pluck(880, 0.3, 0.8), at(pluck(1175, 0.3, 0.8), 0.06), at(pluck(1760, 0.6, 0.8), 0.12)), 0.5, 0.3), 0.7)
save("rest", reverb(mix(bell(392, 1.6, 0.6), at(bell(588, 1.4, 0.6) * 0.7, 0.2), at(bell(784, 1.4, 0.5) * 0.5, 0.42)), 1.0, 0.4), 0.7)
save("bell", reverb(bell(294, 2.2, 1.0), 1.2, 0.4), 0.75)
save("chime", reverb(mix(*[at(bell(f, 0.9, 0.7) * a, d) for f, a, d in [(1568, 1.0, 0.0), (2093, 0.8, 0.09), (1760, 0.7, 0.2), (2637, 0.6, 0.31), (2349, 0.5, 0.45)]]), 0.8, 0.4), 0.6)
save("equip", mix(band(noise(0.12), 1500, 7000) * decay(0.12, 0.03), bell(900, 0.2, 0.6) * 0.4), 0.5)
save("lock", mix(sine(1320, 0.07) * decay(0.07, 0.02), at(sine(1760, 0.09) * decay(0.09, 0.03), 0.05)), 0.45)
save("deny", mix(tri(150, 0.09) * decay(0.09, 0.05), at(tri(120, 0.12) * decay(0.12, 0.06), 0.1)), 0.5)
save("ui_move", sine(1100, 0.04) * decay(0.04, 0.012), 0.35)
save("ui_ok", pluck(660, 0.22, 0.6), 0.5)

# --------------------------------------------------------------------------- laços de ambiente

def wind_loop(dur=6.0):
    n = noise(dur)
    slow = 0.6 + 0.4 * sine(0.21, dur) * sine(0.13, dur, 1.0)
    a = band(n, 250, 1800, 2) * slow
    b = band(noise(dur), 1500, 6000, 2) * (0.5 + 0.5 * sine(0.37, dur, 2.0)) * 0.35
    return loopable(a + b, 0.8)

save("wind_rush", wind_loop(), 0.8, ogg=True)

def sea_loop(dur=12.0):
    t = t_of(dur)
    n = noise(dur)
    swell = (0.5 + 0.5 * np.sin(2 * np.pi * t / 6.0 - 1.0)) ** 2.2
    swell2 = (0.5 + 0.5 * np.sin(2 * np.pi * t / 4.0 + 1.3)) ** 2.0
    low = lowp(n, 500) * (0.35 + 0.65 * swell)
    hiss = band(noise(dur), 2000, 9000) * (0.12 + 0.55 * swell ** 2 + 0.25 * swell2 ** 3)
    return loopable(low * 0.9 + hiss * 0.5, 1.0)

save("sea_loop", sea_loop(), 0.7, ogg=True)

# --------------------------------------------------------------------------- música (laço curto e calmo)

def music(bars=8, bpm=88):
    beat = 60.0 / bpm
    bar = beat * 4
    total = bars * bar
    out = np.zeros(int(total * SR) + SR)
    # lá menor pentatônica com acordes abertos: Am7, Fmaj7, C, G
    chords = [[110.0, 164.81, 261.63, 329.63, 392.0], [87.31, 174.61, 261.63, 329.63, 440.0],
              [130.81, 196.0, 261.63, 329.63, 392.0], [98.0, 196.0, 246.94, 293.66, 392.0]]
    scale = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99]
    r = np.random.default_rng(7)

    def put(x, when, gain=1.0):
        i = int(when * SR)
        out[i:i + len(x)] += x[:len(out) - i] * gain

    for b in range(bars):
        ch = chords[(b // 2) % 4]
        # colchão
        for f in ch[1:4]:
            pad = (sine(f, bar * 2.1) + 0.5 * tri(f * 0.5, bar * 2.1)) * adsr(bar * 2.1, 0.9, 0.5, 0.7, 1.0)
            if b % 2 == 0:
                put(pad, b * bar, 0.05)
        # baixo
        put(sine(ch[0], beat * 1.6) * adsr(beat * 1.6, 0.01, 0.2, 0.5, 0.4), b * bar, 0.2)
        put(sine(ch[0], beat * 0.8) * adsr(beat * 0.8, 0.01, 0.1, 0.5, 0.3), b * bar + beat * 2.5, 0.14)
        # marimba: padrão de colcheias com notas da escala em volta do acorde
        pattern = [0, 2, 4, 2, 5, 4, 2, 4]
        for i, deg in enumerate(pattern):
            if r.random() < 0.82:
                base = ch[1 + (deg % 4)]
                f = base * (2.0 if deg >= 4 else 1.0)
                put(pluck(f, 0.5, 0.45), b * bar + i * beat * 0.5, 0.16 * (1.0 if i % 2 == 0 else 0.7))
        # melodia esparsa no alto
        if b % 2 == 1:
            for i in range(3):
                f = scale[r.integers(4, len(scale))]
                put(bell(f * 2.0, 1.2, 0.5), b * bar + beat * (0.5 + i * 1.25), 0.05)
        # chocalho
        for i in range(8):
            sh = highp(noise(0.05), 5000) * decay(0.05, 0.012)
            put(sh, b * bar + i * beat * 0.5 + (0.0 if i % 2 == 0 else beat * 0.03), 0.035 if i % 2 else 0.02)
    out = reverb(out, 1.2, 0.35, 5)
    n = int(total * SR)
    # a cauda da reverberação volta para o começo (laço sem emenda)
    tail = out[n:]
    out = out[:n]
    out[:len(tail)] += tail[:n]
    return out

save("music_loop", music(), 0.7, ogg=True)
print("sons em", OUT.resolve())
