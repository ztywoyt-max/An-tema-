// Cabeças do motor HD: rosto modelado por formas (crânio, maçãs, nariz, lábios, órbitas), olhos, cabelo,
// barba, capuz e lenço. Tudo é feito em coordenadas da cabeça (centro do crânio na origem, rosto para +z)
// e depois levado para a pose de repouso do boneco. A mandíbula tem peso próprio: a boca abre nas falas.
import * as THREE from 'three';
import { Perlin, clamp, suave } from './ruido.js';
import { malha, cone, elipsoide, caixa, smin, smax } from './sdf.js';

const E = elipsoide, C = cone;
const sim = (x) => [x, -x];

export function sdfRosto({ mulher = 0, crianca = 0, idade = 0.3, nariz = 1, queixo = 1, gordo = 0, semente = 1 } = {}) {
  const P3 = new Perlin(semente);
  const fm = 1 - mulher * 0.14, nz = nariz * (1 - crianca * 0.3) * (1 - mulher * 0.12);
  const palp = [];
  const pos = [
    [E([0, 0.02, -0.012], [0.077, 0.093, 0.097]), 0],
    [E([0, -0.03, 0.028], [0.063 + gordo * 0.008, 0.075, 0.07]), 0.03],
    [E([0, -0.1 + crianca * 0.012, 0.054], [0.025 * queixo * fm, 0.019, 0.02]), 0.025],
    [E([0, 0.037, 0.072], [0.056, 0.012 + idade * 0.003, 0.014 * fm]), 0.02],
    [C([0, 0.03, 0.088], [0, -0.016 * nz, 0.088 + 0.025 * nz], 0.0072 * nz, 0.0105 * nz), 0.01],
    [E([0, -0.019 * nz, 0.086 + 0.021 * nz], [0.0115 * nz, 0.0095 * nz, 0.011 * nz]), 0.008],
    [E([0, -0.046, 0.091], [0.021, 0.0062 + mulher * 0.0015, 0.0098]), 0.006],
    [E([0, -0.0585, 0.088], [0.019, 0.0072 + mulher * 0.002, 0.0102]), 0.006],
    [C([0, -0.06, -0.02], [0, -0.17, -0.03], 0.05 * fm, 0.054 * fm), 0.03],
  ];
  for (const s of sim(1)) {
    pos.push([C([s * 0.056, -0.018, -0.006], [s * 0.016 * fm, -0.1, 0.052], 0.019 * fm, 0.016 * fm), 0.03]); // mandíbula
    pos.push([E([s * 0.046, 0.002, 0.057], [0.022, 0.0155, 0.02]), 0.02]); // maçã
    pos.push([E([s * 0.011 * nz, -0.023 * nz, 0.084 + 0.012 * nz], [0.0085 * nz, 0.007 * nz, 0.008 * nz]), 0.006]); // asas do nariz
    pos.push([E([s * 0.077, 0.0, -0.012], [0.011, 0.027, 0.019]), 0.008]); // orelha
    palp.push(E([s * 0.031, 0.0212, 0.0692], [0.0158, 0.0068, 0.0124])); // pálpebra de cima
    palp.push(E([s * 0.031, 0.0036, 0.0686], [0.0148, 0.0052, 0.0118])); // pálpebra de baixo
    if (crianca) pos.push([E([s * 0.04, -0.035, 0.055], [0.026, 0.022, 0.022]), 0.02]); // bochecha
  }
  const orb = sim(1).map((s) => E([s * 0.031, 0.0135, 0.083], [0.0195, 0.0125, 0.016]));
  const fundo = idade > 0.5 ? sim(1).map((s) => E([s * 0.045, -0.028, 0.071], [0.016, 0.02, 0.012])) : [];
  const boca = caixa([0, -0.0525, 0.1], [0.019, 0.0009, 0.012], 0.0005);
  return (x, y, z) => {
    let d = Infinity;
    for (const [f, k] of pos) d = d === Infinity ? f(x, y, z) : smin(d, f(x, y, z), k);
    for (const f of orb) d = smax(d, -f(x, y, z), 0.008);
    for (const f of palp) d = smin(d, f(x, y, z), 0.003);
    for (const f of fundo) d = smax(d, -f(x, y, z), 0.012);
    d = smax(d, -boca(x, y, z), 0.0015);
    return d + 0.0008 * P3.ruido(x * 90, y * 90, z * 90);
  };
}

export const OLHOS = [[0.031, 0.0125, 0.0655], [-0.031, 0.0125, 0.0655]];
export const RAIO_OLHO = 0.0115;

// peso da mandíbula (0..1) em coordenadas da cabeça
export function pesoMandibula(x, y, z) {
  return suave(-0.041, -0.056, y) * suave(-0.035, 0.015, z) * (1 - suave(-0.122, -0.138, y) * (z < 0.04 ? 1 : 0));
}

// limite do couro cabeludo (positivo = pode ter cabelo)
function linhaCabelo(x, y, z, estilo) {
  const lado = Math.abs(x);
  let lim;
  if (z > 0.02) lim = 0.045 + (z - 0.02) * 0.6 - (lado > 0.05 ? (lado - 0.05) * 1.2 : 0);
  else lim = estilo === 'longo' ? -0.2 : -0.045 + Math.max(0, -z) * 0.15;
  if (lado > 0.062 && z > -0.03 && z < 0.025 && estilo !== 'longo') lim = Math.max(lim, 0.022); // orelhas aparecendo
  return y - lim;
}

export function sdfCabelo({ estilo = 'curto', volume = 1, semente = 3 } = {}) {
  const P3 = new Perlin(semente);
  const cranio = E([0, 0.02, -0.012], [0.077, 0.093, 0.097]);
  const longo = E([0, -0.09, -0.07], [0.085, 0.12, 0.05]);
  const coque = E([0, 0.035, -0.112], [0.036, 0.034, 0.032]);
  return (x, y, z) => {
    const mechas = 0.004 * P3.ruido(x * 40, y * 12, z * 40) + 0.002 * P3.ruido(x * 120, y * 30, z * 120);
    let d = cranio(x, y, z) - 0.009 * volume - mechas;
    if (estilo === 'longo') d = smin(d, longo(x, y, z) - mechas, 0.04);
    if (estilo === 'preso') d = smin(d, coque(x, y, z) - mechas * 0.5, 0.02);
    return smax(d, -linhaCabelo(x, y, z, estilo), 0.006);
  };
}

export function sdfBarba({ tamanho = 1, bigode = true, semente = 5 } = {}) {
  const P3 = new Perlin(semente);
  const rosto = sdfRosto();
  return (x, y, z) => {
    const tufo = 0.004 * P3.ruido(x * 45, y * 25, z * 45);
    let d = rosto(x, y, z) - 0.003 - 0.005 * tamanho - tufo;
    // abaixo do nariz no meio, subindo pelas maçãs até as costeletas
    d = smax(d, y - (-0.046 + Math.min(Math.abs(x), 0.07) * 0.42), 0.006);
    d = smax(d, -0.012 - z, 0.01);
    d = smax(d, -(y + 0.13 + 0.03 * tamanho), 0.01);
    // boca livre
    const boca = E([0, -0.053, 0.1], [0.022, 0.008, 0.02]);
    d = smax(d, -boca(x, y, z), 0.004);
    if (bigode) d = smin(d, E([0, -0.041, 0.097], [0.027, 0.0065, 0.011])(x, y, z) - tufo * 0.5, 0.006);
    return d;
  };
}

// capuz (pano ou pele) e lenço: casca em volta do crânio, aberta no rosto
export function sdfCapuz({ folga = 0.028, ombros = true, lenco = false } = {}) {
  const cranio = E([0, 0.02, -0.012], [0.077, 0.093, 0.097]);
  const gola = E([0, -0.16, -0.03], [0.15, 0.06, 0.13]);
  return (x, y, z) => {
    let d = cranio(x, y, z) - folga;
    if (ombros && !lenco) d = smin(d, gola(x, y, z), 0.06);
    if (lenco) d = smin(d, E([0, -0.08, -0.07], [0.07, 0.07, 0.05])(x, y, z), 0.03);
    const oco = Math.abs(d + 0.006) - 0.006;
    // abertura do rosto: oval na frente
    const rx = 0.058 + folga * 0.4, ry = 0.085;
    const abre = (Math.hypot(x / rx, (y + 0.02) / ry) - 1) * 0.05;
    return smax(oco, -smax(-abre, 0.0 - z, 0.01), 0.004);
  };
}

// olho: esclera + íris pintada
let texIris = new Map();
function iris(cor) {
  if (texIris.has(cor)) return texIris.get(cor);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#bfb2a4'; g.fillRect(0, 0, 128, 128);
  const gr = g.createRadialGradient(64, 64, 8, 64, 64, 40);
  const base = new THREE.Color(cor);
  gr.addColorStop(0, '#' + base.clone().multiplyScalar(0.5).getHexString());
  gr.addColorStop(0.7, '#' + base.getHexString());
  gr.addColorStop(1, '#' + base.clone().multiplyScalar(0.35).getHexString());
  g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 40, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#050505'; g.beginPath(); g.arc(64, 64, 14, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texIris.set(cor, t);
  return t;
}
export function criarOlho(corIris = 0x4a3a28) {
  const g = new THREE.SphereGeometry(RAIO_OLHO, 20, 14);
  // mapeia a frente (+z) do globo no meio da textura
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / RAIO_OLHO, y = p.getY(i) / RAIO_OLHO;
    uv.setXY(i, 0.5 + x * 0.5, 0.5 + y * 0.5);
  }
  const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ map: iris(corIris), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }));
  return m;
}

export { linhaCabelo };
