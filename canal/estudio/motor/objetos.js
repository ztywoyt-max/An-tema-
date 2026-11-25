// Peças de cenário reutilizáveis.
import * as THREE from 'three';
import { material } from './ps1.js';
import * as T from './texturas.js';

const ALEA_PADRAO = T.aleatorio(99);

function malhaComRuido(geo, alea, forca) {
  const pos = geo.attributes.position;
  const vistos = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let d = vistos.get(k);
    if (!d) {
      d = [(alea() - 0.5) * forca, (alea() - 0.5) * forca, (alea() - 0.5) * forca];
      vistos.set(k, d);
    }
    pos.setXYZ(i, pos.getX(i) + d[0], pos.getY(i) + d[1], pos.getZ(i) + d[2]);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Chão plano subdividido (a luz por vértice precisa de vértices). altura(x,z) opcional. */
export function chao({ largura = 80, comprimento = 80, seg = 48, mapa, repete = [16, 16], altura, centro = [0, 0] } = {}) {
  const g = new THREE.PlaneGeometry(largura, comprimento, seg, seg);
  g.rotateX(-Math.PI / 2);
  g.translate(centro[0], 0, centro[1]);
  if (altura) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, altura(p.getX(i), p.getZ(i)));
    g.computeVertexNormals();
  }
  return new THREE.Mesh(g, material({ mapa: mapa ?? T.grama(), repete }));
}

/** Estrada de terra ao longo de z (de z0 até z1), com curva opcional x = curva(z). */
export function estrada({ z0 = 20, z1 = -80, largura = 3.4, seg = 60, curva = () => 0, altura = () => 0 } = {}) {
  const comp = Math.abs(z1 - z0);
  const g = new THREE.PlaneGeometry(largura, comp, 2, seg);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    // mantém a ordem dos vértices (inverter o eixo viraria as faces para baixo)
    const zMin = Math.min(z0, z1), zMax = Math.max(z0, z1);
    const z = zMin + ((p.getZ(i) + comp / 2) / comp) * (zMax - zMin);
    const x = p.getX(i) + curva(z);
    p.setXYZ(i, x, altura(x, z) + 0.02, z);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, material({ mapa: T.terraEstrada(), repete: [1, comp / 3.4] }));
}

export function pinheiro(alea = ALEA_PADRAO, escala = 1) {
  const g = new THREE.Group();
  const s = escala * (0.8 + alea() * 0.5);
  const mTronco = material({ mapa: T.casca(), repete: [1, 2] });
  const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.16 * s, 2.2 * s, 6), mTronco);
  tronco.position.y = 1.1 * s;
  g.add(tronco);
  const mFolha = material({ mapa: T.pinho(), repete: [2, 1] });
  const camadas = 3 + Math.floor(alea() * 2);
  for (let i = 0; i < camadas; i++) {
    const r = (1.5 - i * 0.32) * s * (0.9 + alea() * 0.2);
    const h = (1.9 - i * 0.2) * s;
    const cone = new THREE.Mesh(malhaComRuido(new THREE.ConeGeometry(r, h, 7, 1), alea, 0.25 * s), mFolha);
    cone.position.y = (1.3 + i * 1.05) * s + h / 2;
    cone.rotation.y = alea() * 6;
    g.add(cone);
  }
  return g;
}

export function arvoreSeca(alea = ALEA_PADRAO, escala = 1) {
  const g = new THREE.Group();
  const s = escala * (0.8 + alea() * 0.5);
  const m = material({ mapa: T.casca(), repete: [1, 2] });
  const alt = 3.2 * s;
  const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.2 * s, alt, 6), m);
  tronco.position.y = alt / 2;
  tronco.rotation.z = (alea() - 0.5) * 0.15;
  g.add(tronco);
  const galhos = 4 + Math.floor(alea() * 4);
  for (let i = 0; i < galhos; i++) {
    const comp = (0.8 + alea() * 1.1) * s;
    const gal = new THREE.Mesh(new THREE.CylinderGeometry(0.015 * s, 0.06 * s, comp, 4), m);
    gal.geometry.translate(0, comp / 2, 0);
    gal.position.y = alt * (0.45 + alea() * 0.5);
    gal.rotation.set((alea() - 0.5) * 1.6, alea() * 6.28, 0.6 + alea() * 0.6);
    g.add(gal);
  }
  return g;
}

/** Touceira de mato: dois planos cruzados com recorte (alpha). */
export function touceira(alea = ALEA_PADRAO, escala = 1, cor) {
  const g = new THREE.Group();
  const m = material({ mapa: T.mato(41, cor), corte: 0.5, duplo: true });
  const s = escala * (0.5 + alea() * 0.6);
  for (let i = 0; i < 2; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1 * s, 0.8 * s), m);
    p.position.y = 0.4 * s;
    p.rotation.y = i * Math.PI / 2 + alea();
    g.add(p);
  }
  return g;
}

export function arbusto(alea = ALEA_PADRAO, escala = 1) {
  const g = new THREE.Group();
  const m = material({ mapa: T.folhas(), corte: 0.5, duplo: true });
  const s = escala * (0.7 + alea() * 0.6);
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.4 * s, 1.2 * s), m);
    p.position.y = 0.55 * s;
    p.rotation.y = (i * Math.PI) / 3 + alea();
    g.add(p);
  }
  return g;
}

export function pedra(alea = ALEA_PADRAO, escala = 1) {
  const s = escala * (0.3 + alea() * 0.6);
  const geo = malhaComRuido(new THREE.IcosahedronGeometry(s, 0), alea, s * 0.5);
  geo.scale(1, 0.55, 1);
  const m = new THREE.Mesh(geo, material({ mapa: T.pedra() }));
  m.position.y = s * 0.15;
  m.rotation.y = alea() * 6;
  return m;
}

/** Brilho aditivo (halo de luz). */
export function halo(cor = 0xffb060, tamanho = 1, opacidade = 1) {
  const m = new THREE.SpriteMaterial({
    map: T.halo(),
    color: cor,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: opacidade,
    fog: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.set(tamanho, tamanho, 1);
  return s;
}

export function lua(tamanho = 6) {
  const m = new THREE.SpriteMaterial({ map: T.lua(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  const s = new THREE.Sprite(m);
  s.scale.set(tamanho, tamanho, 1);
  return s;
}

/** Véu de neblina que flutua (sprite claro e translúcido). */
export function veu(cor = 0x9aa8c0, largura = 10, opacidade = 0.25) {
  const m = new THREE.SpriteMaterial({ map: T.veuNevoa(), color: cor, transparent: true, opacity: opacidade, depthWrite: false, fog: false });
  const s = new THREE.Sprite(m);
  s.scale.set(largura, largura * 0.35, 1);
  return s;
}

/** Lanterna de ferro com vidro aceso. Retorna { grupo, chama } (chama = ponto da luz, local). */
export function lanterna() {
  const g = new THREE.Group();
  const mFerro = material({ cor: 0x2a2420, mapa: T.ferrugem(81, 'ferro-lanterna') });
  const mVidro = material({ mapa: T.vidroLanterna(), semLuz: true, nevoa: true });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.16).translate(0, 0, 0), mFerro));
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.17, 0.12).translate(0, 0.1, 0), mVidro));
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.2, 0.018).translate(x * 0.07, 0.1, z * 0.07), mFerro));
  }
  g.add(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.09, 4).rotateY(Math.PI / 4).translate(0, 0.245, 0), mFerro));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 4, 6).translate(0, 0.3, 0), mFerro));
  const chama = new THREE.Vector3(0, 0.1, 0);
  return { grupo: g, chama };
}

/** Carroça de madeira com sacos e caixas. Frente para +z. */
export function carroca(alea = ALEA_PADRAO) {
  const g = new THREE.Group();
  const mMad = material({ mapa: T.madeira(31) });
  const mMadEsc = material({ mapa: T.madeira(33, [74, 54, 38]) });
  // estrado
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 2.6).translate(0, 0.78, 0), mMad));
  // laterais
  for (const s of [-1, 1]) {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35, 2.6).translate(s * 0.74, 0.98, 0), mMad));
    // estacas
    for (const z of [-1.2, -0.4, 0.4, 1.2]) {
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07).translate(s * 0.76, 1.0, z), mMadEsc));
    }
    // varais (para o animal puxar)
    const varal = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 2.2).translate(0, 0, 1.1), mMadEsc);
    varal.position.set(s * 0.45, 0.72, 1.3);
    varal.rotation.x = 0.28;
    g.add(varal);
  }
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.05).translate(0, 0.98, -1.29), mMad));
  // rodas
  const mRoda = material({ mapa: T.madeira(35, [86, 62, 42]) });
  for (const s of [-1, 1]) {
    const roda = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.09, 10, 1), mRoda);
    roda.rotation.z = Math.PI / 2;
    roda.position.set(s * 0.86, 0.55, 0.1);
    g.add(roda);
    const cubo = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 6, 1), mMadEsc);
    cubo.rotation.z = Math.PI / 2;
    cubo.position.set(s * 0.88, 0.55, 0.1);
    g.add(cubo);
  }
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.08).translate(0, 0.55, 0.1), mMadEsc));
  // carga: sacos e caixas
  const mSaco = material({ mapa: T.pano([150, 128, 96], 87, 'saco') });
  for (let i = 0; i < 5; i++) {
    const saco = new THREE.Mesh(malhaComRuido(new THREE.IcosahedronGeometry(0.3, 0), alea, 0.1), mSaco);
    saco.scale.set(1, 0.7, 1.2);
    saco.position.set((alea() - 0.5) * 0.8, 1.02 + alea() * 0.1, -0.9 + i * 0.42);
    g.add(saco);
  }
  const caixa = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.5), mMadEsc);
  caixa.position.set(0.35, 1.05, 0.7);
  caixa.rotation.y = 0.3;
  g.add(caixa);
  // poste da lanterna no canto de trás
  const poste = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06).translate(0, 0.6, 0), mMadEsc);
  poste.position.set(-0.7, 0.8, -1.25);
  g.add(poste);
  const braco = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.4).translate(0, 0, -0.2), mMadEsc);
  braco.position.set(-0.7, 1.95, -1.25);
  g.add(braco);
  const lant = lanterna();
  lant.grupo.position.set(-0.7, 1.6, -1.6);
  g.add(lant.grupo);
  const fio = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.06, 0.01).translate(0, 1.92, -1.6), mMadEsc);
  fio.position.x = -0.7;
  g.add(fio);
  return { grupo: g, lanterna: lant };
}
