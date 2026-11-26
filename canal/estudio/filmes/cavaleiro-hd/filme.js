// "O Cavaleiro Sem Armadura" no motor HD: planos (câmera, atores, ações) sobre a linha do tempo travada.
// Cada fala tem espaço fixo (tempos.json); a dublagem é feita depois para caber nele.
import * as THREE from 'three';
import { cenarios } from './cenarios.js';
import { pessoa, criarArco, criarFlecha, criarBebe, criarTocha, criarCavalo, criarCarroca } from './elenco.js';
import { criarLanterna, estrada as EST, alturaChao } from '../../motor-hd/natureza.js';
import { cavaloAndar } from '../../motor-hd/cavalo.js';
import { tochaAcesa } from '../../motor-hd/efeitos.js';
import * as U from './util.js';

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
    const ferida = new THREE.Mesh(new THREE.CircleGeometry(0.018, 16), new THREE.MeshStandardMaterial({ color: 0x3a0806, roughness: 0.35, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }));
    ferida.position.set(b.J.peito[0] + 0.07, b.J.peito[1] + 0.1, 0.165);
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
    a.position.set(...b.J.pulsoE);
    b.prender('maoE', a);
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
  dalia && (dalia.raiz.rotation.y = 0.5);
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
const noite = { cenario: 'estrada' };
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
      camera(ctx, [-0.9, 2.15, 0.2], [2.0, 1.35, -6.2], { fov: 36, tremor: 0.6, t: tl });
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
      camera(ctx, [1.0, 1.55, 0.6 - k * 0.15], [0.2, 1.08, -0.25], { fov: 30 });
    },
  },
  {
    id: '1.2e', cap: 1, ...noite, falas: ['1.2.05'], antes: 0.3, depois: 1.2, atores: ['carroca', 'tome', 'dalia', 'damaso'],
    preparar: (ctx) => { sentarNaCarroca(ctx, ctx.ator('carroca')); posCarroca(ctx, ctx.ator('carroca'), Z_PARADA); },
    quadro: (ctx, tl, c) => {
      animarCarroca(ctx, ctx.ator('carroca'), tl, false, 20);
      poseCarroca(ctx, tl);
      ctx.ator('damaso').pose(damAndando(ctx, [C(-34), -34], [C(-31), -31], 0, c.dur, tl));
      ctx.cen.focar(-1, 0, -12);
      const k = tl / c.dur;
      camera(ctx, [0.3, 1.9, 2.8 - k * 0.6], [-1.8, 1.25, -24], { fov: lin(32, 26, k) });
    },
  },
  {
    id: '1.3a', cap: 1, ...noite, falas: ['1.3.01', '1.3.02'], antes: 0.8, depois: 0.8, atores: ['damaso'],
    quadro: (ctx, tl, c) => {
      ctx.ator('damaso').pose(damAndando(ctx, [C(-27), -27], [C(-16), -16], 0, c.dur, tl));
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
      ctx.cen.focar(...RAP.slice(0, 1), 0, RAP[1]);
      const p = r.raiz.position;
      camera(ctx, [p.x - 0.2, p.y + 1.55, p.z - 0.75], [p.x - 0.35, p.y + 1.5, p.z + 0.3], { fov: 28, tremor: solta ? 1.2 : 0.2, t: tl * 3 });
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
      camera(ctx, [p.x + 0.7, p.y + 1.55, p.z + 1.0], [p.x, p.y + 1.35, p.z], { fov: 32 });
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
      camera(ctx, [-3.4, 1.4, -2.6], [0.6, 0.7, -5.4], { fov: 40 });
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
      camera(ctx, [1.6, 1.65, -2.1], [-0.4, 1.62, -3.3], { fov: 34 });
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
