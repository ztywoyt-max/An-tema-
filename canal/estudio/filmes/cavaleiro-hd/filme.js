// "O Cavaleiro Sem Armadura" no motor HD: planos (câmera, atores, ações) sobre a linha do tempo travada.
// Cada fala tem espaço fixo (tempos.json); a dublagem é feita depois para caber nele.
import * as THREE from 'three';
import { cenarios } from './cenarios.js';
import { pessoa, segurarArco, criarArco, criarFlecha, criarBebe, criarTocha, criarCavalo, criarCarroca } from './elenco.js';
import { criarLanterna, estrada as EST, alturaChao } from '../../motor-hd/natureza.js';
import { cavaloAndar } from '../../motor-hd/cavalo.js';
import { tochaAcesa } from '../../motor-hd/efeitos.js';
import * as U from './util.js';
import { add } from '../../motor-hd/boneco.js';

const { camera, trilho, colocar, caminhar, somar, parado, andar, entre, lin } = U;
export { cenarios };

// ---------- elenco (montado uma vez por renderização) ----------
export const elenco = {
  damaso: () => {
    const b = pessoa('damaso');
    const fl = criarFlecha();
    fl.visible = false;
    b.raiz.add(fl);
    b.flecha = fl;
    // ferida no peito (fecha sozinha)
    const ferida = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), new THREE.MeshStandardMaterial({ color: 0x4a0806, emissive: 0x200000, roughness: 0.25, transparent: true }));
    ferida.scale.set(1, 1, 0.35);
    ferida.position.set(b.J.peito[0] + 0.075, b.J.peito[1] + 0.1, 0.118);
    ferida.visible = false;
    b.prender('peito', ferida);
    b.ferida = ferida;
    return b;
  },
  tome: () => pessoa('tome'),
  dalia: () => {
    const b = pessoa('dalia');
    const bb = criarBebe();
    bb.position.set(0.0, 1.17, 0.19);
    bb.rotation.set(0, 0.3, 0.25);
    b.prender('peito', bb);
    return b;
  },
  raposa: () => {
    const b = pessoa('raposa');
    const a = criarArco();
    segurarArco(b, a);
    b.arco = a;
    const fl = criarFlecha();
    fl.visible = false;
    b.raiz.add(fl);
    b.flecha = fl;
    return b;
  },
  bandido1: () => pessoa('bandido1'),
  bandido2: () => {
    const b = pessoa('bandido2');
    const t = tochaAcesa(criarTocha, { luz: 2.5, semente: 3 });
    t.position.set(...b.J.pulsoD);
    t.rotation.x = -0.3;
    b.prender('maoD', t);
    b.tocha = t;
    return b;
  },
  carroca: () => {
    const raiz = new THREE.Group();
    const car = criarCarroca();
    raiz.add(car);
    const cav = criarCavalo();
    cav.raiz.position.set(0, 0, 2.55);
    raiz.add(cav.raiz);
    const lant = criarLanterna({ intensidade: 3.2 });
    const haste = new THREE.Group();
    haste.position.set(0.62, 1.32, 0.88);
    lant.position.y = -0.36;
    haste.add(lant);
    raiz.add(haste);
    return { raiz, car, cav, lant, haste };
  },
};

// ---------- utilidades da estrada ----------
const C = (z) => EST.centro(z);
// a carroça anda para -z pela estrada; s = posição (z do centro da carroça)
function posCarroca(ctx, k, z) {
  const x = C(z);
  const dir = [C(z - 0.5) - C(z + 0.5), -1];
  k.raiz.position.set(x, alturaChao(x, z) + 0.02, z);
  k.raiz.rotation.y = Math.atan2(dir[0], dir[1]);
}
const Z_PARADA = -0.6;
// assentos na carroça (coordenadas da carroça)
function sentarNaCarroca(ctx, k) {
  const tome = ctx.ator('tome'), dalia = ctx.ator('dalia');
  if (tome && tome.raiz.parent !== k.raiz) k.raiz.add(tome.raiz);
  if (dalia && dalia.raiz.parent !== k.raiz) k.raiz.add(dalia.raiz);
  tome?.raiz.position.set(0.12, 0.68, 0.66);
  tome && (tome.raiz.rotation.y = 0);
  dalia?.raiz.position.set(-0.28, 0.3, -0.35);
  dalia && (dalia.raiz.rotation.y = -1.25);
}
function descerDaCarroca(ctx) {
  const tome = ctx.ator('tome');
  if (tome && tome.raiz.parent !== ctx.cena) ctx.cena.add(tome.raiz);
}
function animarCarroca(ctx, k, t, andando, dist) {
  if (andando) k.cav.pose(cavaloAndar(dist / 2.1));
  else k.cav.pose({ pescoco: [4 * Math.sin(t * 0.7), 6 * Math.sin(t * 0.4), 0], cabeca: [3 * Math.sin(t * 1.1), 0, 0], cauda: [10, 8 * Math.sin(t * 0.9), 0] });
  k.car.userData.girar(dist);
  k.haste.rotation.set(Math.sin(t * (andando ? 3.1 : 1.2)) * (andando ? 0.12 : 0.03), 0, Math.sin(t * (andando ? 2.3 : 0.9)) * (andando ? 0.1 : 0.02));
  k.lant.userData.luz.intensity = 3.2 * (0.9 + 0.06 * Math.sin(t * 13) + 0.04 * Math.sin(t * 29));
}
function poseCarroca(ctx, t, { tomeFala = null, daliaPose = U.COLO } = {}) {
  const tome = ctx.ator('tome'), dalia = ctx.ator('dalia');
  if (tome) { const p = somar(parado(t), U.SENTADO, U.REDEAS); if (tomeFala) tome.falar(p, t); tome.pose(p); }
  if (dalia) dalia.pose(somar(parado(t + 1), U.SENTADO, daliaPose));
}

// flecha cravada no peito: a ponta entra pela ferida, a haste aponta para quem atirou; fora = quanto já saiu (m)
function cravarFlecha(b, de, fora = 0) {
  b.raiz.updateMatrixWorld(true);
  const ponto = b.ferida.getWorldPosition(new THREE.Vector3());
  const dentro = new THREE.Vector3(ponto.x - de[0], 0, ponto.z - de[1]).normalize();
  dentro.y = -0.08;
  dentro.normalize();
  const cauda = ponto.clone().addScaledVector(dentro, -(0.69 + fora));
  b.raiz.worldToLocal(cauda);
  b.flecha.position.copy(cauda);
  const inv = new THREE.Quaternion().copy(b.raiz.quaternion).invert();
  b.flecha.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dentro.applyQuaternion(inv));
}

// Dâmaso arrastando a espada
const DAM_PASSO = { passo: 0.55, bracos: 0.4, passada: 1.15 };
const damAndando = (ctx, de, ate, t0, t1, tl) => caminhar(ctx, ctx.ator('damaso'), de, ate, t0, t1, tl, { ...DAM_PASSO, extra: U.ESPADA_ARRASTA });
const DAM_PARADO = [-1.0, -9.4];

// bandidos (posições de cena)
const RAP = [2.3, -6.0], B1 = [-2.4, -5.0], B2 = [3.0, -3.9];
const olharPara = (de, para) => Math.atan2(para[0] - de[0], para[1] - de[1]);

// ---------- planos ----------
// semAO: na estrada a oclusão de ambiente briga com a névoa e deixa as árvores brancas
const noite = { cenario: 'estrada', semAO: true };
const titulo = (id, cap, texto, sub, min = 5) => ({
  id, cap, cenario: 'tela', min, antes: 0, fadeIn: 1.2, fadeOut: 1.2,
  preparar: (ctx) => { ctx.cen.desenhar({ titulo: texto, sub }); ctx.cen.mostrar(); },
});

export const planos = [
  // ===== ABERTURA =====
  {
    id: 'ab1', cap: 0, ...noite, falas: ['ab.01', 'ab.02'], antes: 2.5, depois: 0.3, fadeIn: 3, atores: [],
    quadro: (ctx, tl, c) => { ctx.cen.focar(0, 0, -6); trilho(ctx, tl / c.dur, [[1.4, 1.45, 5], [-0.2, 1.4, 4]], [[0.8, 1.3, -1], [-2.3, 1.1, -10]], { linear: true }); },
  },
  {
    id: 'ab2', cap: 0, ...noite, falas: ['ab.03'], antes: 0.5, depois: 0.6, atores: ['damaso'],
    quadro: (ctx, tl, c) => {
      const z = lin(-16, -13.4, tl / c.dur);
      const x = C(z);
      ctx.cen.focar(x, 0, z);
      const p = caminhar(ctx, ctx.ator('damaso'), [x, -16], [C(-13.4), -13.4], 0, c.dur, tl, { ...DAM_PASSO, extra: U.ESPADA_ARRASTA });
      ctx.ator('damaso').pose(p);
      const k = entre(tl, 0.5, c.dur - 0.5);
      const y0 = alturaChao(x, z);
      camera(ctx, [x + 0.95, y0 + lin(0.22, 1.55, k), z + lin(1.1, 1.75, k)], [x, y0 + lin(0.15, 1.68, k), z], { fov: lin(34, 30, k) });
    },
  },
  {
    id: 'ab3', cap: 0, ...noite, falas: ['ab.04'], antes: 0.4, depois: 0.5, atores: ['damaso'],
    preparar: (ctx) => { colocar(ctx, ctx.ator('damaso'), C(-13), -13, 0.2); },
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damaso');
      b.pose(somar(parado(tl), U.ESPADA_ARRASTA, { cabeca: [6, 8 * entre(tl, 1, 6), 0] }));
      const p = b.raiz.position;
      ctx.cen.focar(p.x, 0, p.z);
      const k = tl / c.dur;
      camera(ctx, [p.x + 0.52 - k * 0.12, p.y + 1.72, p.z - 0.1 + k * 0.3], [p.x + 0.02, p.y + 1.69, p.z - 0.02 + k * 0.05], { fov: 30 });
    },
  },
  {
    id: 'ab4', cap: 0, ...noite, falas: ['ab.05'], antes: 0.4, depois: 0.2, atores: ['damaso'],
    preparar: (ctx) => { colocar(ctx, ctx.ator('damaso'), C(-13), -13, 0.0); },
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damaso');
      b.pose(somar(parado(tl), U.ESPADA_ARRASTA));
      const p = b.raiz.position;
      const k = tl / c.dur;
      camera(ctx, [p.x + 0.05, p.y + 1.66, p.z + lin(1.1, 0.75, k)], [p.x, p.y + 1.69, p.z], { fov: 30 });
    },
  },
  {
    id: 'ab5', cap: 0, ...noite, falas: ['ab.06'], antes: 0.3, depois: 2.6, fadeOut: 2.2, atores: ['damaso'],
    quadro: (ctx, tl, c) => {
      const p = damAndando(ctx, [C(-12), -12], [C(-21), -21], 0, c.dur + 1, tl);
      ctx.ator('damaso').pose(p);
      ctx.cen.focar(0, 0, -14);
      camera(ctx, [0.6, alturaChao(0.6, -7) + 1.1, -7], [C(-20), 1.0, -20], { fov: 40, tremor: 0.4, t: tl });
    },
  },
  titulo('titulo', 0, 'O CAVALEIRO SEM ARMADURA', null, 6),

  // ===== CAPÍTULO I =====
  titulo('c1', 1, 'CAPÍTULO I', 'A Estrada', 4.5),
  {
    id: '1.1a', cap: 1, ...noite, falas: ['1.1.01', '1.1.02'], antes: 1.2, depois: 0.6, fadeIn: 1.5, atores: ['carroca', 'tome', 'dalia'],
    preparar: (ctx) => sentarNaCarroca(ctx, ctx.ator('carroca')),
    quadro: (ctx, tl, c) => {
      const k = ctx.ator('carroca');
      const z = lin(26, 6, tl / c.dur);
      posCarroca(ctx, k, z);
      animarCarroca(ctx, k, tl, true, 26 - z);
      poseCarroca(ctx, tl);
      ctx.cen.focar(0, 0, 6);
      camera(ctx, [2.2, alturaChao(2.2, 2) + 0.75, 2], [C(z), 1.2, z + 1.5], { fov: 36 });
    },
  },
  {
    id: '1.1b', cap: 1, ...noite, falas: ['1.1.03'], antes: 0.4, depois: 1.0, atores: ['carroca', 'tome', 'dalia'],
    preparar: (ctx) => sentarNaCarroca(ctx, ctx.ator('carroca')),
    quadro: (ctx, tl, c) => {
      const k = ctx.ator('carroca');
      const z = lin(7.5, 1.6, tl / c.dur);
      posCarroca(ctx, k, z);
      animarCarroca(ctx, k, tl, true, 20 - z);
      poseCarroca(ctx, tl);
      ctx.cen.focar(0, 0, 0);
      trilho(ctx, tl / c.dur, [[-3.8, 4.6, 11], [0, 0.8, 2]], [[-3.2, 3.8, 6.5], [-1.2, 0.8, -8]]);
    },
  },
  {
    id: '1.1c', cap: 1, ...noite, min: 4.2, antes: 0, atores: ['carroca', 'tome', 'dalia'],
    preparar: (ctx) => sentarNaCarroca(ctx, ctx.ator('carroca')),
    quadro: (ctx, tl, c) => {
      const k = ctx.ator('carroca');
      const f = entre(tl, 0, 2.6);
      const z = lin(1.6, Z_PARADA, f);
      posCarroca(ctx, k, z);
      animarCarroca(ctx, k, tl, f < 0.98, 18.4 + (1.6 - z));
      poseCarroca(ctx, tl);
      ctx.cen.focar(0, 0, -4);
      camera(ctx, [C(z) + 0.4, 1.95, z + 1.5], [0.2, 0.7, -5.6], { fov: 40, tremor: 0.5, t: tl });
    },
  },
  {
    id: '1.2a', cap: 1, ...noite, falas: ['1.2.01'], antes: 2.2, depois: 0.6, atores: ['carroca', 'tome', 'dalia', 'raposa', 'bandido1', 'bandido2'],
    preparar: (ctx) => { sentarNaCarroca(ctx, ctx.ator('carroca')); posCarroca(ctx, ctx.ator('carroca'), Z_PARADA); },
    quadro: (ctx, tl, c) => {
      animarCarroca(ctx, ctx.ator('carroca'), tl, false, 20);
      poseCarroca(ctx, tl, {});
      const r = ctx.ator('raposa');
      const pr = caminhar(ctx, r, [4.2, -7.5], RAP, 0, 2.2, tl, { extra: U.ARCO_TENSO });
      r.raiz.rotation.y = olharPara(RAP, [-0.2, -1.3]);
      const f = c.fala(0);
      if (tl > f.t0 && tl < f.t1) r.falar(pr, tl);
      r.pose(pr);
      ctx.ator('bandido1').pose(caminhar(ctx, ctx.ator('bandido1'), [-4.5, -6.5], B1, 0.4, 2.6, tl));
      ctx.ator('bandido1').raiz.rotation.y = tl > 2.6 ? olharPara(B1, [-0.2, -1.3]) : ctx.ator('bandido1').raiz.rotation.y;
      ctx.ator('bandido2').pose(caminhar(ctx, ctx.ator('bandido2'), [5.2, -2.8], B2, 0.2, 2.4, tl, { extra: { bracoD: [-40, 0, -10], antebracoD: [-40, 0, 0] } }));
      ctx.cen.focar(1, 0, -4);
      camera(ctx, [-1.7, 2.7, 1.8], [1.6, 1.25, -6.0], { fov: 38, tremor: 0.6, t: tl });
    },
  },
  {
    id: '1.2b', cap: 1, ...noite, falas: ['1.2.02'], antes: 0.3, depois: 0.5, atores: ['carroca', 'tome', 'dalia', 'raposa'],
    preparar: (ctx) => { sentarNaCarroca(ctx, ctx.ator('carroca')); posCarroca(ctx, ctx.ator('carroca'), Z_PARADA); colocar(ctx, ctx.ator('raposa'), ...RAP, olharPara(RAP, [-0.2, -1.3])); },
    quadro: (ctx, tl, c) => {
      animarCarroca(ctx, ctx.ator('carroca'), tl, false, 20);
      const tome = ctx.ator('tome');
      const p = somar(parado(tl), U.SENTADO, { bracoE: [-60, 0, 25], antebracoE: [-80, 0, 0], bracoD: [-60, 0, -25], antebracoD: [-80, 0, 0] });
      const f = c.fala(0);
      if (tl > f.t0 && tl < f.t1) tome.falar(p, tl);
      tome.pose(p);
      ctx.ator('dalia').pose(somar(parado(tl), U.SENTADO, U.COLO));
      ctx.ator('raposa').pose(somar(parado(tl), U.ARCO_TENSO));
      ctx.cen.focar(0, 0, -1);
      camera(ctx, [1.15, 2.0, -2.8], [-0.2, 1.75, -1.25], { fov: 32, tremor: 0.3, t: tl });
    },
  },
  {
    id: '1.2c', cap: 1, ...noite, falas: ['1.2.03'], antes: 0.3, depois: 0.5, atores: ['raposa', 'bandido2', 'carroca'],
    preparar: (ctx) => { posCarroca(ctx, ctx.ator('carroca'), Z_PARADA); colocar(ctx, ctx.ator('raposa'), ...RAP, olharPara(RAP, [-0.2, -1.3])); colocar(ctx, ctx.ator('bandido2'), ...B2, olharPara(B2, [-0.2, -1.3])); },
    quadro: (ctx, tl, c) => {
      animarCarroca(ctx, ctx.ator('carroca'), tl, false, 20);
      const r = ctx.ator('raposa');
      const p = somar(parado(tl), U.ARCO_BAIXO, { cabeca: [0, -10, 8] });
      const f = c.fala(0);
      if (tl > f.t0 && tl < f.t1) r.falar(p, tl);
      r.pose(p);
      ctx.ator('bandido2').pose(somar(parado(tl + 2), { bracoD: [-60, 0, -10], antebracoD: [-50, 0, 0] }));
      ctx.cen.focar(2, 0, -5);
      const k = tl / c.dur;
      camera(ctx, [1.5 - k * 0.15, 1.6, -4.4 + k * 0.2], [2.35, 1.62, -6.0], { fov: 34 });
    },
  },
  {
    id: '1.2d', cap: 1, ...noite, falas: ['1.2.04'], antes: 0.3, depois: 0.6, atores: ['carroca', 'tome', 'dalia'],
    preparar: (ctx) => { sentarNaCarroca(ctx, ctx.ator('carroca')); posCarroca(ctx, ctx.ator('carroca'), Z_PARADA); },
    quadro: (ctx, tl, c) => {
      animarCarroca(ctx, ctx.ator('carroca'), tl, false, 20);
      poseCarroca(ctx, tl, { daliaPose: somar(U.COLO, { antebracoE: [-15, 0, 0], antebracoD: [-15, 0, 0], cabeca: [10, 0, 0] }) });
      ctx.cen.focar(0, 0, 0);
      const k = tl / c.dur;
      camera(ctx, [1.25, 1.62, 0.1 - k * 0.1], [0.22, 1.25, -0.25], { fov: 30 });
    },
  },
  {
    id: '1.2e', cap: 1, ...noite, falas: ['1.2.05'], antes: 0.3, depois: 1.2, atores: ['carroca', 'tome', 'dalia', 'damaso'],
    preparar: (ctx) => { sentarNaCarroca(ctx, ctx.ator('carroca')); posCarroca(ctx, ctx.ator('carroca'), Z_PARADA); },
    quadro: (ctx, tl, c) => {
      animarCarroca(ctx, ctx.ator('carroca'), tl, false, 20);
      poseCarroca(ctx, tl);
      ctx.ator('damaso').pose(damAndando(ctx, [C(-22), -22], [C(-19.5), -19.5], 0, c.dur, tl));
      ctx.cen.focar(-1, 0, -12);
      const k = tl / c.dur;
      camera(ctx, [0.3, 1.9, 2.8 - k * 0.6], [-1.8, 1.25, -24], { fov: lin(32, 26, k) });
    },
  },
  {
    id: '1.3a', cap: 1, ...noite, falas: ['1.3.01', '1.3.02'], antes: 0.8, depois: 0.8, atores: ['damaso'],
    quadro: (ctx, tl, c) => {
      ctx.ator('damaso').pose(damAndando(ctx, [C(-21), -21], [C(-14), -14], 0, c.dur, tl));
      ctx.cen.focar(-2, 0, -14);
      const z = -8.2;
      camera(ctx, [C(z) + 0.5, alturaChao(C(z), z) + 0.45, z], [C(-22), 1.0, -22], { fov: 30 });
    },
  },
  {
    id: '1.3b', cap: 1, ...noite, falas: ['1.3.03'], antes: 0.3, depois: 0.5, atores: ['damaso'],
    quadro: (ctx, tl, c) => {
      const zz = lin(-16, -13.2, tl / c.dur);
      ctx.ator('damaso').pose(damAndando(ctx, [C(-16), -16], [C(-13.2), -13.2], 0, c.dur, tl));
      ctx.cen.focar(C(zz), 0, zz);
      camera(ctx, [C(zz) + 1.6, alturaChao(C(zz), zz) + 0.9, zz + 2.3], [C(zz), alturaChao(C(zz), zz) + 0.75, zz], { fov: 36 });
    },
  },
  {
    id: '1.3c', cap: 1, ...noite, falas: ['1.3.04'], antes: 0.3, depois: 0.6, atores: ['damaso'],
    quadro: (ctx, tl, c) => {
      const zz = lin(-13.2, -12, tl / c.dur);
      ctx.ator('damaso').pose(damAndando(ctx, [C(-13.2), -13.2], [C(-12), -12], 0, c.dur, tl));
      ctx.cen.focar(C(zz), 0, zz);
      const y = alturaChao(C(zz), zz);
      camera(ctx, [C(zz) + 0.3, y + 1.35, zz + 0.9], [C(zz), y + 1.7, zz], { fov: 32 });
    },
  },
  {
    id: '1.3d', cap: 1, ...noite, falas: ['1.3.05'], antes: 0.2, depois: 0.4, atores: ['bandido1', 'raposa'],
    preparar: (ctx) => { colocar(ctx, ctx.ator('bandido1'), ...B1, olharPara(B1, [-1, -12])); colocar(ctx, ctx.ator('raposa'), ...RAP, olharPara(RAP, [-1, -12])); },
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('bandido1');
      const p = somar(parado(tl), U.GESTO, { peito: [-6 - 4 * Math.abs(Math.sin(tl * 9)), 0, 0], cabeca: [-8, 0, 0] });
      const f = c.fala(0);
      if (tl > f.t0 && tl < f.t1) b.falar(p, tl, 1.3);
      b.pose(p);
      ctx.ator('raposa').pose(somar(parado(tl), U.ARCO_BAIXO));
      ctx.cen.focar(-2, 0, -5);
      camera(ctx, [-2.0, 1.7, -6.6], [-2.4, 1.6, -5.0], { fov: 34 });
    },
  },
  {
    id: '1.3e', cap: 1, ...noite, falas: ['1.3.06'], antes: 0.6, depois: 0.4, atores: ['raposa', 'bandido2', 'damaso'],
    preparar: (ctx) => { colocar(ctx, ctx.ator('raposa'), ...RAP, olharPara(RAP, [-1, -12])); colocar(ctx, ctx.ator('bandido2'), ...B2, olharPara(B2, [-1, -12])); },
    quadro: (ctx, tl, c) => {
      const r = ctx.ator('raposa');
      const p = somar(parado(tl), U.ARCO_TENSO);
      const f = c.fala(0);
      if (tl > f.t0 && tl < f.t1) r.falar(p, tl, 1.2);
      r.pose(p);
      ctx.ator('bandido2').pose(somar(parado(tl), { bracoD: [-60, 0, -10], antebracoD: [-50, 0, 0] }));
      ctx.ator('damaso').pose(damAndando(ctx, [C(-12), -12], [C(-10.6), -10.6], 0, c.dur, tl));
      ctx.cen.focar(0, 0, -8);
      camera(ctx, [3.4, 1.75, -4.6], [0.6, 1.4, -9], { fov: 38 });
    },
  },
  {
    id: '1.3f', cap: 1, ...noite, falas: ['1.3.07'], antes: 0.4, depois: 0.6, atores: ['damaso', 'raposa', 'bandido1', 'bandido2', 'carroca'],
    preparar: (ctx) => { posCarroca(ctx, ctx.ator('carroca'), Z_PARADA); colocar(ctx, ctx.ator('raposa'), ...RAP, olharPara(RAP, [-1, -10])); colocar(ctx, ctx.ator('bandido1'), ...B1, olharPara(B1, [-1, -10])); colocar(ctx, ctx.ator('bandido2'), ...B2, olharPara(B2, [-1, -10])); },
    quadro: (ctx, tl, c) => {
      animarCarroca(ctx, ctx.ator('carroca'), tl, false, 20);
      ctx.ator('damaso').pose(damAndando(ctx, [C(-10.6), -10.6], DAM_PARADO, 0, c.dur, tl));
      ctx.ator('raposa').pose(somar(parado(tl), U.ARCO_TENSO));
      ctx.ator('bandido1').pose(parado(tl + 1));
      ctx.ator('bandido2').pose(somar(parado(tl + 2), { bracoD: [-60, 0, -10], antebracoD: [-50, 0, 0] }));
      ctx.cen.focar(0, 0, -6);
      camera(ctx, [0.4, 2.6, 1.6], [-0.6, 1.0, -9], { fov: 40 });
    },
  },
  {
    id: '1.4a', cap: 1, ...noite, min: 2.7, antes: 0, atores: ['raposa'],
    preparar: (ctx) => colocar(ctx, ctx.ator('raposa'), ...RAP, olharPara(RAP, DAM_PARADO)),
    quadro: (ctx, tl, c) => {
      const r = ctx.ator('raposa');
      const k = entre(tl, 0, 1.6);
      r.pose(somar(parado(tl), U.ARCO_TENSO, { antebracoD: [-120 + 40 * (1 - k), 0, 0] }));
      const solta = tl > 2.0;
      r.arco.userData.corda.scale.set(1, 1, 1);
      ctx.cen.focar(RAP[0], 0, RAP[1]);
      const p = r.raiz.position;
      const f = new THREE.Vector3(Math.sin(r.raiz.rotation.y), 0, Math.cos(r.raiz.rotation.y)), e = new THREE.Vector3(f.z, 0, -f.x);
      camera(ctx, [p.x - f.x * 0.9 + e.x * 0.45, p.y + 1.62, p.z - f.z * 0.9 + e.z * 0.45], [p.x + f.x * 2, p.y + 1.45, p.z + f.z * 2], { fov: 30, tremor: solta ? 1.2 : 0.2, t: tl * 3 });
    },
  },
  {
    id: '1.4b', cap: 1, ...noite, falas: ['1.4.01'], antes: 0.6, depois: 0.2, atores: ['damaso'],
    preparar: (ctx) => {
      const b = ctx.ator('damaso');
      colocar(ctx, b, ...DAM_PARADO, olharPara(DAM_PARADO, RAP));
      b.flecha.visible = true;
      b.ferida.visible = true;
      b.ferida.scale.setScalar(1);
    },
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damaso');
      const golpeK = Math.exp(-tl * 4);
      b.pose(somar(parado(tl), U.ESPADA_ARRASTA, { peito: [-10 * golpeK, 0, 0], coluna: [-6 * golpeK, 0, 0] }));
      cravarFlecha(b, RAP);
      const p = b.raiz.position;
      ctx.cen.focar(p.x, 0, p.z);
      camera(ctx, [p.x + 1.3, p.y + 1.45, p.z + 1.9], [p.x, p.y + 1.3, p.z], { fov: 34 });
    },
  },
  {
    id: '1.4c', cap: 1, ...noite, falas: ['1.4.02'], antes: 0.3, depois: 0.4, atores: ['damaso'],
    preparar: (ctx) => { const b = ctx.ator('damaso'); colocar(ctx, b, ...DAM_PARADO, olharPara(DAM_PARADO, RAP)); b.flecha.visible = true; b.ferida.visible = true; },
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damaso');
      const f = c.fala(0);
      const olha = entre(tl, f.t0, f.t0 + 1.2), pega = entre(tl, f.t0 + 1.8, f.t0 + 3.0), puxa = entre(tl, f.t0 + 3.6, f.t0 + 4.2);
      b.pose(somar(parado(tl), U.ESPADA_ARRASTA, U.misturar({}, U.OLHA_BAIXO, olha * (1 - puxa * 0.7)), U.misturar({}, U.MAO_NO_PEITO, pega), { antebracoE: [0, 0, 0], bracoE: [puxa * 40, 0, puxa * -35] }));
      b.mao('E', pega > 0.5 ? 'punho' : 'aberta');
      b.flecha.visible = puxa < 0.999;
      cravarFlecha(b, RAP, puxa * 0.35);
      const p = b.raiz.position;
      const fd = new THREE.Vector3(Math.sin(b.raiz.rotation.y), 0, Math.cos(b.raiz.rotation.y)), ed = new THREE.Vector3(fd.z, 0, -fd.x);
      camera(ctx, [p.x + fd.x * 1.05 + ed.x * 0.35, p.y + 1.5, p.z + fd.z * 1.05 + ed.z * 0.35], [p.x, p.y + 1.32, p.z], { fov: 34 });
    },
  },
  {
    id: '1.4d', cap: 1, ...noite, min: 3.4, antes: 0, atores: ['damaso'],
    preparar: (ctx) => { const b = ctx.ator('damaso'); colocar(ctx, b, ...DAM_PARADO, olharPara(DAM_PARADO, RAP)); b.flecha.visible = false; b.ferida.visible = true; },
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damaso');
      b.pose(somar(parado(tl), U.ESPADA_ARRASTA, U.OLHA_BAIXO));
      const k = entre(tl, 0.4, 3.0);
      b.ferida.scale.setScalar(Math.max(0.001, 1 - k));
      b.ferida.material.opacity = 1 - k * 0.8;
      const fp = b.ferida.getWorldPosition(new THREE.Vector3());
      const p = b.raiz.position;
      const lado = new THREE.Vector3(Math.sin(b.raiz.rotation.y), 0, Math.cos(b.raiz.rotation.y));
      camera(ctx, [fp.x + lado.x * 0.42 + 0.06, fp.y + 0.04, fp.z + lado.z * 0.42], [fp.x, fp.y, fp.z], { fov: 30 });
      void p;
    },
  },
  {
    id: '1.4e', cap: 1, ...noite, falas: ['1.4.03'], antes: 0.3, depois: 0.5, atores: ['bandido2', 'raposa'],
    preparar: (ctx) => { colocar(ctx, ctx.ator('bandido2'), ...B2, olharPara(B2, DAM_PARADO)); colocar(ctx, ctx.ator('raposa'), ...RAP, olharPara(RAP, DAM_PARADO)); },
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('bandido2');
      const p = somar(parado(tl), U.MEDO, { bracoD: [-50, 0, -10], antebracoD: [-60, 0, 0] });
      const f = c.fala(0);
      if (tl > f.t0 && tl < f.t1) b.falar(p, tl, 0.8);
      b.pose(p);
      ctx.ator('raposa').pose(somar(parado(tl), U.ARCO_BAIXO));
      const q = b.raiz.position;
      camera(ctx, [q.x - 0.9, q.y + 1.6, q.z - 1.1], [q.x, q.y + 1.55, q.z], { fov: 32 });
    },
  },
  {
    id: '1.5a', cap: 1, ...noite, falas: ['1.5.01'], antes: 0.3, depois: 0.5, atores: ['damaso', 'raposa'],
    preparar: (ctx) => { colocar(ctx, ctx.ator('raposa'), ...RAP, olharPara(RAP, DAM_PARADO)); ctx.ator('raposa').arco.visible = true; },
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damaso'), r = ctx.ator('raposa');
      // ele vai até o Raposa e parte o arco com um golpe
      const ate = [RAP[0] - 0.75, RAP[1] - 0.9];
      const p = caminhar(ctx, b, DAM_PARADO, ate, 0, 1.6, tl, { passo: 1, passada: 1.4 });
      const g = entre(tl, 1.7, 2.3);
      b.raiz.rotation.y = olharPara(ate, RAP);
      b.pose(tl > 1.6 ? somar(parado(tl), U.golpe(g)) : somar(p, U.ESPADA_GUARDA));
      r.arco.visible = tl < 2.15;
      r.pose(somar(parado(tl), tl < 2.15 ? U.ARCO_TENSO : U.MEDO));
      ctx.cen.focar(1, 0, -7);
      camera(ctx, [-0.4, 1.4, -4.6], [1.4, 1.2, -7.2], { fov: 36, tremor: 0.8, t: tl });
    },
  },
  {
    id: '1.5b', cap: 1, ...noite, falas: ['1.5.02'], antes: 0.2, depois: 0.4, atores: ['damaso', 'bandido1', 'bandido2'],
    preparar: (ctx) => { colocar(ctx, ctx.ator('bandido1'), -1.2, -6.6, olharPara([-1.2, -6.6], [0.4, -7.4])); colocar(ctx, ctx.ator('bandido2'), 1.6, -5.6, olharPara([1.6, -5.6], [0.4, -7.4])); },
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damaso'), b1 = ctx.ator('bandido1'), b2 = ctx.ator('bandido2');
      colocar(ctx, b, 0.4, -7.4, olharPara([0.4, -7.4], [-1.2, -6.6]) + (tl > 2.8 ? 1.4 : 0));
      const soco = entre(tl, 0.6, 0.85) * (1 - entre(tl, 1.3, 1.8));
      b.pose(somar(parado(tl), U.misturar({}, U.SOCO, soco), U.ESPADA_ARRASTA));
      b.mao('E', 'punho');
      const cai = entre(tl, 0.85, 1.5);
      b1.pose(somar(parado(tl), { raiz: [-80 * cai, 0, 0], pos: [0, -0.75 * cai, -0.3 * cai] }));
      const larga = tl > 3.6;
      b2.tocha.visible = !larga;
      b2.pose(somar(parado(tl), larga ? U.MEDO : { bracoD: [-60, 0, -10], antebracoD: [-50, 0, 0] }));
      ctx.cen.focar(0, 0, -6.5);
      camera(ctx, [2.8, 1.5, -3.6], [-0.2, 1.0, -7.0], { fov: 40, tremor: 0.7, t: tl });
    },
  },
  {
    id: '1.5c', cap: 1, ...noite, falas: ['1.5.03'], antes: 0.3, depois: 1.2, atores: ['damaso', 'raposa', 'bandido1', 'bandido2'],
    quadro: (ctx, tl, c) => {
      colocar(ctx, ctx.ator('damaso'), 0.3, -7.2, 2.6);
      ctx.ator('damaso').pose(somar(parado(tl), U.ESPADA_ARRASTA));
      ctx.ator('raposa').pose(caminhar(ctx, ctx.ator('raposa'), [1.8, -7], [9, -12], 0.2, 4.5, tl, { passo: 1.4, passada: 2.2 }));
      ctx.ator('bandido1').pose(caminhar(ctx, ctx.ator('bandido1'), [-1.2, -6.6], [-8.5, -10], 0.8, 5, tl, { passo: 1.3, passada: 2.0 }));
      ctx.ator('bandido2').pose(caminhar(ctx, ctx.ator('bandido2'), [1.6, -5.6], [8.5, -4], 0.0, 4.2, tl, { passo: 1.4, passada: 2.2 }));
      ctx.cen.focar(0, 0, -7);
      camera(ctx, [-0.6, 3.2, 1.2], [0.3, 0.8, -8.5], { fov: 46 });
    },
  },
  {
    id: '1.6a', cap: 1, ...noite, min: 4.6, antes: 0, atores: ['damaso', 'carroca', 'tome', 'dalia'],
    preparar: (ctx) => { sentarNaCarroca(ctx, ctx.ator('carroca')); posCarroca(ctx, ctx.ator('carroca'), Z_PARADA); },
    quadro: (ctx, tl, c) => {
      animarCarroca(ctx, ctx.ator('carroca'), tl, false, 20);
      poseCarroca(ctx, tl);
      const tr = ctx.cen.tronco;
      const k = entre(tl, 0.8, 4.2);
      // gira o tronco em volta da ponta esquerda, para fora da estrada
      tr.rotation.y = 0.14 + k * 1.25;
      tr.position.set(0.3 + k * 2.2, tr.position.y, -5.2 - k * 1.2);
      const b = ctx.ator('damaso');
      colocar(ctx, b, lin(-0.6, 1.0, k), lin(-4.6, -5.0, k), lin(-2.6, -2.0, k));
      b.pose(somar(parado(tl), U.EMPURRA, { coxaE: [-30 + 10 * Math.sin(tl * 3), 0, 0] }));
      ctx.cen.focar(0, 0, -5);
      camera(ctx, [3.8, 1.45, -2.0], [0.6, 0.7, -5.6], { fov: 40 });
    },
  },
  {
    id: '1.6b', cap: 1, ...noite, falas: ['1.6.01'], antes: 0.5, depois: 0.4, atores: ['damaso', 'tome', 'carroca', 'dalia'],
    preparar: (ctx) => {
      sentarNaCarroca(ctx, ctx.ator('carroca'));
      posCarroca(ctx, ctx.ator('carroca'), Z_PARADA);
      descerDaCarroca(ctx);
      const tr = ctx.cen.tronco; tr.rotation.y = 1.39; tr.position.set(2.5, tr.position.y, -6.4);
    },
    quadro: (ctx, tl, c) => {
      animarCarroca(ctx, ctx.ator('carroca'), tl, false, 20);
      ctx.ator('dalia').pose(somar(parado(tl), U.SENTADO, U.COLO));
      const tome = ctx.ator('tome');
      const p = caminhar(ctx, tome, [-0.9, -1.6], [-0.4, -3.2], 0, 1.8, tl, { passo: 0.7 });
      tome.raiz.rotation.y = olharPara([-0.4, -3.2], [0.4, -4.6]);
      const f = c.fala(0);
      const pp = somar(p, U.MEDO, { coluna: [-6, 0, 0] });
      if (tl > f.t0 && tl < f.t1) tome.falar(pp, tl);
      tome.pose(pp);
      colocar(ctx, ctx.ator('damaso'), 0.4, -4.6, olharPara([0.4, -4.6], [-0.4, -3.2]));
      ctx.ator('damaso').pose(somar(parado(tl), U.ESPADA_ARRASTA));
      ctx.cen.focar(0, 0, -4);
      camera(ctx, [1.05, 1.88, -5.6], [-0.4, 1.58, -3.2], { fov: 34 });
    },
  },
  {
    id: '1.6c', cap: 1, ...noite, falas: ['1.6.02'], antes: 0.6, depois: 0.6, atores: ['damaso', 'tome'],
    preparar: (ctx) => { descerDaCarroca(ctx); colocar(ctx, ctx.ator('tome'), -0.4, -3.2, olharPara([-0.4, -3.2], [0.4, -4.6])); colocar(ctx, ctx.ator('damaso'), 0.4, -4.6, olharPara([0.4, -4.6], [-0.4, -3.2])); },
    quadro: (ctx, tl, c) => {
      ctx.ator('tome').pose(somar(parado(tl), U.MEDO, { coluna: [-6, 0, 0] }));
      ctx.ator('damaso').pose(somar(parado(tl), U.ESPADA_ARRASTA, { cabeca: [-5, 0, 0] }));
      const p = ctx.ator('damaso').raiz.position;
      camera(ctx, [p.x - 0.35, p.y + 1.62, p.z + 0.85], [p.x, p.y + 1.7, p.z], { fov: 30 });
    },
  },
  {
    id: '1.6d', cap: 1, ...noite, falas: ['1.6.03'], antes: 0.3, depois: 0.6, atores: ['damaso', 'tome', 'carroca', 'dalia'],
    preparar: (ctx) => { sentarNaCarroca(ctx, ctx.ator('carroca')); posCarroca(ctx, ctx.ator('carroca'), Z_PARADA); descerDaCarroca(ctx); colocar(ctx, ctx.ator('tome'), -0.4, -3.2, olharPara([-0.4, -3.2], [0.4, -4.6])); colocar(ctx, ctx.ator('damaso'), 0.4, -4.6, olharPara([0.4, -4.6], [-0.4, -3.2])); },
    quadro: (ctx, tl, c) => {
      animarCarroca(ctx, ctx.ator('carroca'), tl, false, 20);
      ctx.ator('dalia').pose(somar(parado(tl), U.SENTADO, U.COLO));
      const tome = ctx.ator('tome');
      const pp = somar(parado(tl), U.GESTO, { bracoD: [0, 0, -25] });
      const f = c.fala(0);
      if (tl > f.t0 && tl < f.t1) tome.falar(pp, tl);
      tome.pose(pp);
      ctx.ator('damaso').pose(somar(parado(tl), U.ESPADA_ARRASTA));
      ctx.cen.focar(0, 0, -4);
      camera(ctx, [1.9, 1.7, -5.6], [-0.4, 1.55, -3.2], { fov: 36 });
    },
  },
  {
    id: '1.6e', cap: 1, ...noite, falas: ['1.6.04', '1.6.05'], antes: 0.4, depois: 0.8, atores: ['damaso', 'tome', 'carroca', 'dalia'],
    preparar: (ctx) => { sentarNaCarroca(ctx, ctx.ator('carroca')); posCarroca(ctx, ctx.ator('carroca'), Z_PARADA); descerDaCarroca(ctx); colocar(ctx, ctx.ator('tome'), -0.4, -3.2, olharPara([-0.4, -3.2], [0.4, -4.6])); colocar(ctx, ctx.ator('damaso'), 0.4, -4.6, olharPara([0.4, -4.6], [-0.4, -3.2])); },
    quadro: (ctx, tl, c) => {
      animarCarroca(ctx, ctx.ator('carroca'), tl, false, 20);
      ctx.ator('dalia').pose(somar(parado(tl), U.SENTADO, U.COLO));
      ctx.ator('tome').pose(parado(tl));
      // ele olha para a mulher, para o bebê e para o ferreiro
      const giro = tl < 3 ? -25 : tl < 6 ? -18 : 0;
      ctx.ator('damaso').pose(somar(parado(tl), U.ESPADA_ARRASTA, { pescoco: [8, giro * 0.5, 0], cabeca: [6, giro * 0.5, 0] }));
      const p = ctx.ator('damaso').raiz.position;
      ctx.cen.focar(0, 0, -3);
      camera(ctx, [p.x + 0.45, p.y + 1.85, p.z - 0.9], [-0.2, 1.2, -1.0], { fov: 40 });
    },
  },
  {
    id: '1.6f', cap: 1, cenario: 'estrada:aurora', falas: ['1.6.06'], antes: 0.8, depois: 7, fadeOut: 3.5, atores: ['damaso', 'carroca', 'tome', 'dalia'],
    preparar: (ctx) => { sentarNaCarroca(ctx, ctx.ator('carroca')); const tr = ctx.cen.tronco; tr.rotation.y = 1.39; tr.position.set(2.5, tr.position.y, -6.4); },
    quadro: (ctx, tl, c) => {
      const k = ctx.ator('carroca');
      const z = lin(-4, -24, tl / c.dur);
      posCarroca(ctx, k, z);
      animarCarroca(ctx, k, tl, true, 30 - z);
      poseCarroca(ctx, tl);
      ctx.ator('damaso').pose(somar(andar((30 - z) / 1.15, { passo: 0.55, bracos: 0.4 }), U.ESPADA_ARRASTA));
      colocar(ctx, ctx.ator('damaso'), C(z + 3.6), z + 3.6, Math.PI);
      ctx.cen.focar(0, 0, z);
      camera(ctx, [2.6, 2.4, 6], [C(z) - 0.5, 1.0, z - 2], { fov: 38 });
    },
  },
];

// =====================================================================
// CAPÍTULO II · Pedralva
// =====================================================================
import { criarPedraMao, criarTigela, criarEstaca, criarMalho, criarPrego, criarBengala, naMao } from './elenco.js';
import { criarVela } from '../../motor-hd/efeitos.js';
import { alturaPedralva as AP, PED, CEL0, portaCasa } from './cenarios.js';

Object.assign(elenco, {
  lia: () => pessoa('lia'),
  brana: () => {
    const b = pessoa('brana');
    const bg = criarBengala();
    naMao(b, 'D', bg, { dedos: 0.05, frente: 0.03 });
    bg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0));
    bg.position.y -= 0.0;
    b.mao('D', 'segura');
    b.bengala = bg;
    return b;
  },
  aldeao: () => pessoa('aldeao'),
  aldea: () => pessoa('aldea'),
  aldeao2: () => { const b = pessoa('aldeao'); return b; },
  pedraMao: () => ({ raiz: criarPedraMao() }),
  tigela: () => ({ raiz: criarTigela() }),
  vela: () => { const v = criarVela({ luz: 4.5 }); return { raiz: v }; },
  malho: () => ({ raiz: criarMalho() }),
});

const ped = (h) => ({ cenario: `pedralva:${h}` });
const chao = (x, z) => AP(x, z);
// a carroça em Pedralva: vem pela estrada do sul, cruza a ponte e entra na rua
function posCarrocaP(ctx, k, z) {
  const x = z > 7 ? 0.6 * Math.sin(z * 0.03) * (z > 12 ? 1 : (z - 7) / 5) : 0;
  const alt = Math.abs(z) < 7.3 ? 0.42 : chao(x, z);
  k.raiz.position.set(x, alt + 0.02, z);
  k.raiz.rotation.y = Math.PI;
}
// posição da pedra carregada (diante do peito do ator)
function pedraNoColo(b, pedra) {
  b.raiz.updateMatrixWorld(true);
  const p = new THREE.Vector3(0, b.J.peito[1] - 0.05, 0.3).applyMatrix4(b.raiz.matrixWorld);
  pedra.position.copy(p);
}
const BARRIS = [-12, -14.5];
const MONTE = [-11, -11.5], MURO = [-17.5, -15.6];
const CERCA = [13.2, -14.2], MURETA = [9.2, -13.35];
const PORTA_BRANA = [-8.0, -19.2];
const CEL = CEL0;
const celeiro = (lx, lz) => { const c = Math.cos(CEL.giro), s = Math.sin(CEL.giro); return [CEL.x + lx * c + lz * s, CEL.z - lx * s + lz * c]; };

planos.push(
  titulo('c2', 2, 'CAPÍTULO II', 'Pedralva', 4.5),
  {
    id: '2.1a', cap: 2, ...ped('amanhecer'), falas: ['2.1.01'], antes: 1.0, depois: 0.8, fadeIn: 2, atores: ['carroca', 'tome', 'dalia', 'damaso'],
    preparar: (ctx) => sentarNaCarroca(ctx, ctx.ator('carroca')),
    quadro: (ctx, tl, c) => {
      const k = ctx.ator('carroca');
      const z = lin(14, -3, tl / c.dur);
      posCarrocaP(ctx, k, z);
      animarCarroca(ctx, k, tl, true, 14 - z);
      poseCarroca(ctx, tl);
      const zd = z + 3.6, b = ctx.ator('damaso');
      b.raiz.position.set(0.2, Math.abs(zd) < 7.3 ? 0.44 : chao(0.2, zd), zd);
      b.raiz.rotation.y = Math.PI;
      b.pose(somar(andar((14 - z) / 1.15, { passo: 0.55, bracos: 0.4 }), U.ESPADA_ARRASTA));
      ctx.cen.focar(0, 0, -6);
      trilho(ctx, tl / c.dur, [[-9, 4.2, 18], [0, 1.5, 0]], [[-7, 3.2, 14], [2, 1.8, -16]]);
    },
  },
  {
    id: '2.1b', cap: 2, ...ped('amanhecer'), falas: ['2.1.02'], antes: 0.6, depois: 1.2, atores: ['carroca', 'tome', 'dalia', 'aldeao', 'aldea'],
    preparar: (ctx) => { sentarNaCarroca(ctx, ctx.ator('carroca')); colocar(ctx, ctx.ator('aldeao'), -3.4, -13.5, 1.6); colocar(ctx, ctx.ator('aldea'), 3.2, -15.5, -1.5); },
    quadro: (ctx, tl, c) => {
      const k = ctx.ator('carroca');
      const z = lin(-9, -14, tl / c.dur);
      posCarrocaP(ctx, k, z);
      animarCarroca(ctx, k, tl, true, 30 - z);
      poseCarroca(ctx, tl);
      ctx.ator('aldeao').pose(somar(parado(tl), { cabeca: [0, -20 * entre(tl, 1, 3), 0] }));
      ctx.ator('aldea').pose(somar(parado(tl + 1), { bracoD: [-20, 0, 0], antebracoD: [-100, 0, 0] }));
      ctx.cen.focar(0, 0, -14);
      camera(ctx, [-5.5, 1.6, -18.5], [0, 1.3, -12], { fov: 40 });
    },
  },
  {
    id: '2.1c', cap: 2, ...ped('amanhecer'), falas: ['2.1.03'], antes: 0.4, depois: 1.0, atores: ['damaso', 'aldeao', 'aldea', 'aldeao2'],
    preparar: (ctx) => { colocar(ctx, ctx.ator('aldeao'), -3.4, -13.5, 1.6); colocar(ctx, ctx.ator('aldea'), 3.2, -15.5, -1.5); colocar(ctx, ctx.ator('aldeao2'), 4.0, -19.5, -1.2); },
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damaso');
      const p = caminhar(ctx, b, [0, -8.5], [0, -17], 0, c.dur, tl, { ...DAM_PASSO, extra: U.ESPADA_ARRASTA });
      b.pose(p);
      const z = b.raiz.position.z;
      for (const [n, dt] of [['aldeao', 0], ['aldea', 1], ['aldeao2', 2]]) {
        const a = ctx.ator(n);
        a.raiz.rotation.y = Math.atan2(b.raiz.position.x - a.raiz.position.x, z - a.raiz.position.z);
        a.pose(parado(tl + dt));
      }
      ctx.cen.focar(0, 0, z);
      camera(ctx, [1.5, chao(1.5, z - 3.0) + 0.6, z - 3.0], [0, 1.4, z + 0.5], { fov: 36 });
    },
  },
  {
    id: '2.2a', cap: 2, ...ped('dia'), falas: ['2.2.01'], antes: 0.5, depois: 0.8, atores: ['damaso', 'aldea'],
    preparar: (ctx) => { const p = portaCasa(2, 0.5); colocar(ctx, ctx.ator('aldea'), p.x, p.z, p.giro); colocar(ctx, ctx.ator('damaso'), p.x + Math.sin(p.giro) * 1.5, p.z + Math.cos(p.giro) * 1.5, p.giro + Math.PI); },
    quadro: (ctx, tl, c) => {
      const a = ctx.ator('aldea');
      const p = somar(parado(tl), U.misturar({}, U.CONVITE, entre(tl, 0.3, 1.2)));
      const f = c.fala(0);
      if (tl > f.t0 && tl < f.t0 + 1.5) a.falar(p, tl, 0.6);
      a.pose(p);
      const b = ctx.ator('damaso');
      b.pose(somar(parado(tl), U.ESPADA_ARRASTA, tl > 2.2 && tl < 3.6 ? U.recusa(tl) : {}));
      const pp = portaCasa(2, 1.25), ld = [Math.cos(pp.giro), -Math.sin(pp.giro)];
      ctx.cen.focar(pp.x, 0, pp.z);
      camera(ctx, [pp.x + ld[0] * 3.2 + Math.sin(pp.giro) * 1.2, 1.7, pp.z + ld[1] * 3.2 + Math.cos(pp.giro) * 1.2], [pp.x, 1.4, pp.z], { fov: 36 });
    },
  },
  {
    id: '2.2b', cap: 2, ...ped('dia'), falas: ['2.2.02'], antes: 0.4, depois: 0.9, atores: ['damaso', 'aldea', 'tigela'],
    preparar: (ctx) => { const p = portaCasa(2, 0.5); colocar(ctx, ctx.ator('aldea'), p.x, p.z, p.giro); },
    quadro: (ctx, tl, c) => {
      const a = ctx.ator('aldea'), b = ctx.ator('damaso'), tg = ctx.ator('tigela').raiz;
      const vira = entre(tl, 2.6, 3.4);
      const pq = portaCasa(2, 2.0);
      colocar(ctx, b, pq.x, pq.z, pq.giro + Math.PI + vira * 2.6);
      const pega = entre(tl, 1.2, 2.0);
      a.pose(somar(parado(tl), U.misturar({ bracoE: [-50, 0, 0], antebracoE: [-60, 0, 0], bracoD: [-50, 0, 0], antebracoD: [-60, 0, 0] }, {}, pega)));
      b.pose(somar(parado(tl), U.ESPADA_ARRASTA, U.misturar({}, { bracoE: [-45, 0, 10], antebracoE: [-70, 0, 0] }, pega)));
      // a tigela passa das mãos dela para a mão dele
      const mA = a.ossos.maoE.getWorldPosition(new THREE.Vector3()), mB = b.ossos.maoE.getWorldPosition(new THREE.Vector3());
      tg.position.copy(mA.lerp(mB, pega)).add(new THREE.Vector3(0, 0.03, 0));
      if (vira > 0) {
        const p = caminhar(ctx, b, [pq.x, pq.z], [pq.x + Math.cos(pq.giro) * 4, pq.z - Math.sin(pq.giro) * 4], 3.2, c.dur, tl, { ...DAM_PASSO, extra: U.ESPADA_ARRASTA });
        b.pose(somar(p, { bracoE: [-45, 0, 10], antebracoE: [-70, 0, 0] }));
        b.raiz.updateMatrixWorld(true);
        tg.position.copy(b.ossos.maoE.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, 0.03, 0));
      }
      const pp = portaCasa(2, 1.25), ld = [Math.cos(pp.giro), -Math.sin(pp.giro)];
      ctx.cen.focar(pp.x, 0, pp.z);
      camera(ctx, [pp.x + ld[0] * 2.4 + Math.sin(pp.giro) * 0.8, 1.6, pp.z + ld[1] * 2.4 + Math.cos(pp.giro) * 0.8], [pp.x, 1.3, pp.z], { fov: 34 });
    },
  },
  {
    id: '2.2c', cap: 2, ...ped('dia'), falas: ['2.2.03'], antes: 0.4, depois: 0.8, atores: ['damaso', 'pedraMao'],
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damaso');
      const p = caminhar(ctx, b, MONTE, MURO, 0.4, c.dur - 0.6, tl, { passo: 0.7, bracos: 0, passada: 1.2, extra: U.CARREGA });
      b.pose(p);
      b.mao('D', 'aberta');
      b.espada.visible = false;
      pedraNoColo(b, ctx.ator('pedraMao').raiz);
      const q = b.raiz.position;
      ctx.cen.focar(q.x, 0, q.z);
      camera(ctx, [q.x + 2.4, chao(q.x + 2.4, q.z + 2) + 1.2, q.z + 2.2], [q.x, q.y + 1.1, q.z], { fov: 38 });
    },
  },
  {
    id: '2.2d', cap: 2, ...ped('noite'), falas: ['2.2.04'], antes: 0.5, depois: 1.4, atores: ['damaso', 'vela'],
    preparar: (ctx) => {
      const b = ctx.ator('damaso');
      const [vx, vz] = celeiro(1.6, -1.4);
      ctx.ator('vela').raiz.position.set(vx, chao(vx, vz), vz);
      const [x, z] = celeiro(2.6, -2.2);
      colocar(ctx, b, x, z, CEL.giro - Math.PI / 2);
      b.espada.visible = true;
      b.mao('D', 'segura');
      ctx.cen.preencher(0.35);
      ctx.cen.base.userData.celeiro.userData.abrir(0.35);
    },
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damaso');
      b.pose(somar(parado(tl * 0.5), U.SENTADO_CHAO, { maoD: [-10, 90, 0], antebracoD: [-75, 0, 0], pescoco: [18, 0, 0] }));
      ctx.ator('vela').raiz.userData.atualizar(ctx.tempoFilme);
      const [cx, cz] = celeiro(-1.2, 3.8), [ax, az] = celeiro(2.4, -2.2);
      ctx.cen.focar(CEL.x, 0, CEL.z);
      const k = tl / c.dur;
      camera(ctx, [cx, chao(cx, cz) + 1.5 - k * 0.2, cz], [ax, chao(ax, az) + 0.7, az], { fov: 40 });
    },
  },
  {
    id: '2.3a', cap: 2, ...ped('dia'), falas: ['2.3.01', '2.3.02'], antes: 0.5, depois: 0.8, atores: ['damaso', 'lia', 'pedraMao'],
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damaso'), l = ctx.ator('lia');
      b.espada.visible = false;
      b.mao('D', 'aberta');
      b.pose(caminhar(ctx, b, MURO, MONTE, 0, c.dur * 0.45, tl, { passo: 0.8, passada: 1.4 }));
      if (tl > c.dur * 0.45) b.pose(caminhar(ctx, b, MONTE, MURO, c.dur * 0.55, c.dur + 3, tl, { passo: 0.7, bracos: 0, passada: 1.2, extra: U.CARREGA }));
      pedraNoColo(b, ctx.ator('pedraMao').raiz);
      ctx.ator('pedraMao').raiz.visible = tl > c.dur * 0.5;
      colocar(ctx, l, BARRIS[0] + 0.35, BARRIS[1] - 0.6, Math.atan2(b.raiz.position.x - BARRIS[0], b.raiz.position.z - BARRIS[1]));
      l.pose(somar(parado(tl), U.ESPIA, { cabeca: [0, 0, 10 * Math.sin(tl * 1.3)] }));
      ctx.cen.focar(-13, 0, -13);
      camera(ctx, [-9.4, 1.0, -16.6], [-13.2, 0.8, -12.6], { fov: 40 });
    },
  },
  {
    id: '2.3b', cap: 2, ...ped('dia'), falas: ['2.3.03'], antes: 0.6, depois: 0.6, atores: ['damaso', 'lia', 'pedraMao'],
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damaso'), l = ctx.ator('lia');
      b.espada.visible = false;
      b.mao('D', 'aberta');
      b.pose(caminhar(ctx, b, [-13, -13.2], [-15.6, -14.6], 0, c.dur + 2, tl, { passo: 0.7, bracos: 0, passada: 1.2, extra: U.CARREGA }));
      pedraNoColo(b, ctx.ator('pedraMao').raiz);
      colocar(ctx, l, -12.6, -14.6, Math.atan2(b.raiz.position.x + 12.6, b.raiz.position.z + 14.6));
      const p = somar(parado(tl), U.CINTURA, { cabeca: [-12, 0, 8] });
      const f = c.fala(0);
      if (tl > f.t0 && tl < f.t1) l.falar(p, tl);
      l.pose(p);
      ctx.cen.focar(-13, 0, -14);
      const q = l.raiz.position;
      const fl = [Math.sin(l.raiz.rotation.y), Math.cos(l.raiz.rotation.y)];
      camera(ctx, [q.x + fl[0] * 1.3 + fl[1] * 0.3, q.y + 1.1, q.z + fl[1] * 1.3 - fl[0] * 0.3], [q.x, q.y + 1.05, q.z], { fov: 36 });
    },
  },
  {
    id: '2.3c', cap: 2, ...ped('dia'), falas: ['2.3.04'], antes: 0.3, depois: 0.5, atores: ['damaso', 'lia', 'pedraMao'],
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damaso'), l = ctx.ator('lia');
      b.espada.visible = false;
      b.mao('D', 'aberta');
      b.pose(caminhar(ctx, b, [-14.4, -14.0], [-17.2, -15.4], 0, c.dur, tl, { passo: 0.7, bracos: 0, passada: 1.2, extra: U.CARREGA }));
      pedraNoColo(b, ctx.ator('pedraMao').raiz);
      const p = caminhar(ctx, l, [-13.9, -13.3], [-16.6, -14.5], 0, c.dur, tl, { passo: 1.0, passada: 0.9 });
      l.raiz.rotation.y += 0.6;
      const f = c.fala(0);
      if (tl > f.t0 && tl < f.t1) l.falar(p, tl);
      l.pose(p);
      const q = b.raiz.position;
      ctx.cen.focar(q.x, 0, q.z);
      camera(ctx, [q.x + 1.2, q.y + 1.2, q.z + 3.4], [q.x - 0.4, q.y + 1.05, q.z], { fov: 36 });
    },
  },
  {
    id: '2.3d', cap: 2, ...ped('dia'), falas: ['2.3.05'], antes: 0.3, depois: 2.2, atores: ['damaso', 'lia', 'pedraMao'],
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damaso'), l = ctx.ator('lia');
      b.espada.visible = false;
      b.mao('D', 'aberta');
      const f = c.fala(0);
      // ele para por um segundo depois do apelido, e segue
      const para = f.t1 + 0.1, segue = f.t1 + 1.3;
      const k = tl < para ? tl / para * 0.4 : tl < segue ? 0.4 : 0.4 + (tl - segue) / (c.dur - segue) * 0.6;
      const x = lin(-17.2, -18.4, k), z = lin(-15.4, -15.8, k);
      colocar(ctx, b, x, z, Math.atan2(-1.2, -0.4));
      const anda = tl < para || tl > segue;
      b.pose(somar(anda ? andar(k * 3, { passo: 0.7, bracos: 0 }) : somar(parado(tl), { cabeca: [0, 25, 0] }), U.CARREGA));
      pedraNoColo(b, ctx.ator('pedraMao').raiz);
      colocar(ctx, l, -16.0, -14.6, Math.atan2(x + 16, z + 14.6));
      const p = somar(parado(tl), U.CINTURA);
      if (tl > f.t0 && tl < f.t1) l.falar(p, tl);
      if (tl > segue) Object.assign(p, { bracoE: [-150, 0, 20], antebracoE: [-20, 0, 0] });
      l.pose(p);
      ctx.cen.focar(-17, 0, -15);
      camera(ctx, [-14.2, 1.3, -12.6], [-17.2, 1.0, -15.4], { fov: 40 });
    },
  },
);

// --- a cerca, ao pôr do sol ---
function cenaCerca(ctx, tl, c, { falando = {}, golpes = true, olhaLia = 0 } = {}) {
  const b = ctx.ator('damaso'), l = ctx.ator('lia');
  b.espada.visible = false;
  colocar(ctx, b, CERCA[0], CERCA[1] + 0.55, Math.PI - 0.5);
  const pb = golpes ? somar(parado(tl), U.martelo((tl * 0.55) % 1)) : somar(parado(tl), { cabeca: [0, olhaLia, 0] });
  if (falando.enferrujado) b.mao('D', 'aberta');
  else b.mao('D', golpes ? 'punho' : 'aberta');
  b.pose(pb);
  colocar(ctx, l, MURETA[0], MURETA[1], Math.PI * 0.62, 0.36);
  const pl = somar(parado(tl), U.sentadoMureta(tl), { cabeca: [0, -30, 0] });
  if (falando.lia) l.falar(pl, tl);
  l.pose(pl);
  const m = ctx.ator('malho').raiz;
  b.raiz.updateMatrixWorld(true);
  m.position.copy(b.ossos.maoD.getWorldPosition(new THREE.Vector3()));
  m.quaternion.copy(b.ossos.maoD.getWorldQuaternion(new THREE.Quaternion()));
  m.visible = golpes;
  ctx.cen.focar(11, 0, -14);
}
const falaAtiva = (c, tl) => { const f = c.falas.find((x) => tl > x.t0 && tl < x.t1); return f ? { [f.voz]: true } : {}; };
const cerca = { ...ped('tarde'), atores: ['damaso', 'lia', 'malho'] };

planos.push(
  {
    id: '2.4a', cap: 2, ...cerca, falas: ['2.4.01'], antes: 2.0, depois: 0.5, fadeIn: 1,
    quadro: (ctx, tl, c) => { cenaCerca(ctx, tl, c, { falando: falaAtiva(c, tl) }); trilho(ctx, tl / c.dur, [[6.2, 1.9, -9.0], [11, 1.0, -13.6]], [[6.8, 1.6, -9.8], [11, 1.0, -13.6]]); },
  },
  {
    id: '2.4b', cap: 2, ...cerca, falas: ['2.4.02', '2.4.03'], antes: 0.4, depois: 0.5,
    quadro: (ctx, tl, c) => {
      cenaCerca(ctx, tl, c, { falando: falaAtiva(c, tl), golpes: false, olhaLia: 35 });
      if (falaAtiva(c, tl).enferrujado) ctx.ator('damaso').pose(somar(parado(tl), { cabeca: [-4, 35, 0] }));
      const b = ctx.ator('damaso'), q = b.raiz.position, fb = [Math.sin(b.raiz.rotation.y + 0.9), Math.cos(b.raiz.rotation.y + 0.9)];
      camera(ctx, [q.x + fb[0] * 2.2, q.y + 1.5, q.z + fb[1] * 2.2], [q.x, q.y + 1.4, q.z], { fov: 34 });
    },
  },
  {
    id: '2.4c', cap: 2, ...cerca, falas: ['2.4.04'], antes: 0.4, depois: 1.2,
    quadro: (ctx, tl, c) => {
      cenaCerca(ctx, tl, c, { falando: falaAtiva(c, tl), golpes: false, olhaLia: 30 });
      const b = ctx.ator('damaso'), q = b.raiz.position, fb = [Math.sin(b.raiz.rotation.y + 0.5), Math.cos(b.raiz.rotation.y + 0.5)];
      camera(ctx, [q.x + fb[0] * 0.9, q.y + 1.62, q.z + fb[1] * 0.9], [q.x, q.y + 1.68, q.z], { fov: 30 });
    },
  },
  {
    id: '2.4d', cap: 2, ...cerca, falas: ['2.4.05'], antes: 0.6, depois: 0.8,
    quadro: (ctx, tl, c) => {
      cenaCerca(ctx, tl, c, { falando: {}, golpes: tl > 2.5 });
      ctx.ator('lia').pose(somar(parado(tl), U.sentadoMureta(tl * 0.4), { cabeca: [10, -10, 0], bracoE: [-60, 0, 0], antebracoE: [-130, 0, 0] }));
      trilho(ctx, tl / c.dur, [[13.5, 1.2, -5.5], [10.5, 1.1, -13.6]], [[12.5, 1.6, -6.8], [10.5, 1.2, -13.6]]);
    },
  },
  {
    id: '2.4e', cap: 2, ...cerca, falas: ['2.4.06'], antes: 0.6, depois: 0.4,
    quadro: (ctx, tl, c) => {
      cenaCerca(ctx, tl, c, { falando: falaAtiva(c, tl), golpes: false, olhaLia: 30 });
      const q = ctx.ator('lia').raiz.position;
      camera(ctx, [q.x + 1.3, q.y + 1.1, q.z + 0.4], [q.x, q.y + 1.0, q.z], { fov: 34 });
    },
  },
  {
    id: '2.4f', cap: 2, ...cerca, falas: ['2.4.07'], antes: 1.4, depois: 1.6,
    quadro: (ctx, tl, c) => {
      cenaCerca(ctx, tl, c, { falando: falaAtiva(c, tl), golpes: false, olhaLia: 10 });
      ctx.ator('damaso').pose(somar(parado(tl), { cabeca: [8, 10, 0], pescoco: [6, 0, 0] }));
      const b = ctx.ator('damaso'), q = b.raiz.position, fb = [Math.sin(b.raiz.rotation.y + 0.2), Math.cos(b.raiz.rotation.y + 0.2)];
      const k = tl / c.dur;
      camera(ctx, [q.x + fb[0] * (1.0 - k * 0.2), q.y + 1.68, q.z + fb[1] * (1.0 - k * 0.2)], [q.x, q.y + 1.7, q.z], { fov: 28 });
    },
  },
  // --- Brana ---
  {
    id: '2.5a', cap: 2, ...ped('tarde'), falas: ['2.5.01'], antes: 0.6, depois: 0.6, atores: ['brana', 'damaso', 'lia', 'malho'],
    quadro: (ctx, tl, c) => {
      cenaCerca(ctx, tl, c, { golpes: true });
      const br = ctx.ator('brana');
      colocar(ctx, br, PORTA_BRANA[0] + 0.9, PORTA_BRANA[1] + 1.2, Math.atan2(CERCA[0] - PORTA_BRANA[0], CERCA[1] - PORTA_BRANA[1]));
      br.pose(somar(parado(tl * 0.6), U.VELHA));
      ctx.cen.focar(0, 0, -16);
      camera(ctx, [-4.6, 1.5, -21.6], [-6.4, 1.3, -17.4], { fov: 34 });
    },
  },
  {
    id: '2.5b', cap: 2, ...ped('tarde'), falas: ['2.5.02'], antes: 0.3, depois: 0.4, atores: ['brana'],
    quadro: (ctx, tl, c) => {
      const br = ctx.ator('brana');
      colocar(ctx, br, PORTA_BRANA[0] + 0.9, PORTA_BRANA[1] + 1.2, Math.atan2(CERCA[0] - PORTA_BRANA[0], CERCA[1] - PORTA_BRANA[1]));
      br.pose(somar(parado(tl * 0.6), U.VELHA, { bracoE: [-30, 0, 10], antebracoE: [-60, 30, 0] }));
      br.raiz.updateMatrixWorld(true);
      const mao = br.ossos.maoD.getWorldPosition(new THREE.Vector3());
      const k = tl / c.dur;
      ctx.cen.focar(mao.x, 0, mao.z);
      camera(ctx, [mao.x + 0.5, mao.y + 0.12, mao.z + 0.32 - k * 0.05], [mao.x, mao.y - 0.02, mao.z], { fov: 30 });
    },
  },
  {
    id: '2.5c', cap: 2, ...ped('tarde'), min: 3.6, antes: 0, atores: ['brana'],
    quadro: (ctx, tl, c) => {
      const br = ctx.ator('brana');
      const de = [PORTA_BRANA[0] + 0.9, PORTA_BRANA[1] + 1.2];
      const p = caminhar(ctx, br, de, PORTA_BRANA, 0.8, 3.4, tl, { passo: 0.45, passada: 0.7, extra: U.VELHA });
      br.pose(p);
      ctx.cen.focar(-8, 0, -19);
      camera(ctx, [-4.2, 1.6, -16.0], [-8.2, 1.2, -19.3], { fov: 34 });
    },
  },
  // --- noite: o celeiro e os riscos ---
  {
    id: '2.6a', cap: 2, ...ped('noite'), falas: ['2.6.01'], antes: 0.8, depois: 0.6, fadeIn: 1.2, atores: ['lia', 'vela', 'damaso'],
    preparar: (ctx) => {
      ctx.cen.base.userData.celeiro.userData.abrir(0.03);
      const [vx, vz] = celeiro(0.0, 1.0);
      ctx.ator('vela').raiz.position.set(vx, chao(vx, vz), vz);
      const [dx, dz] = celeiro(0.0, 1.6);
      colocar(ctx, ctx.ator('damaso'), dx, dz, CEL.giro + Math.PI);
    },
    quadro: (ctx, tl, c) => {
      ctx.ator('damaso').pose(somar(parado(tl * 0.4), U.SENTADO_CHAO, { coxaE: [-80, 0, 30], coxaD: [-80, 0, -30], pernaE: [100, 0, 0], pernaD: [100, 0, 0] }));
      const l = ctx.ator('lia');
      const [ax, az] = celeiro(-3.5, 9.5), [bx, bz] = celeiro(-0.5, 6.0);
      l.pose(caminhar(ctx, l, [ax, az], [bx, bz], 0, c.dur - 0.5, tl, { passo: 0.6, passada: 0.75, extra: { coluna: [14, 0, 0] } }));
      ctx.cen.atualizar(tl, ctx.tempoFilme);
      ctx.ator('vela').raiz.userData.atualizar(ctx.tempoFilme);
      ctx.cen.focar(CEL.x, 0, CEL.z);
      ctx.cen.preencher(0.6);
      const [cx, cz] = celeiro(2.5, 11);
      camera(ctx, [cx, chao(cx, cz) + 1.4, cz], [bx, 1.0, bz], { fov: 40 });
    },
  },
  {
    id: '2.6b', cap: 2, ...ped('noite'), falas: ['2.6.02'], antes: 0.6, depois: 0.6, atores: ['damaso', 'vela'],
    preparar: (ctx) => {
      ctx.cen.base.userData.celeiro.userData.abrir(0.03);
      ctx.cen.preencher(0.3);
      const [vx, vz] = celeiro(0.0, 1.0);
      ctx.ator('vela').raiz.position.set(vx, chao(vx, vz), vz);
      const [dx, dz] = celeiro(0.0, 1.6);
      colocar(ctx, ctx.ator('damaso'), dx, dz, CEL.giro + Math.PI);
      ctx.ator('damaso').espada.visible = false;
    },
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damaso');
      const risco = Math.sin(tl * 2.2) * 0.5 + 0.5;
      b.pose(somar(parado(tl * 0.4), U.SENTADO_CHAO, { coxaE: [-80, 0, 30], coxaD: [-80, 0, -30], pernaE: [100, 0, 0], pernaD: [100, 0, 0] }, U.RISCA, { antebracoD: [-95 + risco * 12, 0, 0] }));
      b.mao('D', 'punho');
      ctx.ator('vela').raiz.userData.atualizar(ctx.tempoFilme);
      const [cx, cz] = celeiro(0.5, 3.4);
      ctx.cen.focar(CEL.x, 0, CEL.z);
      camera(ctx, [cx, chao(cx, cz) + 1.25, cz], [b.raiz.position.x, b.raiz.position.y + 1.05, b.raiz.position.z], { fov: 36 });
    },
  },
  {
    id: '2.6c', cap: 2, ...ped('noite'), falas: ['2.6.03'], antes: 0.3, depois: 0.3, atores: ['lia', 'vela'],
    preparar: (ctx) => {
      ctx.cen.base.userData.celeiro.userData.abrir(0.03);
      ctx.cen.preencher(0.45);
      const [bx, bz] = celeiro(-0.25, 5.75);
      colocar(ctx, ctx.ator('lia'), bx, bz, CEL.giro + Math.PI);
    },
    quadro: (ctx, tl, c) => {
      const l = ctx.ator('lia');
      // conta nos dedos, mexendo a boca sem som
      const p = somar(parado(tl), { coluna: [10, 0, 0], bracoE: [-50, 0, -10], antebracoE: [-110, 0, 0] });
      l.falar(p, tl, 0.35);
      l.pose(p);
      l.mao('E', Math.floor(tl * 2.5) % 2 ? 'meia' : 'aberta');
      const q = l.raiz.position;
      const f = new THREE.Vector3(Math.sin(l.raiz.rotation.y), 0, Math.cos(l.raiz.rotation.y));
      camera(ctx, [q.x + f.x * 0.55 + 0.1, q.y + 1.08, q.z + f.z * 0.55], [q.x, q.y + 1.07, q.z], { fov: 30 });
    },
  },
  {
    id: '2.6d', cap: 2, ...ped('noite'), falas: ['2.6.04'], antes: 0.4, depois: 3.0, fadeOut: 2.4, atores: ['damaso', 'vela'],
    preparar: (ctx) => {
      ctx.cen.preencher(0.3);
      const [vx, vz] = celeiro(0.0, 1.0);
      ctx.ator('vela').raiz.position.set(vx, chao(vx, vz), vz);
      const [dx, dz] = celeiro(0.0, 1.6);
      colocar(ctx, ctx.ator('damaso'), dx, dz, CEL.giro + Math.PI);
    },
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damaso');
      b.pose(somar(parado(tl * 0.4), U.SENTADO_CHAO, { coxaE: [-80, 0, 30], coxaD: [-80, 0, -30], pernaE: [100, 0, 0], pernaD: [100, 0, 0] }));
      ctx.ator('vela').raiz.userData.atualizar(ctx.tempoFilme);
      b.raiz.updateMatrixWorld(true);
      const cap = b.capacete.getWorldPosition(new THREE.Vector3());
      const lado = new THREE.Vector3(Math.cos(b.raiz.rotation.y), 0, -Math.sin(b.raiz.rotation.y));
      const k = tl / c.dur;
      camera(ctx, [cap.x + lado.x * 0.5, cap.y + 0.14, cap.z + lado.z * 0.5], [cap.x, cap.y + 0.12 + k * 0.02, cap.z], { fov: 30 - k * 4 });
    },
  },
);

// =====================================================================
// CAPÍTULO III · Brumal (flashback em sépia)
// =====================================================================
import { alturaBrumal as AB, BRU } from './cenarios.js';
import { criarLanca, criarElmoSoldado } from './elenco.js';
import { criarEspada } from '../../motor-hd/cavaleiro.js';
import { criarParticulas } from '../../motor-hd/efeitos.js';

const MONTADO = { coxaE: [-72, 0, 32], coxaD: [-72, 0, -32], pernaE: [75, 0, 0], pernaD: [75, 0, 0], peE: [-10, 0, 0], peD: [-10, 0, 0], pos: [0, -0.36, 0] };
function soldado() {
  const b = pessoa('soldado');
  const e = criarElmoSoldado();
  e.position.set(b.J.centroCabeca[0], b.J.centroCabeca[1] + 0.02, b.J.centroCabeca[2] - 0.01);
  b.prender('cabeca', e);
  const l = criarLanca();
  naMao(b, 'D', l, { dedos: 0.05, frente: 0.03 });
  b.mao('D', 'segura');
  b.lanca = l;
  return b;
}
function pecaDourada(tipo) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffc860, metalness: 1, roughness: 0.25 });
  const g = tipo === 'ombro' ? new THREE.SphereGeometry(0.11, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2) : tipo === 'peito' ? new THREE.SphereGeometry(0.2, 20, 12, 0, Math.PI, 0, Math.PI) : new THREE.BoxGeometry(0.1, 0.24, 0.1);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  if (tipo === 'peito') m.scale.set(1, 1.2, 0.6);
  return m;
}
Object.assign(elenco, {
  dourado: () => pessoa('dourado'),
  cavaloDourado: () => { const c = criarCavalo({ cor: 0xd8d0c4, crina: 0xe8e0d0, chave: 'cavalo-branco-v1' }); return c; },
  malvarJovem: () => pessoa('malvarJovem'),
  branaJovem: () => {
    const b = pessoa('branaJovem');
    const cr = criarBebe();
    cr.scale.set(2.6, 1.6, 1.6);
    cr.position.set(0.0, 1.12, 0.24);
    cr.rotation.set(0, 0.2, 0.5);
    b.prender('peito', cr);
    return b;
  },
  soldado1: soldado, soldado2: soldado, soldado3: soldado, soldado4: soldado,
  aldeaoB: () => pessoa('aldeao'), aldeaB: () => pessoa('aldea'),
  pecas: () => {
    const g = new THREE.Group();
    const ps = ['peito', 'ombro', 'ombro', 'braco', 'braco'].map((t, i) => { const m = pecaDourada(t); m.position.set(0.25 + i * 0.12, 0.06, (i % 2) * 0.15); m.rotation.set(i, i * 2, 0); g.add(m); return m; });
    return { raiz: g, ps };
  },
  espadas: () => {
    const g = new THREE.Group();
    const nova = criarEspada({ nova: true }), velha = criarEspada();
    velha.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; } });
    g.add(nova, velha);
    return { raiz: g, nova, velha };
  },
  damasoSem: () => {
    // o próprio Dâmaso (corpo forte, só cueca), sem capacete e sem espada: para o rio
    const b = pessoa('damasoRosto');
    b.espada.visible = false;
    return b;
  },
});
const bru = (h) => ({ cenario: `brumal:${h}` });
const SEP = { cenario: 'brumal:sepia' };
const montarCavalo = (ctx, cav, cav0, x, z, giro) => {
  const alt = ctx.cen.altura(x, z);
  cav.raiz.position.set(x, alt, z);
  cav.raiz.rotation.y = giro;
  cav0.raiz.position.set(x + Math.sin(giro) * 0.05, alt + 0.98, z + Math.cos(giro) * 0.05);
  cav0.raiz.rotation.y = giro;
};
const TROPA = [[-1.4, -3.5], [1.4, -3.5], [-1.4, -5.2], [1.4, -5.2]];

planos.push(
  { ...titulo('c3', 3, 'CAPÍTULO III', 'Brumal', 4.5), preparar: (ctx) => { ctx.cen.desenhar({ titulo: 'CAPÍTULO III', sub: 'Brumal', corTitulo: '#d8b878', corLinha: '#8a6a2a' }); ctx.cen.mostrar(); } },
  {
    id: '3.1a', cap: 3, ...SEP, falas: ['3.1.01'], antes: 1.0, depois: 0.6, fadeIn: 1.2, atores: ['dourado', 'cavaloDourado'],
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('dourado'), cv = ctx.ator('cavaloDourado');
      montarCavalo(ctx, cv, b, 0, 0, 0);
      cv.pose({ pescoco: [4 * Math.sin(tl * 0.8), 0, 0], cauda: [12, 6 * Math.sin(tl), 0] });
      b.pose(somar(parado(tl), MONTADO, { bracoD: [-20, 0, 0], antebracoD: [-40, 0, 0] }));
      ctx.cen.focar(0, 0, 0);
      b.raiz.updateMatrixWorld(true);
      const cap = b.capacete.getWorldPosition(new THREE.Vector3());
      const k = tl / c.dur;
      camera(ctx, [cap.x + 0.35, cap.y + 0.12, cap.z + 0.55 + k * 1.6], [cap.x, cap.y + 0.12, cap.z], { fov: 30 + k * 10 });
    },
  },
  {
    id: '3.1b', cap: 3, ...SEP, falas: ['3.1.02'], antes: 0.4, depois: 1.0, atores: ['dourado', 'cavaloDourado', 'soldado1', 'soldado2', 'soldado3', 'soldado4'],
    preparar: (ctx) => { TROPA.forEach(([x, z], i) => colocar(ctx, ctx.ator(`soldado${i + 1}`), x, z, 0)); },
    quadro: (ctx, tl, c) => {
      montarCavalo(ctx, ctx.ator('cavaloDourado'), ctx.ator('dourado'), 0, 0, 0);
      ctx.ator('cavaloDourado').pose({ pescoco: [4 * Math.sin(tl * 0.8), 0, 0], cauda: [12, 6 * Math.sin(tl), 0] });
      ctx.ator('dourado').pose(somar(parado(tl), MONTADO, { bracoD: [-20, 0, 0], antebracoD: [-40, 0, 0] }));
      TROPA.forEach((_, i) => ctx.ator(`soldado${i + 1}`).pose(somar(parado(tl + i), { bracoD: [-15, 0, 0], antebracoD: [-60, 0, 0] })));
      ctx.cen.focar(0, 0, -2);
      camera(ctx, [2.6, 1.3, 6.0], [0, 2.0, 0], { fov: 36 });
    },
  },
  {
    id: '3.1c', cap: 3, ...SEP, falas: ['3.1.03'], antes: 0.3, depois: 0.6, atores: ['dourado', 'cavaloDourado', 'soldado1', 'soldado2', 'soldado3', 'soldado4'],
    quadro: (ctx, tl, c) => {
      const z0 = lin(-4, 6, tl / c.dur);
      montarCavalo(ctx, ctx.ator('cavaloDourado'), ctx.ator('dourado'), 0, z0, 0);
      ctx.ator('cavaloDourado').pose(cavaloAndar((z0 + 4) / 2.1));
      ctx.ator('dourado').pose(somar(parado(tl), MONTADO, { bracoD: [-20, 0, 0], antebracoD: [-40, 0, 0], raiz: [0, 0, 3 * Math.sin(tl * 6)] }));
      TROPA.forEach(([x, z], i) => { const a = ctx.ator(`soldado${i + 1}`); colocar(ctx, a, x, z0 + z, 0); a.pose(somar(andar((z0 + 4) / 1.4 + i * 0.25), { bracoD: [-15, 0, 0], antebracoD: [-60, 0, 0] })); });
      ctx.cen.focar(0, 0, z0);
      camera(ctx, [-3.6, 1.0, z0 + 7], [0, 1.8, z0], { fov: 40 });
    },
  },
  {
    id: '3.1d', cap: 3, ...SEP, falas: ['3.1.04'], antes: 0.3, depois: 1.4, atores: ['dourado', 'cavaloDourado'],
    quadro: (ctx, tl, c) => {
      montarCavalo(ctx, ctx.ator('cavaloDourado'), ctx.ator('dourado'), 0, 6, 0);
      ctx.ator('cavaloDourado').pose({ pescoco: [-6, 0, 0], cauda: [12, 6 * Math.sin(tl), 0] });
      const ergue = entre(tl, 2.0, 3.2);
      ctx.ator('dourado').pose(somar(parado(tl), MONTADO, U.misturar({ bracoD: [-20, 0, 0], antebracoD: [-40, 0, 0] }, { bracoD: [-165, 0, -10], antebracoD: [-10, 0, 0], maoD: [0, 180, 0] }, ergue)));
      ctx.cen.focar(0, 0, 6);
      camera(ctx, [1.4, 0.4, 9.6], [0, 2.4, 6], { fov: 38 });
    },
  },
  // --- o salão ---
  ...[
    ['3.2a', ['3.2.01'], 0.8, 0.5], ['3.2b', ['3.2.02'], 0.3, 0.5], ['3.2c', ['3.2.03'], 0.4, 0.4], ['3.2d', ['3.2.04'], 0.3, 0.5], ['3.2e', ['3.2.05', '3.2.06', '3.2.07'], 0.4, 1.0],
  ].map(([id, falas, antes, depois], n) => ({
    id, cap: 3, cenario: 'salao', falas, antes, depois, atores: ['dourado', 'malvarJovem'],
    preparar: (ctx) => {
      const o = ctx.cen.origem;
      colocar(ctx, ctx.ator('malvarJovem'), o.x + 4.6, o.z - 0.4, Math.PI / 2);
      colocar(ctx, ctx.ator('dourado'), o.x + 1.0, o.z + 0.6, Math.PI / 2 - 0.2);
      ctx.ator('dourado').raiz.position.y = 0;
      ctx.ator('malvarJovem').raiz.position.y = 0;
    },
    quadro: (ctx, tl, c) => {
      const o = ctx.cen.origem;
      const m = ctx.ator('malvarJovem'), d = ctx.ator('dourado');
      const fala = c.falas.find((f) => tl > f.t0 && tl < f.t1);
      const pm = somar(parado(tl), { bracoE: [10, 0, -10], antebracoE: [-60, 30, 0], bracoD: [10, 0, 10], antebracoD: [-60, -30, 0] });
      if (n >= 1) m.raiz.rotation.y = Math.PI / 2 + Math.PI * entre(tl, 0.2, 1.4) * (n === 1 ? 1 : 1);
      if (n >= 2) m.raiz.rotation.y = Math.PI * 1.5;
      if (fala?.voz === 'malvar') m.falar(pm, tl);
      m.pose(pm);
      d.pose(somar(parado(tl), U.ESPADA_ARRASTA, n === 4 ? { cabeca: [8 * entre(tl, 0.5, 2.0), 0, 0] } : {}));
      const cams = [
        [[o.x - 2.6, 1.7, o.z + 2.6], [o.x + 4.6, 1.8, o.z - 0.4]],
        [[o.x + 2.0, 1.7, o.z - 1.8], [o.x + 4.6, 1.7, o.z - 0.4]],
        [[o.x + 3.6, 1.75, o.z + 0.2], [o.x + 1.0, 1.75, o.z + 0.6]],
        [[o.x + 1.6, 1.75, o.z + 1.3], [o.x + 4.6, 1.75, o.z - 0.4]],
        [[o.x + 2.0, 1.72, o.z + 0.9], [o.x + 1.0, 1.75, o.z + 0.6]],
      ];
      camera(ctx, cams[n][0], cams[n][1], { fov: n === 4 ? 26 + tl : 34 });
    },
  })),
  // --- o fogo ---
  {
    id: '3.3a', cap: 3, ...bru('fogo'), falas: ['3.3.01'], antes: 1.4, depois: 0.8, fadeIn: 0.8, atores: ['aldeaoB', 'aldeaB', 'soldado1'],
    quadro: (ctx, tl, c) => {
      ctx.ator('aldeaoB').pose(caminhar(ctx, ctx.ator('aldeaoB'), [-3, 2], [3, 14], 0, 3.5, tl, { passo: 1.4, passada: 2.2, extra: U.MEDO }));
      ctx.ator('aldeaB').pose(caminhar(ctx, ctx.ator('aldeaB'), [2, -4], [-2.5, 12], 0.6, 4.4, tl, { passo: 1.3, passada: 2.0, extra: U.MEDO }));
      const s = ctx.ator('soldado1');
      colocar(ctx, s, 3.2, -10, -0.6);
      s.pose(somar(parado(tl), { bracoD: [-160 * entre(tl, 1, 1.6), 0, 0] }));
      ctx.cen.focar(0, 0, 0);
      trilho(ctx, tl / c.dur, [[-17, 7.5, 21], [0, 1.6, 0]], [[-14, 6.5, 18], [1, 2.0, -2]]);
    },
  },
  {
    id: '3.3b', cap: 3, ...bru('fogo'), falas: ['3.3.02'], antes: 0.6, depois: 1.6, atores: ['dourado', 'cavaloDourado'],
    quadro: (ctx, tl, c) => {
      montarCavalo(ctx, ctx.ator('cavaloDourado'), ctx.ator('dourado'), 0, 14, Math.PI);
      ctx.ator('cavaloDourado').pose({ pescoco: [2 * Math.sin(tl * 0.7), 0, 0], cauda: [12, 4 * Math.sin(tl), 0] });
      ctx.ator('dourado').pose(somar(parado(tl * 0.3), MONTADO));
      ctx.cen.focar(0, 0, 8);
      const k = tl / c.dur;
      camera(ctx, [1.6, 1.4, 17.5 - k * 0.8], [0, 2.4, 14], { fov: 34 });
    },
  },
  // --- a maldição ---
  ...[
    ['3.4a', ['3.4.01'], 2.2, 0.4], ['3.4b', ['3.4.02'], 0.3, 0.4], ['3.4c', ['3.4.03'], 0.3, 0.8], ['3.4d', ['3.4.04', '3.4.05'], 0.4, 1.6],
  ].map(([id, falas, antes, depois], n) => ({
    id, cap: 3, ...bru('fogo'), falas, antes, depois, ...(n === 3 ? { fadeOut: 1.2 } : {}), atores: ['dourado', 'cavaloDourado', 'branaJovem'],
    quadro: (ctx, tl, c) => {
      montarCavalo(ctx, ctx.ator('cavaloDourado'), ctx.ator('dourado'), 0, 6, Math.PI);
      ctx.ator('cavaloDourado').pose({ pescoco: [3 * Math.sin(tl * 0.7), 0, 0], cauda: [12, 4 * Math.sin(tl), 0] });
      ctx.ator('dourado').pose(somar(parado(tl * 0.3), MONTADO, { pescoco: [14, 0, 0] }));
      const br = ctx.ator('branaJovem');
      const de = [-6.2, 1.5], ate = [-0.4, 4.6];
      const p = n === 0 ? caminhar(ctx, br, de, ate, 0, 2.2, tl, { passo: 0.7, passada: 0.9, extra: U.COLO }) : (colocar(ctx, br, ...ate, olharPara(ate, [0, 6])), somar(parado(tl), U.COLO));
      if (n === 0 && tl > 2.2) br.raiz.rotation.y = olharPara(ate, [0, 6]);
      p.cabeca = [-24, 0, 0];
      p.pescoco = [-12, 0, 0];
      const fala = c.falas.find((f) => tl > f.t0 && tl < f.t1);
      if (fala?.voz === 'brana') br.falar(p, tl);
      br.pose(p);
      ctx.cen.focar(0, 0, 5);
      const q = br.raiz.position;
      const cams = [
        [[-3.4, 1.6, 0.4], [-1.2, 1.5, 4]],
        [[q.x - 0.9, q.y + 1.25, q.z + 1.1], [q.x, q.y + 1.48, q.z]],
        [[1.0, 2.6, 6.4], [q.x, q.y + 1.4, q.z]],
        [[q.x - 0.6, q.y + 1.35, q.z + 0.6], [0, 2.6, 6]],
      ];
      camera(ctx, cams[n][0], cams[n][1], { fov: 34 });
    },
  })),
  // --- o homem que não morria ---
  {
    id: '3.5a', cap: 3, cenario: 'brumal:crepusculo', falas: ['3.5.01'], antes: 1.2, depois: 1.0, fadeIn: 0.6, atores: ['damasoSem'],
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damasoSem');
      // cai do alto do penhasco, bate no chão, fica caído e começa a levantar
      const cai = entre(tl, 0.6, 1.9);
      const x = 30.5, z = 2;
      const yTopo = ctx.cen.altura(33, z) + 1, yChao = ctx.cen.altura(x, z);
      b.raiz.position.set(x + 2.5 * (1 - cai), lin(yTopo, yChao, cai * cai), z);
      b.raiz.rotation.set(-cai * 1.5, 1.2, cai * 0.4);
      const levanta = entre(tl, 3.0, c.dur);
      b.pose(somar(parado(tl), { raiz: [lin(0, 0, levanta), 0, 0], coxaE: [-40, 0, 20], coxaD: [-20, 0, -15], bracoE: [-60, 0, 30], bracoD: [-30, 0, -40] }));
      if (tl > 1.9) { b.raiz.rotation.set(lin(-1.45, -0.6, levanta), 1.2, 0.3 * (1 - levanta)); b.raiz.position.y = yChao + lin(0.18, 0.3, levanta); }
      ctx.cen.focar(x, 0, z);
      camera(ctx, [x - 5.5, yChao + 1.2, z + 4], [x + 0.5, yChao + 2.2 - cai * 1.6, z], { fov: 40 });
    },
  },
  {
    id: '3.5b', cap: 3, cenario: 'brumal:crepusculo', falas: ['3.5.02'], antes: 0.8, depois: 1.0, atores: ['damasoSem', 'soldado1'],
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damasoSem'), s = ctx.ator('soldado1');
      colocar(ctx, b, -6, 20, 0.4);
      colocar(ctx, s, -5.3, 21.4, 0.4 + Math.PI);
      const golpe = entre(tl, 0.4, 0.8);
      s.pose(somar(parado(tl), { bracoD: [-70 * golpe - 20, 0, 0], antebracoD: [-20, 0, 0], coluna: [10 * golpe, 0, 0] }));
      b.pose(somar(parado(tl), { peito: [-8 * golpe, 0, 0], bracoE: [-30, 0, 0] }, U.MEDO));
      ctx.cen.focar(-6, 0, 20);
      camera(ctx, [-8.4, 1.6, 22.4], [-5.8, 1.4, 20.6], { fov: 36, tremor: 0.6, t: tl });
    },
  },
  {
    id: '3.5c', cap: 3, cenario: 'brumal:crepusculo', falas: ['3.5.03', '3.5.04', '3.5.05'], antes: 0.6, depois: 1.0, atores: ['damasoSem', 'pecas'],
    preparar: (ctx) => {
      const b = ctx.ator('damasoSem');
      const z = BRU.rioZ - 4.2;
      colocar(ctx, b, 2, z, 0);
      const pc = ctx.ator('pecas');
      pc.raiz.position.set(2.0, ctx.cen.altura(2.6, z), z - 0.2);
      pc.ps.forEach((m) => { m.visible = true; });
    },
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damasoSem'), pc = ctx.ator('pecas');
      b.pose(somar(parado(tl * 0.4), U.SENTADO_CHAO, { coluna: [12, 0, 0], pescoco: [18, 0, 0] }, { bracoD: [-60 - 60 * Math.max(0, Math.sin(tl * 1.2)), 0, -10], antebracoD: [-20, 0, 0] }));
      b.raiz.position.y = ctx.cen.altura(2, BRU.rioZ - 4.2);
      // uma peça por vez sai voando para o rio
      pc.ps.forEach((m, i) => {
        const t0 = 1.5 + i * (c.dur - 2) / pc.ps.length;
        const k = Math.min(1, Math.max(0, (tl - t0) / 1.2));
        m.visible = k < 1;
        if (k > 0) m.position.set(0.25 + i * 0.12 + k * 0.4, 0.06 + Math.sin(k * Math.PI) * 1.4, k * 3.6);
      });
      ctx.cen.focar(2, 0, BRU.rioZ - 3);
      camera(ctx, [-0.6, 1.3, BRU.rioZ - 7.6], [2.2, 0.5, BRU.rioZ - 3.6], { fov: 42 });
    },
  },
  {
    id: '3.5d', cap: 3, cenario: 'brumal:crepusculo', falas: ['3.5.06', '3.5.07'], antes: 0.4, depois: 0.8, atores: ['espadas'],
    preparar: (ctx) => {
      const e = ctx.ator('espadas');
      e.raiz.position.set(3, -0.98, BRU.rioZ - 2.6);
      e.raiz.rotation.set(-Math.PI / 2, 0, 0.6);
    },
    quadro: (ctx, tl, c) => {
      const e = ctx.ator('espadas');
      const k = entre(tl, 0.5, c.dur - 1);
      e.velha.traverse((o) => { if (o.isMesh) o.material.opacity = k; });
      const p = e.raiz.position;
      camera(ctx, [p.x + 0.6, p.y + 0.55, p.z + 0.5], [p.x - 0.1, p.y, p.z - 0.2], { fov: 34 });
    },
  },
  {
    id: '3.5e', cap: 3, ...ped('noite'), falas: ['3.5.08', '3.5.09'], antes: 0.8, depois: 2.6, fadeOut: 2.2, atores: ['damaso', 'vela'],
    preparar: (ctx) => {
      ctx.cen.preencher(0.3);
      const [vx, vz] = celeiro(0.0, 1.0);
      ctx.ator('vela').raiz.position.set(vx, chao(vx, vz), vz);
      const [dx, dz] = celeiro(0.0, 1.6);
      colocar(ctx, ctx.ator('damaso'), dx, dz, CEL.giro + Math.PI);
    },
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damaso');
      const risco = Math.sin(tl * 2.2) * 0.5 + 0.5;
      b.pose(somar(parado(tl * 0.4), U.SENTADO_CHAO, { coxaE: [-80, 0, 30], coxaD: [-80, 0, -30], pernaE: [100, 0, 0], pernaD: [100, 0, 0] }, U.RISCA, { antebracoD: [-95 + risco * 12, 0, 0] }));
      b.espada.visible = false;
      b.mao('D', 'punho');
      ctx.ator('vela').raiz.userData.atualizar(ctx.tempoFilme);
      b.raiz.updateMatrixWorld(true);
      const cap = b.capacete.getWorldPosition(new THREE.Vector3());
      const lado = new THREE.Vector3(Math.cos(b.raiz.rotation.y), 0, -Math.sin(b.raiz.rotation.y));
      camera(ctx, [cap.x - lado.x * 0.45, cap.y + 0.16, cap.z - lado.z * 0.45], [cap.x, cap.y + 0.13, cap.z], { fov: 30 });
    },
  },
);

// =====================================================================
// CAPÍTULO IV · O Aviso
// =====================================================================
import { criarChama as chama4, criarParticulas as part4, luzFogo as luz4 } from '../../motor-hd/efeitos.js';
import { madeira as texMadeira, linho as texLinho } from '../../motor-hd/texturas.js';
import { triplanar as tri4 } from '../../motor-hd/materiais.js';

function criarFogueira() {
  const g = new THREE.Group();
  const mat = tri4(texMadeira(), { escala: 3, relevo: 1, metal: 0, cor: 0x6a5040 });
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.0, 7), mat);
    t.rotation.set(1.1, (i / 6) * Math.PI * 2, 0);
    t.position.set(Math.cos((i / 6) * Math.PI * 2) * 0.22, 0.25, Math.sin((i / 6) * Math.PI * 2) * 0.22);
    t.castShadow = true;
    g.add(t);
  }
  for (let k = 0; k < 3; k++) { const c = chama4({ largura: 0.7, altura: 1.3 + k * 0.2, intensidade: 4, semente: 30 + k }); c.position.set((k - 1) * 0.15, 0.1, (k % 2) * 0.1); g.add(c); }
  const b = part4({ tipo: 'brasas', qtd: 40, area: [0.5, 0.2, 0.5], subida: 1.4, vida: 2.4, tamanho: 1, semente: 33 });
  b.position.y = 0.6;
  const f = part4({ tipo: 'fumaca', qtd: 20, area: [0.4, 0.2, 0.4], subida: 0.8, vida: 7, tamanho: 2.2, cor: 0x2a2622, opacidade: 0.3, semente: 34 });
  f.position.y = 1.6;
  const l = luz4({ cor: 0xff8a3a, intensidade: 30, sombra: true, semente: 35 });
  l.position.y = 0.9;
  g.add(b, f, l);
  g.userData.atualizar = (t) => g.traverse((o) => { if (o !== g && o.userData.atualizar) o.userData.atualizar(t); });
  return g;
}
function criarEstandarte() {
  const g = new THREE.Group();
  const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3.2, 6), tri4(texMadeira(), { escala: 4, relevo: 1, metal: 0 }));
  haste.position.y = 1.6;
  const pano = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3, 10, 10), new THREE.MeshStandardMaterial({ color: 0x5a1218, roughness: 0.9, side: THREE.DoubleSide }));
  pano.position.set(0.46, 2.55, 0);
  const base = pano.geometry.attributes.position.array.slice();
  g.add(haste, pano);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  g.userData.atualizar = (t) => {
    const p = pano.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = base[i * 3] + 0.45; p.setZ(i, Math.sin(x * 5 - t * 6) * 0.08 * x); }
    p.needsUpdate = true;
    pano.geometry.computeVertexNormals();
  };
  return g;
}
const CAVALEIROS = [[-1.6, -21.5], [0.6, -20.6], [2.6, -21.8]];
Object.assign(elenco, {
  fogueira: () => ({ raiz: criarFogueira() }),
  estandarte: () => ({ raiz: criarEstandarte() }),
  cavalo1: () => criarCavalo({ cor: 0x2a1e16 }), cavalo2: () => criarCavalo({ cor: 0x4a3020 }), cavalo3: () => criarCavalo({ cor: 0x3a2a1e }),
  carroca2: () => ({ raiz: criarCarroca() }), carroca3: () => ({ raiz: criarCarroca() }),
  pao: () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), tri4(texLinho(), { escala: 8, relevo: 1, metal: 0, cor: 0xc8b898 })); m.scale.set(1.3, 0.6, 1); m.castShadow = true; return { raiz: m }; },
});
const vento = ped('ventoso');
function cenaCobranca(ctx, tl, c) {
  CAVALEIROS.forEach(([x, z], i) => {
    const cv = ctx.ator(`cavalo${i + 1}`), s = ctx.ator(`soldado${i + 1}`);
    montarCavalo(ctx, cv, s, x, z, Math.PI);
    cv.pose({ pescoco: [4 * Math.sin(tl * 0.8 + i), 5 * Math.sin(tl * 0.5 + i), 0], cauda: [12, 8 * Math.sin(tl * 1.3 + i), 0] });
    const p = somar(parado(tl + i), MONTADO, { bracoD: [-15, 0, 0], antebracoD: [-60, 0, 0] });
    const f = c.falas.find((x2) => tl > x2.t0 && tl < x2.t1);
    if (i === 1 && f?.voz === 'soldado') { s.falar(p, tl); Object.assign(p, { bracoE: [-60, 0, -10], antebracoE: [-30, 0, 0] }); }
    s.pose(p);
  });
  const est = ctx.ator('estandarte').raiz;
  est.position.set(3.4, chao(3.4, -22.4) + 0.9, -22.4);
  est.userData.atualizar(ctx.tempoFilme);
  [['tome', -0.8, -27.0], ['aldeao', 1.2, -27.4], ['aldea', -2.4, -26.6], ['aldeao2', 2.8, -26.4]].forEach(([n, x, z], i) => {
    const a = ctx.ator(n);
    colocar(ctx, a, x, z, olharPara([x, z], [0.6, -20.6]));
    const p = parado(tl + i * 0.7);
    const f = c.falas.find((x2) => tl > x2.t0 && tl < x2.t1);
    if (n === 'tome' && f?.voz === 'tome') { a.falar(p, tl); Object.assign(p, U.PROTESTO); }
    a.pose(p);
  });
  ctx.cen.focar(0, 0, -23);
}
const cobranca = { ...vento, atores: ['cavalo1', 'cavalo2', 'cavalo3', 'soldado1', 'soldado2', 'soldado3', 'estandarte', 'tome', 'aldeao', 'aldea', 'aldeao2'] };
// fogueira na praça
const FOG = [2, -21];
const RODA = [['aldeao', 0.4], ['tome', 1.3], ['aldea', 2.3], ['aldeao2', 3.6], ['lia', 4.6]];
function cenaFogueira(ctx, tl, c, { damaso = 0 } = {}) {
  const f = ctx.ator('fogueira').raiz;
  f.position.set(FOG[0], chao(...FOG), FOG[1]);
  f.userData.atualizar(ctx.tempoFilme);
  const fala = c.falas.find((x) => tl > x.t0 && tl < x.t1);
  RODA.forEach(([n, a], i) => {
    const b = ctx.ator(n);
    const r = n === 'lia' ? 1.9 : 2.2;
    const x = FOG[0] + Math.sin(a) * r, z = FOG[1] + Math.cos(a) * r;
    colocar(ctx, b, x, z, olharPara([x, z], damaso > 0.5 ? DAMF : FOG));
    const p = parado(tl + i);
    if (fala && (fala.voz === n || (fala.voz === 'aldeao' && n === 'aldeao'))) { b.falar(p, tl); Object.assign(p, U.GESTO); }
    b.pose(p);
  });
  const d = ctx.ator('damaso');
  const de = [FOG[0] - 5.5, FOG[1] - 1.5];
  d.pose(caminhar(ctx, d, de, DAMF, 0, damaso * 2.6 + 0.01, damaso > 0 ? tl : 0, { ...DAM_PASSO, extra: U.ESPADA_ARRASTA }));
  if (fala?.voz === 'enferrujado') d.raiz.rotation.y = olharPara(DAMF, FOG);
  ctx.cen.focar(FOG[0], 0, FOG[1]);
  ctx.cen.preencher(0.25);
}
const DAMF = [FOG[0] - 2.3, FOG[1] - 0.9];
const fogueira = { ...ped('noite'), atores: ['fogueira', 'aldeao', 'tome', 'aldea', 'aldeao2', 'lia', 'damaso'] };

planos.push(
  titulo('c4', 4, 'CAPÍTULO IV', 'O Aviso', 4.5),
  {
    id: '4.1a', cap: 4, ...cobranca, falas: ['4.1.01'], antes: 4.0, depois: 0.6, fadeIn: 1.2,
    quadro: (ctx, tl, c) => {
      cenaCobranca(ctx, tl, c);
      // os cavaleiros chegam pela rua nos primeiros segundos
      const k = entre(tl, 0, 3.6);
      CAVALEIROS.forEach(([x, z], i) => {
        const cv = ctx.ator(`cavalo${i + 1}`), s = ctx.ator(`soldado${i + 1}`);
        const zz = lin(-8, z, k);
        montarCavalo(ctx, cv, s, x * k, zz, Math.PI);
        if (k < 1) cv.pose(cavaloAndar((zz + 8) / 2.1 + i * 0.3));
      });
      trilho(ctx, tl / c.dur, [[-6.5, 2.2, -29], [0, 1.6, -18]], [[-5.8, 2.0, -28], [0.6, 1.9, -21]]);
    },
  },
  {
    id: '4.1b', cap: 4, ...cobranca, falas: ['4.1.02'], antes: 0.3, depois: 0.5,
    quadro: (ctx, tl, c) => { cenaCobranca(ctx, tl, c); const q = ctx.ator('tome').raiz.position; camera(ctx, [q.x + 0.4, q.y + 1.7, q.z + 1.5], [q.x, q.y + 1.65, q.z], { fov: 32 }); },
  },
  {
    id: '4.1c', cap: 4, ...cobranca, falas: ['4.1.03'], antes: 0.3, depois: 0.4,
    quadro: (ctx, tl, c) => { cenaCobranca(ctx, tl, c); camera(ctx, [0.0, 1.5, -24.2], [0.6, 2.4, -20.6], { fov: 34 }); },
  },
  {
    id: '4.1d', cap: 4, ...cobranca, falas: ['4.1.04'], antes: 0.3, depois: 2.6,
    quadro: (ctx, tl, c) => { cenaCobranca(ctx, tl, c); trilho(ctx, tl / c.dur, [[1.6, 2.3, -22.8], [0.6, 2.6, -20.6]], [[1.3, 2.4, -22.0], [0.6, 2.65, -20.6]]); },
  },
  {
    id: '4.1e', cap: 4, ...vento, falas: ['4.1.05', '4.1.06'], antes: 0.4, depois: 1.0, atores: ['damaso'],
    preparar: (ctx) => { const [x, z] = celeiro(3.2, 6.0); colocar(ctx, ctx.ator('damaso'), x, z, olharPara([x, z], [0.6, -20.6])); ctx.ator('damaso').espada.visible = true; },
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damaso');
      const aperta = entre(tl, 1.2, 2.4);
      b.pose(somar(parado(tl), U.ESPADA_ARRASTA, { antebracoD: [-10 - 10 * aperta, 0, 0] }));
      b.raiz.updateMatrixWorld(true);
      const m = b.ossos.maoD.getWorldPosition(new THREE.Vector3());
      const k = entre(tl, 0, c.dur);
      const q = b.raiz.position;
      ctx.cen.focar(q.x, 0, q.z);
      const fb = [Math.sin(b.raiz.rotation.y), Math.cos(b.raiz.rotation.y)];
      camera(ctx, U.lerp3([q.x + fb[0] * 1.6 - fb[1] * 0.6, q.y + 1.6, q.z + fb[1] * 1.6 + fb[0] * 0.6], [m.x + fb[0] * 0.45, m.y + 0.05, m.z + fb[1] * 0.45], k), U.lerp3([q.x, q.y + 1.6, q.z], [m.x, m.y, m.z], k), { fov: 32 });
    },
  },
  {
    id: '4.2a', cap: 4, ...fogueira, falas: ['4.2.01'], antes: 1.2, depois: 0.4, fadeIn: 1.0,
    quadro: (ctx, tl, c) => { cenaFogueira(ctx, tl, c); trilho(ctx, tl / c.dur, [[FOG[0] + 4.2, 1.9, FOG[1] + 3.4], [FOG[0], 1.0, FOG[1]]], [[FOG[0] + 3.4, 1.7, FOG[1] + 2.6], [FOG[0], 1.1, FOG[1]]]); },
  },
  {
    id: '4.2b', cap: 4, ...fogueira, falas: ['4.2.02'], antes: 0.3, depois: 0.6,
    quadro: (ctx, tl, c) => { cenaFogueira(ctx, tl, c); const q = ctx.ator('tome').raiz.position; camera(ctx, [FOG[0] - 0.4, 1.55, FOG[1] - 0.6], [q.x, q.y + 1.62, q.z], { fov: 32 }); },
  },
  {
    id: '4.2c', cap: 4, ...fogueira, falas: ['4.2.03'], antes: 2.6, depois: 0.8,
    quadro: (ctx, tl, c) => {
      cenaFogueira(ctx, tl, c, { damaso: Math.min(1, tl / 2.6) });
      const q = ctx.ator('damaso').raiz.position;
      camera(ctx, [FOG[0] + 1.6, 1.3, FOG[1] + 1.4], [q.x, q.y + 1.5, q.z], { fov: 34 });
    },
  },
  {
    id: '4.2d', cap: 4, ...fogueira, falas: ['4.2.04', '4.2.05'], antes: 0.4, depois: 1.2, fadeOut: 1,
    quadro: (ctx, tl, c) => { cenaFogueira(ctx, tl, c, { damaso: 1 }); trilho(ctx, tl / c.dur, [[FOG[0] + 5, 3.4, FOG[1] + 5], [FOG[0], 0.9, FOG[1]]], [[FOG[0] + 6.5, 5.0, FOG[1] + 7], [FOG[0] - 1, 0.9, FOG[1]]]); },
  },
  // preparação: barricada, telhados molhados, crianças para o moinho
  {
    id: '4.2e', cap: 4, ...vento, min: 4.2, antes: 0, fadeIn: 0.6, atores: ['carroca2', 'carroca3', 'tome', 'aldeao'],
    quadro: (ctx, tl, c) => {
      const k = entre(tl, 0, 3.2);
      const c2 = ctx.ator('carroca2').raiz, c3 = ctx.ator('carroca3').raiz;
      c2.position.set(-1.6, 0.42, -6.4); c2.rotation.y = Math.PI / 2 + 0.2;
      c3.position.set(lin(4, 1.5, k), 0.42, -6.8); c3.rotation.y = Math.PI / 2 - 0.15;
      ctx.ator('tome').pose(caminhar(ctx, ctx.ator('tome'), [5.4, -7.6], [2.9, -7.6], 0, 3.2, tl, { passo: 0.6, extra: U.EMPURRA }));
      ctx.ator('aldeao').pose(caminhar(ctx, ctx.ator('aldeao'), [5.4, -6.0], [2.9, -6.0], 0, 3.2, tl, { passo: 0.6, extra: U.EMPURRA }));
      ctx.cen.focar(0, 0, -6);
      camera(ctx, [-2.5, 2.2, -12.5], [1.0, 0.8, -6.5], { fov: 40 });
    },
  },
  {
    id: '4.2f', cap: 4, ...vento, min: 4.0, antes: 0, atores: ['aldeao2', 'aldeao'],
    quadro: (ctx, tl, c) => {
      const p = portaCasa(5, 0.9), a = ctx.ator('aldeao2');
      colocar(ctx, a, p.x, p.z, p.giro + Math.PI);
      a.pose(somar(parado(tl), U.jogaAgua(Math.max(0, Math.sin(tl * 1.6)))));
      const p2 = portaCasa(4, 0.9), b = ctx.ator('aldeao');
      colocar(ctx, b, p2.x, p2.z, p2.giro + Math.PI);
      b.pose(somar(parado(tl), U.jogaAgua(Math.max(0, Math.sin(tl * 1.6 + 1.5)))));
      ctx.cen.focar(p.x, 0, p.z);
      camera(ctx, [p.x + Math.sin(p.giro) * 5 + 2, 1.7, p.z + Math.cos(p.giro) * 5], [p.x, 2.2, p.z], { fov: 40 });
    },
  },
  {
    id: '4.2g', cap: 4, ...vento, min: 4.0, antes: 0, fadeOut: 0.6, atores: ['aldea', 'lia'],
    quadro: (ctx, tl, c) => {
      ctx.ator('aldea').pose(caminhar(ctx, ctx.ator('aldea'), [6, -13.5], [11.5, -9.6], 0, c.dur, tl, { passo: 0.9 }));
      ctx.ator('lia').pose(caminhar(ctx, ctx.ator('lia'), [6.4, -14.2], [12, -10.3], 0, c.dur, tl, { passo: 1.0, passada: 0.9 }));
      ctx.cen.focar(10, 0, -10);
      camera(ctx, [7.6, 1.6, -17.0], [9.4, 1.2, -11.6], { fov: 42 });
    },
  },
);

// --- o celeiro: Lia e Brana ---
const CEL_DAM = () => celeiro(2.4, -1.4);
function cenaCeleiro4(ctx, tl, c) {
  const [dx, dz] = CEL_DAM();
  const b = ctx.ator('damaso');
  colocar(ctx, b, dx, dz, CEL.giro - 0.3);
  const fala = c.falas.find((x) => tl > x.t0 && tl < x.t1);
  b.pose(somar(parado(tl * 0.5), U.SENTADO_CHAO, fala?.voz === 'enferrujado' ? { cabeca: [0, 25, 0] } : {}));
  const [vx, vz] = celeiro(1.7, -0.6);
  ctx.ator('vela').raiz.position.set(vx, chao(vx, vz), vz);
  ctx.ator('vela').raiz.userData.atualizar(ctx.tempoFilme);
  ctx.cen.preencher(0.3);
  ctx.cen.focar(CEL.x, 0, CEL.z);
}
const celeiro4 = { ...ped('noite'), atores: ['damaso', 'vela', 'lia'] };
function liaAoLado(ctx, tl, c) {
  const [lx, lz] = celeiro(3.0, -1.2);
  const l = ctx.ator('lia');
  colocar(ctx, l, lx, lz, CEL.giro - 0.6);
  const p = somar(parado(tl), U.ABRACA_JOELHOS);
  const fala = c.falas.find((x) => tl > x.t0 && tl < x.t1);
  if (fala?.voz === 'lia') { l.falar(p, tl); p.cabeca = [0, -25, 0]; }
  l.pose(p);
}
const camCeleiro = (ctx, onde) => {
  const [dx, dz] = CEL_DAM();
  const alvo = onde === 'lia' ? celeiro(3.0, -1.2) : onde === 'ele' ? CEL_DAM() : celeiro(2.7, -1.3);
  const [cx, cz] = onde === 'dois' ? celeiro(1.0, 1.8) : onde === 'lia' ? celeiro(2.0, 0.2) : celeiro(3.4, 0.3);
  camera(ctx, [cx, chao(cx, cz) + (onde === 'dois' ? 1.25 : 0.95), cz], [alvo[0], chao(dx, dz) + (onde === 'ele' ? 1.2 : 0.75), alvo[1]], { fov: onde === 'dois' ? 40 : 32 });
};
planos.push(
  ...[
    ['4.3a', ['4.3.01'], 1.2, 0.4, 'dois'], ['4.3b', ['4.3.02'], 0.3, 0.6, 'ele'], ['4.3c', ['4.3.03'], 0.3, 0.4, 'lia'],
    ['4.3d', ['4.3.04'], 0.3, 0.6, 'ele'], ['4.3e', ['4.3.05'], 0.3, 0.6, 'lia'], ['4.3f', ['4.3.06', '4.3.07'], 0.3, 0.8, 'dois'],
  ].map(([id, falas, antes, depois, onde], n) => ({
    id, cap: 4, ...celeiro4, falas, antes, depois, ...(n === 0 ? { fadeIn: 1.0 } : {}),
    preparar: (ctx) => ctx.cen.base.userData.celeiro.userData.abrir(0.03),
    quadro: (ctx, tl, c) => {
      cenaCeleiro4(ctx, tl, c);
      liaAoLado(ctx, tl, c);
      if (id === '4.3f') ctx.ator('damaso').pose(somar(parado(tl * 0.5), U.SENTADO_CHAO, { cabeca: [0, 35 * entre(tl, 0.5, 1.5), 0] }));
      if (id === '4.3f' && tl > 3) ctx.ator('lia').pose(somar(parado(tl), U.ABRACA_JOELHOS, { peito: [0, 0, 0], bracoE: [-40, 0, -30], bracoD: [-40, 0, 30] }));
      camCeleiro(ctx, onde);
    },
  })),
  {
    id: '4.3g', cap: 4, ...ped('noite'), min: 6.2, antes: 0, atores: ['damaso', 'vela', 'lia', 'brana', 'pao'],
    preparar: (ctx) => ctx.cen.base.userData.celeiro.userData.abrir(0.03),
    quadro: (ctx, tl, c) => {
      cenaCeleiro4(ctx, tl, c);
      const cel = ctx.cen.base.userData.celeiro.userData;
      // batidas; Lia sai correndo; a porta abre e Brana entra com o pão
      cel.abrir(entre(tl, 1.4, 2.4) * 0.35);
      const l = ctx.ator('lia');
      l.pose(caminhar(ctx, l, celeiro(3.0, -1.2), celeiro(0.2, 8.0), 1.0, 3.0, tl, { passo: 1.2, passada: 1.1 }));
      const br = ctx.ator('brana');
      const [ax, az] = celeiro(0.0, 6.5), [bx, bz] = celeiro(2.0, -0.4);
      const pb = caminhar(ctx, br, [ax, az], [bx, bz], 2.2, 5.0, tl, { passo: 0.45, passada: 0.7, extra: somar(U.VELHA, U.SEGURA_FRENTE) });
      const larga = entre(tl, 5.0, 5.8);
      br.pose(somar(pb, { coluna: [30 * larga, 0, 0], peito: [15 * larga, 0, 0] }));
      const pao = ctx.ator('pao').raiz;
      br.raiz.updateMatrixWorld(true);
      if (larga < 1) pao.position.copy(br.ossos.peito.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(Math.sin(br.raiz.rotation.y) * 0.28, -0.25 - larga * 0.5, Math.cos(br.raiz.rotation.y) * 0.28));
      else pao.position.set(bx, chao(bx, bz) + 0.05, bz);
      camCeleiro(ctx, 'dois');
    },
  },
  {
    id: '4.3h', cap: 4, ...ped('noite'), falas: ['4.3.08'], antes: 0.6, depois: 0.8, atores: ['damaso', 'vela', 'brana', 'pao'],
    preparar: (ctx) => ctx.cen.base.userData.celeiro.userData.abrir(0.35),
    quadro: (ctx, tl, c) => {
      cenaCeleiro4(ctx, tl, c);
      const br = ctx.ator('brana');
      const [px, pz] = celeiro(0.0, 5.2);
      colocar(ctx, br, px, pz, CEL.giro);
      const p = somar(parado(tl), U.VELHA);
      const f = c.fala(0);
      if (tl > f.t0 && tl < f.t1) br.falar(p, tl, 0.7);
      br.pose(p);
      const [bx, bz] = celeiro(2.0, -0.4);
      ctx.ator('pao').raiz.position.set(bx, chao(bx, bz) + 0.05, bz);
      const [cx, cz] = celeiro(1.0, 0.8);
      camera(ctx, [cx, chao(cx, cz) + 1.3, cz], [px, chao(px, pz) + 1.2, pz], { fov: 36 });
    },
  },
  {
    id: '4.3i', cap: 4, ...ped('noite'), falas: ['4.3.09'], antes: 0.6, depois: 0.4, atores: ['damaso', 'vela', 'pao'],
    quadro: (ctx, tl, c) => {
      cenaCeleiro4(ctx, tl, c);
      const b = ctx.ator('damaso');
      b.raiz.updateMatrixWorld(true);
      const cap = b.capacete.getWorldPosition(new THREE.Vector3());
      const fb = [Math.sin(b.raiz.rotation.y), Math.cos(b.raiz.rotation.y)];
      camera(ctx, [cap.x + fb[0] * 0.75, cap.y + 0.12, cap.z + fb[1] * 0.75], [cap.x, cap.y + 0.13, cap.z], { fov: 30 });
    },
  },
  {
    id: '4.3j', cap: 4, ...ped('noite'), falas: ['4.3.10'], antes: 0.6, depois: 2.4, fadeOut: 2.0, atores: ['damaso', 'vela', 'pao'],
    quadro: (ctx, tl, c) => {
      cenaCeleiro4(ctx, tl, c);
      const [bx, bz] = celeiro(2.0, -0.4);
      ctx.ator('pao').raiz.position.set(bx, chao(bx, bz) + 0.05, bz);
      const k = tl / c.dur;
      const [cx, cz] = celeiro(-0.6, 3.5);
      const [ax, az] = CEL_DAM();
      camera(ctx, [cx, chao(cx, cz) + 2.4 + k * 0.6, cz], [ax, chao(ax, az) + 0.6, az], { fov: 40 });
    },
  },
);

// =====================================================================
// CAPÍTULO V · A Noite do Fogo
// =====================================================================
function criarSerpente() {
  // fila de tochas descendo a estrada do vale (posições ao longo de z, andando para a ponte)
  const g = new THREE.Group();
  const tochas = [];
  for (let i = 0; i < 46; i++) {
    const c = chama4({ largura: 0.45, altura: 0.9, intensidade: 9, semente: 50 + i });
    g.add(c);
    tochas.push(c);
  }
  const luzes = [0, 1, 2, 3].map((i) => { const l = luz4({ cor: 0xff7a30, intensidade: 120, semente: 60 + i }); g.add(l); return l; });
  g.userData.atualizar = (t, frente = 14) => {
    tochas.forEach((c, i) => {
      const z = frente + i * 1.4 + Math.sin(i * 7.3) * 0.5;
      const x = 0.6 * Math.sin(z * 0.03) + Math.sin(i * 3.1) * 1.1 + Math.sin(z * 0.08) * 3;
      c.position.set(x, AP(x, z) + 1.9 + Math.sin(t * 2 + i) * 0.04, z);
      c.userData.atualizar(t);
    });
    luzes.forEach((l, i) => { l.position.copy(tochas[i * 11 + 4].position); l.userData.atualizar(t); });
  };
  return g;
}
function soldadoTocha() {
  const b = soldado();
  b.lanca.visible = false;
  const t = tochaAcesa(criarTocha, { luz: 3, semente: 7 });
  naMao(b, 'E', t, { dedos: 0.05, frente: 0.03 });
  b.tocha = t;
  return b;
}
Object.assign(elenco, {
  serpente: () => ({ raiz: criarSerpente() }),
  soldadoT1: soldadoTocha, soldadoT2: soldadoTocha,
  malvar: () => {
    const b = pessoa('malvar');
    const e = criarEspada({ nova: true });
    b.espada = e;
    const { d, n, z } = b.maos.D.segura.userData.eixos;
    const palma = add(b.J.pulsoD, d, 0.05), cabo = add(palma, n, 0.03);
    e.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...z));
    e.position.set(...add(cabo, z, 0.11));
    b.prender('maoD', e);
    b.mao('D', 'segura');
    return b;
  },
  metades: () => {
    const g = new THREE.Group();
    const a = criarEspada({ nova: true }), b = criarEspada({ nova: true });
    a.scale.set(1, 0.5, 1); b.scale.set(1, 0.5, 1);
    g.add(a, b);
    return { raiz: g, a, b };
  },
  balde: () => ({ raiz: new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.25, 12), tri4(texMadeira(), { escala: 6, relevo: 1, metal: 0 })) }),
});
const tempestade = ped('tempestade');
const PONTE_MEIO = [0, 0.6];
const ARMADA = [[-0.9, 8.6], [0.9, 8.4], [-0.6, 10.0], [1.1, 10.1]];
const NOMES_ARMADA = ['soldado1', 'soldado2', 'soldadoT1', 'soldadoT2'];
function noPonte(ctx, b, x, z, giro) {
  b.raiz.position.set(x, Math.abs(z) < 7.25 ? 0.44 : chao(x, z), z);
  b.raiz.rotation.y = giro;
}
function cenaPonte(ctx, tl, c, { riso = 0, recuo = 0 } = {}) {
  const d = ctx.ator('damaso');
  noPonte(ctx, d, PONTE_MEIO[0], PONTE_MEIO[1], 0);
  NOMES_ARMADA.forEach((n, i) => {
    const s = ctx.ator(n);
    if (!s) return;
    const [x, z] = ARMADA[i];
    noPonte(ctx, s, x, z + recuo, Math.PI);
    const p = somar(parado(tl + i), i < 2 ? { bracoD: [-25, 0, 0], antebracoD: [-60, 0, 0] } : { bracoE: [-40, 0, 0], antebracoE: [-40, 0, 0] });
    if (riso) Object.assign(p, { peito: [-6 - 6 * Math.abs(Math.sin(tl * 9 + i)) * riso, 0, 0] });
    s.pose(p);
  });
  ctx.cen.focar(0, 0, 3);
  ctx.cen.preencher(0.8);
}
const ponte5 = { ...tempestade, atores: ['damaso', 'soldado1', 'soldado2', 'soldadoT1', 'soldadoT2'] };

planos.push(
  titulo('c5', 5, 'CAPÍTULO V', 'A Noite do Fogo', 4.5),
  {
    id: '5.1a', cap: 5, ...tempestade, falas: ['5.1.01', '5.1.02'], antes: 2.4, depois: 1.6, fadeIn: 1.4, atores: ['serpente', 'damaso'],
    quadro: (ctx, tl, c) => {
      ctx.ator('serpente').raiz.userData.atualizar(ctx.tempoFilme, lin(60, 30, tl / c.dur));
      const d = ctx.ator('damaso');
      noPonte(ctx, d, PONTE_MEIO[0], PONTE_MEIO[1], 0);
      d.pose(somar(parado(tl), U.ESPADA_ARRASTA));
      ctx.cen.focar(0, 0, 4);
      ctx.cen.preencher(0.6);
      camera(ctx, [0.6, 1.9, -4.6], [0.4, 1.5, 30], { fov: 36 });
    },
  },
  {
    id: '5.2a', cap: 5, ...ponte5, falas: ['5.2.01'], antes: 1.6, depois: 0.4,
    quadro: (ctx, tl, c) => {
      cenaPonte(ctx, tl, c);
      ctx.ator('damaso').pose(somar(parado(tl), U.ESPADA_ARRASTA));
      const s = ctx.ator('soldado2');
      const f = c.fala(0);
      const p = somar(parado(tl), U.GESTO);
      if (tl > f.t0 && tl < f.t1) s.falar(p, tl);
      s.pose(p);
      camera(ctx, [-1.6, 1.7, 3.6], [0.6, 1.7, 8.4], { fov: 36 });
    },
  },
  {
    id: '5.2b', cap: 5, ...ponte5, falas: ['5.2.02', '5.2.03'], antes: 0.3, depois: 1.8,
    quadro: (ctx, tl, c) => {
      const f = c.fala(1);
      cenaPonte(ctx, tl, c, { riso: tl < f.t0 ? 1 : 0 });
      ctx.ator('damaso').pose(somar(parado(tl), U.ESPADA_ARRASTA));
      camera(ctx, [0.3, 1.2, -3.4], [0.0, 1.6, 6], { fov: 40 });
    },
  },
  {
    id: '5.3a', cap: 5, ...ponte5, falas: ['5.3.01'], antes: 0.4, depois: 0.4,
    quadro: (ctx, tl, c) => {
      cenaPonte(ctx, tl, c);
      const d = ctx.ator('damaso'), s = ctx.ator('soldado1');
      noPonte(ctx, s, -0.4, 1.9, Math.PI);
      const golpe = entre(tl, 0.6, 1.0);
      s.pose(somar(parado(tl), { bracoD: [-70 * golpe - 20, 0, 0], antebracoD: [-15, 0, 0], coluna: [12 * golpe, 0, 0] }));
      noPonte(ctx, d, 0, lin(0.6, 1.2, entre(tl, 1.4, c.dur)), 0);
      d.pose(somar(parado(tl), U.ESPADA_ARRASTA, { peito: [-8 * golpe, 12 * golpe, 0] }));
      camera(ctx, [2.2, 1.5, 0.2], [-0.2, 1.4, 1.4], { fov: 36, tremor: 0.8, t: tl });
    },
  },
  {
    id: '5.3b', cap: 5, ...ponte5, falas: ['5.3.02'], antes: 0.3, depois: 0.4,
    quadro: (ctx, tl, c) => {
      cenaPonte(ctx, tl, c);
      const d = ctx.ator('damaso');
      noPonte(ctx, d, 0, 1.2, Math.PI * entre(tl, 0, 0.6));
      d.pose(somar(parado(tl), U.MEDO, { coluna: [-10, 0, 0] }));
      camera(ctx, [0.2, 1.6, -2.2], [0, 1.4, 1.2], { fov: 38, tremor: 0.6, t: tl });
    },
  },
  {
    id: '5.3c', cap: 5, ...ponte5, falas: ['5.3.03'], antes: 0.3, depois: 0.8,
    quadro: (ctx, tl, c) => {
      cenaPonte(ctx, tl, c, { recuo: entre(tl, 1.5, c.dur) * 2.5 });
      const d = ctx.ator('damaso'), s = ctx.ator('soldado1');
      // empurra um soldado para fora da ponte, para o rio
      const cai = entre(tl, 1.2, 2.4);
      s.raiz.position.set(lin(-0.4, -2.4, cai), lin(0.44, -0.9, cai * cai), 2.2);
      s.raiz.rotation.set(0, Math.PI, cai * 1.4);
      s.pose(somar(parado(tl), U.MEDO));
      noPonte(ctx, d, -0.2, lin(1.2, 2.4, entre(tl, 0.4, 1.4)), -0.3);
      d.pose(somar(parado(tl), U.misturar(U.ESPADA_ARRASTA, U.EMPURRA, entre(tl, 0.6, 1.2) * (1 - entre(tl, 2.0, 2.8)))));
      camera(ctx, [-3.4, 1.4, -0.4], [-0.6, 0.8, 2.6], { fov: 40 });
    },
  },
  {
    id: '5.3d', cap: 5, ...tempestade, falas: ['5.3.04'], antes: 2.4, depois: 0.8, atores: ['aldeao', 'tome', 'balde'],
    quadro: (ctx, tl, c) => {
      const p = portaCasa(6, 0.8);
      const a = ctx.ator('aldeao'), t = ctx.ator('tome');
      const fr = [Math.sin(p.giro), Math.cos(p.giro)], ld = [Math.cos(p.giro), -Math.sin(p.giro)];
      colocar(ctx, a, p.x + fr[0] * 1.6 + ld[0] * 0.8, p.z + fr[1] * 1.6 + ld[1] * 0.8, p.giro + Math.PI);
      a.pose(somar(parado(tl), U.jogaAgua(Math.max(0, Math.sin(tl * 1.7)))));
      colocar(ctx, t, p.x + fr[0] * 1.4 - ld[0] * 1.0, p.z + fr[1] * 1.4 - ld[1] * 1.0, p.giro + Math.PI);
      t.pose(somar(parado(tl), U.jogaAgua(Math.max(0, Math.sin(tl * 1.7 + 1.4)))));
      a.raiz.updateMatrixWorld(true);
      ctx.ator('balde').raiz.position.copy(a.ossos.maoE.getWorldPosition(new THREE.Vector3()));
      ctx.cen.focar(p.x, 0, p.z);
      ctx.cen.preencher(0.8);
      camera(ctx, [p.x + fr[0] * 5.0 + ld[0] * 1.5, 1.7, p.z + fr[1] * 5.0 + ld[1] * 1.5], [p.x + fr[0] * 1.2, 1.8, p.z + fr[1] * 1.2], { fov: 42 });
    },
  },
);

// --- o barão ---
const MAL0 = [0.1, 3.3];
const ponteBarao = { ...tempestade, atores: ['damaso', 'malvar', 'soldado1', 'soldado2', 'soldadoT1', 'soldadoT2', 'metades'] };
function cenaBarao(ctx, tl, c, { anda = 1, quebra = -1, ajoelha = 0, aponta = 0 } = {}) {
  cenaPonte(ctx, tl, c, { recuo: 1.2 });
  const m = ctx.ator('malvar'), d = ctx.ator('damaso');
  noPonte(ctx, m, MAL0[0], lin(8.0, MAL0[1], anda), Math.PI);
  const fala = c.falas.find((x) => tl > x.t0 && tl < x.t1);
  const pm = anda < 1 ? andar(lin(8.0, MAL0[1], anda) / 1.3) : parado(tl);
  if (ajoelha) Object.assign(pm, { coxaE: [-90 * ajoelha, 0, 0], pernaE: [90 * ajoelha, 0, 0], coxaD: [-10 * ajoelha, 0, 0], pernaD: [120 * ajoelha, 0, 0], peD: [40 * ajoelha, 0, 0], pos: [0, -0.5 * ajoelha, 0] });
  if (fala?.voz === 'malvar') m.falar(pm, tl);
  m.pose(pm);
  m.espada.visible = quebra < 0 || tl < quebra;
  const mt = ctx.ator('metades');
  mt.raiz.visible = quebra >= 0 && tl >= quebra;
  if (mt.raiz.visible) {
    const k = Math.min(1, (tl - quebra) / 0.9);
    mt.a.position.set(0.3, lin(1.2, 0.45, k * k), MAL0[1] - 0.6);
    mt.a.rotation.set(k * 5, 0, 1.2);
    mt.b.position.set(-0.4, lin(1.4, 0.45, k * k), MAL0[1] - 0.9);
    mt.b.rotation.set(-k * 4, 1, -1.4);
  }
  const pd = aponta ? somar(parado(tl), { bracoD: [-70 * aponta, 0, -5], antebracoD: [-10, 0, 0], maoD: [0, 180 * aponta, 0] }) : somar(parado(tl), U.ESPADA_ARRASTA);
  d.pose(pd);
}
planos.push(
  {
    id: '5.4a', cap: 5, ...ponteBarao, falas: ['5.4.01', '5.4.02'], antes: 2.2, depois: 0.6,
    quadro: (ctx, tl, c) => {
      cenaBarao(ctx, tl, c, { anda: entre(tl, 0, 4.0) });
      const f = c.fala(1);
      if (tl < f.t0) camera(ctx, [1.4, 1.5, -1.6], [0, 1.6, 6], { fov: 38 });
      else { const d = ctx.ator('damaso'); d.raiz.updateMatrixWorld(true); const e = d.espada.getWorldPosition(new THREE.Vector3()); camera(ctx, [e.x + 0.7, e.y + 0.3, e.z + 0.9], [e.x, e.y - 0.2, e.z], { fov: 34 }); }
    },
  },
  {
    id: '5.4b', cap: 5, ...ponteBarao, falas: ['5.4.03', '5.4.04'], antes: 0.3, depois: 0.4,
    quadro: (ctx, tl, c) => { cenaBarao(ctx, tl, c); const q = ctx.ator('malvar').raiz.position; camera(ctx, [q.x - 0.5, q.y + 1.68, q.z - 1.1], [q.x, q.y + 1.68, q.z], { fov: 30 }); },
  },
  {
    id: '5.4c', cap: 5, ...ponteBarao, falas: ['5.4.05'], antes: 0.6, depois: 0.8,
    quadro: (ctx, tl, c) => { cenaBarao(ctx, tl, c); const q = ctx.ator('damaso').raiz.position; camera(ctx, [q.x + 0.4, q.y + 1.66, q.z + 1.0], [q.x, q.y + 1.7, q.z], { fov: 30 }); },
  },
  {
    id: '5.4d', cap: 5, ...ponteBarao, falas: ['5.4.06', '5.4.07'], antes: 2.8, depois: 0.6,
    quadro: (ctx, tl, c) => {
      cenaBarao(ctx, tl, c, { quebra: 1.9 });
      const m = ctx.ator('malvar'), d = ctx.ator('damaso');
      const g = entre(tl, 0.4, 0.9) * (1 - entre(tl, 1.2, 1.6));
      m.pose(somar(parado(tl), { bracoD: [-120 + 60 * g, 0, -60 * g], antebracoD: [-20, 0, 0], peito: [0, 30 * g, 0] }));
      d.pose(somar(parado(tl), U.golpe(entre(tl, 1.5, 1.9)), { bracoE: [-60 * entre(tl, 1.0, 1.3), 0, 0] }));
      camera(ctx, [2.4, 1.6, 2.0], [0, 1.5, 2.0], { fov: 40, tremor: tl > 1.8 && tl < 2.4 ? 1.5 : 0.3, t: tl * 2 });
    },
  },
  {
    id: '5.4e', cap: 5, ...ponteBarao, falas: ['5.4.08'], antes: 0.6, depois: 0.6,
    quadro: (ctx, tl, c) => {
      cenaBarao(ctx, tl, c, { quebra: 0, ajoelha: 1, aponta: 1 });
      ctx.ator('metades').raiz.visible = true;
      const q = ctx.ator('malvar').raiz.position;
      camera(ctx, [q.x - 0.8, q.y + 1.0, q.z - 1.6], [q.x, q.y + 1.1, q.z], { fov: 34 });
    },
  },
  {
    id: '5.4f', cap: 5, ...ponteBarao, falas: ['5.4.09'], antes: 0.6, depois: 4.2,
    quadro: (ctx, tl, c) => {
      const abaixa = entre(tl, 1.4, 2.4);
      cenaBarao(ctx, tl, c, { quebra: 0, ajoelha: 1, aponta: 1 - abaixa });
      const d = ctx.ator('damaso');
      if (tl > 2.6) { const p = caminhar(ctx, d, PONTE_MEIO, [0, -5.5], 2.6, c.dur + 1, tl, { ...DAM_PASSO, extra: U.ESPADA_ARRASTA }); d.pose(p); }
      cenaPonte(ctx, tl, c, { recuo: 1.2 + entre(tl, 2.6, c.dur) * 6 });
      camera(ctx, [-2.6, 2.6, -6.0], [0, 1.0, 1.6], { fov: 42 });
    },
  },
);

// --- a contagem, ao amanhecer ---
const contagem = { ...ped('aurora'), atores: ['lia', 'damaso', 'tome', 'aldeao', 'aldea', 'aldeao2', 'dalia'] };
const POVO = [['tome', 13.5, -11.6], ['aldeao', 12.0, -12.6], ['aldea', 10.6, -11.4], ['aldeao2', 9.4, -12.4], ['dalia', 8.2, -11.0]];
function cenaContagem(ctx, tl) {
  POVO.forEach(([n, x, z], i) => { const a = ctx.ator(n); colocar(ctx, a, x, z, olharPara([x, z], [4, -9])); a.pose(parado(tl + i)); });
  ctx.ator('dalia').pose(somar(parado(tl), U.COLO));
  ctx.cen.focar(8, 0, -10);
}
planos.push(
  {
    id: '5.5a', cap: 5, ...contagem, falas: ['5.5.01'], antes: 1.6, depois: 0.4, fadeIn: 1.2,
    preparar: (ctx) => { const d = ctx.ator('damaso'); colocar(ctx, d, 1.2, -8.6, 0.6); },
    quadro: (ctx, tl, c) => {
      cenaContagem(ctx, tl);
      ctx.ator('damaso').pose(somar(parado(tl), U.ESPADA_ARRASTA));
      const l = ctx.ator('lia');
      const p = caminhar(ctx, l, [13.8, -10.4], [7.4, -10.2], 0, c.dur, tl, { passo: 1.1, passada: 1.0 });
      l.raiz.rotation.y += Math.sin(tl * 3) * 0.6;
      const f = c.fala(0);
      if (tl > f.t0 && tl < f.t1) { l.falar(p, tl); Object.assign(p, { bracoD: [-80, 0, -20], antebracoD: [-10, 0, 0] }); }
      l.pose(p);
      camera(ctx, [12.6, 1.6, -6.6], [10.0, 1.1, -11.2], { fov: 44 });
    },
  },
  {
    id: '5.5b', cap: 5, ...contagem, falas: ['5.5.02'], antes: 0.3, depois: 0.6,
    quadro: (ctx, tl, c) => {
      cenaContagem(ctx, tl);
      const d = ctx.ator('damaso');
      colocar(ctx, d, 1.2, -8.6, olharPara([1.2, -8.6], [3.0, -9.2]));
      d.pose(somar(parado(tl), U.ESPADA_ARRASTA, { cabeca: [10, 0, 0] }));
      const l = ctx.ator('lia');
      const p = caminhar(ctx, l, [7.0, -10.0], [2.2, -9.0], 0, 1.8, tl, { passo: 1.3, passada: 1.1 });
      if (tl > 1.8) l.raiz.rotation.y = olharPara([2.2, -9.0], [1.2, -8.6]);
      const f = c.fala(0);
      if (tl > f.t0 && tl < f.t1) { l.falar(p, tl, 1.2); if (tl > 1.8) Object.assign(p, { bracoE: [-150, 0, 30], bracoD: [-150, 0, -30] }); }
      l.pose(p);
      camera(ctx, [3.6, 1.2, -6.4], [1.6, 1.2, -8.8], { fov: 38 });
    },
  },
  {
    id: '5.5c', cap: 5, ...contagem, falas: ['5.5.03', '5.5.04', '5.5.05'], antes: 0.4, depois: 2.4, fadeOut: 2,
    quadro: (ctx, tl, c) => {
      cenaContagem(ctx, tl);
      const d = ctx.ator('damaso');
      colocar(ctx, d, 1.2, -8.6, olharPara([1.2, -8.6], [3.0, -9.2]));
      d.pose(somar(parado(tl), U.ESPADA_ARRASTA, { cabeca: [10, 0, 0] }));
      colocar(ctx, ctx.ator('lia'), 2.2, -9.0, olharPara([2.2, -9.0], [1.2, -8.6]));
      ctx.ator('lia').pose(somar(parado(tl), U.CINTURA));
      d.raiz.updateMatrixWorld(true);
      const cap = d.capacete.getWorldPosition(new THREE.Vector3());
      const k = tl / c.dur;
      const fb = [Math.sin(d.raiz.rotation.y), Math.cos(d.raiz.rotation.y)];
      camera(ctx, [cap.x + fb[0] * (1.6 - k * 0.8), cap.y + 0.12, cap.z + fb[1] * (1.6 - k * 0.8)], [cap.x, cap.y + 0.12, cap.z], { fov: 32 });
    },
  },
);

// =====================================================================
// CAPÍTULO VI · O Rosto
// =====================================================================
import { criarCapacete } from '../../motor-hd/cavaleiro.js';

Object.assign(elenco, {
  damasoRosto: () => {
    const b = pessoa('damasoRosto');
    // corte na palma esquerda (linha vermelha) e faixa de pano que a Brana amarra
    const corte = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.004, 0.006), new THREE.MeshStandardMaterial({ color: 0x8a0a08, roughness: 0.3, emissive: 0x200000 }));
    const { d, n } = b.maos.E.aberta.userData.eixos;
    corte.position.set(...add(add(b.J.pulsoE, d, 0.05), n, 0.022));
    b.prender('maoE', corte);
    b.corte = corte;
    const faixa = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 14, 1, true), tri4(texLinho(), { escala: 9, relevo: 1, metal: 0, cor: 0x8a8884 }));
    faixa.material.side = THREE.DoubleSide;
    faixa.position.set(...add(b.J.pulsoE, d, 0.055));
    faixa.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...d));
    faixa.scale.set(1, 1, 0.55);
    b.prender('maoE', faixa);
    b.faixa = faixa;
    return b;
  },
  damasoCamisa: () => {
    const b = pessoa('damasoCamisa');
    const e = criarEspada();
    e.position.set(0.05, 1.32, -0.16);
    e.rotation.set(0, 0, Math.PI * 0.82);
    b.prender('peito', e);
    return b;
  },
  capaceteSolto: () => ({ raiz: criarCapacete() }),
  gota: () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshStandardMaterial({ color: 0x7a0806, roughness: 0.2 })); return { raiz: m }; },
});
const manha = ped('aurora');
const BORDA = [1.2, 0.2], BORDA_BR = [1.2, 1.05];
// sentado na beira da ponte, pernas para fora (sobre o rio)
const BEIRA = { coxaE: [-85, 0, 6], coxaD: [-85, 0, -6], pernaE: [75, 0, 0], pernaD: [70, 0, 0], pos: [0, -0.42, 0] };
function sentarBeira(b, [x, z]) { b.raiz.position.set(x, 0.44 - 0.07, z); b.raiz.rotation.y = Math.PI / 2; }
const PALMA = { bracoE: [-30, 0, 0], antebracoE: [-80, 70, 0], maoE: [0, 0, 0] };
const camBeira = (ctx, alvo, dist = 1.3, alt = 0.0, lado = 0.0) => camera(ctx, [alvo[0] + dist, alvo[1] + alt, alvo[2] + lado], alvo, { fov: 32 });

planos.push(
  titulo('c6', 6, 'CAPÍTULO VI', 'O Rosto', 4.5),
  {
    id: '6.1a', cap: 6, ...manha, falas: ['6.1.01', '6.1.02'], antes: 2.4, depois: 0.4, fadeIn: 1.6, atores: ['damasoRosto', 'capaceteSolto'],
    preparar: (ctx) => { ctx.ator('capaceteSolto').raiz.visible = false; },
    quadro: (ctx, tl, c) => {
      // ainda de capacete nesta parte: usamos o corpo do Dâmaso de rosto, com o capacete solto no lugar da cabeça
      const b = ctx.ator('damasoRosto');
      sentarBeira(b, BORDA);
      const corta = entre(tl, 0.6, 1.8);
      b.pose(somar(parado(tl * 0.5), BEIRA, PALMA, { bracoD: [-50, 0, 10], antebracoD: [-70 + 20 * corta, 0, 0], maoD: [0, 180, 0], pescoco: [20, 0, 0] }));
      b.mao('E', 'aberta');
      const fecha = entre(tl, 2.4, 4.2);
      b.corte.visible = corta > 0.5 && fecha < 1;
      b.corte.scale.set(1 - fecha, 1, 1);
      b.faixa.visible = false;
      const cp = ctx.ator('capaceteSolto').raiz;
      cp.visible = true;
      b.raiz.updateMatrixWorld(true);
      cp.position.copy(b.ossos.cabeca.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, -0.045, 0));
      cp.quaternion.copy(b.ossos.cabeca.getWorldQuaternion(new THREE.Quaternion()));
      const m = b.ossos.maoE.getWorldPosition(new THREE.Vector3());
      ctx.cen.focar(1, 0, 0);
      ctx.cen.preencher(1);
      if (tl < c.fala(1).t0) camera(ctx, [m.x + 0.4, m.y + 0.25, m.z + 0.35], [m.x, m.y, m.z], { fov: 30 });
      else camBeira(ctx, [b.raiz.position.x + 0.2, 1.4, b.raiz.position.z], 2.2, 0.3, -1.2);
    },
  },
  {
    id: '6.1b', cap: 6, ...manha, falas: ['6.1.03'], antes: 0.6, depois: 1.6, atores: ['damasoRosto', 'capaceteSolto'],
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damasoRosto');
      sentarBeira(b, BORDA);
      const solta = entre(tl, 1.2, 1.6);
      b.pose(somar(parado(tl * 0.5), BEIRA, { bracoD: [-30 + 20 * solta, 0, 10], antebracoD: [-40, 0, 0], pescoco: [10, 0, 0] }));
      b.espada.visible = true;
      b.raiz.updateMatrixWorld(true);
      if (solta > 0.5) { b.espada.visible = false; }
      b.corte.visible = false; b.faixa.visible = false;
      const cp = ctx.ator('capaceteSolto').raiz;
      cp.position.copy(b.ossos.cabeca.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, -0.045, 0));
      cp.quaternion.copy(b.ossos.cabeca.getWorldQuaternion(new THREE.Quaternion()));
      ctx.cen.focar(1, 0, 0);
      camBeira(ctx, [cp.position.x, cp.position.y + 0.15, cp.position.z], 1.0, -0.05, 0.4);
    },
  },
);

// a conversa com Brana: os dois sentados na beira da ponte
function cenaBrana(ctx, tl, c, { segura = 0, olhaDela = 0, sangra = 0, amarra = 0 } = {}) {
  const b = ctx.ator('damasoRosto'), br = ctx.ator('brana');
  sentarBeira(b, BORDA);
  br.raiz.position.set(BORDA_BR[0] - 0.35, 0.44, BORDA_BR[1] + 0.15);
  br.raiz.rotation.y = Math.PI / 2;
  const fala = c.falas.find((x) => tl > x.t0 && tl < x.t1);
  const pb = somar(parado(tl * 0.5), BEIRA, { pescoco: [12, -30 * olhaDela, 0] }, U.misturar({}, { bracoE: [-30, 0, 0], antebracoE: [-60, 60, 0] }, Math.max(segura, amarra)));
  b.pose(pb);
  b.espada.visible = false;
  b.corte.visible = sangra > 0 || amarra > 0;
  b.faixa.visible = amarra > 0.6;
  const pr = somar(parado(tl * 0.5), U.VELHA, { pescoco: [-2, 0, 0] }, U.misturar({}, { coluna: [30, 0, 0], peito: [15, 0, 0], bracoE: [-55, 0, 10], antebracoE: [-30, 0, 0] }, Math.max(segura, amarra)));
  if (fala?.voz === 'brana') br.falar(pr, tl, 0.8);
  br.pose(pr);
  br.bengala.visible = true;
  const cp = ctx.ator('capaceteSolto').raiz;
  b.raiz.updateMatrixWorld(true);
  cp.position.copy(b.ossos.cabeca.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, -0.045, 0));
  cp.quaternion.copy(b.ossos.cabeca.getWorldQuaternion(new THREE.Quaternion()));
  ctx.cen.focar(1, 0, 0.5);
  ctx.cen.preencher(1);
}
const beira = { ...manha, atores: ['damasoRosto', 'brana', 'capaceteSolto'] };
const dois = (ctx) => camera(ctx, [3.4, 1.0, -1.4], [1.2, 0.85, 0.6], { fov: 34 });
const closeBrana = (ctx) => camera(ctx, [2.0, 1.25, 0.6], [1.25, 1.2, 1.05], { fov: 30 });
const closeEle = (ctx) => camera(ctx, [2.0, 1.32, 0.75], [1.25, 1.35, 0.2], { fov: 30 });
planos.push(
  {
    id: '6.2a', cap: 6, ...beira, falas: ['6.2.01'], antes: 4.2, depois: 0.4,
    quadro: (ctx, tl, c) => {
      cenaBrana(ctx, tl, c, { olhaDela: entre(tl, 4.0, 5.2) });
      // ela chega de bengala e senta com dificuldade
      const br = ctx.ator('brana');
      if (tl < 3.6) { br.bengala.visible = true; const p = caminhar(ctx, br, [0.2, 4.6], [0.9, 1.4], 0, 3.0, tl, { passo: 0.45, passada: 0.7, extra: U.VELHA }); br.raiz.position.y = 0.44; br.pose(p); }
      dois(ctx);
    },
  },
  { id: '6.2b', cap: 6, ...beira, falas: ['6.2.02'], antes: 0.3, depois: 0.5, quadro: (ctx, tl, c) => { cenaBrana(ctx, tl, c, { olhaDela: 1 }); closeBrana(ctx); } },
  { id: '6.2c', cap: 6, ...beira, falas: ['6.2.03'], antes: 0.3, depois: 0.6, quadro: (ctx, tl, c) => { cenaBrana(ctx, tl, c, { olhaDela: 1 }); const br = ctx.ator('brana'); br.pose(somar(parado(tl), U.VELHA, { bracoE: [-50, 0, 0], antebracoE: [-80, 70, 0] })); br.raiz.updateMatrixWorld(true); const m = br.ossos.maoE.getWorldPosition(new THREE.Vector3()); camera(ctx, [m.x + 0.45, m.y + 0.25, m.z - 0.15], [m.x, m.y, m.z + 0.08], { fov: 30 }); } },
  { id: '6.2d', cap: 6, ...beira, falas: ['6.2.04'], antes: 0.3, depois: 0.6, quadro: (ctx, tl, c) => { cenaBrana(ctx, tl, c, { olhaDela: 1 }); closeBrana(ctx); } },
  { id: '6.2e', cap: 6, ...beira, falas: ['6.2.05'], antes: 0.6, depois: 1.0, quadro: (ctx, tl, c) => { cenaBrana(ctx, tl, c, { olhaDela: 1 }); closeEle(ctx); } },
  { id: '6.2f', cap: 6, ...beira, falas: ['6.2.06', '6.2.07'], antes: 0.4, depois: 0.6, quadro: (ctx, tl, c) => { cenaBrana(ctx, tl, c, { olhaDela: 1 }); trilho(ctx, tl / c.dur, [[3.0, 1.1, 1.6], [1.25, 1.1, 0.6]], [[2.6, 1.15, 1.3], [1.25, 1.15, 0.7]]); } },
  { id: '6.2g', cap: 6, ...beira, falas: ['6.2.08', '6.2.09'], antes: 0.4, depois: 0.8, quadro: (ctx, tl, c) => { cenaBrana(ctx, tl, c, { olhaDela: 1, segura: entre(tl, c.dur - 2.5, c.dur - 0.8) }); closeBrana(ctx); } },
  {
    id: '6.2h', cap: 6, ...beira, falas: ['6.2.10'], antes: 1.0, depois: 1.4,
    quadro: (ctx, tl, c) => {
      cenaBrana(ctx, tl, c, { olhaDela: 1, segura: 1 });
      const b = ctx.ator('damasoRosto');
      b.raiz.updateMatrixWorld(true);
      const m = b.ossos.maoE.getWorldPosition(new THREE.Vector3());
      camera(ctx, [m.x + 0.5, m.y + 0.3, m.z - 0.3], [m.x, m.y, m.z + 0.1], { fov: 32 });
    },
  },
  {
    id: '6.3a', cap: 6, ...beira, falas: ['6.3.01'], antes: 2.4, depois: 0.8, atores: ['damasoRosto', 'brana', 'capaceteSolto', 'gota'],
    quadro: (ctx, tl, c) => {
      cenaBrana(ctx, tl, c, { segura: 0, sangra: 1 });
      const b = ctx.ator('damasoRosto');
      b.pose(somar(parado(tl * 0.5), BEIRA, PALMA, { pescoco: [22, 0, 0] }));
      b.corte.scale.set(entre(tl, 0.3, 1.6), 1, 1);
      b.raiz.updateMatrixWorld(true);
      const m = b.corte.getWorldPosition(new THREE.Vector3());
      const g = ctx.ator('gota').raiz;
      const cai = Math.max(0, tl - 2.2);
      g.visible = tl > 2.0;
      g.position.set(m.x, Math.max(0.47, m.y - 4.9 * cai * cai), m.z);
      camera(ctx, [m.x + 0.38, m.y + 0.18, m.z - 0.2], [m.x, m.y - 0.06, m.z], { fov: 30 });
    },
  },
  { id: '6.3b', cap: 6, ...beira, falas: ['6.3.02', '6.3.03'], antes: 1.6, depois: 1.2, quadro: (ctx, tl, c) => { cenaBrana(ctx, tl, c, { amarra: entre(tl, 0.2, 1.6), olhaDela: 1 }); dois(ctx); } },
);

// o capacete sai: o corpo com rosto aparece quando o capacete sobe
const rostoCena = { ...manha, atores: ['damasoRosto', 'brana', 'capaceteSolto', 'lia'] };
function tirarCapacete(ctx, tl, t0, t1) {
  const b = ctx.ator('damasoRosto');
  const k = entre(tl, t0, t1);
  const maos = entre(tl, t0 - 1.5, t0);
  b.pose(somar(parado(tl * 0.5), BEIRA, U.misturar({}, { bracoE: [-150, 0, -30], bracoD: [-150, 0, 30], antebracoE: [-70, 0, 0], antebracoD: [-70, 0, 0] }, maos * (1 - entre(tl, t1, t1 + 1.2) * 0.85)), { pescoco: [4, -10, 0] }));
  b.faixa.visible = true;
  b.corte.visible = false;
  const cp = ctx.ator('capaceteSolto').raiz;
  b.raiz.updateMatrixWorld(true);
  const cab = b.ossos.cabeca.getWorldPosition(new THREE.Vector3());
  cp.position.copy(cab).add(new THREE.Vector3(0.12 * entre(tl, t1, t1 + 1.2), -0.045 + k * 0.32 - entre(tl, t1, t1 + 1.2) * 0.9, 0));
  cp.quaternion.copy(b.ossos.cabeca.getWorldQuaternion(new THREE.Quaternion()));
  return cab;
}
planos.push(
  {
    id: '6.4a', cap: 6, ...rostoCena, falas: ['6.4.01', '6.4.02', '6.4.03', '6.4.04'], antes: 4.0, depois: 0.8,
    quadro: (ctx, tl, c) => {
      cenaBrana(ctx, tl, c, { olhaDela: 0 });
      const cab = tirarCapacete(ctx, tl, 2.2, 3.6);
      ctx.ator('lia').raiz.visible = false;
      const k = entre(tl, 0, 4);
      camera(ctx, [cab.x + lin(1.8, 0.75, k), cab.y + 0.02, cab.z - 0.15], [cab.x, cab.y + 0.06, cab.z], { fov: 30 });
    },
  },
  {
    id: '6.4b', cap: 6, ...rostoCena, falas: ['6.4.05'], antes: 2.8, depois: 0.6,
    quadro: (ctx, tl, c) => {
      cenaBrana(ctx, tl, c);
      tirarCapacete(ctx, 20, 0, 0.1);
      const l = ctx.ator('lia');
      const p = caminhar(ctx, l, [-0.4, 4.6], [0.1, 0.4], 0, 2.6, tl, { passo: 1.2, passada: 1.0 });
      l.raiz.position.y = 0.44;
      if (tl > 2.6) l.raiz.rotation.y = olharPara([0.1, 0.4], [1.2, 0.2]);
      const f = c.fala(0);
      if (tl > f.t0 && tl < f.t1) l.falar(p, tl);
      if (tl > 2.6) Object.assign(p, U.CINTURA, { cabeca: [8, 15, 0] });
      l.pose(p);
      camera(ctx, [2.8, 1.2, -1.2], [0.6, 0.95, 0.4], { fov: 36 });
    },
  },
  {
    id: '6.4c', cap: 6, ...rostoCena, falas: ['6.4.06', '6.4.07'], antes: 0.4, depois: 1.8,
    quadro: (ctx, tl, c) => {
      cenaBrana(ctx, tl, c);
      const cab = tirarCapacete(ctx, 20, 0, 0.1);
      const b = ctx.ator('damasoRosto');
      const ri = entre(tl, 0.3, 0.8) * (1 - entre(tl, 2.6, 3.6));
      const p = somar(parado(tl * 0.5), BEIRA, { pescoco: [-14 * ri, 0, 0], cabeca: [-10 * ri, 0, 0], peito: [-4 * Math.abs(Math.sin(tl * 10)) * ri, 0, 0] });
      p.mandibula = [14 * ri + 4 * Math.abs(Math.sin(tl * 11)) * ri, 0, 0];
      b.pose(p);
      colocar(ctx, ctx.ator('lia'), 0.1, 0.4, olharPara([0.1, 0.4], [1.2, 0.2]));
      ctx.ator('lia').raiz.position.y = 0.44;
      ctx.ator('lia').pose(somar(parado(tl), U.CINTURA));
      camera(ctx, [cab.x + 0.85, cab.y + 0.05, cab.z - 0.35], [cab.x, cab.y + 0.06, cab.z], { fov: 30 });
    },
  },
);

// a porta da Brana, dias depois; e a estrada
planos.push(
  {
    id: '6.5a', cap: 6, ...ped('dia'), falas: ['6.5.01', '6.5.02', '6.5.03'], antes: 1.4, depois: 0.4, fadeIn: 1.0, atores: ['capaceteSolto', 'lia'],
    quadro: (ctx, tl, c) => {
      const p = portaCasa(0, 0.05);
      const cp = ctx.ator('capaceteSolto').raiz;
      const off = 0.95;
      cp.position.set(p.x + Math.cos(p.giro) * off, chao(p.x, p.z) + 1.55, p.z - Math.sin(p.giro) * off);
      cp.rotation.set(0, p.giro, 0.05);
      const l = ctx.ator('lia');
      const lx = p.x + Math.cos(p.giro) * off + Math.sin(p.giro) * 0.45, lz = p.z - Math.sin(p.giro) * off + Math.cos(p.giro) * 0.45;
      colocar(ctx, l, lx, lz, p.giro + Math.PI);
      l.pose(somar(parado(tl), { bracoD: [-120, 0, -10], antebracoD: [-20, 0, 0] }));
      l.mao('D', 'meia');
      ctx.cen.focar(p.x, 0, p.z);
      const k = tl / c.dur;
      camera(ctx, [lx + Math.sin(p.giro) * 1.6 - Math.cos(p.giro) * 0.9, chao(lx, lz) + 1.35, lz + Math.cos(p.giro) * 1.6 + Math.sin(p.giro) * 0.9], [cp.position.x, cp.position.y - 0.1, cp.position.z], { fov: 36 - k * 4 });
    },
  },
  {
    id: '6.5b', cap: 6, ...ped('dia'), falas: ['6.5.04', '6.5.05'], antes: 0.6, depois: 1.6, atores: ['capaceteSolto'],
    quadro: (ctx, tl, c) => {
      const p = portaCasa(0, 0.05);
      const cp = ctx.ator('capaceteSolto').raiz;
      cp.position.set(p.x + Math.cos(p.giro) * 0.95, chao(p.x, p.z) + 1.55, p.z - Math.sin(p.giro) * 0.95);
      cp.rotation.set(0, p.giro, 0.05);
      const k = tl / c.dur;
      const lado = p.giro - Math.PI / 2;
      camera(ctx, [cp.position.x + Math.sin(lado) * (0.7 - k * 0.2) + Math.sin(p.giro) * 0.3, cp.position.y + 0.14, cp.position.z + Math.cos(lado) * (0.7 - k * 0.2) + Math.cos(p.giro) * 0.3], [cp.position.x, cp.position.y + 0.12, cp.position.z], { fov: 30 });
    },
  },
  {
    id: '6.6a', cap: 6, cenario: 'pedralva:nascer', falas: ['6.6.01', '6.6.02'], antes: 1.2, depois: 0.6, fadeIn: 0.8, atores: ['damasoCamisa'],
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damasoCamisa');
      const z = lin(-9, 9, tl / c.dur);
      b.raiz.position.set(0, Math.abs(z) < 7.25 ? 0.44 : chao(0, z), z);
      b.raiz.rotation.y = 0;
      b.pose(andar((z + 9) / 1.4, { passo: 0.9 }));
      ctx.cen.focar(0, 0, z);
      camera(ctx, [-1.6, 2.2, -14], [0, 1.4, z + 6], { fov: 36 });
    },
  },
  {
    id: '6.6b', cap: 6, cenario: 'pedralva:nascer', falas: ['6.6.03'], antes: 0.4, depois: 3.6, fadeOut: 3.0, atores: ['damasoCamisa'],
    quadro: (ctx, tl, c) => {
      const b = ctx.ator('damasoCamisa');
      const z = lin(12, 17, tl / c.dur);
      const x = 0.6 * Math.sin(z * 0.03);
      b.raiz.position.set(x, chao(x, z), z);
      b.raiz.rotation.y = 0;
      b.pose(andar((z - 12) / 1.4, { passo: 0.9 }));
      ctx.cen.focar(x, 0, z);
      camera(ctx, [x + 0.5, chao(x, z + 2) + 1.62, z + 2.0], [x, chao(x, z) + 1.6, z], { fov: 32 });
    },
  },
);
