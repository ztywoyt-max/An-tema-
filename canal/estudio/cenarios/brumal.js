// Set: Brumal, vinte anos antes (flashback, Capítulo III).
// Aldeia de cabanas de palha em (0,0); estrada vindo de +x; penhasco e rio em z ~ -40, x ~ 30.
import * as THREE from 'three';
import * as O from '../motor/objetos.js';
import * as A from '../motor/aldeia.js';
import * as T from '../motor/texturas.js';
import * as R from '../motor/roupas.js';
import { material, luzes, ruido1, lerp } from '../motor/ps1.js';
import { parado, aplicar, POSES, bebe, espada } from '../motor/personagem.js';
import { cavalo, cavaloAndar } from '../motor/animais.js';
import { figurinos } from '../filmes/cavaleiro/elenco3d.js';

export const CLIMAS = {
  diaDourado: { nevoa: [0xc8a878, 22, 130], ceu: [0x86a8d0, 0xf0d0a0], amb: [0xc0b090, 0x5a4a34], dir: [[-0.6, -0.5, -0.6], 0xfff0c0, 1.0] },
  noiteFogo: { nevoa: [0x3a1a10, 8, 55], ceu: [0x120806, 0x6a2a10], amb: [0x5a3a34, 0x1a0c08], dir: [[0.2, -0.6, 0.7], 0x6070a0, 0.25] },
  manhaCinza: { nevoa: [0x8a8c90, 12, 85], ceu: [0x747a84, 0xa0a4a8], amb: [0x9aa0a8, 0x3a3632], dir: [[0.3, -0.8, -0.4], 0xd0d4d8, 0.4] },
};

export const PENHASCO = { x: 30, topoZ: -37, borda: -40, alt: 7, margem: -41.3 };

export default function brumal({ camera }) {
  const cena = new THREE.Scene();
  const alea = T.aleatorio(1312);
  const RIO_Z = -46;
  const altura = (x, z) => {
    if (z < RIO_Z + 3.2 && z > RIO_Z - 3.2) return -0.7;
    const r = Math.hypot(x, z);
    return r > 45 ? Math.min((r - 45) * 0.1, 3) : 0;
  };
  const ceu = A.ceu();
  cena.add(ceu);
  cena.add(A.colinas(90, 3));
  cena.add(O.chao({ largura: 190, comprimento: 190, seg: 100, repete: [50, 50], altura, centro: [10, -10] }));
  const estrada = O.estrada({ z0: 80, z1: 8, curva: () => 0, seg: 30 });
  estrada.rotation.y = Math.PI / 2;
  cena.add(estrada);
  const rio = A.rio(190, 6.4, RIO_Z);
  cena.add(rio.malha);
  // penhasco (bloco de rocha) com a borda virada para o rio
  const mRocha = material({ mapa: T.pedra(151), repete: [6, 3] });
  const rocha = new THREE.Mesh(new THREE.BoxGeometry(16, PENHASCO.alt, 8, 8, 4, 4), mRocha);
  const pr = rocha.geometry.attributes.position;
  for (let i = 0; i < pr.count; i++) {
    const n = Math.sin(pr.getX(i) * 1.7 + pr.getY(i)) * 0.35 + Math.cos(pr.getY(i) * 2.3) * 0.25;
    if (pr.getZ(i) < -3.9) pr.setZ(i, pr.getZ(i) + n);
  }
  rocha.geometry.computeVertexNormals();
  rocha.position.set(PENHASCO.x, PENHASCO.alt / 2, PENHASCO.borda + 4);
  cena.add(rocha);
  const topo = new THREE.Mesh(new THREE.PlaneGeometry(16, 8).rotateX(-Math.PI / 2), material({ mapa: T.grama(), repete: [4, 2] }));
  topo.position.set(PENHASCO.x, PENHASCO.alt + 0.01, PENHASCO.borda + 4);
  cena.add(topo);
  for (let i = 0; i < 6; i++) {
    const p = O.pedra(alea, 1.4);
    p.position.set(PENHASCO.x - 7 + i * 2.6, 0, PENHASCO.borda - 0.8 - alea());
    cena.add(p);
  }

  // cabanas de palha em volta da praça
  const cabanas = [];
  const mFogo = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + alea() * 0.3;
    const r = 7 + alea() * 6;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (x > 6 && Math.abs(z) < 3) continue; // deixa a entrada da estrada livre
    const cab = A.casa({ w: 3.6 + alea(), d: 3 + alea() * 0.6, h: 2.1, altTelhado: 1.8, parede: 'palha', semente: 20 + i, chamine: false, janelas: 1 });
    cab.position.set(x, 0, z);
    cab.rotation.y = Math.atan2(-x, -z);
    cena.add(cab);
    // fogo no telhado (3 focos) e fumaça escura
    const focos = [];
    for (let k = 0; k < 5; k++) {
      const f = O.fogo(0.9 + alea() * 0.6, k % 2 ? 0xff8a30 : 0xff6a20);
      f.grupo.position.set(x + (alea() - 0.5) * 2.6, 2.0 + alea() * 1.8, z + (alea() - 0.5) * 2.0);
      cena.add(f.grupo);
      focos.push(f);
    }
    const fum = A.fumaca(0x1a1210, 2.4);
    fum.grupo.position.set(x, 3.6, z);
    cena.add(fum.grupo);
    cabanas.push({ cab, focos, fum, atraso: alea(), x, z });
  }
  for (let i = 0; i < 80; i++) {
    const a = alea() * Math.PI * 2, r = 22 + alea() * 40;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(z - RIO_Z) < 5 || (z < -32 && Math.abs(x - PENHASCO.x) < 10)) continue;
    if (x > 8 && Math.abs(z) < 3) continue;
    const arv = alea() < 0.6 ? O.pinheiro(alea, 1.3) : O.arvoreSeca(alea, 1.2);
    arv.position.set(x, altura(x, z) - 0.1, z);
    cena.add(arv);
  }
  for (let i = 0; i < 70; i++) {
    const x = (alea() - 0.5) * 70, z = (alea() - 0.5) * 70;
    if (Math.abs(z - RIO_Z) < 4) continue;
    const t = O.touceira(alea);
    t.position.set(x, altura(x, z), z);
    cena.add(t);
  }

  // Dâmaso no cavalo branco
  const cav = cavalo({ cor: [206, 202, 196], crina: [232, 228, 222] });
  const sela = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.6), material({ cor: 0x5a2a20 }));
  sela.position.set(0, 0.36, 0.05);
  cav.j.corpo.add(sela);
  cena.add(cav.raiz);
  const damaso = figurinos.damaso();
  cena.add(damaso.raiz);
  // tropa: lanceiros (dia) e tocheiros (noite)
  const lanceiros = Array.from({ length: 8 }, (_, i) => figurinos.soldado({ semente: 40 + i, arma: 'lanca', barba: i % 3 ? 'curta' : null }));
  const tocheiros = Array.from({ length: 6 }, (_, i) => figurinos.soldado({ semente: 60 + i, arma: 'tocha' }));
  const fogosTocha = tocheiros.map(() => O.fogo(0.13));
  const bandeiras = [0, 1].map(() => A.estandarte([112, 30, 36], 3.4));
  cena.add(...lanceiros.map((s) => s.raiz), ...tocheiros.map((s) => s.raiz), ...fogosTocha.map((f) => f.grupo), ...bandeiras);
  // moradores fugindo
  const moradores = Array.from({ length: 6 }, (_, i) => figurinos.aldeao(20 + i));
  cena.add(...moradores.map((m) => m.raiz));
  // a mulher com o filho
  const mulher = figurinos.branaJovem();
  const filho = bebe();
  filho.scale.setScalar(1.7);
  filho.position.set(0, 0.22, 0.24);
  filho.rotation.set(0.1, 1.4, 0.2);
  mulher.j.tronco.add(filho);
  cena.add(mulher.raiz);
  // o Dâmaso que larga a armadura (outro corpo, sem armadura) e as peças que voam
  const semArmadura = figurinos.damaso({ semArmadura: true, capaceteNovo: true });
  cena.add(semArmadura.raiz);
  const mOuro = material({ mapa: R.metal([200, 158, 70], 83), brilhoProprio: 0.06 });
  const pecas = Array.from({ length: 5 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08 + (i % 2) * 0.1, 0.28), mOuro);
    cena.add(m);
    return m;
  });
  const respingo = O.halo(0xc8d8e0, 1.2, 0.6);
  cena.add(respingo);
  // a espada deixada no raso do rio (enferruja com o tempo)
  const espadaRio = espada({ dourada: true, semente: 65 });
  espadaRio.position.set(24.4, -0.3, RIO_Z + 1.6);
  espadaRio.rotation.set(-Math.PI / 2 + 0.08, 0.6, 0);
  cena.add(espadaRio);
  const laminaRio = espadaRio.userData.lamina[0].material;
  const aguaRasa = new THREE.Mesh(new THREE.PlaneGeometry(3, 2).rotateX(-Math.PI / 2), material({ mapa: T.agua(), transparente: true, opacidade: 0.45, cor: 0xa8c0c8, depthWrite: false, repete: [0.6, 0.4] }));
  aguaRasa.position.set(24.4, -0.26, RIO_Z + 1.6);
  cena.add(aguaRasa);

  const c = {
    cena, altura, ceu, espadaRio, laminaRio, aguaRasa, cabanas, cavalo: cav, damaso, lanceiros, tocheiros, fogosTocha, bandeiras, moradores, mulher, filho, semArmadura, pecas, respingo, rio, rocha,
    vozes: { brana: mulher, malvar: null },
    estado: {},
  };
  delete c.vozes.malvar;
  c.pos = (ator, x, z, rotY) => {
    const r = ator.raiz ?? ator;
    r.position.set(x, Math.max(0, altura(x, z)), z);
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
  const todos = [damaso, ...lanceiros, ...tocheiros, ...moradores, mulher, semArmadura];
  c.mostrar = (...grupos) => {
    const g = new Set(grupos);
    damaso.raiz.visible = g.has('damaso');
    cav.raiz.visible = g.has('cavalo');
    lanceiros.forEach((s) => (s.raiz.visible = g.has('lanceiros')));
    tocheiros.forEach((s) => (s.raiz.visible = g.has('tocheiros')));
    bandeiras.forEach((b) => (b.visible = g.has('lanceiros')));
    moradores.forEach((m) => (m.raiz.visible = g.has('moradores')));
    mulher.raiz.visible = g.has('mulher');
    semArmadura.raiz.visible = g.has('semArmadura');
  };
  // Dâmaso montado: o cavaleiro vai preso ao corpo do cavalo
  c.montar = (t, fase = 0, vel = 0) => {
    cav.j.corpo.add(damaso.raiz);
    damaso.raiz.position.set(0, -0.28, 0.05);
    damaso.raiz.rotation.set(0, 0, 0);
    parado(damaso, t);
    aplicar(damaso, POSES.montado);
    cavaloAndar(cav, fase, vel, t);
  };

  c.preparar = (t) => {
    const e = c.estado;
    e.clima = 'diaDourado';
    e.fogo = 0;
    e.luzes = [];
    if (damaso.raiz.parent !== cena) cena.add(damaso.raiz);
    c.mostrar();
    pecas.forEach((p) => (p.visible = false));
    respingo.visible = false;
    for (const p of todos) {
      p.raiz.rotation.set(0, 0, 0);
      parado(p, t + p.raiz.id * 0.37);
    }
    aplicar(mulher, POSES.segurarFilho);
    cav.raiz.rotation.set(0, 0, 0);
  };

  c.atualizar = (t) => {
    rio.atualizar(t);
    aguaRasa.material.uniforms.uDesloc.value.set(t * 0.05, 0);
    bandeiras.forEach((b) => b.userData.atualizar(t));
  };

  c.luz = (t) => {
    const e = c.estado;
    const k = CLIMAS[e.clima];
    luzes.nevoa(k.nevoa[0], k.nevoa[1], k.nevoa[2]);
    luzes.ambiente(k.amb[0], k.amb[1]);
    luzes.direcional(k.dir[0], k.dir[1], k.dir[2]);
    ceu.userData.cores(k.ceu[0], k.ceu[1]);
    ceu.userData.seguir(camera);
    const pts = [...(e.luzes ?? [])];
    // incêndio: cada cabana arde com um pequeno atraso
    const acesas = [];
    cabanas.forEach((cb, i) => {
      const nivel = Math.max(0, Math.min(1, (e.fogo - cb.atraso * 0.5) * 2));
      cb.focos.forEach((f, j) => {
        f.grupo.visible = nivel > 0.05;
        f.grupo.scale.setScalar(0.5 + nivel * 1.1);
        f.atualizar(t * 1.4, i * 3 + j);
      });
      cb.fum.grupo.visible = nivel > 0.2;
      cb.fum.atualizar(t, 0.8);
      if (nivel > 0.05) acesas.push({ pos: new THREE.Vector3(cb.x, 2.6, cb.z), nivel, i });
    });
    acesas
      .map((a) => ({ ...a, d: a.pos.distanceTo(camera.position) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, Math.max(0, 6 - pts.length))
      .forEach((a) => pts.push({ pos: a.pos, cor: 0xff7a30, intensidade: 2.0 * a.nivel * (0.85 + 0.3 * ruido1(t * 5, a.i)), alcance: 15 }));
    // tochas dos soldados
    tocheiros.forEach((s, i) => {
      const f = fogosTocha[i];
      f.grupo.visible = s.raiz.visible;
      if (!s.raiz.visible) return;
      f.grupo.position.copy(c.mundo(s.tocha, [0, 0.55, 0]));
      f.atualizar(t, i);
    });
    const vis = tocheiros.filter((s) => s.raiz.visible);
    vis.slice(0, Math.max(0, 8 - pts.length)).forEach((s, i) => pts.push({ pos: fogosTocha[tocheiros.indexOf(s)].grupo.position, cor: 0xff9040, intensidade: 0.9, alcance: 5 }));
    luzes.pontos(pts);
  };
  return c;
}
