// Personagens segmentados (peças rígidas encaixadas), como nos primeiros jogos de PS1.
// Um esqueleto só; rosto, roupa, cabelo e acessórios mudam por personagem.
import * as THREE from 'three';
import { material, lerp } from './ps1.js';
import * as T from './texturas.js';
import * as R from './roupas.js';

function cilindro(rTopo, rBase, comp, lados, mat, { sobe = false, escalaZ = 1, escalaX = 1 } = {}) {
  const g = new THREE.CylinderGeometry(rTopo, rBase, comp, lados, 1);
  g.rotateY(Math.PI); // u=0.5 (centro da textura) fica virado para a frente (+z)
  g.translate(0, sobe ? comp / 2 : -comp / 2, 0);
  if (escalaZ !== 1 || escalaX !== 1) g.scale(escalaX, 1, escalaZ);
  return new THREE.Mesh(g, mat);
}

// Tronco torneado: cintura, peito, ombros e trapézio descendo até o pescoço.
function tronco(alt, forte, mat, feminino) {
  const perfil = feminino
    ? [[0.15, 0], [0.142, 0.12], [0.178, 0.26], [0.2, 0.37], [0.2, 0.42], [0.14, 0.465], [0.07, 0.5]]
    : [[0.165, 0], [0.188, 0.12], [0.214, 0.26], [0.238, 0.37], [0.232, 0.42], [0.16, 0.465], [0.075, 0.5]];
  const pts = perfil.map(([r, y]) => new THREE.Vector2(r * forte, (y / 0.5) * alt));
  const g = new THREE.LatheGeometry(pts, 8);
  g.rotateY(Math.PI);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setY(i, pos.getY(i) / alt);
  g.scale(1, 1, 0.6);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

function caixa(w, h, d, mat, dy = 0, dz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, dy, dz);
  return new THREE.Mesh(g, mat);
}

function grupo(pai, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  pai.add(g);
  return g;
}

function plano(w, h, mat) {
  const g = new THREE.PlaneGeometry(w, h, 1, 2);
  g.translate(0, -h / 2, 0);
  return new THREE.Mesh(g, mat);
}

// ---------------- objetos de mão ----------------

/** Espada. Origem no centro do cabo; lâmina ao longo de +y. */
export function espada({ comp = 0.86, semente = 61, polida = false, dourada = false } = {}) {
  const g = new THREE.Group();
  const lamina = new THREE.CylinderGeometry(0.012, 0.03, comp, 4, 1);
  lamina.rotateY(Math.PI / 4);
  lamina.scale(1, 1, 0.32);
  lamina.translate(0, 0.1 + comp / 2, 0);
  const ponta = new THREE.ConeGeometry(0.012, 0.06, 4, 1);
  ponta.rotateY(Math.PI / 4);
  ponta.scale(1, 1, 0.32);
  ponta.translate(0, 0.1 + comp + 0.03, 0);
  const mFerro = polida || dourada
    ? material({ mapa: R.metal(R.CORES.aco, semente), brilhoProprio: 0.08 })
    : material({ mapa: T.ferrugem(semente, 'lamina'), repete: [1, 3] });
  const mL = new THREE.Mesh(lamina, mFerro), mP = new THREE.Mesh(ponta, mFerro);
  g.add(mL, mP);
  const mGuarda = dourada
    ? material({ mapa: R.metal(R.CORES.ouro, semente + 3) })
    : polida ? material({ mapa: R.metal([110, 100, 90], semente + 2) }) : material({ mapa: T.ferrugem(semente + 1, 'guarda') });
  g.add(caixa(0.2, 0.025, 0.035, mGuarda, 0.09));
  const mCouro = material({ cor: 0x3a2618, mapa: T.pano([120, 90, 70], 63, 'couro') });
  g.add(cilindro(0.017, 0.017, 0.17, 6, mCouro).translateY(0.08));
  const pomo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.027, 0), mGuarda);
  pomo.position.y = -0.1;
  g.add(pomo);
  g.userData.lamina = [mL, mP];
  return g;
}

/** Arco curto. Origem na empunhadura; pontas ao longo de y; a corda fica atrás (-z) e pode ser puxada. */
export function arco() {
  const g = new THREE.Group();
  const m = material({ mapa: T.madeira(91, [92, 64, 40]) });
  const R0 = 0.5, ang = Math.PI * 0.62;
  const curva = new THREE.TorusGeometry(R0, 0.014, 3, 10, ang);
  curva.rotateZ(-ang / 2); // arco simétrico em torno de +x
  curva.rotateY(-Math.PI / 2); // agora a barriga aponta para +z
  curva.translate(0, 0, -R0); // empunhadura na origem
  g.add(new THREE.Mesh(curva, m));
  const meia = R0 * Math.sin(ang / 2);
  const zPontas = -R0 + R0 * Math.cos(ang / 2) - 0.0;
  const corda = new THREE.Mesh(new THREE.BoxGeometry(0.004, 1, 0.004), material({ cor: 0xbbb09a }));
  g.add(corda);
  // k: 0 = solta, 1 = puxada. A corda vira um "V" de dois segmentos.
  const c1 = corda, c2 = corda.clone();
  g.add(c2);
  g.userData.puxar = (k) => {
    const zMeio = zPontas - 0.3 * k;
    for (const [c, s] of [[c1, 1], [c2, -1]]) {
      const dy = meia, dz = zPontas - zMeio;
      const comp = Math.hypot(dy, dz);
      c.scale.y = comp;
      c.position.set(0, (s * meia) / 2, (zPontas + zMeio) / 2);
      c.rotation.x = s * Math.atan2(dz, dy);
    }
  };
  g.userData.puxar(0);
  g.userData.zCorda = (k) => zPontas - 0.3 * k;
  return g;
}

/** Flecha. Origem no meio; ponta em +z. */
export function flecha() {
  const g = new THREE.Group();
  const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.7, 4).rotateX(Math.PI / 2), material({ cor: 0x8a6a48 }));
  const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.06, 4).rotateX(Math.PI / 2).translate(0, 0, 0.38), material({ cor: 0x50504c }));
  const mPena = material({ cor: 0xd8d0c0, duplo: true });
  g.add(haste, ponta);
  for (const a of [0, Math.PI / 2]) {
    const pena = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.12).rotateX(Math.PI / 2).translate(0, 0, -0.3), mPena);
    pena.rotation.z = a;
    g.add(pena);
  }
  return g;
}

/** Tocha: cabo de madeira. userData.chama = ponta (local), onde a cena põe fogo e luz. */
export function tocha() {
  const g = new THREE.Group();
  g.add(cilindro(0.022, 0.017, 0.55, 5, material({ mapa: T.madeira(95, [70, 50, 34]) }), { sobe: true }).translateY(-0.12));
  g.add(cilindro(0.035, 0.03, 0.08, 6, material({ cor: 0x3a2a1a }), { sobe: true }).translateY(0.4));
  g.userData.chama = new THREE.Vector3(0, 0.55, 0);
  return g;
}

export function lanca() {
  const g = new THREE.Group();
  g.add(cilindro(0.016, 0.016, 2.0, 5, material({ mapa: T.madeira(97, [86, 62, 40]) }), { sobe: true }).translateY(-0.6));
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 4).translate(0, 1.51, 0), material({ mapa: R.metal(R.CORES.aco, 57) })));
  return g;
}

export function bengala() {
  const g = new THREE.Group();
  g.add(cilindro(0.015, 0.012, 0.95, 5, material({ mapa: T.madeira(99, [80, 58, 38]) })).translateY(0.08));
  return g;
}

/** Bebê embrulhado em pano. */
export function bebe() {
  const g = new THREE.Group();
  const corpo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), material({ mapa: R.panoCor([200, 190, 170], 33) }));
  corpo.scale.set(0.75, 0.7, 1.35);
  g.add(corpo);
  const cabeca = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 1), material({ mapa: T.pele(T.TONS.claro) }));
  cabeca.position.set(0, 0.02, 0.15);
  g.add(cabeca);
  return g;
}

// ---------------- cabeça ----------------

function cabecaCapacete(j, op) {
  const mElmo = material({ mapa: op.capaceteNovo ? T.capaceteNovo() : T.capacete(op.marcas ?? 299), brilhoProprio: op.capaceteNovo ? 0.06 : 0 });
  const mTopo = op.capaceteNovo ? material({ mapa: R.metal([200, 160, 76], 79), brilhoProprio: 0.06 }) : material({ mapa: T.ferrugem(71, 'topo-elmo') });
  const g = new THREE.CylinderGeometry(0.142, 0.152, 0.33, 8, 2);
  g.rotateY(Math.PI);
  g.translate(0, 0.105, 0);
  g.scale(1, 1, 1.08);
  const pg = g.attributes.position;
  for (let i = 0; i < pg.count; i++) {
    const z = pg.getZ(i), x = pg.getX(i);
    if (z > 0.1 && Math.abs(x) < 0.02) pg.setZ(i, z + 0.025); // quilha da frente
  }
  g.computeVertexNormals();
  const capacete = new THREE.Group();
  capacete.add(new THREE.Mesh(g, [mElmo, mTopo, mTopo]));
  const topo = new THREE.CylinderGeometry(0.07, 0.143, 0.04, 8, 1);
  topo.rotateY(Math.PI);
  topo.scale(1, 1, 1.08);
  topo.translate(0, 0.29, 0);
  capacete.add(new THREE.Mesh(topo, mTopo));
  for (const [y, h, r] of [[0.175, 0.022, 0.15], [-0.05, 0.03, 0.158]]) {
    const f = new THREE.CylinderGeometry(r, r, h, 8, 1, true);
    f.rotateY(Math.PI);
    f.scale(1, 1, 1.08);
    f.translate(0, y, 0);
    capacete.add(new THREE.Mesh(f, mTopo));
  }
  j.cabeca.add(capacete);
  return { capacete, mElmo };
}

function cabecaRosto(j, op, tom) {
  const ro = { tom, ...op.rosto };
  const cab = op.rosto.escala ?? 1;
  const texF = R.rosto({ ...ro, boca: 'fechada' });
  const texA = R.rosto({ ...ro, boca: 'aberta' });
  const mRosto = material({ mapa: texF });
  const careca = ro.cabelo === 'careca';
  const corCab = ro.corCabelo ?? [58, 42, 30];
  const mTopo = material({ mapa: careca ? T.pele(tom) : R.pelagem(corCab, 43) });
  const g = new THREE.CylinderGeometry(0.098 * cab, 0.088 * cab, 0.235 * cab, 8, 2);
  g.rotateY(Math.PI);
  g.translate(0, 0.112 * cab, 0);
  g.scale(1, 1, 1.1);
  const pg = g.attributes.position;
  for (let i = 0; i < pg.count; i++) if (pg.getY(i) < 0.01 * cab) pg.setX(i, pg.getX(i) * 0.9);
  g.computeVertexNormals();
  const cabeca = new THREE.Group();
  j.cabeca.add(cabeca);
  cabeca.add(new THREE.Mesh(g, [mRosto, mTopo, mRosto]));
  const mPele = material({ mapa: T.pele(tom) });
  const nariz = new THREE.Mesh(new THREE.BoxGeometry(0.022 * cab, 0.045 * cab, 0.03 * cab), mPele);
  nariz.position.set(0, 0.1 * cab, 0.105 * cab);
  nariz.rotation.x = -0.25;
  cabeca.add(nariz);
  const mCab = material({ mapa: R.pelagem(corCab, 45) });
  if (!careca && !op.chapeu) {
    const calota = new THREE.CylinderGeometry(0.075 * cab, 0.104 * cab, 0.07 * cab, 8, 1);
    calota.scale(1, 1, 1.12);
    calota.translate(0, 0.215 * cab, -0.006);
    cabeca.add(new THREE.Mesh(calota, mCab));
  }
  if (ro.cabelo === 'longo' && !op.chapeu) {
    const atras = new THREE.BoxGeometry(0.2 * cab, 0.3 * cab, 0.05 * cab);
    atras.translate(0, 0.08 * cab, -0.09 * cab);
    cabeca.add(new THREE.Mesh(atras, mCab));
  }
  if (ro.cabelo === 'coque' && !op.chapeu) {
    const coque = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05 * cab, 0), mCab);
    coque.position.set(0, 0.2 * cab, -0.1 * cab);
    cabeca.add(coque);
  }
  if (ro.barba === 'cheia') {
    const queixo = new THREE.Mesh(new THREE.BoxGeometry(0.12 * cab, 0.06 * cab, 0.05 * cab), material({ mapa: R.pelagem(ro.corBarba ?? corCab, 47) }));
    queixo.position.set(0, 0.0, 0.075 * cab);
    cabeca.add(queixo);
  }
  const corCh = op.corChapeu ?? [120, 100, 80];
  if (op.chapeu === 'lenco') {
    const mL = material({ mapa: R.panoCor(corCh, 35), duplo: true });
    const l = new THREE.CylinderGeometry(0.08 * cab, 0.108 * cab, 0.14 * cab, 8, 1, true, Math.PI * 0.18, Math.PI * 1.64);
    l.scale(1, 1, 1.15);
    l.translate(0, 0.19 * cab, -0.004);
    cabeca.add(new THREE.Mesh(l, mL));
    const t = new THREE.CircleGeometry(0.082 * cab, 8).rotateX(-Math.PI / 2);
    t.scale(1, 1, 1.15);
    t.translate(0, 0.26 * cab, 0);
    cabeca.add(new THREE.Mesh(t, mL));
  }
  if (op.chapeu === 'capuz') {
    const mC = material({ mapa: op.texChapeu ?? R.panoCor(corCh, 37), duplo: true });
    const c = new THREE.CylinderGeometry(0.125 * cab, 0.15 * cab, 0.3 * cab, 8, 1, true, Math.PI * 0.3, Math.PI * 1.4);
    c.scale(1, 1, 1.15);
    c.translate(0, 0.12 * cab, -0.01);
    cabeca.add(new THREE.Mesh(c, mC));
    const ponta = new THREE.ConeGeometry(0.125 * cab, 0.14 * cab, 8, 1);
    ponta.scale(1, 1, 1.15);
    ponta.translate(0, 0.34 * cab, -0.03);
    const mp = new THREE.Mesh(ponta, mC);
    mp.rotation.x = -0.25;
    cabeca.add(mp);
    const manto = new THREE.CylinderGeometry(0.14, 0.27, 0.16, 8, 1, true);
    manto.scale(1, 1, 0.75);
    manto.translate(0, -0.06, 0);
    j.pescoco.add(new THREE.Mesh(manto, mC));
  }
  if (op.chapeu === 'elmo') {
    const mM = material({ mapa: R.metal(op.corChapeu ?? R.CORES.aco, 53), brilhoProprio: 0.05 });
    const e = new THREE.CylinderGeometry(0.104 * cab, 0.106 * cab, 0.09 * cab, 8, 1, true);
    e.scale(1, 1, 1.12);
    e.translate(0, 0.19 * cab, 0);
    cabeca.add(new THREE.Mesh(e, mM));
    const cup = new THREE.ConeGeometry(0.106 * cab, 0.1 * cab, 8, 1);
    cup.scale(1, 1, 1.12);
    cup.translate(0, 0.285 * cab, 0);
    cabeca.add(new THREE.Mesh(cup, mM));
    const nasal = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.1 * cab, 0.012), mM);
    nasal.position.set(0, 0.14 * cab, 0.118 * cab);
    cabeca.add(nasal);
  }
  return { mRosto, texF, texA, cabecaMalha: cabeca };
}

// ---------------- personagem ----------------

/**
 * Cria um personagem.
 * pele, forte (largura), altura (escala total), feminino
 * rosto: { idade, cabelo, corCabelo, barba, corBarba, olhos, escala }  (sem rosto = capacete enferrujado)
 * chapeu: 'lenco' | 'capuz' | 'elmo', corChapeu
 * torso, braco, antebraco, pelve, coxa, canela, pe: texturas (padrão: pele nua e cueca de linho)
 * saia: { cor, comp }, capa: { cor, comp }, avental: cor, tabardo: cor
 * mao: { D: 'espada'|'espadaPolida'|'espadaDourada'|'tocha'|'lanca'|'bengala', E: 'arco' }, espada: true, bebe: true, marcas
 */
export function criarPersonagem(op = {}) {
  const tom = op.pele ?? T.TONS.curtido;
  const forte = op.forte ?? 1;
  const corPano = op.cueca ?? [190, 176, 146];
  const mPele = material({ mapa: T.pele(tom) });
  const mat = (tex, padrao) => (tex ? material({ mapa: tex }) : padrao);
  const mTorso = mat(op.torso, material({ mapa: T.torsoNu(tom) }));
  const mPelve = mat(op.pelve, material({ mapa: T.pano(corPano) }));
  const mCoxa = mat(op.coxa, material({ mapa: T.coxa(tom, corPano, 0.5) }));
  const mCanela = mat(op.canela, mPele);
  const mBraco = mat(op.braco, mPele);
  const mAnte = mat(op.antebraco, mPele);
  const mPe = mat(op.pe, mPele);

  const raiz = new THREE.Group();
  raiz.scale.setScalar(op.altura ?? 1);
  const j = {};
  const PE = 0.07, CANELA = 0.44, COXA = 0.44;
  const ALT_QUADRIL = PE + CANELA + COXA;

  j.quadril = grupo(raiz, 0, ALT_QUADRIL, 0);
  j.quadril.add(cilindro(0.17 * forte, 0.158 * forte, 0.21, 8, mPelve, { sobe: true, escalaZ: 0.72 }).translateY(-0.13));
  if (!op.torso) {
    const mCordao = material({ cor: 0x5a4632 });
    j.quadril.add(cilindro(0.172 * forte, 0.172 * forte, 0.025, 8, mCordao, { sobe: true, escalaZ: 0.74 }).translateY(0.06));
  }

  for (const lado of ['E', 'D']) {
    const s = lado === 'E' ? 1 : -1;
    const perna = grupo(j.quadril, s * 0.092 * forte, -0.05, 0);
    perna.add(cilindro(0.088 * forte, 0.062, COXA, 7, mCoxa));
    const joelho = grupo(perna, 0, -COXA, 0);
    joelho.add(cilindro(0.062, 0.044, CANELA, 6, mCanela));
    const tornozelo = grupo(joelho, 0, -CANELA, 0);
    tornozelo.add(caixa(0.095, PE, 0.23, mPe, -PE / 2, 0.055));
    j['perna' + lado] = perna;
    j['joelho' + lado] = joelho;
    j['tornozelo' + lado] = tornozelo;
  }

  const TRONCO = 0.48;
  j.tronco = grupo(j.quadril, 0, 0.07, 0);
  j.tronco.add(tronco(TRONCO, forte, mTorso, op.feminino));
  j.pescoco = grupo(j.tronco, 0, TRONCO, 0.0);
  j.pescoco.add(cilindro(0.058, 0.066, 0.09, 6, mPele, { sobe: true }));
  j.cabeca = grupo(j.pescoco, 0, 0.09, 0.01);

  const p = { raiz, j, ALT_QUADRIL, op };
  if (op.rosto) Object.assign(p, cabecaRosto(j, op, tom));
  else Object.assign(p, cabecaCapacete(j, op));

  for (const lado of ['E', 'D']) {
    const s = lado === 'E' ? 1 : -1;
    const fem = op.feminino ? 0.86 : 1;
    const ombro = grupo(j.tronco, s * (op.feminino ? 0.205 : 0.245) * forte, TRONCO - 0.085, 0);
    const deltoide = new THREE.Mesh(new THREE.IcosahedronGeometry(0.072 * forte * fem, 1), mBraco);
    deltoide.scale.set(1, 1.1, 0.95);
    deltoide.position.set(s * 0.01, -0.03, 0);
    ombro.add(deltoide);
    ombro.add(cilindro(0.064 * forte * fem, 0.052 * fem, 0.29, 6, mBraco));
    const cotovelo = grupo(ombro, 0, -0.29, 0);
    cotovelo.add(cilindro(0.053 * fem, 0.039 * fem, 0.26, 6, mAnte));
    const pulso = grupo(cotovelo, 0, -0.26, 0);
    pulso.add(caixa(0.07 * fem, 0.1, 0.04, op.maos ? material({ mapa: op.maos }) : mPele, -0.05));
    const mao = new THREE.Group();
    mao.position.set(0, -0.07, 0);
    pulso.add(mao);
    j['ombro' + lado] = ombro;
    j['cotovelo' + lado] = cotovelo;
    j['pulso' + lado] = pulso;
    p['mao' + lado] = mao;
  }

  // roupas extras
  if (op.saia) {
    const comp = op.saia.comp ?? 0.82;
    const g = new THREE.CylinderGeometry(0.165 * forte, 0.3 * forte, comp, 10, 2, true);
    g.rotateY(Math.PI);
    g.scale(1, 1, 0.8);
    g.translate(0, -comp / 2 + 0.06, 0);
    p.saia = new THREE.Mesh(g, material({ mapa: R.panoCor(op.saia.cor, 39, { barra: true }), duplo: true, repete: [3, 1] }));
    j.quadril.add(p.saia);
  }
  if (op.capa) {
    const m = material({ mapa: R.panoCor(op.capa.cor, 41, { barra: true }), duplo: true });
    p.capa = plano(0.56 * forte, op.capa.comp ?? 1.15, m);
    p.capa.position.set(0, TRONCO - 0.02, -0.15);
    p.capa.rotation.x = 0.1;
    j.tronco.add(p.capa);
  }
  if (op.avental) {
    const a = plano(0.3 * forte, 0.48, material({ mapa: R.panoCor(op.avental, 43, { sujeira: 0.5 }), duplo: true }));
    a.position.set(0, 0.04, 0.13 * forte);
    j.quadril.add(a);
    p.avental = a;
  }
  if (op.tabardo) {
    const m = material({ mapa: R.panoCor(op.tabardo, 45, { barra: true }), duplo: true });
    for (const z of [1, -1]) {
      const t = plano(0.3 * forte, 0.82, m);
      t.position.set(0, TRONCO - 0.06, z * 0.15 * forte);
      j.tronco.add(t);
    }
  }

  // objetos nas mãos
  const fabricas = {
    espada: () => espada(),
    espadaPolida: () => espada({ polida: true }),
    espadaDourada: () => espada({ dourada: true, semente: 65 }),
    tocha, lanca, bengala, arco,
  };
  for (const lado of ['D', 'E']) {
    const nome = op.mao?.[lado] ?? (lado === 'D' && op.espada ? 'espada' : null);
    if (!nome) continue;
    const obj = fabricas[nome]();
    if (nome.startsWith('espada')) obj.rotation.x = 2.45;
    else if (nome === 'tocha') obj.rotation.x = 1.25;
    else if (nome === 'lanca') obj.rotation.set(-0.15, 0, 0.05);
    else if (nome === 'arco') obj.rotation.set(Math.PI / 2, 0, 0);
    p['mao' + lado].add(obj);
    p[lado === 'D' ? 'objetoD' : 'objetoE'] = obj;
    if (nome.startsWith('espada')) p.espada = obj;
    if (nome === 'tocha') p.tocha = obj;
    if (nome === 'arco') p.arco = obj;
  }
  if (op.bebe) {
    p.bebe = bebe();
    p.bebe.position.set(0, 0.26, 0.17);
    p.bebe.rotation.set(0.2, 0.5, 0);
    j.tronco.add(p.bebe);
  }

  // sombra redonda no chão (o PS1 não tinha sombras de verdade)
  const sombra = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.85).rotateX(-Math.PI / 2),
    material({ mapa: T.sombra(), semLuz: true, transparente: true, depthWrite: false, corte: 0.01, cor: 0x000000 }),
  );
  sombra.position.y = 0.015;
  sombra.renderOrder = 1;
  raiz.add(sombra);
  p.sombra = sombra;

  // boca: abre e fecha num ritmo de sílabas enquanto fala
  p.falar = (t, ativo) => {
    if (!p.mRosto) return;
    const aberta = ativo && Math.sin(t * 23) + Math.sin(t * 14.7 + 1) > 0.2;
    p.mRosto.uniforms.uMapa.value = aberta ? p.texA : p.texF;
  };

  poseBase(p);
  return p;
}

// ---------------- poses ----------------
// Cada pose soma rotações [x, y, z] às juntas (e 'altura' ao quadril). Misture com peso 0..1.

export const POSES = {
  segurarBebe: { ombroE: [-0.45, 0, -0.32], cotoveloE: [-1.35, -0.3, 0], ombroD: [-0.45, 0, 0.32], cotoveloD: [-1.35, 0.3, 0] },
  sentado: { pernaE: [-1.45, 0, 0.06], joelhoE: [1.45, 0, 0], pernaD: [-1.45, 0, -0.06], joelhoD: [1.45, 0, 0], altura: -0.46 },
  redeas: { ombroE: [-0.75, 0, -0.1], cotoveloE: [-0.9, 0, 0], ombroD: [-0.75, 0, 0.1], cotoveloD: [-0.9, 0, 0] },
  arcoPronto: { ombroE: [-1.5, 0, -0.12], cotoveloE: [0.1, 0, 0], ombroD: [-1.5, 0, 0.4], cotoveloD: [-1.75, 0, 0], tronco: [0, 0.08, 0] },
  espadaBaixo: { ombroD: [-0.35, 0, 0.55], cotoveloD: [-0.15, 0, 0], tronco: [0.18, 0.35, 0] },
  soco: { ombroE: [-1.55, 0, -0.1], cotoveloE: [0.05, 0, 0], tronco: [0.12, -0.35, 0], ombroD: [0.2, 0, -0.1] },
  socoPreparo: { ombroE: [-0.6, 0, 0.1], cotoveloE: [-1.6, 0, 0], tronco: [0, 0.3, 0] },
  apontar: { ombroD: [-1.4, 0, 0.1], cotoveloD: [-0.1, 0, 0] },
  maosAoAlto: { ombroE: [-2.5, 0, 0.35], cotoveloE: [-0.5, 0, 0], ombroD: [-2.5, 0, -0.35], cotoveloD: [-0.5, 0, 0] },
  espadaAlto: { ombroD: [-2.7, 0, -0.25], cotoveloD: [-0.5, 0, 0], tronco: [-0.08, -0.2, 0] },
  espadaGolpe: { ombroD: [-0.9, 0.3, 0.35], cotoveloD: [-0.2, 0, 0], tronco: [0.25, 0.35, 0] },
  espadaGuarda: { ombroD: [-0.9, 0, 0.15], cotoveloD: [-0.9, 0, 0] },
  empurrar: { tronco: [0.4, 0, 0], ombroE: [-1.45, 0, -0.15], cotoveloE: [-0.35, 0, 0], ombroD: [-1.45, 0, 0.15], cotoveloD: [-0.35, 0, 0], pernaE: [-0.5, 0, 0], joelhoE: [0.5, 0, 0], pernaD: [0.45, 0, 0], joelhoD: [0.1, 0, 0], altura: -0.06 },
  maoNoPeito: { ombroD: [-0.55, 0, 0.55], cotoveloD: [-1.95, 0, 0] },
  puxarFlecha: { ombroD: [-0.25, 0, 0.3], cotoveloD: [-0.35, 0, 0] },
  olharBaixo: { cabeca: [0.55, 0, 0], tronco: [0.12, 0, 0] },
  ajoelhado: { pernaE: [-1.5, 0, 0], joelhoE: [1.55, 0, 0], pernaD: [0.05, 0, 0], joelhoD: [1.6, 0, 0], tornozeloD: [0.7, 0, 0], altura: -0.42 },
  caidoSentado: { pernaE: [-1.4, 0, 0.2], joelhoE: [0.4, 0, 0], pernaD: [-1.2, 0, -0.2], joelhoD: [0.8, 0, 0], tronco: [-0.5, 0, 0], ombroE: [0.6, 0, 0.4], ombroD: [0.6, 0, -0.4], altura: -0.72 },
  encolhido: { tronco: [0.35, 0, 0], cabeca: [0.3, 0, 0], ombroE: [-0.6, 0, -0.35], cotoveloE: [-1.5, 0, 0], ombroD: [-0.6, 0, 0.35], cotoveloD: [-1.5, 0, 0] },
  bracosAbertos: { ombroE: [0, 0, 0.6], ombroD: [0, 0, -0.6] },
  segurarCapacete: { ombroE: [-2.2, 0, -0.55], cotoveloE: [-1.7, 0, 0], ombroD: [-2.2, 0, 0.55], cotoveloD: [-1.7, 0, 0] },
  sentadoChao: { pernaE: [-1.45, 0, 0.15], joelhoE: [0.25, 0, 0], pernaD: [-1.45, 0, -0.15], joelhoD: [0.25, 0, 0], tornozeloE: [0.3, 0, 0], tornozeloD: [0.3, 0, 0], altura: -0.86, tronco: [-0.12, 0, 0] },
  carregar: { ombroE: [-0.95, 0, -0.28], cotoveloE: [-0.95, 0, 0], ombroD: [-0.95, 0, 0.28], cotoveloD: [-0.95, 0, 0], tronco: [-0.06, 0, 0] },
  riscar: { ombroD: [-2.0, 0, 0.75], cotoveloD: [-1.5, 0, 0], ombroE: [-2.3, 0, -0.55], cotoveloE: [-1.6, 0, 0], cabeca: [0.15, 0, 0] },
  martelarAlto: { ombroD: [-2.6, 0, 0.1], cotoveloD: [-0.5, 0, 0], ombroE: [-2.4, 0, -0.1], cotoveloE: [-0.5, 0, 0], tronco: [-0.1, 0, 0] },
  martelarBaixo: { ombroD: [-0.9, 0, 0.1], cotoveloD: [-0.2, 0, 0], ombroE: [-0.9, 0, -0.1], cotoveloE: [-0.2, 0, 0], tronco: [0.45, 0, 0], joelhoE: [0.3, 0, 0], joelhoD: [0.3, 0, 0], altura: -0.08 },
  recusar: { cabeca: [0, 0, 0] },
  oferecer: { ombroD: [-1.2, 0, 0.1], cotoveloD: [-0.4, 0, 0] },
  montado: { pernaE: [-1.25, 0, 0.55], joelhoE: [1.1, 0, 0], pernaD: [-1.25, 0, -0.55], joelhoD: [1.1, 0, 0], ombroE: [-0.5, 0, -0.1], cotoveloE: [-0.8, 0, 0], ombroD: [-0.4, 0, 0.15], cotoveloD: [-0.6, 0, 0], altura: -0.3 },
  arremessar: { ombroD: [-2.9, 0, -0.2], cotoveloD: [-0.6, 0, 0], tronco: [-0.15, 0.3, 0] },
  arremessarFim: { ombroD: [-1.0, 0, 0.2], cotoveloD: [-0.1, 0, 0], tronco: [0.3, -0.3, 0] },
  segurarFilho: { ombroE: [-0.7, 0, -0.35], cotoveloE: [-1.2, -0.3, 0], ombroD: [-0.7, 0, 0.35], cotoveloD: [-1.2, 0.3, 0] },
  abracarJoelhos: { pernaE: [-1.9, 0, 0.1], joelhoE: [2.2, 0, 0], pernaD: [-1.9, 0, -0.1], joelhoD: [2.2, 0, 0], tornozeloE: [-0.3, 0, 0], tornozeloD: [-0.3, 0, 0], altura: -0.84, tronco: [0.3, 0, 0], ombroE: [-0.95, 0, -0.25], cotoveloE: [-0.95, 0, 0], ombroD: [-0.95, 0, 0.25], cotoveloD: [-0.95, 0, 0] },
  darDeOmbros: { ombroE: [0, 0, -0.25], ombroD: [0, 0, 0.25], cotoveloE: [-0.6, 0, 0], cotoveloD: [-0.6, 0, 0], cabeca: [0, 0, 0.15] },
  agachar: { pernaE: [-1.3, 0, 0], joelhoE: [1.9, 0, 0], pernaD: [-0.6, 0, 0], joelhoD: [1.9, 0, 0], altura: -0.48, tronco: [0.4, 0, 0], ombroD: [-0.9, 0, 0.1] },
  bengala: { ombroD: [-0.25, 0, 0.12], cotoveloD: [-0.5, 0, 0], tronco: [0.2, 0, 0], cabeca: [-0.15, 0, 0] },
};

export function poseBase(p) {
  const { j } = p;
  for (const k of Object.keys(j)) j[k].rotation.set(0, 0, 0);
  j.quadril.position.set(0, p.ALT_QUADRIL, 0);
  j.ombroE.rotation.z = 0.1;
  j.ombroD.rotation.z = -0.1;
  j.cotoveloE.rotation.x = -0.12;
  j.cotoveloD.rotation.x = -0.18;
  if (p.bebe) aplicar(p, POSES.segurarBebe);
}

export function aplicar(p, pose, peso = 1) {
  const { j } = p;
  for (const [k, v] of Object.entries(pose)) {
    if (k === 'altura') {
      j.quadril.position.y += v * peso;
      continue;
    }
    if (!j[k]) continue;
    j[k].rotation.x += v[0] * peso;
    j[k].rotation.y += v[1] * peso;
    j[k].rotation.z += v[2] * peso;
  }
}

/** Ciclo de caminhada. fase em radianos (2π = dois passos). */
export function andar(p, fase, { amplitude = 1, peso = 0.6, bracoD = 0.35, bracos = true } = {}) {
  poseBase(p);
  const { j } = p;
  const s = Math.sin(fase);
  const amp = amplitude * (p.saia ? 0.6 : 1);
  for (const [lado, f] of [['E', fase], ['D', fase + Math.PI]]) {
    const sl = Math.sin(f), cl = Math.cos(f);
    const perna = -0.4 * amp * sl;
    const joelho = 0.07 + 0.62 * amp * Math.pow(Math.max(0, cl), 1.4);
    j['perna' + lado].rotation.x = perna;
    j['joelho' + lado].rotation.x = joelho;
    j['tornozelo' + lado].rotation.x = -(perna + joelho) * 0.55 + 0.1 * Math.max(0, -sl);
  }
  j.quadril.position.y = p.ALT_QUADRIL + 0.022 * (1 - Math.abs(s)) - 0.018 * peso;
  j.quadril.rotation.y = 0.07 * s;
  j.quadril.rotation.z = 0.025 * Math.cos(fase);
  j.tronco.rotation.y = -0.11 * s;
  j.tronco.rotation.x = 0.04 + 0.05 * peso;
  j.cabeca.rotation.x = -0.05 * peso;
  if (bracos && !p.bebe) {
    j.ombroE.rotation.x = 0.32 * amplitude * s;
    j.cotoveloE.rotation.x = -0.14 - 0.22 * Math.max(0, -s);
    j.ombroD.rotation.x = -0.32 * bracoD * amplitude * s;
    j.cotoveloD.rotation.x = -0.2;
  }
  if (p.capa) p.capa.rotation.x = 0.12 + 0.05 * amplitude + 0.03 * Math.sin(fase * 2);
}

/** Corrida: passos largos, braços dobrados, tronco inclinado. */
export function correr(p, fase, amplitude = 1) {
  andar(p, fase, { amplitude: 1.5 * amplitude, peso: 0, bracos: false });
  const { j } = p;
  const s = Math.sin(fase);
  j.tronco.rotation.x = 0.25 * amplitude;
  j.quadril.position.y += 0.03 * Math.abs(Math.cos(fase)) * amplitude;
  if (!p.bebe) {
    j.ombroE.rotation.x = 0.7 * s * amplitude;
    j.cotoveloE.rotation.x = -1.2 * amplitude;
    j.ombroD.rotation.x = -0.7 * s * amplitude;
    j.cotoveloD.rotation.x = -1.2 * amplitude;
  }
  if (p.capa) p.capa.rotation.x = 0.5 * amplitude;
}

/** Parado, respirando. */
export function parado(p, t) {
  poseBase(p);
  const { j } = p;
  const r = Math.sin(t * 1.4);
  j.tronco.rotation.x = 0.015 * r;
  if (!p.bebe) {
    j.ombroE.rotation.z = 0.1 + 0.015 * r;
    j.ombroD.rotation.z = -0.1 - 0.015 * r;
  }
  j.cabeca.rotation.x = -0.01 * r;
  if (p.capa) p.capa.rotation.x = 0.1 + 0.02 * Math.sin(t * 0.9);
}

/** Anda entre dois pontos [x, z] com fase de passo coerente (sem patinar). k: 0..1 */
export function caminhar(p, de, para, k, { passo = 1.44, amplitude = 1, peso = 0.6, bracoD = 0.35, correndo = false } = {}) {
  const dx = para[0] - de[0], dz = para[1] - de[1];
  const dist = Math.hypot(dx, dz);
  p.raiz.position.x = de[0] + dx * k;
  p.raiz.position.z = de[1] + dz * k;
  if (dist > 1e-4) p.raiz.rotation.y = Math.atan2(dx, dz);
  const fase = ((dist * k) / passo) * Math.PI * 2;
  if (correndo) correr(p, fase, amplitude);
  else andar(p, fase, { amplitude, peso, bracoD });
}
