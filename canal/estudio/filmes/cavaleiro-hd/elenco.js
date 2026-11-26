// Elenco de "O Cavaleiro Sem Armadura" no motor HD (bonecos animáveis).
import * as THREE from 'three';
import { Perlin } from '../../motor-hd/ruido.js';
import { juntas, partesCorpo, sdfDePartes, criarBoneco, add, sub, norm, lerp3 } from '../../motor-hd/boneco.js';
import { cone, smax, smin } from '../../motor-hd/sdf.js';
import { criarMao } from '../../motor-hd/maos.js';
import { triplanar } from '../../motor-hd/materiais.js';
import { pele, linho, couro } from '../../motor-hd/texturas.js';
import { criarCapacete, criarEspada } from '../../motor-hd/cavaleiro.js';

export function materialPele(tom = [1, 1, 1], suja = 0.55) {
  return triplanar(pele(), {
    escala: 3.2, relevo: 0.22, metal: 0, cor: new THREE.Color(...tom),
    fisico: { sheen: 0.6, sheenRoughness: 0.45, sheenColor: new THREE.Color(0.55, 0.22, 0.16), specularIntensity: 0.45 },
    sujeira: suja ? { cor: 0x2a1f16, y0: 0.05, y1: suja } : null,
  });
}

// partes do corpo só de alguns ossos (para fazer roupas "infladas" sobre o corpo)
const deOssos = (P, ossos) => P.filter((p) => ossos.includes(p[3]));

// ---------- Dâmaso, o Enferrujado ----------
export function criarDamaso({ variante = 'enferrujado', marcas = 312, passo = 0.0065 } = {}) {
  const P3 = new Perlin(41);
  const J = juntas({ altura: 1.84, ombros: 1.04 });
  const partes = partesCorpo(J, { forca: 1.1 });
  const matPele = materialPele();
  const roupas = [];
  // cueca de linho
  const baixo = sdfDePartes(deOssos(partes, ['raiz', 'coxaE', 'coxaD']));
  const yQ = J.quadrilE[1];
  roupas.push({
    sdf: (x, y, z) => {
      const dobras = 0.005 * P3.ruido(x * 28, y * 9, z * 28) + 0.0025 * Math.sin(Math.atan2(x, z) * 9 + y * 20);
      let d = baixo(x, y, z) - 0.02 + dobras;
      d = smax(d, y - (yQ + 0.125), 0.01);
      return smax(d, yQ - 0.155 - y, 0.012);
    },
    limites: { min: [-0.3, yQ - 0.2, -0.22], max: [0.3, yQ + 0.16, 0.22] },
    material: triplanar(linho(), { escala: 3, relevo: 0.8, metal: 0, sujeira: { cor: 0x3a2e22, y0: yQ - 0.18, y1: yQ + 0.02 } }),
    permitidos: ['raiz', 'coluna', 'coxaE', 'coxaD'],
  });
  // cinto
  const cintura = sdfDePartes(deOssos(partes, ['coluna', 'raiz']));
  roupas.push({
    sdf: (x, y, z) => smax(cintura(x, y, z) - 0.024, Math.abs(y - (yQ + 0.115)) - 0.022, 0.006),
    limites: { min: [-0.22, yQ + 0.07, -0.18], max: [0.22, yQ + 0.16, 0.2] }, passo: 0.004,
    material: triplanar(couro(), { escala: 5, relevo: 1, metal: 0 }), permitidos: ['raiz', 'coluna'],
  });
  // faixas nos antebraços
  const faixa = (l) => {
    const co = J['cotovelo' + l], pu = J['pulso' + l];
    const ab = cone(co, pu, 0.046, 0.029);
    const eixo = norm(sub(pu, co));
    const comp = Math.hypot(...sub(pu, co));
    return (x, y, z) => {
      const t = ((x - co[0]) * eixo[0] + (y - co[1]) * eixo[1] + (z - co[2]) * eixo[2]) / comp;
      const espiral = 0.0018 * Math.sin(t * 70 + Math.atan2(x - pu[0], z - pu[2]));
      return smax(ab(x, y, z) - 0.009 + espiral + 0.002 * P3.ruido(x * 60, y * 60, z * 60), Math.abs(t - 0.78) - 0.2, 0.004);
    };
  };
  if (variante !== 'dourado') {
    const fE = faixa('E'), fD = faixa('D');
    roupas.push({
      sdf: (x, y, z) => Math.min(fE(x, y, z), fD(x, y, z)),
      limites: { min: [-0.6, 0.85, -0.12], max: [0.6, 1.28, 0.16] }, passo: 0.004,
      material: triplanar(linho(), { escala: 4, relevo: 1, metal: 0, cor: 0xb8a890 }), permitidos: ['antebracoE', 'antebracoD'],
    });
  }
  const chave = `damaso-v2-${variante}-${passo}`;
  const b = criarBoneco({ J, partes, corpo: { material: matPele, passo, cache: chave }, roupas, nome: 'damaso' });
  // mãos
  const maos = {};
  for (const l of ['E', 'D']) {
    maos[l] = {};
    for (const tipo of ['aberta', 'segura', 'punho']) {
      const m = criarMao(J, l, tipo, matPele, { cache: `damaso-v2-${passo}` });
      m.visible = tipo === (l === 'D' ? 'segura' : 'aberta');
      b.prender('mao' + l, m);
      maos[l][tipo] = m;
    }
  }
  b.mao = (l, tipo) => { for (const t in maos[l]) maos[l][t].visible = t === tipo; };
  // capacete
  if (variante === 'enferrujado' || variante === 'dourado') {
    const cap = criarCapacete({ marcas, novo: variante === 'dourado' });
    cap.position.set(J.cabeca[0], J.cabeca[1] - 0.045, J.cabeca[2] - 0.005);
    b.prender('cabeca', cap);
    b.capacete = cap;
  }
  // espada na mão direita: o cabo atravessa a palma, a lâmina sai pelo lado do polegar
  const esp = criarEspada({ nova: variante === 'dourado' });
  const { d, n, z } = maos.D.segura.userData.eixos;
  const palma = add(J.pulsoD, d, 0.05);
  const cabo = add(palma, n, 0.03);
  esp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...z));
  esp.position.set(...add(cabo, z, 0.11));
  b.prender('maoD', esp);
  b.espada = esp;
  return b;
}

// ---------- fichas das pessoas ----------
import { criarPessoa } from '../../motor-hd/pessoa.js';
export const FICHAS = {
  tome: {
    nome: 'tome', versao: 3, altura: 1.8, forca: 1.0, gordura: 0.25, idade: 0.45, olhos: 0x3a2a1a,
    rosto: { nariz: 1.15, queixo: 1.1, semente: 11 },
    cabelo: { estilo: 'curto', cor: 0x3e2c1e, volume: 1.3 }, barba: { tamanho: 1.3, cor: 0x4a3424 },
    roupas: [
      { tipo: 'camisa', tecido: 'linho', cor: 0x9a8a70, manga: 'longa', barra: -0.2 },
      { tipo: 'calca', tecido: 'la', cor: 0x4a4038 },
      { tipo: 'botas', tecido: 'couro', cor: 0x8a6a50 },
      { tipo: 'avental', tecido: 'couro', cor: 0xa07a58 },
    ],
  },
};
export const pessoa = (n) => criarPessoa(FICHAS[n]);
