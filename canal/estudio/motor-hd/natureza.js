// Cenário do motor HD: chão com estrada de lama, mato, pinheiros, árvore seca, pedras, tronco, lanterna e céu.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Perlin, rng, clamp, suave, mistura } from './ruido.js';
import { lama, terra, casca, pedra, galhoPinheiro } from './texturas.js';
import { triplanar, materialChao } from './materiais.js';

const P = new Perlin(77);

// ---------- estrada ----------
export const estrada = {
  centro: (z) => (z < 0 ? 3.2 * Math.sin(z * 0.04) : 0.6 * Math.sin(z * 0.08)),
  largura: 1.55,
};
export function distEstrada(x, z) {
  return Math.abs(x - estrada.centro(z));
}

export function alturaChao(x, z) {
  const d = distEstrada(x, z);
  const dx = x - estrada.centro(z);
  const morro = (1.4 * P.fbm(x * 0.05, z * 0.05, 1, 4) + 0.5 * P.fbm(x * 0.17, z * 0.17, 2, 3)) * suave(2, 10, d) + suave(6, 34, d) * 3.2;
  const sulcos = -0.04 * Math.exp(-(((Math.abs(dx) - 0.72) / 0.13) ** 2));
  const leito = 0.12 * P.fbm(x * 0.04, z * 0.04, 3, 3) - 0.05 + sulcos + 0.012 * P.fbm(x * 3, z * 3, 4, 3);
  const fora = 0.12 * P.fbm(x * 0.04, z * 0.04, 3, 3) + morro + 0.05 * P.fbm(x * 1.2, z * 1.2, 5, 3);
  return mistura(leito, fora, suave(1.35, 2.6, d));
}
const lamaEm = (x, z) => 1 - suave(1.25, 2.15, distEstrada(x, z) + P.fbm(x * 0.8, z * 0.8, 9, 3) * 0.9);

export function criarChao() {
  const N = 520;
  const g = new THREE.PlaneGeometry(2, 2, N, N);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const aLama = new Float32Array(pos.count);
  const esticar = (u) => Math.sign(u) * Math.pow(Math.abs(u), 1.9) * 150;
  for (let i = 0; i < pos.count; i++) {
    const x = esticar(pos.getX(i)), z = esticar(pos.getZ(i)) - 6;
    pos.setXYZ(i, x, alturaChao(x, z), z);
    aLama[i] = lamaEm(x, z);
  }
  g.setAttribute('aLama', new THREE.BufferAttribute(aLama, 1));
  g.computeVertexNormals();
  const mat = materialChao(lama(), terra(), { escala: 0.55, pocas: 0.8 });
  mat.envMapIntensity = 0.45;
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

// ---------- mato ----------
export function criarMato({ qtd = 11000, raio = 26, centro = [0, -4], semente = 5, altura = alturaChao, dist = distEstrada, folhas: nFolhas = 14, tamanho = 1 } = {}) {
  const r = rng(semente);
  // um tufo = várias folhas finas e curvas
  const folhas = [];
  for (let f = 0; f < nFolhas; f++) {
    const a = r() * Math.PI * 2, inc = 0.15 + r() * 0.5, alt = 0.12 + r() * 0.26, larg = 0.006 + r() * 0.006;
    const segs = 4;
    const v = [], c = [], idx = [];
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const curva = inc * t * t;
      const px = Math.cos(a) * curva * alt + (r() - 0.5) * 0.04 * (s === 0 ? 1 : 0), pz = Math.sin(a) * curva * alt;
      const w = larg * (1 - t * 0.92);
      const ox = -Math.sin(a) * w, oz = Math.cos(a) * w;
      v.push(px - ox, t * alt, pz - oz, px + ox, t * alt, pz + oz);
      const k = 0.35 + 0.65 * t;
      c.push(k, k, k, k, k, k);
      if (s < segs) { const b = s * 2; idx.push(b, b + 1, b + 3, b, b + 3, b + 2); }
    }
    const gf = new THREE.BufferGeometry();
    gf.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    gf.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    gf.setIndex(idx);
    gf.computeVertexNormals();
    folhas.push(gf);
  }
  const tufo = mergeGeometries(folhas);
  tufo.translate(0, -0.02, 0);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.75, metalness: 0 });
  const inst = new THREE.InstancedMesh(tufo, mat, qtd);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
  const cor = new THREE.Color();
  let n = 0;
  for (let tent = 0; n < qtd && tent < qtd * 8; tent++) {
    const ang = r() * Math.PI * 2, rad = Math.pow(r(), 0.7) * raio;
    const x = centro[0] + Math.cos(ang) * rad, z = centro[1] + Math.sin(ang) * rad;
    const d = dist(x, z) + P.fbm(x * 0.9, z * 0.9, 6, 2) * 0.8;
    if (d < 1.35 && r() > 0.04) continue;
    if (P.fbm(x * 0.3, z * 0.3, 8, 2) < -0.15 && r() > 0.3) continue;
    const esc = (0.55 + r() * 0.75) * (d < 1.8 ? 0.55 : 1) * tamanho;
    e.set((r() - 0.5) * 0.2, r() * Math.PI * 2, (r() - 0.5) * 0.2);
    q.setFromEuler(e);
    m4.compose(p3.set(x, altura(x, z), z), q, s3.set(esc, esc * (0.8 + r() * 0.5), esc));
    inst.setMatrixAt(n, m4);
    const seco = clamp(0.55 + P.fbm(x * 0.2, z * 0.2, 3, 2) * 1.5 + (r() - 0.5) * 0.3);
    cor.setRGB(mistura(0.07, 0.3, seco), mistura(0.1, 0.25, seco), mistura(0.04, 0.12, seco));
    inst.setColorAt(n, cor);
    n++;
  }
  inst.count = n;
  inst.receiveShadow = true;
  return inst;
}

// ---------- pinheiros ----------
function geometriaPinheiro(semente) {
  const r = rng(semente);
  const alt = 13 + r() * 6;
  const tronco = new THREE.CylinderGeometry(0.06, 0.2 + r() * 0.12, alt, 10, 12);
  tronco.translate(0, alt / 2, 0);
  {
    // tronco torto e irregular
    const Pt = new Perlin(semente);
    const tp = tronco.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const y = tp.getY(i);
      const k = 1 + 0.12 * Pt.ruido(tp.getX(i) * 6, y * 0.8, tp.getZ(i) * 6) + (y < 0.6 ? (0.6 - y) * 0.5 : 0);
      tp.setXYZ(i, tp.getX(i) * k + Pt.ruido(y * 0.15, 1, 2) * 0.35 * (y / alt), y, tp.getZ(i) * k + Pt.ruido(y * 0.15, 5, 2) * 0.35 * (y / alt));
    }
    tronco.computeVertexNormals();
  }
  // galhos secos baixos (tocos finos no tronco)
  const secos = [];
  for (let i = 0; i < 10; i++) {
    const y = 1.2 + r() * 3.2, a = r() * Math.PI * 2, c = 0.4 + r() * 0.9;
    const gs = new THREE.CylinderGeometry(0.008, 0.025, c, 5);
    gs.translate(0, c / 2, 0);
    gs.rotateZ(-(1.1 + r() * 0.5));
    gs.rotateY(a);
    gs.translate(0, y, 0);
    secos.push(gs);
  }
  const troncoTudo = mergeGeometries([tronco, ...secos].map((g) => { g.deleteAttribute('uv'); return g; }));
  const cartoes = [];
  const verticilos = 30;
  for (let i = 0; i < verticilos; i++) {
    const t = i / (verticilos - 1);
    const y = mistura(4.2, alt - 0.3, t);
    const comp = mistura(2.6, 0.5, Math.pow(t, 0.85)) * (0.8 + r() * 0.4);
    const n = 7 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) {
      // cada galho é um feixe de raminhos pequenos ao longo dele (dá volume, sem cara de placa)
      const a = (k / n) * Math.PI * 2 + r() * 0.6 + i;
      const queda = 0.25 + r() * 0.35 - t * 0.2;
      const dir = new THREE.Vector3(Math.cos(a), -queda, Math.sin(a)).normalize();
      const ramos = 3 + Math.floor(comp * 1.5);
      for (let m = 0; m < ramos; m++) {
        const d = comp * (0.15 + 0.85 * (m + r() * 0.5) / ramos);
        const tam = comp * (0.32 + r() * 0.18) * (1 - 0.35 * (d / comp));
        const c = new THREE.PlaneGeometry(tam * 0.8, tam);
        c.rotateX(-Math.PI / 2 + (r() - 0.5) * 0.9);
        c.rotateY(r() * Math.PI * 2);
        c.rotateZ((r() - 0.5) * 0.8);
        c.translate(dir.x * d, y + dir.y * d + (r() - 0.5) * 0.12, dir.z * d);
        cartoes.push(c);
      }
    }
  }
  const galhos = mergeGeometries(cartoes.map((c) => { c.deleteAttribute('normal'); return c; }));
  galhos.computeVertexNormals();
  // normais apontando para fora (a copa fica iluminada como um volume, não como cartões)
  const p = galhos.attributes.position, nn = galhos.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3(p.getX(i), (p.getY(i) - alt * 0.55) * 0.5, p.getZ(i)).normalize();
    v.y += 0.3;
    v.normalize();
    nn.setXYZ(i, v.x, v.y, v.z);
  }
  return { tronco: troncoTudo, galhos };
}

export function criarFloresta({ qtd = 340, semente = 9, evitar = [], altura = alturaChao, dist = distEstrada, zMin = -110, zMax = 14, xLarg = 130, folga = 3.4 } = {}) {
  const r = rng(semente);
  const grupo = new THREE.Group();
  const matTronco = triplanar(casca(), { escala: 1.2, relevo: 1.4, metal: 0 });
  const matGalho = new THREE.MeshStandardMaterial({ map: galhoPinheiro(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1, metalness: 0, color: 0x6c7a66 });
  matGalho.envMapIntensity = 0.25;
  const variantes = [1, 2, 3].map((s) => geometriaPinheiro(s * 31 + semente));
  const lugares = [];
  for (let tent = 0; lugares.length < qtd && tent < qtd * 30; tent++) {
    const z = mistura(zMin, zMax, Math.pow(r(), 0.8));
    const x = (r() - 0.5) * xLarg;
    const d = dist(x, z);
    if (d < folga + r() * 2) continue;
    if (evitar.some(([ex, ez, er]) => Math.hypot(x - ex, z - ez) < er)) continue;
    lugares.push([x, z, r()]);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
  variantes.forEach((v, iv) => {
    const meus = lugares.filter((_, i) => i % 3 === iv);
    const iT = new THREE.InstancedMesh(v.tronco, matTronco, meus.length);
    const iG = new THREE.InstancedMesh(v.galhos, matGalho, meus.length);
    meus.forEach(([x, z, k], i) => {
      const esc = 0.75 + k * 0.6;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), k * 40);
      m4.compose(p3.set(x, altura(x, z) - 0.1, z), q, s3.set(esc, esc, esc));
      iT.setMatrixAt(i, m4);
      iG.setMatrixAt(i, m4);
    });
    for (const im of [iT, iG]) { im.castShadow = true; im.receiveShadow = true; grupo.add(im); }
  });
  return grupo;
}

// ---------- árvore seca (galhos tortos) ----------
export function criarArvoreSeca(semente = 4) {
  const r = rng(semente);
  const geos = [];
  const galho = (ini, dir, comp, raio, nivel) => {
    const pts = [ini.clone()];
    let p = ini.clone(), d = dir.clone();
    for (let i = 0; i < 4; i++) {
      d.add(new THREE.Vector3((r() - 0.5) * 0.5, (r() - 0.45) * 0.3, (r() - 0.5) * 0.5)).normalize();
      p = p.clone().addScaledVector(d, comp / 4);
      pts.push(p);
    }
    const curva = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curva, 8, raio, 8, false);
    // afina na ponta
    const pos = g.attributes.position;
    const seg = 9, rad = 9;
    for (let i = 0; i < pos.count; i++) {
      const anel = Math.floor(i / rad);
      const t = anel / seg;
      const c = curva.getPoint(t);
      const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).sub(c).multiplyScalar(1 - t * 0.65);
      pos.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
    }
    g.computeVertexNormals();
    geos.push(g);
    if (nivel < 3) {
      const filhos = nivel === 0 ? 4 : 3;
      for (let k = 0; k < filhos; k++) {
        const t = 0.45 + r() * 0.5;
        const base = curva.getPoint(t);
        const nd = d.clone().add(new THREE.Vector3((r() - 0.5) * 1.6, 0.2 + r() * 0.6, (r() - 0.5) * 1.6)).normalize();
        galho(base, nd, comp * (0.5 + r() * 0.2), raio * (1 - t * 0.65) * 0.75, nivel + 1);
      }
    }
  };
  galho(new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0.1, 1, 0), 5.5, 0.22, 0);
  const g = mergeGeometries(geos);
  const m = new THREE.Mesh(g, triplanar(casca(), { escala: 1.6, relevo: 1.5, metal: 0, cor: 0x9a9088 }));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ---------- pedras ----------
export function geometriaPedra(semente, achatar = 0.65) {
  const Pp = new Perlin(semente);
  const g = new THREE.IcosahedronGeometry(1, 5);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    const k = 1 + 0.28 * Pp.fbm(v.x * 1.3, v.y * 1.3, v.z * 1.3, 4) + 0.05 * Pp.fbm(v.x * 6, v.y * 6, v.z * 6, 3);
    const plano = Math.max(0, v.y + 0.1); // faces mais retas em cima
    v.multiplyScalar(k);
    v.y = v.y * achatar - plano * 0.05;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
export function criarPedras(lista, altura = alturaChao) {
  const grupo = new THREE.Group();
  const mat = triplanar(pedra(), { escala: 0.9, relevo: 1.3, metal: 0, musgo: { cor: 0x26331a, qtd: 0.85 } });
  lista.forEach(([x, z, esc, sem], i) => {
    const m = new THREE.Mesh(geometriaPedra(sem ?? i + 3), mat);
    m.scale.setScalar(esc);
    m.rotation.y = i * 1.7;
    m.position.set(x, altura(x, z) + esc * 0.15, z);
    m.castShadow = true; m.receiveShadow = true;
    grupo.add(m);
  });
  return grupo;
}

// ---------- tronco caído atravessando a estrada ----------
export function criarTronco({ x = 0.2, z = -5.5, comp = 6, raio = 0.3, giro = 0.12 } = {}) {
  const Pp = new Perlin(23);
  const g = new THREE.CylinderGeometry(raio * 0.9, raio, comp, 28, 24, false);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
    const a = Math.atan2(vz, vx);
    const k = 1 + 0.06 * Pp.fbm(Math.cos(a) * 2, vy * 0.8, Math.sin(a) * 2, 3) + 0.02 * Math.sin(a * 14 + vy * 2);
    const tampa = Math.abs(Math.abs(vy) - comp / 2) < 1e-4 && Math.hypot(vx, vz) < raio * 0.99;
    pos.setXYZ(i, vx * (tampa ? 1 : k), vy + (tampa ? Pp.ruido(vx * 9, vz * 9, 2) * 0.06 : 0), vz * (tampa ? 1 : k));
  }
  g.computeVertexNormals();
  g.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(g, triplanar(casca(), { escala: 1.3, relevo: 1.4, metal: 0, musgo: { cor: 0x2b3a1c, qtd: 0.7 } }));
  m.rotation.y = giro;
  m.position.set(x, alturaChao(x, z) + raio * 0.75, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ---------- lanterna (ferro, vidro aceso e a luz quente) ----------
export function criarLanterna({ intensidade = 5 } = {}) {
  const g = new THREE.Group();
  const ferro = new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 0.55, metalness: 0.85 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.03, 16), ferro);
  base.position.y = 0.015;
  const topo = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.08, 16), ferro);
  topo.position.y = 0.265;
  const alca = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.005, 6, 20), ferro);
  alca.position.y = 0.33;
  g.add(base, topo, alca);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.2, 0.008), ferro);
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    b.position.set(Math.cos(a) * 0.07, 0.13, Math.sin(a) * 0.07);
    g.add(b);
  }
  const vidro = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.19, 16), new THREE.MeshStandardMaterial({ color: 0x302010, emissive: 0xffa040, emissiveIntensity: 7, roughness: 0.2 }));
  vidro.position.y = 0.125;
  const chama = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 5, 1.6) }));
  chama.position.y = 0.12;
  g.add(vidro, chama);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = o !== vidro && o !== chama; o.receiveShadow = true; } });
  const luz = new THREE.PointLight(0xff9a48, intensidade, 0, 2);
  luz.position.y = 0.14;
  luz.castShadow = true;
  luz.shadow.mapSize.set(1024, 1024);
  luz.shadow.bias = -0.002;
  luz.shadow.radius = 4;
  luz.shadow.camera.near = 0.08;
  g.add(luz);
  g.userData.luz = luz;
  return g;
}

// ---------- céu: degradê, nuvens, sol/lua e estrelas (parâmetros por hora do dia) ----------
export const CEUS = {
  noite: { zenite: [0.004, 0.006, 0.014], solCor: [1.9, 2.0, 2.2], solTam: 0.9997, nuvens: 0.85, nuvemEscura: [0.012, 0.014, 0.022], estrelas: 1, brilhoExp: 6 },
  amanhecer: { zenite: [0.08, 0.1, 0.16], solCor: [9, 6.5, 4.5], solTam: 0.99985, nuvens: 0.7, nuvemEscura: [0.18, 0.15, 0.17], estrelas: 0, brilhoExp: 4 },
  nublado: { zenite: [0.16, 0.18, 0.21], solCor: [0, 0, 0], solTam: 1, nuvens: 1.0, nuvemEscura: [0.2, 0.21, 0.23], estrelas: 0, brilhoExp: 3, cobertura: 0.38 },
  tarde: { zenite: [0.1, 0.12, 0.2], solCor: [14, 7, 2.6], solTam: 0.99975, nuvens: 0.8, nuvemEscura: [0.16, 0.1, 0.09], estrelas: 0, brilhoExp: 3 },
  tempestade: { zenite: [0.003, 0.004, 0.007], solCor: [0, 0, 0], solTam: 1, nuvens: 1.0, nuvemEscura: [0.006, 0.007, 0.01], estrelas: 0, brilhoExp: 6, cobertura: 0.3 },
};
export function criarCeu({ dirLua, corNevoa, corLua, tipo = 'noite' }) {
  const c = CEUS[tipo];
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uLua: { value: dirLua.clone() }, uNevoa: { value: new THREE.Color(...corNevoa) }, uBrilho: { value: new THREE.Color(...corLua) },
      uZenite: { value: new THREE.Color(...c.zenite) }, uSolCor: { value: new THREE.Color(...c.solCor) }, uSolTam: { value: c.solTam },
      uNuvens: { value: c.nuvens }, uNuvemEscura: { value: new THREE.Color(...c.nuvemEscura) }, uEstrelas: { value: c.estrelas }, uExp: { value: c.brilhoExp }, uCobertura: { value: c.cobertura ?? 0.48 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vDir = w.xyz - cameraPosition; gl_Position = projectionMatrix * viewMatrix * w; gl_Position.z = gl_Position.w; }`,
    fragmentShader: `
      uniform vec3 uLua, uNevoa, uBrilho, uZenite, uSolCor, uNuvemEscura; uniform float uSolTam, uNuvens, uEstrelas, uExp, uCobertura; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float rn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<6;i++){ s+=a*rn(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float alt = max(d.y, 0.0);
        vec3 cor = mix(uNevoa, uZenite, pow(alt, 0.45));
        float cl = max(dot(d, uLua), 0.0);
        cor += uBrilho * pow(cl, uExp) + uBrilho * 1.6 * pow(cl, 60.0);
        vec2 q = d.xz / (d.y + 0.12) * 1.4;
        float n = fbm(q + vec2(3.0, 1.0));
        float nuvem = smoothstep(uCobertura, uCobertura + 0.27, n) * smoothstep(0.0, 0.12, d.y) * uNuvens;
        vec3 corNuvem = mix(uNuvemEscura, uBrilho * 1.3 + uNevoa * 0.5, pow(cl, 10.0) * (1.0 - smoothstep(0.6, 0.85, n)) + 0.05);
        cor = mix(cor, corNuvem, nuvem * 0.85);
        float disco = smoothstep(uSolTam - 0.0001, uSolTam, cl);
        vec3 du = normalize(cross(uLua, vec3(0.0, 1.0, 0.0)));
        vec3 dv = cross(du, uLua);
        vec2 lp = vec2(dot(d, du), dot(d, dv)) * 40.0;
        float mares = rn(lp * 2.0 + 3.0) * 0.6 + rn(lp * 5.0 + 7.0) * 0.4;
        cor = mix(cor, uSolCor * (0.72 + 0.35 * smoothstep(0.35, 0.7, mares) * uEstrelas), disco * (1.0 - nuvem * 0.7));
        float est = step(0.9985, h(floor(d.xz / (d.y + 0.3) * 260.0))) * smoothstep(0.1, 0.5, d.y) * (1.0 - nuvem);
        cor += vec3(0.9, 0.95, 1.0) * est * 0.6 * uEstrelas * (1.0 - smoothstep(0.995, 0.999, cl));
        gl_FragColor = vec4(cor, 1.0);
      }`,
  });
  const ceu = new THREE.Mesh(new THREE.SphereGeometry(450, 48, 24), m);
  ceu.frustumCulled = false;
  ceu.renderOrder = -1;
  return ceu;
}

// mapa de reflexos (ambiente) a partir do próprio céu
export function ambienteDoCeu(renderer, ceu) {
  const so = new THREE.Scene();
  so.add(ceu.clone());
  const pmrem = new THREE.PMREMGenerator(renderer);
  const t = pmrem.fromScene(so, 0, 0.1, 1000).texture;
  pmrem.dispose();
  return t;
}

// chão genérico: altura(x, z) e lama(x, z) (0..1) dão o relevo e onde há caminho de terra
export function criarTerreno({ altura, lama: lamaFn, centro = [0, 0], raio = 150, N = 480, pocas = 0.6, escala = 0.55 }) {
  const g = new THREE.PlaneGeometry(2, 2, N, N);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const aLama = new Float32Array(pos.count);
  const esticar = (u) => Math.sign(u) * Math.pow(Math.abs(u), 1.9) * raio;
  for (let i = 0; i < pos.count; i++) {
    const x = esticar(pos.getX(i)) + centro[0], z = esticar(pos.getZ(i)) + centro[1];
    pos.setXYZ(i, x, altura(x, z), z);
    aLama[i] = lamaFn(x, z);
  }
  g.setAttribute('aLama', new THREE.BufferAttribute(aLama, 1));
  g.computeVertexNormals();
  const mat = materialChao(lama(), terra(), { escala, pocas });
  mat.envMapIntensity = 0.45;
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}

// ---------- neblina em camadas (cartões grandes e suaves perto do chão) ----------
export function criarNeblina(lugares, cor) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  const Pn = new Perlin(5);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = x / 256, v = y / 256;
    const borda = Math.sin(u * Math.PI) * Math.pow(Math.sin(v * Math.PI), 1.5) * suave(0.0, 0.45, 1 - v);
    const n = clamp(0.5 + Pn.fbm(u * 4, v * 2, 0, 5) * 1.2);
    const a = clamp(n * borda * 1.3);
    const i = (y * 256 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = a * 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  const grupo = new THREE.Group();
  for (const [x, y, z, l, a, op] of lugares) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(l, a), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(...cor), transparent: true, opacity: op, depthWrite: false, fog: true }));
    m.position.set(x, y, z);
    grupo.add(m);
  }
  return grupo;
}

// ---------- toco de árvore cortada ----------
export function criarToco({ raio = 0.2, alt = 0.5 } = {}) {
  const Pp = new Perlin(31);
  const g = new THREE.CylinderGeometry(raio, raio * 1.25, alt, 24, 6, false);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
    const a = Math.atan2(vz, vx);
    const lado = Math.hypot(vx, vz) > raio * 0.98 || vy < alt / 2 - 1e-4;
    const k = lado ? 1 + 0.07 * Pp.fbm(Math.cos(a) * 2, vy * 2, Math.sin(a) * 2, 3) + (vy < -alt / 2 + 0.05 ? 0.15 : 0) : 1;
    pos.setXYZ(i, vx * k, vy + (vy > alt / 2 - 1e-4 ? Pp.ruido(vx * 7, vz * 7, 1) * 0.04 : 0), vz * k);
  }
  g.computeVertexNormals();
  g.translate(0, alt / 2, 0);
  const m = new THREE.Mesh(g, triplanar(casca(), { escala: 1.6, relevo: 1.4, metal: 0, musgo: { cor: 0x2b3a1c, qtd: 0.6 } }));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
