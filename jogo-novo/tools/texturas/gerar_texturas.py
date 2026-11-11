"""Gera as texturas procedurais do jogo (todas ladrilháveis).

Uso:  python gerar_texturas.py <pasta_de_saida>
Dependências: numpy, pillow
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "../../game/assets/textures")
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(1207)


def spectral(n: int, beta: float, seed: int, lo: float = 1.0, hi: float = 1e9) -> np.ndarray:
    """Ruído ladrilhável por síntese espectral (amplitude ~ 1/f^beta)."""
    r = np.random.default_rng(seed)
    fx = np.fft.fftfreq(n)[:, None] * n
    fy = np.fft.fftfreq(n)[None, :] * n
    f = np.sqrt(fx * fx + fy * fy)
    amp = np.where((f >= lo) & (f <= hi), 1.0 / np.maximum(f, 1e-6) ** beta, 0.0)
    phase = r.uniform(0, 2 * np.pi, (n, n))
    img = np.fft.ifft2(amp * np.exp(1j * phase)).real
    img -= img.min()
    img /= img.max()
    return img


def remap(a: np.ndarray, p_lo: float = 1.0, p_hi: float = 99.0) -> np.ndarray:
    lo, hi = np.percentile(a, [p_lo, p_hi])
    return np.clip((a - lo) / (hi - lo), 0.0, 1.0)


def save(name: str, arr: np.ndarray) -> None:
    a = np.clip(arr * 255.0 + 0.5, 0, 255).astype(np.uint8)
    mode = {2: "L", 3: {3: "RGB", 4: "RGBA"}.get(a.shape[-1] if a.ndim == 3 else 0)}[a.ndim]
    Image.fromarray(a, mode).save(OUT / name, optimize=True)
    print("ok", name, a.shape)


def brush_strokes(n: int, count: int, seed: int, length=(18, 70), width=(3, 9), angle=0.0, spread=0.6) -> np.ndarray:
    """Pinceladas: elipses alongadas e macias, carimbadas num toro."""
    r = np.random.default_rng(seed)
    canvas = np.full((n, n), 0.5, np.float32)
    weight = np.full((n, n), 1e-3, np.float32)
    for _ in range(count):
        cx, cy = r.uniform(0, n, 2)
        ln = r.uniform(*length)
        wd = r.uniform(*width)
        ang = angle + r.normal(0, spread)
        val = r.uniform(0, 1)
        rad = int(ln) + 2
        xs = np.arange(int(cx) - rad, int(cx) + rad + 1)
        ys = np.arange(int(cy) - rad, int(cy) + rad + 1)
        gx, gy = np.meshgrid(xs - cx, ys - cy)
        ca, sa = np.cos(ang), np.sin(ang)
        u = (gx * ca + gy * sa) / ln
        v = (-gx * sa + gy * ca) / wd
        # ponta do pincel: mais larga no começo, afina no fim, com cerdas
        taper = np.clip(1.0 - np.abs(u), 0, 1) ** 0.6
        bristle = 0.75 + 0.25 * np.sin(v * 9.0 + r.uniform(0, 6.28))
        m = np.clip(1.0 - (v / np.maximum(taper, 1e-3)) ** 2, 0, 1) * (np.abs(u) < 1) * bristle
        m = m.astype(np.float32) * r.uniform(0.35, 1.0)
        iy = ys % n
        ix = xs % n
        canvas[np.ix_(iy, ix)] = canvas[np.ix_(iy, ix)] * (1 - m) + val * m
        weight[np.ix_(iy, ix)] += m
    return canvas


def voronoi(n: int, cells: int, seed: int, warp: float = 0.0):
    """Distâncias F1/F2 num toro (para cáusticas e espuma)."""
    r = np.random.default_rng(seed)
    pts = r.uniform(0, 1, (cells, 2))
    y, x = np.mgrid[0:n, 0:n] / n
    if warp > 0:
        wx = spectral(n, 1.8, seed + 1, 2, 24) - 0.5
        wy = spectral(n, 1.8, seed + 2, 2, 24) - 0.5
        x = x + wx * warp
        y = y + wy * warp
    f1 = np.full((n, n), 9.0)
    f2 = np.full((n, n), 9.0)
    for px, py in pts:
        dx = np.abs(x - px) % 1.0
        dy = np.abs(y - py) % 1.0
        dx = np.minimum(dx, 1.0 - dx)
        dy = np.minimum(dy, 1.0 - dy)
        d = np.sqrt(dx * dx + dy * dy)
        nf1 = np.minimum(f1, d)
        f2 = np.minimum(np.maximum(f1, d), f2)
        f1 = nf1
    return f1, f2


N = 512

# 1) Ruído geral: 4 canais descorrelacionados (R: fbm suave, G: fbm médio, B: fino, A: bem fino)
noise = np.stack([
    remap(spectral(N, 2.2, 11, 1, 64)),
    remap(spectral(N, 1.7, 12, 2, 128)),
    remap(spectral(N, 1.2, 13, 6, 256)),
    remap(spectral(N, 0.6, 14, 24, 256)),
], axis=-1)
save("noise.png", noise)

# 2) Pinceladas: R = valor das pinceladas (grande), G = pinceladas menores cruzadas, B = grão de tela
b1 = brush_strokes(N, 2600, 21, (30, 110), (6, 16), angle=0.5, spread=0.5)
b2 = brush_strokes(N, 5200, 22, (10, 40), (2, 6), angle=-0.9, spread=0.9)
grain = remap(spectral(N, 0.4, 23, 40, 256))
brush = np.stack([remap(b1, 0.5, 99.5), remap(b2, 0.5, 99.5), grain], axis=-1)
save("brush.png", brush)

# 3) Nuvens: R = massa (cumulus), G = detalhe, B = fiapos (cirrus)
c_base = remap(spectral(N, 2.6, 31, 1, 48))
c_bill = 1.0 - np.abs(spectral(N, 2.0, 32, 3, 96) * 2.0 - 1.0)
c_mass = remap(c_base * 0.72 + c_bill * 0.28)
c_det = remap(1.0 - np.abs(spectral(N, 1.6, 33, 8, 200) * 2.0 - 1.0))
yy, xx = np.mgrid[0:N, 0:N]
c_cirr = remap(spectral(N, 2.0, 34, 2, 90))
save("clouds.png", np.stack([c_mass, c_det, c_cirr], axis=-1))

# 4) Cáusticas / espuma: R = linhas de cáustica, G = células de espuma, B = F1 (bolhas)
f1, f2 = voronoi(N, 56, 41, warp=0.045)
edge = f2 - f1
caust = np.clip(1.0 - edge / 0.035, 0, 1) ** 1.5
f1b, f2b = voronoi(N, 90, 42, warp=0.03)
foam = np.clip(1.0 - (f2b - f1b) / 0.02, 0, 1)
save("caustics.png", np.stack([caust, foam, remap(f1)], axis=-1))

print("texturas em", OUT.resolve())
