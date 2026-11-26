// Bonecos animáveis do motor HD.
// O corpo é modelado uma vez, de braços abertos (pose "A"), por campos de distância; cada forma pertence a um osso.
// Os pesos da pele saem dessa posse (e se espalham perto das juntas), então o esqueleto do three.js dobra a malha.
// Mãos e cabeça são peças rígidas presas aos ossos (dá para trocar a mão aberta por punho fechado).
import * as THREE from 'three';
import { malha, cone, elipsoide, smin, envCone, envEl } from './sdf.js';
import { geoCache } from './cache.js';

const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const esc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export { add, sub, lerp3, norm };

// ---------- proporções ----------
// altura: metros (adulto ~1,8); ombros/quadril: larguras relativas; crianca: 0..1 (cabeça maior, membros curtos)
export function juntas({ altura = 1.82, ombros = 1, quadril = 1, crianca = 0, braco = 1, perna = 1 } = {}) {
  const h = altura / 1.82;
  const so = ombros, sq = quadril;
  const J = {
    raiz: [0, 0.97, 0], coluna: [0, 1.08, 0.01], peito: [0, 1.28, 0], pescoco: [0, 1.5, -0.01], cabeca: [0, 1.6, 0], topo: [0, 1.83, 0.01],
  };
  const pernaK = perna * (1 - crianca * 0.08);
  for (const [l, s] of [['E', 1], ['D', -1]]) {
    J['ombro' + l] = [s * 0.2 * so, 1.46, -0.005];
    const dirB = norm([s * 0.5, -0.866, 0]);
    J['cotovelo' + l] = add(J['ombro' + l], dirB, 0.29 * braco);
    J['pulso' + l] = add(J['cotovelo' + l], norm([s * 0.5, -0.866, 0.08]), 0.26 * braco);
    J['mao' + l] = add(J['pulso' + l], norm([s * 0.5, -0.866, 0.08]), 0.09 * braco);
    J['quadril' + l] = [s * 0.095 * sq, 0.93, 0];
    J['joelho' + l] = [s * (0.105 * sq + 0.01), 0.93 - 0.42 * pernaK, 0.005];
    J['tornozelo' + l] = [s * (0.11 * sq + 0.015), 0.93 - 0.845 * pernaK, -0.01];
    J['dedo' + l] = [s * (0.115 * sq + 0.02), 0.025, J['tornozelo' + l][2] + 0.15];
  }
  // pernas mais curtas descem o tronco inteiro
  const queda = 0.845 * (1 - pernaK);
  for (const k of ['raiz', 'coluna', 'peito', 'pescoco', 'cabeca', 'topo', 'ombroE', 'ombroD', 'cotoveloE', 'cotoveloD', 'pulsoE', 'pulsoD', 'maoE', 'maoD', 'quadrilE', 'quadrilD', 'joelhoE', 'joelhoD'])
    J[k] = [J[k][0], J[k][1] - queda * (k.startsWith('joelho') ? 0.5 : 1), J[k][2]];
  for (const k in J) J[k] = esc(J[k], h);
  // cabeça: centro do crânio e a dobradiça da mandíbula (crianças têm a cabeça proporcionalmente maior)
  const ch = (1 + crianca * 0.25) * (crianca ? 1 : 1);
  J.centroCabeca = add(J.cabeca, [0, 0.085 * h * ch, 0.01 * h]);
  J.mandibula = add(J.centroCabeca, [0, -0.012 * h * ch, -0.012 * h * ch]);
  J.queixo = add(J.centroCabeca, [0, -0.1 * h * ch, 0.05 * h * ch]);
  J.escCabeca = h * ch;
  J.altura = altura;
  return J;
}

export const OSSOS = [
  ['raiz', null, 'raiz', 'coluna'], ['coluna', 'raiz', 'coluna', 'peito'], ['peito', 'coluna', 'peito', 'pescoco'],
  ['pescoco', 'peito', 'pescoco', 'cabeca'], ['cabeca', 'pescoco', 'cabeca', 'topo'], ['mandibula', 'cabeca', 'mandibula', 'queixo'],
  ['bracoE', 'peito', 'ombroE', 'cotoveloE'], ['antebracoE', 'bracoE', 'cotoveloE', 'pulsoE'], ['maoE', 'antebracoE', 'pulsoE', 'maoE'],
  ['bracoD', 'peito', 'ombroD', 'cotoveloD'], ['antebracoD', 'bracoD', 'cotoveloD', 'pulsoD'], ['maoD', 'antebracoD', 'pulsoD', 'maoD'],
  ['coxaE', 'raiz', 'quadrilE', 'joelhoE'], ['pernaE', 'coxaE', 'joelhoE', 'tornozeloE'], ['peE', 'pernaE', 'tornozeloE', 'dedoE'],
  ['coxaD', 'raiz', 'quadrilD', 'joelhoD'], ['pernaD', 'coxaD', 'joelhoD', 'tornozeloD'], ['peD', 'pernaD', 'tornozeloD', 'dedoD'],
];
const JUNTA_RAIO = { mandibula: 0, antebraco: 0.06, braco: 0.07, coxa: 0.09, perna: 0.07, pe: 0.04, mao: 0.03, coluna: 0.08, peito: 0.08, pescoco: 0.05, cabeca: 0.04 };

// ---------- corpo (formas com dono) ----------
// forca: músculos (0.5 magro .. 1.2 forte); gordura: 0..1; mulher: 0/1
export function partesCorpo(J, { forca = 1, gordura = 0, mulher = 0, crianca = 0, semCabeca = true } = {}) {
  const P = [];
  const h = J.altura / 1.82;
  const m = 0.82 + 0.18 * forca, g = gordura;
  const C = (a, b, ra, rb, k, osso) => P.push([cone(a, b, ra * h, rb * h), k * h, envCone(a, b, ra * h, rb * h), osso]);
  const E = (c, r, k, osso) => { const rr = esc(r, h); P.push([elipsoide(c, rr), k * h, envEl(c, rr), osso]); };
  const Y = (y) => y * h; // alturas do corpo de referência
  const dy = J.raiz[1] - Y(0.97);
  const T = (x, y, z) => [x * h, y * h + dy, z * h];
  // tronco
  E(T(0, 0.975, -0.005), [0.158 * (1 + mulher * 0.12 + g * 0.1), 0.11, 0.108 + g * 0.03], 0, 'raiz');
  C(T(0, 1.0, 0), T(0, 1.2, 0.012 + g * 0.03), 0.128 * (1 - mulher * 0.12) + g * 0.04, 0.13 * (1 - mulher * 0.1) + g * 0.05, 0.05, 'coluna');
  E(T(0, 1.245, 0), [0.148 * m * (1 - mulher * 0.1) + g * 0.02, 0.13, 0.105 + g * 0.03], 0.05, 'peito');
  E(T(0, 1.37, -0.005), [0.178 * m * (1 - mulher * 0.14), 0.135, 0.11 * m], 0.05, 'peito');
  for (const s of [-1, 1]) {
    if (mulher) E(T(s * 0.078, 1.33, 0.075), [0.07, 0.068, 0.062], 0.04, 'peito');
    else E(T(s * 0.083, 1.38, 0.072), [0.09 * m, 0.066 * m, 0.048 * m], 0.035, 'peito');
    E(T(s * 0.072 * (1 + mulher * 0.15), 0.915, -0.062), [0.08 * (1 + mulher * 0.12), 0.088, 0.068 * (1 + mulher * 0.1)], 0.04, 'raiz');
    E(T(s * 0.118, 1.085, 0.02), [0.058 + g * 0.03, 0.09, 0.07 + g * 0.02], 0.04, 'coluna');
    E(T(s * 0.138 * m, 1.28, -0.035), [0.06 * m, 0.12, 0.075], 0.05, 'peito');
    E(T(s * 0.08, 1.475, -0.04), [0.085 * m, 0.045, 0.055], 0.05, 'peito');
    if (forca > 0.8 && !mulher && g < 0.4) for (const y of [1.11, 1.18, 1.25]) E(T(s * 0.042, y, 0.097), [0.038, 0.03, 0.02], 0.02, y < 1.2 ? 'coluna' : 'peito');
  }
  E(T(0, 1.38, -0.07), [0.15 * m, 0.12, 0.05], 0.05, 'peito');
  C(J.pescoco, add(J.cabeca, [0, 0.02 * h, 0]), 0.064 * (1 - mulher * 0.15), 0.058 * (1 - mulher * 0.15), 0.05, 'pescoco');
  if (!semCabeca) E(add(J.cabeca, [0, 0.08 * h, 0.01 * h]), [0.085, 0.105, 0.098], 0.03, 'cabeca');
  for (const [l, s] of [['E', 1], ['D', -1]]) {
    const om = J['ombro' + l], co = J['cotovelo' + l], pu = J['pulso' + l];
    E(add(om, [s * 0.018 * h, -0.012 * h, 0]), [0.074 * m, 0.085 * m, 0.08 * m], 0.045, 'braco' + l);
    C(om, co, 0.056 * m * (1 - mulher * 0.15), 0.043 * (1 - mulher * 0.12), 0.04, 'braco' + l);
    if (forca > 0.7) {
      E(add(lerp3(om, co, 0.45), [0, 0, 0.022 * h]), [0.047 * m, 0.068, 0.047 * m], 0.03, 'braco' + l);
      E(add(lerp3(om, co, 0.4), [s * 0.006 * h, 0, -0.026 * h]), [0.046 * m, 0.075, 0.045 * m], 0.03, 'braco' + l);
    }
    C(co, pu, 0.046 * (1 - mulher * 0.15), 0.029 * (1 - mulher * 0.12), 0.03, 'antebraco' + l);
    E(lerp3(co, pu, 0.22), [0.05 * m * (1 - mulher * 0.2), 0.075, 0.046 * m * (1 - mulher * 0.2)], 0.03, 'antebraco' + l);
    const q = J['quadril' + l], j = J['joelho' + l], t = J['tornozelo' + l], d = J['dedo' + l];
    C(q, j, (0.1 + g * 0.02) * (1 + mulher * 0.08), 0.058, 0.05, 'coxa' + l);
    E(add(lerp3(q, j, 0.45), [0, 0, 0.028 * h]), [0.082 * m, 0.15, 0.074 * m], 0.04, 'coxa' + l);
    E(add(lerp3(q, j, 0.35), [0, 0, -0.03 * h]), [0.072 * m, 0.14, 0.066 * m], 0.04, 'coxa' + l);
    E(j, [0.05, 0.055, 0.05], 0.03, 'perna' + l);
    C(j, t, 0.054 * (1 - mulher * 0.1), 0.033 * (1 - mulher * 0.12), 0.03, 'perna' + l);
    E(add(lerp3(j, t, 0.3), [0, 0, -0.034 * h]), [0.06 * m, 0.1, 0.056 * m], 0.035, 'perna' + l);
    E(t, [0.034, 0.036, 0.036], 0.02, 'pe' + l);
    const calc = add(t, sub(t, d), 0.18);
    C([calc[0], 0.035 * h, calc[2]], [d[0], 0.022 * h, d[2]], 0.036, 0.028, 0.03, 'pe' + l);
    E([d[0], 0.02 * h, d[2]], [0.042, 0.02, 0.03], 0.02, 'pe' + l);
  }
  return P;
}

// une as formas (com o pulo de formas distantes)
export function sdfDePartes(P) {
  return (x, y, z) => {
    let d = Infinity;
    for (let i = 0; i < P.length; i++) {
      const [fn, k, b] = P[i];
      if (b && d < Infinity && Math.hypot(x - b[0], y - b[1], z - b[2]) - b[3] > d + k) continue;
      d = d === Infinity ? fn(x, y, z) : smin(d, fn(x, y, z), k);
    }
    return d;
  };
}

// ---------- pesos da pele ----------
// ossosPermitidos: limita os ossos (ex.: saia só no quadril e coxas); ajuste: { osso: fator }
export function pesar(geo, P, J, { permitidos = null, ajuste = {}, suave = 0.012, ossos = OSSOS, raios = JUNTA_RAIO } = {}) {
  const OS = ossos;
  const idx = Object.fromEntries(OS.map((o, i) => [o[0], i]));
  const pai = Object.fromEntries(OS.map((o) => [o[0], o[1]]));
  const pos = geo.attributes.position;
  const n = pos.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const w = new Float32Array(OS.length);
  for (let v = 0; v < n; v++) {
    const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
    w.fill(0);
    let dmin = Infinity;
    const ds = P.map(([fn, , b]) => (b && Math.hypot(x - b[0], y - b[1], z - b[2]) - b[3] > 0.15 ? Infinity : fn(x, y, z)));
    for (const d of ds) dmin = Math.min(dmin, d);
    for (let k = 0; k < P.length; k++) {
      if (ds[k] === Infinity) continue;
      const o = P[k][3];
      if (permitidos && !permitidos.includes(o)) continue;
      w[idx[o]] += Math.exp(-(ds[k] - dmin) / suave) * (ajuste[o] ?? 1);
    }
    // espalha o peso perto do começo de cada osso de membro (a junta dobra macia, sem vinco)
    for (const [nome, , a, b] of OS) {
      const i = idx[nome];
      if (!w[i] || !pai[nome]) continue;
      const base = nome.replace(/[ED]$/, '');
      const r = (raios[base] ?? 0.05) * (J.altura / 1.82);
      const ja = J[a], jb = J[b];
      const dir = norm(sub(jb, ja));
      const t = (x - ja[0]) * dir[0] + (y - ja[1]) * dir[1] + (z - ja[2]) * dir[2];
      if (t < r) {
        const fica = THREE.MathUtils.smoothstep(t, -r, r);
        const vai = w[i] * (1 - fica);
        if (permitidos && !permitidos.includes(pai[nome])) continue;
        w[i] -= vai;
        w[idx[pai[nome]]] += vai;
      }
    }
    // quatro maiores
    const ordem = [...w.keys()].sort((a, b) => w[b] - w[a]).slice(0, 4);
    let soma = 0;
    for (const i of ordem) soma += w[i];
    if (soma <= 0) { si[v * 4] = idx[permitidos ? permitidos[0] : 'raiz']; sw[v * 4] = 1; continue; }
    ordem.forEach((i, k) => { si[v * 4 + k] = i; sw[v * 4 + k] = w[i] / soma; });
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  return geo;
}

// ---------- montagem ----------
/**
 * criarBoneco({ J, partes, corpo: { material, passo }, roupas: [{ sdf, material, limites, passo, permitidos, ajuste }],
 *               rigidas: [{ osso, objeto }] })
 * Devolve { raiz (Group), ossos, malhas, pose(p), J }.
 */
export function criarBoneco({ J, partes, corpo, roupas = [], nome = 'boneco', ossos: OS = OSSOS, raios = JUNTA_RAIO }) {
  const raiz = new THREE.Group();
  raiz.name = nome;
  const ossos = {};
  const lista = [];
  for (const [o, p, a] of OS) {
    const b = new THREE.Bone();
    b.name = o;
    const ja = J[a];
    if (p) {
      const jp = J[OS.find((x) => x[0] === p)[2]];
      b.position.set(ja[0] - jp[0], ja[1] - jp[1], ja[2] - jp[2]);
      ossos[p].add(b);
    } else {
      b.position.set(...ja);
      raiz.add(b);
    }
    ossos[o] = b;
    lista.push(b);
  }
  raiz.updateMatrixWorld(true);
  const esqueleto = new THREE.Skeleton(lista);
  const malhas = [];
  const pele = (geo, mat) => {
    const m = new THREE.SkinnedMesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    raiz.add(m);
    m.bind(esqueleto, new THREE.Matrix4());
    malhas.push(m);
    return m;
  };
  if (corpo) {
    const sdf = sdfDePartes(partes);
    const h = J.altura / 1.82;
    const lim = corpo.caixa ?? { min: [-0.62 * h, 0, -0.32 * h], max: [0.62 * h, J.topo[1] + 0.02, 0.42 * h] };
    const g = geoCache(corpo.cache && `${corpo.cache}/corpo`, () => pesar(malha(sdf, { ...lim, passo: corpo.passo ?? 0.0065, suavizar: 1, ...(corpo.limites ?? {}) }), partes, J, { ossos: OS, raios }));
    pele(g, corpo.material);
  }
  roupas.forEach((r, i) => {
    const g = geoCache(corpo?.cache && `${corpo.cache}/roupa${i}`, () => pesar(malha(r.sdf, { min: r.limites.min, max: r.limites.max, passo: r.passo ?? 0.006, suavizar: r.suavizar ?? 1, uv: r.uv }), partes, J, { permitidos: r.permitidos, ajuste: r.ajuste, ossos: OS, raios }));
    pele(g, r.material);
  });
  const boneco = { raiz, ossos, malhas, esqueleto, J, ossosDef: OS };
  boneco.prender = (osso, obj) => {
    // prende um objeto rígido ao osso, mantendo a posição de repouso dele (em coordenadas do boneco)
    const b = ossos[osso];
    b.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(b.matrixWorld).invert();
    obj.applyMatrix4(inv.multiply(raiz.matrixWorld));
    b.add(obj);
    obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return obj;
  };
  boneco.pose = (p) => aplicarPose(boneco, p);
  return boneco;
}

// ---------- poses ----------
// pose: { osso: [x, y, z] em graus } + pos: [x, y, z] (deslocamento da raiz) + giro (graus, em torno de y).
// Convenções (boneco de frente para +z): braço/perna para a frente = x negativo; joelho dobra com x positivo;
// cotovelo dobra com x negativo; braço esquerdo abre com z positivo, o direito com z negativo.
const D2R = Math.PI / 180;
export function aplicarPose(b, p) {
  for (const [o] of b.ossosDef ?? OSSOS) {
    const r = p[o] ?? [0, 0, 0];
    b.ossos[o].rotation.set(r[0] * D2R, r[1] * D2R, r[2] * D2R, 'YXZ');
  }
  const base = b.J.raiz;
  const d = p.pos ?? [0, 0, 0];
  b.ossos.raiz.position.set(base[0] + d[0], base[1] + d[1], base[2] + d[2]);
}

export function misturar(a, b, t) {
  const r = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[k] ?? (k === 'giro' ? 0 : [0, 0, 0]), y = b[k] ?? (k === 'giro' ? 0 : [0, 0, 0]);
    r[k] = Array.isArray(x) ? x.map((v, i) => v + (y[i] - v) * t) : x + (y - x) * t;
  }
  return r;
}
export function somar(...ps) {
  const r = {};
  for (const p of ps) for (const k in p) {
    const v = p[k];
    if (Array.isArray(v)) r[k] = (r[k] ?? [0, 0, 0]).map((x, i) => x + v[i]);
    else r[k] = (r[k] ?? 0) + v;
  }
  return r;
}

// braços caídos ao lado do corpo (desfaz a pose "A" do modelo)
export const DE_PE = { bracoE: [0, 0, -22], bracoD: [0, 0, 22], antebracoE: [-8, 0, -6], antebracoD: [-8, 0, 6], maoE: [0, 0, -4], maoD: [0, 0, 4] };

// respiração e pequenos ajustes de quem está parado
export function parado(t, { forca = 1 } = {}) {
  const r = Math.sin(t * 1.7);
  return somar(DE_PE, {
    peito: [-1.2 * r * forca, 0, 0], coluna: [0.5 * r, 0, 0], pescoco: [0.6 * r, 0, 0],
    bracoE: [0, 0, 0.8 * r], bracoD: [0, 0, -0.8 * r], pos: [0, 0.002 * r, 0],
  });
}

// andar: fase em ciclos (1 = dois passos). passo: amplitude (1 normal, 0.6 arrastado)
export function andar(fase, { passo = 1, bracos = 1, peso = 1 } = {}) {
  const f = fase * Math.PI * 2;
  const s = Math.sin(f), c = Math.cos(f);
  const coxa = 24 * passo;
  const joelho = (ff) => Math.max(0, Math.sin(ff + 0.9)) * 48 * passo + 6;
  return somar(DE_PE, {
    coxaE: [-coxa * s, 0, 0], coxaD: [coxa * s, 0, 0],
    pernaE: [joelho(f + Math.PI), 0, 0], pernaD: [joelho(f), 0, 0],
    peE: [-Math.max(0, -Math.sin(f + 0.4)) * 14 * passo + 4, 0, 0], peD: [-Math.max(0, Math.sin(f + 0.4)) * 14 * passo + 4, 0, 0],
    bracoE: [16 * s * bracos, 0, 0], bracoD: [-16 * s * bracos, 0, 0],
    antebracoE: [-(10 + 8 * Math.max(0, -s)) * bracos, 0, 0], antebracoD: [-(10 + 8 * Math.max(0, s)) * bracos, 0, 0],
    raiz: [3 * peso, 4 * s * passo, 0], coluna: [-2 * peso, -3 * s * passo, 0], peito: [0, -3 * s * passo, 0],
    pos: [0, -0.025 * passo * Math.abs(c) * peso + 0.012 * passo, 0],
  });
}
