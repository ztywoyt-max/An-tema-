// Set: salão do castelo do Barão Malvar (flashback, Capítulo III).
// Sala ao longo de z; janela alta na parede +x com um feixe de sol; trono no fundo (-z).
import * as THREE from 'three';
import * as A from '../motor/aldeia.js';
import * as O from '../motor/objetos.js';
import * as T from '../motor/texturas.js';
import { material, luzes, ruido1 } from '../motor/ps1.js';
import { parado } from '../motor/personagem.js';
import { figurinos } from '../filmes/cavaleiro/elenco3d.js';

export default function castelo() {
  const cena = new THREE.Scene();
  const W = 10, D = 18, H = 7;
  const mChao = material({ mapa: T.paredePedra(117, [96, 90, 84]), repete: [W / 2, D / 2] });
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(W, D, 10, 18).rotateX(-Math.PI / 2), mChao);
  cena.add(chao);
  const mPar = material({ mapa: T.paredePedra(119, [104, 98, 92]), repete: [D / 3, H / 3] });
  const mParF = material({ mapa: T.paredePedra(119, [104, 98, 92]), repete: [W / 3, H / 3] });
  const parede = (w, h, m, x, z, rot) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h, Math.ceil(w), Math.ceil(h)), m);
    p.position.set(x, h / 2, z);
    p.rotation.y = rot;
    cena.add(p);
    return p;
  };
  parede(D, H, mPar, -W / 2, 0, Math.PI / 2);
  // parede da janela (+x) em pedaços, deixando a janela aberta
  const jz = 1.5, jw = 1.6, jy0 = 2.4, jy1 = 5.6;
  const pedaco = (w, h, z, y) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h, Math.ceil(w), Math.ceil(h)), material({ mapa: T.paredePedra(119, [104, 98, 92]), repete: [w / 3, h / 3] }));
    p.position.set(W / 2, y, z);
    p.rotation.y = -Math.PI / 2;
    cena.add(p);
  };
  pedaco(D / 2 + jz - jw / 2, H, (-D / 2 + jz - jw / 2) / 2, H / 2);
  pedaco(D / 2 - jz - jw / 2, H, (D / 2 + jz + jw / 2) / 2, H / 2);
  pedaco(jw, jy0, jz, jy0 / 2);
  pedaco(jw, H - jy1, jz, (H + jy1) / 2);
  parede(W, H, mParF, 0, -D / 2, 0);
  parede(W, H, mParF, 0, D / 2, Math.PI);
  const teto = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(Math.PI / 2), material({ mapa: T.madeira(69, [60, 44, 32]), repete: [4, 8] }));
  teto.position.y = H;
  cena.add(teto);
  // céu claro do lado de fora da janela
  const fora = new THREE.Mesh(new THREE.PlaneGeometry(4, 5), material({ cor: 0xfff0d0, semLuz: true, nevoa: false }));
  fora.position.set(W / 2 + 0.6, 4, jz);
  fora.rotation.y = -Math.PI / 2;
  cena.add(fora);
  // feixe de sol (aditivo) entrando pela janela e descendo até o chão
  const feixeTex = T.textura('feixe', 8, 32, (px, ler, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const bx = Math.sin(((x + 0.5) / w) * Math.PI);
        const v = 255 * bx * (0.25 + 0.75 * (1 - y / h));
        px(x, y, [v, v * 0.9, v * 0.7, 255]);
      }
  }, { prender: true });
  const feixe = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 7.5), material({ mapa: feixeTex, semLuz: true, aditivo: true, duplo: true, opacidade: 0.35, nevoa: false, corte: 0 }));
  feixe.position.set(W / 2 - 2.6, 2.6, jz);
  feixe.rotation.set(0, 0, -0.95);
  cena.add(feixe);
  const feixe2 = feixe.clone();
  feixe2.rotation.y = Math.PI / 2;
  cena.add(feixe2);
  // colunas
  for (const z of [-6, -2, 2, 6]) for (const x of [-W / 2 + 1, W / 2 - 1]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, H, 8), material({ mapa: T.paredePedra(121), repete: [2, 3] }));
    c.position.set(x, H / 2, z);
    cena.add(c);
  }
  // estandartes nas paredes
  const bandeiras = [];
  for (const z of [-4, 0, 4]) {
    const e = A.estandarte([112, 30, 36], 5.5);
    e.position.set(-W / 2 + 0.2, 0, z);
    e.rotation.y = Math.PI / 2;
    cena.add(e);
    bandeiras.push(e);
  }
  // trono, tapete e mesa
  const mMad = material({ mapa: T.madeira(71, [90, 60, 40]) });
  const trono = new THREE.Group();
  trono.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.0).translate(0, 0.25, 0), mMad));
  trono.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.15).translate(0, 1.1, -0.45), mMad));
  trono.add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.05).translate(0, 1.4, -0.36), material({ cor: 0x6a1a20 })));
  trono.position.set(0, 0.3, -D / 2 + 1.3);
  cena.add(trono);
  const degrau = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 2), material({ mapa: T.paredePedra(123), repete: [1, 1] }));
  degrau.position.set(0, 0.15, -D / 2 + 1.3);
  cena.add(degrau);
  const tapete = new THREE.Mesh(new THREE.PlaneGeometry(2.2, D - 3).rotateX(-Math.PI / 2), material({ cor: 0x5a1a1e }));
  tapete.position.set(0, 0.015, 1.2);
  cena.add(tapete);
  const mesa = A.mesa();
  mesa.position.set(-2.8, 0, -3);
  mesa.rotation.y = Math.PI / 2;
  cena.add(mesa);
  // velas em candelabros
  const chamas = [];
  for (const [x, z] of [[-3.8, -6.5], [3.8, -6.5], [-2.8, -3.6]]) {
    const pe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.12, x === -2.8 ? 0.2 : 1.6, 6), material({ cor: 0x3a3230 }));
    const y0 = x === -2.8 ? 0.82 : 0;
    pe.position.set(x, y0 + (x === -2.8 ? 0.1 : 0.8), z);
    cena.add(pe);
    const f = O.fogo(0.07, 0xffb040);
    f.grupo.position.set(x, y0 + (x === -2.8 ? 0.28 : 1.7), z);
    cena.add(f.grupo);
    chamas.push(f);
  }

  const damaso = figurinos.damaso();
  const malvar = figurinos.malvarJovem();
  const guardas = [0, 1].map((i) => figurinos.soldado({ semente: 30 + i, arma: 'lanca' }));
  cena.add(damaso.raiz, malvar.raiz, ...guardas.map((g) => g.raiz));

  const c = {
    cena, feixe, chamas, damaso, malvar, guardas,
    vozes: { malvar },
    estado: {},
  };
  c.pos = (ator, x, z, rotY) => {
    ator.raiz.position.set(x, 0, z);
    if (rotY !== undefined) ator.raiz.rotation.set(0, rotY, 0);
  };
  c.virarPara = (ator, x, z) => {
    const r = ator.raiz;
    r.rotation.set(0, Math.atan2(x - r.position.x, z - r.position.z), 0);
  };
  c.mundo = (obj, local = [0, 0, 0]) => {
    cena.updateMatrixWorld(true);
    return obj.localToWorld(new THREE.Vector3(...local));
  };
  c.cabecaDe = (ator, dy = 0.12) => c.mundo(ator.j.cabeca, [0, dy, 0]);
  c.preparar = (t) => {
    c.pos(malvar, 3.6, jz, Math.PI / 2); // à janela, de costas
    c.pos(damaso, 0, 4.5, Math.PI);
    c.pos(guardas[0], -1.8, -6.5, 0);
    c.pos(guardas[1], 1.8, -6.5, 0);
    for (const p of [malvar, damaso, ...guardas]) parado(p, t + p.raiz.id);
  };
  c.atualizar = (t) => {
    bandeiras.forEach((b) => b.userData.atualizar(t * 0.3));
    chamas.forEach((f, i) => f.atualizar(t, i));
  };
  c.luz = (t) => {
    luzes.nevoa(0x2a2420, 10, 40);
    luzes.ambiente(0x6a5a50, 0x201a16);
    luzes.direcional([-0.75, -0.55, 0.05], 0xffe0a8, 1.1);
    const pts = chamas.map((f, i) => ({ pos: f.grupo.position, cor: 0xffa848, intensidade: 0.8 * (0.85 + 0.3 * ruido1(t * 6, i)), alcance: 4.5 }));
    pts.push({ pos: [W / 2 - 3.5, 0.5, jz], cor: 0xffd89a, intensidade: 1.0, alcance: 5 }); // luz rebatida do feixe no chão
    luzes.pontos(pts);
    feixe.material.uniforms.uOpacidade.value = 0.32 + 0.04 * Math.sin(t * 0.7);
  };
  return c;
}
