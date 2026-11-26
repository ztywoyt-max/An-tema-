// Texturas PBR geradas por código (cor, rugosidade/metal e relevo), sem emenda.
// Cada gerador devolve { cor, rm, normal }: cor em sRGB (alfa = máscara de ruído para variações no shader),
// rm com rugosidade no G e metal no B (o padrão do three.js), normal em espaço tangente.
import * as THREE from 'three';
import { Perlin, clamp, suave, mistura } from './ruido.js';

const cache = new Map();

export function criar(tam, per, fn, { relevo = 2, semente = 1 } = {}) {
  const P = new Perlin(semente);
  const n = tam * tam;
  const altura = new Float32Array(n);
  const cor = new Uint8Array(n * 4);
  const rm = new Uint8Array(n * 4);
  const saida = { h: 0, r: 0, g: 0, b: 0, rug: 0.8, met: 0, m: 0 };
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const i = y * tam + x;
      saida.h = 0; saida.rug = 0.8; saida.met = 0; saida.m = 0;
      fn(P, (x / tam) * per, (y / tam) * per, per, saida, x / tam, y / tam, i);
      altura[i] = saida.h;
      cor[i * 4] = clamp(saida.r) * 255;
      cor[i * 4 + 1] = clamp(saida.g) * 255;
      cor[i * 4 + 2] = clamp(saida.b) * 255;
      cor[i * 4 + 3] = clamp(saida.m) * 255;
      rm[i * 4] = 255;
      rm[i * 4 + 1] = clamp(saida.rug) * 255;
      rm[i * 4 + 2] = clamp(saida.met) * 255;
      rm[i * 4 + 3] = 255;
    }
  }
  // normal a partir do relevo (Sobel, com a borda dando a volta)
  const nor = new Uint8Array(n * 4);
  const H = (x, y) => altura[((y + tam) % tam) * tam + ((x + tam) % tam)];
  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
      const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
      let nx = -dx * relevo, ny = -dy * relevo, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * tam + x) * 4;
      nor[i] = (nx * 0.5 + 0.5) * 255;
      nor[i + 1] = (ny * 0.5 + 0.5) * 255;
      nor[i + 2] = (nz * 0.5 + 0.5) * 255;
      nor[i + 3] = 255;
    }
  }
  const tex = (dados, srgb) => {
    const t = new THREE.DataTexture(dados, tam, tam, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { cor: tex(cor, true), rm: tex(rm, false), normal: tex(nor, false), altura, tam };
}

function feito(nome, f) {
  if (!cache.has(nome)) cache.set(nome, f());
  return cache.get(nome);
}

// ferro velho enferrujado: manchas de ferrugem, corrosão e arranhões claros
export const ferrugem = () => feito('ferrugem', () => criar(1024, 6, (P, x, y, per, s) => {
  const manchas = P.fbm(x, y, 0, 5, per) + 0.35 * P.fbm(x * 4, y * 4, 3, 3, per * 4);
  const fer = suave(-0.02, 0.2, manchas);
  const poros = P.fbm(x * 16, y * 16, 7, 2, per * 16);
  const varia = P.fbm(x * 3, y * 3, 5, 3, per * 3);
  const ferro = [0.46 + varia * 0.08, 0.45 + varia * 0.08, 0.43 + varia * 0.08];
  const tom = suave(-0.3, 0.4, P.fbm(x * 2, y * 2, 9, 3, per * 2));
  const ox = [mistura(0.3, 0.46, tom), mistura(0.12, 0.2, tom), mistura(0.05, 0.08, tom)];
  s.r = mistura(ferro[0], ox[0], fer) * (0.85 + poros * 0.4);
  s.g = mistura(ferro[1], ox[1], fer) * (0.85 + poros * 0.4);
  s.b = mistura(ferro[2], ox[2], fer) * (0.85 + poros * 0.4);
  s.h = fer * 0.6 + poros * (0.3 + fer * 0.7) * 1.2;
  s.rug = mistura(0.38, 0.88, fer) + poros * 0.12;
  s.met = mistura(0.92, 0.1, fer);
  s.m = clamp(0.5 + varia);
}, { relevo: 2.5, semente: 3 }));

// pele: variação de tom, poros e sujeira
export const pele = () => feito('pele', () => criar(1024, 8, (P, x, y, per, s) => {
  const v = P.fbm(x, y, 0, 4, per);
  const rubor = suave(-0.2, 0.3, P.fbm(x * 0.5, y * 0.5, 4, 3, per * 0.5));
  const poro = P.fbm(x * 24, y * 24, 2, 2, per * 24);
  const suj = suave(0.12, 0.45, P.fbm(x * 0.75, y * 0.75, 8, 4, per * 0.75));
  const base = [0.58 + v * 0.06 + rubor * 0.05, 0.42 + v * 0.05, 0.34 + v * 0.04];
  const terra = [0.32, 0.25, 0.19];
  const k = suj * 0.22;
  s.r = mistura(base[0], terra[0], k);
  s.g = mistura(base[1], terra[1], k);
  s.b = mistura(base[2], terra[2], k);
  s.h = poro * 0.5 + v * 0.3;
  s.rug = 0.55 + suj * 0.2 - poro * 0.05;
  s.m = clamp(0.5 + P.fbm(x * 2, y * 2, 12, 3, per * 2) * 1.4);
}, { relevo: 1.2, semente: 5 }));

// linho grosso: trama, fiapos e manchas
export const linho = () => feito('linho', () => criar(512, 4, (P, x, y, per, s, u, v) => {
  const fios = 96;
  const tx = Math.sin(u * fios * Math.PI * 2) * 0.5 + 0.5;
  const ty = Math.sin(v * fios * Math.PI * 2) * 0.5 + 0.5;
  const trama = ((Math.floor(u * fios) + Math.floor(v * fios)) & 1) ? tx : ty;
  const mancha = suave(-0.05, 0.3, P.fbm(x, y, 0, 5, per));
  const var1 = P.fbm(x * 6, y * 6, 3, 3, per * 6);
  const base = [0.6 + var1 * 0.05, 0.55 + var1 * 0.05, 0.45 + var1 * 0.04];
  const suj = [0.33, 0.27, 0.2];
  s.r = mistura(base[0], suj[0], mancha * 0.7) * (0.82 + trama * 0.18);
  s.g = mistura(base[1], suj[1], mancha * 0.7) * (0.82 + trama * 0.18);
  s.b = mistura(base[2], suj[2], mancha * 0.7) * (0.82 + trama * 0.18);
  s.h = trama * 0.5 + var1 * 0.4;
  s.rug = 0.92;
  s.m = mancha;
}, { relevo: 1.5, semente: 7 }));

// couro gasto
export const couro = () => feito('couro', () => criar(512, 4, (P, x, y, per, s) => {
  const v = P.fbm(x, y, 0, 5, per);
  const rugas = P.crista(x * 3, y * 3, 2, 4, per * 3);
  const gasto = suave(0.1, 0.4, P.fbm(x * 2, y * 2, 5, 3, per * 2));
  s.r = 0.4 + v * 0.08 + gasto * 0.1;
  s.g = 0.28 + v * 0.05 + gasto * 0.07;
  s.b = 0.18 + v * 0.03 + gasto * 0.04;
  s.h = rugas * 0.4 + v * 0.3;
  s.rug = 0.6 - gasto * 0.15;
  s.m = gasto;
}, { relevo: 1.4, semente: 9 }));

// lama da estrada: escura, com pedrinhas; o alfa marca as poças (ruído largo)
export const lama = () => feito('lama', () => criar(1024, 4, (P, x, y, per, s) => {
  const v = P.fbm(x, y, 0, 5, per);
  const pedra = suave(0.32, 0.4, P.ruido(x * 10, y * 10, 4, per * 10) + P.ruido(x * 20, y * 20, 6, per * 20) * 0.3);
  const marcas = P.fbm(x * 3, y * 0.6, 8, 3, per * 3);
  const umido = suave(-0.1, 0.2, P.fbm(x * 0.5, y * 0.5, 3, 2, per * 0.5) + v * 0.3);
  const base = [0.17 + v * 0.05, 0.13 + v * 0.04, 0.095 + v * 0.03];
  const pd = [0.32, 0.3, 0.27];
  s.r = mistura(base[0], pd[0], pedra) * (1 - umido * 0.25);
  s.g = mistura(base[1], pd[1], pedra) * (1 - umido * 0.25);
  s.b = mistura(base[2], pd[2], pedra) * (1 - umido * 0.25);
  s.h = v * 0.6 + pedra * 0.6 + marcas * 0.4;
  s.rug = mistura(0.88, 0.45, umido) - pedra * 0.1;
  s.m = clamp(0.5 + P.fbm(x * 0.25, y * 0.25, 13, 2, 1) * 1.6);
}, { relevo: 3, semente: 11 }));

// chão do mato: terra, folhas secas e agulhas de pinheiro
export const terra = () => feito('terra', () => criar(1024, 4, (P, x, y, per, s) => {
  const v = P.fbm(x, y, 0, 5, per);
  const folha = suave(0.15, 0.3, P.ruido(x * 12, y * 12, 3, per * 12) + P.ruido(x * 5, y * 5, 1, per * 5) * 0.4);
  const verde = suave(-0.1, 0.3, P.fbm(x * 0.75, y * 0.75, 6, 3, per * 0.75));
  const base = [0.07 + v * 0.025, 0.062 + v * 0.025, 0.045 + v * 0.015];
  const fol = [0.15 + v * 0.05, 0.1 + v * 0.03, 0.055];
  const mus = [0.09, 0.13, 0.05];
  let r = mistura(base[0], fol[0], folha), g = mistura(base[1], fol[1], folha), b = mistura(base[2], fol[2], folha);
  r = mistura(r, mus[0], verde * 0.5); g = mistura(g, mus[1], verde * 0.5); b = mistura(b, mus[2], verde * 0.5);
  s.r = r; s.g = g; s.b = b;
  s.h = v * 0.5 + folha * 0.5;
  s.rug = 0.9;
  s.m = verde;
}, { relevo: 2.5, semente: 13 }));

// casca de árvore: sulcos verticais
export const casca = () => feito('casca', () => criar(512, 4, (P, x, y, per, s) => {
  const sulco2 = 1 - Math.abs(P.ruido(x * 6, y * 1.25, 2, [per * 6, per * 1.25]) + P.ruido(x * 12, y * 2, 5, [per * 12, per * 2]) * 0.5);
  const v = P.fbm(x * 2, y * 2, 4, 4, per * 2);
  const h = Math.pow(clamp(sulco2), 2.5);
  const liquen = suave(0.2, 0.4, P.fbm(x, y, 9, 4, per));
  s.r = mistura(0.08, 0.22 + v * 0.05, h);
  s.g = mistura(0.065, 0.18 + v * 0.04, h);
  s.b = mistura(0.05, 0.15 + v * 0.03, h);
  s.r = mistura(s.r, 0.3, liquen * 0.4); s.g = mistura(s.g, 0.33, liquen * 0.4); s.b = mistura(s.b, 0.25, liquen * 0.4);
  s.h = h + v * 0.2;
  s.rug = 0.92;
  s.m = liquen;
}, { relevo: 4, semente: 15 }));

// pedra: rachaduras e grão; alfa = onde cresce musgo
export const pedra = () => feito('pedra', () => criar(1024, 4, (P, x, y, per, s) => {
  const v = P.fbm(x, y, 0, 6, per);
  const rach = Math.pow(clamp(1 - Math.abs(P.ruido(x * 2, y * 2, 3, per * 2) + 0.5 * P.ruido(x * 4, y * 4, 8, per * 4)) * 6), 3);
  const grao = P.fbm(x * 16, y * 16, 1, 2, per * 16);
  const tom = 0.3 + v * 0.12 + grao * 0.05;
  s.r = tom * (1 - rach * 0.6);
  s.g = (tom - 0.005) * (1 - rach * 0.6);
  s.b = (tom - 0.015) * (1 - rach * 0.6);
  s.h = v * 0.8 - rach * 0.8 + grao * 0.2;
  s.rug = 0.82 + grao * 0.1;
  s.m = clamp(0.5 + P.fbm(x * 1.5, y * 1.5, 6, 4, per * 1.5) * 1.5);
}, { relevo: 3, semente: 17 }));

// agulhas de pinheiro para os galhos (com transparência)
export function galhoPinheiro() {
  return feito('galho', () => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 512;
    const g = c.getContext('2d');
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    g.clearRect(0, 0, 256, 512);
    // ramo central e ramos secundários
    const ramo = (x0, y0, x1, y1, w, n) => {
      g.strokeStyle = '#2a2016'; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        const comp = 14 + r() * 18 * (1 - t * 0.5);
        for (const lado of [-1, 1]) {
          const a = Math.atan2(y1 - y0, x1 - x0) + lado * (0.7 + r() * 0.5);
          const v = 0.55 + r() * 0.45;
          g.strokeStyle = `rgb(${Math.floor(28 * v + 10)},${Math.floor(48 * v + 14)},${Math.floor(26 * v + 10)})`;
          g.lineWidth = 1.6;
          g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * comp, y + Math.sin(a) * comp); g.stroke();
        }
      }
    };
    ramo(128, 505, 128, 10, 4, 90);
    for (let i = 0; i < 6; i++) {
      const y = 460 - i * 70;
      const lado = i % 2 ? 1 : -1;
      ramo(128, y, 128 + lado * (70 + r() * 30), y - 90 - r() * 40, 2.5, 50);
    }
    // mipmaps feitos à mão, engrossando o alfa a cada nível: a copa não some quando fica pequena na tela
    const niveis = [c];
    let w = 256, h = 512, k = 0;
    while (w > 1 || h > 1) {
      w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); k++;
      const n = document.createElement('canvas');
      n.width = w; n.height = h;
      const gn = n.getContext('2d');
      gn.drawImage(niveis[niveis.length - 1], 0, 0, w, h);
      const img = gn.getImageData(0, 0, w, h);
      const ganho = Math.pow(1.45, Math.min(k, 4));
      for (let i = 3; i < img.data.length; i += 4) img.data[i] = Math.min(255, img.data[i] * ganho);
      gn.putImageData(img, 0, 0);
      niveis.push(n);
    }
    const t = new THREE.CanvasTexture(c);
    t.mipmaps = niveis;
    t.generateMipmaps = false;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
}

// fios de cabelo/barba (cor vem do material): listras finas na direção v, com mechas
export const fios = () => feito('fios', () => criar(512, 4, (P, x, y, per, s, u, v) => {
  const mecha = P.fbm(x * 6, y * 0.6, 0, 3, [per * 6, per * 0.6 || 1]);
  const fio = 0.5 + 0.5 * Math.sin((u * 220 + mecha * 30) * Math.PI);
  const fino = 0.5 + 0.5 * Math.sin((u * 640 + mecha * 50) * Math.PI);
  const k = 0.6 + 0.25 * fio + 0.15 * fino;
  s.r = s.g = s.b = k;
  s.h = fio * 0.6 + fino * 0.4 + mecha * 0.5;
  s.rug = 0.82 - fio * 0.12;
  s.m = clamp(0.5 + mecha);
}, { relevo: 2.2, semente: 19 }));

// pelo de bicho (capuz de pele, gola): fios curtos e desalinhados
export const pelo = () => feito('pelo', () => criar(512, 4, (P, x, y, per, s) => {
  const dir = P.fbm(x * 2, y * 2, 3, 3, per * 2) * 2;
  const tufo = P.fbm(x * 3, y * 3, 6, 3, per * 3);
  const f = 0.5 + 0.5 * Math.sin((x * Math.cos(dir) + y * Math.sin(dir)) * 90);
  const k = 0.55 + 0.3 * f + tufo * 0.3;
  s.r = k; s.g = k * 0.92; s.b = k * 0.85;
  s.h = f * 0.7 + tufo;
  s.rug = 0.85;
  s.m = clamp(0.5 + tufo);
}, { relevo: 2.5, semente: 23 }));

// lã grossa (mantos, xales): trama larga e felpuda
export const la = () => feito('la', () => criar(512, 4, (P, x, y, per, s, u, v) => {
  const fios2 = 48;
  const tx = Math.sin(u * fios2 * Math.PI * 2), ty = Math.sin(v * fios2 * Math.PI * 2);
  const trama = ((Math.floor(u * fios2) + Math.floor(v * fios2)) & 1) ? tx : ty;
  const felpa = P.fbm(x * 12, y * 12, 2, 3, per * 12);
  const mancha = suave(0, 0.35, P.fbm(x, y, 5, 4, per));
  const k = (0.75 + trama * 0.12 + felpa * 0.25) * (1 - mancha * 0.3);
  s.r = s.g = s.b = k;
  s.h = trama * 0.5 + felpa * 0.6;
  s.rug = 0.95;
  s.m = mancha;
}, { relevo: 1.8, semente: 29 }));

// metal polido (armaduras): riscos finos e pequenas manchas
export const aco = () => feito('aco', () => criar(512, 4, (P, x, y, per, s) => {
  const risco = Math.pow(clamp(1 - Math.abs(P.ruido(x * 0.5, y * 30, 3, [per * 0.5 || 1, per * 30])) * 8), 4);
  const mancha = suave(0.1, 0.4, P.fbm(x, y, 7, 4, per));
  const k = 0.82 - mancha * 0.15 + risco * 0.1;
  s.r = k; s.g = k; s.b = k;
  s.h = -risco * 0.5 + mancha * 0.2;
  s.rug = 0.22 + mancha * 0.25 - risco * 0.05;
  s.met = 1;
  s.m = mancha;
}, { relevo: 0.6, semente: 31 }));

// madeira de tábua: veios compridos, nós e desgaste
export const madeira = () => feito('madeira', () => criar(512, 4, (P, x, y, per, s) => {
  const veio = P.fbm(x * 8, y * 0.5, 0, 4, [per * 8, per * 0.5 || 1]);
  const anel = 0.5 + 0.5 * Math.sin((x * 6 + veio * 3) * Math.PI * 2);
  const no = suave(0.38, 0.5, P.ruido(x * 1.5, y * 1.5, 4, per * 1.5 || 1));
  const gasto = suave(0.0, 0.4, P.fbm(x * 2, y * 2, 7, 3, per * 2));
  const k = 0.32 + anel * 0.1 + veio * 0.12 - no * 0.12;
  s.r = k * 1.15 * (1 - gasto * 0.25); s.g = k * 0.88 * (1 - gasto * 0.25); s.b = k * 0.62 * (1 - gasto * 0.2);
  s.h = anel * 0.4 + veio * 0.6 - no * 0.5;
  s.rug = 0.78 + gasto * 0.12;
  s.m = gasto;
}, { relevo: 2.2, semente: 37 }));

// alvenaria de pedra: pedras irregulares (células de Voronoi) com argamassa funda
export const alvenaria = () => feito('alvenaria', () => {
  const n = 7;
  const r0 = (i, j, k) => { const v = Math.sin((i * 127.1 + j * 311.7 + k * 74.7)) * 43758.5453; return v - Math.floor(v); };
  const ponto = (i, j) => { const ii = ((i % n) + n) % n, jj = ((j % n) + n) % n; return [i + 0.15 + 0.7 * r0(ii, jj, 1), j + 0.15 + 0.7 * r0(ii, jj, 2) * 0.8 + 0.1]; };
  return criar(1024, 4, (P, x, y, per, s, u, v) => {
    const px = u * n, py = v * n * 1.6;
    const ci = Math.floor(px), cj = Math.floor(py);
    let d1 = 9, d2 = 9, id = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const [qx, qy] = ponto(ci + a, cj + b);
      const d = Math.hypot((px - qx) * 1.0, (py - qy) * 1.25);
      if (d < d1) { d2 = d1; d1 = d; id = r0(((ci + a) % n + n) % n, ((cj + b) % n + n) % n, 3); } else if (d < d2) d2 = d;
    }
    const borda = clamp((d2 - d1) * 6);
    const grao = P.fbm(x * 8, y * 8, 2, 3, per * 8);
    const musgo = suave(0.15, 0.45, P.fbm(x * 1.5, y * 1.5, 5, 3, per * 1.5)) * (1 - borda) * 0.6;
    const tom = 0.34 + id * 0.12 + grao * 0.08;
    const arg = 1 - borda;
    s.r = mistura(tom * 1.02, 0.2, arg); s.g = mistura(tom * 0.98, 0.19, arg); s.b = mistura(tom * 0.92, 0.17, arg);
    s.r = mistura(s.r, 0.16, musgo); s.g = mistura(s.g, 0.2, musgo); s.b = mistura(s.b, 0.1, musgo);
    s.h = Math.pow(borda, 0.5) * 1.2 + grao * 0.3;
    s.rug = 0.85;
    s.m = musgo;
  }, { relevo: 4, semente: 41 });
});

// palha de telhado: fios grossos e mechas escurecidas pela chuva
export const palha = () => feito('palha', () => criar(512, 4, (P, x, y, per, s, u, v) => {
  const mecha = P.fbm(x * 5, y * 0.4, 0, 3, [per * 5, per * 0.4 || 1]);
  const fio = 0.5 + 0.5 * Math.sin((u * 160 + mecha * 20) * Math.PI);
  const camada = 0.5 + 0.5 * Math.sin(v * 24 * Math.PI * 2 + mecha * 2);
  const velho = suave(-0.1, 0.4, P.fbm(x * 1.2, y * 1.2, 4, 4, per * 1.2 || 1));
  const k = (0.5 + fio * 0.25 + mecha * 0.3) * (0.75 + camada * 0.25);
  s.r = mistura(k * 0.95, k * 0.5, velho); s.g = mistura(k * 0.8, k * 0.46, velho); s.b = mistura(k * 0.5, k * 0.36, velho);
  s.h = fio * 0.5 + camada * 0.6 + mecha;
  s.rug = 0.92;
  s.m = velho;
}, { relevo: 3, semente: 43 }));

// ondinhas de água (só a normal importa)
export const agua = () => feito('agua', () => criar(512, 8, (P, x, y, per, s) => {
  s.h = P.fbm(x, y, 0, 4, per) + 0.3 * P.fbm(x * 3, y * 3, 2, 3, per * 3);
  s.r = s.g = s.b = 1;
  s.rug = 0.05;
}, { relevo: 1.2, semente: 47 }));
