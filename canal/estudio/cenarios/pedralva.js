// Set: a aldeia de Pedralva, à beira do rio (Capítulos II, IV, V e VI).
// Rio ao longo de x em z=0; ponte em x=0; praça em (0, -15); celeiro à esquerda; casa de Brana à direita.
import * as THREE from 'three';
import * as O from '../motor/objetos.js';
import * as A from '../motor/aldeia.js';
import * as T from '../motor/texturas.js';
import { material, luzes, ruido1, lerp } from '../motor/ps1.js';
import { parado, poseBase } from '../motor/personagem.js';
import { figurinos } from '../filmes/cavaleiro/elenco3d.js';
import { cavalo, cavaloAndar } from '../motor/animais.js';
export { cavaloAndar };

// climas: névoa, céu, luz ambiente e direcional, janelas acesas
export const CLIMAS = {
  manhaNublada: { nevoa: [0x8a9098, 10, 75], ceu: [0x77808c, 0xa4aab0], amb: [0x9aa2ac, 0x3a3632], dir: [[0.3, -0.8, -0.4], 0xd8dce0, 0.35], janelas: 0.15, fumaca: 0x8c8c8c },
  dia: { nevoa: [0x9aa2a8, 16, 95], ceu: [0x6c88a8, 0xc0c8cc], amb: [0xa0a8b4, 0x464036], dir: [[0.4, -0.75, -0.5], 0xfff0d8, 0.6], janelas: 0, fumaca: 0x9a9a9a },
  entardecer: { nevoa: [0xa88470, 12, 80], ceu: [0x50607e, 0xf0a070], amb: [0x8a7488, 0x3a2a24], dir: [[0.85, -0.28, -0.45], 0xffb070, 1.0], janelas: 0.3, fumaca: 0xb09080 },
  anoitecer: { nevoa: [0x3c3e52, 6, 50], ceu: [0x22283e, 0x7a5a6a], amb: [0x505870, 0x16161c], dir: [[0.6, -0.3, -0.6], 0x9a80a0, 0.25], janelas: 1, fumaca: 0x504a54 },
  noite: { nevoa: [0x161c28, 4, 36], ceu: [0x0c1018, 0x1a2230], amb: [0x2c3a52, 0x0b0d12], dir: [[0.25, -0.55, 0.8], 0x7286b4, 0.45], janelas: 1, fumaca: 0x303440 },
  cinzaVento: { nevoa: [0x6c727a, 8, 60], ceu: [0x50565e, 0x7a8088], amb: [0x8a929c, 0x2a2a2c], dir: [[0.3, -0.8, -0.3], 0xc8ccd0, 0.25], janelas: 0.2, fumaca: 0x6a6a6a },
  noiteChuva: { nevoa: [0x0e121a, 3, 28], ceu: [0x06080c, 0x10141c], amb: [0x222c3c, 0x08090c], dir: [[0.2, -0.6, 0.7], 0x5a6a8a, 0.3], janelas: 1, fumaca: 0x202428 },
  amanhecerRosa: { nevoa: [0xc09aa0, 10, 70], ceu: [0x6a78a0, 0xf4b0a0], amb: [0xb09aa8, 0x3a3034], dir: [[0.1, -0.3, 0.95], 0xffc8a0, 0.9], janelas: 0.1, fumaca: 0xc0a8a8 },
  manhaClara: { nevoa: [0xb8c4cc, 20, 110], ceu: [0x5a88c0, 0xd8e0e4], amb: [0xb0bcc8, 0x50483c], dir: [[0.3, -0.7, -0.5], 0xfff4e0, 0.75], janelas: 0, fumaca: 0xb0b0b0 },
};

export const LUGAR = {
  ponte: [0, 0], praca: [0, -15], celeiro: [-11, -6.5], portaCeleiro: [-8.2, -6.5], cerca: [-6.5, -4.8],
  mureta: [-5.2, -6.2], casaBrana: [7.6, -12], portaBrana: [5.85, -12.9], mesa: [-3.2, -12], casaTome: [-7.5, -11.5], pilhaPedras: [3.5, -7.5], muroNovo: [6.5, -6.2],
};

export default function pedralva({ camera }) {
  const cena = new THREE.Scene();
  const alea = T.aleatorio(4242);
  const RIO_Z = 0, RIO_L = 7;
  const altura = (x, z) => {
    const dz = Math.abs(z - RIO_Z);
    if (dz < RIO_L / 2) return -0.7;
    if (dz < RIO_L / 2 + 1.6) return lerp(-0.7, 0, (dz - RIO_L / 2) / 1.6);
    const r = Math.hypot(x, z + 12);
    return r > 32 ? Math.min((r - 32) * 0.12, 3) : 0;
  };
  const ceu = A.ceu();
  cena.add(ceu);
  cena.add(A.colinas(85));
  const chao = O.chao({ largura: 170, comprimento: 170, seg: 100, repete: [45, 45], altura, centro: [0, -10] });
  cena.add(chao);
  // terra batida na praça e nas ruas
  const mTerra = material({ mapa: T.terraBatida(), repete: [8, 8] });
  const praca = new THREE.Mesh(new THREE.CircleGeometry(13, 16).rotateX(-Math.PI / 2), mTerra);
  praca.position.set(0, 0.02, -15);
  cena.add(praca);
  cena.add(O.estrada({ z0: 60, z1: 4.8, curva: (z) => Math.sin(z * 0.05) * 3 * Math.min(1, (z - 5) / 20), seg: 30 }));
  const rua = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 9).rotateX(-Math.PI / 2), material({ mapa: T.terraBatida(), repete: [1, 3] }));
  rua.position.set(0, 0.05, -8.5);
  cena.add(rua);
  // rio e ponte
  const rio = A.rio(170, RIO_L, RIO_Z);
  cena.add(rio.malha);
  const ponte = A.ponte(10, 2.8, 0.42);
  cena.add(ponte);
  const mTerraR = material({ mapa: T.terraEstrada(), repete: [1, 1] });
  for (const s of [-1, 1]) {
    const rampa = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 1.6), mTerraR);
    rampa.position.set(0, 0.22, s * 5.7);
    rampa.rotation.x = -s * 0.26;
    cena.add(rampa);
  }

  const pos = (o, x, z, rot = 0) => {
    o.position.set(x, altura(x, z), z);
    o.rotation.y = rot;
    cena.add(o);
    return o;
  };
  // casas (porta virada para a praça/rua)
  const casas = [];
  const chamines = [];
  const defCasas = [
    [-7.5, -11.5, Math.PI / 2, { w: 5, d: 4, semente: 1 }], // Tomé (ferraria)
    [7.6, -12, -Math.PI / 2, { w: 4.6, d: 4, semente: 2, portaX: -0.9 }], // Brana
    [-6.5, -21.5, Math.PI / 4, { w: 5.5, d: 4.2, semente: 3 }],
    [0.5, -26, 0, { w: 6, d: 4.5, semente: 4, janelas: 2 }],
    [8, -21, -Math.PI / 4, { w: 5, d: 4, semente: 5 }],
    [-14, -15, Math.PI / 2, { w: 4.5, d: 4, semente: 6 }],
    [14, -15.5, -Math.PI / 2, { w: 5, d: 4, semente: 7 }],
    [-11, -29, Math.PI / 6, { w: 5, d: 4, semente: 8 }],
    [10, -30, -Math.PI / 6, { w: 5.2, d: 4, semente: 9 }],
    [-17, -24, Math.PI / 3, { w: 4.4, d: 3.8, semente: 10 }],
  ];
  for (const [x, z, r, op] of defCasas) {
    const c = pos(A.casa(op), x, z, r);
    casas.push(c);
    if (c.userData.chamine) {
      const f = A.fumaca(0x8c8c8c, 0.9);
      c.updateMatrixWorld(true);
      f.grupo.position.copy(c.localToWorld(c.userData.chamine.clone()));
      cena.add(f.grupo);
      chamines.push(f);
    }
  }
  const casaBrana = casas[1];
  const celeiro = pos(A.celeiro(), ...LUGAR.celeiro, Math.PI / 2);
  const moinho = pos(A.moinho(), 13, -6, -Math.PI / 2);
  const roda = moinho.userData.roda;
  // cerca, mureta, pilha de pedras e muro em construção
  pos(A.cerca(6), -6.5, -4.8, 0);
  pos(A.cerca(4.5), -3.6, -7.2, Math.PI / 2);
  const mureta = new THREE.Mesh(new THREE.BoxGeometry(3, 0.55, 0.6), material({ mapa: T.paredePedra(111), repete: [1.2, 0.3] }));
  mureta.position.set(LUGAR.mureta[0], 0.27, LUGAR.mureta[1]);
  mureta.rotation.y = 0.2;
  cena.add(mureta);
  const pedrasSoltas = [];
  for (let i = 0; i < 8; i++) {
    const p = O.pedra(alea, 0.55);
    pos(p, LUGAR.pilhaPedras[0] + (alea() - 0.5) * 1.4, LUGAR.pilhaPedras[1] + (alea() - 0.5) * 1.2, alea() * 6);
    pedrasSoltas.push(p);
  }
  const muro = new THREE.Mesh(new THREE.BoxGeometry(4, 0.7, 0.6), material({ mapa: T.paredePedra(115), repete: [1.6, 0.3] }));
  muro.position.set(LUGAR.muroNovo[0], 0.35, LUGAR.muroNovo[1]);
  cena.add(muro);
  // pedra que o herói carrega
  const pedraCarga = O.pedra(T.aleatorio(5), 0.7);
  cena.add(pedraCarga);
  // objetos da praça
  pos(A.poco(), 2.5, -16.5);
  const mesa = pos(A.mesa(), ...LUGAR.mesa, 0.3);
  pos(A.banco(), LUGAR.mesa[0] - 0.1, LUGAR.mesa[1] + 0.75, 0.3);
  for (const [x, z] of [[-5.2, -9], [-5.6, -9.6], [5.2, -10.4], [-4.8, -19], [4.5, -23], [9.5, -9.5]]) pos(A.barril(), x, z, alea() * 3);
  for (const [x, z] of [[-13.5, -3.8], [-9.5, -2.8], [-14, -9.5]]) pos(A.monteFeno(0.9 + alea() * 0.3), x, z, alea() * 3);
  for (const [x, z] of [[-12, -2.6], [-9.8, -10.2]]) pos(A.fardo(), x, z, alea() * 3);
  const galinhas = [];
  for (let i = 0; i < 7; i++) {
    const g = A.galinha(i);
    pos(g, (alea() - 0.5) * 12, -12 - alea() * 8, alea() * 6);
    galinhas.push(g);
  }
  // árvores em volta
  for (let i = 0; i < 70; i++) {
    const a = alea() * Math.PI * 2, r = 24 + alea() * 30;
    const x = Math.cos(a) * r, z = -12 + Math.sin(a) * r;
    if (Math.abs(z - RIO_Z) < 5) continue;
    if (Math.abs(x) < 4 && z > 0) continue;
    pos(alea() < 0.7 ? O.pinheiro(alea, 1.4) : O.arvoreSeca(alea, 1.2), x, z, alea() * 6);
  }
  for (let i = 0; i < 60; i++) {
    const x = (alea() - 0.5) * 50, z = -2 - alea() * 34;
    if (Math.hypot(x, z + 15) < 12 || Math.abs(x) < 2.5) continue;
    pos(alea() < 0.6 ? O.touceira(alea) : O.arbusto(alea, 0.7), x, z);
  }
  for (const s of [-1, 1]) for (let x = -60; x < 60; x += 2.5 + alea() * 3) pos(O.touceira(alea, 0.9), x, RIO_Z + s * (RIO_L / 2 + 0.4 + alea()), alea() * 3);
  const lua = O.lua(9);
  lua.position.set(-30, 40, -90);
  cena.add(lua);

  // carroça de Tomé (chegada)
  const carroca = O.carroca(alea, { puxada: true, lanternaNaFrente: true, lanternaDireita: true, banco: true });
  const cav = cavalo();
  cav.raiz.position.set(0, 0, 2.6);
  carroca.grupo.add(cav.raiz);
  cena.add(carroca.grupo);
  // pão, vela e o prego
  const pao = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), material({ cor: 0xb08050 }));
  pao.scale.set(1.3, 0.8, 1);
  cena.add(pao);
  const vela = new THREE.Group();
  vela.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.16, 6).translate(0, 0.08, 0), material({ cor: 0xe0d6b8 })));
  vela.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.02, 8), material({ cor: 0x3a3634 })));
  const chamaVela = O.fogo(0.05, 0xffb040);
  chamaVela.grupo.position.y = 0.19;
  vela.add(chamaVela.grupo);
  cena.add(vela);

  // personagens
  const heroi = figurinos.enferrujado({ marcas: 299 });
  const lia = figurinos.lia();
  const brana = figurinos.brana();
  const tome = figurinos.tome();
  const dalia = figurinos.dalia();
  cena.add(heroi.raiz, lia.raiz, brana.raiz, tome.raiz, dalia.raiz);
  const aldeoes = [];
  for (let i = 0; i < 12; i++) {
    const a = figurinos.aldeao(i + 1);
    cena.add(a.raiz);
    aldeoes.push(a);
  }
  // posições de trabalho dos aldeões (quando ninguém mexe neles)
  const postos = [[-2, -13.5, 2.6], [1.5, -14, -2.2], [3.6, -17, -1], [-3.8, -18, 0.6], [5.5, -14.5, -1.6], [-5.6, -15, 1.2], [0.2, -19.5, 3.1], [-1.2, -9.5, 2.2], [3.8, -11.2, -2.4], [-8.6, -14.4, 1.5], [9.4, -17.4, -1.3], [2.8, -21.5, 2.8]];

  const atores = { heroi, lia, brana, tome, dalia };
  const c = {
    cena, altura, ceu, casas, carroca, cavalo: cav, pao, vela, chamaVela, casaBrana, celeiro, moinho, mesa, ponte, rio, pedraCarga, pedrasSoltas, galinhas, aldeoes, postos,
    atores, ...atores,
    vozes: { lia, brana, tome },
    estado: {},
  };
  c.pos = (ator, x, z, rotY) => {
    const r = ator.raiz ?? ator;
    r.position.set(x, Math.max(altura(x, z), 0), z);
    if (rotY !== undefined) r.rotation.set(0, rotY, 0);
  };
  c.naPonte = (ator, z, x = 0, rotY) => {
    const r = ator.raiz ?? ator;
    r.position.set(x, Math.abs(z) < 5 ? ponte.userData.altura : 0, z);
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
    const comAldeoes = nomes.includes('aldeoes') || nomes.includes('todos');
    aldeoes.forEach((a) => (a.raiz.visible = comAldeoes));
  };

  c.preparar = (t) => {
    const e = c.estado;
    e.clima = 'dia';
    e.luzes = [];
    e.vento = 0.6;
    c.mostrar('aldeoes');
    pedraCarga.visible = false;
    pao.visible = false;
    vela.visible = false;
    carroca.grupo.visible = false;
    if (tome.raiz.parent !== cena) cena.add(tome.raiz);
    if (dalia.raiz.parent !== cena) cena.add(dalia.raiz);
    if (pedraCarga.parent !== cena) cena.add(pedraCarga);
    if (pao.parent !== cena) cena.add(pao);
    celeiro.userData.folhas.forEach((f, i) => (f.rotation.y = (i ? 1 : -1) * 1.9));
    heroi.espada.visible = true;
    heroi.mElmo.uniforms.uMapa.value = T.capacete(299);
    for (const p of Object.values(atores)) {
      p.raiz.rotation.set(0, 0, 0);
      parado(p, t + p.raiz.id);
    }
    aldeoes.forEach((a, i) => {
      const [x, z, r] = postos[i];
      c.pos(a, x, z, r);
      parado(a, t + i * 1.7);
    });
    c.pos(heroi, -8.2, -6.5, Math.PI / 2);
    c.pos(lia, -5, -9, 0);
    c.pos(brana, ...LUGAR.portaBrana, -Math.PI / 2);
    c.pos(tome, -5.2, -11, Math.PI / 2);
    c.pos(dalia, -5.6, -12.2, Math.PI / 2);
  };

  c.atualizar = (t) => {
    rio.atualizar(t);
    roda.rotation.z = -t * 0.6;
    chamines.forEach((f, i) => f.atualizar(t + i * 1.3, c.estado.vento ?? 0.6));
    galinhas.forEach((g) => g.userData.atualizar(t));
    chamaVela.atualizar(t, 5);
  };

  const tmp = new THREE.Color();
  c.luz = (t) => {
    const e = c.estado;
    const k = CLIMAS[e.clima] ?? CLIMAS.dia;
    luzes.nevoa(k.nevoa[0], k.nevoa[1], k.nevoa[2]);
    luzes.ambiente(k.amb[0], k.amb[1]);
    luzes.direcional(k.dir[0], k.dir[1], k.dir[2]);
    ceu.userData.cores(k.ceu[0], k.ceu[1]);
    ceu.userData.seguir(camera);
    lua.visible = e.clima === 'noite';
    for (const casa of casas) for (const mj of casa.userData.janelas) mj.uniforms.uEmissivo.value.set(0xffa040).multiplyScalar(k.janelas * (0.8 + 0.2 * ruido1(t * 3 + casa.id)));
    chamines.forEach((f) => f.grupo.children.forEach((s) => s.material.color.set(k.fumaca)));
    luzes.pontos((e.luzes ?? []).map((l) => ({ ...l, intensidade: l.intensidade * (l.tremula ? 1 + (ruido1(t * 6, l.tremula) - 0.5) * 0.35 : 1) })));
  };

  return c;
}
