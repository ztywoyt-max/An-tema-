// Ruído de Perlin (3D) com semente, fbm e versão que se repete (para texturas sem emenda).

export function rng(semente = 1) {
  let s = semente >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const mult = (per, f) => (Array.isArray(per) ? [per[0] * f, per[1] * f] : per * f);
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;
function grad(h, x, y, z) {
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

export class Perlin {
  constructor(semente = 1) {
    const r = rng(semente);
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    this.p = new Uint8Array(512);
    for (let i = 0; i < 512; i++) this.p[i] = p[i & 255];
  }

  // per: período inteiro (número, ou [px, py]) para a textura se repetir sem emenda; 0 = sem repetição
  ruido(x, y, z = 0, per = 0) {
    const p = this.p;
    let X = Math.floor(x), Y = Math.floor(y);
    const Z = Math.floor(z) & 255;
    x -= X; y -= Y; z -= Math.floor(z);
    const px = Array.isArray(per) ? per[0] : per, py = Array.isArray(per) ? per[1] : per;
    const wx = (a) => (px ? ((a % px) + px) % px : a) & 255;
    const wy = (a) => (py ? ((a % py) + py) % py : a) & 255;
    const X0 = wx(X), X1 = wx(X + 1), Y0 = wy(Y), Y1 = wy(Y + 1);
    const u = fade(x), v = fade(y), t = fade(z);
    const A0 = p[X0] + Y0, A1 = p[X0] + Y1, B0 = p[X1] + Y0, B1 = p[X1] + Y1;
    const h = (a, zz) => p[p[a] + zz] & 15;
    return lerp(
      lerp(lerp(grad(h(A0, Z), x, y, z), grad(h(B0, Z), x - 1, y, z), u),
        lerp(grad(h(A1, Z), x, y - 1, z), grad(h(B1, Z), x - 1, y - 1, z), u), v),
      lerp(lerp(grad(h(A0, Z + 1), x, y, z - 1), grad(h(B0, Z + 1), x - 1, y, z - 1), u),
        lerp(grad(h(A1, Z + 1), x, y - 1, z - 1), grad(h(B1, Z + 1), x - 1, y - 1, z - 1), u), v),
      t,
    );
  }

  fbm(x, y, z = 0, oitavas = 5, per = 0, ganho = 0.5) {
    let soma = 0, amp = 0.5, f = 1, norma = 0;
    for (let i = 0; i < oitavas; i++) {
      soma += amp * this.ruido(x * f, y * f, z * f + i * 17.3, mult(per, f));
      norma += amp;
      amp *= ganho;
      f *= 2;
    }
    return soma / norma; // ~[-0.7, 0.7]
  }

  // "ridged": cristas finas (rachaduras, veios)
  crista(x, y, z = 0, oitavas = 4, per = 0) {
    let soma = 0, amp = 0.5, f = 1;
    for (let i = 0; i < oitavas; i++) {
      soma += amp * (1 - Math.abs(this.ruido(x * f, y * f, z * f + i * 9.1, mult(per, f))) * 1.6);
      amp *= 0.5;
      f *= 2;
    }
    return soma;
  }
}

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const suave = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const mistura = (a, b, t) => a + (b - a) * t;
