// Capítulo VI: O Rosto.
import { lerp } from '../../motor/ps1.js';
import { POSES, aplicar, parado, caminhar, andar } from '../../motor/personagem.js';
import { S, cam, L, balanco, somar, v3 } from './util.js';

const manha = { ambiente: ['passaros', 'vento'] };
const POS_H = [-0.75, -1.0], POS_B = [-0.05, -1.95];

function amanhecer(c, P) {
  c.estado.clima = 'amanhecerRosa';
  c.estado.vento = 0.3;
  c.mostrar();
}

// sentado no chão da ponte, de frente para o rio (+x)
function sentadoNaPonte(c, p, P) {
  p.raiz.visible = true;
  c.naPonte(p, POS_H[1], POS_H[0], Math.PI / 2);
  parado(p, P.t * 0.5);
  aplicar(p, POSES.sentadoChao);
  if (p.espada) p.espada.rotation.x = Math.PI / 2;
}

function branaSentada(c, P) {
  const b = c.brana;
  b.raiz.visible = true;
  c.barrilPonte.visible = true;
  c.barrilPonte.position.set(POS_B[0], 0.48, POS_B[1]);
  b.raiz.position.set(POS_B[0], 0.48 + 0.36, POS_B[1]);
  b.raiz.rotation.set(0, Math.PI / 2, 0);
  parado(b, P.t);
  aplicar(b, POSES.sentado);
  b.j.cabeca.rotation.y = 0.15;
}

// mão esquerda erguida na frente do peito (para o corte e a atadura)
const MAO_ABERTA = { ombroE: [-0.75, 0, -0.15], cotoveloE: [-0.75, 0, 0] };

function corteNaMao(c, h, escala, sangra = 0) {
  c.corte.visible = escala > 0.02;
  h.maoE.add(c.corte);
  c.corte.position.set(0, -0.05, 0.023);
  c.corte.scale.set(escala, 1 + sangra * 1.5, 1);
}

export const planos6 = [
  { id: 'c6', cap: 6, tela: { tipo: 'capitulo', n: 6, nome: 'O Rosto' }, min: 4.5, antes: 0, ambiente: ['passaros'] },
  {
    id: '6.1a', cap: 6, cenario: 'pedralva', falas: ['6.1.01', '6.1.02'], antes: 2.4, depois: 0.4, fadeIn: 1.6, musica: 'aurora', ...manha,
    sons: () => [{ t: 0.9, som: 'arrancar' }],
    atualizar(c, P, { camera }) {
      amanhecer(c, P);
      const h = c.heroi;
      sentadoNaPonte(c, h, P);
      aplicar(h, MAO_ABERTA, S(0, 0.6, P.t));
      aplicar(h, { ombroD: [-0.9, 0, 0.5], cotoveloD: [-0.9, 0, 0] }, S(0.2, 0.8, P.t) * (1 - S(1.4, 2.0, P.t)));
      const f1 = P.fala(0);
      corteNaMao(c, h, P.t < 0.9 ? 0 : 1 - S(f1.t0, f1.t1, P.t));
      const m = c.mundo(h.maoE, [0, -0.05, 0]);
      const longe = S(P.fala(1).t0 - 0.3, P.fala(1).t0 + 0.3, P.t);
      cam(camera, L([m.x + 0.45, m.y + 0.12, m.z - 0.15], [m.x + 1.6, m.y + 0.5, m.z - 0.9], longe), [m.x, m.y + longe * 0.25, m.z + longe * 0.1], lerp(30, 42, longe));
    },
  },
  {
    id: '6.1b', cap: 6, cenario: 'pedralva', falas: ['6.1.03'], antes: 0.6, depois: 1.6, musica: 'aurora', ...manha,
    sons: (P) => [{ t: P.fala(0).t1 + 0.5, som: 'pancada' }],
    atualizar(c, P, { camera }) {
      amanhecer(c, P);
      const h = c.heroi;
      sentadoNaPonte(c, h, P);
      const f = P.fala(0);
      const larga = S(f.t1 + 0.2, f.t1 + 0.6, P.t);
      h.espada.visible = larga < 0.5;
      h.j.cabeca.rotation.x = 0.35;
      const cab = c.cabecaDe(h, 0.05);
      cam(camera, [cab.x + 0.85, cab.y + 0.05, cab.z - 0.3], v3(cab), 32);
    },
  },
  {
    id: '6.2a', cap: 6, cenario: 'pedralva', falas: ['6.2.01'], antes: 4.2, depois: 0.4, musica: 'calma', ...manha,
    sons: () => [{ t: 0, som: 'passosDescalco', dur: 3 }],
    atualizar(c, P, { camera }) {
      amanhecer(c, P);
      sentadoNaPonte(c, c.heroi, P);
      c.heroi.espada.visible = false;
      const b = c.brana;
      b.raiz.visible = true;
      c.barrilPonte.visible = true;
      c.barrilPonte.position.set(POS_B[0], 0.48, POS_B[1]);
      if (P.t < 3.0) {
        caminhar(b, [-0.2, -8.5], [POS_B[0] + 0.1, POS_B[1] - 0.6], S(0, 3.0, P.t), { amplitude: 0.5 });
        b.raiz.position.y = Math.abs(b.raiz.position.z) < 5.2 ? 0.48 : 0;
        aplicar(b, POSES.bengala, 0.7);
      } else {
        branaSentada(c, P);
        b.raiz.position.y -= 0.36 * (1 - S(3.0, 3.8, P.t));
      }
      cam(camera, [2.9, 1.5, -3.6], [-0.4, 0.9, -1.6], 44);
    },
  },
  {
    id: '6.2b', cap: 6, cenario: 'pedralva', falas: ['6.2.02'], antes: 0.3, depois: 0.5, musica: 'calma', ...manha,
    atualizar(c, P, { camera }) {
      amanhecer(c, P);
      sentadoNaPonte(c, c.heroi, P);
      c.heroi.espada.visible = false;
      branaSentada(c, P);
      c.heroi.j.cabeca.rotation.y = 0.8 * S(0, 2.2, P.t);
      const cab = c.cabecaDe(c.heroi, 0.04);
      cam(camera, [cab.x + 0.85, cab.y + 0.02, cab.z - 0.25], v3(cab), 30);
    },
  },
  {
    id: '6.2c', cap: 6, cenario: 'pedralva', falas: ['6.2.03'], antes: 0.3, depois: 0.6, musica: 'calma', ...manha,
    atualizar(c, P, { camera }) {
      amanhecer(c, P);
      sentadoNaPonte(c, c.heroi, P);
      c.heroi.espada.visible = false;
      branaSentada(c, P);
      const b = c.brana;
      b.objetoD.visible = false;
      aplicar(b, { ombroE: [-1.0, 0, -0.2], cotoveloE: [-0.7, 0, 0], ombroD: [-1.0, 0, 0.2], cotoveloD: [-0.7, 0, 0], pulsoE: [0, 0, 0.8], pulsoD: [0, 0, -0.8] }, S(0, 0.8, P.t));
      const m = c.mundo(b.maoE, [0, -0.04, 0]);
      cam(camera, [m.x + 0.55, m.y + 0.35, m.z - 0.15], [m.x, m.y, m.z - 0.12], 34);
    },
  },
  dialogoPonte('6.2d', ['6.2.04'], 'brana'),
  {
    id: '6.2e', cap: 6, cenario: 'pedralva', falas: ['6.2.05'], antes: 0.6, depois: 1.0, musica: 'calma', ...manha,
    atualizar(c, P, { camera }) {
      amanhecer(c, P);
      sentadoNaPonte(c, c.heroi, P);
      c.heroi.espada.visible = false;
      branaSentada(c, P);
      cam(camera, L([4.2, 1.2, -1.2], [3.8, 1.25, -1.4], S(0, 1, P.k)), [-0.4, 0.95, -1.5], 42);
    },
  },
  dialogoPonte('6.2f', ['6.2.06', '6.2.07'], 'brana'),
  dialogoPonte('6.2g', ['6.2.08', '6.2.09'], 'heroi'),
  {
    id: '6.2h', cap: 6, cenario: 'pedralva', falas: ['6.2.10'], antes: 1.0, depois: 1.4, musica: 'calma', ...manha,
    atualizar(c, P, { camera }) {
      amanhecer(c, P);
      const h = c.heroi;
      sentadoNaPonte(c, h, P);
      h.espada.visible = false;
      branaSentada(c, P);
      const b = c.brana;
      b.objetoD.visible = false;
      // ela segura a mão dele com as mãos queimadas
      aplicar(h, MAO_ABERTA);
      b.raiz.rotation.y = Math.PI / 2 - 0.75;
      b.j.cabeca.rotation.y = 0;
      aplicar(b, { ombroE: [-1.05, 0, 0.05], cotoveloE: [-0.35, 0, 0], ombroD: [-1.05, 0, -0.05], cotoveloD: [-0.35, 0, 0], tronco: [0.3, 0, 0] }, S(0, 0.9, P.t));
      h.j.cabeca.rotation.y = 0.5;
      const m = c.mundo(h.maoE, [0, -0.05, 0]);
      cam(camera, [m.x + 0.75, m.y + 0.35, m.z - 0.05], [m.x - 0.05, m.y, m.z - 0.25], 36);
    },
  },
  {
    id: '6.3a', cap: 6, cenario: 'pedralva', falas: ['6.3.01'], antes: 2.4, depois: 0.8, ...manha, // a música para: só a gota
    sons: () => [{ t: 1.6, som: 'blip' }],
    atualizar(c, P, { camera }) {
      amanhecer(c, P);
      const h = c.heroi;
      sentadoNaPonte(c, h, P);
      h.espada.visible = false;
      aplicar(h, MAO_ABERTA);
      corteNaMao(c, h, S(0.2, 1.0, P.t), S(0.8, 1.6, P.t));
      // uma gota cai na madeira
      const m = c.mundo(h.maoE, [0, -0.06, 0.02]);
      const q = Math.min(1, Math.max(0, (P.t - 1.2) / 0.4));
      c.gota.visible = P.t > 1.2 && P.t < 1.75;
      c.gota.position.set(m.x, lerp(m.y - 0.05, 0.5, q * q), m.z);
      cam(camera, [m.x + 0.35, m.y + 0.05, m.z - 0.2], [m.x, m.y - 0.1, m.z], 34);
    },
  },
  {
    id: '6.3b', cap: 6, cenario: 'pedralva', falas: ['6.3.02', '6.3.03'], antes: 1.6, depois: 1.2, musica: 'aurora', ...manha,
    atualizar(c, P, { camera }) {
      amanhecer(c, P);
      const h = c.heroi;
      sentadoNaPonte(c, h, P);
      h.espada.visible = false;
      branaSentada(c, P);
      c.brana.objetoD.visible = false;
      aplicar(h, MAO_ABERTA, 1 - S(P.dur - 1.5, P.dur, P.t));
      c.brana.raiz.rotation.y = Math.PI / 2 - 0.75;
      aplicar(c.brana, { ombroE: [-1.05, 0, 0.05], cotoveloE: [-0.35, 0, 0], ombroD: [-1.05, 0, -0.05], cotoveloD: [-0.35, 0, 0], tronco: [0.3, 0, 0] }, 1 - S(1.6, 2.4, P.t));
      corteNaMao(c, h, 1, 1);
      if (P.t > 1.2) {
        c.atadura.visible = true;
        h.maoE.add(c.atadura);
        c.atadura.position.set(0, -0.05, 0);
        c.atadura.scale.setScalar(S(1.2, 1.8, P.t));
      }
      cam(camera, [2.2, 1.25, -2.5], [-0.4, 0.95, -1.5], 40);
    },
  },
  {
    id: '6.4a', cap: 6, cenario: 'pedralva', falas: ['6.4.01', '6.4.02', '6.4.03', '6.4.04'], antes: 4.0, depois: 0.8, musica: 'aurora', ...manha,
    atualizar(c, P, { camera }) {
      amanhecer(c, P);
      const r = c.rosto;
      sentadoNaPonte(c, r, P);
      r.espada.visible = false;
      c.atadura.visible = true;
      r.maoE.add(c.atadura);
      c.atadura.position.set(0, -0.05, 0);
      c.atadura.scale.setScalar(0.85);
      // as mãos sobem ao capacete, hesitam, e tiram
      const sobe = S(0.3, 1.3, P.t), tira = S(2.0, 3.4, P.t);
      aplicar(r, POSES.segurarCapacete, sobe * (1 - S(3.4, 4.2, P.t)));
      aplicar(r, { ombroE: [-0.9, 0, -0.35], cotoveloE: [-1.0, 0, 0], ombroD: [-0.9, 0, 0.35], cotoveloD: [-1.0, 0, 0] }, S(3.4, 4.2, P.t));
      const e = c.elmo;
      e.visible = true;
      const cab = c.cabecaDe(r, 0);
      const colo = c.mundo(r.j.quadril, [0, 0.12, 0.42]);
      if (tira <= 0) {
        r.j.cabeca.add(e);
        e.position.set(0, 0, 0);
        e.rotation.set(0, 0, 0);
      } else {
        c.cena.add(e);
        const alto = cab.clone().add({ x: 0.05, y: 0.32, z: 0 });
        const p = tira < 0.5 ? cab.clone().lerp(alto, tira * 2) : alto.clone().lerp(colo, S(3.0, 4.2, P.t));
        e.position.set(p.x, p.y - 0.1, p.z);
        e.rotation.set(0, Math.PI / 2, -0.4 * S(3.0, 4.2, P.t));
      }
      r.j.cabeca.rotation.x = -0.1 * S(4.0, 5.0, P.t);
      const k = S(4.0, P.dur, P.t);
      cam(camera, [cab.x + lerp(1.2, 1.0, k), cab.y + 0.04, cab.z + lerp(-0.2, -0.1, k)], [cab.x, cab.y - 0.02, cab.z], lerp(36, 30, k));
    },
  },
  {
    id: '6.4b', cap: 6, cenario: 'pedralva', falas: ['6.4.05'], antes: 2.8, depois: 0.6, musica: 'aurora', ...manha,
    sons: () => [{ t: 0, som: 'corrida', dur: 2 }],
    atualizar(c, P, { camera }) {
      amanhecer(c, P);
      const r = c.rosto;
      sentadoNaPonte(c, r, P);
      r.espada.visible = false;
      aplicar(r, { ombroE: [-0.9, 0, -0.35], cotoveloE: [-1.0, 0, 0], ombroD: [-0.9, 0, 0.35], cotoveloD: [-1.0, 0, 0] });
      c.elmo.visible = true;
      c.cena.add(c.elmo);
      const colo = c.mundo(r.j.quadril, [0, 0.12, 0.42]);
      c.elmo.position.set(colo.x, colo.y - 0.1, colo.z);
      c.elmo.rotation.set(0, Math.PI / 2, -0.4);
      const l = c.lia;
      l.raiz.visible = true;
      if (P.t < 2.2) {
        caminhar(l, [0.1, -7.5], [0.15, -1.05], S(0, 2.2, P.t), { correndo: true, amplitude: 0.8 });
        l.raiz.position.y = Math.abs(l.raiz.position.z) < 5.2 ? 0.48 : 0;
      } else {
        c.naPonte(l, -1.05, 0.15, -Math.PI / 2);
        parado(l, P.t);
        l.j.cabeca.rotation.z = 0.2 * Math.sin(P.t * 1.4);
        l.j.cabeca.rotation.x = 0.1;
      }
      const cab = c.cabecaDe(l, 0.04);
      cam(camera, [cab.x - 0.15, cab.y + 0.12, cab.z - 1.1], [cab.x - 0.25, cab.y - 0.15, cab.z], 40);
    },
  },
  {
    id: '6.4c', cap: 6, cenario: 'pedralva', falas: ['6.4.06', '6.4.07'], antes: 0.4, depois: 1.8, musica: 'aurora', ...manha,
    sons: (P) => [{ t: P.fala(0).t0 - 0.2, som: 'risada' }],
    atualizar(c, P, { camera }) {
      amanhecer(c, P);
      const r = c.rosto;
      sentadoNaPonte(c, r, P);
      r.espada.visible = false;
      aplicar(r, { ombroE: [-0.9, 0, -0.35], cotoveloE: [-1.0, 0, 0], ombroD: [-0.9, 0, 0.35], cotoveloD: [-1.0, 0, 0] });
      c.elmo.visible = true;
      c.cena.add(c.elmo);
      const colo = c.mundo(r.j.quadril, [0, 0.12, 0.42]);
      c.elmo.position.set(colo.x, colo.y - 0.1, colo.z);
      c.elmo.rotation.set(0, Math.PI / 2, -0.4);
      // a risada: cabeça para trás, ombros sacudindo, boca aberta
      const ri = S(0, 0.4, P.t) * (1 - S(P.dur - 1.6, P.dur - 0.4, P.t));
      r.j.cabeca.rotation.x = -0.35 * ri;
      r.j.tronco.rotation.x += Math.sin(P.t * 18) * 0.03 * ri;
      r.falar(P.t, ri > 0.3);
      c.lia.raiz.visible = true;
      c.naPonte(c.lia, -1.05, 0.15, -Math.PI / 2);
      parado(c.lia, P.t);
      const cab = c.cabecaDe(r, 0);
      cam(camera, [cab.x + 0.75, cab.y - 0.05, cab.z + 0.15], v3(cab), 32);
    },
  },
  {
    id: '6.5a', cap: 6, cenario: 'pedralva', falas: ['6.5.01', '6.5.02', '6.5.03'], antes: 1.4, depois: 0.4, fadeIn: 1.0, musica: 'calma', ...manha,
    atualizar(c, P, { camera }) {
      c.estado.clima = 'manhaClara';
      c.mostrar('lia');
      // o capacete pendurado num prego, na porta da casa de Brana
      const e = c.elmo;
      e.visible = true;
      c.cena.add(e);
      e.position.set(5.5, 1.38, -12.9);
      e.rotation.set(0.12, -Math.PI / 2, 0);
      c.prego.visible = true;
      c.prego.position.set(5.52, 1.75, -12.9);
      const l = c.lia;
      c.pos(l, 4.75, -12.75, Math.PI / 2);
      parado(l, P.t);
      aplicar(l, { ombroD: [-2.0, 0.2, 0.2], cotoveloD: [-0.4, 0, 0] }, S(1.0, 2.2, P.t));
      l.j.ombroD.rotation.y += Math.sin(P.t * 0.8) * 0.15 * S(2.2, 3, P.t);
      const k = S(0, 1, P.k);
      cam(camera, [lerp(4.3, 4.6, k), 1.55, lerp(-13.9, -13.6, k)], [5.5, 1.4, -12.9], lerp(36, 30, k));
    },
  },
  {
    id: '6.5b', cap: 6, cenario: 'pedralva', falas: ['6.5.04', '6.5.05'], antes: 0.6, depois: 1.6, musica: 'calma', ...manha,
    atualizar(c, P, { camera }) {
      c.estado.clima = 'manhaClara';
      c.mostrar('lia', 'aldeoes');
      const e = c.elmo;
      e.visible = true;
      c.cena.add(e);
      e.position.set(5.5, 1.38, -12.9);
      e.rotation.set(0.12, -Math.PI / 2, 0);
      c.prego.visible = true;
      c.prego.position.set(5.52, 1.75, -12.9);
      c.pos(c.lia, 4.75, -12.75, Math.PI / 2);
      parado(c.lia, P.t);
      cam(camera, L([1.2, 1.7, -10.2], [0.6, 1.9, -9.6], S(0, 1, P.k)), [5.4, 1.3, -12.9], 46);
    },
  },
  {
    id: '6.6a', cap: 6, cenario: 'pedralva', falas: ['6.6.01', '6.6.02'], antes: 1.2, depois: 0.6, fadeIn: 0.8, musica: 'aurora', ...manha,
    atualizar(c, P, { camera }) {
      c.estado.clima = 'nascente';
      c.mostrar();
      const d = c.final;
      d.raiz.visible = true;
      caminhar(d, [0.1, -6.5], [0.1, 6.5], S(0, P.dur + 2, P.t), { peso: 0.3, amplitude: 0.9 });
      d.raiz.position.y = Math.abs(d.raiz.position.z) < 5.2 ? 0.48 : 0;
      const z = d.raiz.position.z;
      cam(camera, [0.9, 1.1, z - 3.4], [0, 1.4, z + 8], 46);
    },
  },
  {
    id: '6.6b', cap: 6, cenario: 'pedralva', falas: ['6.6.03'], antes: 0.4, depois: 3.6, fadeOut: 3.0, musica: 'aurora', ...manha,
    atualizar(c, P, { camera }) {
      c.estado.clima = 'nascente';
      c.mostrar();
      const d = c.final;
      d.raiz.visible = true;
      caminhar(d, [0.4, 9], [0.8, 16], S(0, P.dur + 1, P.t), { peso: 0.3, amplitude: 0.9 });
      const cab = c.cabecaDe(d, 0);
      cam(camera, [cab.x + 0.3, cab.y - 0.1, cab.z + 2.2], [cab.x, cab.y - 0.1, cab.z], 36);
    },
  },
  { id: 'fim', cap: 6, tela: { tipo: 'fim' }, min: 5, antes: 0, musica: 'aurora' },
];

// conversa na ponte: câmera por cima do ombro de quem ouve
function dialogoPonte(id, falas, alvo) {
  return {
    id, cap: 6, cenario: 'pedralva', falas, antes: 0.4, depois: 0.6, musica: 'calma', ...manha,
    atualizar(c, P, { camera }) {
      amanhecer(c, P);
      sentadoNaPonte(c, c.heroi, P);
      c.heroi.espada.visible = false;
      branaSentada(c, P);
      c.heroi.j.cabeca.rotation.y = 0.7;
      c.brana.j.cabeca.rotation.y = alvo === 'brana' ? -0.65 : -0.15;
      const ch = c.cabecaDe(c.heroi, 0.04), cb = c.cabecaDe(c.brana, 0.04);
      if (alvo === 'brana') cam(camera, [cb.x + 0.95, cb.y + 0.05, cb.z + 0.45], [cb.x, cb.y - 0.03, cb.z], 34);
      else cam(camera, [ch.x + 0.95, ch.y + 0.02, ch.z - 0.4], [ch.x, ch.y - 0.04, ch.z], 34);
    },
  };
}
