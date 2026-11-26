// Mãos rígidas (aberta, meio fechada, punho, segurando um cabo), modeladas na pose de repouso do boneco.
import * as THREE from 'three';
import { malha, cone, elipsoide, smin } from './sdf.js';
import { add, sub, norm } from './boneco.js';
import { geoCache } from './cache.js';

const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// elipsoide orientado: centro c, eixos unitários (u, v, w) e raios r
function elipsoideOr(c, u, v, w, r) {
  const f = elipsoide([0, 0, 0], r);
  return (x, y, z) => { const p = [x - c[0], y - c[1], z - c[2]]; return f(dot(p, u), dot(p, v), dot(p, w)); };
}

// curvas dos dedos (graus por falange) para cada tipo de mão
const CURVA = { aberta: [12, 14, 10], meia: [40, 45, 30], punho: [85, 95, 70], segura: [70, 80, 55] };

export function sdfMao(J, lado, tipo = 'aberta', { mulher = 0 } = {}) {
  const s = lado === 'E' ? 1 : -1;
  const h = (J.altura / 1.82) * (1 - mulher * 0.1);
  const w = J['pulso' + lado];
  const d = norm(sub(J['mao' + lado], w)); // dedos
  const n = norm(cruz(d, [0, 0, s])); // palma (para dentro)
  const z = norm(cruz(n, d)); // lado do polegar
  const partes = [];
  const palma = add(w, d, 0.048 * h);
  partes.push(elipsoideOr(palma, d, z, n, [0.05 * h, 0.043 * h, 0.019 * h]));
  partes.push(elipsoideOr(add(add(palma, n, 0.006 * h), z, 0.022 * h), d, z, n, [0.03 * h, 0.018 * h, 0.017 * h])); // músculo do polegar
  const [c1, c2, c3] = CURVA[tipo].map((g) => (g * Math.PI) / 180);
  const comp = [[0.044, 0.028, 0.021], [0.048, 0.031, 0.023], [0.045, 0.029, 0.022], [0.036, 0.022, 0.019]];
  for (let i = 0; i < 4; i++) {
    let p = add(add(w, d, 0.092 * h), z, (0.028 - i * 0.0185) * h);
    p = add(p, d, -Math.abs(i - 1.2) * 0.006 * h);
    let ang = 0;
    const r0 = (0.0105 - i * 0.0006) * h;
    for (let f = 0; f < 3; f++) {
      ang += [c1, c2, c3][f];
      const dir = norm(add(add([0, 0, 0], d, Math.cos(ang)), n, Math.sin(ang)));
      const q = add(p, dir, comp[i][f] * h);
      partes.push(cone(p, q, r0 * (1 - f * 0.1), r0 * (0.92 - f * 0.12)));
      p = q;
    }
  }
  // polegar
  const pb = add(add(add(w, d, 0.022 * h), z, 0.03 * h), n, 0.012 * h);
  let pd = norm(add(add([0, 0, 0], d, 0.55), z, 0.8));
  let p = pb;
  const curvaP = tipo === 'aberta' ? 0.2 : tipo === 'meia' ? 0.6 : 1.1;
  for (let f = 0; f < 2; f++) {
    pd = norm(add(pd, n, curvaP * 0.6));
    const q = add(p, pd, (f ? 0.026 : 0.034) * h);
    partes.push(cone(p, q, 0.0125 * h, 0.011 * h));
    p = q;
  }
  const sdf = (x, y, zz) => {
    let r = Infinity;
    for (const f of partes) r = r === Infinity ? f(x, y, zz) : smin(r, f(x, y, zz), 0.008 * h);
    return r;
  };
  const c = add(w, d, 0.07 * h);
  const R = 0.13 * h;
  return { sdf, limites: { min: [c[0] - R, c[1] - R, c[2] - R], max: [c[0] + R, c[1] + R, c[2] + R] }, eixos: { d, n, z }, centroPalma: palma };
}

export function criarMao(J, lado, tipo, material, opc = {}) {
  const { sdf, limites, eixos } = sdfMao(J, lado, tipo, opc);
  const g = geoCache(opc.cache && `${opc.cache}/mao${lado}-${tipo}`, () => malha(sdf, { ...limites, passo: 0.0022 * (J.altura / 1.82), suavizar: 1 }));
  const m = new THREE.Mesh(g, material);
  m.castShadow = m.receiveShadow = true;
  m.userData.eixos = eixos;
  return m;
}
