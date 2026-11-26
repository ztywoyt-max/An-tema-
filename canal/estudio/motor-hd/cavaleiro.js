// O Enferrujado em alta: corpo forte modelado por formas, capacete fechado (oco, com fendas e
// os riscos gravados), espada gasta, cueca de linho, cinto e faixas nos antebraços.
// Coordenadas do boneco: pés na origem, de frente para +z. A pose sai das posições das juntas.
import * as THREE from 'three';
import { Perlin, clamp, suave, mistura } from './ruido.js';
import { malha, unir, cone, elipsoide, esfera, caixa, smin, smax, envCone, envEl, limites } from './sdf.js';
import { criar, ferrugem, pele, linho, couro } from './texturas.js';
import { triplanar } from './materiais.js';

const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// pose de pé, passo à frente com a perna esquerda, espada na mão direita com a ponta no chão
export const POSE_PARADO = {
  quadrilE: [0.095, 0.93, 0.0], joelhoE: [0.112, 0.515, 0.13], tornozeloE: [0.12, 0.085, 0.1], dedoE: [0.135, 0.025, 0.25],
  quadrilD: [-0.095, 0.93, 0.0], joelhoD: [-0.115, 0.505, -0.03], tornozeloD: [-0.125, 0.085, -0.13], dedoD: [-0.145, 0.025, 0.02],
  ombroE: [0.205, 1.47, -0.005], cotoveloE: [0.275, 1.185, -0.03], pulsoE: [0.29, 0.94, 0.02],
  ombroD: [-0.205, 1.47, -0.005], cotoveloD: [-0.27, 1.19, 0.03], pulsoD: [-0.285, 0.95, 0.14],
  pescoco: [0, 1.5, -0.01], cabeca: [0, 1.66, 0.0],
};

function partesCorpo(J) {
  const P = [];
  const C = (a, b, ra, rb, k) => P.push([cone(a, b, ra, rb), k, envCone(a, b, ra, rb)]);
  const E = (c, r, k) => P.push([elipsoide(c, r), k, envEl(c, r)]);
  // tronco
  E([0, 0.975, -0.005], [0.158, 0.11, 0.108], 0);
  C([0, 1.0, 0.0], [0, 1.2, 0.012], 0.128, 0.13, 0.05);
  E([0, 1.245, 0.0], [0.148, 0.13, 0.105], 0.05);
  E([0, 1.37, -0.005], [0.178, 0.135, 0.11], 0.05);
  for (const s of [-1, 1]) {
    E([s * 0.083, 1.38, 0.072], [0.09, 0.066, 0.048], 0.035); // peitoral
    E([s * 0.072, 0.915, -0.062], [0.08, 0.088, 0.068], 0.04); // glúteo
    E([s * 0.118, 1.085, 0.02], [0.058, 0.09, 0.07], 0.04); // oblíquo
    E([s * 0.138, 1.28, -0.035], [0.06, 0.12, 0.075], 0.05); // dorsal
    E([s * 0.08, 1.475, -0.04], [0.085, 0.045, 0.055], 0.05); // trapézio
    for (const y of [1.11, 1.18, 1.25]) E([s * 0.042, y, 0.097], [0.038, 0.03, 0.02], 0.02); // abdômen
  }
  E([0, 1.38, -0.07], [0.15, 0.12, 0.05], 0.05); // costas
  C(J.pescoco, J.cabeca, 0.064, 0.058, 0.05); // pescoço
  E(add(J.cabeca, [0, 0.06, 0.01]), [0.085, 0.105, 0.098], 0.03); // cabeça (fica dentro do capacete)
  for (const [l, s] of [['E', 1], ['D', -1]]) {
    const om = J['ombro' + l], co = J['cotovelo' + l], pu = J['pulso' + l];
    E(add(om, [s * 0.018, -0.012, 0]), [0.074, 0.085, 0.08], 0.045); // deltoide
    C(om, co, 0.056, 0.043, 0.04);
    const dirB = norm(sub(co, om));
    E(add(lerp3(om, co, 0.45), [0, 0, 0.022]), [0.047, 0.068, 0.047], 0.03); // bíceps
    E(add(lerp3(om, co, 0.4), [s * 0.006, 0, -0.026]), [0.046, 0.075, 0.045], 0.03); // tríceps
    C(co, pu, 0.046, 0.029, 0.03);
    E(add(lerp3(co, pu, 0.22), [s * 0.01, 0, 0.004]), [0.05, 0.075, 0.046], 0.03); // antebraço
    const dirA = norm(sub(pu, co));
    if (l === 'D') {
      // punho fechado no cabo da espada
      const mao = add(pu, dirA, 0.055);
      E(mao, [0.044, 0.052, 0.042], 0.025);
      E(add(mao, [s * -0.02, 0.012, 0.03]), [0.016, 0.03, 0.018], 0.012); // polegar
      for (let i = 0; i < 4; i++) E(add(mao, [s * 0.026, 0.024 - i * 0.017, 0.012]), [0.016, 0.011, 0.025], 0.01); // dedos dobrados
    } else {
      const palma = add(pu, dirA, 0.05);
      E(palma, [0.022, 0.052, 0.044], 0.02);
      for (let i = 0; i < 4; i++) {
        const raiz = add(palma, [0, -0.045, 0.03 - i * 0.02]);
        const meio = add(raiz, [-0.008, -0.035, 0.006]);
        const ponta = add(meio, [-0.018, -0.022, 0.008]);
        C(raiz, meio, 0.0105, 0.0095, 0.008);
        C(meio, ponta, 0.0095, 0.0085, 0.004);
      }
      C(add(palma, [-0.018, -0.01, 0.04]), add(palma, [-0.03, -0.05, 0.06]), 0.012, 0.01, 0.01); // polegar
    }
    void dirB;
  }
  for (const l of ['E', 'D']) {
    const q = J['quadril' + l], j = J['joelho' + l], t = J['tornozelo' + l], d = J['dedo' + l];
    C(q, j, 0.1, 0.058, 0.05);
    E(add(lerp3(q, j, 0.45), [0, 0, 0.028]), [0.082, 0.15, 0.074], 0.04); // quadríceps
    E(add(lerp3(q, j, 0.35), [0, 0, -0.03]), [0.072, 0.14, 0.066], 0.04); // posterior
    E(j, [0.05, 0.055, 0.05], 0.03); // joelho
    C(j, t, 0.054, 0.033, 0.03);
    E(add(lerp3(j, t, 0.3), [0, 0, -0.034]), [0.06, 0.1, 0.056], 0.035); // panturrilha
    E(t, [0.034, 0.036, 0.036], 0.02);
    const calc = add(t, sub(t, d), 0.18);
    C([calc[0], 0.035, calc[2]], [d[0], 0.022, d[2]], 0.036, 0.028, 0.03); // pé
    E([d[0], 0.02, d[2]], [0.042, 0.02, 0.03], 0.02);
  }
  return P;
}

// cueca de linho: a parte de baixo do corpo, inflada, cortada na cintura e no meio das coxas
function partesCueca(J, P3) {
  const sub2 = unir([
    [elipsoide([0, 0.975, -0.005], [0.158, 0.11, 0.108]), 0],
    [cone([0, 1.0, 0.0], [0, 1.1, 0.012], 0.128, 0.13), 0.05],
    ...['E', 'D'].map((l) => [cone(J['quadril' + l], lerp3(J['quadril' + l], J['joelho' + l], 0.45), 0.095, 0.075), 0.06]),
    ...[-1, 1].map((s) => [elipsoide([s * 0.072, 0.915, -0.062], [0.08, 0.088, 0.068]), 0.04]),
  ]);
  return (x, y, z) => {
    const dobras = 0.005 * P3.ruido(x * 28, y * 9, z * 28) + 0.0025 * Math.sin(Math.atan2(x, z) * 9 + y * 20);
    let d = sub2(x, y, z) - 0.02 + dobras;
    d = smax(d, y - 1.055, 0.01);
    d = smax(d, 0.775 + 0.03 * Math.sin(x * 40) * 0.2 - y, 0.012);
    return d;
  };
}

function cinto(J) {
  const base = unir([[cone([0, 1.0, 0.0], [0, 1.1, 0.012], 0.13, 0.132), 0]]);
  return (x, y, z) => smax(base(x, y, z) - 0.024, Math.abs(y - 1.045) - 0.022, 0.006);
}

function faixas(J, P3) {
  const fs = ['E', 'D'].map((l) => {
    const co = J['cotovelo' + l], pu = J['pulso' + l];
    const ab = cone(co, pu, 0.046, 0.029);
    const eixo = norm(sub(pu, co));
    const comp = Math.hypot(...sub(pu, co));
    return (x, y, z) => {
      const t = ((x - co[0]) * eixo[0] + (y - co[1]) * eixo[1] + (z - co[2]) * eixo[2]) / comp;
      const espiral = 0.0018 * Math.sin(t * 70 + Math.atan2(x - pu[0], z - pu[2]) * 1.0);
      return smax(ab(x, y, z) - 0.009 + espiral + 0.002 * P3.ruido(x * 60, y * 60, z * 60), Math.abs(t - 0.78) - 0.2, 0.004);
    };
  });
  return (x, y, z) => Math.min(fs[0](x, y, z), fs[1](x, y, z));
}

// ---------- capacete ----------
const CAP = { rx: 0.124, rz: 0.138, alt: 0.265 };
function sdfCapacete(P3) {
  const { rx, rz, alt } = CAP;
  const fendas = [caixa([-0.049, 0.178, 0.13], [0.036, 0.0068, 0.06], 0.002), caixa([0.049, 0.178, 0.13], [0.036, 0.0068, 0.06], 0.002)];
  const furos = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) furos.push([0.03 + j * 0.018 + (i % 2) * 0.009, 0.06 + i * 0.02]);
  const rebites = [];
  for (const yb of [0.205, 0.014]) for (let a = -Math.PI; a < Math.PI; a += Math.PI / 9) rebites.push([a, yb]);
  return (x, y, z) => {
    const taper = 1 - 0.05 * clamp(y / alt) + 0.025 * clamp((0.03 - y) / 0.03);
    const ex0 = rx * taper, ez = rz * taper;
    const proa = z > 0 ? 1 - 0.28 * Math.min(1, (z / ez) ** 2) : 1; // frente levemente em quina
    const ex = ex0 * proa;
    const e = (Math.hypot(x / ex, z / ez) - 1) * Math.min(ex, ez) * (z > 0 ? 0.9 : 1);
    let d = smax(e, Math.abs(y - alt / 2) - alt / 2, 0.018);
    const px = x / (ex0 * 0.97), py = (y - alt + 0.015) / 0.045, pz = z / (ez * 0.97);
    const domo = (Math.hypot(px, py, pz) - 1) * 0.045;
    d = smin(d, domo, 0.025);
    d = smin(d, caixa([0, alt * 0.5, ez * 0.92], [0.0095, alt * 0.5, 0.02], 0.006)(x, y, z), 0.008); // reforço vertical (a cruz)
    for (const yb of [0.205, 0.014]) d = Math.min(d, smax(e - 0.0035, Math.abs(y - yb) - 0.011, 0.003)); // faixas
    for (const [a, yb] of rebites) {
      const k = Math.hypot(Math.sin(a) / ex, Math.cos(a) / ez);
      d = Math.min(d, Math.hypot(x - Math.sin(a) / k, y - yb, z - Math.cos(a) / k) - 0.0068);
    }
    d += 0.0011 * P3.ruido(x * 16, y * 16, z * 16) + 0.0004 * P3.ruido(x * 55, y * 55, z * 55); // amassados
    let casca = Math.abs(d + 0.005) - 0.005;
    let corte = Math.min(fendas[0](x, y, z), fendas[1](x, y, z));
    if (z > 0) for (const [fx, fy] of furos) corte = Math.min(corte, Math.hypot(x + fx, y - fy) - 0.0042);
    casca = smax(casca, -corte, 0.0015);
    return smax(casca, -y - 0.002, 0.002); // aberto embaixo
  };
}

// textura do capacete com os riscos (uma marca para cada vida), em u = volta, v = altura
function texturaCapacete(marcas = 312) {
  const tam = 2048;
  const mascara = new Float32Array(tam * tam);
  const idade = new Float32Array(tam * tam);
  let semente = 99;
  const r = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  const traco = (x0, y0, x1, y1, larg, valor) => {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
    for (let s = 0; s <= n; s++) {
      const t = s / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t;
      const w = larg * (0.6 + 0.4 * Math.sin(t * Math.PI));
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const px = Math.round(cx + dx), py = Math.round(cy + dy);
        if (py < 0 || py >= tam) continue;
        const i = py * tam + ((px % tam) + tam) % tam;
        const f = clamp(1 - Math.hypot(px - cx, py - cy) / w);
        if (f > mascara[i]) { mascara[i] = f; idade[i] = valor; }
      }
    }
  };
  // grupos de cinco (quatro em pé e um atravessado), em fileiras pelos lados e pela nuca
  let feitas = 0;
  const fileiras = [0.075, 0.115, 0.155, 0.195, 0.235, 0.275, 0.045];
  const faixasU = [[0.06, 0.36], [0.64, 0.94]];
  outer: for (const fv of fileiras) {
    for (const [u0, u1] of faixasU) {
      for (let u = u0; u < u1 - 0.015; u += 0.0235) {
        const by = fv * tam + (r() - 0.5) * 22, bx = u * tam + (r() - 0.5) * 14;
        const alt = 40 + r() * 22, incl = (r() - 0.5) * 0.35;
        for (let m = 0; m < 5; m++) {
          if (feitas >= marcas) break outer;
          const v = feitas / marcas; // mais antigas: mais enferrujadas
          const larg = 1.4 + r() * 1.3;
          if (m < 4) {
            const x = bx + m * (7 + r() * 4);
            const a = alt * (0.85 + r() * 0.3), dx = Math.sin(incl + (r() - 0.5) * 0.25) * a;
            traco(x - dx / 2, by - a / 2 + (r() - 0.5) * 6, x + dx / 2, by + a / 2 + (r() - 0.5) * 6, larg, v);
          } else traco(bx - 8 + r() * 4, by + alt * (0.2 + r() * 0.2), bx + 34 + r() * 6, by - alt * (0.2 + r() * 0.2), larg, v);
          feitas++;
        }
      }
    }
  }
  return criar(tam, 5, (P, x, y, per, s, u, v, i) => {
    const manchas = P.fbm(x, y, 0, 5, per) + 0.3 * P.fbm(x * 4, y * 4, 3, 3, per * 4);
    const fer = suave(0.0, 0.22, manchas + (v < 0.03 ? 0.15 : 0));
    const poros = P.fbm(x * 12, y * 12, 7, 2, per * 12) * 0.6;
    const tom = suave(-0.3, 0.4, P.fbm(x * 2, y * 2, 9, 3, per * 2));
    let cr = mistura(0.47, mistura(0.3, 0.46, tom), fer), cg = mistura(0.46, mistura(0.12, 0.2, tom), fer), cb = mistura(0.44, mistura(0.05, 0.08, tom), fer);
    let h = fer * 0.6 + poros * (0.3 + fer * 0.7);
    let rug = mistura(0.36, 0.86, fer) + poros * 0.12, met = mistura(0.92, 0.1, fer);
    const mk = mascara[i];
    if (mk > 0) {
      const nova = 1 - idade[i] * 0.85; // riscos novos brilham, os velhos já pegaram ferrugem
      const brilho = mistura(0.36, 0.52, nova);
      const k = mk * mistura(0.35, 0.7, nova);
      cr = mistura(cr, brilho, k); cg = mistura(cg, brilho * 0.95, k); cb = mistura(cb, brilho * 0.9, k);
      h -= mk * 1.4;
      rug = mistura(rug, 0.3, mk * nova); met = mistura(met, 0.95, mk);
    }
    s.r = cr * (0.85 + poros * 0.4); s.g = cg * (0.85 + poros * 0.4); s.b = cb * (0.85 + poros * 0.4);
    s.h = h; s.rug = rug; s.met = met; s.m = fer;
  }, { relevo: 1.6, semente: 21 });
}

// ---------- espada (lâmina para +y a partir da guarda) ----------
function sdfLamina(P3) {
  const L = 0.86;
  const lascas = [0.18, 0.33, 0.47, 0.61, 0.72].map((t, i) => [(i % 2 ? 1 : -1), t * L, 0.004 + (i % 3) * 0.002]);
  return (x, y, z) => {
    const t = clamp(y / L);
    let w = 0.025 * (1 - 0.3 * t);
    if (t > 0.84) w *= Math.max(0.0001, (1 - t) / 0.16);
    const th = 0.0048 * (1 - 0.45 * t) * (t > 0.84 ? Math.max(0.15, (1 - t) / 0.16) : 1);
    let d = (Math.abs(x) / w + Math.abs(z) / th - 1) * Math.min(w, th) * 0.85;
    d = Math.max(d, -y, y - L);
    const sulco = Math.max(Math.abs(x) - 0.0042, Math.abs(y - 0.32) - 0.27, th - 0.0014 - Math.abs(z));
    d = smax(d, -sulco, 0.0008); // sulco no meio da lâmina
    for (const [lado, ly, r] of lascas) d = smax(d, -(Math.hypot(x - lado * w * 1.05, y - ly) - r), 0.001);
    d += 0.0004 * P3.ruido(x * 200, y * 60, z * 200);
    const guarda = caixa([0, -0.012, 0], [0.098, 0.011, 0.015], 0.006)(x, y - x * x * 1.6, z);
    const pomo = elipsoide([0, -0.228, 0], [0.027, 0.023, 0.019])(x, y, z);
    return Math.min(d, guarda, pomo);
  };
}
function sdfCabo(P3) {
  const c = cone([0, -0.02, 0], [0, -0.205, 0], 0.0158, 0.0148);
  return (x, y, z) => c(x, y, z) + 0.0011 * Math.sin(y * 420 + Math.atan2(x, z)) + 0.0004 * P3.ruido(x * 300, y * 300, z * 300);
}

export function criarCavaleiro({ pose = POSE_PARADO, marcas = 312, passo = 0.0065 } = {}) {
  const P3 = new Perlin(41);
  const raiz = new THREE.Group();
  const J = pose;
  const sombra = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

  const corpoSdf = unir(partesCorpo(J));
  const lim = { min: [-0.44, 0.0, -0.32], max: [0.44, 1.72, 0.42] };
  const gCorpo = malha(corpoSdf, { ...lim, passo, suavizar: 1 });
  const matPele = triplanar(pele(), { escala: 3.2, relevo: 0.22, metal: 0, fisico: { sheen: 0.6, sheenRoughness: 0.45, sheenColor: new THREE.Color(0.55, 0.22, 0.16), specularIntensity: 0.45 }, sujeira: { cor: 0x2a1f16, y0: 0.05, y1: 0.55 } });
  raiz.add(sombra(new THREE.Mesh(gCorpo, matPele)));

  const gCueca = malha(partesCueca(J, P3), { min: [-0.26, 0.7, -0.22], max: [0.26, 1.09, 0.22], passo: 0.006, suavizar: 1 });
  raiz.add(sombra(new THREE.Mesh(gCueca, triplanar(linho(), { escala: 3, relevo: 0.8, metal: 0, sujeira: { cor: 0x3a2e22, y0: 0.75, y1: 0.95 } }))));
  const gCinto = malha(cinto(J), { min: [-0.2, 1.0, -0.17], max: [0.2, 1.09, 0.19], passo: 0.004 });
  raiz.add(sombra(new THREE.Mesh(gCinto, triplanar(couro(), { escala: 5, relevo: 1, metal: 0 }))));
  const gFaixas = malha(faixas(J, P3), { min: [-0.38, 0.85, -0.12], max: [0.38, 1.2, 0.22], passo: 0.004 });
  raiz.add(sombra(new THREE.Mesh(gFaixas, triplanar(linho(), { escala: 4, relevo: 1, metal: 0, cor: 0xb8a890 }))));

  // capacete
  const texCap = texturaCapacete(marcas);
  const uvCap = (x, y, z) => [Math.atan2(x, z) / (Math.PI * 2) + 0.5, y / 0.82];
  const gCap = malha(sdfCapacete(P3), { min: [-0.15, -0.01, -0.17], max: [0.15, 0.36, 0.175], passo: 0.0028, uv: uvCap, suavizar: 0 });
  const matCap = new THREE.MeshStandardMaterial({ map: texCap.cor, roughnessMap: texCap.rm, metalnessMap: texCap.rm, normalMap: texCap.normal, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 1, metalness: 1, side: THREE.DoubleSide });
  const capacete = sombra(new THREE.Mesh(gCap, matCap));
  capacete.position.set(J.cabeca[0], J.cabeca[1] - 0.105, J.cabeca[2] - 0.005);
  capacete.rotation.x = 0.08; // cabeça um pouco baixa
  // forro escuro por dentro: pelas fendas só se vê o breu
  const forro = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  forro.scale.set(CAP.rx * 0.86, CAP.alt * 0.55, CAP.rz * 0.86);
  forro.position.y = CAP.alt * 0.5;
  capacete.add(forro);
  raiz.add(capacete);

  // espada
  const espada = new THREE.Group();
  const gLam = malha(sdfLamina(P3), { min: [-0.12, -0.26, -0.025], max: [0.12, 0.88, 0.025], passo: 0.0016, suavizar: 0 });
  espada.add(sombra(new THREE.Mesh(gLam, triplanar(ferrugem(), { escala: 7, relevo: 1, rugosidade: 1, metal: 1 }))));
  const gCabo = malha(sdfCabo(P3), { min: [-0.025, -0.22, -0.025], max: [0.025, 0.0, 0.025], passo: 0.0015 });
  espada.add(sombra(new THREE.Mesh(gCabo, triplanar(couro(), { escala: 9, relevo: 1, metal: 0 }))));
  raiz.add(espada);
  const dirA = norm(sub(J.pulsoD, J.cotoveloD));
  const punho = add(J.pulsoD, dirA, 0.055);
  const ponta = [punho[0] - 0.13, 0.005, punho[2] + 0.5];
  const dir = new THREE.Vector3(...sub(ponta, punho)).normalize();
  espada.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  espada.rotateY(0.9);
  espada.position.set(...punho).addScaledVector(dir, 0.105);

  raiz.userData = { capacete, espada, J };
  return raiz;
}
