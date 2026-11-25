// O Cavaleiro Sem Armadura: planos (tomadas) sincronizados com as falas do roteiro.
// Cada plano: cenario, falas (ids), antes/depois/min (s), fades, música/ambiente e atualizar(c, P, ctx).
import { lerp } from '../../motor/ps1.js';
import { POSES, aplicar, parado, poseBase, caminhar, correr, andar } from '../../motor/personagem.js';
import { cavaloAndar } from '../../motor/animais.js';
import { LAYOUT } from '../../cenarios/estrada.js';

export const cenarios = {
  estrada: () => import('../../cenarios/estrada.js'),
  pedralva: () => import('../../cenarios/pedralva.js'),
};

import { S, cam, L, balanco, somar, sairDe } from './util.js';
import { planos2 } from './cap2.js';

// caminho do Enferrujado na estrada (x segue a curva)
const xHeroi = (c, z) => 0.3 + c.curva(z) * 0.9;
function heroiAndando(c, z0, z1, k, t) {
  const z = lerp(z0, z1, k);
  const de = [xHeroi(c, z0), z0], para = [xHeroi(c, z1), z1];
  caminhar(c.heroi, de, para, k, { amplitude: 1, peso: 0.7, bracoD: 0.3 });
  c.heroi.raiz.position.x = xHeroi(c, z);
  c.heroi.raiz.position.y = 0;
  return { x: xHeroi(c, z), z };
}
const noite = { musica: 'noite', ambiente: ['vento', 'grilos'] };

// ---------- planos ----------
const planos01 = [
  // ===================== ABERTURA =====================
  {
    id: 'ab1', cap: 0, cenario: 'estrada', falas: ['ab.01', 'ab.02'], antes: 2.5, depois: 0.3, fadeIn: 3, musica: 'abertura', ambiente: ['vento'],
    atualizar(c, P, { camera }) {
      c.mostrar();
      c.tronco.visible = false;
      Object.assign(c.estado, { lanterna: false, tocha: false, luaForte: 0.6 });
      const k = S(0, 1, P.k);
      cam(camera, somar(L([0.5, 1.15, 12], [0.25, 1.05, 5], k), balanco(P.t)), [0, 1.3, -24], 50);
    },
  },
  {
    id: 'ab2', cap: 0, cenario: 'estrada', falas: ['ab.03'], antes: 0.5, depois: 0.6, musica: 'abertura', ambiente: ['vento'],
    sons: (P) => [{ t: 0, som: 'arrastoEspada', dur: P.dur }],
    atualizar(c, P, { camera }) {
      c.mostrar('heroi');
      c.tronco.visible = false;
      Object.assign(c.estado, { lanterna: false, tocha: false, luaForte: 0.7 });
      const h = c.heroi;
      caminhar(h, [0.3, 3], [0.3, -4], P.k, { peso: 0.7, bracoD: 0.3 });
      h.raiz.rotation.y = Math.PI;
      const z = h.raiz.position.z;
      cam(camera, somar([0.9, 0.85, z + 3.3], balanco(P.t, 0.015)), [0.2, 1.25, z - 5], 48);
    },
  },
  {
    id: 'ab3', cap: 0, cenario: 'estrada', falas: ['ab.04'], antes: 0.4, depois: 0.5, musica: 'abertura', ambiente: ['vento'],
    atualizar(c, P, { camera }) {
      c.mostrar('heroi');
      c.tronco.visible = false;
      Object.assign(c.estado, { lanterna: false, tocha: false, luaForte: 1 });
      const h = c.heroi;
      caminhar(h, [0.3, -4], [0.3, -6.5], P.k, { peso: 0.7, amplitude: 0.8 });
      h.raiz.rotation.y = Math.PI;
      const z = h.raiz.position.z;
      const ang = lerp(-0.5, 0.15, S(0, 1, P.k));
      cam(camera, [0.3 - Math.cos(ang) * 0.75, 1.8, z + Math.sin(ang) * 0.75 - 0.05], [0.3, 1.76, z], 34);
    },
  },
  {
    id: 'ab4', cap: 0, cenario: 'estrada', falas: ['ab.05'], antes: 0.4, depois: 0.2, musica: 'abertura', ambiente: ['vento'],
    atualizar(c, P, { camera }) {
      c.mostrar('heroi');
      c.tronco.visible = false;
      Object.assign(c.estado, { lanterna: false, tocha: false, luaForte: 1 });
      const h = c.heroi;
      c.pos(h, 0.3, -6.5, Math.PI);
      parado(h, P.t);
      const d = lerp(1.0, 0.62, S(0, 1, P.k));
      cam(camera, [0.3, 1.77, -6.5 - d], [0.3, 1.75, -6.5], 30);
    },
  },
  {
    id: 'ab5', cap: 0, cenario: 'estrada', falas: ['ab.06'], antes: 0.3, depois: 2.2, fadeOut: 2, musica: 'abertura', ambiente: ['vento'],
    atualizar(c, P, { camera }) {
      c.mostrar('heroi');
      c.tronco.visible = false;
      Object.assign(c.estado, { lanterna: false, tocha: false, luaForte: 1 });
      const h = c.heroi;
      c.pos(h, 0.3, -6.5, Math.PI);
      parado(h, P.t);
      // close nos riscos do lado do capacete
      const k = S(0, 1, P.k);
      cam(camera, [0.3 + lerp(0.42, 0.34, k), 1.84, -6.5 - 0.25], [0.3, lerp(1.8, 1.86, k), -6.5 - 0.05], 26);
    },
  },
  { id: 'titulo', cap: 0, tela: { tipo: 'titulo', texto: 'O Cavaleiro\nSem Armadura' }, min: 6.5, antes: 0, musica: 'abertura' },

  // ===================== CAPÍTULO I =====================
  { id: 'c1', cap: 1, tela: { tipo: 'capitulo', n: 1, nome: 'A Estrada' }, min: 4.5, antes: 0, ambiente: ['vento'] },
  {
    id: '1.1a', cap: 1, cenario: 'estrada', falas: ['1.1.01', '1.1.02'], antes: 1.2, depois: 0.6, fadeIn: 1.5, ...noite,
    sons: (P) => [{ t: 0, som: 'carroca', dur: P.dur }],
    atualizar(c, P, { camera }) {
      c.mostrar('carroca', 'tome', 'dalia');
      const z = lerp(20, 11, P.k);
      c.carroAndando(z, 1, P.t);
      cam(camera, [-4.2, 1.55, z + 1.2], [0.2, 1.2, z - 0.8], 46);
    },
  },
  {
    id: '1.1b', cap: 1, cenario: 'estrada', falas: ['1.1.03'], antes: 0.4, depois: 1.0, ...noite,
    sons: (P) => [{ t: 0, som: 'carroca', dur: P.dur }],
    atualizar(c, P, { camera }) {
      c.mostrar('carroca', 'tome', 'dalia');
      const z = lerp(9, 3.2, P.k);
      c.carroAndando(z, 1, P.t);
      cam(camera, somar([1.4, 0.75, -4.2], balanco(P.t, 0.01)), [0.15, 1.5, z - 1.5], 44);
    },
  },
  {
    id: '1.1c', cap: 1, cenario: 'estrada', min: 4.2, antes: 0, ...noite,
    sons: (P) => [{ t: 0, som: 'carroca', dur: 2.6 }, { t: 2.4, som: 'relincho' }],
    atualizar(c, P, { camera }) {
      c.mostrar('carroca', 'tome', 'dalia');
      const k = Math.min(P.t / 3.0, 1);
      const z = lerp(3.2, LAYOUT.carroZ, sairDe(0, k));
      c.carroAndando(z, 1 - k, P.t);
      cam(camera, [LAYOUT.carroX - 0.1, 2.75, z + 0.9], [0.15, 0.4, LAYOUT.troncoZ], 50);
    },
  },
  {
    id: '1.2a', cap: 1, cenario: 'estrada', falas: ['1.2.01'], antes: 2.2, depois: 0.6, musica: 'tensao', ambiente: ['vento', 'grilos'],
    sons: () => [{ t: 0.3, som: 'passosMato' }],
    atualizar(c, P, { camera }) {
      const k = S(0, 2.0, P.t);
      caminhar(c.raposa, [0.7, -10], LAYOUT.raposa, k, { peso: 0.3 });
      caminhar(c.b1, [-5, -4.0], LAYOUT.b1, k, { peso: 0.3 });
      caminhar(c.b2, [5, -6.0], LAYOUT.b2, k, { peso: 0.3 });
      if (k >= 1) {
        for (const [p, x, z] of [[c.raposa, ...LAYOUT.raposa], [c.b1, ...LAYOUT.b1], [c.b2, ...LAYOUT.b2]]) {
          parado(p, P.t + x);
          c.virarPara(p, 0.1, -2.5);
        }
        aplicar(c.raposa, POSES.arcoPronto, S(2.0, 2.6, P.t));
        c.raposa.arco.userData.puxar(0.6 * S(2.2, 2.8, P.t));
      }
      c.mostrar('carroca', 'tome', 'dalia', 'raposa', 'b1', 'b2');
      cam(camera, [2.6, 3.6, 2.2], [0.2, 0.9, -6.4], 46);
    },
  },
  {
    id: '1.2b', cap: 1, cenario: 'estrada', falas: ['1.2.02'], antes: 0.3, depois: 0.5, musica: 'tensao', ambiente: ['vento'],
    atualizar(c, P, { camera }) {
      c.mostrar('carroca', 'tome', 'dalia', 'raposa', 'b1', 'b2');
      const cab = c.cabecaDe(c.tome, 0.1);
      cam(camera, [cab.x - 0.15, cab.y + 0.02, cab.z - 1.05], [cab.x, cab.y - 0.02, cab.z], 34);
      c.tome.j.cabeca.rotation.x = -0.1;
    },
  },
  {
    id: '1.2c', cap: 1, cenario: 'estrada', falas: ['1.2.03'], antes: 0.3, depois: 0.5, musica: 'tensao', ambiente: ['vento'],
    atualizar(c, P, { camera }) {
      c.mostrar('carroca', 'tome', 'dalia', 'raposa', 'b1', 'b2');
      const r = c.raposa;
      c.virarPara(r, 0.1, -2.5);
      aplicar(r, POSES.arcoPronto);
      r.arco.userData.puxar(0.6);
      const cab = c.cabecaDe(r, 0.1);
      cam(camera, [cab.x + 0.75, cab.y - 0.05, cab.z + 1.2], [cab.x, cab.y - 0.08, cab.z], 36);
    },
  },
  {
    id: '1.2d', cap: 1, cenario: 'estrada', falas: ['1.2.04'], antes: 0.3, depois: 0.6, musica: 'tensao', ambiente: ['vento'],
    atualizar(c, P, { camera }) {
      c.mostrar('carroca', 'tome', 'dalia', 'raposa', 'b1', 'b2');
      const d = c.dalia;
      aplicar(d, { tronco: [0.25, 0, 0], cabeca: [0.35, 0, 0], ombroE: [0.05, 0, -0.05], ombroD: [0.05, 0, 0.05] }, S(0.2, 1.2, P.t));
      const cab = c.cabecaDe(d, 0.0);
      cam(camera, [cab.x + 0.55, cab.y + 0.02, cab.z - 0.85], [cab.x, cab.y - 0.15, cab.z], 36);
    },
  },
  {
    id: '1.2e', cap: 1, cenario: 'estrada', falas: ['1.2.05'], antes: 0.3, depois: 1.2, musica: 'tensao', ambiente: ['vento'],
    atualizar(c, P, { camera }) {
      c.mostrar('carroca', 'tome', 'dalia', 'raposa', 'b1', 'b2');
      c.virarPara(c.raposa, 0.1, -2.5);
      aplicar(c.raposa, POSES.arcoPronto);
      c.raposa.arco.userData.puxar(0.6);
      const k = S(0, 1, P.k);
      cam(camera, [0.95, lerp(1.05, 0.95, k), lerp(-5.3, -6.1, k)], [-0.1, 1.15, -26], 46);
    },
  },
  {
    id: '1.3a', cap: 1, cenario: 'estrada', falas: ['1.3.01', '1.3.02'], antes: 0.8, depois: 0.8, musica: 'presenca', ambiente: ['vento'],
    sons: (P) => [{ t: 0, som: 'arrastoEspada', dur: P.dur, longe: 1 }],
    atualizar(c, P, { camera }) {
      c.mostrar('todos');
      heroiAndando(c, -31, -24.5, P.k, P.t);
      c.virarPara(c.raposa, 0.1, -2.5);
      aplicar(c.raposa, POSES.arcoPronto);
      c.raposa.arco.userData.puxar(0.6);
      // os bandidos ouvem o som e olham para a estrada
      const o = S(1.5, 3.5, P.t);
      c.b1.j.cabeca.rotation.y = lerp(0, 2.2, o) * 0.4;
      c.b2.j.cabeca.rotation.y = -lerp(0, 2.2, o) * 0.4;
      const k = S(0, 1, P.k);
      cam(camera, L([1.75, 1.36, 4.8], [1.4, 1.3, 4.0], k), [0.05, 1.2, -16], 50);
    },
  },
  {
    id: '1.3b', cap: 1, cenario: 'estrada', falas: ['1.3.03'], antes: 0.3, depois: 0.5, musica: 'presenca', ambiente: ['vento'],
    sons: (P) => [{ t: 0, som: 'arrastoEspada', dur: P.dur }, { t: 0, som: 'passosDescalco', dur: P.dur }],
    atualizar(c, P, { camera }) {
      c.mostrar('heroi', 'raposa', 'b1', 'b2', 'carroca', 'tome', 'dalia');
      Object.assign(c.estado, { luaForte: 0.5 });
      const { x, z } = heroiAndando(c, -24.5, -20, P.k, P.t);
      cam(camera, [x + 0.65, 0.28, z + 2.3], [x, 0.4, z], 46);
    },
  },
  {
    id: '1.3c', cap: 1, cenario: 'estrada', falas: ['1.3.04'], antes: 0.3, depois: 0.6, musica: 'presenca', ambiente: ['vento'],
    sons: (P) => [{ t: 0, som: 'arrastoEspada', dur: P.dur }],
    atualizar(c, P, { camera }) {
      c.mostrar('heroi', 'raposa', 'b1', 'b2', 'carroca', 'tome', 'dalia');
      Object.assign(c.estado, { luaForte: 0.6 });
      const { x, z } = heroiAndando(c, -20, -16.5, P.k, P.t);
      cam(camera, [x + 0.35, 1.45, z + 2.1], [x, 1.62, z], 40);
    },
  },
  {
    id: '1.3d', cap: 1, cenario: 'estrada', falas: ['1.3.05'], antes: 0.2, depois: 0.4, musica: 'presenca', ambiente: ['vento'],
    sons: (P) => [{ t: 0.1, som: 'risada' }],
    atualizar(c, P, { camera }) {
      c.mostrar('todos');
      heroiAndando(c, -16.5, -15, P.k, P.t);
      c.virarPara(c.b1, -0.5, -15);
      aplicar(c.b1, POSES.apontar, S(0, 0.5, P.t));
      c.b1.j.tronco.rotation.x = -0.12 + 0.06 * Math.sin(P.t * 14) * (1 - S(0.5, 1.6, P.t));
      c.virarPara(c.b2, -0.5, -15);
      const cab = c.cabecaDe(c.b1, 0.05);
      cam(camera, [cab.x - 0.7, cab.y - 0.1, cab.z - 1.6], [cab.x, cab.y - 0.1, cab.z], 38);
    },
  },
  {
    id: '1.3e', cap: 1, cenario: 'estrada', falas: ['1.3.06'], antes: 0.6, depois: 0.4, musica: 'presenca', ambiente: ['vento'],
    atualizar(c, P, { camera }) {
      c.mostrar('todos');
      heroiAndando(c, -15, -13.2, P.k, P.t);
      const r = c.raposa;
      c.virarPara(r, 0.1, -2.5);
      r.raiz.rotation.y += lerp(0, Math.PI - 0.2, S(0, 0.6, P.t));
      aplicar(r, POSES.apontar, S(0.4, 0.9, P.t) * 0.7);
      const cab = c.cabecaDe(r, 0.05);
      cam(camera, [cab.x + 0.9, cab.y - 0.05, cab.z - 1.5], [cab.x, cab.y - 0.1, cab.z], 38);
    },
  },
  {
    id: '1.3f', cap: 1, cenario: 'estrada', falas: ['1.3.07'], antes: 0.4, depois: 0.6, musica: 'presenca', ambiente: ['vento'],
    sons: (P) => [{ t: 0, som: 'arrastoEspada', dur: P.dur }],
    atualizar(c, P, { camera }) {
      c.mostrar('todos');
      const { x, z } = heroiAndando(c, -13.2, -10.8, P.k, P.t);
      c.virarPara(c.raposa, x, z);
      c.virarPara(c.b1, x, z);
      c.virarPara(c.b2, x, z);
      aplicar(c.b2, POSES.encolhido, 0.3);
      cam(camera, [-0.35, 1.55, -5.4], [x, 1.35, z], 44);
    },
  },
  {
    id: '1.4a', cap: 1, cenario: 'estrada', min: 2.7, antes: 0, musica: 'presenca', ambiente: ['vento'],
    sons: () => [{ t: 0.2, som: 'arcoTensao' }, { t: 2.35, som: 'disparo' }],
    atualizar(c, P, { camera }) {
      c.mostrar('todos');
      const hx = xHeroi(c, -10.6);
      c.pos(c.heroi, hx, -10.6, 0);
      andar(c.heroi, P.t * 4.4, { peso: 0.7, bracoD: 0.3 });
      const r = c.raposa;
      c.virarPara(r, hx, -10.6);
      aplicar(r, POSES.arcoPronto);
      const puxa = P.t < 2.3 ? S(0.1, 2.0, P.t) : 0;
      r.arco.userData.puxar(puxa);
      // flecha encaixada no arco
      if (P.t < 2.3) {
        c.flecha.visible = true;
        r.arco.add(c.flecha);
        c.flecha.position.set(0, 0, r.arco.userData.zCorda(puxa) + 0.35);
        c.flecha.rotation.set(0, 0, 0);
      }
      const cab = c.cabecaDe(r, 0);
      const k = S(0, 2.3, P.t);
      cam(camera, [cab.x + lerp(1.5, 1.2, k), cab.y - 0.15, cab.z - lerp(0.5, 0.8, k)], [lerp(cab.x, hx, 0.35), 1.5, lerp(cab.z, -10.6, 0.35)], 44);
    },
  },
  {
    id: '1.4b', cap: 1, cenario: 'estrada', falas: ['1.4.01'], antes: 0.6, depois: 0.2, musica: 'impacto', ambiente: ['vento'],
    sons: () => [{ t: 0.12, som: 'impactoFlecha' }],
    atualizar(c, P, { camera }) {
      c.mostrar('todos');
      const hx = xHeroi(c, -10.6), h = c.heroi;
      c.pos(h, hx, -10.6, 0);
      parado(h, P.t);
      const recuo = Math.exp(-P.t * 3) * 0.35 * S(0.1, 0.16, P.t);
      h.j.tronco.rotation.x -= recuo;
      // flecha voando até o peito em 0.12 s, depois cravada
      const peito = c.mundo(h.j.tronco, [0.07, 0.33, 0.15]);
      if (P.t < 0.12) {
        const de = c.mundo(c.raposa.j.tronco, [0, 0.35, 0.5]);
        c.cena.add(c.flecha);
        c.flecha.visible = true;
        c.flecha.position.lerpVectors(de, peito, P.t / 0.12);
        c.flecha.lookAt(peito);
      } else {
        c.flecha.visible = true;
        h.j.tronco.add(c.flecha);
        c.flecha.position.set(0.07, 0.36, 0.44);
        c.flecha.rotation.set(0.15, Math.PI + 0.1, 0);
        c.ferida.visible = true;
      }
      c.estado.luzExtra = [{ pos: [hx + 1.4, 1.8, -8.6], cor: 0xff9a50, intensidade: 0.8, alcance: 4.5 }];
      cam(camera, [hx - 1.25, 1.5, -8.9], [hx, 1.45, -10.6], 42);
    },
  },
  {
    id: '1.4c', cap: 1, cenario: 'estrada', falas: ['1.4.02'], antes: 0.3, depois: 0.4, musica: 'impacto', ambiente: ['vento'],
    sons: (P) => [{ t: P.fala(0).t0 + P.fala(0).dur * 0.85, som: 'arrancar' }],
    atualizar(c, P, { camera }) {
      c.mostrar('todos');
      const hx = xHeroi(c, -10.6), h = c.heroi;
      c.pos(h, hx, -10.6, 0);
      parado(h, P.t);
      const f = P.fala(0);
      const tOlha = f.t0, tSegura = f.t0 + f.dur * 0.45, tArranca = f.t0 + f.dur * 0.82;
      aplicar(h, POSES.olharBaixo, S(tOlha, tOlha + 0.6, P.t) * (1 - 0.6 * S(tArranca + 0.3, tArranca + 1.2, P.t)));
      aplicar(h, POSES.maoNoPeito, S(tSegura - 0.6, tSegura, P.t) * (1 - S(tArranca, tArranca + 0.25, P.t)));
      aplicar(h, POSES.puxarFlecha, S(tArranca, tArranca + 0.25, P.t));
      c.ferida.visible = true;
      c.flecha.visible = true;
      if (P.t < tArranca) {
        h.j.tronco.add(c.flecha);
        c.flecha.position.set(0.07, 0.36, 0.44);
        c.flecha.rotation.set(0.15, Math.PI + 0.1, 0);
      } else {
        h.maoD.add(c.flecha);
        c.flecha.position.set(0, -0.02, 0.05);
        c.flecha.rotation.set(-1.3, 0, 0);
      }
      c.estado.luzExtra = [{ pos: [hx + 1.4, 1.8, -8.6], cor: 0xff9a50, intensidade: 0.8, alcance: 4.5 }];
      cam(camera, [hx + 0.55, 1.62, -10.6 + 0.95], [hx, 1.38, -10.6], 40);
    },
  },
  {
    id: '1.4d', cap: 1, cenario: 'estrada', min: 3.4, antes: 0, musica: 'impacto', ambiente: ['vento'],
    sons: () => [{ t: 0.3, som: 'cura', dur: 2.6 }],
    atualizar(c, P, { camera }) {
      c.mostrar('todos');
      const hx = xHeroi(c, -10.6), h = c.heroi;
      c.pos(h, hx, -10.6, 0);
      parado(h, P.t);
      aplicar(h, POSES.puxarFlecha);
      h.maoD.add(c.flecha);
      c.flecha.visible = true;
      c.flecha.position.set(0, -0.02, 0.05);
      c.flecha.rotation.set(-1.3, 0, 0);
      c.ferida.visible = true;
      c.ferida.scale.setScalar(Math.max(0.001, 1 - S(0.4, 2.9, P.t)));
      const alvo = c.mundo(h.j.tronco, [0.07, 0.33, 0.15]);
      c.estado.luzExtra = [{ pos: [alvo.x + 0.8, alvo.y + 0.3, alvo.z + 1.2], cor: 0xff9a50, intensidade: 0.9, alcance: 3 }];
      cam(camera, [alvo.x + 0.2, alvo.y + 0.12, alvo.z + 0.85], [alvo.x - 0.02, alvo.y + 0.08, alvo.z], 32);
    },
  },
  {
    id: '1.4e', cap: 1, cenario: 'estrada', falas: ['1.4.03'], antes: 0.3, depois: 0.5, musica: 'impacto', ambiente: ['vento'],
    atualizar(c, P, { camera }) {
      c.mostrar('todos');
      const hx = xHeroi(c, -10.6);
      c.pos(c.heroi, hx, -10.6, 0);
      c.virarPara(c.b2, hx, -10.6);
      aplicar(c.b2, POSES.encolhido, 0.5);
      c.b2.j.ombroD.rotation.z += Math.sin(P.t * 30) * 0.03; // tocha tremendo
      const cab = c.cabecaDe(c.b2, 0.05);
      cam(camera, [cab.x + 0.25, cab.y - 0.08, cab.z - 1.1], [cab.x, cab.y - 0.08, cab.z], 36);
    },
  },
  {
    id: '1.5a', cap: 1, cenario: 'estrada', falas: ['1.5.01'], antes: 0.3, depois: 0.5, musica: 'acao', ambiente: ['vento'],
    sons: () => [{ t: 0.55, som: 'golpe' }, { t: 0.62, som: 'madeiraQuebra' }],
    atualizar(c, P, { camera }) {
      c.mostrar('todos');
      const h = c.heroi, r = c.raposa;
      c.pos(h, 0.35, -8.7, 0);
      c.pos(r, 0.3, -7.5, Math.PI);
      parado(h, P.t);
      parado(r, P.t);
      aplicar(r, POSES.arcoPronto, 0.85 * (1 - S(0.6, 0.8, P.t)));
      const sobe = S(0, 0.35, P.t), desce = S(0.42, 0.62, P.t);
      aplicar(h, POSES.espadaAlto, sobe * (1 - desce));
      aplicar(h, POSES.espadaBaixo, desce);
      if (P.t > 0.6) {
        r.arco.visible = false;
        const q = Math.min((P.t - 0.6) / 0.6, 1);
        c.pedacos.forEach((pd, i) => {
          pd.visible = true;
          pd.position.set(0.25 + (i ? 0.3 : -0.2) * q, lerp(1.25, 0.03, q * q), -7.95 + (i ? 0.2 : -0.1) * q);
          pd.rotation.set(q * (i ? 2 : -1.6), 0, Math.PI / 2 * q * (i ? 1 : -1));
        });
        aplicar(r, POSES.maosAoAlto, S(0.7, 1.1, P.t) * 0.7);
      } else r.arco.visible = true;
      cam(camera, [2.6, 1.35, -8.0], [0.3, 1.25, -8.1], 44);
    },
  },
  {
    id: '1.5b', cap: 1, cenario: 'estrada', falas: ['1.5.02'], antes: 0.2, depois: 0.4, musica: 'acao', ambiente: ['vento'],
    sons: () => [{ t: 1.05, som: 'pancada' }, { t: 1.5, som: 'queda' }],
    atualizar(c, P, { camera }) {
      c.mostrar('todos');
      const h = c.heroi, b = c.b1;
      c.pos(h, 0.35, -8.7, -Math.PI / 2 - 0.25);
      parado(h, P.t);
      c.raposa.arco.visible = false;
      c.pos(c.raposa, 0.6, -7.2, Math.PI);
      aplicar(c.raposa, POSES.maosAoAlto, 0.7);
      const kc = S(0, 1.0, P.t);
      if (P.t < 1.05) {
        caminhar(b, LAYOUT.b1, [-0.45, -8.4], kc, { correndo: true, amplitude: 0.9 });
        aplicar(b, POSES.espadaAlto, S(0.5, 0.9, P.t));
      } else {
        c.pos(b, -0.45 - S(1.05, 1.5, P.t) * 0.5, -8.4, Math.PI / 2);
        parado(b, P.t);
        aplicar(b, POSES.caidoSentado, S(1.05, 1.5, P.t));
      }
      aplicar(h, POSES.socoPreparo, S(0.6, 0.92, P.t) * (1 - S(0.95, 1.05, P.t)));
      aplicar(h, POSES.soco, S(0.95, 1.06, P.t) * (1 - S(1.5, 2.0, P.t)));
      cam(camera, [-2.6, 1.45, -10.6], [-0.3, 1.1, -8.3], 44);
    },
  },
  {
    id: '1.5c', cap: 1, cenario: 'estrada', falas: ['1.5.03'], antes: 0.3, depois: 1.2, musica: 'acao', ambiente: ['vento'],
    sons: () => [{ t: 0.4, som: 'tochaCai' }, { t: 0.2, som: 'corrida', dur: 3 }],
    atualizar(c, P, { camera }) {
      c.mostrar('todos');
      const h = c.heroi;
      c.pos(h, 0.35, -8.7, Math.PI * 0.1);
      parado(h, P.t);
      c.raposa.arco.visible = false;
      const k = S(0.2, 3.2, P.t);
      caminhar(c.raposa, [0.6, -7.2], [-7.5, -13], k, { correndo: true });
      caminhar(c.b1, [-0.95, -8.4], [-6.5, -9.5], S(0.6, 3.4, P.t), { correndo: true });
      caminhar(c.b2, LAYOUT.b2, [7.5, -9], k, { correndo: true });
      // a tocha cai no chão
      c.estado.tochaPos = c.mundo(c.cena, [2.3, 0.12, -5.4]);
      c.b2.tocha.visible = false;
      cam(camera, [3.4, 3.1, -1.8], [0.2, 0.9, -9.2], 50);
    },
  },
  {
    id: '1.6a', cap: 1, cenario: 'estrada', min: 4.6, antes: 0, musica: 'calma', ambiente: ['vento', 'grilos'],
    sons: () => [{ t: 1.2, som: 'troncoArrasta', dur: 2.6 }],
    atualizar(c, P, { camera }) {
      c.mostrar('heroi', 'carroca', 'tome', 'dalia');
      c.estado.tochaPos = c.mundo(c.cena, [2.3, 0.12, -5.4]);
      const h = c.heroi;
      const k = S(1.2, 3.8, P.t);
      caminhar(h, [0.35, -8.7], [-1.25, -6.7], S(0, 1.1, P.t));
      if (P.t > 1.1) {
        c.pos(h, -1.25 + k * 1.2, -6.7 + k * 0.3, Math.PI / 2);
        parado(h, P.t);
        aplicar(h, POSES.empurrar, S(1.1, 1.4, P.t) * (1 - S(3.8, 4.3, P.t)));
      }
      c.tronco.position.set(0.15 + k * 2.6, 0, LAYOUT.troncoZ + k * 0.6);
      c.tronco.rotation.y = 0.08 + k * 0.9;
      cam(camera, [-3.0, 1.5, -9.4], [0.4, 0.6, -6.2], 46);
    },
  },
  {
    id: '1.6b', cap: 1, cenario: 'estrada', falas: ['1.6.01'], antes: 0.5, depois: 0.4, musica: 'calma', ambiente: ['vento', 'grilos'],
    atualizar(c, P, { camera }) {
      c.mostrar('heroi', 'carroca', 'tome', 'dalia');
      fimDoTronco(c);
      const { tome, heroi } = c;
      c.cena.attach(tome.raiz);
      c.pos(tome, -0.95, -3.95);
      c.virarPara(tome, -0.6, -5.4);
      parado(tome, P.t);
      c.pos(heroi, -0.6, -5.45);
      c.virarPara(heroi, -0.95, -3.95);
      parado(heroi, P.t);
      const cab = c.cabecaDe(heroi, 0.1);
      cam(camera, [cab.x - 0.55, cab.y + 0.05, cab.z - 0.6], c.cabecaDe(tome, 0.05).toArray(), 40);
    },
  },
  {
    id: '1.6c', cap: 1, cenario: 'estrada', falas: ['1.6.02'], antes: 0.6, depois: 0.6, musica: 'calma', ambiente: ['vento', 'grilos'],
    atualizar(c, P, { camera }) {
      c.mostrar('heroi', 'carroca', 'tome', 'dalia');
      fimDoTronco(c);
      const { tome, heroi } = c;
      c.cena.attach(tome.raiz);
      c.pos(tome, -0.95, -3.95);
      c.virarPara(tome, -0.6, -5.4);
      parado(tome, P.t);
      c.pos(heroi, -0.6, -5.45);
      c.virarPara(heroi, -0.95, -3.95);
      parado(heroi, P.t);
      const cab = c.cabecaDe(heroi, 0.05);
      cam(camera, [cab.x - 0.3, cab.y - 0.05, cab.z + 0.95], [cab.x, cab.y - 0.05, cab.z], 34);
    },
  },
  {
    id: '1.6d', cap: 1, cenario: 'estrada', falas: ['1.6.03'], antes: 0.3, depois: 0.6, musica: 'calma', ambiente: ['vento', 'grilos'],
    atualizar(c, P, { camera }) {
      c.mostrar('heroi', 'carroca', 'tome', 'dalia');
      fimDoTronco(c);
      const { tome, heroi } = c;
      c.cena.attach(tome.raiz);
      c.pos(tome, -0.95, -3.95);
      c.virarPara(tome, -0.6, -5.4);
      parado(tome, P.t);
      aplicar(tome, { ombroE: [-0.5, 0, -0.1], cotoveloE: [-0.6, 0, 0], ombroD: [-0.5, 0, 0.1], cotoveloD: [-0.6, 0, 0] }, S(0.5, 1.2, P.t));
      c.pos(heroi, -0.6, -5.45);
      c.virarPara(heroi, -0.95, -3.95);
      parado(heroi, P.t);
      const cab = c.cabecaDe(tome, 0.08);
      cam(camera, [cab.x - 0.2, cab.y + 0.0, cab.z - 1.15], [cab.x, cab.y - 0.05, cab.z], 34);
    },
  },
  {
    id: '1.6e', cap: 1, cenario: 'estrada', falas: ['1.6.04', '1.6.05'], antes: 0.4, depois: 0.8, musica: 'calma', ambiente: ['vento', 'grilos'],
    atualizar(c, P, { camera }) {
      c.mostrar('heroi', 'carroca', 'tome', 'dalia');
      fimDoTronco(c);
      const { tome, heroi } = c;
      c.cena.attach(tome.raiz);
      c.pos(tome, -0.95, -3.95);
      c.virarPara(tome, -0.6, -5.4);
      parado(tome, P.t);
      c.pos(heroi, -0.6, -5.45);
      c.virarPara(heroi, -0.2, -3.4);
      parado(heroi, P.t);
      // olha a mulher, o bebê e o ferreiro; depois conta: um, dois, três
      const f1 = P.fala(0), f2 = P.fala(1);
      const yaw = P.t < f1.t0 + f1.dur * 0.55 ? 0.15 : P.t < f1.t1 ? 0.1 : -0.35;
      const pitch = P.t > f1.t0 + f1.dur * 0.35 && P.t < f1.t0 + f1.dur * 0.7 ? 0.25 : 0;
      heroi.j.cabeca.rotation.y = yaw;
      heroi.j.cabeca.rotation.x = pitch;
      if (P.t > f2.t0 + f2.dur * 0.45) {
        const n = Math.min(2, Math.floor(((P.t - (f2.t0 + f2.dur * 0.45)) / (f2.dur * 0.55)) * 3));
        heroi.j.cabeca.rotation.y = [0.2, 0.12, -0.35][n];
        heroi.j.cabeca.rotation.x = n === 1 ? 0.2 : 0.05;
      }
      const cab = c.cabecaDe(heroi, 0.1);
      cam(camera, [cab.x - 0.35, cab.y + 0.12, cab.z - 0.75], [0.25, 1.55, -2.7], 42);
    },
  },
  {
    id: '1.6f', cap: 1, cenario: 'estrada', falas: ['1.6.06'], antes: 0.8, depois: 7, fadeOut: 3.5, musica: 'aurora', ambiente: ['passaros', 'vento'],
    sons: (P) => [{ t: 0, som: 'carroca', dur: P.dur }],
    atualizar(c, P, { camera }) {
      c.mostrar('heroi', 'carroca', 'tome', 'dalia');
      fimDoTronco(c);
      c.estado.tocha = false;
      c.estado.amanhecer = S(0, P.dur, P.t) * 0.9;
      const k = P.k;
      const z = lerp(LAYOUT.carroZ, -17, k);
      c.carroAndando(z, 1, P.t);
      c.pos(c.heroi, -1.3 + c.curva(z - 3) * 0.6, z - 3.2, Math.PI);
      andar(c.heroi, ((-z) / 1.44) * Math.PI * 2, { peso: 0.6, bracoD: 0.3 });
      cam(camera, [lerp(1.8, 0.8, k), lerp(2.0, 2.8, k), lerp(4.5, z + 9, S(0, 0.4, k))], [0, 1.1, z - 6], 50);
    },
  },
];

export const planos = [...planos01, ...planos2];

// depois que o tronco foi empurrado para fora da estrada
function fimDoTronco(c) {
  c.tronco.position.set(0.15 + 2.6, 0, LAYOUT.troncoZ + 0.6);
  c.tronco.rotation.y = 0.98;
  c.estado.tochaPos = c.mundo(c.cena, [2.3, 0.12, -5.4]);
}
