// Set: a estrada do vale à noite (Capítulo I e abertura).
// Carroça puxada a cavalo com Tomé e Dália, os três bandidos, o tronco caído e o Enferrujado.
import * as THREE from 'three';
import * as O from '../motor/objetos.js';
import * as T from '../motor/texturas.js';
import { material, luzes, ruido1, lerp } from '../motor/ps1.js';
import { POSES, aplicar, parado, poseBase, flecha as criarFlecha } from '../motor/personagem.js';
import { cavalo, cavaloAndar } from '../motor/animais.js';
import { figurinos } from '../filmes/cavaleiro/elenco3d.js';

export const LAYOUT = {
  carroZ: -1.5, carroX: 0.15,
  troncoZ: -6.2,
  raposa: [0.3, -7.4], b1: [-1.9, -5.0], b2: [2.1, -5.3],
};

export default function estrada() {
  const cena = new THREE.Scene();
  const alea = T.aleatorio(2026);
  const curva = (z) => (z < -8 ? Math.sin((z + 8) * 0.045) * 4 : 0);
  const altura = (x, z) => {
    const dx = Math.abs(x - curva(z));
    if (dx < 2.3) return 0;
    const b = Math.min((dx - 2.3) * 0.14, 1.4);
    return b + Math.sin(x * 0.35) * Math.cos(z * 0.27) * 0.25 * Math.min(b, 1);
  };
  cena.add(O.chao({ largura: 150, comprimento: 150, seg: 90, repete: [40, 40], altura, centro: [0, -25] }));
  cena.add(O.estrada({ z0: 40, z1: -95, curva, seg: 100 }));
  const fixo = (o, x, z, dy = 0) => {
    o.position.set(x, altura(x, z) + dy, z);
    cena.add(o);
    return o;
  };
  for (let z = 36; z > -85; z -= 1.6 + alea() * 1.4)
    for (const lado of [-1, 1]) {
      if (alea() < 0.25) continue;
      const x = curva(z) + lado * (3.4 + alea() * 12);
      fixo(alea() < 0.72 ? O.pinheiro(alea, 1.2) : O.arvoreSeca(alea, 1.1), x, z, -0.1);
    }
  for (let i = 0; i < 200; i++) {
    const z = 34 - alea() * 100;
    const x = curva(z) + (alea() < 0.5 ? -1 : 1) * (1.7 + alea() * 5);
    fixo(alea() < 0.7 ? O.touceira(alea) : O.arbusto(alea, 0.8), x, z);
  }
  for (let i = 0; i < 40; i++) {
    const z = 30 - alea() * 80;
    fixo(O.pedra(alea), curva(z) + (alea() < 0.5 ? -1 : 1) * (2 + alea() * 4), z);
  }
  const lua = O.lua(9);
  lua.position.set(-14, 22, -70);
  cena.add(lua);
  const veus = [];
  for (let i = 0; i < 14; i++) {
    const v = O.veu(0x8a98b2, 8 + alea() * 8, 0.1 + alea() * 0.12);
    v.userData = { x: (alea() - 0.5) * 16, y: 0.4 + alea() * 1.1, z: 10 - alea() * 40, vel: 0.08 + alea() * 0.12 };
    cena.add(v);
    veus.push(v);
  }

  // tronco caído
  const tronco = O.troncoCaido(4.4);
  cena.add(tronco);

  // carroça com cavalo, Tomé e Dália no banco
  const carroca = O.carroca(alea, { puxada: true, lanternaNaFrente: true, lanternaDireita: true, banco: true });
  cena.add(carroca.grupo);
  const cav = cavalo();
  cav.raiz.position.set(0, 0, 2.6);
  carroca.grupo.add(cav.raiz);
  const tome = figurinos.tome();
  const dalia = figurinos.dalia();
  carroca.grupo.add(tome.raiz, dalia.raiz);
  const haloLant = O.halo(0xffb468, 1.1, 0.75);
  const haloLantLonge = O.halo(0xff9a48, 4.5, 0.16);
  cena.add(haloLant, haloLantLonge);

  // pessoas a pé
  const heroi = figurinos.enferrujado({ marcas: 296 });
  const raposa = figurinos.raposa();
  const b1 = figurinos.bandido1();
  const b2 = figurinos.bandido2();
  cena.add(heroi.raiz, raposa.raiz, b1.raiz, b2.raiz);
  const fogoTocha = O.fogo(0.16);
  cena.add(fogoTocha.grupo);

  // ferida no peito (fecha sozinha)
  const ferida = new THREE.Mesh(new THREE.CircleGeometry(0.03, 6), material({ cor: 0x5a0c0c, semLuz: false }));
  ferida.position.set(0.07, 0.33, 0.152);
  heroi.j.tronco.add(ferida);
  // flecha avulsa e pedaços do arco quebrado
  const flecha = criarFlecha();
  cena.add(flecha);
  const mArco = material({ mapa: T.madeira(91, [92, 64, 40]) });
  const pedacos = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.45, 4).translate(0, 0.22, 0), mArco);
    cena.add(m);
    return m;
  });

  const atores = { heroi, raposa, b1, b2, tome, dalia };
  const c = {
    cena, curva, altura, carroca, cavalo: cav, tronco, flecha, pedacos, ferida, fogoTocha,
    atores, ...atores,
    vozes: { raposa, tome, bandido1: b1, bandido2: b2 },
    estado: {},
  };

  // ---------- utilidades para os planos ----------
  c.pos = (ator, x, z, rotY) => {
    const r = ator.raiz ?? ator;
    r.position.set(x, altura(x, z), z);
    if (rotY !== undefined) r.rotation.set(0, rotY, 0);
  };
  c.virarPara = (ator, x, z) => {
    const r = ator.raiz ?? ator;
    r.rotation.set(0, Math.atan2(x - r.position.x, z - r.position.z), 0);
  };
  c.mundo = (obj, local = [0, 0, 0]) => {
    cena.updateMatrixWorld(true);
    return obj.localToWorld(new THREE.Vector3(...local));
  };
  c.cabecaDe = (ator, dy = 0.12) => c.mundo(ator.j.cabeca, [0, dy, 0]);
  c.mostrar = (...nomes) => {
    for (const n of Object.keys(atores)) atores[n].raiz.visible = nomes.includes(n) || nomes.includes('todos');
    carroca.grupo.visible = nomes.includes('carroca') || nomes.includes('todos');
  };
  // carroça andando: z do centro; gira rodas e mexe o cavalo
  c.carroAndando = (z, vel, t) => {
    carroca.grupo.position.set(LAYOUT.carroX, 0, z);
    carroca.grupo.rotation.y = Math.PI;
    carroca.girar(-z);
    cavaloAndar(cav, (-z / 1.6) * Math.PI * 2, vel, t);
  };

  c.preparar = (t) => {
    const e = c.estado;
    e.amanhecer = 0;
    e.luaForte = 0;
    e.lanterna = true;
    e.tocha = true;
    e.tochaPos = null;
    e.luzExtra = null;
    c.mostrar('todos');
    if (tome.raiz.parent !== carroca.grupo) carroca.grupo.add(tome.raiz);
    if (flecha.parent !== cena) cena.add(flecha);
    raposa.arco.visible = true;
    b2.tocha.visible = true;
    flecha.visible = false;
    pedacos.forEach((p) => (p.visible = false));
    ferida.visible = false;
    ferida.scale.setScalar(1);
    // posições padrão: carroça parada diante do tronco, bandidos na estrada
    carroca.grupo.position.set(LAYOUT.carroX, 0, LAYOUT.carroZ);
    carroca.grupo.rotation.y = Math.PI;
    cavaloAndar(cav, 0, 0, t);
    tronco.visible = true;
    tronco.position.set(0.15, 0, LAYOUT.troncoZ);
    tronco.rotation.set(0, 0.08, 0);
    for (const [p, x] of [[tome, 0.36], [dalia, -0.36]]) {
      p.raiz.position.set(x, 0.66, 1.0);
      p.raiz.rotation.set(0, 0, 0);
      parado(p, t);
      aplicar(p, POSES.sentado);
    }
    aplicar(tome, POSES.redeas);
    c.pos(raposa, ...LAYOUT.raposa, 0);
    c.pos(b1, ...LAYOUT.b1, 0.3);
    c.pos(b2, ...LAYOUT.b2, -0.45);
    for (const p of [raposa, b1, b2, heroi]) {
      p.raiz.rotation.x = 0;
      parado(p, t + p.raiz.position.x);
    }
    raposa.arco?.userData.puxar(0);
    c.pos(heroi, 0.3, -11, Math.PI * 0);
    heroi.raiz.rotation.y = 0;
  };

  c.atualizar = (t) => {
    for (const v of veus) {
      const u = v.userData;
      v.position.set(u.x + Math.sin(t * 0.05 + u.z) * 2 + t * u.vel * 0.3, u.y, u.z);
    }
  };

  const NOITE = { nevoa: new THREE.Color(0x1a2331), ceu: new THREE.Color(0x2c3a52), chao: new THREE.Color(0x0b0d12) };
  const AURORA = { nevoa: new THREE.Color(0x6e6474), ceu: new THREE.Color(0x9c8c96), chao: new THREE.Color(0x2c2624) };
  const tmp = new THREE.Color();
  c.luz = (t) => {
    const e = c.estado, k = e.amanhecer;
    luzes.nevoa(tmp.copy(NOITE.nevoa).lerp(AURORA.nevoa, k), lerp(3, 6, k), lerp(25, 48, k));
    luzes.ambiente(tmp.copy(NOITE.ceu).lerp(AURORA.ceu, k).getHex(), new THREE.Color().copy(NOITE.chao).lerp(AURORA.chao, k).getHex());
    if (k > 0) luzes.direcional([0.1, -0.3, 0.95], 0xffb48a, 0.85 * k);
    else luzes.direcional([0.25, -0.55, 0.8], 0x7286b4, 0.5 + 0.5 * e.luaForte);
    lua.material.opacity = 0.5 * (1 - k);
    for (const v of veus) v.material.opacity = (0.1 + (v.userData.vel - 0.08)) * (1 - 0.6 * k);
    const pontos = [];
    if (e.lanterna && carroca.grupo.visible) {
      const tremor = (ruido1(t * 5.5) - 0.5) * 0.3 + (ruido1(t * 15, 7) - 0.5) * 0.14;
      const pc = c.mundo(carroca.lanterna.grupo, [0, 0.1, 0]);
      pontos.push({ pos: pc, cor: 0xffb070, intensidade: 1.35 + tremor, alcance: 10 + tremor * 2 });
      haloLant.position.copy(pc);
      haloLantLonge.position.copy(pc);
      haloLant.material.opacity = (0.65 + tremor * 0.6) * (1 - 0.7 * k);
      haloLantLonge.material.opacity = (0.14 + tremor * 0.1) * (1 - 0.7 * k);
      haloLant.visible = haloLantLonge.visible = true;
    } else haloLant.visible = haloLantLonge.visible = false;
    if (e.tocha && (b2.raiz.visible || e.tochaPos)) {
      const pf = e.tochaPos ?? c.mundo(b2.tocha, [0, 0.55, 0]);
      fogoTocha.grupo.visible = true;
      fogoTocha.grupo.position.copy(pf);
      fogoTocha.atualizar(t, 3);
      const tr = (ruido1(t * 8, 3) - 0.5) * 0.5;
      pontos.push({ pos: pf, cor: 0xff8c40, intensidade: 1.2 + tr, alcance: 8.5 });
    } else fogoTocha.grupo.visible = false;
    for (const l of e.luzExtra ?? []) pontos.push({ ...l, intensidade: l.intensidade * (1 + (ruido1(t * 7, 9) - 0.5) * 0.3) });
    luzes.pontos(pontos);
  };

  return c;
}
