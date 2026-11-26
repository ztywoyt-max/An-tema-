// Cenários de "O Cavaleiro Sem Armadura" no motor HD.
// Cada cenário tem uma base (geometria, montada uma vez) e variações de hora/clima (céu, luzes, névoa).
import * as THREE from 'three';
import { Perlin, suave, mistura } from '../../motor-hd/ruido.js';
import {
  criarChao, criarMato, criarFloresta, criarArvoreSeca, criarPedras, criarTronco, criarCeu, ambienteDoCeu,
  criarTerreno, alturaChao, distEstrada, criarNeblina,
} from '../../motor-hd/natureza.js';
import { casa, celeiro, moinho, ponte, rio, poco, barril, cerca, muro, materiaisAldeia } from '../../motor-hd/aldeia.js';
import { criarParticulas, criarChuva, criarChama, luzFogo, atualizarEfeitos } from '../../motor-hd/efeitos.js';

const P = new Perlin(5);
const bases = {};

// ---------- luzes e ambiente por hora do dia ----------
// sol/lua: direção (para onde a luz vem), cor e força; ceu: tipo do céu; nevoa: parâmetros
const HORAS = {
  noite: { ceu: 'noite', dir: [-0.7, 0.34, -1], corNevoa: [0.013, 0.019, 0.034], corLua: [0.07, 0.09, 0.15], dens: 0.055, queda: 2.4, exp: 9, luz: [0xa8bcff, 2.2], hemi: [0x2a3a58, 0x0d0b08, 0.7], expo: 1.3, amb: 0.9, sat: 0.8, janelas: 2.5 },
  amanhecer: { ceu: 'amanhecer', dir: [0.9, 0.12, -0.5], corNevoa: [0.16, 0.16, 0.19], corLua: [0.5, 0.36, 0.3], dens: 0.03, queda: 3, exp: 4, luz: [0xffc8a0, 1.6], hemi: [0x8a94aa, 0x3a3028, 1.1], expo: 1.0, amb: 1.0, sat: 0.75, janelas: 1.2 },
  dia: { ceu: 'nublado', dir: [0.5, 0.75, 0.3], corNevoa: [0.3, 0.32, 0.35], corLua: [0.12, 0.12, 0.1], dens: 0.014, queda: 6, exp: 3, luz: [0xfff0e0, 2.0], hemi: [0xb0bccc, 0x5a4a38, 1.5], expo: 0.9, amb: 1.0, sat: 0.78, janelas: 0 },
  tarde: { ceu: 'tarde', dir: [-0.9, 0.16, -0.45], corNevoa: [0.3, 0.2, 0.15], corLua: [0.9, 0.45, 0.18], dens: 0.016, queda: 5, exp: 4, luz: [0xffa060, 3.4], hemi: [0x7a7a90, 0x4a3020, 0.9], expo: 0.95, amb: 0.9, sat: 0.95, janelas: 0.6 },
  ventoso: { ceu: 'nublado', dir: [0.3, 0.8, -0.4], corNevoa: [0.22, 0.24, 0.27], corLua: [0.06, 0.06, 0.06], dens: 0.02, queda: 6, exp: 3, luz: [0xdde4ec, 1.2], hemi: [0x9aa4b4, 0x4a4038, 1.4], expo: 0.95, amb: 1.0, sat: 0.6, janelas: 0 },
  tempestade: { ceu: 'tempestade', dir: [0.3, 0.6, -1], corNevoa: [0.008, 0.01, 0.016], corLua: [0.02, 0.025, 0.035], dens: 0.05, queda: 4, exp: 6, luz: [0x8090b0, 0.5], hemi: [0x1a2232, 0x080706, 0.5], expo: 1.4, amb: 0.6, sat: 0.65, janelas: 2.5 },
  aurora: { ceu: 'amanhecer', dir: [0.2, 0.1, -1], corNevoa: [0.34, 0.26, 0.3], corLua: [0.8, 0.45, 0.4], dens: 0.028, queda: 2.2, exp: 3, luz: [0xffb898, 2.0], hemi: [0xb09aa8, 0x4a3a32, 1.0], expo: 0.95, amb: 1.0, sat: 0.85, janelas: 0.5 },
  sepia: { ceu: 'tarde', dir: [-0.5, 0.25, -1], corNevoa: [0.22, 0.17, 0.11], corLua: [0.5, 0.34, 0.16], dens: 0.025, queda: 4, exp: 4, luz: [0xffd8a0, 2.4], hemi: [0x9a8a70, 0x3a2a18, 1.0], expo: 1.0, amb: 0.8, sat: 0.35, tinta: [1.08, 0.98, 0.8], janelas: 0.5 },
  sepiaNoite: { ceu: 'noite', dir: [-0.4, 0.4, -1], corNevoa: [0.04, 0.025, 0.015], corLua: [0.12, 0.08, 0.04], dens: 0.04, queda: 4, exp: 6, luz: [0x9a8a70, 0.6], hemi: [0x3a3020, 0x100804, 0.5], expo: 1.3, amb: 0.5, sat: 0.4, tinta: [1.1, 0.95, 0.75], janelas: 2 },
};

function variante(ctx, hora, extra = {}) {
  const H = { ...HORAS[hora], ...extra };
  const g = new THREE.Group();
  const dirLua = new THREE.Vector3(...H.dir).normalize();
  const ceu = criarCeu({ dirLua, corNevoa: H.corNevoa, corLua: H.corLua, tipo: H.ceu });
  g.add(ceu);
  const hemi = new THREE.HemisphereLight(H.hemi[0], H.hemi[1], H.hemi[2]);
  g.add(hemi);
  const sol = new THREE.DirectionalLight(H.luz[0], H.luz[1]);
  sol.position.copy(dirLua).multiplyScalar(40);
  sol.castShadow = true;
  sol.shadow.mapSize.set(4096, 4096);
  Object.assign(sol.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 100 });
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.03;
  g.add(sol, sol.target);
  return {
    grupo: g, sol, hemi, H,
    ambiente: {
      nevoa: { densidade: H.dens, base: 0, queda: H.queda, dirLua: H.dir, corLua: H.corLua, expoente: H.exp },
      corNevoa: H.corNevoa, ambiente: ambienteDoCeu(ctx.renderer, ceu), intensidadeAmbiente: H.amb, exposicao: H.expo, saturacao: H.sat, tinta: H.tinta,
    },
    // a luz principal e a sombra acompanham o ponto de interesse do plano
    focar(x, y, z) { sol.target.position.set(x, y, z); sol.position.copy(dirLua).multiplyScalar(40).add(sol.target.position); },
  };
}

// ---------- estrada do vale (noite de neblina) ----------
function baseEstrada() {
  if (bases.estrada) return bases.estrada;
  const g = new THREE.Group();
  g.add(criarChao());
  g.add(criarMato({ qtd: 26000, raio: 24, centro: [-1, -4] }));
  g.add(criarFloresta({ qtd: 380, evitar: [[0, 2, 4]] }));
  const arv = criarArvoreSeca(4);
  arv.position.set(3.4, alturaChao(3.4, -3.2), -3.2);
  arv.rotation.y = 2.2;
  g.add(arv);
  g.add(criarPedras([[-2.6, -1.8, 0.7], [-2.1, -0.9, 0.3], [2.3, 0.4, 0.38], [2.0, 1.4, 0.22], [-1.9, 1.8, 0.25], [3.0, -6.5, 0.9], [-3.5, -9, 1.2], [1.8, -2.4, 0.18], [3.4, 6, 0.6], [-3.2, 9, 0.8]]));
  const tronco = criarTronco({ x: 0.3, z: -5.2, comp: 6.5, raio: 0.3, giro: 0.14 });
  g.add(tronco);
  g.add(criarNeblina([[-3, 0.7, -9, 9, 2.2, 0.3], [4, 0.6, -12, 10, 2, 0.28], [0, 0.8, -16, 14, 2.6, 0.32], [-6, 0.9, -20, 12, 3, 0.28], [6, 1.0, -24, 14, 3, 0.28]], [0.32, 0.4, 0.58]));
  g.userData.tronco = tronco;
  bases.estrada = g;
  return g;
}
export function estrada(ctx, hora = 'noite') {
  const v = variante(ctx, hora);
  v.base = baseEstrada();
  v.tronco = v.base.userData.tronco;
  v.altura = alturaChao;
  v.atualizar = (tl, t) => atualizarEfeitos(v.base, t, ctx.camera);
  return v;
}

// ---------- Pedralva ----------
export const PED = {
  rioZ: (x) => 1.5 * Math.sin(x * 0.04),
  praca: [0, -24],
  ponte: { z0: 7, z1: -7 },
};
const caminhos = [
  [[0.8, 90], [0.6, 40], [0.2, 12], [0, 7]],
  [[0, -7], [0, -15], [0, -24], [0, -36]],
  [[0, -24], [-8, -28], [-15, -31]],
  [[0, -24], [7, -29], [11, -31]],
  [[0, -10], [9, -12], [16, -8]],
];
function distSeg(px, pz, [ax, az], [bx, bz]) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
export function distCaminho(x, z) {
  let d = Infinity;
  for (const c of caminhos) for (let i = 0; i < c.length - 1; i++) d = Math.min(d, distSeg(x, z, c[i], c[i + 1]));
  return Math.min(d, Math.max(0, Math.hypot(x - PED.praca[0], z - PED.praca[1]) - 7));
}
export function alturaPedralva(x, z) {
  const dr = Math.abs(z - PED.rioZ(x));
  const morros = 1.2 * P.fbm(x * 0.03, z * 0.03, 2, 4) + suave(30, 60, Math.hypot(x, z + 20)) * 4 * (0.6 + P.fbm(x * 0.02, z * 0.02, 5, 3));
  const vale = -1.7 * (1 - suave(3.6, 7.5, dr));
  const plano = 0.02 * P.fbm(x * 1.5, z * 1.5, 7, 3) + 0.06 * P.fbm(x * 0.2, z * 0.2, 9, 3);
  const caminho = -0.04 * (1 - suave(0.8, 1.8, distCaminho(x, z)));
  return morros * suave(5, 14, dr) * (z > 0 ? 1 : 0.6) + vale + plano + caminho;
}
export const CASAS = [
  // x, z, largura, fundo, altura, semente, telhado
  [-10, -18, 6, 4.6, 2.6, 1, 'palha'], [-11.5, -27.5, 5.5, 4.4, 2.5, 2, 'palha'], [10, -17.5, 6.5, 4.8, 2.7, 3, 'palha'],
  [11.5, -27, 6, 4.6, 2.6, 4, 'madeira'], [-4, -35, 5.5, 4.2, 2.5, 5, 'palha'], [5.5, -36, 6, 4.4, 2.6, 6, 'palha'],
  [-7.5, -10.5, 5, 4, 2.4, 7, 'palha'], [7.5, -10, 5, 4, 2.4, 8, 'madeira'], [-20, -22, 5, 4, 2.4, 10, 'palha'], [19, -23, 5.5, 4.2, 2.5, 11, 'palha'],
];
function basePedralva() {
  if (bases.pedralva) return bases.pedralva;
  const g = new THREE.Group();
  const alt = alturaPedralva;
  g.add(criarTerreno({ altura: alt, lama: (x, z) => 1 - suave(1.0, 2.0, distCaminho(x, z) + P.fbm(x * 0.8, z * 0.8, 9, 3) * 0.8), centro: [0, -12], raio: 160, pocas: 0.35 }));
  const agua = rio({});
  agua.position.y = -0.78;
  g.add(agua);
  const pt = ponte({ comprimento: 14.5, largura: 2.8, altura: 0.42 });
  g.add(pt);
  const casas = [];
  for (const [x, z, w, d, h, s, tel] of CASAS) {
    const c = casa({ largura: w, fundo: d, altura: h, telhado: tel, semente: s });
    c.position.set(x, alt(x, z) - 0.15, z);
    c.rotation.y = Math.atan2(PED.praca[0] - x, PED.praca[1] - z);
    g.add(c);
    casas.push(c);
  }
  const mo = moinho();
  mo.position.set(15, alt(15, -8.2) - 0.1, -8.2);
  mo.rotation.y = -Math.PI / 2;
  mo.userData.roda.position.set(3.2, 1.0 - (alt(15, -8.2) - 0.1) - 0.2, 0);
  g.add(mo);
  const cel = celeiro({ aberto: 0.9 });
  cel.position.set(-16, alt(-16, -31) - 0.1, -31);
  cel.rotation.y = Math.atan2(0 - -16, -24 - -31);
  g.add(cel);
  const po = poco();
  po.position.set(0, alt(0, -24), -24);
  g.add(po);
  const rb = [[-6, -21], [-6.6, -20.5], [6.4, -26.5], [-12, -14.5], [12.6, -21.5], [12, -22.3], [-3, -13], [9.5, -30.5]];
  for (const [x, z] of rb) { const b = barril(); b.position.set(x, alt(x, z), z); b.rotation.y = x * 3; g.add(b); }
  g.add(muro([[3, -13.2], [12, -13.5]], alt, { alt: 0.75, esp: 0.55 }));
  g.add(cerca([[12, -13.5], [14, -14.6], [16, -15.8], [18, -17], [20, -18.3]], alt));
  g.add(cerca([[-22, -14], [-19, -14.3], [-16, -14.5], [-13, -14.7]], alt, { quebrada: 1 }));
  g.add(muro([[-20, -16], [-15, -16.2]], alt, { alt: 0.55, esp: 0.6 }));
  // mato e floresta em volta
  const fora = (x, z) => {
    if (Math.abs(z - PED.rioZ(x)) < 5) return 0;
    for (const [cx, cz, w] of CASAS) if (Math.hypot(x - cx, z - cz) < w * 0.75) return 0;
    if (Math.hypot(x + 16, z + 31) < 7) return 0;
    return distCaminho(x, z);
  };
  g.add(criarMato({ qtd: 30000, raio: 45, centro: [0, -14], altura: alt, dist: fora, tamanho: 0.8 }));
  g.add(criarFloresta({ qtd: 420, altura: alt, dist: (x, z) => (Math.hypot(x, (z + 18) * 0.8) < 38 ? 0 : 99) + distCaminho(x, z), zMin: -110, zMax: 90, xLarg: 200, folga: 4 }));
  g.add(criarPedras([[-6, 4.5, 0.7, 3], [5, 5.2, 0.5, 4], [-14, 3, 0.9, 5], [20, 4.4, 0.8, 6], [-3, -5.8, 0.6, 7], [24, -12, 1.2, 8]], alt));
  g.userData = { casas, moinho: mo, celeiro: cel, ponte: pt, agua };
  bases.pedralva = g;
  return g;
}
export function pedralva(ctx, hora = 'dia', extra = {}) {
  const v = variante(ctx, hora, extra);
  v.base = basePedralva();
  v.altura = alturaPedralva;
  const { casas, moinho: mo } = v.base.userData;
  v.entrar = () => { if (casas[0]) casas[0].userData.acender(v.H.janelas); };
  v.atualizar = (tl, t) => {
    mo.userData.roda.rotation.x = -t * 0.35;
    atualizarEfeitos(v.base, t, ctx.camera);
    atualizarEfeitos(v.grupo, t, ctx.camera);
  };
  return v;
}

export const cenarios = {
  estrada: (ctx) => estrada(ctx, 'noite'),
  'estrada:aurora': (ctx) => estrada(ctx, 'aurora'),
  'pedralva:amanhecer': (ctx) => pedralva(ctx, 'amanhecer'),
  'pedralva:dia': (ctx) => pedralva(ctx, 'dia'),
  'pedralva:tarde': (ctx) => pedralva(ctx, 'tarde'),
  'pedralva:noite': (ctx) => pedralva(ctx, 'noite'),
  'pedralva:ventoso': (ctx) => pedralva(ctx, 'ventoso'),
  'pedralva:tempestade': (ctx) => {
    const v = pedralva(ctx, 'tempestade');
    const chuva = criarChuva({});
    v.grupo.add(chuva);
    return v;
  },
  'pedralva:aurora': (ctx) => pedralva(ctx, 'aurora'),
};

// ---------- telas de título e de capítulo (texto sobre o preto) ----------
export function tela(ctx) {
  const g = new THREE.Group();
  const base = new THREE.Group();
  base.position.set(0, -2000, 0);
  const c = document.createElement('canvas');
  c.width = 1920; c.height = 1080;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ map: tex, fog: false, toneMapped: false }));
  base.add(placa);
  const desenhar = ({ titulo, sub, corTitulo = '#e8dcc4', corLinha = '#8a1a1a', tamanho = 120 }) => {
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, 1920, 1080);
    x.textAlign = 'center';
    x.fillStyle = corTitulo;
    x.font = `600 ${tamanho}px Cinzel`;
    x.letterSpacing = '14px';
    x.fillText(titulo, 960, sub ? 500 : 560);
    x.fillStyle = corLinha;
    x.fillRect(960 - 260, sub ? 545 : 600, 520, 3);
    if (sub) {
      x.fillStyle = '#b8ac98';
      x.font = 'italic 500 64px "Cormorant Garamond"';
      x.letterSpacing = '2px';
      x.fillText(sub, 960, 640);
    }
    tex.needsUpdate = true;
  };
  return {
    grupo: g, base,
    ambiente: { nevoa: { densidade: 0 }, corNevoa: [0, 0, 0], exposicao: 1, saturacao: 1, vinheta: 0.2, fundo: new THREE.Color(0, 0, 0) },
    desenhar,
    mostrar() { ctx.camera.position.set(0, -2000, 9.2); ctx.camera.lookAt(0, -2000, 0); ctx.camera.fov = 52.4; ctx.camera.updateProjectionMatrix(); },
  };
}
cenarios.tela = tela;
