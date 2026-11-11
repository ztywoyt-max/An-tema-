"""Constrói armas e adereços e exporta .glb.

Espaço da arma: +Y = em direção à ponta, +Z = fio (lado que corta), origem = centro da empunhadura.
Uso:  python build_props.py <pasta_de_saida> [nome ...]
"""
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from vessa import geo, out  # noqa: E402
from vessa.geo import Part, tube, lathe, ellipsoid, superbox, surface, strip, smooth, lerp, norm  # noqa: E402

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "../../game/assets/models")
ONLY = sys.argv[2:]


def tri_wave(x):
    return np.abs(((x % 1.0) * 2.0) - 1.0)


def handle(y0: float, y1: float, r: float, c0: str, c1: str, wraps: float = 9.0) -> Part:
    h = tube([((0, y0, 0), r, r * 1.15), ((0, (y0 + y1) / 2, 0), r * 0.92, r * 1.08), ((0, y1, 0), r, r * 1.15)], segs=12, sub=4, front=(0, 0, 1), material="leather", name="cabo")
    h.gradient(c0, c1, smooth(tri_wave(h.v * wraps + h.u) * 1.4 - 0.2))
    return h


def sword() -> list[Part]:
    """Sabre do protagonista: lâmina levemente curva com um veio turquesa."""
    parts = []
    n = 14
    path = []
    for i in range(n + 1):
        t = i / n
        y = lerp(0.085, 0.98, t)
        back = -0.075 * t ** 2.2            # curva para trás (o fio fica convexo)
        w = lerp(0.03, 0.027, t) * (1.0 - smooth((t - 0.86) / 0.14) * 0.93)
        path.append(((0, y, back), 0.0062 * (1.0 - 0.5 * t), max(w, 0.0015)))
    blade = tube(path, segs=10, sub=2, exponent=1.15, front=(0, 0, 1), caps=(False, False), material="metal", name="lamina")
    zrel = blade.verts[:, 2] - np.interp(blade.verts[:, 1], [p[0][1] for p in path], [p[0][2] for p in path])
    blade.gradient("#8fa3c4", "#f2f7fb", smooth((zrel + 0.02) / 0.04))
    blade.paint(smooth((zrel - 0.017) / 0.008), "#ffffff")
    parts.append(blade)
    # veio luminoso
    vein = tube([((0, lerp(0.14, 0.8, i / 8), -0.075 * (i / 8 * 0.74 + 0.06) ** 2.2 - 0.004), 0.0072 * (1 - 0.4 * i / 8), 0.004) for i in range(9)],
                segs=6, sub=2, front=(0, 0, 1), material="glow", name="veio")
    parts.append(vein.color("#59f0df"))
    # guarda em disco oval com dois "dentes"
    guard = tube([((0, 0.068, 0.0), 0.02, 0.05), ((0, 0.078, 0.0), 0.024, 0.062), ((0, 0.088, 0.0), 0.018, 0.045)], segs=16, sub=2, front=(0, 0, 1), material="metal", name="guarda")
    parts.append(guard.color("#e9b949"))
    parts.append(handle(-0.105, 0.07, 0.0165, "#27357a", "#1b2558"))
    pommel = ellipsoid((0, -0.118, 0), (0.021, 0.02, 0.024), 12, 8, "metal", "pomo")
    parts.append(pommel.color("#e9b949"))
    # fita do pomo
    tas = strip([(0, -0.13, 0.0), (0, -0.19, 0.02), (0, -0.27, 0.035), (0, -0.34, 0.03)], 0.028, 0.016, nu=3, sub=4, normal=(1, 0, 0), material="cloth", name="fita")
    tas.gradient("#ee5a3c", "#c43c2e", tas.v).alpha(1.0 - 0.9 * tas.v)
    parts.append(tas)
    return parts


def sentinel_blade() -> list[Part]:
    """Lâmina em gancho da Sentinela."""
    parts = []
    n = 16
    path = []
    for i in range(n + 1):
        t = i / n
        y = lerp(0.08, 0.9, t) - 0.1 * smooth((t - 0.75) / 0.25)
        fwd = 0.16 * smooth((t - 0.55) / 0.45) ** 1.5
        w = lerp(0.034, 0.03, t) * (1.0 - smooth((t - 0.85) / 0.15) * 0.92)
        path.append(((0, y, fwd), 0.007 * (1.0 - 0.4 * t), max(w, 0.0015)))
    blade = tube(path, segs=10, sub=2, exponent=1.15, front=(0, 0, 1), caps=(False, False), material="metal", name="lamina")
    blade.gradient("#5d5a78", "#c9cfe0", smooth(blade.u * 2.0 % 1.0))
    parts.append(blade)
    guard = tube([((0, 0.062, 0.0), 0.022, 0.04), ((0, 0.08, 0.0), 0.026, 0.05)], segs=14, sub=2, front=(0, 0, 1), material="metal", name="guarda")
    parts.append(guard.color("#8f88a6"))
    parts.append(handle(-0.13, 0.065, 0.017, "#d8455f", "#9c2c48"))
    parts.append(ellipsoid((0, -0.14, 0), (0.02, 0.02, 0.022), 10, 8, "metal", "pomo").color("#8f88a6"))
    return parts


def spear() -> list[Part]:
    """Lança: haste longa, ponta em folha, fita junto à ponta."""
    parts = []
    shaft = tube([((0, -0.75, 0), 0.016, 0.016), ((0, 0.0, 0), 0.0165, 0.0165), ((0, 1.05, 0), 0.014, 0.014)], segs=12, sub=4, front=(0, 0, 1), material="wood", name="haste")
    shaft.gradient("#8a5a36", "#b98250", smooth(tri_wave(shaft.v * 5.0) * 1.2))
    parts.append(shaft)
    for y0, y1 in ((-0.12, 0.12), (0.52, 0.6)):
        g = tube([((0, y0, 0), 0.019, 0.019), ((0, y1, 0), 0.019, 0.019)], segs=12, sub=3, front=(0, 0, 1), caps=(False, False), material="leather", name="punho")
        g.gradient("#27357a", "#1b2558", smooth(tri_wave(g.v * 8.0 + g.u) * 1.4 - 0.2))
        parts.append(g)
    n = 10
    path = []
    for i in range(n + 1):
        t = i / n
        w = math.sin(math.pi * min(t * 0.62 + 0.1, 1.0)) ** 0.8 * 0.05 * (1.0 - smooth((t - 0.8) / 0.2) * 0.9)
        path.append(((0, lerp(1.04, 1.5, t), 0), 0.009 * (1.0 - 0.6 * t), max(w, 0.0015)))
    tip = tube(path, segs=10, sub=2, exponent=1.15, front=(0, 0, 1), caps=(False, False), material="metal", name="ponta")
    tip.gradient("#8fa3c4", "#f2f7fb", smooth(np.abs(tip.verts[:, 2]) / 0.04))
    parts.append(tip)
    parts.append(tube([((0, 1.0, 0), 0.02, 0.02), ((0, 1.05, 0), 0.022, 0.022)], segs=12, sub=2, front=(0, 0, 1), material="metal", name="anel").color("#e9b949"))
    parts.append(ellipsoid((0, -0.77, 0), (0.02, 0.03, 0.02), 10, 8, "metal", "conto").color("#e9b949"))
    for k, ln in ((0, 0.42), (1, 0.3)):
        rb = strip([(0, 1.02, 0.02), (0.02 * (1 - 2 * k), 0.95, 0.09), (0.03 * (1 - 2 * k), 0.82, 0.16), (0, 1.02 - ln, 0.2)], 0.035, 0.02, nu=3, sub=4, normal=(1, 0, 0.2), material="cloth", name="fita")
        rb.gradient("#1fbfae", "#158f8c", rb.v).alpha(1.0 - 0.95 * rb.v)
        parts.append(rb)
    return parts


def club() -> list[Part]:
    """Remo de guerra: pá larga de madeira com dentes."""
    parts = []
    shaft = tube([((0, -0.42, 0), 0.02, 0.02), ((0, 0.0, 0), 0.021, 0.021), ((0, 0.5, 0), 0.024, 0.026)], segs=12, sub=4, front=(0, 0, 1), material="wood", name="cabo")
    shaft.gradient("#7a4b2f", "#a56d42", smooth(tri_wave(shaft.v * 4.0) * 1.2))
    parts.append(shaft)
    g = tube([((0, -0.2, 0), 0.0235, 0.0235), ((0, 0.16, 0), 0.0245, 0.0245)], segs=12, sub=4, front=(0, 0, 1), caps=(False, False), material="leather", name="punho")
    g.gradient("#d8455f", "#9c2c48", smooth(tri_wave(g.v * 12.0 + g.u) * 1.4 - 0.2))
    parts.append(g)
    n = 12
    path = []
    for i in range(n + 1):
        t = i / n
        w = (0.035 + 0.1 * math.sin(math.pi * min(t * 0.85 + 0.08, 1.0)) ** 0.7) * (1.0 - smooth((t - 0.9) / 0.1) * 0.6)
        path.append(((0, lerp(0.48, 1.22, t), 0), 0.022 * (1.0 - 0.35 * t), w))
    pad = tube(path, segs=14, sub=2, exponent=2.6, front=(0, 0, 1), material="wood", name="pa")
    pad.gradient("#8a5a36", "#c08a55", smooth(np.abs(pad.verts[:, 2]) / 0.12))
    pad.paint(smooth(1.0 - np.abs(pad.v - 0.5) / 0.05), "#1fbfae")
    parts.append(pad)
    for i in range(7):
        y = 0.62 + i * 0.085
        for sz in (1, -1):
            w = 0.035 + 0.1 * math.sin(math.pi * min(((y - 0.48) / 0.74) * 0.85 + 0.08, 1.0)) ** 0.7
            tooth = tube([((0, y, sz * (w - 0.005)), 0.008, 0.016), ((0, y + 0.012, sz * (w + 0.035)), 0.001, 0.002)], segs=6, sub=2, front=(0, 1, 0), material="mask", name="dente")
            parts.append(tooth.color("#f2ecdd"))
    parts.append(ellipsoid((0, -0.44, 0), (0.026, 0.03, 0.026), 10, 8, "wood", "pomo").color("#7a4b2f"))
    return parts


BUILDERS = {"sword": sword, "sentinel_blade": sentinel_blade, "spear": spear, "club": club}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in BUILDERS.items():
        if ONLY and name not in ONLY:
            continue
        out.reset_scene()
        out.build_mesh(name, fn())
        out.export_glb(str(OUT / f"{name}.glb"))


if __name__ == "__main__":
    main()
