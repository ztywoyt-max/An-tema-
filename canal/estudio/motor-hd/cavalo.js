// Cavalo de tração (com esqueleto próprio de quatro patas) e a carroça de madeira.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cone, elipsoide, envCone, envEl, smin, smax, malha } from './sdf.js';
import { criarBoneco, sdfDePartes, somar, add } from './boneco.js';
import { triplanar } from './materiais.js';
import { pelo, fios, madeira, couro, ferrugem } from './texturas.js';
import { geoCache } from './cache.js';

export const OSSOS_CAVALO = [
  ['raiz', null, 'raiz', 'coluna'], ['coluna', 'raiz', 'coluna', 'peito'], ['peito', 'coluna', 'peito', 'pescoco'],
  ['pescoco', 'peito', 'pescoco', 'nuca'], ['cabeca', 'pescoco', 'nuca', 'focinho'], ['cauda', 'raiz', 'caudaBase', 'caudaFim'],
  ['ombroE', 'peito', 'ombroE', 'joelhoE'], ['canelaE', 'ombroE', 'joelhoE', 'boletoE'], ['cascoE', 'canelaE', 'boletoE', 'patE'],
  ['ombroD', 'peito', 'ombroD', 'joelhoD'], ['canelaD', 'ombroD', 'joelhoD', 'boletoD'], ['cascoD', 'canelaD', 'boletoD', 'patD'],
  ['coxaTE', 'raiz', 'quadrilTE', 'jarreteTE'], ['canelaTE', 'coxaTE', 'jarreteTE', 'boletoTE'], ['cascoTE', 'canelaTE', 'boletoTE', 'patTE'],
  ['coxaTD', 'raiz', 'quadrilTD', 'jarreteTD'], ['canelaTD', 'coxaTD', 'jarreteTD', 'boletoTD'], ['cascoTD', 'canelaTD', 'boletoTD', 'patTD'],
];
const RAIOS = { ombro: 0.12, canela: 0.07, casco: 0.05, coxaT: 0.14, canelaT: 0.08, cascoT: 0.05, pescoco: 0.15, cabeca: 0.1, coluna: 0.2, peito: 0.2, cauda: 0.05 };

function juntasCavalo() {
  const J = {
    raiz: [0, 1.42, -0.55], coluna: [0, 1.4, -0.05], peito: [0, 1.46, 0.45], pescoco: [0, 1.42, 0.62], nuca: [0, 1.93, 1.02], focinho: [0, 1.46, 1.42],
    caudaBase: [0, 1.42, -0.88], caudaFim: [0, 0.72, -1.02],
  };
  for (const [l, s] of [['E', 1], ['D', -1]]) {
    J['ombro' + l] = [s * 0.19, 1.18, 0.55]; J['joelho' + l] = [s * 0.19, 0.56, 0.58]; J['boleto' + l] = [s * 0.19, 0.2, 0.59]; J['pat' + l] = [s * 0.19, 0.0, 0.66];
    J['quadrilT' + l] = [s * 0.21, 1.22, -0.6]; J['jarreteT' + l] = [s * 0.19, 0.62, -0.74]; J['boletoT' + l] = [s * 0.19, 0.2, -0.68]; J['patT' + l] = [s * 0.19, 0.0, -0.61];
  }
  J.altura = 1.82; // escala de referência dos raios de junta
  J.topo = [0, 2.1, 1.0];
  return J;
}

function partesCavalo(J) {
  const P = [];
  const C = (a, b, ra, rb, k, o) => P.push([cone(a, b, ra, rb), k, envCone(a, b, ra, rb), o]);
  const E = (c, r, k, o) => P.push([elipsoide(c, r), k, envEl(c, r), o]);
  E([0, 1.3, -0.52], [0.3, 0.33, 0.38], 0, 'raiz');
  E([0, 1.26, -0.05], [0.31, 0.35, 0.42], 0.12, 'coluna');
  E([0, 1.27, 0.4], [0.27, 0.36, 0.3], 0.12, 'peito');
  for (const s of [1, -1]) E([s * 0.13, 1.36, -0.62], [0.17, 0.21, 0.25], 0.1, 'raiz');
  C([0, 1.36, 0.55], [0, 1.86, 0.97], 0.21, 0.11, 0.1, 'pescoco');
  E([0, 1.6, 0.68], [0.1, 0.24, 0.16], 0.08, 'pescoco'); // crista
  C([0, 1.9, 1.0], [0, 1.5, 1.37], 0.1, 0.072, 0.05, 'cabeca');
  E([0, 1.79, 1.03], [0.085, 0.12, 0.12], 0.05, 'cabeca');
  E([0, 1.49, 1.37], [0.078, 0.085, 0.095], 0.04, 'cabeca');
  for (const s of [1, -1]) {
    C([s * 0.055, 1.97, 0.98], [s * 0.07, 2.1, 0.94], 0.022, 0.006, 0.02, 'cabeca'); // orelha
    E([s * 0.075, 1.83, 1.12], [0.02, 0.022, 0.025], 0.02, 'cabeca'); // olho/osso
    const l = s > 0 ? 'E' : 'D';
    E([s * 0.17, 1.12, 0.5], [0.1, 0.24, 0.15], 0.08, 'ombro' + l);
    C(J['ombro' + l], J['joelho' + l], 0.09, 0.055, 0.05, 'ombro' + l);
    C(J['joelho' + l], J['boleto' + l], 0.043, 0.036, 0.03, 'canela' + l);
    E(J['boleto' + l], [0.045, 0.045, 0.05], 0.02, 'casco' + l);
    C(J['boleto' + l], add(J['pat' + l], [0, 0.04, 0]), 0.038, 0.058, 0.02, 'casco' + l);
    E([s * 0.19, 1.12, -0.6], [0.13, 0.27, 0.21], 0.08, 'coxaT' + l);
    C(J['quadrilT' + l], J['jarreteT' + l], 0.11, 0.05, 0.06, 'coxaT' + l);
    E(J['jarreteT' + l], [0.05, 0.06, 0.07], 0.03, 'canelaT' + l);
    C(J['jarreteT' + l], J['boletoT' + l], 0.046, 0.037, 0.03, 'canelaT' + l);
    E(J['boletoT' + l], [0.045, 0.045, 0.05], 0.02, 'cascoT' + l);
    C(J['boletoT' + l], add(J['patT' + l], [0, 0.04, 0]), 0.038, 0.058, 0.02, 'cascoT' + l);
  }
  return P;
}

export function criarCavalo({ cor = 0x5a3a24, crina = 0x1a120c, chave = 'cavalo-v1' } = {}) {
  const J = juntasCavalo();
  const partes = partesCavalo(J);
  const mat = triplanar(pelo(), { escala: 9, relevo: 0.5, metal: 0, cor, fisico: { sheen: 0.7, sheenRoughness: 0.4, sheenColor: new THREE.Color(cor).multiplyScalar(1.6) } });
  const matCrina = triplanar(fios(), { escala: 4, relevo: 1.2, metal: 0, cor: crina, rugosidade: 0.9 });
  const cauda = cone(J.caudaBase, J.caudaFim, 0.05, 0.09);
  const crinaSdf = (x, y, z) => {
    // faixa de pelos ao longo do alto do pescoço e o topete
    const t = Math.min(1, Math.max(0, (z - 0.5) / 0.52));
    const yc = 1.62 + t * 0.32 + 0.12, zc = 0.5 + t * 0.52;
    const d1 = Math.hypot(x * 2.2, (y - yc) * 1.0, (z - zc) * 0.6) - 0.12 + 0.01 * Math.sin(z * 60 + y * 30);
    return Math.min(smax(d1, Math.abs(x) - 0.06, 0.01), cauda(x, y, z) - 0.01 * Math.sin(y * 50));
  };
  const b = criarBoneco({
    J, partes, ossos: OSSOS_CAVALO, raios: RAIOS, nome: 'cavalo',
    corpo: { material: mat, passo: 0.012, cache: chave, caixa: { min: [-0.5, 0, -1.15], max: [0.5, 2.2, 1.55] } },
    roupas: [{ sdf: crinaSdf, limites: { min: [-0.15, 0.6, -1.15], max: [0.15, 2.15, 1.15] }, passo: 0.012, material: matCrina, permitidos: ['pescoco', 'cabeca', 'cauda', 'raiz'] }],
  });
  // arreio: coelheira de couro no pescoço
  const coel = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 10, 28), triplanar(couro(), { escala: 5, relevo: 1, metal: 0, cor: 0x704a30 }));
  coel.position.set(0, 1.5, 0.66);
  coel.rotation.x = -0.75;
  coel.scale.set(0.85, 1.15, 1);
  b.prender('pescoco', coel);
  return b;
}

// passo do cavalo (quatro tempos): fase em ciclos
export function cavaloAndar(fase, { passo = 1 } = {}) {
  const perna = (f, tras) => {
    const a = f * Math.PI * 2;
    const s = Math.sin(a);
    const ergue = Math.max(0, Math.sin(a + 1.2));
    return tras
      ? { c: [-18 * s * passo, 0, 0], k: [-30 * ergue * passo, 0, 0], p: [40 * ergue * passo, 0, 0] }
      : { c: [-16 * s * passo, 0, 0], k: [55 * ergue * passo, 0, 0], p: [30 * ergue * passo, 0, 0] };
  };
  const ph = { TE: 0, E: 0.25, TD: 0.5, D: 0.75 };
  const p = {};
  for (const [l, off] of Object.entries(ph)) {
    const tras = l.startsWith('T');
    const r = perna(fase + off, tras);
    const lado = tras ? l.slice(1) : l;
    if (tras) { p['coxaT' + lado] = r.c; p['canelaT' + lado] = r.k; p['cascoT' + lado] = r.p; }
    else { p['ombro' + lado] = r.c; p['canela' + lado] = r.k; p['casco' + lado] = r.p; }
  }
  const b = Math.sin(fase * Math.PI * 4);
  return somar(p, { pescoco: [3 * b, 0, 0], cabeca: [2 * b, 0, 0], cauda: [8, 4 * Math.sin(fase * Math.PI * 2), 0], pos: [0, 0.012 * b, 0] });
}

// ---------- carroça ----------
export function criarCarroca() {
  const g = new THREE.Group();
  const matM = triplanar(madeira(), { escala: 2.2, relevo: 1.2, metal: 0 });
  const matF = triplanar(ferrugem(), { escala: 4, relevo: 0.8 });
  const tabua = (w, h, d, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matM);
    m.position.set(x, y, z); m.rotation.y = ry;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  // estrado e laterais (a frente da carroça aponta para +z)
  for (let i = 0; i < 6; i++) tabua(1.16, 0.04, 0.29, 0, 0.72, -0.75 + i * 0.3);
  for (const s of [-1, 1]) {
    for (let k = 0; k < 2; k++) tabua(0.04, 0.16, 1.82, s * 0.6, 0.84 + k * 0.17, 0);
    for (const z of [-0.85, 0, 0.85]) tabua(0.06, 0.44, 0.06, s * 0.6, 0.9, z);
  }
  for (let k = 0; k < 2; k++) tabua(1.24, 0.16, 0.04, 0, 0.84 + k * 0.17, -0.9);
  tabua(1.24, 0.3, 0.04, 0, 0.88, 0.9);
  tabua(1.2, 0.05, 0.3, 0, 1.12, 0.72); // banco do condutor
  tabua(0.12, 0.1, 1.9, 0, 0.62, 0); // eixo de baixo
  // varais até o cavalo
  for (const s of [-1, 1]) {
    const v = tabua(0.07, 0.07, 2.2, s * 0.42, 0.82, 1.9);
    v.rotation.x = 0.05;
  }
  // rodas
  const rodas = [];
  for (const s of [-1, 1]) {
    const roda = new THREE.Group();
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.045, 10, 36), matM);
    aro.rotation.y = Math.PI / 2;
    const ferro = new THREE.Mesh(new THREE.TorusGeometry(0.535, 0.012, 6, 36), matF);
    ferro.rotation.y = Math.PI / 2;
    const cubo = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 14), matM);
    cubo.rotation.z = Math.PI / 2;
    roda.add(aro, ferro, cubo);
    for (let r = 0; r < 10; r++) {
      const raio = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.46, 0.05), matM);
      raio.position.y = 0.25;
      const piv = new THREE.Group();
      piv.rotation.x = (r / 10) * Math.PI * 2;
      piv.add(raio);
      roda.add(piv);
    }
    roda.position.set(s * 0.72, 0.54, -0.05);
    roda.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    g.add(roda);
    rodas.push(roda);
  }
  // carga: sacos e ferros
  const saco = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), triplanar(madeira(), { escala: 1, relevo: 0.3, metal: 0, cor: 0x9a8a6a }));
  saco.scale.set(1.2, 0.7, 0.9); saco.position.set(-0.3, 0.86, -0.55);
  saco.castShadow = saco.receiveShadow = true;
  g.add(saco);
  for (let i = 0; i < 5; i++) {
    const barra = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.9), matF);
    barra.position.set(0.25 + (i % 2) * 0.06, 0.77 + i * 0.03, -0.45);
    barra.rotation.y = (i - 2) * 0.05;
    barra.castShadow = true;
    g.add(barra);
  }
  g.userData.rodas = rodas;
  g.userData.girar = (dist) => { for (const r of rodas) r.rotation.x = dist / 0.53; };
  return g;
}
