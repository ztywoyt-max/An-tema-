// Capítulo IV: O Aviso.
import { lerp } from '../../motor/ps1.js';
import * as T from '../../motor/texturas.js';
import { POSES, aplicar, parado, caminhar, andar } from '../../motor/personagem.js';
import { S, cam, L, balanco, somar, v3 } from './util.js';

const vento = { ambiente: ['vento'] };
const FORMACAO = [[0, -9.6], [-1.4, -8.1], [1.4, -8.1], [-0.8, -6.4], [0.9, -6.5]];

// os cinco cavaleiros: entram pela ponte (k: 0..1) e param diante da praça
function cavaleirosEntrando(c, k, t, saindo = 0) {
  FORMACAO.forEach(([x, z], i) => {
    const zIni = z + 15;
    const zz = lerp(zIni, z, k);
    const vel = k < 1 ? 1 : saindo > 0 ? 1 : 0;
    const rot = saindo > 0 ? lerp(Math.PI, 0, Math.min(1, saindo * 3)) : Math.PI;
    const zSai = z + saindo * 14;
    c.cavaleiro(i, x, saindo > 0 ? zSai : zz, rot, t, vel, ((saindo > 0 ? zSai : zz) / 1.6) * Math.PI * 2);
  });
}

function praca(c, t, k = 1) {
  c.estado.clima = 'cinzaVento';
  c.estado.vento = 1.6;
  c.mostrar('tome', 'aldeoes', 'heroi');
  c.aldeoes.forEach((a, i) => {
    const r = a.raiz;
    r.rotation.y = lerp(c.postos[i][2], Math.atan2(0 - r.position.x, -9.6 - r.position.z), k);
  });
  c.pos(c.tome, -0.9, -12.3);
  c.virarPara(c.tome, 0, -9.6);
  parado(c.tome, t);
  c.pos(c.heroi, -8.3, -7.4);
  c.virarPara(c.heroi, 0, -9.6);
  parado(c.heroi, t);
}

function fogueiraNoite(c, t) {
  c.estado.clima = 'noite';
  c.fogueira.visible = true;
  const pf = c.mundo(c.fogoFogueira.grupo, [0, 0.2, 0]);
  c.estado.luzes = [{ pos: v3(pf), cor: 0xff8a40, intensidade: 1.6, alcance: 9, tremula: 7 }];
  c.mostrar('tome', 'aldeoes');
  // aldeões em roda, olhando o fogo
  // roda com um vão do lado da rua, por onde o herói chega
  const roda = [0, 2, 3, 5, 6, 7, 8, 9];
  c.aldeoes.forEach((a, i) => {
    const n = roda.indexOf(i);
    if (n < 0) { a.raiz.visible = false; return; }
    const ang = 3.2 + (n / roda.length) * Math.PI * 1.55;
    c.pos(a, -1 + Math.cos(ang) * 2.4, -14.5 + Math.sin(ang) * 2.4);
    c.virarPara(a, -1, -14.5);
    parado(a, t + i);
  });
  c.pos(c.tome, -1 + Math.cos(-0.9) * 2.2, -14.5 + Math.sin(-0.9) * 2.2);
  c.virarPara(c.tome, -1, -14.5);
  parado(c.tome, t);
}

function celeiroNoite(c) {
  c.estado.clima = 'noite';
  c.celeiro.userData.folhas.forEach((f, i) => (f.rotation.y = i ? 0.5 : -0.4));
  c.vela.visible = true;
  c.pos(c.vela, -12.0, -6.85);
  const pv = c.mundo(c.vela, [0, 0.22, 0]);
  c.estado.luzes = [{ pos: v3(pv), cor: 0xffa848, intensidade: 1.2, alcance: 3.8, tremula: 4 }];
}

function heroiSentado(c, t) {
  const h = c.heroi;
  h.raiz.visible = true;
  c.pos(h, -12.6, -6.4, Math.PI / 2);
  parado(h, t * 0.5);
  aplicar(h, POSES.sentadoChao);
  h.espada.rotation.x = Math.PI / 2;
}

function liaSentada(c, t) {
  const l = c.lia;
  l.raiz.visible = true;
  c.pos(l, -12.45, -7.3, Math.PI / 2 - 0.5);
  parado(l, t);
  aplicar(l, POSES.abracarJoelhos);
}

export const planos4 = [
  { id: 'c4', cap: 4, tela: { tipo: 'capitulo', n: 4, nome: 'O Aviso' }, min: 4.5, antes: 0, ambiente: ['vento'] },
  {
    id: '4.1a', cap: 4, cenario: 'pedralva', falas: ['4.1.01'], antes: 4.0, depois: 0.6, fadeIn: 1.2, musica: 'tensao', ...vento,
    sons: () => [{ t: 0, som: 'carroca', dur: 4 }],
    atualizar(c, P, { camera }) {
      praca(c, P.t, S(1, 3, P.t));
      cavaleirosEntrando(c, S(0, 3.8, P.t), P.t);
      cam(camera, somar([-3.4, 1.8, -17.2], balanco(P.t)), [0, 1.6, -7.5], 48);
    },
  },
  {
    id: '4.1b', cap: 4, cenario: 'pedralva', falas: ['4.1.02'], antes: 0.3, depois: 0.5, musica: 'tensao', ...vento,
    atualizar(c, P, { camera }) {
      praca(c, P.t);
      cavaleirosEntrando(c, 1, P.t);
      aplicar(c.tome, { ombroE: [-0.6, 0, -0.2], cotoveloE: [-0.8, 0, 0], ombroD: [-0.6, 0, 0.2], cotoveloD: [-0.8, 0, 0] }, S(0.2, 0.8, P.t));
      const cab = c.cabecaDe(c.tome, 0.06);
      cam(camera, [cab.x + 0.3, cab.y + 0.05, cab.z + 1.0], v3(cab), 36);
    },
  },
  {
    id: '4.1c', cap: 4, cenario: 'pedralva', falas: ['4.1.03'], antes: 0.3, depois: 0.4, musica: 'tensao', ...vento,
    atualizar(c, P, { camera }) {
      praca(c, P.t);
      cavaleirosEntrando(c, 1, P.t);
      const cab = c.cabecaDe(c.cavaleiros[0].soldado, 0.06);
      cam(camera, [cab.x - 0.9, cab.y - 0.9, cab.z - 1.4], v3(cab), 40);
    },
  },
  {
    id: '4.1d', cap: 4, cenario: 'pedralva', falas: ['4.1.04'], antes: 0.3, depois: 2.6, musica: 'tensao', ...vento,
    sons: (P) => [{ t: P.fala(0).t1, som: 'carroca', dur: 2.6 }],
    atualizar(c, P, { camera }) {
      praca(c, P.t);
      const f = P.fala(0);
      cavaleirosEntrando(c, 1, P.t, S(f.t1 - 0.3, P.dur + 1.5, P.t));
      cam(camera, [2.4, 1.7, -13.5], [0, 1.8, -8.5], 44);
    },
  },
  {
    id: '4.1e', cap: 4, cenario: 'pedralva', falas: ['4.1.05', '4.1.06'], antes: 0.4, depois: 1.0, musica: 'presenca', ...vento,
    atualizar(c, P, { camera }) {
      praca(c, P.t);
      const h = c.heroi;
      const f1 = P.fala(0);
      if (P.t < f1.t1 + 0.4) {
        // a mão aperta o cabo da espada
        aplicar(h, { cotoveloD: [-0.25, 0, 0] }, S(f1.t0, f1.t1, P.t));
        h.j.pulsoD.rotation.z = 0.15 * S(f1.t0, f1.t1, P.t);
        const m = c.mundo(h.maoD, [0, 0, 0]);
        cam(camera, [m.x + 0.4, m.y + 0.15, m.z + 0.45], v3(m), 30);
      } else {
        const cab = c.cabecaDe(h, 0.05);
        const k = S(f1.t1, P.dur, P.t);
        cam(camera, [cab.x + lerp(1.1, 0.8, k), cab.y - 0.05, cab.z - 0.4], v3(cab), 32);
      }
    },
  },
  {
    id: '4.2a', cap: 4, cenario: 'pedralva', falas: ['4.2.01'], antes: 1.2, depois: 0.4, fadeIn: 1.0, musica: 'noite', ambiente: ['fogo', 'grilos'],
    atualizar(c, P, { camera }) {
      fogueiraNoite(c, P.t);
      const a = c.aldeoes[0];
      aplicar(a, POSES.oferecer, 0.5);
      const cab = c.cabecaDe(a, 0.05);
      const dx = -1 - cab.x, dz = -14.5 - cab.z, d = Math.hypot(dx, dz);
      cam(camera, [cab.x + (dx / d) * 1.6, 1.35, cab.z + (dz / d) * 1.6], [cab.x, cab.y - 0.05, cab.z], 40);
    },
  },
  {
    id: '4.2b', cap: 4, cenario: 'pedralva', falas: ['4.2.02'], antes: 0.3, depois: 0.6, musica: 'noite', ambiente: ['fogo', 'grilos'],
    atualizar(c, P, { camera }) {
      fogueiraNoite(c, P.t);
      aplicar(c.tome, { ombroE: [-0.7, 0, -0.1], cotoveloE: [-0.5, 0, 0] }, S(0.3, 0.8, P.t));
      const cab = c.cabecaDe(c.tome, 0.05);
      cam(camera, [-1, cab.y + 0.15, -14.5], v3(cab), 40);
    },
  },
  {
    id: '4.2c', cap: 4, cenario: 'pedralva', falas: ['4.2.03'], antes: 2.6, depois: 0.8, musica: 'presenca', ambiente: ['fogo', 'grilos'],
    sons: () => [{ t: 0, som: 'arrastoEspada', dur: 2.6 }],
    atualizar(c, P, { camera }) {
      fogueiraNoite(c, P.t);
      c.heroi.raiz.visible = true;
      caminhar(c.heroi, [-6.5, -9.8], [-3.3, -13.1], S(0, 2.5, P.t), { peso: 0.7, bracoD: 0.3 });
      if (P.t > 2.5) parado(c.heroi, P.t);
      c.aldeoes.forEach((a) => { if (a.raiz.visible) c.virarPara(a, c.heroi.raiz.position.x, c.heroi.raiz.position.z); });
      const cab = c.cabecaDe(c.heroi, 0);
      cam(camera, [-1.3, 0.75, -14.2], [cab.x, cab.y - 0.15, cab.z], 44);
    },
  },
  {
    id: '4.2d', cap: 4, cenario: 'pedralva', falas: ['4.2.04', '4.2.05'], antes: 0.4, depois: 1.2, fadeOut: 1, musica: 'presenca', ambiente: ['fogo', 'grilos'],
    atualizar(c, P, { camera }) {
      fogueiraNoite(c, P.t);
      c.heroi.raiz.visible = true;
      c.pos(c.heroi, -3.3, -13.1);
      c.virarPara(c.heroi, -1, -14.5);
      parado(c.heroi, P.t);
      c.aldeoes.forEach((a) => { if (a.raiz.visible) c.virarPara(a, -3.3, -13.1); });
      c.virarPara(c.tome, -3.3, -13.1);
      const k = S(0, 1, P.k);
      cam(camera, L([1.6, 2.4, -19.6], [1.2, 3.0, -19.2], k), [-1.8, 0.9, -13.8], 50);
    },
  },
  // preparação (montagem, dia seguinte)
  {
    id: '4.2e', cap: 4, cenario: 'pedralva', min: 4.2, antes: 0, fadeIn: 0.6, musica: 'tensao', ...vento,
    sons: () => [{ t: 0.3, som: 'troncoArrasta', dur: 3 }],
    atualizar(c, P, { camera }) {
      c.estado.clima = 'cinzaVento';
      c.mostrar('aldeoes', 'heroi');
      c.barricada.forEach((b, i) => {
        b.visible = true;
        if (i === 1) b.position.x = lerp(4.5, 1.3, S(0, 3.5, P.t));
      });
      [0, 2, 3].forEach((n, i) => {
        const a = c.aldeoes[n];
        c.pos(a, c.barricada[1].position.x + 1.3 + i * 0.1, -7.3 + (i - 1) * 0.55, -Math.PI / 2);
        parado(a, P.t + n);
        aplicar(a, POSES.empurrar);
      });
      c.pos(c.heroi, -1.0, -8.6, Math.PI);
      parado(c.heroi, P.t);
      cam(camera, [3.4, 2.4, -12.5], [0.2, 0.8, -6.6], 48);
    },
  },
  {
    id: '4.2f', cap: 4, cenario: 'pedralva', min: 4.0, antes: 0, musica: 'tensao', ...vento,
    atualizar(c, P, { camera }) {
      c.estado.clima = 'cinzaVento';
      c.mostrar('aldeoes');
      [1, 4, 6, 7].forEach((n, i) => {
        const a = c.aldeoes[n];
        const b = c.baldes[i];
        b.visible = true;
        a.maoD.add(b);
        b.position.set(0, -0.05, 0);
        const de = [-3 + i * 2, -18], para = [-6 + i * 3.5, -11.5 - (i % 2) * 2];
        caminhar(a, de, para, ((P.t / 4 + i * 0.25) % 1), { peso: 0.7 });
        aplicar(a, { ombroD: [0.1, 0, -0.15] });
      });
      cam(camera, [1.5, 1.6, -21], [-2, 1.2, -12], 48);
    },
  },
  {
    id: '4.2g', cap: 4, cenario: 'pedralva', min: 4.0, antes: 0, fadeOut: 0.6, musica: 'tensao', ...vento,
    atualizar(c, P, { camera }) {
      c.estado.clima = 'cinzaVento';
      c.mostrar('lia', 'dalia', 'aldeoes');
      const k = S(0, 4.5, P.t);
      caminhar(c.dalia, [3.4, -9.0], [10.4, -6.4], k, { peso: 0.4 });
      caminhar(c.lia, [3.0, -8.4], [9.9, -5.9], k, { peso: 0 });
      [5, 10, 11].forEach((n, i) => caminhar(c.aldeoes[n], [2.2 - i * 0.7, -9.6 - i * 0.4], [9.0 - i * 0.6, -6.9 - i * 0.3], k, { peso: 0.4 }));
      cam(camera, [3.0, 1.6, -4.4], [8.0, 1.2, -7.4], 48);
    },
  },
  // no celeiro, à luz da vela
  {
    id: '4.3a', cap: 4, cenario: 'pedralva', falas: ['4.3.01'], antes: 1.2, depois: 0.4, fadeIn: 1.0, musica: 'calma', ambiente: ['grilos'],
    atualizar(c, P, { camera }) {
      c.mostrar();
      celeiroNoite(c);
      heroiSentado(c, P.t);
      liaSentada(c, P.t);
      cam(camera, [-10.4, 1.25, -6.7], [-12.5, 0.6, -6.9], 46);
    },
  },
  dialogoCeleiro('4.3b', ['4.3.02'], 'heroi'),
  dialogoCeleiro('4.3c', ['4.3.03'], 'lia'),
  dialogoCeleiro('4.3d', ['4.3.04'], 'heroi'),
  dialogoCeleiro('4.3e', ['4.3.05'], 'lia'),
  {
    id: '4.3f', cap: 4, cenario: 'pedralva', falas: ['4.3.06', '4.3.07'], antes: 0.3, depois: 0.8, musica: 'calma', ambiente: ['grilos'],
    atualizar(c, P, { camera }) {
      c.mostrar();
      celeiroNoite(c);
      heroiSentado(c, P.t);
      liaSentada(c, P.t);
      const f1 = P.fala(0);
      c.heroi.j.cabeca.rotation.y = -0.9 * S(f1.t0, f1.t0 + 0.4, P.t);
      const ombros = S(f1.t0 + f1.dur * 0.6, f1.t0 + f1.dur * 0.75, P.t) * (1 - S(f1.t1, f1.t1 + 0.4, P.t));
      c.lia.j.ombroE.rotation.z -= 0.3 * ombros;
      c.lia.j.ombroD.rotation.z += 0.3 * ombros;
      c.lia.j.cabeca.rotation.z = 0.2 * ombros;
      cam(camera, [-10.9, 1.0, -7.8], [-12.5, 0.75, -6.9], 42);
    },
  },
  {
    id: '4.3g', cap: 4, cenario: 'pedralva', min: 6.2, antes: 0, musica: 'tensao', ambiente: ['grilos'],
    sons: () => [{ t: 0.2, som: 'pancada' }, { t: 0.5, som: 'pancada' }, { t: 1.0, som: 'corrida', dur: 1.2 }],
    atualizar(c, P, { camera }) {
      c.mostrar('brana');
      celeiroNoite(c);
      heroiSentado(c, P.t);
      // Lia sai correndo; Brana entra com o pão, deixa no chão e volta para a porta
      if (P.t < 1.6) {
        c.lia.raiz.visible = true;
        caminhar(c.lia, [-12.3, -7.2], [-8.0, -6.6], S(0.6, 1.6, P.t), { correndo: true });
      }
      const b = c.brana;
      c.pao.visible = true;
      if (P.t < 2.0) b.raiz.visible = false;
      else if (P.t < 3.6) caminhar(b, [-8.4, -6.5], [-11.5, -6.3], S(2.0, 3.6, P.t), { amplitude: 0.5 });
      else if (P.t < 4.6) {
        c.pos(b, -11.5, -6.3);
        c.virarPara(b, -12.6, -6.4);
        parado(b, P.t);
        aplicar(b, POSES.agachar, Math.sin(((P.t - 3.6) / 1.0) * Math.PI));
      } else caminhar(b, [-11.5, -6.3], [-8.8, -6.5], S(4.6, 6.2, P.t), { amplitude: 0.5 });
      aplicar(b, POSES.bengala, 0.5);
      if (P.t < 4.1) {
        b.maoE.add(c.pao);
        c.pao.position.set(0, -0.04, 0.05);
      } else {
        c.cena.add(c.pao);
        c.pao.position.set(-12.0, 0.06, -6.25);
      }
      cam(camera, [-11.7, 1.4, -4.6], [-10.6, 0.9, -6.4], 48);
    },
  },
  {
    id: '4.3h', cap: 4, cenario: 'pedralva', falas: ['4.3.08'], antes: 0.6, depois: 0.8, musica: 'tensao', ambiente: ['grilos', 'vento'],
    atualizar(c, P, { camera }) {
      c.mostrar('brana');
      celeiroNoite(c);
      heroiSentado(c, P.t);
      c.pao.visible = true;
      c.cena.add(c.pao);
      c.pao.position.set(-12.0, 0.06, -6.25);
      const b = c.brana;
      c.pos(b, -8.8, -6.5, Math.PI / 2);
      parado(b, P.t);
      aplicar(b, POSES.bengala);
      b.j.cabeca.rotation.y = -0.35;
      cam(camera, [-12.0, 1.15, -6.0], [-8.8, 1.4, -6.5], 40);
    },
  },
  {
    id: '4.3i', cap: 4, cenario: 'pedralva', falas: ['4.3.09'], antes: 0.6, depois: 0.4, musica: 'presenca', ambiente: ['vento'],
    atualizar(c, P, { camera }) {
      c.mostrar();
      celeiroNoite(c);
      heroiSentado(c, P.t);
      c.pao.visible = true;
      c.cena.add(c.pao);
      c.pao.position.set(-12.0, 0.06, -6.25);
      const cab = c.cabecaDe(c.heroi, 0.04);
      const k = S(0, 1, P.k);
      cam(camera, [cab.x + lerp(0.9, 0.6, k), cab.y + 0.05, cab.z + 0.25], v3(cab), 32);
    },
  },
  {
    id: '4.3j', cap: 4, cenario: 'pedralva', falas: ['4.3.10'], antes: 0.6, depois: 2.4, fadeOut: 2.0, musica: 'noite', ambiente: ['grilos', 'vento'],
    atualizar(c, P, { camera }) {
      c.mostrar();
      celeiroNoite(c);
      c.celeiro.userData.folhas.forEach((f, i) => (f.rotation.y = i ? 0.06 : -0.02));
      cam(camera, L([-2.5, 2.6, -1.8], [-3.2, 2.8, -1.2], S(0, 1, P.k)), [-9.6, 1.5, -6.8], 46);
    },
  },
];

// diálogo no celeiro: plano e contraplano entre o herói sentado e a Lia
function dialogoCeleiro(id, falas, quemFala) {
  return {
    id, cap: 4, cenario: 'pedralva', falas, antes: 0.3, depois: 0.5, musica: 'calma', ambiente: ['grilos'],
    atualizar(c, P, { camera }) {
      c.mostrar();
      celeiroNoite(c);
      heroiSentado(c, P.t);
      liaSentada(c, P.t);
      c.heroi.j.cabeca.rotation.y = -0.5;
      c.lia.j.cabeca.rotation.set(-0.15, 0.35, 0);
      const ch = c.cabecaDe(c.heroi, 0.02), cl = c.cabecaDe(c.lia, 0.03);
      if (quemFala === 'heroi') cam(camera, [cl.x + 0.25, cl.y + 0.15, cl.z - 0.35], [ch.x, ch.y - 0.05, ch.z], 38);
      else cam(camera, [ch.x + 0.25, ch.y + 0.0, ch.z + 0.05], [cl.x, cl.y - 0.02, cl.z], 36);
    },
  };
}
