// Roupas do motor HD, feitas "infladas" sobre o corpo (ou como volumes próprios, no caso de saias e mantos).
// Cada função devolve { sdf, limites, permitidos, ajuste } para criarBoneco.
import { Perlin, clamp } from './ruido.js';
import { sdfDePartes, sub, norm, add } from './boneco.js';
import { smax, smin, elipsoide } from './sdf.js';

const deOssos = (P, ossos) => P.filter((p) => ossos.includes(p[3]));
const LIM = (J, folga = 0.1) => {
  const h = J.altura / 1.82;
  return { min: [-0.7 * h, 0, -0.4 * h], max: [0.7 * h, J.topo[1], 0.45 * h] };
};
// posição ao longo de um osso (0 no começo, 1 no fim)
function aoLongo(J, a, b) {
  const ja = J[a], jb = J[b];
  const d = sub(jb, ja), L = Math.hypot(...d), u = norm(d);
  return (x, y, z) => ((x - ja[0]) * u[0] + (y - ja[1]) * u[1] + (z - ja[2]) * u[2]) / L;
}

/**
 * camisa/túnica. manga: 'longa' | 'curta' | 'sem'. barra: altura relativa da barra em relação à raiz
 * (0 = na cintura, -0.25 = meio da coxa). gola: abertura no pescoço.
 */
export function camisa(P, J, { manga = 'longa', barra = -0.12, folga = 0.014, rugas = 1, semente = 2, punho = 0.95 } = {}) {
  const P3 = new Perlin(semente);
  const h = J.altura / 1.82;
  const tronco = sdfDePartes(deOssos(P, ['raiz', 'coluna', 'peito', 'pescoco', 'coxaE', 'coxaD']));
  const bracos = manga === 'sem' ? null : sdfDePartes(deOssos(P, manga === 'longa' ? ['bracoE', 'bracoD', 'antebracoE', 'antebracoD'] : ['bracoE', 'bracoD']));
  const tE = aoLongo(J, 'ombroE', 'pulsoE'), tD = aoLongo(J, 'ombroD', 'pulsoD');
  const yBarra = J.raiz[1] + barra * h;
  const yGola = J.pescoco[1] + 0.005 * h;
  const lim = manga === 'longa' ? punho : 0.42;
  return {
    sdf: (x, y, z) => {
      const dob = rugas * (0.0035 * P3.ruido(x * 30, y * 14, z * 30) + 0.002 * Math.sin(y * 90 + x * 20));
      let d = tronco(x, y, z) - folga * h - dob;
      d = smax(d, yBarra - y, 0.008);
      if (bracos) {
        const t = x > 0 ? tE(x, y, z) : tD(x, y, z);
        let b = bracos(x, y, z) - folga * h * 0.8 - dob;
        b = smax(b, (t - lim) * 0.4, 0.006);
        d = smin(d, b, 0.02 * h);
      }
      // gola: tira só o que fica em volta do pescoço (os ombros continuam cobertos)
      const gola = Math.max(Math.hypot(x - J.pescoco[0], (z - J.pescoco[2]) * 1.15) - 0.085 * h, yGola - y);
      d = smax(d, -gola, 0.01);
      return smax(d, y - (J.pescoco[1] + 0.05 * h), 0.01);
    },
    limites: LIM(J),
    permitidos: ['raiz', 'coluna', 'peito', 'pescoco', 'bracoE', 'bracoD', 'antebracoE', 'antebracoD', 'coxaE', 'coxaD'],
    ajuste: { coxaE: 0.5, coxaD: 0.5 },
  };
}

// calça até o tornozelo (ou até o joelho)
export function calca(P, J, { folga = 0.012, ate = 'tornozelo', semente = 4 } = {}) {
  const P3 = new Perlin(semente);
  const h = J.altura / 1.82;
  const pernas = sdfDePartes(deOssos(P, ['raiz', 'coluna', 'coxaE', 'coxaD', 'pernaE', 'pernaD']));
  const yCintura = J.raiz[1] + 0.1 * h;
  const yBarra = ate === 'joelho' ? J.joelhoE[1] - 0.05 * h : J.tornozeloE[1] + 0.05 * h;
  return {
    sdf: (x, y, z) => {
      let d = pernas(x, y, z) - folga * h - 0.003 * P3.ruido(x * 25, y * 10, z * 25) - 0.0025 * Math.sin(y * 70);
      d = smax(d, y - yCintura, 0.008);
      return smax(d, yBarra - y, 0.008);
    },
    limites: LIM(J),
    permitidos: ['raiz', 'coluna', 'coxaE', 'coxaD', 'pernaE', 'pernaD'],
  };
}

// botas/sapatos de couro
export function botas(P, J, { cano = 0.32, folga = 0.008 } = {}) {
  const h = J.altura / 1.82;
  const pes = sdfDePartes(deOssos(P, ['pernaE', 'pernaD', 'peE', 'peD']));
  const yTopo = J.tornozeloE[1] + cano * (J.joelhoE[1] - J.tornozeloE[1]);
  return {
    sdf: (x, y, z) => smax(pes(x, y, z) - folga * h, y - yTopo, 0.006),
    limites: { min: [-0.4 * h, 0, -0.25 * h], max: [0.4 * h, yTopo + 0.05, 0.35 * h] },
    permitidos: ['pernaE', 'pernaD', 'peE', 'peD'],
  };
}

// saia (vestido): sino que desce da cintura, envolvendo as duas pernas
export function saia(P, J, { barra = 0.06, abertura = 0.16, folga = 0.02, semente = 6, cintura = 0.07 } = {}) {
  const P3 = new Perlin(semente);
  const h = J.altura / 1.82;
  const quadril = sdfDePartes(deOssos(P, ['raiz', 'coluna']));
  const yC = J.raiz[1] + cintura * h, yB = barra * h;
  const r0 = 0.16 * h;
  return {
    sdf: (x, y, z) => {
      const t = clamp((yC - y) / (yC - yB));
      const a = Math.atan2(x, z);
      const pregas = 0.012 * h * t * Math.sin(a * 9 + P3.ruido(x * 6, y * 3, z * 6) * 3) + 0.006 * h * P3.ruido(x * 18, y * 8, z * 18);
      const r = r0 + abertura * h * Math.pow(t, 0.8);
      let d = (Math.hypot(x / 1.0, (z + 0.01 * h) / 0.88) - r - pregas) * 0.85;
      d = smin(d, quadril(x, y, z) - folga * h, 0.04 * h);
      d = smax(d, y - yC, 0.01);
      return smax(d, yB - y, 0.01);
    },
    limites: LIM(J),
    permitidos: ['raiz', 'coluna', 'coxaE', 'coxaD'],
    ajuste: { coxaE: 0.35, coxaD: 0.35 },
  };
}

// avental de couro (frente do corpo)
export function avental(P, J, { folga = 0.03, barra = -0.42 } = {}) {
  const h = J.altura / 1.82;
  const frente = sdfDePartes(deOssos(P, ['raiz', 'coluna', 'peito', 'coxaE', 'coxaD']));
  const yTopo = J.peito[1] + 0.13 * h, yBarra = J.raiz[1] + barra * h;
  return {
    sdf: (x, y, z) => {
      let d = Math.abs(frente(x, y, z) - folga * h) - 0.004 * h;
      d = smax(d, 0.02 * h - z, 0.01); // só a frente
      d = smax(d, Math.abs(x) - 0.17 * h, 0.01);
      d = smax(d, y - yTopo, 0.006);
      return smax(d, yBarra - y, 0.006);
    },
    limites: LIM(J),
    permitidos: ['raiz', 'coluna', 'peito', 'coxaE', 'coxaD'],
    ajuste: { coxaE: 0.4, coxaD: 0.4 },
  };
}

// manto/capa: casca em forma de sino presa nos ombros, aberta na frente
export function manto(P, J, { barra = 0.18, abertura = 0.11, folga = 0.035, frente = 0.07, semente = 8, comprido = 1 } = {}) {
  const P3 = new Perlin(semente);
  const h = J.altura / 1.82;
  const ombros = sdfDePartes(deOssos(P, ['peito', 'pescoco', 'coluna']));
  const yO = J.ombroE[1] + 0.02 * h, yB = barra * h;
  return {
    sdf: (x, y, z) => {
      const t = clamp((yO - y) / (yO - yB));
      const a = Math.atan2(x, z);
      const pregas = 0.016 * h * t * Math.sin(a * 7 + P3.ruido(x * 5, y * 2, z * 5) * 3) + 0.007 * h * P3.ruido(x * 15, y * 6, z * 15);
      const rx = (0.24 + abertura * Math.pow(t, 0.7) * comprido) * h, rz = (0.16 + abertura * 0.8 * Math.pow(t, 0.7)) * h;
      let sino = (Math.hypot(x / rx, (z + 0.03 * h) / rz) - 1) * Math.min(rx, rz) - pregas;
      sino = smin(sino, ombros(x, y, z) - folga * h, 0.06 * h);
      let d = Math.abs(sino + 0.007 * h) - 0.007 * h;
      d = smax(d, y - (yO + 0.06 * h), 0.02);
      d = smax(d, yB - y, 0.01);
      // abertura na frente
      const fenda = smax(Math.abs(x) - frente * h * (0.4 + t), -z, 0.01);
      return smax(d, -fenda, 0.006);
    },
    limites: LIM(J),
    permitidos: ['raiz', 'coluna', 'peito', 'pescoco'],
  };
}

// peitoral de armadura (placa sobre o tronco) e ombreiras
export function couraca(P, J, { folga = 0.03 } = {}) {
  const h = J.altura / 1.82;
  const tronco = sdfDePartes(deOssos(P, ['raiz', 'coluna', 'peito']));
  const yTopo = J.pescoco[1] - 0.005 * h, yBarra = J.raiz[1] - 0.05 * h;
  const ombE = elipsoide(add(J.ombroE, [0.03 * h, 0.02 * h, 0]), [0.095 * h, 0.07 * h, 0.1 * h]);
  const ombD = elipsoide(add(J.ombroD, [-0.03 * h, 0.02 * h, 0]), [0.095 * h, 0.07 * h, 0.1 * h]);
  return {
    sdf: (x, y, z) => {
      let d = tronco(x, y, z) - folga * h;
      d = smax(d, y - yTopo, 0.01);
      d = smax(d, yBarra - y, 0.01);
      d = Math.min(d, smax(Math.min(ombE(x, y, z), ombD(x, y, z)), J.ombroE[1] - 0.06 * h - y, 0.01));
      // aresta no meio do peito
      return d - 0.006 * h * Math.max(0, 1 - Math.abs(x) / (0.05 * h)) * (z > 0 ? 1 : 0);
    },
    limites: LIM(J),
    permitidos: ['raiz', 'coluna', 'peito', 'bracoE', 'bracoD'],
    ajuste: { bracoE: 0.3, bracoD: 0.3 },
  };
}
