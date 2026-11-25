// Personagens segmentados (peças rígidas encaixadas), como nos primeiros jogos de PS1.
// Um esqueleto só; roupa, pele, cabeça e acessórios mudam por personagem.
import * as THREE from 'three';
import { material } from './ps1.js';
import * as T from './texturas.js';

function cilindro(rTopo, rBase, comp, lados, mat, { sobe = false, escalaZ = 1, escalaX = 1 } = {}) {
  const g = new THREE.CylinderGeometry(rTopo, rBase, comp, lados, 1);
  g.rotateY(Math.PI); // u=0.5 (centro da textura) fica virado para a frente (+z)
  g.translate(0, sobe ? comp / 2 : -comp / 2, 0);
  if (escalaZ !== 1 || escalaX !== 1) g.scale(escalaX, 1, escalaZ);
  return new THREE.Mesh(g, mat);
}

// Tronco torneado: cintura, peito largo, ombros e trapézio descendo até o pescoço.
function tronco(alt, forte, mat) {
  const perfil = [[0.165, 0], [0.188, 0.12], [0.214, 0.26], [0.238, 0.37], [0.232, 0.42], [0.16, 0.465], [0.075, 0.5]];
  const pts = perfil.map(([r, y]) => new THREE.Vector2(r * forte, (y / 0.5) * alt));
  const g = new THREE.LatheGeometry(pts, 8);
  g.rotateY(Math.PI);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setY(i, pos.getY(i) / alt); // textura segue a altura real
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

/** Espada enferrujada. Origem no centro do cabo; lâmina ao longo de +y. */
export function espada({ comp = 0.86, semente = 61 } = {}) {
  const g = new THREE.Group();
  const lamina = new THREE.CylinderGeometry(0.012, 0.03, comp, 4, 1);
  lamina.rotateY(Math.PI / 4);
  lamina.scale(1, 1, 0.32);
  lamina.translate(0, 0.1 + comp / 2, 0);
  const ponta = new THREE.ConeGeometry(0.012, 0.06, 4, 1);
  ponta.rotateY(Math.PI / 4);
  ponta.scale(1, 1, 0.32);
  ponta.translate(0, 0.1 + comp + 0.03, 0);
  const mFerro = material({ mapa: T.ferrugem(semente, 'lamina'), repete: [1, 3] });
  g.add(new THREE.Mesh(lamina, mFerro), new THREE.Mesh(ponta, mFerro));
  const mGuarda = material({ mapa: T.ferrugem(semente + 1, 'guarda') });
  g.add(caixa(0.2, 0.025, 0.035, mGuarda, 0.09));
  const mCouro = material({ cor: 0x3a2618, mapa: T.pano([120, 90, 70], 63, 'couro') });
  g.add(cilindro(0.017, 0.017, 0.17, 6, mCouro, { sobe: false }).translateY(0.08));
  const pomo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.027, 0), mGuarda);
  pomo.position.y = -0.1;
  g.add(pomo);
  return g;
}

/**
 * Cria um personagem.
 * op.pele: tom (T.TONS.*); op.torso: textura do tronco; op.cueca: cor do pano;
 * op.cabeca: 'capacete' | Mesh/Group personalizado; op.marcas: riscos no capacete;
 * op.espada: true para levar a espada na mão direita; op.forte: largura (1 = normal).
 */
export function criarPersonagem(op = {}) {
  const tom = op.pele ?? T.TONS.curtido;
  const forte = op.forte ?? 1;
  const mPele = material({ mapa: T.pele(tom) });
  const mTorso = material({ mapa: op.torso ?? T.torsoNu(tom) });
  const corPano = op.cueca ?? [190, 176, 146];
  const mPano = material({ mapa: T.pano(corPano) });
  const mCoxa = material({ mapa: T.coxa(tom, corPano, 0.5) });

  const raiz = new THREE.Group();
  const j = {};
  const PE = 0.07, CANELA = 0.44, COXA = 0.44;
  const ALT_QUADRIL = PE + CANELA + COXA;

  j.quadril = grupo(raiz, 0, ALT_QUADRIL, 0);
  // pelve com a cueca de linho, um pouco folgada
  j.quadril.add(cilindro(0.17 * forte, 0.158 * forte, 0.21, 8, mPano, { sobe: true, escalaZ: 0.72 }).translateY(-0.13));
  // cordão amarrado na cintura
  const mCordao = material({ cor: 0x5a4632 });
  j.quadril.add(cilindro(0.172 * forte, 0.172 * forte, 0.025, 8, mCordao, { sobe: true, escalaZ: 0.74 }).translateY(0.06));

  for (const lado of ['E', 'D']) {
    const s = lado === 'E' ? 1 : -1;
    const perna = grupo(j.quadril, s * 0.092 * forte, -0.05, 0);
    perna.add(cilindro(0.088 * forte, 0.062, COXA, 7, mCoxa));
    const joelho = grupo(perna, 0, -COXA, 0);
    joelho.add(cilindro(0.062, 0.044, CANELA, 6, mPele));
    const tornozelo = grupo(joelho, 0, -CANELA, 0);
    tornozelo.add(caixa(0.095, PE, 0.23, mPele, -PE / 2, 0.055));
    j['perna' + lado] = perna;
    j['joelho' + lado] = joelho;
    j['tornozelo' + lado] = tornozelo;
  }

  const TRONCO = 0.48;
  j.tronco = grupo(j.quadril, 0, 0.07, 0);
  j.tronco.add(tronco(TRONCO, forte, mTorso));
  j.pescoco = grupo(j.tronco, 0, TRONCO, 0.0);
  j.pescoco.add(cilindro(0.062, 0.07, 0.09, 6, mPele, { sobe: true }));
  j.cabeca = grupo(j.pescoco, 0, 0.09, 0.01);

  if (op.cabeca === 'capacete' || op.cabeca === undefined) {
    const mElmo = material({ mapa: T.capacete(op.marcas ?? 299) });
    const mTopo = material({ mapa: T.ferrugem(71, 'topo-elmo') });
    // elmo fechado: corpo levemente cônico, mais largo embaixo, frente um pouco pontuda
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
    const elmo = new THREE.Mesh(g, [mElmo, mTopo, mTopo]);
    j.cabeca.add(elmo);
    // chapa do topo levemente abaulada
    const topo = new THREE.CylinderGeometry(0.07, 0.143, 0.04, 8, 1);
    topo.rotateY(Math.PI);
    topo.scale(1, 1, 1.08);
    topo.translate(0, 0.29, 0);
    j.cabeca.add(new THREE.Mesh(topo, mTopo));
    // faixas de reforço (testa e base), um pouco salientes
    for (const [y, h, r] of [[0.175, 0.022, 0.15], [-0.05, 0.03, 0.158]]) {
      const f = new THREE.CylinderGeometry(r, r, h, 8, 1, true);
      f.rotateY(Math.PI);
      f.scale(1, 1, 1.08);
      f.translate(0, y, 0);
      j.cabeca.add(new THREE.Mesh(f, mTopo));
    }
  } else if (op.cabeca) {
    j.cabeca.add(op.cabeca);
  }

  for (const lado of ['E', 'D']) {
    const s = lado === 'E' ? 1 : -1;
    const ombro = grupo(j.tronco, s * 0.245 * forte, TRONCO - 0.085, 0);
    const deltoide = new THREE.Mesh(new THREE.IcosahedronGeometry(0.072 * forte, 1), mPele);
    deltoide.scale.set(1, 1.1, 0.95);
    deltoide.position.set(s * 0.01, -0.03, 0);
    ombro.add(deltoide);
    ombro.add(cilindro(0.064 * forte, 0.052, 0.29, 6, mPele));
    const cotovelo = grupo(ombro, 0, -0.29, 0);
    cotovelo.add(cilindro(0.053, 0.039, 0.26, 6, mPele));
    const pulso = grupo(cotovelo, 0, -0.26, 0);
    pulso.add(caixa(0.07, 0.1, 0.04, mPele, -0.05));
    j['ombro' + lado] = ombro;
    j['cotovelo' + lado] = cotovelo;
    j['pulso' + lado] = pulso;
  }

  if (op.espada) {
    const e = espada();
    e.position.set(0, -0.06, 0.0);
    e.rotation.x = 2.45;
    j.pulsoD.add(e);
  }

  // sombra redonda no chão (o PS1 não tinha sombras de verdade)
  const sombra = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.85).rotateX(-Math.PI / 2),
    material({ mapa: T.sombra(), semLuz: true, transparente: true, depthWrite: false, corte: 0.01, cor: 0x000000 }),
  );
  sombra.position.y = 0.015;
  sombra.renderOrder = 1;
  raiz.add(sombra);

  const p = { raiz, j, ALT_QUADRIL, espada: op.espada ? j.pulsoD.children.at(-1) : null };
  poseBase(p);
  return p;
}

export function poseBase(p) {
  const { j } = p;
  for (const k of Object.keys(j)) if (j[k].isGroup) j[k].rotation.set(0, 0, 0);
  j.quadril.position.y = p.ALT_QUADRIL;
  j.ombroE.rotation.z = 0.1;
  j.ombroD.rotation.z = -0.1;
  j.cotoveloE.rotation.x = -0.12;
  j.cotoveloD.rotation.x = -0.18;
}

/**
 * Ciclo de caminhada. fase em radianos (2π = dois passos). peso: 0 leve .. 1 pesado.
 */
export function andar(p, fase, { amplitude = 1, peso = 0.6, bracoD = 0.35 } = {}) {
  poseBase(p);
  const { j } = p;
  const s = Math.sin(fase);
  for (const [lado, f] of [['E', fase], ['D', fase + Math.PI]]) {
    const sl = Math.sin(f), cl = Math.cos(f);
    const perna = -0.4 * amplitude * sl;
    const joelho = 0.07 + 0.62 * amplitude * Math.pow(Math.max(0, cl), 1.4);
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
  j.ombroE.rotation.x = 0.32 * amplitude * s;
  j.cotoveloE.rotation.x = -0.14 - 0.22 * Math.max(0, -s);
  j.ombroD.rotation.x = -0.32 * bracoD * amplitude * s;
  j.cotoveloD.rotation.x = -0.2;
}

/** Parado, respirando. */
export function parado(p, t) {
  poseBase(p);
  const { j } = p;
  const r = Math.sin(t * 1.4);
  j.tronco.rotation.x = 0.015 * r;
  j.ombroE.rotation.z = 0.1 + 0.015 * r;
  j.ombroD.rotation.z = -0.1 - 0.015 * r;
  j.cabeca.rotation.x = -0.01 * r;
}
