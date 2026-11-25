// Capítulo II: Pedralva.
import { lerp } from '../../motor/ps1.js';
import * as T from '../../motor/texturas.js';
import { POSES, aplicar, parado, caminhar, andar } from '../../motor/personagem.js';
import { cavaloAndar } from '../../motor/animais.js';
import { LUGAR } from '../../cenarios/pedralva.js';
import { S, cam, L, balanco, somar, v3 } from './util.js';

const aldeia = { ambiente: ['passaros', 'vento'] };

// a carroça de Tomé chegando (z do centro da carroça; ponte em |z| < 5)
function carroChegando(c, z, vel, t) {
  const g = c.carroca.grupo;
  g.visible = true;
  g.position.set(0, Math.abs(z) < 5.2 ? 0.48 : Math.abs(z) < 6.4 ? 0.24 : 0, z);
  g.rotation.set(0, Math.PI, 0);
  c.carroca.girar(-z);
  cavaloAndar(c.cavalo, (-z / 1.6) * Math.PI * 2, vel, t);
  for (const [p, x] of [[c.tome, 0.36], [c.dalia, -0.36]]) {
    g.add(p.raiz);
    p.raiz.position.set(x, 0.66, 1.0);
    p.raiz.rotation.set(0, 0, 0);
    parado(p, t);
    aplicar(p, POSES.sentado);
  }
  aplicar(c.tome, POSES.redeas);
}

// aldeões param e olham para um ponto
function olharTodos(c, x, z, k, lista = null) {
  c.aldeoes.forEach((a, i) => {
    if (lista && !lista.includes(i)) return;
    const r = a.raiz;
    const alvo = Math.atan2(x - r.position.x, z - r.position.z);
    r.rotation.y = lerp(c.postos[i][2], alvo, k);
  });
}

function carregarPedra(c, k, t, de = LUGAR.pilhaPedras, para = [LUGAR.muroNovo[0] - 0.3, LUGAR.muroNovo[1] - 0.9]) {
  const h = c.heroi;
  h.espada.visible = false;
  caminhar(h, de, para, k, { peso: 0.9, amplitude: 0.8 });
  aplicar(h, POSES.carregar);
  c.pedraCarga.visible = true;
  h.j.tronco.add(c.pedraCarga);
  c.pedraCarga.position.set(0, 0.2, 0.42);
}

export const planos2 = [
  { id: 'c2', cap: 2, tela: { tipo: 'capitulo', n: 2, nome: 'Pedralva' }, min: 4.5, antes: 0, ambiente: ['passaros'] },
  {
    id: '2.1a', cap: 2, cenario: 'pedralva', falas: ['2.1.01'], antes: 1.0, depois: 0.8, fadeIn: 2, musica: 'calma', ...aldeia,
    sons: (P) => [{ t: 0, som: 'carroca', dur: P.dur }],
    atualizar(c, P, { camera }) {
      c.estado.clima = 'manhaNublada';
      c.mostrar('heroi', 'tome', 'dalia', 'aldeoes');
      const z = lerp(26, 10, P.k);
      carroChegando(c, z, 1, P.t);
      caminhar(c.heroi, [0.2, z + 3.2], [0.2, z + 3.1], 0);
      c.pos(c.heroi, 0.2, z + 3.4, Math.PI);
      andar(c.heroi, ((26 - z) / 1.44) * Math.PI * 2, { peso: 0.7, bracoD: 0.3 });
      cam(camera, somar(L([10, 3.6, 17], [8, 3.0, 13.5], S(0, 1, P.k)), balanco(P.t, 0.03)), [-1, 1.2, -9], 50);
    },
  },
  {
    id: '2.1b', cap: 2, cenario: 'pedralva', falas: ['2.1.02'], antes: 0.6, depois: 1.2, musica: 'calma', ...aldeia,
    atualizar(c, P, { camera }) {
      c.estado.clima = 'manhaNublada';
      c.mostrar('aldeoes');
      olharTodos(c, 0, 0, S(0.4, 1.8, P.t));
      cam(camera, [-4.5, 1.65, -19.5], [0.5, 1.3, -11], 46);
    },
  },
  {
    id: '2.1c', cap: 2, cenario: 'pedralva', falas: ['2.1.03'], antes: 0.4, depois: 1.0, musica: 'calma', ...aldeia,
    sons: (P) => [{ t: 0, som: 'arrastoEspada', dur: P.dur }],
    atualizar(c, P, { camera }) {
      c.estado.clima = 'manhaNublada';
      c.mostrar('heroi', 'aldeoes');
      caminhar(c.heroi, [0.3, -5.6], [0.3, -11.5], P.k, { peso: 0.7, bracoD: 0.3 });
      const hz = c.heroi.raiz.position.z;
      olharTodos(c, 0.3, hz, 1);
      cam(camera, [-2.4, 1.45, -13.4], [0.3, 1.5, hz], 44);
    },
  },
  {
    id: '2.2a', cap: 2, cenario: 'pedralva', falas: ['2.2.01'], antes: 0.5, depois: 0.8, musica: 'calma', ...aldeia,
    atualizar(c, P, { camera }) {
      c.mostrar('heroi', 'dalia', 'aldeoes');
      const { heroi: h, dalia: d } = c;
      c.pos(d, -5.0, -10.4);
      c.pos(h, -3.4, -10.0);
      c.virarPara(d, -3.4, -10.0);
      c.virarPara(h, -5.0, -10.4);
      parado(h, P.t);
      aplicar(d, POSES.oferecer, S(0.3, 0.9, P.t));
      d.j.ombroD.rotation.y += 0.6; // aponta a casa
      const f = P.fala(0);
      const nao = P.t > f.t0 + f.dur * 0.55 ? Math.sin((P.t - f.t0) * 9) * 0.35 * (1 - S(f.t1, f.t1 + 0.6, P.t)) : 0;
      h.j.cabeca.rotation.y = nao;
      cam(camera, [-4.2, 1.55, -7.6], [-4.2, 1.45, -10.2], 44);
    },
  },
  {
    id: '2.2b', cap: 2, cenario: 'pedralva', falas: ['2.2.02'], antes: 0.4, depois: 0.9, musica: 'calma', ...aldeia,
    atualizar(c, P, { camera }) {
      c.mostrar('heroi', 'aldeoes');
      const h = c.heroi, a = c.aldeoes[1];
      c.pos(a, -3.1, -12.8);
      c.virarPara(a, -2.1, -11.3);
      parado(a, P.t);
      const pega = 1.6, sai = 2.4;
      aplicar(a, POSES.oferecer, S(0.2, 0.8, P.t) * (1 - S(pega, pega + 0.4, P.t)));
      if (P.t < sai) {
        c.pos(h, -2.1, -11.3);
        c.virarPara(h, -3.1, -12.8);
        parado(h, P.t);
        aplicar(h, { ombroE: [-1.0, 0, -0.1], cotoveloE: [-0.4, 0, 0] }, S(pega - 0.4, pega, P.t) * (1 - S(pega + 0.2, pega + 0.6, P.t)));
      } else {
        caminhar(h, [-2.1, -11.3], [1.5, -8.2], S(sai, P.dur + 1, P.t), { peso: 0.7 });
      }
      c.pao.visible = true;
      if (P.t < pega) {
        a.maoD.add(c.pao);
        c.pao.position.set(0, -0.04, 0.04);
      } else {
        h.maoE.add(c.pao);
        c.pao.position.set(0, -0.04, 0.04);
      }
      cam(camera, [0.2, 1.65, -13.6], [-2.6, 1.3, -12.0], 44);
    },
  },
  {
    id: '2.2c', cap: 2, cenario: 'pedralva', falas: ['2.2.03'], antes: 0.4, depois: 0.8, musica: 'calma', ...aldeia,
    sons: (P) => [{ t: 0, som: 'passosDescalco', dur: P.dur }],
    atualizar(c, P, { camera }) {
      c.mostrar('heroi', 'aldeoes');
      carregarPedra(c, S(0, P.dur, P.t), P.t);
      cam(camera, [1.2, 1.6, -2.6], [5, 0.9, -7.2], 46);
    },
  },
  {
    id: '2.2d', cap: 2, cenario: 'pedralva', falas: ['2.2.04'], antes: 0.5, depois: 1.4, musica: 'noite', ambiente: ['grilos', 'vento'],
    atualizar(c, P, { camera }) {
      c.estado.clima = 'noite';
      c.mostrar('heroi');
      const h = c.heroi;
      c.pos(h, -13.1, -6.5, Math.PI / 2);
      parado(h, P.t * 0.5);
      aplicar(h, POSES.sentadoChao);
      aplicar(h, { ombroD: [-0.5, 0, 0.3], cotoveloD: [-0.9, 0, 0], cabeca: [0.25, 0, 0] });
      h.espada.rotation.x = 1.7;
      c.vela.visible = true;
      c.pos(c.vela, -12.4, -5.6);
      const pv = c.mundo(c.vela, [0, 0.22, 0]);
      c.estado.luzes = [{ pos: v3(pv), cor: 0xffa848, intensidade: 1.1, alcance: 3.6, tremula: 4 }];
      cam(camera, L([-5.6, 1.35, -5.4], [-6.8, 1.25, -5.8], S(0, 1, P.k)), [-12.6, 0.7, -6.4], 44);
    },
  },
  {
    id: '2.3a', cap: 2, cenario: 'pedralva', falas: ['2.3.01', '2.3.02'], antes: 0.5, depois: 0.8, musica: 'calma', ...aldeia,
    atualizar(c, P, { camera }) {
      c.mostrar('heroi', 'lia', 'aldeoes');
      carregarPedra(c, (P.t / 6) % 1, P.t);
      const l = c.lia;
      c.pos(l, 5.0, -10.9);
      c.virarPara(l, 3.8, -7.2);
      parado(l, P.t);
      const espia = 0.5 + 0.5 * Math.sin(P.t * 0.9);
      l.raiz.position.x = 5.0 - 0.18 * espia;
      l.j.tronco.rotation.z = 0.35 * espia;
      l.j.cabeca.rotation.z = -0.15 * espia;
      cam(camera, [6.6, 0.95, -12.8], [3.8, 0.9, -8.0], 44);
    },
  },
  {
    id: '2.3b', cap: 2, cenario: 'pedralva', falas: ['2.3.03'], antes: 0.6, depois: 0.6, musica: 'calma', ...aldeia,
    atualizar(c, P, { camera }) {
      c.mostrar('heroi', 'lia', 'aldeoes');
      const k = S(0, P.dur + 2, P.t);
      carregarPedra(c, k, P.t);
      const h = c.heroi.raiz.position;
      caminhar(c.lia, [LUGAR.pilhaPedras[0] - 0.8, LUGAR.pilhaPedras[1] - 0.3], [LUGAR.muroNovo[0] - 1.0, LUGAR.muroNovo[1] - 1.5], k, { amplitude: 0.9, peso: 0 });
      c.lia.j.cabeca.rotation.x = -0.45;
      c.lia.j.cabeca.rotation.y = 0.5;
      cam(camera, [h.x - 0.8, 1.15, h.z - 2.6], [h.x - 0.2, 1.1, h.z], 46);
    },
  },
  {
    id: '2.3c', cap: 2, cenario: 'pedralva', falas: ['2.3.04'], antes: 0.3, depois: 0.5, musica: 'calma', ...aldeia,
    atualizar(c, P, { camera }) {
      c.mostrar('heroi', 'lia', 'aldeoes');
      const k = S(-1, P.dur + 4, P.t + 2);
      carregarPedra(c, k * 0.9, P.t);
      const h = c.heroi.raiz.position;
      const ang = P.t * 1.3;
      c.pos(c.lia, h.x + Math.cos(ang) * 0.9, h.z + Math.sin(ang) * 0.9);
      c.virarPara(c.lia, h.x, h.z);
      andar(c.lia, P.t * 9, { amplitude: 0.7, peso: 0 });
      c.lia.j.cabeca.rotation.x = -0.4;
      const cab = c.cabecaDe(c.lia, 0.05);
      cam(camera, [cab.x + Math.cos(ang + 0.6) * 0.8, cab.y + 0.05, cab.z + Math.sin(ang + 0.6) * 0.8], v3(cab), 40);
    },
  },
  {
    id: '2.3d', cap: 2, cenario: 'pedralva', falas: ['2.3.05'], antes: 0.3, depois: 2.2, musica: 'calma', ...aldeia,
    atualizar(c, P, { camera }) {
      c.mostrar('heroi', 'lia', 'aldeoes');
      const h = c.heroi;
      const f = P.fala(0);
      const para = S(f.t1, f.t1 + 0.3, P.t) * (1 - S(f.t1 + 1.3, f.t1 + 1.6, P.t));
      const k = 0.72 + 0.12 * S(0, P.dur, P.t) * (1 - para * 0.6);
      carregarPedra(c, k, P.t);
      if (para > 0.5) { parado(h, P.t); aplicar(h, POSES.carregar); }
      const hp = h.raiz.position;
      c.pos(c.lia, hp.x + 0.6, hp.z - 0.7);
      c.virarPara(c.lia, hp.x, hp.z);
      c.lia.j.cabeca.rotation.x = -0.45;
      h.j.cabeca.rotation.set(0.35 * para, -0.6 * para, 0);
      const cab = c.cabecaDe(h, 0.05);
      cam(camera, [cab.x + 0.9, cab.y - 0.65, cab.z - 1.1], v3(cab), 40);
    },
  },
  {
    id: '2.4a', cap: 2, cenario: 'pedralva', falas: ['2.4.01'], antes: 2.0, depois: 0.5, fadeIn: 1, musica: 'calma', ...aldeia,
    sons: (P) => Array.from({ length: Math.floor(P.dur / 1.2) }, (_, i) => ({ t: 0.55 + i * 1.2, som: 'pancada' })),
    atualizar(c, P, { camera }) {
      c.estado.clima = 'entardecer';
      c.mostrar('heroi', 'lia');
      liaNaMureta(c, P.t);
      const h = c.heroi;
      c.pos(h, -5.0, -5.05, 0);
      parado(h, P.t);
      h.espada.visible = false;
      const fase = (P.t % 1.2) / 1.2;
      aplicar(h, POSES.martelarAlto, Math.min(1, fase * 2.2) * (fase < 0.45 ? 1 : 0));
      aplicar(h, POSES.martelarBaixo, fase >= 0.45 ? 1 - S(0.55, 1, fase) : 0);
      h.maoD.add(c.pedraCarga);
      c.pedraCarga.visible = true;
      c.pedraCarga.position.set(0, -0.05, 0.08);
      cam(camera, [-1.6, 1.25, -8.2], [-5.0, 1.0, -5.4], 46);
    },
  },
  dialogoCerca('2.4b', ['2.4.02'], 'heroi'),
  dialogoCerca('2.4c', ['2.4.03'], 'lia'),
  {
    id: '2.4d', cap: 2, cenario: 'pedralva', falas: ['2.4.04'], antes: 0.4, depois: 1.2, musica: 'calma', ...aldeia,
    atualizar(c, P, { camera }) {
      c.estado.clima = 'entardecer';
      c.mostrar('heroi', 'lia');
      liaNaMureta(c, P.t);
      const h = c.heroi;
      c.pos(h, -5.0, -5.05, Math.PI);
      parado(h, P.t);
      const cab = c.cabecaDe(h, 0);
      cam(camera, [cab.x + 0.7, 0.95, cab.z + 1.9], [cab.x, cab.y - 0.1, cab.z], 42);
    },
  },
  {
    id: '2.4e', cap: 2, cenario: 'pedralva', falas: ['2.4.05'], antes: 0.6, depois: 0.8, musica: 'calma', ...aldeia,
    atualizar(c, P, { camera }) {
      c.estado.clima = 'entardecer';
      c.mostrar('heroi', 'lia');
      liaNaMureta(c, P.t, 0.15);
      c.lia.j.cabeca.rotation.z = 0.25 * S(0.5, 1.5, P.t);
      c.lia.j.cabeca.rotation.x = -0.2;
      c.pos(c.heroi, -5.0, -5.05, Math.PI);
      parado(c.heroi, P.t);
      cam(camera, L([-0.6, 1.5, -10.4], [-1.2, 1.4, -9.6], S(0, 1, P.k)), [-5.1, 1.0, -5.6], 46);
    },
  },
  dialogoCerca('2.4f', ['2.4.06'], 'lia'),
  dialogoCerca('2.4g', ['2.4.07'], 'heroi', 1.6),
  {
    id: '2.5a', cap: 2, cenario: 'pedralva', falas: ['2.5.01'], antes: 0.6, depois: 0.6, musica: 'tensao', ambiente: ['vento'],
    atualizar(c, P, { camera }) {
      c.estado.clima = 'anoitecer';
      c.mostrar('heroi', 'brana', 'aldeoes');
      const b = c.brana;
      c.pos(b, 5.2, -12.9);
      c.virarPara(b, -3, -8);
      parado(b, P.t);
      aplicar(b, POSES.bengala);
      c.pos(c.heroi, -3.2, -8.0, Math.PI * 0.75);
      parado(c.heroi, P.t);
      cam(camera, L([2.0, 1.55, -10.6], [2.4, 1.6, -11.2], S(0, 1, P.k)), [5.2, 1.4, -12.9], 40);
    },
  },
  {
    id: '2.5b', cap: 2, cenario: 'pedralva', falas: ['2.5.02'], antes: 0.3, depois: 0.4, musica: 'tensao', ambiente: ['vento'],
    atualizar(c, P, { camera }) {
      c.estado.clima = 'anoitecer';
      c.mostrar('heroi', 'brana');
      const b = c.brana;
      c.pos(b, 5.2, -12.9);
      c.virarPara(b, -3, -8);
      parado(b, P.t);
      aplicar(b, POSES.bengala);
      const f = P.fala(0);
      const corte = f.t0 + f.dur * 0.55; // "Para a espada."
      if (P.t < corte) {
        // as mãos queimadas apertando a bengala
        const m = c.mundo(b.maoD, [0, -0.02, 0]);
        cam(camera, [m.x - 0.45, m.y + 0.12, m.z + 0.35], v3(m), 30);
        b.j.cotoveloD.rotation.x += Math.sin(P.t * 1.5) * 0.04;
      } else {
        // a espada enferrujada, ao lado do homem
        const h = c.heroi;
        c.pos(h, -3.2, -8.0, Math.PI * 0.75);
        parado(h, P.t);
        const e = c.mundo(h.espada, [0, 0.5, 0]);
        cam(camera, [e.x + 0.6, e.y + 0.25, e.z - 0.7], v3(e), 34);
      }
    },
  },
  {
    id: '2.5c', cap: 2, cenario: 'pedralva', min: 3.6, antes: 0, musica: 'tensao', ambiente: ['vento'],
    sons: () => [{ t: 2.6, som: 'pancada' }],
    atualizar(c, P, { camera }) {
      c.estado.clima = 'anoitecer';
      c.mostrar('brana', 'aldeoes');
      const b = c.brana;
      if (P.t < 1.0) {
        c.pos(b, 5.2, -12.9);
        c.virarPara(b, -3, -8);
        parado(b, P.t);
      } else caminhar(b, [5.2, -12.9], [6.3, -12.9], S(1.0, 2.6, P.t), { amplitude: 0.5 });
      aplicar(b, POSES.bengala);
      b.raiz.visible = P.t < 2.6;
      cam(camera, [1.6, 1.6, -11.2], [5.6, 1.3, -12.9], 42);
    },
  },
  {
    id: '2.6a', cap: 2, cenario: 'pedralva', falas: ['2.6.01'], antes: 0.8, depois: 0.6, fadeIn: 1.2, musica: 'noite', ambiente: ['grilos', 'vento'],
    atualizar(c, P, { camera }) {
      noiteCeleiro(c);
      c.mostrar('lia', 'heroi');
      caminhar(c.lia, [-5.6, -10.4], [-8.25, -6.45], S(0, P.dur - 0.5, P.t), { amplitude: 0.8, peso: 0.5 });
      aplicar(c.lia, { tronco: [0.3, 0, 0] });
      cam(camera, [-3.2, 2.3, -2.4], [-8.4, 0.8, -7.0], 46);
    },
  },
  {
    id: '2.6b', cap: 2, cenario: 'pedralva', falas: ['2.6.02'], antes: 0.6, depois: 0.6, musica: 'noite', ambiente: ['grilos'],
    sons: (P) => {
      const f = P.fala(0);
      return [0.62, 0.77, 0.9].map((x) => ({ t: f.t0 + f.dur * x, som: 'arrastoEspada', dur: 0.5 }));
    },
    atualizar(c, P, { camera }) {
      noiteCeleiro(c);
      c.mostrar('heroi');
      const h = c.heroi;
      heroiRiscando(c, P);
      const cab = c.cabecaDe(h, 0);
      cam(camera, [cab.x + 0.9, cab.y + 0.25, cab.z + 1.1], [cab.x, cab.y - 0.1, cab.z], 42);
      h.espada.visible = false;
    },
  },
  {
    id: '2.6c', cap: 2, cenario: 'pedralva', falas: ['2.6.03'], antes: 0.3, depois: 0.3, musica: 'noite', ambiente: ['grilos'],
    atualizar(c, P, { camera }) {
      noiteCeleiro(c);
      c.mostrar('lia');
      const l = c.lia;
      c.pos(l, -8.25, -6.45, -Math.PI / 2);
      parado(l, P.t);
      l.falar(P.t * 0.8, true); // contando baixinho
      l.j.cabeca.rotation.y = 0.3;
      c.estado.luzes.push({ pos: [-8.5, 0.95, -6.55], cor: 0xffb060, intensidade: 1.0, alcance: 1.1, tremula: 2 });
      const cab = c.cabecaDe(l, 0.04);
      cam(camera, [cab.x + 0.55, cab.y + 0.02, cab.z + 0.3], v3(cab), 34);
    },
  },
  {
    id: '2.6d', cap: 2, cenario: 'pedralva', falas: ['2.6.04'], antes: 0.4, depois: 3.0, fadeOut: 2.4, musica: 'noite', ambiente: ['grilos'],
    atualizar(c, P, { camera }) {
      noiteCeleiro(c);
      c.mostrar('heroi');
      const h = c.heroi;
      heroiRiscando(c, P, true);
      h.mElmo.uniforms.uMapa.value = T.capacete(299);
      const cab = c.cabecaDe(h, 0.05);
      const k = S(0, 1, P.k);
      cam(camera, [cab.x + lerp(0.55, 0.42, k), cab.y + 0.12, cab.z - lerp(0.35, 0.25, k)], [cab.x, cab.y + 0.02, cab.z], 30);
      h.espada.visible = false;
    },
  },
];

function liaNaMureta(c, t, balanco = 1) {
  const l = c.lia;
  c.lia.raiz.visible = true;
  l.raiz.position.set(LUGAR.mureta[0], 0.3, LUGAR.mureta[1]);
  l.raiz.rotation.set(0, 0.15, 0);
  parado(l, t);
  aplicar(l, POSES.sentado);
  l.j.joelhoE.rotation.x += Math.sin(t * 3) * 0.3 * balanco;
  l.j.joelhoD.rotation.x += Math.sin(t * 3 + 2) * 0.3 * balanco;
  l.j.cabeca.rotation.x = -0.25;
}

// diálogo na cerca, ao pôr do sol: câmera por cima do ombro de quem ouve
function dialogoCerca(id, falas, quemFala, antes = 0.3) {
  return {
    id, cap: 2, cenario: 'pedralva', falas, antes, depois: 0.6, musica: 'calma', ...aldeia,
    atualizar(c, P, { camera }) {
      c.estado.clima = 'entardecer';
      c.mostrar('heroi', 'lia');
      liaNaMureta(c, P.t, 0.4);
      const h = c.heroi;
      c.pos(h, -5.0, -5.05, Math.PI);
      parado(h, P.t);
      h.j.cabeca.rotation.x = 0.25;
      const ch = c.cabecaDe(h, 0.02), cl = c.cabecaDe(c.lia, 0.04);
      if (quemFala === 'heroi') cam(camera, [cl.x + 0.35, cl.y + 0.05, cl.z - 0.35], [ch.x, ch.y - 0.05, ch.z], 38);
      else cam(camera, [ch.x - 0.35, ch.y + 0.05, ch.z + 0.3], [cl.x, cl.y - 0.03, cl.z], 36);
    },
  };
}

function noiteCeleiro(c) {
  c.estado.clima = 'noite';
  // portas quase fechadas: fica só uma fresta
  c.celeiro.userData.folhas.forEach((f, i) => (f.rotation.y = i ? 0.06 : -0.02));
  c.vela.visible = true;
  c.pos(c.vela, -12.2, -6.0);
  const pv = c.mundo(c.vela, [0, 0.22, 0]);
  c.estado.luzes = [{ pos: v3(pv), cor: 0xffa848, intensidade: 1.2, alcance: 3.8, tremula: 4 }];
}

// sentado no chão do celeiro, riscando o capacete com um prego: 296 -> 297 -> 298 -> 299
function heroiRiscando(c, P, parado299 = false) {
  const h = c.heroi;
  c.pos(h, -12.6, -6.5, Math.PI / 2);
  parado(h, P.t * 0.5);
  aplicar(h, POSES.sentadoChao);
  let n = 299;
  if (!parado299) {
    const f = P.fala(0);
    const marcas = [0.62, 0.77, 0.9].map((x) => f.t0 + f.dur * x);
    n = 296 + marcas.filter((m) => P.t > m + 0.25).length;
    const perto = marcas.some((m) => P.t > m - 0.35 && P.t < m + 0.3);
    aplicar(h, POSES.riscar);
    if (perto) h.j.cotoveloD.rotation.x += Math.sin(P.t * 30) * 0.12;
  } else aplicar(h, POSES.olharBaixo, 0.4);
  h.mElmo.uniforms.uMapa.value = T.capacete(n);
}
