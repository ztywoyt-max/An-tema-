// Monta uma pessoa inteira a partir de uma ficha: corpo, roupas, cabeça (rosto, olhos, cabelo, barba,
// capuz), mãos trocáveis e a fala (a mandíbula mexe enquanto a pessoa fala).
import * as THREE from 'three';
import { juntas, partesCorpo, criarBoneco, OSSOS, add } from './boneco.js';
import { malha } from './sdf.js';
import { geoCache } from './cache.js';
import { triplanar } from './materiais.js';
import { pele, linho, couro, la, fios, pelo, aco } from './texturas.js';
import { criarMao } from './maos.js';
import { sdfRosto, sdfCabelo, sdfBarba, sdfCapuz, criarOlho, OLHOS, pesoMandibula } from './cabeca.js';
import * as R from './roupas.js';

const TEX = { linho, couro, la, pelo, aco };

export function materialPele(tom = [1, 1, 1], suja = 0) {
  return triplanar(pele(), {
    escala: 3.2, relevo: 0.22, metal: 0, cor: new THREE.Color(...tom),
    fisico: { sheen: 0.6, sheenRoughness: 0.45, sheenColor: new THREE.Color(0.55, 0.22, 0.16), specularIntensity: 0.45 },
    sujeira: suja ? { cor: 0x2a1f16, y0: 0.05, y1: suja } : null,
  });
}
const ESCALA = { linho: 4, la: 7, couro: 4, pelo: 5 };
export function materialTecido(tipo = 'linho', cor = 0xffffff, { escala = ESCALA[tipo] ?? 3, relevo = 0.9 } = {}) {
  if (tipo === 'aco') return triplanar(aco(), { escala: 2, relevo: 0.5, metal: 1, rugosidade: 1, cor });
  return triplanar(TEX[tipo](), { escala, relevo, metal: 0, cor });
}
const matCabelo = (cor) => triplanar(fios(), { escala: 9, relevo: 1.1, metal: 0, cor, rugosidade: 0.85, fisico: { sheen: 0.5, sheenRoughness: 0.35, sheenColor: new THREE.Color(cor).multiplyScalar(1.4) } });

/**
 * ficha: { nome, versao, altura, forca, gordura, mulher, crianca, idade, tomPele, suja,
 *   rosto: { nariz, queixo, gordo, semente }, olhos: cor, cabelo: { estilo, cor, volume } | null,
 *   barba: { tamanho, cor, bigode } | null, capuz: { tipo: 'pano'|'pele'|'lenco', cor, tecido } | null,
 *   roupas: [{ tipo: 'camisa'|'calca'|'botas'|'saia'|'avental'|'manto'|'couraca', tecido, cor, ...opções }] }
 */
export function criarPessoa(f) {
  const J = juntas({ altura: f.altura ?? 1.78, ombros: f.ombros ?? (f.mulher ? 0.9 : 1), quadril: f.quadril ?? (f.mulher ? 1.08 : 1), crianca: f.crianca ?? 0 });
  const opCorpo = { forca: f.forca ?? 0.8, gordura: f.gordura ?? 0.1, mulher: f.mulher ?? 0, crianca: f.crianca ?? 0 };
  const partes = partesCorpo(J, opCorpo);
  const matPele = materialPele(f.tomPele ?? [1, 1, 1], f.suja ?? 0);
  const chave = `${f.nome}-${f.versao ?? 1}`;
  const roupas = (f.roupas ?? []).map((r) => ({ ...R[r.tipo](partes, J, r), material: materialTecido(r.tecido ?? 'linho', r.cor ?? 0xffffff, r), passo: r.passo ?? 0.0065 }));
  const b = criarBoneco({ J, partes, corpo: { material: matPele, passo: f.passo ?? 0.0075, cache: `${chave}/b` }, roupas, nome: f.nome });

  // ---------- cabeça (presa ao esqueleto: cabeça + mandíbula) ----------
  const e = J.escCabeca, c = J.centroCabeca;
  const iCab = OSSOS.findIndex((o) => o[0] === 'cabeca'), iMan = OSSOS.findIndex((o) => o[0] === 'mandibula');
  const naCabeca = (sdfLocal, folga = 0.11, mand = true) => {
    const sdf = (x, y, z) => sdfLocal((x - c[0]) / e, (y - c[1]) / e, (z - c[2]) / e) * e;
    const R0 = 0.16 * e;
    const g = malha(sdf, { min: [c[0] - R0, c[1] - (0.2 + folga) * e, c[2] - R0 - 0.02], max: [c[0] + R0, c[1] + 0.13 * e, c[2] + R0], passo: 0.0024 * e, suavizar: 1 });
    const p = g.attributes.position, n = p.count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const wj = mand ? pesoMandibula((p.getX(i) - c[0]) / e, (p.getY(i) - c[1]) / e, (p.getZ(i) - c[2]) / e) : 0;
      si[i * 4] = iCab; si[i * 4 + 1] = iMan;
      sw[i * 4] = 1 - wj; sw[i * 4 + 1] = wj;
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    return g;
  };
  const pele2 = (g, mat) => {
    const m = new THREE.SkinnedMesh(g, mat);
    m.castShadow = m.receiveShadow = true;
    m.frustumCulled = false;
    b.raiz.add(m);
    m.bind(b.esqueleto, new THREE.Matrix4());
    b.malhas.push(m);
    return m;
  };
  if (f.rosto !== false) {
    const ro = { mulher: f.mulher ?? 0, crianca: f.crianca ?? 0, idade: f.idade ?? 0.3, ...(f.rosto ?? {}) };
    pele2(geoCache(`${chave}/rosto`, () => naCabeca(sdfRosto(ro))), matPele);
    for (const [x, y, z] of OLHOS) {
      const o = criarOlho(f.olhos ?? 0x4a3a28);
      o.position.set(c[0] + x * e, c[1] + y * e, c[2] + z * e);
      o.scale.setScalar(e);
      b.prender('cabeca', o);
    }
  }
  if (f.cabelo) pele2(geoCache(`${chave}/cabelo`, () => naCabeca(sdfCabelo(f.cabelo), 0.11, false)), matCabelo(f.cabelo.cor ?? 0x3a2a1c));
  if (f.barba) pele2(geoCache(`${chave}/barba`, () => naCabeca(sdfBarba(f.barba))), matCabelo(f.barba.cor ?? 0x3a2a1c));
  if (f.capuz) {
    const mat = f.capuz.tipo === 'pele' ? triplanar(pelo(), { escala: 5, relevo: 1.4, metal: 0, cor: f.capuz.cor ?? 0x8a6a4a }) : materialTecido(f.capuz.tecido ?? 'la', f.capuz.cor ?? 0x6a6a68);
    pele2(geoCache(`${chave}/capuz`, () => naCabeca(sdfCapuz({ lenco: f.capuz.tipo === 'lenco', folga: f.capuz.tipo === 'lenco' ? 0.014 : 0.028 }), 0.16, false)), mat);
  }

  // ---------- mãos ----------
  const maos = { E: {}, D: {} };
  for (const l of ['E', 'D']) {
    for (const tipo of f.maos ?? ['aberta', 'meia', 'segura']) {
      const m = criarMao(J, l, tipo, matPele, { cache: chave, mulher: f.mulher ?? 0 });
      m.visible = tipo === (f.maos?.[0] ?? 'aberta');
      b.prender('mao' + l, m);
      maos[l][tipo] = m;
    }
  }
  b.mao = (l, tipo) => { for (const t in maos[l]) maos[l][t].visible = t === tipo; };
  b.maos = maos;
  // fala: abre e fecha a boca enquanto o texto dura
  b.falar = (pose, t, intensidade = 1) => {
    const v = (Math.abs(Math.sin(t * 13.7)) * 0.6 + Math.abs(Math.sin(t * 7.3 + 1.1)) * 0.4) * 11 * intensidade;
    pose.mandibula = [v, 0, 0];
    return pose;
  };
  b.ficha = f;
  return b;
}
