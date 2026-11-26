// Modelagem por campos de distância (SDF): formas orgânicas (músculos, metal amassado, tecido)
// somadas com união suave e transformadas em malha por "surface nets".
import * as THREE from 'three';

export const smin = (a, b, k) => {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
export const smax = (a, b, k) => -smin(-a, -b, k);

export function esfera(c, r) {
  return (x, y, z) => Math.hypot(x - c[0], y - c[1], z - c[2]) - r;
}

// elipsoide (aproximação de distância de Inigo Quilez)
export function elipsoide(c, r) {
  return (x, y, z) => {
    const px = (x - c[0]) / r[0], py = (y - c[1]) / r[1], pz = (z - c[2]) / r[2];
    const k0 = Math.hypot(px, py, pz);
    const k1 = Math.hypot(px / r[0], py / r[1], pz / r[2]);
    return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(r[0], r[1], r[2]);
  };
}

// cone arredondado entre dois pontos (raios ra em a, rb em b)
export function cone(a, b, ra, rb) {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = ra - rb;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  return (x, y, z) => {
    const pax = x - a[0], pay = y - a[1], paz = z - a[2];
    const yv = pax * bax + pay * bay + paz * baz;
    const zv = yv - l2;
    const qx = pax * l2 - bax * yv, qy = pay * l2 - bay * yv, qz = paz * l2 - baz * yv;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = yv * yv * l2;
    const z2 = zv * zv * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zv) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
    if (Math.sign(yv) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
    return (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - ra;
  };
}

// caixa arredondada (centro, meia-medida, raio de canto)
export function caixa(c, h, r = 0) {
  return (x, y, z) => {
    const qx = Math.abs(x - c[0]) - h[0] + r, qy = Math.abs(y - c[1]) - h[1] + r, qz = Math.abs(z - c[2]) - h[2] + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
  };
}

// une várias formas: [[fn, k, esferaEnvolvente?], ...] (k = suavidade da junção com o que veio antes).
// Com a esfera envolvente [cx, cy, cz, r], a forma é pulada quando está longe (fica muito mais rápido).
export function unir(partes) {
  return (x, y, z) => {
    let d = Infinity;
    for (let i = 0; i < partes.length; i++) {
      const [fn, k, b] = partes[i];
      if (b && d < Infinity && Math.hypot(x - b[0], y - b[1], z - b[2]) - b[3] > d + k) continue;
      d = d === Infinity ? fn(x, y, z) : smin(d, fn(x, y, z), k);
    }
    return d;
  };
}
export const envCone = (a, b, ra, rb) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 2 + Math.max(ra, rb)];
export const envEl = (c, r) => [c[0], c[1], c[2], Math.max(...r)];

// caixa envolvente de uma lista de pontos, com folga
export function limites(pontos, folga) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of pontos) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]); }
  return { min: min.map((v) => v - folga), max: max.map((v) => v + folga) };
}

/**
 * Surface nets: transforma o campo em malha.
 * sdf(x, y, z) -> distância; min/max: caixa; passo: tamanho da célula (m).
 * uv: função opcional (x, y, z) -> [u, v].
 */
export function malha(sdf, { min, max, passo, uv = null, suavizar = 1 }) {
  const nx = Math.ceil((max[0] - min[0]) / passo) + 1;
  const ny = Math.ceil((max[1] - min[1]) / passo) + 1;
  const nz = Math.ceil((max[2] - min[2]) / passo) + 1;
  const campo = new Float32Array(nx * ny * nz);
  const I = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) {
    const z = min[2] + k * passo;
    for (let j = 0; j < ny; j++) {
      const y = min[1] + j * passo;
      for (let i = 0; i < nx; i++) campo[I(i, j, k)] = sdf(min[0] + i * passo, y, z);
    }
  }
  const cx = nx - 1, cy = ny - 1, cz = nz - 1;
  const vid = new Int32Array(cx * cy * cz).fill(-1);
  const C = (i, j, k) => i + cx * (j + cy * k);
  const pos = [];
  const cantos = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const arestas = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let k = 0; k < cz; k++) {
    for (let j = 0; j < cy; j++) {
      for (let i = 0; i < cx; i++) {
        let neg = 0;
        for (let c = 0; c < 8; c++) {
          v[c] = campo[I(i + cantos[c][0], j + cantos[c][1], k + cantos[c][2])];
          if (v[c] < 0) neg++;
        }
        if (neg === 0 || neg === 8) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (const [a, b] of arestas) {
          if ((v[a] < 0) === (v[b] < 0)) continue;
          const t = v[a] / (v[a] - v[b]);
          sx += cantos[a][0] + (cantos[b][0] - cantos[a][0]) * t;
          sy += cantos[a][1] + (cantos[b][1] - cantos[a][1]) * t;
          sz += cantos[a][2] + (cantos[b][2] - cantos[a][2]) * t;
          n++;
        }
        vid[C(i, j, k)] = pos.length / 3;
        pos.push(min[0] + (i + sx / n) * passo, min[1] + (j + sy / n) * passo, min[2] + (k + sz / n) * passo);
      }
    }
  }
  const idx = [];
  const quad = (a, b, c, d, inverter) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (inverter) idx.push(a, b, c, a, c, d);
    else idx.push(a, c, b, a, d, c);
  };
  for (let k = 1; k < cz; k++) {
    for (let j = 1; j < cy; j++) {
      for (let i = 0; i < cx; i++) {
        // aresta em x entre (i,j,k) e (i+1,j,k)
        const a = campo[I(i, j, k)] < 0, b = campo[I(i + 1, j, k)] < 0;
        if (a !== b) quad(vid[C(i, j - 1, k - 1)], vid[C(i, j, k - 1)], vid[C(i, j, k)], vid[C(i, j - 1, k)], a);
      }
    }
  }
  for (let k = 1; k < cz; k++) {
    for (let j = 0; j < cy; j++) {
      for (let i = 1; i < cx; i++) {
        const a = campo[I(i, j, k)] < 0, b = campo[I(i, j + 1, k)] < 0;
        if (a !== b) quad(vid[C(i - 1, j, k - 1)], vid[C(i - 1, j, k)], vid[C(i, j, k)], vid[C(i, j, k - 1)], a);
      }
    }
  }
  for (let k = 0; k < cz; k++) {
    for (let j = 1; j < cy; j++) {
      for (let i = 1; i < cx; i++) {
        const a = campo[I(i, j, k)] < 0, b = campo[I(i, j, k + 1)] < 0;
        if (a !== b) quad(vid[C(i - 1, j - 1, k)], vid[C(i, j - 1, k)], vid[C(i, j, k)], vid[C(i - 1, j, k)], a);
      }
    }
  }
  let p = new Float32Array(pos);
  // suavização leve (média com os vizinhos), puxando de volta para a superfície
  if (suavizar > 0) {
    const nv = p.length / 3;
    for (let it = 0; it < suavizar; it++) {
      const soma = new Float32Array(p.length), cont = new Uint16Array(nv);
      for (let t = 0; t < idx.length; t += 3) {
        for (let e = 0; e < 3; e++) {
          const a = idx[t + e], b = idx[t + ((e + 1) % 3)];
          soma[a * 3] += p[b * 3]; soma[a * 3 + 1] += p[b * 3 + 1]; soma[a * 3 + 2] += p[b * 3 + 2]; cont[a]++;
        }
      }
      for (let q = 0; q < nv; q++) {
        if (!cont[q]) continue;
        p[q * 3] = p[q * 3] * 0.5 + (soma[q * 3] / cont[q]) * 0.5;
        p[q * 3 + 1] = p[q * 3 + 1] * 0.5 + (soma[q * 3 + 1] / cont[q]) * 0.5;
        p[q * 3 + 2] = p[q * 3 + 2] * 0.5 + (soma[q * 3 + 2] / cont[q]) * 0.5;
      }
    }
  }
  // normais pelo gradiente do campo (mais lisas que as da malha)
  const nor = new Float32Array(p.length);
  const h = passo * 0.5;
  for (let q = 0; q < p.length; q += 3) {
    const x = p[q], y = p[q + 1], z = p[q + 2];
    let gx = sdf(x + h, y, z) - sdf(x - h, y, z);
    let gy = sdf(x, y + h, z) - sdf(x, y - h, z);
    let gz = sdf(x, y, z + h) - sdf(x, y, z - h);
    const l = Math.hypot(gx, gy, gz) || 1;
    nor[q] = gx / l; nor[q + 1] = gy / l; nor[q + 2] = gz / l;
    // projeta o vértice de volta na superfície
    const d = sdf(x, y, z);
    p[q] -= nor[q] * d; p[q + 1] -= nor[q + 1] * d; p[q + 2] -= nor[q + 2] * d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) {
    const u = new Float32Array((p.length / 3) * 2);
    for (let q = 0, w = 0; q < p.length; q += 3, w += 2) {
      const r = uv(p[q], p[q + 1], p[q + 2]);
      u[w] = r[0]; u[w + 1] = r[1];
    }
    g.setAttribute('uv', new THREE.BufferAttribute(u, 2));
  }
  g.setIndex(idx.length / 3 > 65535 / 3 || p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}
