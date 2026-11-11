"""Constrói o personagem humanoide (protagonista e variante Sentinela) e exporta .glb.

Uso:  python build_hero.py <pasta_de_saida> [hero|sentinel|all]
"""
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from vessa import geo, rig, out  # noqa: E402
from vessa.geo import Part, tube, lathe, ellipsoid, superbox, surface, strip, smooth, lerp, norm  # noqa: E402

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "../../game/assets/models")
WHAT = sys.argv[2] if len(sys.argv) > 2 else "all"

PALETTES = {
    "hero": {
        "skin": "#b9774c", "skin_dark": "#9a5f3d",
        "hair": "#f6f2ea", "hair_tip": "#c3c2dc", "brow": "#4a4660",
        "tunic": "#f3ead6", "tunic_low": "#d9cdb8", "trim": "#27357a",
        "cape": "#2c3d8c", "cape_low": "#1f2c6a", "cape_band": "#f3e9cf",
        "scarf": "#ee5a3c", "scarf_dark": "#c43c2e", "scarf_band": "#ffe9b8",
        "sash": "#1fbfae", "sash_dark": "#158f8c",
        "pants": "#2b3672", "pants_low": "#1e2755",
        "wrap": "#efe5cd", "wrap_dark": "#cdbf9f",
        "leather": "#7b4b32", "leather_dark": "#4a2d26",
        "gold": "#e9b949", "eye": "#141a36",
    },
    "sentinel": {
        "skin": "#6d6a86", "skin_dark": "#54516e",
        "hair": "#2a2540", "hair_tip": "#1c1830", "brow": "#1c1830",
        "tunic": "#3d3160", "tunic_low": "#2b2247", "trim": "#d8455f",
        "cape": "#1d5e63", "cape_low": "#12414a", "cape_band": "#e9d9a8",
        "scarf": "#d8455f", "scarf_dark": "#9c2c48", "scarf_band": "#f1e3b8",
        "sash": "#d8455f", "sash_dark": "#9c2c48",
        "pants": "#2a2346", "pants_low": "#1b1630",
        "wrap": "#b9b2c9", "wrap_dark": "#8f88a6",
        "leather": "#3a2c3c", "leather_dark": "#231a26",
        "gold": "#c9cfe0", "eye": "#ffd35a",
        "mask": "#f2ecdd", "mask_mark": "#d8455f", "hat": "#d9b877", "hat_dark": "#a9854c",
    },
}


def tri_wave(x):
    return np.abs(((x % 1.0) * 2.0) - 1.0)


def ring_tube(center_fn, n: int, r_radial: float, r_vert: float, segs: int = 14, material="cloth", name="anel") -> Part:
    """Tubo fechado em anel horizontal. center_fn(a) -> posição, a em rad."""
    path = [(center_fn(2 * math.pi * i / n), r_radial, r_vert) for i in range(n + 1)]
    return tube(path, segs=segs, sub=3, caps=(False, False), fans=(False, False), front=(0, 1, 0), material=material, name=name)


def build(kind: str) -> list[Part]:
    C = PALETTES[kind]
    B = rig.humanoid()
    J = rig.joints(B)
    parts: list[Part] = []
    is_enemy = kind == "sentinel"

    # ------------------------------------------------------------------ tronco
    torso = tube([
        ((0, 0.865, 0.0), 0.168, 0.126), ((0, 0.93, 0.0), 0.16, 0.118), ((0, 1.0, 0.0), 0.138, 0.102),
        ((0, 1.08, 0.0), 0.132, 0.097), ((0, 1.2, -0.004), 0.15, 0.106), ((0, 1.3, -0.006), 0.162, 0.113),
        ((0, 1.38, -0.004), 0.156, 0.105), ((0, 1.425, -0.002), 0.122, 0.087), ((0, 1.455, 0.0), 0.064, 0.06),
    ], segs=28, caps=(False, False), material="cloth", name="tunica")
    y = torso.verts[:, 1]
    torso.gradient(C["tunic_low"], C["tunic"], smooth((y - 0.9) / 0.35))
    torso.paint(smooth((0.905 - y) / 0.02), C["trim"])
    torso.paint(smooth((y - 1.43) / 0.012), C["trim"])
    # abertura em V do peito
    front = smooth((-torso.verts[:, 2] - 0.06) / 0.03)
    vneck = front * smooth(1.0 - np.abs(torso.verts[:, 0]) / np.clip((y - 1.24) * 0.32, 1e-4, None)) * smooth((y - 1.25) / 0.03)
    torso.paint(vneck, C["skin"])
    torso.chain(["hips", "spine", "chest"], [1.08, 1.24], 0.06, t=y)
    torso.alpha(1.0 - 0.5 * smooth((0.94 - y) / 0.07))
    parts.append(torso)

    neck = tube([((0, 1.42, 0.0), 0.054, 0.052), ((0, 1.48, -0.004), 0.047, 0.047), ((0, 1.54, -0.01), 0.05, 0.05)],
                segs=16, caps=(False, False), material="skin", name="pescoco")
    neck.color(C["skin"]).chain(["chest", "neck", "head"], [1.44, 1.51], 0.03, t=neck.verts[:, 1])
    parts.append(neck)

    # ------------------------------------------------------------------ cabeça
    H = J["head"] + np.array([0.0, 0.0, -0.012])
    head_profile = [(0.028, -0.02), (0.058, 0.0), (0.08, 0.04), (0.093, 0.092), (0.098, 0.145), (0.095, 0.195), (0.074, 0.236), (0.034, 0.258), (0.004, 0.263)]

    def head_r(yy):
        ys = [p[1] for p in head_profile]
        rs = [p[0] for p in head_profile]
        return np.interp(yy, ys, rs)

    head = lathe(head_profile, segs=28, center=H, scale_z=1.1, material="skin", name="cabeca")
    hy = head.verts[:, 1] - H[1]
    head.gradient(C["skin_dark"], C["skin"], smooth((hy + 0.02) / 0.1)).rigid("head")
    parts.append(head)
    for sx in (1, -1):
        ear = ellipsoid(H + np.array([0.097 * sx, 0.1, 0.012]), (0.013, 0.03, 0.02), 10, 8, "skin", "orelha")
        parts.append(ear.color(C["skin_dark"]).rigid("head"))
    if not is_enemy:
        ear_ring = ring_tube(lambda a: H + np.array([0.108, 0.07 + 0.014 * math.cos(a), 0.012 + 0.014 * math.sin(a)]), 10, 0.0035, 0.0035, 6, "metal", "brinco")
        parts.append(ear_ring.color(C["gold"]).rigid("head"))

    # olhos e sobrancelhas (peças coladas na superfície do rosto)
    for sx in (1, -1):
        ang = math.radians(21.0) * sx
        ey = 0.108
        rr = head_r(ey)
        pos = H + np.array([math.sin(ang) * rr, ey, -math.cos(ang) * rr * 1.1 + 0.003])
        R = geo.rot_euler(0, -math.degrees(ang), 0)
        white = ellipsoid((0, 0, 0), (0.029, 0.0215, 0.006), 14, 8, "eye", "olho_branco").rotate(R).move(pos)
        parts.append(white.color("#fbf7ee" if not is_enemy else "#1a1626").rigid("head"))
        iris = ellipsoid((0, 0, 0), (0.0125, 0.0165, 0.006), 14, 8, "eye", "iris").rotate(R).move(pos + R @ np.array([-0.004 * sx, -0.002, -0.004]))
        parts.append(iris.color(C["eye"]).rigid("head"))
        glint = ellipsoid((0, 0, 0), (0.004, 0.005, 0.003), 8, 6, "eye", "brilho").rotate(R).move(pos + R @ np.array([0.001 * sx, 0.006, -0.0085]))
        parts.append(glint.color("#ffffff").rigid("head"))
        lash = ellipsoid((0, 0, 0), (0.031, 0.006, 0.006), 12, 6, "hair", "cilio")
        lash.rotate(geo.rot_euler(0, 0, 6.0 * sx)).rotate(R).move(pos + R @ np.array([0.001 * sx, 0.0195, -0.003]))
        parts.append(lash.color(C["brow"]).rigid("head"))
        brow = ellipsoid((0, 0, 0), (0.03, 0.0065, 0.006), 12, 6, "hair", "sobrancelha")
        brow.rotate(geo.rot_euler(0, 0, 13.0 * sx)).rotate(R).move(pos + np.array([0.004 * sx, 0.04, -0.004]))
        parts.append(brow.color(C["brow"]).rigid("head"))

    # ------------------------------------------------------------------ cabelo
    rng = np.random.default_rng(7)
    if not is_enemy:
        tufts = 11
        jitter = rng.uniform(-0.012, 0.012, tufts + 1)

        def hair_fn(u, v):
            th = 2 * math.pi * u
            fs = math.sin(th)        # +1 = frente
            wf = max(fs, 0.0) ** 1.2
            wb = max(-fs, 0.0) ** 1.2
            low = 0.062 * (1 - wf - wb) + 0.128 * wf + 0.018 * wb
            k = u * tufts
            spike = (1.0 - abs((k % 1.0) * 2.0 - 1.0))
            low -= spike * (0.03 + 0.012 * wb) + jitter[int(k) % tufts]
            top = 0.266
            yy = top + (low - top) * (v ** 0.8)
            r = head_r(min(yy, 0.258)) * 1.085 + 0.007 + 0.012 * smooth((v - 0.7) / 0.3)
            if yy > 0.25:
                r = max(r * (1.0 - (yy - 0.25) / 0.03), 0.0)
            return H + np.array([math.cos(th) * r, yy, -math.sin(th) * r * 1.1])

        cap = surface(hair_fn, 66, 14, material="hair", name="cabelo")
        cap.gradient(C["hair"], C["hair_tip"], cap.v, 1.6).rigid("head")
        parts.append(cap)
        # mechas espetadas para a silhueta
        spikes = [((0.03, 0.25, 0.03), (0.05, 0.31, 0.1)), ((-0.04, 0.245, 0.05), (-0.09, 0.29, 0.13)), ((0.07, 0.2, 0.07), (0.14, 0.2, 0.15)),
                  ((-0.075, 0.19, 0.075), (-0.15, 0.17, 0.14)), ((0.0, 0.22, 0.09), (0.0, 0.24, 0.19)), ((0.05, 0.13, 0.1), (0.1, 0.085, 0.18)),
                  ((-0.05, 0.12, 0.1), (-0.095, 0.07, 0.175)), ((0.02, 0.255, -0.04), (0.06, 0.3, -0.09)), ((-0.03, 0.25, -0.05), (-0.085, 0.285, -0.1)),
                  # franja
                  ((0.0, 0.215, -0.095), (0.012, 0.118, -0.128)), ((0.05, 0.2, -0.09), (0.075, 0.105, -0.108)), ((-0.05, 0.2, -0.09), (-0.068, 0.12, -0.112)),
                  ((0.085, 0.17, -0.06), (0.108, 0.075, -0.06)), ((-0.085, 0.17, -0.06), (-0.106, 0.085, -0.062))]
        for a, b in spikes:
            a, b = np.array(a), np.array(b)
            mid = (a + b) * 0.5 + norm(b - a + np.array([0, 0.5, 0])) * 0.012
            sp = tube([(H + a, 0.034, 0.03), (H + mid, 0.024, 0.02), (H + b, 0.003, 0.003)], segs=10, sub=4, caps=(True, True), material="hair", name="mecha")
            sp.gradient(C["hair"], C["hair_tip"], sp.v, 1.3).rigid("head")
            parts.append(sp)
        # rabo de cavalo
        hp = [J["hair1"], J["hair2"], J["hair3"], B["hair3"][2]]
        tail = tube([(hp[0], 0.03, 0.03), (lerp(hp[0], hp[1], 0.6), 0.045, 0.04), (hp[1], 0.046, 0.04), (hp[2], 0.036, 0.03), (hp[3], 0.006, 0.006)],
                    segs=14, sub=4, material="hair", name="rabo")
        tail.gradient(C["hair"], C["hair_tip"], tail.v, 1.2).chain(["hair1", "hair2", "hair3"], [0.36, 0.68], 0.08)
        parts.append(tail)
        tie = tube([(hp[0] - norm(hp[1] - hp[0]) * 0.012, 0.034, 0.034), (hp[0] + norm(hp[1] - hp[0]) * 0.022, 0.036, 0.036)], segs=14, sub=2, material="cloth", name="laco")
        parts.append(tie.color(C["scarf"]).rigid("head"))
    else:
        # capuz + máscara + chapéu cônico
        hood = lathe([(0.075, -0.03), (0.105, 0.02), (0.112, 0.1), (0.108, 0.18), (0.085, 0.245), (0.04, 0.272), (0.004, 0.278)], segs=28, center=H, scale_z=1.12, material="cloth", name="capuz")
        hood.gradient(C["tunic_low"], C["tunic"], smooth((hood.verts[:, 1] - H[1]) / 0.25)).rigid("head")
        parts.append(hood)

        def mask_fn(u, v):
            th = math.radians(lerp(-62.0, 62.0, u))
            yy = lerp(0.215, -0.035, v)
            r = np.interp(yy, [-0.035, 0.0, 0.06, 0.12, 0.18, 0.215], [0.07, 0.092, 0.11, 0.118, 0.116, 0.105]) * 1.12 + 0.012
            w = math.cos(th) ** 0.25
            return H + np.array([math.sin(th) * r * 0.86, yy, -math.cos(th) * r * w])

        mask = surface(mask_fn, 22, 16, material="mask", name="mascara")
        mu, mv = mask.u, mask.v
        mask.color(C["mask"])
        # fendas dos olhos e marca pintada
        for sx in (1, -1):
            eye_m = smooth(1.0 - np.sqrt(((mu - (0.5 + 0.17 * sx)) / 0.085) ** 2 + ((mv - 0.42) / 0.032) ** 2))
            mask.paint(np.clip(eye_m * 3.0, 0, 1), "#17131f")
        mark = smooth(1.0 - np.abs(mu - 0.5) / 0.035) * smooth((0.34 - mv) / 0.05)
        mask.paint(mark, C["mask_mark"])
        mark2 = smooth(1.0 - np.abs(mv - 0.7) / 0.03) * smooth(1.0 - np.abs(mu - 0.5) / 0.2)
        mask.paint(mark2, C["mask_mark"])
        parts.append(mask.rigid("head"))
        hat = lathe([(0.36, 0.165), (0.25, 0.215), (0.13, 0.27), (0.03, 0.315), (0.004, 0.325)], segs=36, sub=3, center=H, material="straw", name="chapeu", fans=(False, True))
        hv = hat.verts
        ringm = tri_wave((np.sqrt(hv[:, 0] ** 2 + (hv[:, 2] - H[2]) ** 2)) * 28.0)
        hat.gradient(C["hat_dark"], C["hat"], smooth(ringm * 1.4)).rigid("head")
        parts.append(hat)
        brim_in = lathe([(0.355, 0.158), (0.2, 0.2), (0.11, 0.235)], segs=36, sub=2, center=H, material="straw", name="chapeu_dentro", fans=(False, False))
        brim_in.faces = [tuple(reversed(f)) for f in brim_in.faces]
        parts.append(brim_in.color(C["hat_dark"]).rigid("head"))

    # ------------------------------------------------------------------ cachecol
    wrap = ring_tube(lambda a: np.array([0.083 * math.cos(a), 1.468 + 0.034 * math.sin(a), -0.004 - 0.09 * math.sin(a)]), 18, 0.036, 0.052, 14, "cloth", "cachecol")
    fold = 0.5 + 0.5 * np.sin(wrap.u * math.pi * 2 * 7 + wrap.v * 9.0)
    wrap.gradient(C["scarf_dark"], C["scarf"], smooth(fold * 0.8 + 0.3)).skin({"chest": 0.55, "neck": 0.45})
    parts.append(wrap)
    for prefix, n, w0, w1 in (("scarf_a", 5, 0.115, 0.07), ("scarf_b", 4, 0.1, 0.06)):
        if is_enemy and prefix == "scarf_b":
            continue
        pts = [J[f"{prefix}{i + 1}"] for i in range(n)] + [B[f"{prefix}{n}"][2]]
        tl = strip(pts, w0, w1, nu=6, sub=5, normal=(0, 0.72, 0.69), curl=0.1, material="cloth", name=prefix)
        v = tl.v
        tl.gradient(C["scarf"], C["scarf_dark"], v, 1.5)
        tl.paint(smooth(1.0 - np.abs(v - 0.84) / 0.035), C["scarf_band"])
        tl.paint(smooth(1.0 - np.abs(v - 0.93) / 0.018), C["scarf_band"])
        tl.chain([f"{prefix}{i + 1}" for i in range(n)], [(i + 1) / n for i in range(n - 1)], 0.07)
        tl.alpha(1.0 - 0.75 * smooth(v / 0.9))
        # ponta rasgada
        last = v > 0.985
        tl.verts[last, 1] -= tri_wave(tl.u[last] * 3.0) * 0.045
        parts.append(tl)

    # ------------------------------------------------------------------ capa curta (ombros)
    def cape_fn(u, s):
        th = 2 * math.pi * u
        cs, fs = math.cos(th), math.sin(th)
        ws, wf, wb = cs * cs, max(fs, 0.0) ** 2, max(-fs, 0.0) ** 2
        p0 = np.array([0.072 * cs, 1.452 + 0.01 * max(fs, 0), -0.068 * fs - 0.003])
        p1 = np.array([0.24 * cs, ws * 1.5 + wf * 1.448 + wb * 1.445, -(0.14 if fs > 0 else 0.15) * fs])
        hem_drop = (1.0 - abs(((u * 13.0) % 1.0) * 2.0 - 1.0)) * 0.034
        p2 = np.array([0.305 * cs, ws * 1.29 + wf * 1.235 + wb * 1.12 - hem_drop, -(0.18 if fs > 0 else 0.2) * fs])
        return (1 - s) ** 2 * p0 + 2 * s * (1 - s) * p1 + s * s * p2

    cape = surface(cape_fn, 78, 16, material="cloth", name="capa")
    cu, cv = cape.u, cape.v
    cape.gradient(C["cape"], C["cape_low"], cv, 1.4)
    cape.paint(smooth(1.0 - np.abs(cv - 0.74) / 0.05), C["cape_band"])
    # dentes na faixa (triângulos) para dar desenho
    teeth = smooth(1.0 - np.abs(cv - (0.86 - 0.05 * tri_wave(cu * 26.0))) / 0.022)
    cape.paint(teeth, C["cape_band"])
    cape.paint(smooth((0.06 - cv) / 0.03), C["trim"] if not is_enemy else C["trim"])
    cs_ = np.cos(2 * math.pi * cu)
    arm_w = smooth((np.abs(cs_) - 0.42) / 0.4) * smooth((cv - 0.2) / 0.55) * 0.8
    cape.skin({"chest": 1.0})
    cape.blend_to("upper_arm_r", arm_w * (cs_ > 0))
    cape.blend_to("upper_arm_l", arm_w * (cs_ < 0))
    cape.alpha(1.0 - 0.7 * smooth((cv - 0.45) / 0.5))
    parts.append(cape)

    # ------------------------------------------------------------------ braços, mãos
    for s, sx in (("_r", 1.0), ("_l", -1.0)):
        sh, el, wr = J["upper_arm" + s], J["forearm" + s], J["hand" + s]
        d = norm(wr - el)
        ua = norm(el - sh)
        inside = sh - np.array([0.035 * sx, 0, 0])
        arm = tube([(inside, 0.058, 0.058), (sh, 0.061, 0.061), (lerp(sh, el, 0.5), 0.05, 0.052), (el, 0.042, 0.043), (el + d * 0.1, 0.046, 0.045), (wr, 0.033, 0.035)],
                   segs=18, sub=5, material="skin", name="braco" + s)
        seg = [0.035, np.linalg.norm(el - sh), np.linalg.norm(wr - el)]
        tot = sum(seg)
        arm.color(C["skin"]).chain(["shoulder" + s, "upper_arm" + s, "forearm" + s], [seg[0] / tot + 0.02, (seg[0] + seg[1]) / tot], 0.07)
        parts.append(arm)
        # manga curta
        sleeve = tube([(sh - ua * 0.01, 0.063, 0.063), (sh + ua * 0.06, 0.063, 0.063), (sh + ua * 0.12, 0.062, 0.063)], segs=18, sub=3, caps=(True, False), fans=(True, False), material="cloth", name="manga" + s)
        sleeve.gradient(C["tunic"], C["tunic_low"], sleeve.v).paint(smooth((sleeve.v - 0.86) / 0.06), C["trim"])
        sleeve.skin({"upper_arm" + s: 1.0}).blend_to("shoulder" + s, 0.5 * smooth((0.35 - sleeve.v) / 0.3))
        parts.append(sleeve)
        if s == "_l" or is_enemy:
            band = tube([(el + d * 0.035, 0.05, 0.05), (el + d * 0.12, 0.052, 0.051), (wr - d * 0.012, 0.04, 0.041)], segs=16, sub=5, caps=(False, False), fans=(False, False), material="cloth", name="faixa" + s)
            band.gradient(C["wrap"], C["wrap_dark"], smooth(tri_wave(band.v * 9.0 + band.u * 1.0) * 1.3 - 0.2)).rigid("forearm" + s)
            parts.append(band)
        else:
            bracer = tube([(el + d * 0.055, 0.053, 0.053), (el + d * 0.12, 0.054, 0.053), (wr - d * 0.014, 0.043, 0.044)], segs=16, sub=4, caps=(False, False), fans=(False, False), material="leather", name="bracal")
            bracer.gradient(C["leather"], C["leather_dark"], bracer.v).rigid("forearm" + s)
            parts.append(bracer)
            for at, r in ((el + d * 0.055, 0.056), (wr - d * 0.014, 0.046)):
                rim = tube([(at - d * 0.009, r, r), (at + d * 0.009, r, r)], segs=16, sub=2, caps=(False, False), material="metal", name="aro")
                parts.append(rim.color(C["gold"]).rigid("forearm" + s))
        # mão fechada (punho estilizado)
        t = np.array([0.0, 0.0, -1.0])
        t = norm(t - d * np.dot(t, d))
        p_in = -norm(np.cross(d, t)) * sx      # palma virada para o corpo
        R = np.stack([d, t, p_in], axis=1)
        palm = superbox((0, 0, 0), (0.088, 0.082, 0.04), 3.0, 14, 10, "skin", "palma").rotate(R).move(wr + d * 0.046)
        fing = superbox((0, 0, 0), (0.052, 0.086, 0.05), 3.0, 14, 10, "skin", "dedos").rotate(R).move(wr + d * 0.084 + p_in * 0.02)
        thumb = ellipsoid((0, 0, 0), (0.03, 0.02, 0.022), 10, 8, "skin", "polegar").rotate(R).move(wr + d * 0.062 + t * 0.042 + p_in * 0.022)
        for hp_ in (palm, fing, thumb):
            parts.append(hp_.color(C["skin"]).rigid("hand" + s))
        fing.shade(smooth(tri_wave((fing.verts - wr) @ t * 46.0) * 2.0 - 1.2), 0.86)

    # ------------------------------------------------------------------ faixa da cintura
    sash = ring_tube(lambda a: np.array([0.148 * math.cos(a), 1.0, -0.111 * math.sin(a)]), 22, 0.018, 0.05, 12, "cloth", "faixa_cintura")
    sash.gradient(C["sash_dark"], C["sash"], smooth(0.5 + 0.5 * np.sin(sash.v * 14.0 + sash.u * 6.28))).skin({"hips": 0.6, "spine": 0.4})
    parts.append(sash)
    knot = ellipsoid((-0.104, 1.0, -0.088), (0.036, 0.032, 0.028), 12, 8, "cloth", "no")
    parts.append(knot.color(C["sash"]).skin({"hips": 0.6, "spine": 0.4}))
    sp = [J["sash1"], J["sash2"], B["sash2"][2]]
    for off, w0 in ((0.0, 0.07), (0.022, 0.055)):
        st = strip([p + np.array([off, 0, -off * 0.5]) for p in sp], w0, w0 * 0.8, nu=4, sub=5, normal=(-0.5, 0.1, -1), curl=0.1, material="cloth", name="ponta_faixa")
        st.gradient(C["sash"], C["sash_dark"], st.v).paint(smooth(1.0 - np.abs(st.v - 0.88) / 0.04), C["gold"])
        st.chain(["sash1", "sash2"], [0.5], 0.12).alpha(1.0 - 0.7 * st.v)
        parts.append(st)

    # ------------------------------------------------------------------ panos da cintura
    for prefix, n, w0, w1, nrm, base, band in (("cloth_b", 3, 0.27, 0.33, (0, 0.1, 1), C["tunic"], C["trim"]), ("cloth_f", 2, 0.2, 0.23, (0, 0.07, -1), C["cape"], C["cape_band"])):
        pts = [J[f"{prefix}{i + 1}"] for i in range(n)] + [B[f"{prefix}{n}"][2]]
        pn = strip(pts, w0, w1, nu=12, sub=6, normal=nrm, curl=0.13, material="cloth", name=prefix)
        v, u = pn.v, pn.u
        pn.gradient(base, C["tunic_low"] if prefix == "cloth_b" else C["cape_low"], v, 1.3)
        pn.paint(smooth(1.0 - np.abs(v - 0.8) / 0.045), band)
        pn.paint(smooth(1.0 - np.abs(v - (0.9 - 0.035 * tri_wave(u * 6.0))) / 0.018), C["scarf"] if prefix == "cloth_b" else band)
        pn.chain([f"{prefix}{i + 1}" for i in range(n)], [(i + 1) / n for i in range(n - 1)], 0.1)
        pn.alpha(1.0 - 0.7 * smooth(v))
        last = v > 0.985
        pn.verts[last, 1] -= tri_wave(u[last] * 4.0 + 0.5) * 0.05
        parts.append(pn)

    # ------------------------------------------------------------------ pernas
    for s, sx in (("_r", 1.0), ("_l", -1.0)):
        hip, knee, ank = J["thigh" + s], J["shin" + s], J["foot" + s]
        leg = tube([((hip[0] * 0.92, 1.0, 0.0), 0.088, 0.098), (hip, 0.09, 0.1), (lerp(hip, knee, 0.5), 0.084, 0.09), (knee, 0.078, 0.082),
                    (lerp(knee, ank, 0.3), 0.09, 0.092), (lerp(knee, ank, 0.52), 0.064, 0.066), (lerp(knee, ank, 0.6), 0.055, 0.057)],
                   segs=20, sub=5, caps=(True, False), fans=(True, False), material="cloth", name="calca" + s)
        ly = leg.verts[:, 1]
        leg.gradient(C["pants_low"], C["pants"], smooth((ly - 0.3) / 0.5))
        leg.chain(["hips", "thigh" + s, "shin" + s], [-0.95, -0.5], 0.055, t=-ly)
        parts.append(leg)
        wrapl = tube([(lerp(knee, ank, 0.52), 0.06, 0.062), (lerp(knee, ank, 0.75), 0.052, 0.055), (ank + np.array([0, 0.02, 0]), 0.046, 0.05)],
                     segs=16, sub=5, caps=(False, False), fans=(False, False), material="cloth", name="polaina" + s)
        wrapl.gradient(C["wrap"], C["wrap_dark"], smooth(tri_wave(wrapl.v * 7.0 + wrapl.u) * 1.3 - 0.2)).rigid("shin" + s)
        parts.append(wrapl)
        ball = J["toe" + s]
        boot = superbox((ank[0], 0.047, -0.048), (0.1, 0.094, 0.262), 2.8, 18, 12, "leather", "bota" + s)
        bz = boot.verts[:, 2]
        boot.gradient(C["leather_dark"], C["leather"], smooth((boot.verts[:, 1] - 0.012) / 0.03))
        boot.skin({"foot" + s: 1.0}).blend_to("toe" + s, smooth((-bz - 0.1) / 0.05))
        parts.append(boot)
        cuff = tube([(ank + np.array([0, 0.055, -0.004]), 0.056, 0.06), (ank + np.array([0, 0.0, 0.0]), 0.052, 0.062)], segs=16, sub=3, caps=(False, False), fans=(False, False), material="leather", name="cano" + s)
        parts.append(cuff.color(C["leather"]).skin({"shin" + s: 0.5, "foot" + s: 0.5}))
        _ = ball

    # ------------------------------------------------------------------ acessórios
    pouch = superbox((0.15, 0.975, 0.07), (0.07, 0.085, 0.055), 3.0, 12, 8, "leather", "bolsa")
    parts.append(pouch.gradient(C["leather_dark"], C["leather"], smooth((pouch.verts[:, 1] - 0.94) / 0.06)).skin({"hips": 1.0}))
    if not is_enemy:
        gourd = tube([((-0.165, 0.9, 0.03), 0.004, 0.004), ((-0.165, 0.915, 0.03), 0.04, 0.04), ((-0.165, 0.955, 0.03), 0.046, 0.046), ((-0.165, 0.985, 0.03), 0.022, 0.022),
                      ((-0.165, 1.005, 0.03), 0.028, 0.028), ((-0.165, 1.03, 0.03), 0.013, 0.013), ((-0.165, 1.045, 0.03), 0.012, 0.012)], segs=14, sub=4, material="leather", name="cantil")
        gourd.gradient("#b9862f", "#e3bd62", smooth((gourd.verts[:, 1] - 0.9) / 0.1)).paint(gourd.verts[:, 1] > 1.03, C["leather_dark"]).skin({"hips": 1.0})
        parts.append(gourd)
    return parts


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    kinds = ["hero", "sentinel"] if WHAT == "all" else [WHAT]
    for kind in kinds:
        out.reset_scene()
        bones = rig.humanoid()
        parts = build(kind)
        mesh = out.build_mesh(kind, parts)
        fwd = (0.0, 0.0, -1.0)
        rolls = {name: fwd for name in bones}
        for s, sx in (("_r", 1.0), ("_l", -1.0)):
            el, wr = bones["forearm" + s][1], bones["hand" + s][1]
            rolls[("weapon" if s == "_r" else "item") + s] = tuple(wr - el)
        arm = out.build_armature("Rig", bones, rolls)
        out.bind(mesh, arm)
        nverts = len(mesh.data.vertices)
        out.export_glb(str(OUT / f"{kind}.glb"))
        print(kind, "vertices:", nverts)


if __name__ == "__main__":
    main()
