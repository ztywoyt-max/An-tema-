// Animais segmentados no estilo PS1.
import * as THREE from 'three';
import { material } from './ps1.js';
import * as R from './roupas.js';
import * as T from './texturas.js';

function membro(pai, x, y, z, rTopo, rBase, comp, mat) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const geo = new THREE.CylinderGeometry(rTopo, rBase, comp, 6, 1);
  geo.translate(0, -comp / 2, 0);
  g.add(new THREE.Mesh(geo, mat));
  pai.add(g);
  return g;
}

/** Cavalo de carga. Frente para +z. Retorna { raiz, j } */
export function cavalo({ cor = [92, 62, 40], crina = [36, 26, 20] } = {}) {
  const raiz = new THREE.Group();
  const mPelo = material({ mapa: R.pelagem(cor, 71) });
  const mCrina = material({ mapa: R.pelagem(crina, 73), duplo: true });
  const mCasco = material({ cor: 0x2a2420 });
  const j = {};
  j.corpo = new THREE.Group();
  j.corpo.position.y = 1.22;
  raiz.add(j.corpo);
  const tronco = new THREE.CylinderGeometry(0.3, 0.32, 1.3, 8, 2);
  tronco.rotateX(Math.PI / 2);
  tronco.scale(0.85, 1.12, 1);
  j.corpo.add(new THREE.Mesh(tronco, mPelo));
  // anca e peito arredondados
  for (const z of [-0.62, 0.62]) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.31, 1), mPelo);
    b.scale.set(0.82, 1.05, 0.55);
    b.position.z = z;
    j.corpo.add(b);
  }
  // pescoço e cabeça
  j.pescoco = new THREE.Group();
  j.pescoco.position.set(0, 0.18, 0.58);
  j.pescoco.rotation.x = 0.55;
  j.corpo.add(j.pescoco);
  const pesc = new THREE.CylinderGeometry(0.12, 0.2, 0.78, 6, 1);
  pesc.scale(0.75, 1, 1);
  pesc.translate(0, 0.36, 0);
  j.pescoco.add(new THREE.Mesh(pesc, mPelo));
  const crinaG = new THREE.PlaneGeometry(0.8, 0.12).rotateZ(Math.PI / 2).rotateY(Math.PI / 2);
  const crinaM = new THREE.Mesh(crinaG, mCrina);
  crinaM.position.set(0, 0.4, -0.15);
  j.pescoco.add(crinaM);
  j.cabeca = new THREE.Group();
  j.cabeca.position.set(0, 0.74, 0.02);
  j.cabeca.rotation.x = 0.85;
  j.pescoco.add(j.cabeca);
  const cab = new THREE.CylinderGeometry(0.07, 0.12, 0.56, 6, 1);
  cab.scale(0.8, 1, 1);
  cab.translate(0, 0.24, 0);
  j.cabeca.add(new THREE.Mesh(cab, mPelo));
  for (const s of [-1, 1]) {
    const orelha = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 4), mPelo);
    orelha.position.set(s * 0.06, -0.02, -0.08);
    orelha.rotation.x = -0.9;
    j.cabeca.add(orelha);
    const olho = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.03), material({ cor: 0x0c0a08, semLuz: true }));
    olho.position.set(s * 0.085, 0.06, 0.02);
    j.cabeca.add(olho);
  }
  // pernas
  for (const [nome, x, z] of [['FE', 0.17, 0.5], ['FD', -0.17, 0.5], ['TE', 0.17, -0.5], ['TD', -0.17, -0.5]]) {
    const coxa = membro(j.corpo, x, -0.1, z, 0.1, 0.065, 0.5, mPelo);
    const joelho = membro(coxa, 0, -0.5, 0, 0.05, 0.045, 0.5, mPelo);
    const casco = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.12).translate(0, -0.535, 0.01), mCasco);
    joelho.children[0].parent.add(casco);
    j['coxa' + nome] = coxa;
    j['joelho' + nome] = joelho;
  }
  // rabo
  j.rabo = new THREE.Group();
  j.rabo.position.set(0, 0.2, -0.78);
  j.corpo.add(j.rabo);
  const rabo = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.75).translate(0, -0.37, 0), mCrina);
  rabo.rotation.x = 0.25;
  j.rabo.add(rabo);
  // arreio simples
  const mCouro = material({ mapa: T.pano([90, 60, 40], 75, 'arreio') });
  const coleira = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 4, 8), mCouro);
  coleira.position.set(0, 0.25, 0.3);
  coleira.rotation.x = 0.55 + Math.PI / 2;
  j.pescoco.add(coleira);
  const sombra = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1.9).rotateX(-Math.PI / 2),
    material({ mapa: T.sombra(), semLuz: true, transparente: true, depthWrite: false, corte: 0.01, cor: 0x000000 }),
  );
  sombra.position.y = 0.016;
  raiz.add(sombra);
  return { raiz, j };
}

/** Passo do cavalo: pares diagonais. fase em radianos; amplitude 0 = parado. */
export function cavaloAndar(c, fase, amplitude = 1, t = 0) {
  const { j } = c;
  const pernas = { FE: 0, TD: 0, FD: Math.PI, TE: Math.PI };
  for (const [n, off] of Object.entries(pernas)) {
    const f = fase + off;
    const frente = n[0] === 'F';
    j['coxa' + n].rotation.x = -0.32 * amplitude * Math.sin(f);
    const dobra = 0.75 * amplitude * Math.max(0, Math.cos(f));
    j['joelho' + n].rotation.x = frente ? dobra : -dobra * 0.8;
  }
  j.corpo.position.y = 1.22 + 0.025 * amplitude * Math.abs(Math.sin(fase * 2));
  j.pescoco.rotation.x = 0.55 + 0.06 * amplitude * Math.sin(fase * 2) + 0.03 * Math.sin(t * 0.7);
  j.cabeca.rotation.x = 0.85 + 0.05 * Math.sin(t * 1.3);
  j.rabo.rotation.z = 0.12 * Math.sin(t * 1.7);
}
