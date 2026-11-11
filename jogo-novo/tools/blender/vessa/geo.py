"""Geometria procedural em numpy (sem depender do Blender).

Espaço do jogo: X = direita do personagem, Y = cima, Z = trás (o personagem olha para -Z).
Cada Part guarda vértices, faces, UV, cor por vértice (linear, alfa = rigidez do pano)
e pesos de pele por osso.
"""
from __future__ import annotations

import math

import numpy as np


# --------------------------------------------------------------------------- cor

def srgb(hex_or_rgb) -> np.ndarray:
    """Cor sRGB ('#rrggbb' ou 0..1) -> linear RGB."""
    if isinstance(hex_or_rgb, str):
        h = hex_or_rgb.lstrip("#")
        c = np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)])
    else:
        c = np.array(hex_or_rgb, dtype=float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def smooth(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def lerp(a, b, t):
    return a + (b - a) * t


def norm(v):
    v = np.asarray(v, dtype=float)
    n = np.linalg.norm(v, axis=-1, keepdims=True)
    return v / np.maximum(n, 1e-12)


def rot_axis(axis, angle: float) -> np.ndarray:
    axis = norm(axis)
    x, y, z = axis
    c, s = math.cos(angle), math.sin(angle)
    C = 1 - c
    return np.array([
        [c + x * x * C, x * y * C - z * s, x * z * C + y * s],
        [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
        [z * x * C - y * s, z * y * C + x * s, c + z * z * C],
    ])


def rot_euler(pitch=0.0, yaw=0.0, roll=0.0) -> np.ndarray:
    """Graus. Yaw em torno de Y, pitch em torno de X, roll em torno de Z (aplicados R = Ry Rx Rz)."""
    return rot_axis((0, 1, 0), math.radians(yaw)) @ rot_axis((1, 0, 0), math.radians(pitch)) @ rot_axis((0, 0, 1), math.radians(roll))


# --------------------------------------------------------------------------- peça

class Part:
    def __init__(self, verts, faces, uvs=None, material="base", name="parte"):
        self.name = name
        self.verts = np.asarray(verts, dtype=float).reshape(-1, 3)
        self.faces = [tuple(int(i) for i in f) for f in faces]
        n = len(self.verts)
        self.uvs = np.zeros((n, 2)) if uvs is None else np.asarray(uvs, dtype=float)
        self.colors = np.ones((n, 4))
        self.weights: dict[str, np.ndarray] = {}
        self.material = material
        # parâmetros por vértice (u ao redor/ao largo, v ao longo), usados para cor e pesos
        self.u = self.uvs[:, 0].copy()
        self.v = self.uvs[:, 1].copy()

    # ---- cor
    def color(self, c, alpha: float | None = None):
        self.colors[:, :3] = srgb(c) if isinstance(c, str) else np.asarray(c)
        if alpha is not None:
            self.colors[:, 3] = alpha
        return self

    def gradient(self, c0, c1, t=None, power: float = 1.0):
        """Degradê de c0 (t=0) a c1 (t=1). t padrão = v."""
        t = self.v if t is None else np.asarray(t)
        t = np.clip(t, 0, 1) ** power
        a, b = srgb(c0), srgb(c1)
        self.colors[:, :3] = a[None, :] * (1 - t[:, None]) + b[None, :] * t[:, None]
        return self

    def paint(self, mask, c, amount: float = 1.0):
        """Mistura a cor c onde mask (0..1 por vértice)."""
        m = np.clip(np.asarray(mask, dtype=float), 0, 1)[:, None] * amount
        self.colors[:, :3] = self.colors[:, :3] * (1 - m) + srgb(c)[None, :] * m
        return self

    def shade(self, mask, factor: float):
        """Escurece/clareia (multiplica) onde mask."""
        m = np.clip(np.asarray(mask, dtype=float), 0, 1)[:, None]
        self.colors[:, :3] *= (1 - m) + m * factor
        return self

    def alpha(self, a):
        """Rigidez do pano: 1 = preso, 0 = solto ao vento."""
        self.colors[:, 3] = np.clip(a, 0, 1)
        return self

    # ---- pele
    def rigid(self, bone: str):
        self.weights = {bone: np.ones(len(self.verts))}
        return self

    def skin(self, weights: dict):
        self.weights = {k: np.asarray(w, dtype=float) * np.ones(len(self.verts)) for k, w in weights.items()}
        return self

    def chain(self, bones, joints, blend: float = 0.08, t=None):
        """Pesos ao longo de uma cadeia: bones[i] manda até joints[i] (em unidades de t, padrão v)."""
        t = self.v if t is None else np.asarray(t)
        passed = [smooth((t - (j - blend)) / (2 * blend)) for j in joints]
        w = {}
        for i, b in enumerate(bones):
            hi = passed[i - 1] if i > 0 else np.ones_like(t)
            lo = passed[i] if i < len(joints) else np.zeros_like(t)
            w[b] = w.get(b, 0) + np.clip(hi - lo, 0, 1)
        self.weights = w
        return self

    def blend_to(self, bone: str, mask):
        """Desvia parte do peso para outro osso onde mask (0..1)."""
        m = np.clip(np.asarray(mask, dtype=float), 0, 1)
        for k in list(self.weights):
            self.weights[k] = self.weights[k] * (1 - m)
        self.weights[bone] = self.weights.get(bone, 0) + m
        return self

    # ---- transformações
    def move(self, d):
        self.verts += np.asarray(d, dtype=float)
        return self

    def rotate(self, R, pivot=(0, 0, 0)):
        p = np.asarray(pivot, dtype=float)
        self.verts = (self.verts - p) @ np.asarray(R).T + p
        return self

    def scale(self, s, pivot=(0, 0, 0)):
        p = np.asarray(pivot, dtype=float)
        self.verts = (self.verts - p) * np.asarray(s, dtype=float) + p
        return self

    def mat(self, material: str):
        self.material = material
        return self

    def mirrored(self, name_swap=("_r", "_l")) -> "Part":
        """Cópia espelhada em X (troca os ossos _r/_l)."""
        p = Part(self.verts * np.array([-1.0, 1.0, 1.0]), [tuple(reversed(f)) for f in self.faces], self.uvs.copy(), self.material, self.name + "_m")
        p.colors = self.colors.copy()
        p.u, p.v = self.u.copy(), self.v.copy()
        a, b = name_swap
        for k, w in self.weights.items():
            if k.endswith(a):
                k2 = k[: -len(a)] + b
            elif k.endswith(b):
                k2 = k[: -len(b)] + a
            else:
                k2 = k
            p.weights[k2] = w.copy()
        return p


# --------------------------------------------------------------------------- geradores

def _catmull(points: np.ndarray, sub: int) -> np.ndarray:
    """Interpola uma lista de pontos (N,D) com Catmull-Rom; devolve (N-1)*sub+1 pontos."""
    pts = np.asarray(points, dtype=float)
    n = len(pts)
    if n < 2 or sub <= 1:
        return pts
    out = []
    for i in range(n - 1):
        p0 = pts[max(i - 1, 0)]
        p1 = pts[i]
        p2 = pts[i + 1]
        p3 = pts[min(i + 2, n - 1)]
        for k in range(sub):
            t = k / sub
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(pts[-1])
    return np.array(out)


def tube(path, segs: int = 20, sub: int = 4, caps=(True, True), cap_len=(None, None), cap_rings: int = 4,
         exponent: float = 2.0, front=(0, 0, -1), shape=None, material="base", name="tubo", fans=(True, True)) -> Part:
    """Cilindro generalizado ao longo de um caminho.

    path: lista de (pos, rx, rz) — rx = raio lateral, rz = raio frente/trás (em relação a `front`).
    exponent: 2 = elipse; maior = seção mais quadrada.
    shape(theta, v) -> fator de raio opcional (theta=0 lado +X do anel, pi/2 = frente).
    """
    ctrl = np.array([[*p[0], p[1], p[2]] for p in path], dtype=float)
    pts = _catmull(ctrl, sub)
    centers, rx, rz = pts[:, :3], np.maximum(pts[:, 3], 1e-5), np.maximum(pts[:, 4], 1e-5)
    n = len(centers)
    tang = np.zeros_like(centers)
    tang[1:-1] = centers[2:] - centers[:-2]
    tang[0] = centers[1] - centers[0]
    tang[-1] = centers[-1] - centers[-2]
    tang = norm(tang)
    # referenciais por transporte paralelo
    f = np.asarray(front, dtype=float)
    frames = []
    zf = f - tang[0] * np.dot(f, tang[0])
    if np.linalg.norm(zf) < 1e-6:
        zf = np.array([1.0, 0, 0]) - tang[0] * tang[0][0]
    zf = norm(zf)
    for i in range(n):
        zf = zf - tang[i] * np.dot(zf, tang[i])
        zf = norm(zf)
        xf = norm(np.cross(zf, tang[i]))
        frames.append((xf, zf))
    seglen = np.linalg.norm(np.diff(centers, axis=0), axis=1)
    arc = np.concatenate([[0], np.cumsum(seglen)])
    total = max(arc[-1], 1e-9)

    rings = []  # (center, rx, rz, frame, v)
    def add_cap(i, sign, length):
        c, t = centers[i], tang[i]
        ln = length if length is not None else min(rx[i], rz[i]) * 0.9
        out = []
        for k in range(1, cap_rings + 1):
            a = (k / (cap_rings + 0.35)) * (math.pi / 2)
            out.append((c + t * sign * math.sin(a) * ln, rx[i] * math.cos(a), rz[i] * math.cos(a), frames[i], arc[i] / total))
        return out

    if caps[0]:
        rings.extend(reversed(add_cap(0, -1.0, cap_len[0])))
    for i in range(n):
        rings.append((centers[i], rx[i], rz[i], frames[i], arc[i] / total))
    if caps[1]:
        rings.extend(add_cap(n - 1, 1.0, cap_len[1]))

    verts, uvs = [], []
    cols = segs + 1
    for (c, a, b, (xf, zf), v) in rings:
        for j in range(cols):
            th = 2 * math.pi * j / segs
            cx, sz = math.cos(th), math.sin(th)
            if exponent != 2.0:
                e = 2.0 / exponent
                cx = math.copysign(abs(cx) ** e, cx)
                sz = math.copysign(abs(sz) ** e, sz)
            k = shape(th, v) if shape else 1.0
            verts.append(c + (xf * (a * cx) + zf * (b * sz)) * k)
            uvs.append((j / segs, v))
    faces = []
    for i in range(len(rings) - 1):
        for j in range(segs):
            a0 = i * cols + j
            faces.append((a0, a0 + 1, a0 + cols + 1, a0 + cols))
    # fecha as pontas com leque
    def fan(ring_index, flip):
        base = ring_index * cols
        c = rings[ring_index][0]
        t = tang[0] if ring_index == 0 else tang[-1]
        tip = c + t * (-1 if ring_index == 0 else 1) * (min(rings[ring_index][1], rings[ring_index][2]) * 0.25 if caps[0 if ring_index == 0 else 1] else 0.0)
        verts.append(tip)
        uvs.append((0.5, rings[ring_index][4]))
        ci = len(verts) - 1
        for j in range(segs):
            tri = (base + j, base + j + 1, ci)
            faces.append(tuple(reversed(tri)) if flip else tri)
    if fans[0]:
        fan(0, True)
    if fans[1]:
        fan(len(rings) - 1, False)
    return Part(verts, faces, uvs, material, name)


def lathe(profile, segs: int = 24, sub: int = 4, center=(0, 0, 0), scale_z: float = 1.0, shape=None, material="base", name="torno", caps=(False, False), fans=(True, True)) -> Part:
    """Sólido de revolução em torno de Y. profile: lista de (raio, y)."""
    path = [((center[0], center[1] + y, center[2]), r, r * scale_z) for (r, y) in profile]
    return tube(path, segs=segs, sub=sub, caps=caps, shape=shape, material=material, name=name, fans=fans)


def ellipsoid(center, radii, segs: int = 20, rings: int = 12, material="base", name="elipsoide") -> Part:
    c = np.asarray(center, dtype=float)
    r = np.asarray(radii, dtype=float)
    verts, uvs, faces = [], [], []
    cols = segs + 1
    for i in range(rings + 1):
        ph = math.pi * i / rings
        for j in range(cols):
            th = 2 * math.pi * j / segs
            verts.append(c + r * np.array([math.sin(ph) * math.cos(th), math.cos(ph), math.sin(ph) * math.sin(th)]))
            uvs.append((j / segs, i / rings))
    for i in range(rings):
        for j in range(segs):
            a0 = i * cols + j
            if i == 0:
                faces.append((a0, a0 + cols + 1, a0 + cols))
            elif i == rings - 1:
                faces.append((a0, a0 + 1, a0 + cols))
            else:
                faces.append((a0, a0 + 1, a0 + cols + 1, a0 + cols))
    return Part(verts, faces, uvs, material, name)


def superbox(center, size, round_: float = 4.0, segs: int = 20, rings: int = 12, material="base", name="caixa") -> Part:
    """Caixa arredondada (superelipsoide)."""
    p = ellipsoid((0, 0, 0), (1, 1, 1), segs, rings, material, name)
    e = 2.0 / round_
    v = p.verts
    p.verts = np.sign(v) * np.abs(v) ** e * (np.asarray(size, dtype=float) * 0.5) + np.asarray(center, dtype=float)
    return p


def surface(func, nu: int, nv: int, wrap_u: bool = False, material="base", name="superficie", flip: bool = False) -> Part:
    """Superfície paramétrica: func(u, v) -> (x, y, z), u e v em 0..1."""
    verts, uvs, faces = [], [], []
    cols = nu + 1
    for i in range(nv + 1):
        v = i / nv
        for j in range(cols):
            u = j / nu
            verts.append(func(u, v))
            uvs.append((u, v))
    for i in range(nv):
        for j in range(nu):
            a0 = i * cols + j
            q = (a0, a0 + 1, a0 + cols + 1, a0 + cols)
            faces.append(tuple(reversed(q)) if flip else q)
    return Part(verts, faces, uvs, material, name)


def strip(path, width0: float, width1: float, nu: int = 6, sub: int = 5, normal=(0, 0, 1), curl: float = 0.0, material="base", name="faixa") -> Part:
    """Faixa de pano ao longo de um caminho de pontos (largura varia de width0 a width1)."""
    pts = _catmull(np.asarray(path, dtype=float), sub)
    n = len(pts)
    tang = np.zeros_like(pts)
    tang[1:-1] = pts[2:] - pts[:-2]
    tang[0] = pts[1] - pts[0]
    tang[-1] = pts[-1] - pts[-2]
    tang = norm(tang)
    nrm = np.asarray(normal, dtype=float)
    seglen = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    arc = np.concatenate([[0], np.cumsum(seglen)])
    total = max(arc[-1], 1e-9)
    verts, uvs, faces = [], [], []
    cols = nu + 1
    for i in range(n):
        v = arc[i] / total
        side = norm(np.cross(tang[i], nrm))
        nn = norm(np.cross(side, tang[i]))
        w = lerp(width0, width1, v)
        for j in range(cols):
            u = j / nu
            x = (u - 0.5)
            bow = (1 - (2 * x) ** 2) * curl * w
            verts.append(pts[i] + side * (x * w) + nn * bow)
            uvs.append((u, v))
    for i in range(n - 1):
        for j in range(nu):
            a0 = i * cols + j
            faces.append((a0, a0 + 1, a0 + cols + 1, a0 + cols))
    return Part(verts, faces, uvs, material, name)


def merge(parts) -> dict:
    """Junta peças num só conjunto de arrays (mantendo material por face)."""
    verts, uvs, colors, faces, fmat = [], [], [], [], []
    bones: dict[str, list] = {}
    off = 0
    mats: list[str] = []
    for p in parts:
        n = len(p.verts)
        verts.append(p.verts)
        uvs.append(p.uvs)
        colors.append(p.colors)
        if p.material not in mats:
            mats.append(p.material)
        mi = mats.index(p.material)
        for f in p.faces:
            faces.append(tuple(i + off for i in f))
            fmat.append(mi)
        for b, w in p.weights.items():
            bones.setdefault(b, []).append((off, np.asarray(w, dtype=float) * np.ones(n)))
        off += n
    total = off
    weights = {}
    for b, chunks in bones.items():
        arr = np.zeros(total)
        for (o, w) in chunks:
            arr[o:o + len(w)] = w
        weights[b] = arr
    return {
        "verts": np.concatenate(verts) if verts else np.zeros((0, 3)),
        "uvs": np.concatenate(uvs) if uvs else np.zeros((0, 2)),
        "colors": np.concatenate(colors) if colors else np.zeros((0, 4)),
        "faces": faces, "face_mat": fmat, "materials": mats, "weights": weights,
    }
