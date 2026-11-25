// Foto de perfil do canal: o Narrador. Simples e humano: roupa preta, óculos, cabelo e barba castanhos.
// Renderizar quadrada: ?res=400x400 e --escala 2 (800x800). Rosto em textura de 128 px (mais detalhe no retrato).
import * as THREE from 'three';
import * as O from '../motor/objetos.js';
import * as T from '../motor/texturas.js';
import * as R from '../motor/roupas.js';
import { material } from '../motor/ps1.js';
import { criarPersonagem, parado } from '../motor/personagem.js';

const PELE = [196, 150, 116];
const CASTANHO = [86, 56, 34];

// rosto detalhado que envolve a cabeça (frente em x=64)
function texRosto() {
  const r = T.fazerRuido(211);
  return T.textura('rosto-narrador', 128, 64, (px, ler, w, h) => {
    const C = w / 2;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = Math.abs(x - C);
        let k = 0.93 + T.fbm(r, x / 6, y / 6, 21, 2) * 0.1;
        if (dx > 15) k *= 0.9;
        if (dx > 22) k *= 0.88;
        if (y > 30 && dx > 8 && dx < 14) k *= 1.04; // maçãs do rosto
        px(x, y, T.mul(PELE, k));
      }
    const cabelo = (x, y, f = 1) => px(x, y, T.mul(CASTANHO, f * (0.8 + T.fbm(r, x / 1.3, y / 3.5, 98, 1) * 0.45)));
    // cabelo: franja levemente bagunçada, laterais e nuca
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = Math.abs(x - C);
        const linha = 11 + Math.round(Math.sin(x * 0.7) * 1.2) + (dx > 12 ? 2 : 0);
        if (y < linha || (dx > 23 && y < 34) || dx > 36) cabelo(x, y, dx > 36 ? 0.85 : 1);
      }
    // sobrancelhas grossas
    for (const s of [-1, 1])
      for (let i = 3; i <= 12; i++) {
        const yy = 20 - (i > 5 && i < 10 ? 1 : 0);
        cabelo(C + s * i, yy, 0.75);
        cabelo(C + s * i, yy + 1, 0.85);
      }
    // olhos
    for (const s of [-1, 1]) {
      const ex = C + s * 8;
      for (let x = ex - 3; x <= ex + 3; x++) {
        px(x, 24, [60, 40, 30]); // pálpebra
        px(x, 25, [232, 226, 214]);
        px(x, 26, [228, 220, 208]);
        px(x, 27, [212, 202, 190]);
      }
      for (let y = 25; y <= 27; y++) for (const x of [ex - 1, ex, ex + 1]) px(x, y, [78, 50, 30]); // íris castanha
      px(ex, 26, [14, 9, 7]);
      px(ex, 25, [20, 12, 9]);
      px(ex + 1, 25, [252, 252, 246]); // brilho
      for (let x = ex - 3; x <= ex + 3; x++) px(x, 28, T.mul(PELE, 0.82));
    }
    // nariz
    for (let y = 27; y < 37; y++) { px(C + 1, y, T.mul(PELE, 0.84)); px(C + 2, y, T.mul(PELE, 0.9)); }
    for (const x of [C - 2, C + 3]) px(x, 37, T.mul(PELE, 0.62));
    px(C, 37, T.mul(PELE, 0.78));
    // barba cheia, aparada, com bigode; boca com leve sorriso
    for (let y = 30; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = Math.abs(x - C);
        const naBarba = (y >= 39 && dx <= 17) || (y >= 33 && dx >= 12 && dx <= 24) || (y >= 38 && y <= 39 && dx <= 7);
        const boca = y >= 41 && y <= 42 && dx <= 4;
        if (naBarba && !boca) cabelo(x, y, y > 52 ? 0.85 : 1);
      }
    for (let x = C - 4; x <= C + 4; x++) px(x, 41, [150, 84, 74]);
    for (let x = C - 3; x <= C + 3; x++) px(x, 42, [170, 100, 88]);
    px(C - 5, 40, [150, 84, 74]);
    px(C + 5, 40, [150, 84, 74]); // cantos levemente para cima
  });
}

// malha preta limpa, com nervuras discretas (sem a "sujeira" da textura de pano)
function texMalha(nome, w = 32, h = 32) {
  return T.textura(`malha-preta-${nome}`, w, h, (px) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const k = x % 3 === 0 ? 0.9 : 1;
        px(x, y, T.mul([44, 42, 48], k));
      }
  });
}

export default function ({ cena, camera, luzes, motor }) {
  const preto = [40, 38, 44];
  const p = criarPersonagem({
    pele: PELE,
    forte: 0.95,
    rosto: { idade: 'adulto', cabelo: 'curto', corCabelo: CASTANHO, barba: 'cheia', corBarba: CASTANHO, semente: 7 },
    torso: texMalha('torso', 64, 64),
    braco: texMalha('braco'),
    antebraco: texMalha('braco'),
    pelve: texMalha('pelve'),
    coxa: texMalha('perna'),
  });
  p.sombra.visible = false;
  cena.add(p.raiz);
  // rosto em alta (para retrato), cabeça mais arredondada
  p.mRosto.uniforms.uMapa.value = texRosto();
  const cab = p.cabecaMalha;
  // cabeça torneada (perfil de crânio, maçãs e maxilar) no lugar do cilindro de 8 lados
  const H = 0.235;
  const perfil = [[0.0, 0.0], [0.045, 0.008], [0.072, 0.03], [0.088, 0.06], [0.097, 0.1], [0.1, 0.135], [0.098, 0.17], [0.09, 0.2], [0.072, 0.222], [0.04, 0.233], [0.001, 0.236]];
  const lg = new THREE.LatheGeometry(perfil.map(([r, y]) => new THREE.Vector2(r, y)), 16);
  lg.rotateY(Math.PI);
  const pl = lg.attributes.position, ul = lg.attributes.uv;
  for (let i = 0; i < pl.count; i++) ul.setY(i, pl.getY(i) / H);
  lg.scale(1, 1, 1.12);
  lg.translate(0, -0.005, 0);
  lg.computeVertexNormals();
  cab.children[0].geometry = lg;
  cab.children[0].material = p.mRosto;
  cab.scale.set(1.12, 1.03, 1.1);
  for (const o of [p.j.ombroE, p.j.ombroD]) o.children[0].scale.multiplyScalar(0.84);
  cab.children[2].visible = false; // calota original (parecia touca)
  cab.children[3].visible = false; // o queixo torneado já tem a barba na textura
  // cabelo com volume arredondado e um pouco bagunçado
  const mCab = material({ mapa: R.pelagem(CASTANHO, 45) });
  const topo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.108, 1), mCab);
  topo.scale.set(1.0, 0.52, 1.08);
  topo.position.set(0, 0.215, -0.012);
  cab.add(topo);
  for (const [x, z, r] of [[-0.05, 0.06, 0.035], [0.02, 0.075, 0.032], [0.06, 0.05, 0.03]]) {
    const mecha = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mCab);
    mecha.position.set(x, 0.225, z);
    cab.add(mecha);
  }
  // óculos de armação redonda escura
  const mArm = material({ cor: 0x141214, brilhoProprio: 0.02 });
  const oculos = new THREE.Group();
  for (const s of [-1, 1]) {
    const aro = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0045, 4, 14), mArm);
    aro.position.set(s * 0.036, 0, 0);
    oculos.add(aro);
    const lente = new THREE.Mesh(new THREE.CircleGeometry(0.024, 12), material({ cor: 0xbcd4e8, transparente: true, opacidade: 0.14, semLuz: true, depthWrite: false }));
    lente.position.set(s * 0.036, 0, 0.001);
    oculos.add(lente);
    const reflexo = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.016), material({ cor: 0xffffff, transparente: true, opacidade: 0.45, semLuz: true, depthWrite: false }));
    reflexo.position.set(s * 0.036 - 0.009, 0.008, 0.002);
    reflexo.rotation.z = 0.5;
    oculos.add(reflexo);
    const haste = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.004, 0.1), mArm);
    haste.position.set(s * 0.064, 0.004, -0.05);
    oculos.add(haste);
  }
  const ponte = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.004, 0.004), mArm);
  ponte.position.y = 0.006;
  oculos.add(ponte);
  oculos.position.set(0, 0.125, 0.112);
  p.cabecaMalha.add(oculos);
  // gola preta cobrindo o pescoço (gola alta)
  p.j.cabeca.position.y = 0.04; // pescoço mais curto: o queixo encosta na gola
  const gola = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.092, 0.075, 10), material({ mapa: texMalha('gola') }));
  gola.position.y = 0.025;
  p.j.pescoco.children[0].visible = false;
  p.j.pescoco.add(gola);
  // variante b: segurando um livro aberto (deixa claro que ele é o narrador)
  const v = new URLSearchParams(location.search).get('v') ?? 'a';
  let livro = null;
  if (v === 'b') {
    livro = new THREE.Group();
    const mCapa = material({ cor: 0x5a2a1c });
    const tp = T.textura('pagina-livro', 16, 20, (px, ler, w, h) => {
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) px(x, y, y > 3 && y < h - 3 && x > 2 && x < w - 2 && y % 3 === 0 && (x * 7 + y) % 5 !== 0 ? [120, 96, 70] : [214, 198, 166]);
    });
    const mPag = material({ mapa: tp });
    for (const sd of [-1, 1]) {
      const lado = new THREE.Group();
      lado.rotation.z = sd * 0.18;
      lado.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.27).translate(sd * 0.1, 0, 0), mCapa));
      lado.add(new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.03, 0.25).translate(sd * 0.095, 0.02, 0), mPag));
      livro.add(lado);
    }
    livro.scale.setScalar(0.78);
    cena.add(livro);
  }
  const FUNDO = 0x5e1c1c; // vinho liso, a cor da marca

  return {
    duracao: 2,
    atualizar() {
      parado(p, 0.4);
      p.raiz.rotation.set(0, 0, 0);
      p.j.cabeca.rotation.set(-0.03, 0, 0.04); // de frente, cabeça levemente inclinada
      if (v === 'b') {
        // o giro do ombro (y) vira o antebraço para dentro, até as bordas do livro
        p.j.ombroE.rotation.set(-0.35, -0.55, 0.04);
        p.j.cotoveloE.rotation.set(-1.25, 0, 0);
        p.j.ombroD.rotation.set(-0.35, 0.55, -0.04);
        p.j.cotoveloD.rotation.set(-1.25, 0, 0);
        // o livro fica entre as mãos, aberto para quem assiste
        p.raiz.updateMatrixWorld(true);
        const a = p.maoE.getWorldPosition(new THREE.Vector3());
        const b = p.maoD.getWorldPosition(new THREE.Vector3());
        livro.position.copy(a).add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.02, 0.02));
        livro.rotation.set(0.55, 0, 0);
      }
      luzes.nevoa(FUNDO, 60, 120); // a névoa só pinta o fundo liso
      luzes.ambiente(0x9a8c88, 0x2a2224);
      luzes.direcional([0.0, -0.35, -0.94], 0xfff0e0, 0.55); // luz frontal suave
      luzes.pontos([
        { pos: [-0.5, 2.0, 0.9], cor: 0xffe2c0, intensidade: 1.15, alcance: 3.0 }, // luz principal
        { pos: [0.55, 1.9, -0.5], cor: 0xffb080, intensidade: 0.9, alcance: 1.5 }, // recorte no cabelo e ombros
        { pos: [-0.55, 1.6, -0.5], cor: 0xffb080, intensidade: 0.7, alcance: 1.4 },
      ]);
      const cab = p.j.cabeca.localToWorld(new THREE.Vector3(0, 0.1, 0));
      camera.fov = 28;
      if (v === 'b') {
        camera.position.set(cab.x, cab.y - 0.19, cab.z + 1.8);
        camera.lookAt(cab.x, cab.y - 0.25, cab.z);
      } else {
        camera.position.set(cab.x, cab.y + 0.01, cab.z + 1.22);
        camera.lookAt(cab.x, cab.y - 0.01, cab.z);
      }
      camera.updateProjectionMatrix();
      motor.efeitos.uVinheta.value = 0.45;
      motor.efeitos.uExposicao.value = 1.1;
    },
  };
}
