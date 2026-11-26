// Peças de aldeia do motor HD: casas de pedra com telhado de palha, celeiro, moinho com roda d'água,
// ponte de madeira, rio, poço, barris, cercas, muros e montes de feno.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Perlin, rng } from './ruido.js';
import { triplanar } from './materiais.js';
import { alvenaria, palha, madeira, ferrugem, agua, pedra, fios } from './texturas.js';
import { criarParticulas } from './efeitos.js';

const P = new Perlin(91);
let MAT = null;
function mats() {
  if (MAT) return MAT;
  MAT = {
    pedra: triplanar(alvenaria(), { escala: 0.85, relevo: 1.6, metal: 0, cor: 0xc8beb0 }),
    palha: triplanar(palha(), { escala: 1.2, relevo: 1.6, metal: 0, cor: 0xd8c8a0 }),
    madeira: triplanar(madeira(), { escala: 1.4, relevo: 1.2, metal: 0 }),
    madeiraEscura: triplanar(madeira(), { escala: 1.4, relevo: 1.2, metal: 0, cor: 0x8a7a6a }),
    ferro: triplanar(ferrugem(), { escala: 3, relevo: 0.8 }),
    rocha: triplanar(pedra(), { escala: 0.9, relevo: 1.3, metal: 0, musgo: { cor: 0x2b3a1c, qtd: 0.6 } }),
    janela: new THREE.MeshStandardMaterial({ color: 0x120c08, emissive: 0xffa050, emissiveIntensity: 0, roughness: 0.6 }),
    feno: triplanar(fios(), { escala: 3, relevo: 1.5, metal: 0, cor: 0xc8a860, rugosidade: 1 }),
  };
  return MAT;
}
export function materiaisAldeia() { return mats(); }

const sombra = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
// caixa com os vértices levemente tortos (parede de pedra feita à mão)
function caixaTorta(w, h, d, seg = 6, amp = 0.025) {
  const g = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w * seg)), Math.max(1, Math.round(h * seg)), Math.max(1, Math.round(d * seg)));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = P.ruido(x * 1.3, y * 1.3, z * 1.3);
    p.setXYZ(i, x + n * amp, y + P.ruido(x, z, y) * amp * 0.5, z + P.ruido(z * 1.3, x * 1.3, 3) * amp);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Casa de pedra. Frente (porta) para +z. telhado: 'palha' | 'madeira'.
 * janelas: lista de [x, y, face] (face: 'frente'|'tras'|'esq'|'dir'); acesas = brilho das janelas.
 */
export function casa({ largura = 6, fundo = 4.5, altura = 2.6, telhado = 'palha', chamine = true, porta = 0, janelas = null, semente = 1, parede = 'pedra' } = {}) {
  const M = mats();
  const g = new THREE.Group();
  const r = rng(semente);
  const matParede = parede === 'madeira' ? M.madeiraEscura : M.pedra;
  const pd = sombra(new THREE.Mesh(caixaTorta(largura, altura, fundo), matParede));
  pd.position.y = altura / 2;
  g.add(pd);
  // empenas (triângulos de pedra nas pontas)
  const alt2 = fundo * 0.42;
  const tri = new THREE.Shape([new THREE.Vector2(-fundo / 2, 0), new THREE.Vector2(fundo / 2, 0), new THREE.Vector2(0, alt2)]);
  const gEmp = new THREE.ExtrudeGeometry(tri, { depth: 0.35, bevelEnabled: false });
  for (const s of [-1, 1]) {
    const e = sombra(new THREE.Mesh(gEmp, matParede));
    e.rotation.y = Math.PI / 2;
    e.position.set(s > 0 ? largura / 2 - 0.35 : -largura / 2, altura, 0);
    g.add(e);
  }
  // telhado: duas águas grossas, com beiral
  const beiral = 0.45, esp = telhado === 'palha' ? 0.32 : 0.1;
  const incl = Math.atan2(alt2, fundo / 2);
  const comp = Math.hypot(fundo / 2, alt2) + beiral;
  for (const s of [-1, 1]) {
    const gT = caixaTorta(largura + beiral * 2, esp, comp, 3, telhado === 'palha' ? 0.06 : 0.01);
    const t = sombra(new THREE.Mesh(gT, telhado === 'palha' ? M.palha : M.madeiraEscura));
    t.rotation.x = s * incl;
    t.position.set(0, altura + alt2 / 2 + esp * 0.35, s * (fundo / 4 + beiral * 0.15));
    g.add(t);
  }
  const cume = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, largura + beiral * 2, 10), telhado === 'palha' ? M.palha : M.madeiraEscura));
  cume.rotation.z = Math.PI / 2;
  cume.position.y = altura + alt2 + esp * 0.5;
  g.add(cume);
  // porta
  const gPorta = new THREE.BoxGeometry(1.0, 1.95, 0.12);
  const pt = sombra(new THREE.Mesh(gPorta, M.madeira));
  pt.position.set(porta, 0.98, fundo / 2 + 0.02);
  g.add(pt);
  const lintel = sombra(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.3), M.madeiraEscura));
  lintel.position.set(porta, 2.05, fundo / 2 + 0.05);
  g.add(lintel);
  // janelas (quadradas, com vão escuro que pode acender)
  const js = janelas ?? [[porta - 1.8, 1.45, 'frente'], [porta + 1.8, 1.45, 'frente'], [0, 1.45, 'tras']];
  const vaos = [];
  for (const [jx, jy, face] of js) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.08), M.janela);
    const moldura = sombra(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.06), M.madeiraEscura));
    const o = new THREE.Group();
    o.add(moldura, v);
    v.position.z = 0.03;
    if (face === 'frente') o.position.set(jx, jy, fundo / 2 + 0.03);
    if (face === 'tras') { o.position.set(jx, jy, -fundo / 2 - 0.03); o.rotation.y = Math.PI; }
    if (face === 'esq') { o.position.set(-largura / 2 - 0.03, jy, jx); o.rotation.y = -Math.PI / 2; }
    if (face === 'dir') { o.position.set(largura / 2 + 0.03, jy, jx); o.rotation.y = Math.PI / 2; }
    g.add(o);
    vaos.push(v);
  }
  // chaminé com fumaça
  if (chamine) {
    const ch = sombra(new THREE.Mesh(caixaTorta(0.7, 1.6, 0.7, 4, 0.02), M.pedra));
    const cx = largura / 2 - 0.9 - r() * 0.6;
    ch.position.set(cx, altura + alt2 * 0.7 + 0.4, -fundo * 0.12);
    g.add(ch);
    const fum = criarParticulas({ tipo: 'fumaca', qtd: 26, area: [0.3, 0.1, 0.3], subida: 0.45, vida: 9, tamanho: 1.6, cor: 0x8a8a8c, opacidade: 0.22, vento: [0.25, 0, 0.05], semente: semente * 7 });
    fum.position.set(cx, altura + alt2 * 0.7 + 1.25, -fundo * 0.12);
    g.add(fum);
  }
  g.userData.janelas = vaos;
  g.userData.acender = (k) => { M.janela.emissiveIntensity = k; };
  return g;
}

// celeiro de tábuas, portas grandes (abertas ou fechadas)
export function celeiro({ largura = 8, fundo = 11, altura = 3.6, aberto = 1 } = {}) {
  const M = mats();
  const g = new THREE.Group();
  const esp = 0.12;
  const tabuas = [];
  const parede = (w, h, x, z, ry, buraco = null) => {
    const n = Math.round(w / 0.28);
    for (let i = 0; i < n; i++) {
      const px = -w / 2 + (i + 0.5) * (w / n);
      if (buraco && Math.abs(px) < buraco) continue;
      const tb = new THREE.BoxGeometry(w / n - 0.012, h * (0.98 + 0.04 * Math.sin(i * 7.1)), esp);
      tb.translate(px, h / 2, 0);
      tb.rotateY(ry);
      tb.translate(x, 0, z);
      tabuas.push(tb);
    }
  };
  parede(largura, altura, 0, -fundo / 2, 0);
  parede(largura, altura, 0, fundo / 2, 0, 1.6);
  parede(fundo, altura, -largura / 2, 0, Math.PI / 2);
  parede(fundo, altura, largura / 2, 0, Math.PI / 2);
  g.add(sombra(new THREE.Mesh(mergeGeometries(tabuas), M.madeira)));
  // empenas e telhado de tábuas
  const alt2 = largura * 0.45;
  const tri = new THREE.Shape([new THREE.Vector2(-largura / 2, 0), new THREE.Vector2(largura / 2, 0), new THREE.Vector2(0, alt2)]);
  for (const s of [-1, 1]) {
    const e = sombra(new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: esp, bevelEnabled: false }), M.madeira));
    e.position.set(0, altura, s * fundo / 2 - esp / 2);
    g.add(e);
  }
  const incl = Math.atan2(alt2, largura / 2);
  const comp = Math.hypot(largura / 2, alt2) + 0.5;
  for (const s of [-1, 1]) {
    const t = sombra(new THREE.Mesh(caixaTorta(comp, 0.1, fundo + 0.8, 2, 0.01), M.madeiraEscura));
    t.rotation.z = -s * incl;
    t.position.set(s * (largura / 4 + 0.1), altura + alt2 / 2 + 0.05, 0);
    g.add(t);
  }
  // portas (giram para fora); userData.abrir(k) (0 = fechadas com uma fresta, 1 = escancaradas)
  const portas = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group();
    piv.position.set(s * 1.6, 0, fundo / 2 + 0.06);
    const pt = sombra(new THREE.Mesh(new THREE.BoxGeometry(1.6, altura * 0.85, 0.1), M.madeira));
    pt.position.set(-s * 0.8, altura * 0.425, 0);
    piv.add(pt);
    piv.rotation.y = s * aberto * 1.9;
    g.add(piv);
    portas.push([piv, s]);
  }
  g.userData.abrir = (k) => { for (const [piv, s] of portas) piv.rotation.y = s * Math.max(0.025, k) * 1.9; };
  // vigas por dentro, feno, chão de terra batida
  for (let i = 0; i < 4; i++) {
    const v = sombra(new THREE.Mesh(new THREE.BoxGeometry(largura, 0.2, 0.2), M.madeiraEscura));
    v.position.set(0, altura - 0.1, -fundo / 2 + 1.5 + i * 2.6);
    g.add(v);
  }
  for (let i = 0; i < 5; i++) {
    const f = sombra(new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), M.feno));
    f.scale.set(1.2 + (i % 2) * 0.4, 0.7 + (i % 3) * 0.25, 1.0);
    f.position.set(-largura / 2 + 1.3, 0.3, -fundo / 2 + 1.5 + i * 1.7);
    g.add(f);
  }
  return g;
}

// moinho: casa de pedra alta com roda d'água que gira (roda.rotation.x = ângulo)
export function moinho() {
  const M = mats();
  const g = casa({ largura: 5, fundo: 5, altura: 4.2, telhado: 'madeira', chamine: false, janelas: [[0, 2.8, 'frente'], [0, 1.4, 'esq']], semente: 9 });
  const roda = new THREE.Group();
  const R = 2.2;
  for (const s of [-1, 1]) {
    const aro = sombra(new THREE.Mesh(new THREE.TorusGeometry(R, 0.08, 8, 40), M.madeiraEscura));
    aro.position.x = s * 0.35;
    aro.rotation.y = Math.PI / 2;
    roda.add(aro);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const pa = sombra(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.5), M.madeira));
    pa.position.set(0, Math.sin(a) * R, Math.cos(a) * R);
    pa.rotation.x = -a;
    roda.add(pa);
    if (i % 2 === 0) {
      const raio = sombra(new THREE.Mesh(new THREE.BoxGeometry(0.08, R * 2, 0.08), M.madeiraEscura));
      raio.rotation.x = a;
      roda.add(raio);
    }
  }
  const eixo = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.4, 12), M.madeiraEscura));
  eixo.rotation.z = Math.PI / 2;
  roda.add(eixo);
  g.add(roda);
  g.userData.roda = roda;
  return g;
}

// ponte de madeira ao longo de z, com tábuas, pilares e corrimão
export function ponte({ comprimento = 13, largura = 2.8, altura = 0.45, fundoRio = -1.8 } = {}) {
  const M = mats();
  const g = new THREE.Group();
  const geos = [];
  const n = Math.round(comprimento / 0.24);
  for (let i = 0; i < n; i++) {
    const t = new THREE.BoxGeometry(largura * (0.98 + 0.04 * Math.sin(i * 5.3)), 0.07, 0.22);
    t.rotateY(Math.sin(i * 3.7) * 0.015);
    t.translate(Math.sin(i * 2.1) * 0.03, altura, -comprimento / 2 + (i + 0.5) * (comprimento / n));
    geos.push(t);
  }
  for (const s of [-1, 1]) {
    const viga = new THREE.BoxGeometry(0.2, 0.25, comprimento);
    viga.translate(s * (largura / 2 - 0.15), altura - 0.16, 0);
    geos.push(viga);
    for (let k = 0; k <= 4; k++) {
      const z = -comprimento / 2 + (k / 4) * comprimento;
      const pilar = new THREE.CylinderGeometry(0.13, 0.15, altura - fundoRio + 1.1, 8);
      pilar.translate(s * (largura / 2 + 0.05), (altura + 1.1 + fundoRio) / 2, z);
      geos.push(pilar);
    }
    const corr = new THREE.BoxGeometry(0.1, 0.1, comprimento);
    corr.translate(s * (largura / 2 + 0.05), altura + 1.0, 0);
    geos.push(corr);
  }
  g.add(sombra(new THREE.Mesh(mergeGeometries(geos.map((x) => { x.deleteAttribute('uv'); return x; })), M.madeira)));
  return g;
}

// água: plano escuro e espelhado, com ondinhas que correm
export function rio({ largura = 400, fundo = 400, cor = 0x0c1416, corrente = [0.03, 0] } = {}) {
  const t = agua();
  const n = t.normal.clone();
  n.wrapS = n.wrapT = THREE.RepeatWrapping;
  n.repeat.set(largura / 6, fundo / 6);
  n.needsUpdate = true;
  const m = new THREE.MeshPhysicalMaterial({ color: cor, roughness: 0.06, metalness: 0, normalMap: n, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.4, clearcoat: 1, clearcoatRoughness: 0.05 });
  const malha = new THREE.Mesh(new THREE.PlaneGeometry(largura, fundo, 1, 1), m);
  malha.rotation.x = -Math.PI / 2;
  malha.receiveShadow = true;
  malha.userData.atualizar = (tt) => { n.offset.set(tt * corrente[0], tt * corrente[1]); };
  return malha;
}

export function poco() {
  const M = mats();
  const g = new THREE.Group();
  const anel = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.85, 0.8, 18, 1, true), M.pedra));
  anel.material = M.pedra;
  anel.position.y = 0.4;
  const borda = sombra(new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.12, 8, 24), M.pedra));
  borda.rotation.x = Math.PI / 2;
  borda.position.y = 0.8;
  const fundoP = new THREE.Mesh(new THREE.CircleGeometry(0.78, 18), new THREE.MeshBasicMaterial({ color: 0x050403 }));
  fundoP.rotation.x = -Math.PI / 2;
  fundoP.position.y = 0.3;
  g.add(anel, borda, fundoP);
  for (const s of [-1, 1]) {
    const p = sombra(new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), M.madeira));
    p.position.set(s * 0.85, 1.4, 0);
    g.add(p);
  }
  const trave = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 8), M.madeira));
  trave.rotation.z = Math.PI / 2;
  trave.position.y = 2.1;
  const balde = sombra(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.26, 12), M.madeira));
  balde.position.set(0.3, 0.98, 0.3);
  g.add(trave, balde);
  return g;
}

export function barril() {
  const M = mats();
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(0.32, 0.32, 0.9, 16, 6);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 + 0.12 * (1 - (y / 0.45) ** 2); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
  geo.computeVertexNormals();
  const b = sombra(new THREE.Mesh(geo, M.madeira));
  b.position.y = 0.45;
  g.add(b);
  for (const y of [0.12, 0.78]) {
    const aro = sombra(new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.015, 6, 24), M.ferro));
    aro.rotation.x = Math.PI / 2;
    aro.position.y = y;
    g.add(aro);
  }
  return g;
}

// cerca de estacas e travessas ligando pontos [[x, z], ...] (altura do chão por função)
export function cerca(pontos, altura, { alt = 1.1, quebrada = 0 } = {}) {
  const M = mats();
  const geos = [];
  for (let i = 0; i < pontos.length; i++) {
    const [x, z] = pontos[i];
    const e = new THREE.CylinderGeometry(0.06, 0.07, alt + 0.2, 6);
    e.translate(x, altura(x, z) + alt / 2 - 0.1, z);
    geos.push(e);
    if (i < pontos.length - 1) {
      const [x2, z2] = pontos[i + 1];
      if (quebrada && i % 4 === 2) continue;
      for (const hh of [0.45, 0.9]) {
        const L = Math.hypot(x2 - x, z2 - z);
        const t = new THREE.BoxGeometry(0.06, 0.1, L);
        t.rotateY(Math.atan2(x2 - x, z2 - z));
        t.translate((x + x2) / 2, (altura(x, z) + altura(x2, z2)) / 2 + hh * alt, (z + z2) / 2);
        geos.push(t);
      }
    }
  }
  return sombra(new THREE.Mesh(mergeGeometries(geos.map((x) => { x.deleteAttribute('uv'); return x; })), M.madeira));
}

// muro de pedras empilhadas
export function muro(pontos, altura, { alt = 1.0, esp = 0.6 } = {}) {
  const M = mats();
  const geos = [];
  for (let i = 0; i < pontos.length - 1; i++) {
    const [x, z] = pontos[i], [x2, z2] = pontos[i + 1];
    const L = Math.hypot(x2 - x, z2 - z);
    const b = caixaTorta(esp, alt, L, 4, 0.05);
    b.rotateY(Math.atan2(x2 - x, z2 - z));
    b.translate((x + x2) / 2, (altura(x, z) + altura(x2, z2)) / 2 + alt / 2 - 0.1, (z + z2) / 2);
    geos.push(b);
  }
  return sombra(new THREE.Mesh(mergeGeometries(geos.map((x) => { x.deleteAttribute('uv'); return x; })), M.pedra));
}
