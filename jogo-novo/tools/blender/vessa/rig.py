"""Esqueleto humanoide do jogo (pose de descanso em "A").

Espaço do jogo: X = direita, Y = cima, Z = trás (olha para -Z). Medidas em metros.
Cada osso: nome -> (pai, cabeça, cauda).
"""
import numpy as np


def _v(*a):
    return np.array(a, dtype=float)


def humanoid() -> dict:
    b: dict[str, tuple] = {}

    def add(name, parent, head, tail):
        b[name] = (parent, _v(*head), _v(*tail))

    # tronco
    add("hips", None, (0, 0.96, 0.0), (0, 1.08, 0.0))
    add("spine", "hips", (0, 1.08, 0.0), (0, 1.24, -0.005))
    add("chest", "spine", (0, 1.24, -0.005), (0, 1.44, 0.0))
    add("neck", "chest", (0, 1.44, 0.0), (0, 1.51, -0.005))
    add("head", "neck", (0, 1.51, -0.005), (0, 1.77, -0.005))

    for s, sx in (("_r", 1.0), ("_l", -1.0)):
        # braço em A (45 graus), antebraço levemente à frente
        sh0 = _v(0.045 * sx, 1.415, 0.0)
        sh1 = _v(0.158 * sx, 1.43, 0.0)
        el = sh1 + _v(0.7071 * sx, -0.7071, 0.0) * 0.275
        wr = el + _v(0.68 * sx, -0.72, -0.14) / np.linalg.norm(_v(0.68, -0.72, -0.14)) * 0.255
        tip = wr + (wr - el) / np.linalg.norm(wr - el) * 0.09
        add("shoulder" + s, "chest", sh0, sh1)
        add("upper_arm" + s, "shoulder" + s, sh1, el)
        add("forearm" + s, "upper_arm" + s, el, wr)
        add("hand" + s, "forearm" + s, wr, tip)
        # ponto de empunhadura: no meio do punho fechado, apontando para a frente
        d = (wr - el) / np.linalg.norm(wr - el)
        grip = wr + d * 0.062 + _v(-0.012 * sx, 0.0, 0.0)
        add(("weapon" if s == "_r" else "item") + s, "hand" + s, grip, grip + _v(0.0, 0.03, -0.12))
        # perna
        hip = _v(0.088 * sx, 0.935, 0.0)
        knee = _v(0.096 * sx, 0.5, -0.02)
        ankle = _v(0.096 * sx, 0.085, 0.012)
        ball = _v(0.1 * sx, 0.028, -0.115)
        add("thigh" + s, "hips", hip, knee)
        add("shin" + s, "thigh" + s, knee, ankle)
        add("foot" + s, "shin" + s, ankle, ball)
        add("toe" + s, "foot" + s, ball, ball + _v(0, -0.004, -0.075))

    # cachecol: duas pontas saindo de trás do pescoço
    def chain(prefix, parent, start, direction, n, seg):
        d = _v(*direction)
        d = d / np.linalg.norm(d)
        p = _v(*start)
        prev = parent
        for i in range(n):
            name = f"{prefix}{i + 1}"
            add(name, prev, p, p + d * seg)
            p = p + d * seg
            prev = name

    chain("scarf_a", "chest", (0.035, 1.455, 0.085), (0.05, -0.72, 0.69), 5, 0.15)
    chain("scarf_b", "chest", (-0.02, 1.455, 0.09), (-0.12, -0.8, 0.58), 4, 0.135)
    # panos da cintura
    chain("cloth_b", "hips", (0.0, 0.985, 0.118), (0, -1, 0.1), 3, 0.19)
    chain("cloth_f", "hips", (0.0, 0.985, -0.118), (0, -1, -0.07), 2, 0.19)
    chain("sash", "hips", (-0.115, 1.0, -0.085), (-0.12, -1, -0.05), 2, 0.15)
    # rabo de cavalo
    chain("hair", "head", (0.0, 1.665, 0.1), (0, -0.86, 0.5), 3, 0.105)
    return b


def joints(bones: dict) -> dict:
    return {k: v[1] for k, v in bones.items()}
