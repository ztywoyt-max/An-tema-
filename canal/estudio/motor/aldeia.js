// Construções e objetos de aldeia medieval (Pedralva), no estilo PS1.
import * as THREE from 'three';
import { material } from './ps1.js';
import * as T from './texturas.js';

const caixa = (w, h, d, m, x = 0, y = 0, z = 0) => {
  const g = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(g, m);
  mesh.position.set(x, y, z);
  return mesh;
};

// triângulo da empena (parede de cima, entre o telhado)
function empena(larg, alt, m) {
  const s = new THREE.Shape();
  s.moveTo(-larg / 2, 0);
  s.lineTo(larg / 2, 0);
  s.lineTo(0, alt);
  s.lineTo(-larg / 2, 0);
  const g = new THREE.ShapeGeometry(s);
  const uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 2.5, pos.getY(i) / 2.5);
  return new THREE.Mesh(g, m);
}

/** Telhado de duas águas com cumeeira ao longo de x. */
function telhado(w, d, alt, m, beiral = 0.35) {
  const g = new THREE.Group();
  const meia = d / 2 + beiral;
  const comp = Math.hypot(meia, alt);
  const ang = Math.atan2(alt, meia);
  for (const s of [-1, 1]) {
    const placa = new THREE.Mesh(new THREE.BoxGeometry(w + beiral * 2, 0.14, comp), m);
    placa.position.set(0, alt / 2, (s * meia) / 2);
    placa.rotation.x = s * ang;
    g.add(placa);
  }
  return g;
}

/**
 * Casa de pedra com telhado de palha.
 * op: w, d, h, altTelhado, porta (true), janelas (n por lado), chamine (true), semente
 * userData.janelas: materiais das janelas (acender à noite); userData.chamine: ponto da fumaça (local)
 */
export function casa(op = {}) {
  const { w = 5, d = 4, h = 2.6, altTelhado = 1.8, semente = 1 } = op;
  const g = new THREE.Group();
  const mPar = material({ mapa: T.paredePedra(101 + (semente % 3)), repete: [w / 2.5, h / 2.5] });
  const mParLado = material({ mapa: T.paredePedra(101 + (semente % 3)), repete: [d / 2.5, h / 2.5] });
  const mPalha = material({ mapa: T.palha(103 + (semente % 2)), repete: [w / 3, 1.5] });
  const mMad = material({ mapa: T.madeira(31 + (semente % 4), [86, 62, 42]) });
  // paredes
  g.add(caixa(w, h, 0.3, mPar, 0, h / 2, d / 2 - 0.15), caixa(w, h, 0.3, mPar, 0, h / 2, -d / 2 + 0.15));
  g.add(caixa(0.3, h, d, mParLado, w / 2 - 0.15, h / 2, 0), caixa(0.3, h, d, mParLado, -w / 2 + 0.15, h / 2, 0));
  // empenas
  for (const s of [-1, 1]) {
    const e = empena(d, altTelhado, mParLado);
    e.rotation.y = (s * Math.PI) / 2;
    e.position.set(s * (w / 2), h, 0);
    g.add(e);
    const e2 = e.clone();
    e2.rotation.y = (-s * Math.PI) / 2;
    e2.position.x = s * (w / 2 - 0.3);
    g.add(e2);
  }
  // telhado
  const tel = telhado(w, d, altTelhado, mPalha);
  tel.position.y = h - 0.05;
  g.add(tel);
  // porta na frente (+z)
  const janelas = [];
  if (op.porta !== false) {
    const porta = caixa(1.1, 1.9, 0.08, mMad, op.portaX ?? -w * 0.2, 0.95, d / 2 + 0.01);
    g.add(porta);
    g.userData.porta = porta;
    g.add(caixa(1.3, 0.14, 0.12, mMad, porta.position.x, 1.95, d / 2 + 0.02));
  }
  const nj = op.janelas ?? 1;
  for (let i = 0; i < nj; i++) {
    const mJ = material({ cor: 0x1a120c, emissivo: 0x000000 });
    const x = (op.portaX ?? -w * 0.2) + 1.6 + i * 1.5;
    if (x > w / 2 - 0.6) break;
    const j = caixa(0.7, 0.6, 0.06, mJ, x, 1.55, d / 2 + 0.01);
    g.add(j);
    g.add(caixa(0.06, 0.62, 0.08, mMad, x, 1.55, d / 2 + 0.03));
    g.add(caixa(0.76, 0.06, 0.08, mMad, x, 1.88, d / 2 + 0.03), caixa(0.76, 0.06, 0.08, mMad, x, 1.22, d / 2 + 0.03));
    janelas.push(mJ);
  }
  g.userData.janelas = janelas;
  if (op.chamine !== false) {
    const cx = w * 0.3;
    g.add(caixa(0.55, altTelhado + 1.1, 0.55, mParLado, cx, h + altTelhado * 0.5, -d * 0.12));
    g.userData.chamine = new THREE.Vector3(cx, h + altTelhado + 0.65, -d * 0.12);
  }
  return g;
}

/** Celeiro de madeira com portão grande. */
export function celeiro(op = {}) {
  const { w = 6, d = 5, h = 3.2, altTelhado = 2.2 } = op;
  const g = new THREE.Group();
  const mTab = material({ mapa: T.madeira(41, [104, 74, 50]), repete: [w / 2, h / 2.5] });
  const mTabL = material({ mapa: T.madeira(41, [104, 74, 50]), repete: [d / 2, h / 2.5] });
  const mTel = material({ mapa: T.madeira(43, [80, 60, 44]), repete: [w / 1.5, 2] });
  const mEsc = material({ mapa: T.madeira(45, [62, 44, 32]) });
  // frente com vão do portão
  const vao = 2.4;
  const lado = (w - vao) / 2;
  g.add(caixa(lado, h, 0.15, mTab, -w / 2 + lado / 2, h / 2, d / 2), caixa(lado, h, 0.15, mTab, w / 2 - lado / 2, h / 2, d / 2));
  g.add(caixa(vao, 0.5, 0.15, mTab, 0, h - 0.25, d / 2));
  g.add(caixa(w, h, 0.15, mTab, 0, h / 2, -d / 2));
  g.add(caixa(0.15, h, d, mTabL, w / 2, h / 2, 0), caixa(0.15, h, d, mTabL, -w / 2, h / 2, 0));
  for (const s of [-1, 1]) {
    const e = empena(d, altTelhado, mTabL);
    e.rotation.y = (s * Math.PI) / 2;
    e.position.set(s * (w / 2), h, 0);
    g.add(e);
    const e2 = e.clone();
    e2.rotation.y = (-s * Math.PI) / 2;
    g.add(e2);
  }
  const tel = telhado(w, d, altTelhado, mTel, 0.3);
  tel.position.y = h - 0.05;
  g.add(tel);
  // portas abertas (folhas)
  const folhas = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Group();
    f.position.set(s * (vao / 2), 0, d / 2);
    const p = caixa(vao / 2, h - 0.55, 0.08, mEsc, -s * (vao / 4), (h - 0.55) / 2, 0);
    f.add(p);
    f.rotation.y = s * 1.9;
    g.add(f);
    folhas.push(f);
  }
  g.userData.folhas = folhas;
  // chão de terra dentro
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.2, d - 0.2).rotateX(-Math.PI / 2), material({ mapa: T.feno(), repete: [3, 3] }));
  chao.position.y = 0.02;
  g.add(chao);
  return g;
}

/** Moinho de pedra com roda d'água (userData.roda gira). Roda em +x. */
export function moinho() {
  const g = new THREE.Group();
  const mPar = material({ mapa: T.paredePedra(105), repete: [2, 3] });
  const torre = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.1, 6, 8, 2), mPar);
  torre.position.y = 3;
  g.add(torre);
  const tel = new THREE.Mesh(new THREE.ConeGeometry(2.4, 2.2, 8, 1), material({ mapa: T.palha(), repete: [3, 1] }));
  tel.position.y = 7.1;
  g.add(tel);
  g.add(caixa(1.1, 2, 0.1, material({ mapa: T.madeira(47, [80, 58, 40]) }), 0, 1, 2.08));
  const roda = new THREE.Group();
  roda.position.set(2.5, 1.6, 0);
  const mRoda = material({ mapa: T.madeira(49, [92, 68, 46]) });
  for (const z of [-0.45, 0.45]) {
    const aro = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.08, 4, 14), mRoda);
    aro.position.z = z;
    roda.add(aro);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const pa = caixa(0.6, 0.06, 0.95, mRoda, Math.cos(a) * 1.65, Math.sin(a) * 1.65, 0);
    pa.rotation.z = a;
    roda.add(pa);
    const raio = caixa(1.7, 0.07, 0.07, mRoda, Math.cos(a) * 0.85, Math.sin(a) * 0.85, 0);
    raio.rotation.z = a;
    roda.add(raio);
  }
  roda.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.4, 6).rotateX(Math.PI / 2), mRoda));
  roda.rotation.y = Math.PI / 2;
  const eixo = new THREE.Group();
  eixo.add(roda);
  g.add(eixo);
  g.userData.roda = roda;
  return g;
}

/** Ponte de tábuas ao longo de z. */
export function ponte(comp = 9, larg = 2.8, alt = 0.9) {
  const g = new THREE.Group();
  const mTab = material({ mapa: T.madeira(51, [96, 72, 50]), repete: [1, comp / 2] });
  const mPost = material({ mapa: T.madeira(53, [70, 52, 36]) });
  const piso = new THREE.Mesh(new THREE.BoxGeometry(larg, 0.12, comp), mTab);
  piso.position.y = alt;
  g.add(piso);
  for (const s of [-1, 1]) {
    for (let z = -comp / 2 + 0.3; z <= comp / 2 - 0.2; z += 1.5) {
      g.add(caixa(0.14, 1.0, 0.14, mPost, (s * larg) / 2, alt + 0.5, z));
      g.add(caixa(0.18, alt + 1.2, 0.18, mPost, (s * (larg / 2 - 0.2)), (alt - 1.2) / 2, z));
    }
    g.add(caixa(0.1, 0.1, comp, mPost, (s * larg) / 2, alt + 0.95, 0));
    g.add(caixa(0.08, 0.08, comp, mPost, (s * larg) / 2, alt + 0.5, 0));
  }
  g.userData.altura = alt + 0.06;
  return g;
}

/** Rio ao longo de x: água com correnteza (atualizar(t) move a textura). */
export function rio(comp = 120, larg = 7, z = 0) {
  const m = material({ mapa: T.agua(), repete: [comp / 5, larg / 5], brilhoProprio: 0.05, cor: 0xb8c8d0 });
  const g = new THREE.PlaneGeometry(comp, larg, 40, 4).rotateX(-Math.PI / 2);
  const agua = new THREE.Mesh(g, m);
  agua.position.set(0, -0.35, z);
  const atualizar = (t) => m.uniforms.uDesloc.value.set(t * 0.12, Math.sin(t * 0.4) * 0.02);
  return { malha: agua, atualizar, material: m };
}

export function cerca(comp = 6, semente = 55) {
  const g = new THREE.Group();
  const m = material({ mapa: T.madeira(semente, [100, 76, 52]) });
  for (let x = -comp / 2; x <= comp / 2 + 0.01; x += 1.5) g.add(caixa(0.12, 1.1, 0.12, m, x, 0.55, 0));
  for (const y of [0.45, 0.85]) g.add(caixa(comp + 0.2, 0.08, 0.06, m, 0, y, 0));
  return g;
}

export function barril() {
  const m = material({ mapa: T.madeira(57, [110, 80, 52]), repete: [3, 1] });
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 8, 2), m);
  const p = b.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i)) < 0.1) { p.setX(i, p.getX(i) * 1.15); p.setZ(i, p.getZ(i) * 1.15); }
  b.geometry.computeVertexNormals();
  b.position.y = 0.4;
  const g = new THREE.Group();
  g.add(b);
  const mAro = material({ cor: 0x3a3634 });
  for (const y of [0.15, 0.65]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.04, 8, 1, true), mAro).translateY(y));
  return g;
}

export function poco() {
  const g = new THREE.Group();
  const m = material({ mapa: T.paredePedra(107), repete: [2, 0.5] });
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.85, 0.8, 10, 1, true), material({ mapa: T.paredePedra(107), repete: [2, 0.5], duplo: true })).translateY(0.4));
  const agua = new THREE.Mesh(new THREE.CircleGeometry(0.75, 10).rotateX(-Math.PI / 2), material({ cor: 0x0a1418 }));
  agua.position.y = 0.3;
  g.add(agua);
  const mMad = material({ mapa: T.madeira(59, [90, 66, 44]) });
  for (const s of [-1, 1]) g.add(caixa(0.1, 1.6, 0.1, mMad, s * 0.8, 1.2, 0));
  g.add(caixa(1.8, 0.1, 0.1, mMad, 0, 1.95, 0));
  const tel = telhado(1.9, 1.2, 0.5, material({ mapa: T.madeira(61, [74, 56, 40]) }), 0.1);
  tel.position.y = 1.95;
  g.add(tel);
  return g;
}

export function mesa() {
  const g = new THREE.Group();
  const m = material({ mapa: T.madeira(63, [112, 84, 58]) });
  g.add(caixa(1.8, 0.08, 0.8, m, 0, 0.78, 0));
  for (const [x, z] of [[-0.8, -0.32], [0.8, -0.32], [-0.8, 0.32], [0.8, 0.32]]) g.add(caixa(0.08, 0.78, 0.08, m, x, 0.39, z));
  return g;
}

export function banco(comp = 1.6) {
  const g = new THREE.Group();
  const m = material({ mapa: T.madeira(65, [100, 74, 50]) });
  g.add(caixa(comp, 0.07, 0.3, m, 0, 0.45, 0));
  for (const x of [-comp / 2 + 0.15, comp / 2 - 0.15]) g.add(caixa(0.07, 0.45, 0.26, m, x, 0.22, 0));
  return g;
}

export function monteFeno(escala = 1) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 * escala, 1), material({ mapa: T.feno(), repete: [2, 2] }));
  m.scale.set(1.2, 0.7, 1);
  m.position.y = 0.45 * escala;
  return m;
}

export function fardo() {
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.6), material({ mapa: T.feno(), repete: [2, 1] }));
  m.position.y = 0.25;
  return m;
}

/** Galinha simples; atualizar(t) bica o chão. */
export function galinha(semente = 1) {
  const g = new THREE.Group();
  const mB = material({ cor: semente % 2 ? 0xe8e0d0 : 0x8a5a34 });
  const corpo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), mB);
  corpo.scale.set(0.8, 0.8, 1.2);
  corpo.position.y = 0.2;
  g.add(corpo);
  const cab = new THREE.Group();
  cab.position.set(0, 0.3, 0.12);
  cab.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mB));
  const bico = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 4).rotateX(Math.PI / 2), material({ cor: 0xd09030 }));
  bico.position.z = 0.07;
  cab.add(bico);
  const crista = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.05, 0.05), material({ cor: 0xb02020 }));
  crista.position.y = 0.06;
  cab.add(crista);
  g.add(cab);
  for (const s of [-1, 1]) g.add(caixa(0.015, 0.1, 0.015, material({ cor: 0xd09030 }), s * 0.04, 0.05, 0));
  g.userData.atualizar = (t) => {
    const b = Math.max(0, Math.sin(t * 2.3 + semente * 3) - 0.6) * 2;
    cab.rotation.x = b * 1.2;
    cab.position.y = 0.3 - b * 0.12;
  };
  return g;
}

/** Fumaça de chaminé: sprites subindo em laço. */
export function fumaca(cor = 0x9a9a9a, escala = 1) {
  const g = new THREE.Group();
  const ps = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.SpriteMaterial({ map: T.fumaca(), color: cor, transparent: true, depthWrite: false, fog: false });
    const s = new THREE.Sprite(m);
    g.add(s);
    ps.push(s);
  }
  const atualizar = (t, vento = 0.6) => {
    ps.forEach((s, i) => {
      const f = (t * 0.18 + i / ps.length) % 1;
      s.position.set(f * vento * 2.2 * escala + Math.sin(t + i) * 0.1, f * 3.2 * escala, 0);
      const tam = (0.5 + f * 1.8) * escala;
      s.scale.set(tam, tam, 1);
      s.material.opacity = 0.45 * Math.sin(f * Math.PI) * (1 - f * 0.5);
    });
  };
  atualizar(0);
  return { grupo: g, atualizar };
}

/** Colinas ao redor (anel de montes baixos ao longe). */
export function colinas(raio = 70, semente = 7) {
  const alea = T.aleatorio(semente);
  const g = new THREE.Group();
  const m = material({ mapa: T.grama(19), repete: [6, 3] });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + alea() * 0.2;
    const r = raio * (0.85 + alea() * 0.3);
    const monte = new THREE.Mesh(new THREE.ConeGeometry(14 + alea() * 12, 8 + alea() * 12, 7, 2), m);
    monte.position.set(Math.cos(a) * r, -1, Math.sin(a) * r);
    monte.scale.z = 0.7 + alea() * 0.5;
    g.add(monte);
  }
  return g;
}

/** Cúpula do céu com nuvens. cores(topo, horizonte) muda o clima; seguir(camera) a centraliza. */
export function ceu() {
  const geo = new THREE.SphereGeometry(180, 16, 10);
  const cores = new Float32Array(geo.attributes.position.count * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(cores, 3));
  const m = material({ mapa: T.nuvens(), repete: [3, 1.5], semLuz: true, nevoa: false, duplo: true, coresVertice: true, prender: false });
  m.depthWrite = false;
  const malha = new THREE.Mesh(geo, m);
  malha.renderOrder = -10;
  const topo = new THREE.Color(), hor = new THREE.Color(), tmp = new THREE.Color();
  const pos = geo.attributes.position;
  malha.userData.cores = (cTopo, cHorizonte) => {
    topo.set(cTopo);
    hor.set(cHorizonte);
    for (let i = 0; i < pos.count; i++) {
      const h = Math.max(0, pos.getY(i) / 180);
      tmp.copy(hor).lerp(topo, Math.pow(h, 0.55));
      cores[i * 3] = tmp.r;
      cores[i * 3 + 1] = tmp.g;
      cores[i * 3 + 2] = tmp.b;
    }
    geo.attributes.color.needsUpdate = true;
  };
  malha.userData.seguir = (cam) => malha.position.copy(cam.position);
  malha.userData.cores(0x8090a0, 0xa0a8b0);
  return malha;
}
