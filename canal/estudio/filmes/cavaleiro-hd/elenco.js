// Elenco de "O Cavaleiro Sem Armadura" no motor HD (bonecos animáveis com rosto e roupas).
import * as THREE from 'three';
import { add } from '../../motor-hd/boneco.js';
import { criarPessoa, materialTecido } from '../../motor-hd/pessoa.js';
import { triplanar } from '../../motor-hd/materiais.js';
import { madeira, linho, couro, aco } from '../../motor-hd/texturas.js';
import { criarCapacete, criarEspada } from '../../motor-hd/cavaleiro.js';
import { criarCavalo, criarCarroca } from '../../motor-hd/cavalo.js';

const T = (tipo, tecido, cor, extra = {}) => ({ tipo, tecido, cor, ...extra });

export const FICHAS = {
  // Dâmaso: corpo forte, só cueca, cinto e faixas; o rosto aparece só no fim (variante "rosto")
  damaso: {
    nome: 'damaso', versao: 3, altura: 1.84, ombros: 1.04, forca: 1.1, gordura: 0.05, suja: 0.55, semRosto: true, maos: ['aberta', 'segura', 'punho', 'meia'],
    roupas: [T('cueca', 'linho', 0xd8ccb4), T('cinto', 'couro', 0x9a7a5a), T('faixas', 'linho', 0xb8a890)],
  },
  tome: {
    nome: 'tome', versao: 3, altura: 1.8, forca: 1.0, gordura: 0.25, idade: 0.45, olhos: 0x3a2a1a,
    rosto: { nariz: 1.15, queixo: 1.1, semente: 11 },
    cabelo: { estilo: 'curto', cor: 0x3e2c1e, volume: 1.3 }, barba: { tamanho: 1.3, cor: 0x4a3424 },
    roupas: [T('camisa', 'linho', 0x9a8a70, { manga: 'longa', barra: -0.2 }), T('calca', 'la', 0x4a4038), T('botas', 'couro', 0x8a6a50), T('avental', 'couro', 0xa07a58)],
  },
  dalia: {
    nome: 'dalia', versao: 1, mulher: 1, altura: 1.63, forca: 0.6, gordura: 0.2, idade: 0.35, olhos: 0x3a2a1a,
    rosto: { nariz: 0.95, semente: 21 }, cabelo: { estilo: 'preso', cor: 0x3a2416 }, capuz: { tipo: 'lenco', tecido: 'linho', cor: 0x8a6a58 },
    roupas: [T('camisa', 'linho', 0xa09078, { manga: 'longa', barra: -0.05 }), T('saia', 'la', 0x5a4a3a, { barra: 0.05 }), T('manto', 'la', 0x6a5040, { barra: 0.98, abertura: 0.03, frente: 0.1 })],
  },
  lia: {
    nome: 'lia', versao: 1, mulher: 1, crianca: 1, altura: 1.3, forca: 0.5, gordura: 0.1, idade: 0, suja: 0.3, olhos: 0x5a4028,
    rosto: { nariz: 0.85, semente: 31 }, cabelo: { estilo: 'preso', cor: 0x5a3a20, volume: 1.15 },
    roupas: [T('camisa', 'linho', 0x8a7058, { manga: 'longa', barra: -0.05 }), T('saia', 'la', 0x6a4a30, { barra: 0.32, abertura: 0.1 })],
  },
  brana: {
    nome: 'brana', versao: 1, mulher: 1, altura: 1.58, forca: 0.45, gordura: 0.05, idade: 0.9, olhos: 0x6a6a60, maos: ['aberta', 'meia', 'segura'],
    rosto: { nariz: 1.15, queixo: 0.9, semente: 41 }, cabelo: { estilo: 'longo', cor: 0xb8b4ac }, capuz: { tipo: 'pano', tecido: 'la', cor: 0x6a6864 },
    roupas: [T('camisa', 'la', 0x5a5854, { manga: 'longa' }), T('saia', 'la', 0x4a4844, { barra: 0.04 }), T('manto', 'la', 0x6e6c68, { barra: 0.12 })],
  },
  branaJovem: {
    nome: 'branaJovem', versao: 1, mulher: 1, altura: 1.62, forca: 0.55, gordura: 0.1, idade: 0.3, suja: 0.9, olhos: 0x5a4a38,
    rosto: { nariz: 1.1, queixo: 0.9, semente: 41 }, cabelo: { estilo: 'longo', cor: 0x3a2a1a },
    roupas: [T('camisa', 'linho', 0x7a6a58, { manga: 'longa', barra: -0.05 }), T('saia', 'la', 0x4a3a2e, { barra: 0.05 })],
  },
  malvar: {
    nome: 'malvar', versao: 1, altura: 1.83, forca: 0.9, gordura: 0.15, idade: 0.65, olhos: 0x4a5a6a,
    rosto: { nariz: 1.05, queixo: 1.15, semente: 51 }, cabelo: { estilo: 'curto', cor: 0x8a8680 }, barba: { tamanho: 0.5, cor: 0x8a8680 },
    roupas: [T('camisa', 'la', 0x5a1a20, { manga: 'longa', barra: -0.25 }), T('calca', 'la', 0x2a2420), T('botas', 'couro', 0x3a2a20, { cano: 0.7 }), T('couraca', 'aco', 0xd0d4d8), T('armadura', 'aco', 0xc8ccd0), T('manto', 'la', 0x6a1a22, { barra: 0.28, frente: 0.22 })],
  },
  malvarJovem: {
    nome: 'malvarJovem', versao: 1, altura: 1.83, forca: 0.9, gordura: 0.05, idade: 0.3, olhos: 0x4a5a6a,
    rosto: { nariz: 1.05, queixo: 1.15, semente: 51 }, cabelo: { estilo: 'curto', cor: 0x2a2018 },
    roupas: [T('camisa', 'la', 0x5a1a20, { manga: 'longa', barra: -0.3 }), T('calca', 'la', 0x2a2420), T('botas', 'couro', 0x3a2a20, { cano: 0.7 }), T('manto', 'la', 0x6a1a22, { barra: 0.25, frente: 0.22 })],
  },
  raposa: {
    nome: 'raposa', versao: 1, altura: 1.76, forca: 0.75, gordura: 0.05, idade: 0.35, olhos: 0x6a5a30, maos: ['aberta', 'segura', 'meia'],
    rosto: { nariz: 1.2, queixo: 0.95, semente: 61 }, barba: { tamanho: 0.3, cor: 0x5a3a20 }, capuz: { tipo: 'pele', cor: 0x9a6a40 },
    roupas: [T('camisa', 'couro', 0x8a6a4a, { manga: 'longa', barra: -0.18 }), T('calca', 'la', 0x3a3428), T('botas', 'couro', 0x5a4a3a), T('cinto', 'couro', 0x3a2a1a)],
  },
  bandido1: {
    nome: 'bandido1', versao: 1, altura: 1.86, forca: 1.1, gordura: 0.35, idade: 0.4, olhos: 0x2a2018,
    rosto: { nariz: 1.3, queixo: 1.2, gordo: 1, semente: 71 }, cabelo: { estilo: 'curto', cor: 0x1a1410, volume: 0.6 }, barba: { tamanho: 1.0, cor: 0x2a2018 },
    roupas: [T('camisa', 'la', 0x5a5040, { manga: 'curta', barra: -0.2 }), T('calca', 'la', 0x2a2620), T('botas', 'couro', 0x4a3a2a), T('cinto', 'couro', 0x2a1a10)],
  },
  bandido2: {
    nome: 'bandido2', versao: 1, altura: 1.72, forca: 0.55, gordura: 0.0, idade: 0.25, olhos: 0x4a3a28,
    rosto: { nariz: 1.0, queixo: 0.85, semente: 81 }, capuz: { tipo: 'pano', tecido: 'la', cor: 0x3a3a34 },
    roupas: [T('camisa', 'linho', 0x6a6050, { manga: 'longa', barra: -0.22 }), T('calca', 'la', 0x3a3028), T('botas', 'couro', 0x4a3a2a)],
  },
  soldado: {
    nome: 'soldado', versao: 1, altura: 1.8, forca: 0.85, gordura: 0.1, idade: 0.35, olhos: 0x3a3a30,
    rosto: { nariz: 1.1, semente: 91 }, barba: { tamanho: 0.4, cor: 0x3a2a20 }, cabelo: { estilo: 'curto', cor: 0x2a2018 },
    roupas: [T('camisa', 'la', 0x6a5a48, { manga: 'longa', barra: -0.3, folga: 0.026 }), T('camisa', 'la', 0x5a1a20, { manga: 'sem', barra: -0.34, folga: 0.034 }), T('calca', 'la', 0x3a3428), T('botas', 'couro', 0x3a2a20, { cano: 0.7 }), T('cinto', 'couro', 0x2a1a10, { folga: 0.05 })],
  },
  aldeao: {
    nome: 'aldeao', versao: 1, altura: 1.74, forca: 0.8, gordura: 0.15, idade: 0.5, olhos: 0x3a2a1a,
    rosto: { nariz: 1.1, semente: 101 }, cabelo: { estilo: 'curto', cor: 0x4a3a2a }, barba: { tamanho: 0.8, cor: 0x4a3a2a },
    roupas: [T('camisa', 'linho', 0x8a7a60, { manga: 'longa', barra: -0.2 }), T('calca', 'la', 0x5a4a3a), T('botas', 'couro', 0x6a5040)],
  },
  aldea: {
    nome: 'aldea', versao: 1, mulher: 1, altura: 1.6, forca: 0.6, gordura: 0.25, idade: 0.5, olhos: 0x3a2a1a,
    rosto: { nariz: 1.0, semente: 111 }, cabelo: { estilo: 'preso', cor: 0x3a2a1a }, capuz: { tipo: 'lenco', tecido: 'linho', cor: 0x9a8a70 },
    roupas: [T('camisa', 'linho', 0x7a6a5a, { manga: 'longa', barra: -0.05 }), T('saia', 'la', 0x4a5a5a, { barra: 0.05 })],
  },
  damasoRosto: {
    nome: 'damasoRosto', versao: 1, altura: 1.84, ombros: 1.04, forca: 1.1, gordura: 0.05, suja: 0.55, idade: 0.65, olhos: 0x4a4038, maos: ['aberta', 'segura', 'punho', 'meia'],
    rosto: { nariz: 1.1, queixo: 1.05, semente: 121 }, cabelo: { estilo: 'curto', cor: 0x6a645e, volume: 0.9 }, barba: { tamanho: 0.9, cor: 0x7a7470 },
    roupas: [T('cueca', 'linho', 0xd8ccb4), T('cinto', 'couro', 0x9a7a5a), T('faixas', 'linho', 0xb8a890)],
  },
  damasoCamisa: {
    nome: 'damasoCamisa', versao: 1, altura: 1.84, ombros: 1.04, forca: 1.1, gordura: 0.05, idade: 0.65, olhos: 0x4a4038, maos: ['aberta', 'segura', 'punho', 'meia'],
    rosto: { nariz: 1.1, queixo: 1.05, semente: 121 }, cabelo: { estilo: 'curto', cor: 0x6a645e, volume: 0.9 }, barba: { tamanho: 0.9, cor: 0x7a7470 },
    roupas: [T('camisa', 'linho', 0xc8bca4, { manga: 'longa', barra: -0.24 }), T('calca', 'la', 0x5a4a3a), T('cinto', 'couro', 0x9a7a5a, { folga: 0.04 })],
  },
  dourado: {
    nome: 'dourado', versao: 1, altura: 1.84, ombros: 1.04, forca: 1.1, gordura: 0.05, semRosto: true, maos: ['segura', 'aberta'],
    roupas: [T('camisa', 'la', 0xe8e0d0, { manga: 'longa', barra: -0.3, folga: 0.03 }), T('couraca', 'aco', 0xffc860), T('armadura', 'aco', 0xffc860), T('manto', 'la', 0xd8d0c0, { barra: 0.3, frente: 0.24 })],
  },
};

// coloca a espada na mão (o cabo atravessa a palma; a lâmina sai pelo lado do polegar)
function empunhar(b, espada, lado = 'D') {
  const { d, n, z } = b.maos[lado].segura.userData.eixos;
  const J = b.J;
  const palma = add(J['pulso' + lado], d, 0.05);
  const cabo = add(palma, n, 0.03);
  espada.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...z));
  espada.position.set(...add(cabo, z, 0.11));
  b.prender('mao' + lado, espada);
}

export function pessoa(n) {
  const f = FICHAS[n];
  const b = criarPessoa(f);
  if (n === 'damaso' || n === 'dourado') {
    const cap = criarCapacete({ novo: n === 'dourado' });
    cap.position.set(b.J.cabeca[0], b.J.cabeca[1] - 0.045, b.J.cabeca[2] - 0.005);
    b.prender('cabeca', cap);
    b.capacete = cap;
  }
  if (['damaso', 'dourado', 'damasoRosto'].includes(n)) {
    b.espada = criarEspada({ nova: n === 'dourado' });
    empunhar(b, b.espada);
    b.mao('D', 'segura');
  }
  return b;
}

// objetos de cena
export function criarArco() {
  const g = new THREE.Group();
  const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, -0.6, 0), new THREE.Vector3(0, 0, -0.22), new THREE.Vector3(0, 0.6, 0));
  const arco = new THREE.Mesh(new THREE.TubeGeometry(curva, 24, 0.014, 8), triplanar(madeira(), { escala: 6, relevo: 1, metal: 0, cor: 0x9a7a5a }));
  const corda = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 1.2, 4), new THREE.MeshStandardMaterial({ color: 0xc8b898, roughness: 0.8 }));
  g.add(arco, corda);
  g.userData.corda = corda;
  g.userData.curva = curva;
  return g;
}
export function criarFlecha() {
  const g = new THREE.Group();
  const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.75, 6), new THREE.MeshStandardMaterial({ color: 0x8a7050, roughness: 0.7 }));
  haste.position.y = 0.375;
  const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.04, 6), new THREE.MeshStandardMaterial({ color: 0x5a5a5a, metalness: 0.9, roughness: 0.4 }));
  ponta.position.y = 0.77;
  const pena = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.1), new THREE.MeshStandardMaterial({ color: 0x6a3020, side: THREE.DoubleSide }));
  pena.position.y = 0.06;
  g.add(haste, ponta, pena);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function criarBebe() {
  const g = new THREE.Group();
  const pano = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.22, 8, 16), triplanar(linho(), { escala: 6, relevo: 1, metal: 0, cor: 0xd0c4a8 }));
  pano.rotation.z = Math.PI / 2;
  const rosto = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), new THREE.MeshStandardMaterial({ color: 0xd8a088, roughness: 0.6 }));
  rosto.position.set(0.19, 0.02, 0.02);
  g.add(pano, rosto);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  return g;
}
export function criarTocha() {
  const g = new THREE.Group();
  const cabo = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.6, 8), triplanar(madeira(), { escala: 6, relevo: 1, metal: 0 }));
  const trapo = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.026, 0.12, 10), triplanar(linho(), { escala: 8, relevo: 1, metal: 0, cor: 0x3a2a1a }));
  trapo.position.y = 0.32;
  g.add(cabo, trapo);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  return g;
}
export function criarBengala() {
  const g = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 1.1, 8), triplanar(madeira(), { escala: 5, relevo: 1, metal: 0, cor: 0x8a7060 }));
  g.castShadow = true;
  return g;
}
export function criarLanca() {
  const g = new THREE.Group();
  const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 2.4, 8), triplanar(madeira(), { escala: 4, relevo: 1, metal: 0 }));
  const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.22, 4), triplanar(aco(), { escala: 4, relevo: 0.5, metal: 1, cor: 0xb0b4b8 }));
  ponta.position.y = 1.31;
  g.add(haste, ponta);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}
export function criarElmoSoldado() {
  // chapéu de ferro (aba larga)
  const g = new THREE.Group();
  const mat = triplanar(aco(), { escala: 4, relevo: 0.6, metal: 1, cor: 0x9a9ea2 });
  const copa = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  const aba = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.012, 24), mat);
  aba.position.y = 0.0;
  g.add(copa, aba);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  return g;
}
export { criarCavalo, criarCarroca };
