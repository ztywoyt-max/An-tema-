// Texturas geradas por código, em baixa resolução, sem filtro (pixel duro), como no PS1.
import * as THREE from 'three';

export function aleatorio(semente = 1) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ruído de valor 2D que se repete (tileable) com período p.
function fazerRuido(semente) {
  const tab = new Map();
  const h = (x, y) => {
    const k = x * 73856093 ^ y * 19349663 ^ semente * 83492791;
    let v = tab.get(k);
    if (v === undefined) {
      const s = Math.sin(k * 0.0001 + semente) * 43758.5453;
      v = s - Math.floor(s);
      tab.set(k, v);
    }
    return v;
  };
  return (x, y, p) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const fx = x - xi, fy = y - yi;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const m = (a) => ((a % p) + p) % p;
    const a = h(m(xi), m(yi)), b = h(m(xi + 1), m(yi));
    const c = h(m(xi), m(yi + 1)), d = h(m(xi + 1), m(yi + 1));
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
}

function fbm(r, x, y, p, oitavas = 3) {
  let v = 0, amp = 0.5, tot = 0, f = 1;
  for (let i = 0; i < oitavas; i++) {
    v += r(x * f, y * f, p * f) * amp;
    tot += amp;
    amp *= 0.5;
    f *= 2;
  }
  return v / tot;
}

const cache = new Map();

/** Cria uma textura w×h. desenho(px, ctx) recebe px(x, y, [r,g,b,a]) com cores 0..255. */
export function textura(nome, w, h, desenho, op = {}) {
  if (cache.has(nome)) return cache.get(nome);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const px = (x, y, c) => {
    x = ((Math.round(x) % w) + w) % w;
    y = Math.round(y);
    if (y < 0 || y >= h) return;
    const i = (y * w + x) * 4;
    img.data[i] = c[0];
    img.data[i + 1] = c[1];
    img.data[i + 2] = c[2];
    img.data[i + 3] = c[3] ?? 255;
  };
  const ler = (x, y) => {
    x = ((Math.round(x) % w) + w) % w;
    y = Math.min(Math.max(Math.round(y), 0), h - 1);
    const i = (y * w + x) * 4;
    return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
  };
  desenho(px, ler, w, h);
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = op.suave ? THREE.LinearFilter : THREE.NearestFilter;
  t.minFilter = op.suave ? THREE.LinearFilter : THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = op.prender ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.wrapT = op.prender ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  cache.set(nome, t);
  return t;
}

const mix = (a, b, t) => a.map((v, i) => v + ((b[i] ?? 255) - v) * t);
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k, a[3] ?? 255];
const clamp = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b);

// ---------- Pele e corpo ----------

export const TONS = {
  curtido: [176, 124, 92],
  claro: [214, 168, 138],
  moreno: [150, 100, 70],
  escuro: [96, 64, 46],
  palido: [200, 170, 150],
};

export function pele(tom = TONS.curtido, semente = 3) {
  const r = fazerRuido(semente);
  return textura(`pele-${tom}-${semente}`, 32, 32, (px, _l, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const n = fbm(r, x / 6, y / 6, 32 / 6 | 0 || 5, 2);
        px(x, y, mul(tom, 0.9 + n * 0.18));
      }
  });
}

// Tronco nu: frente centrada em u=0.5 (o cilindro é girado para isso), topo = ombros.
export function torsoNu(tom = TONS.curtido, semente = 5) {
  const r = fazerRuido(semente);
  return textura(`torso-${tom}-${semente}`, 64, 64, (px, _l, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const n = fbm(r, x / 8, y / 8, 8, 2);
        let k = 0.92 + n * 0.14;
        const dx = x - w / 2; // distância do centro da frente
        const fy = y / h;
        // peitorais: sombra embaixo de cada peito
        if (Math.abs(dx) < 12 && fy > 0.3 && fy < 0.36 && Math.abs(dx) > 1) k *= 0.8;
        if (Math.abs(dx) < 12 && fy > 0.12 && fy < 0.3) k *= 1.04;
        // linha central
        if (Math.abs(dx) < 1 && fy > 0.16 && fy < 0.92) k *= 0.86;
        // abdômen em blocos
        if (Math.abs(dx) < 6 && fy > 0.42 && fy < 0.9) {
          const linha = (fy - 0.42) / 0.12;
          if (Math.abs(linha - Math.round(linha)) < 0.09) k *= 0.86;
          else k *= 1.03;
        }
        // costelas laterais
        if (Math.abs(dx) > 12 && Math.abs(dx) < 18 && fy > 0.36 && fy < 0.6 && y % 4 === 0) k *= 0.9;
        // coluna nas costas (u=0 e u=1)
        const dc = Math.min(x, w - x);
        if (dc < 1 && fy > 0.1) k *= 0.85;
        // omoplatas
        if (dc > 4 && dc < 12 && fy > 0.18 && fy < 0.26) k *= 0.9;
        // sujeira
        if (fbm(r, x / 4 + 40, y / 4, 16, 2) > 0.68) k *= 0.85;
        px(x, y, mul(tom, k));
      }
  });
}

// Pano de linho (cueca medieval / braies).
export function pano(cor = [196, 184, 156], semente = 7, nome = 'pano') {
  const r = fazerRuido(semente);
  return textura(`${nome}-${cor}-${semente}`, 32, 32, (px, _l, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let k = 0.88 + fbm(r, x / 5, y / 5, 6, 2) * 0.2;
        if ((x + y) % 2 === 0) k *= 0.96; // trama
        if (y % 7 === 0 && x % 3 === 0) k *= 0.9; // vincos
        const sujo = fbm(r, x / 7 + 20, y / 7, 4, 2);
        let c = mul(cor, k);
        if (sujo > 0.6) c = mix(c, [92, 74, 52], (sujo - 0.6) * 1.4);
        px(x, y, c);
      }
  });
}

// Coxa: parte de cima coberta pelo pano, parte de baixo pele.
export function coxa(tom = TONS.curtido, corPano = [196, 184, 156], cobre = 0.5, semente = 9) {
  const tp = pano(corPano, semente);
  const r = fazerRuido(semente + 1);
  return textura(`coxa-${tom}-${corPano}-${cobre}`, 32, 32, (px, _l, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const borda = cobre * h + Math.sin(x * 0.8) * 1.2;
        if (y < borda) {
          let k = 0.86 + fbm(r, x / 5, y / 5, 6, 2) * 0.2;
          if (y > borda - 2) k *= 0.78; // barra da cueca
          if (x % 8 < 2 && y < borda - 3) k *= 0.88; // pregas
          px(x, y, mul(corPano, k));
        } else {
          const n = fbm(r, x / 6 + 10, y / 6, 5, 2);
          let k = 0.9 + n * 0.16;
          if (y < borda + 2) k *= 0.86; // sombra do pano na pele
          px(x, y, mul(tom, k));
        }
      }
  });
}

// ---------- Metal ----------

export function ferrugem(semente = 11, nome = 'ferrugem') {
  const r = fazerRuido(semente);
  return textura(`${nome}-${semente}`, 64, 64, (px, _l, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const n = fbm(r, x / 9, y / 9, 7, 3);
        const m = fbm(r, x / 4 + 50, y / 4, 16, 2);
        let c = [92, 88, 84];
        c = mix(c, [128, 66, 34], clamp((n - 0.35) * 2.4));
        c = mix(c, [70, 36, 20], clamp((m - 0.62) * 3));
        if (m < 0.25) c = mix(c, [150, 146, 138], 0.4); // metal aparecendo
        px(x, y, mul(c, 0.92 + fbm(r, x, y, 64, 1) * 0.16));
      }
  });
}

/**
 * Capacete fechado (elmo) enferrujado com a fenda dos olhos e os riscos da contagem.
 * Frente em u=0.5. marcas = quantos riscos.
 */
export function capacete(marcas = 299, semente = 13) {
  const r = fazerRuido(semente);
  const alea = aleatorio(semente);
  const W = 256, Hh = 128, e = W / 128; // 256 px: o máximo que o PS1 aceitava, reservado ao herói
  return textura(`capacete-${marcas}-${semente}`, W, Hh, (px, ler, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const n = fbm(r, x / (10 * e), y / (10 * e), 13, 3);
        const m = fbm(r, x / (5 * e) + 30, y / (5 * e), 26, 2);
        let c = [84, 80, 76];
        c = mix(c, [124, 62, 32], clamp((n - 0.34) * 2.2));
        c = mix(c, [62, 32, 18], clamp((m - 0.6) * 3));
        c = mul(c, 0.94 + fbm(r, x / 1.5, y / 1.5, 170, 1) * 0.12);
        if (y > h - 4 * e) c = mul(c, 0.72); // borda de baixo
        if (y < 3 * e) c = mul(c, 1.12); // aresta do topo
        px(x, y, c);
      }
    // reforço vertical na frente
    const meio = w / 2;
    for (let y = 4 * e; y < h - 4 * e; y++) {
      for (let dx = -e; dx <= e; dx++) {
        const c = ler(meio + dx, y);
        px(meio + dx, y, mul(c, Math.abs(dx) < e ? 1.2 : 0.75));
      }
    }
    // fenda dos olhos (dividida pelo reforço)
    const fy0 = Math.round(h * 0.36), fy1 = fy0 + Math.round(3 * e);
    const fx0 = Math.round(w * 0.34), fx1 = Math.round(w * 0.66);
    for (let y = fy0; y <= fy1; y++)
      for (let x = fx0; x <= fx1; x++) {
        if (Math.abs(x - meio) <= e) continue;
        const borda = y === fy0 || y === fy1;
        px(x, y, borda ? [30, 18, 12] : [6, 4, 4]);
      }
    for (let x = fx0; x <= fx1; x++) {
      if (Math.abs(x - meio) <= e) continue;
      for (let k = 1; k <= e; k++) {
        px(x, fy1 + k, mul(ler(x, fy1 + k), 0.7));
        px(x, fy0 - k, mul(ler(x, fy0 - k), 1.18));
      }
    }
    // furos de respiração (lado direito da frente)
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 3; j++)
        for (let a = 0; a < e; a++) for (let b = 0; b < e; b++) px(w * 0.56 + i * 3 * e + a, h * 0.6 + j * 4 * e + b, [10, 6, 4]);
    // riscos da contagem: grupos de 4 + 1 atravessado. Os antigos enferrujaram; os novos brilham.
    let feitas = 0;
    const linhas = [0.1, 0.48, 0.64, 0.8].map((f) => Math.round(h * f));
    const ALT = 9;
    for (const yb of linhas) {
      let x = 3;
      while (feitas < marcas && x < w - 12) {
        const naFrente = x > w * 0.3 - 10 && x < w * 0.7;
        if (naFrente && (yb > h * 0.2 && yb < h * 0.7)) { x++; continue; }
        if (Math.abs(x - meio) < 14 && x < meio + 4) { x = meio + 6; continue; }
        const grupo = Math.min(5, marcas - feitas);
        const idade = feitas / Math.max(marcas, 1);
        const claro = [150 + 45 * idade, 136 + 48 * idade, 120 + 50 * idade];
        const forca = 0.3 + 0.55 * idade;
        const arranha = (xx, yy, f) => px(xx, yy, mix(ler(xx, yy), claro, f));
        for (let k = 0; k < Math.min(grupo, 4); k++) {
          const xx = x + k * 3;
          const topo = Math.floor(alea() * 2), alt = ALT - Math.floor(alea() * 2);
          const torto = alea() < 0.35 ? 1 : 0;
          for (let yy = topo; yy < alt; yy++) arranha(xx + (yy > alt * 0.6 ? torto : 0), yb + yy, forca * (0.85 + alea() * 0.25));
        }
        if (grupo === 5) {
          for (let k = 0; k <= 12; k++) arranha(x - 1 + k, yb + ALT - 1 - Math.round(k * 0.62), forca);
        }
        feitas += grupo;
        x += 16 + Math.floor(alea() * 4);
      }
    }
  });
}

// ---------- Natureza e cenário ----------

export function terraEstrada(semente = 17) {
  const r = fazerRuido(semente);
  return textura(`terra-${semente}`, 64, 64, (px, _l, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const n = fbm(r, x / 8, y / 8, 8, 3);
        let c = mix([66, 54, 42], [96, 80, 60], n);
        // sulcos das rodas
        const s = Math.min(Math.abs(x - w * 0.28), Math.abs(x - w * 0.72));
        if (s < 3) c = mul(c, 0.74 + s * 0.06);
        // pedrinhas
        if (fbm(r, x / 2 + 40, y / 2, 32, 1) > 0.82) c = mix(c, [130, 124, 112], 0.6);
        // bordas com mato
        const borda = Math.min(x, w - 1 - x);
        if (borda < 6 && fbm(r, x / 3, y / 3 + 9, 21, 2) > borda / 8) c = mix(c, [44, 54, 34], 0.8);
        px(x, y, c);
      }
  });
}

export function grama(semente = 19) {
  const r = fazerRuido(semente);
  return textura(`grama-${semente}`, 64, 64, (px, _l, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const n = fbm(r, x / 10, y / 10, 6, 3);
        const fio = fbm(r, x / 1.5, y / 3, 42, 1);
        let c = mix([30, 40, 26], [52, 66, 38], n);
        if (fio > 0.66) c = mul(c, 1.25);
        if (fio < 0.25) c = mul(c, 0.75);
        if (fbm(r, x / 6 + 70, y / 6, 10, 2) > 0.66) c = mix(c, [60, 50, 36], 0.6); // terra
        px(x, y, c);
      }
  });
}

export function casca(semente = 23) {
  const r = fazerRuido(semente);
  return textura(`casca-${semente}`, 32, 32, (px, _l, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const n = fbm(r, x / 2, y / 9, 16, 2);
        let c = mix([40, 30, 24], [74, 58, 44], n);
        if (n < 0.35) c = mul(c, 0.7);
        px(x, y, c);
      }
  });
}

export function pinho(semente = 29) {
  const r = fazerRuido(semente);
  return textura(`pinho-${semente}`, 32, 32, (px, _l, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const n = fbm(r, x / 3, y / 3, 11, 2);
        let c = mix([18, 34, 26], [40, 62, 40], n);
        if ((x + Math.floor(y / 2)) % 4 === 0) c = mul(c, 0.8);
        px(x, y, c);
      }
  });
}

export function madeira(semente = 31, cor = [104, 76, 50]) {
  const r = fazerRuido(semente);
  return textura(`madeira-${semente}-${cor}`, 32, 64, (px, _l, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const veio = fbm(r, x / 1.2, y / 10, 27, 2);
        let c = mul(cor, 0.78 + veio * 0.4);
        if (x % 8 === 0) c = mul(c, 0.55); // junta das tábuas
        if (fbm(r, x / 3 + 5, y / 3, 11, 2) > 0.72) c = mul(c, 0.8); // nós e manchas
        px(x, y, c);
      }
  });
}

export function pedra(semente = 37) {
  const r = fazerRuido(semente);
  return textura(`pedra-${semente}`, 32, 32, (px, _l, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const n = fbm(r, x / 5, y / 5, 6, 3);
        let c = mix([70, 70, 72], [124, 122, 118], n);
        if (fbm(r, x / 3 + 9, y / 3, 11, 2) > 0.7) c = mix(c, [60, 76, 48], 0.5); // musgo
        px(x, y, c);
      }
  });
}

// Mato recortado (alpha), para planos cruzados.
export function mato(semente = 41, cor = [44, 60, 34]) {
  const alea = aleatorio(semente);
  return textura(`mato-${semente}-${cor}`, 32, 32, (px, _l, w, h) => {
    for (let i = 0; i < 26; i++) {
      const x0 = 2 + alea() * (w - 4);
      const alt = h * (0.35 + alea() * 0.6);
      const inc = (alea() - 0.5) * 0.6;
      const k = 0.7 + alea() * 0.5;
      for (let y = 0; y < alt; y++) {
        const t = y / alt;
        px(x0 + inc * y, h - 1 - y, mul(cor, k * (0.7 + t * 0.5)));
        if (t < 0.4) px(x0 + inc * y + 1, h - 1 - y, mul(cor, k * 0.7));
      }
    }
  });
}

export function folhas(semente = 43, cor = [34, 50, 30]) {
  const r = fazerRuido(semente);
  return textura(`folhas-${semente}-${cor}`, 32, 32, (px, _l, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = (x - w / 2) / (w / 2), dy = (y - h / 2) / (h / 2);
        const d = Math.sqrt(dx * dx + dy * dy);
        const n = fbm(r, x / 3, y / 3, 11, 2);
        if (d + (n - 0.5) * 0.7 < 0.85) px(x, y, mul(cor, 0.7 + n * 0.6));
      }
  });
}

// ---------- Luz ----------

export function halo() {
  return textura('halo', 32, 32, (px, _l, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2);
        const d = Math.sqrt(dx * dx + dy * dy);
        const v = Math.pow(clamp(1 - d), 2.2) * 255;
        px(x, y, [v, v, v, 255]);
      }
  }, { prender: true });
}

export function sombra() {
  return textura('sombra', 32, 32, (px, _l, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2);
        const d = Math.sqrt(dx * dx + dy * dy);
        px(x, y, [0, 0, 0, Math.pow(clamp(1 - d), 1.3) * 200]);
      }
  }, { prender: true });
}

export function lua() {
  const r = fazerRuido(47);
  return textura('lua', 32, 32, (px, _l, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = (x + 0.5 - w / 2) / (w / 2), dy = (y + 0.5 - h / 2) / (h / 2);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.62) {
          const n = fbm(r, x / 4, y / 4, 8, 2);
          const v = 200 + n * 55 - (n > 0.6 ? 40 : 0);
          px(x, y, [v, v * 0.97, v * 0.9, 255]);
        } else {
          const g = Math.pow(clamp(1 - (d - 0.62) / 0.38), 3) * 70;
          px(x, y, [g, g, g * 1.1, 255]);
        }
      }
  }, { prender: true });
}

// Véu de neblina (alpha suave e irregular) para planos que flutuam.
export function veuNevoa(semente = 53) {
  const r = fazerRuido(semente);
  return textura(`veu-${semente}`, 64, 32, (px, _l, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const n = fbm(r, x / 10, y / 6, 6, 3);
        const bx = Math.sin((x / w) * Math.PI), by = Math.sin((y / h) * Math.PI);
        const a = clamp((n - 0.3) * 1.6) * bx * by;
        px(x, y, [255, 255, 255, a * 255]);
      }
  }, { prender: true });
}

export function vidroLanterna() {
  return textura('vidro-lanterna', 16, 16, (px, _l, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = (x - w / 2) / (w / 2), dy = (y - h * 0.6) / (h / 2);
        const d = Math.sqrt(dx * dx + dy * dy);
        let c = mix([255, 236, 170], [200, 110, 40], clamp(d));
        if (x === 0 || x === w - 1) c = [40, 30, 20];
        px(x, y, c);
      }
  });
}
