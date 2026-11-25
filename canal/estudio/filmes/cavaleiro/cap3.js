// Capítulo III: Brumal (flashback em tons dourados).
import { lerp } from '../../motor/ps1.js';
import * as T from '../../motor/texturas.js';
import { POSES, aplicar, parado, caminhar, andar } from '../../motor/personagem.js';
import { PENHASCO } from '../../cenarios/brumal.js';
import { S, cam, L, balanco, somar, v3 } from './util.js';

const SEPIA = 0.85;
const marcha = { musica: 'abertura', ambiente: ['vento'], sepia: SEPIA };

// a tropa marchando pela estrada (ao longo de x, em direção à aldeia em x=0)
function tropa(c, x0, t, andando = true) {
  const fase = (-x0 / 1.6) * Math.PI * 2;
  c.cavalo.raiz.position.set(x0, 0, 0);
  c.cavalo.raiz.rotation.set(0, -Math.PI / 2, 0);
  c.montar(t, fase, andando ? 1 : 0);
  c.bandeiras.forEach((b, i) => b.position.set(x0 + 2.6, 0, i ? 0.9 : -0.9));
  c.lanceiros.forEach((s, i) => {
    const fila = Math.floor(i / 2), lado = i % 2 ? 1 : -1;
    const x = x0 + 3.6 + fila * 1.5, z = lado * 0.75;
    s.raiz.position.set(x, 0, z);
    s.raiz.rotation.set(0, -Math.PI / 2, 0);
    if (andando) andar(s, ((-x) / 1.44) * Math.PI * 2 + fila * 0.4, { peso: 0.3, bracoD: 0.1 });
  });
}

export const planos3 = [
  { id: 'c3', cap: 3, tela: { tipo: 'capitulo', n: 3, nome: 'Brumal' }, min: 4.5, antes: 0, ambiente: ['vento'] },
  {
    id: '3.1a', cap: 3, cenario: 'brumal', falas: ['3.1.01'], antes: 1.0, depois: 0.6, fadeIn: 1.2, fadeCor: 0xfff4dc, ...marcha,
    atualizar(c, P, { camera }) {
      c.mostrar('damaso', 'cavalo', 'lanceiros');
      const x0 = lerp(46, 43, P.k);
      tropa(c, x0, P.t);
      const cab = c.cabecaDe(c.damaso, 0.05);
      cam(camera, [cab.x - 0.65, cab.y + 0.05, cab.z + 0.45], v3(cab), 32);
    },
  },
  {
    id: '3.1b', cap: 3, cenario: 'brumal', falas: ['3.1.02'], antes: 0.4, depois: 1.0, ...marcha,
    sons: (P) => [{ t: 0, som: 'carroca', dur: P.dur }],
    atualizar(c, P, { camera }) {
      c.mostrar('damaso', 'cavalo', 'lanceiros');
      const x0 = lerp(43, 39, P.k);
      tropa(c, x0, P.t);
      cam(camera, L([x0 - 4.5, 0.6, 1.8], [x0 - 3.4, 0.7, 1.4], S(0, 1, P.k)), [x0, 2.2, 0], 44);
    },
  },
  {
    id: '3.1c', cap: 3, cenario: 'brumal', falas: ['3.1.03'], antes: 0.3, depois: 0.6, ...marcha,
    sons: (P) => [{ t: 0, som: 'carroca', dur: P.dur }],
    atualizar(c, P, { camera }) {
      c.mostrar('damaso', 'cavalo', 'lanceiros');
      const x0 = lerp(39, 34, P.k);
      tropa(c, x0, P.t);
      cam(camera, [x0 + 2.5, 1.7, 5.2], [x0 + 2.0, 1.4, 0], 46);
    },
  },
  {
    id: '3.1d', cap: 3, cenario: 'brumal', falas: ['3.1.04'], antes: 0.3, depois: 1.4, ...marcha,
    atualizar(c, P, { camera }) {
      c.mostrar('damaso', 'cavalo', 'lanceiros');
      const x0 = lerp(34, 29, P.k);
      tropa(c, x0, P.t);
      cam(camera, somar([x0 + 16, 5.5, 9], balanco(P.t, 0.05)), [x0 - 8, 0.5, -1], 50);
    },
  },
  // ---------- o salão ----------
  {
    id: '3.2a', cap: 3, cenario: 'castelo', falas: ['3.2.01'], antes: 0.8, depois: 0.5, musica: 'tensao', sepia: SEPIA,
    atualizar(c, P, { camera }) {
      const cab = c.cabecaDe(c.damaso, 0.1);
      cam(camera, L([cab.x - 0.6, cab.y + 0.1, cab.z + 1.4], [cab.x - 0.4, cab.y, cab.z + 1.0], S(0, 1, P.k)), [3.6, 1.6, 1.5], 46);
    },
  },
  {
    id: '3.2b', cap: 3, cenario: 'castelo', falas: ['3.2.02'], antes: 0.3, depois: 0.5, musica: 'tensao', sepia: SEPIA,
    atualizar(c, P, { camera }) {
      const m = c.malvar;
      const vira = S(0, 1.2, P.t);
      m.raiz.rotation.y = lerp(Math.PI / 2, Math.atan2(0 - 3.6, 4.5 - 1.5), vira);
      const cab = c.cabecaDe(m, 0.06);
      cam(camera, [cab.x - 1.0, cab.y - 0.05, cab.z + 0.9], v3(cab), 36);
    },
  },
  {
    id: '3.2c', cap: 3, cenario: 'castelo', falas: ['3.2.03'], antes: 0.4, depois: 0.4, musica: 'tensao', sepia: SEPIA,
    atualizar(c, P, { camera }) {
      c.virarPara(c.malvar, 0, 4.5);
      const cab = c.cabecaDe(c.damaso, 0.05);
      cam(camera, [cab.x + 0.5, cab.y + 0.05, cab.z - 1.1], v3(cab), 36);
    },
  },
  {
    id: '3.2d', cap: 3, cenario: 'castelo', falas: ['3.2.04'], antes: 0.3, depois: 0.5, musica: 'tensao', sepia: SEPIA,
    atualizar(c, P, { camera }) {
      c.virarPara(c.malvar, 0, 4.5);
      const cab = c.cabecaDe(c.malvar, 0.06);
      const k = S(0, 1, P.k);
      cam(camera, [cab.x - lerp(1.2, 0.85, k), cab.y - 0.02, cab.z + lerp(0.9, 0.6, k)], v3(cab), 34);
    },
  },
  {
    id: '3.2e', cap: 3, cenario: 'castelo', falas: ['3.2.05', '3.2.06', '3.2.07'], antes: 0.4, depois: 1.0, musica: 'tensao', sepia: SEPIA,
    sons: (P) => [{ t: P.fala(2).t0, som: 'passosDescalco', dur: 2.5 }],
    atualizar(c, P, { camera }) {
      c.virarPara(c.malvar, 0, 4.5);
      const d = c.damaso;
      const f3 = P.fala(2);
      d.j.cabeca.rotation.x = 0.3 * S(P.fala(0).t0, P.fala(1).t1, P.t);
      if (P.t > f3.t0) {
        const k = S(f3.t0, P.dur, P.t);
        caminhar(d, [0, 4.5], [0.2, 8.5], k * 0.9, { peso: 0.3 });
        if (k < 0.12) d.raiz.rotation.y = lerp(Math.PI, 0, k / 0.12);
      }
      cam(camera, [-1.4, 1.6, 1.0], [0, 1.6, 5.5], 44);
    },
  },
  // ---------- o incêndio ----------
  {
    id: '3.3a', cap: 3, cenario: 'brumal', falas: ['3.3.01'], antes: 1.4, depois: 0.8, fadeIn: 0.8, musica: 'impacto', ambiente: ['fogo', 'vento'], sepia: 0.4,
    sons: () => [{ t: 0.9, som: 'golpe' }, { t: 1.7, som: 'golpe' }],
    atualizar(c, P, { camera }) {
      c.estado.clima = 'noiteFogo';
      c.estado.fogo = lerp(0.3, 0.9, S(0.5, P.dur, P.t));
      c.mostrar('tocheiros');
      c.tocheiros.forEach((s, i) => {
        const cb = c.cabanas[i % c.cabanas.length];
        c.pos(s, cb.x * 0.72 + 0.6, cb.z * 0.72);
        c.virarPara(s, cb.x, cb.z);
        const arr = 0.7 + i * 0.25;
        aplicar(s, POSES.arremessar, S(arr - 0.5, arr, P.t) * (1 - S(arr, arr + 0.15, P.t)));
        aplicar(s, POSES.arremessarFim, S(arr, arr + 0.15, P.t));
      });
      cam(camera, L([4.5, 1.6, 6.5], [3.8, 1.8, 5.6], S(0, 1, P.k)), [-1, 1.8, -3], 50);
    },
  },
  {
    id: '3.3b', cap: 3, cenario: 'brumal', falas: ['3.3.02'], antes: 0.6, depois: 1.6, musica: 'impacto', ambiente: ['fogo'], sepia: 0.4,
    sons: (P) => [{ t: 0, som: 'corrida', dur: 3 }],
    atualizar(c, P, { camera }) {
      c.estado.clima = 'noiteFogo';
      c.estado.fogo = 1;
      c.mostrar('damaso', 'cavalo', 'tocheiros', 'moradores');
      c.cavalo.raiz.position.set(9, 0, 1.5);
      c.cavalo.raiz.rotation.set(0, -Math.PI / 2 - 0.25, 0);
      c.montar(P.t);
      c.moradores.forEach((m, i) => {
        const a = (i / 6) * Math.PI * 2;
        caminhar(m, [Math.cos(a) * 3, Math.sin(a) * 3], [Math.cos(a + 1) * 15, Math.sin(a + 1) * 15], ((P.t * 0.18 + i * 0.17) % 1), { correndo: true });
      });
      c.tocheiros.forEach((s, i) => c.pos(s, 6 + (i % 3) * 1.3, -3 + Math.floor(i / 3) * 6, -Math.PI / 2));
      cam(camera, L([16, 2.0, 4.5], [15, 2.1, 3.6], S(0, 1, P.k)), [0, 2.0, -0.5], 50);
    },
  },
  {
    id: '3.4a', cap: 3, cenario: 'brumal', falas: ['3.4.01'], antes: 2.2, depois: 0.4, musica: 'presenca', ambiente: ['fogo'], sepia: 0.4,
    atualizar(c, P, { camera }) {
      fogoMulher(c, P);
      caminhar(c.mulher, [3.5, 1.2], [6.9, 1.5], S(0, 2.0, P.t), { amplitude: 0.6, peso: 0.8 });
      c.virarPara(c.mulher, 9, 1.5);
      if (P.t > 2.0) { parado(c.mulher, P.t); }
      aplicar(c.mulher, POSES.segurarFilho);
      c.mulher.j.cabeca.rotation.x = -0.45 * S(2.0, 2.6, P.t);
      cam(camera, [10.8, 0.8, 3.8], [6.9, 1.3, 1.4], 46);
    },
  },
  {
    id: '3.4b', cap: 3, cenario: 'brumal', falas: ['3.4.02'], antes: 0.3, depois: 0.4, musica: 'presenca', ambiente: ['fogo'], sepia: 0.4,
    atualizar(c, P, { camera }) {
      fogoMulher(c, P);
      mulherParada(c, P);
      const cab = c.cabecaDe(c.mulher, 0.05);
      cam(camera, [cab.x + 0.85, cab.y + 0.2, cab.z + 0.15], v3(cab), 32);
    },
  },
  {
    id: '3.4c', cap: 3, cenario: 'brumal', falas: ['3.4.03'], antes: 0.3, depois: 0.8, musica: 'presenca', ambiente: ['fogo'], sepia: 0.4,
    atualizar(c, P, { camera }) {
      fogoMulher(c, P);
      mulherParada(c, P);
      const f = P.fala(0);
      if (P.t < f.t0 + f.dur * 0.6) {
        const m = c.mundo(c.mulher.maoD, [0, -0.03, 0]);
        cam(camera, [m.x + 0.55, m.y + 0.15, m.z - 0.25], v3(m), 32);
      } else {
        const cab = c.cabecaDe(c.mulher, 0.06);
        cam(camera, [cab.x + 0.6, cab.y + 0.12, cab.z - 0.1], v3(cab), 26);
      }
    },
  },
  {
    id: '3.4d', cap: 3, cenario: 'brumal', falas: ['3.4.04', '3.4.05'], antes: 0.4, depois: 1.6, fadeOut: 1.2, musica: 'presenca', ambiente: ['fogo'], sepia: 0.4,
    atualizar(c, P, { camera }) {
      fogoMulher(c, P);
      mulherParada(c, P);
      const cab = c.cabecaDe(c.damaso, 0.05);
      c.estado.luzes = [{ pos: [cab.x - 1.5, cab.y, cab.z - 0.5], cor: 0xff7a30, intensidade: 1.0, alcance: 3 }];
      const k = S(0, 1, P.k);
      cam(camera, [cab.x - lerp(1.0, 0.7, k), cab.y - 0.05, cab.z + 0.35], v3(cab), 30);
    },
  },
  // ---------- o homem que não morria ----------
  {
    id: '3.5a', cap: 3, cenario: 'brumal', falas: ['3.5.01'], antes: 1.2, depois: 1.0, fadeIn: 0.6, musica: 'abertura', ambiente: ['vento'], sepia: 0.75,
    sons: (P) => [{ t: P.dur - 0.7, som: 'queda' }],
    atualizar(c, P, { camera }) {
      c.estado.clima = 'manhaCinza';
      c.mostrar('damaso');
      const d = c.damaso;
      const tCai = 1.5, tChao = tCai + 1.15;
      const bx = PENHASCO.x - 1;
      if (P.t < tCai) {
        caminhar(d, [bx, PENHASCO.borda + 3.5], [bx, PENHASCO.borda + 0.3], S(0, tCai, P.t), { peso: 0.5 });
        d.raiz.position.y = PENHASCO.alt;
      } else {
        const q = Math.min(1, (P.t - tCai) / (tChao - tCai));
        d.raiz.position.set(bx, PENHASCO.alt * (1 - q * q), PENHASCO.borda + 0.3 - q * 1.2);
        d.raiz.rotation.set(-q * 1.2, Math.PI, 0);
        parado(d, P.t);
        aplicar(d, POSES.bracosAbertos, q);
        if (P.t > tChao) d.raiz.visible = false;
      }
      cam(camera, [bx + 11, 4.2, PENHASCO.borda - 6], [bx, 3.6, PENHASCO.borda], 50);
    },
  },
  {
    id: '3.5b', cap: 3, cenario: 'brumal', falas: ['3.5.02'], antes: 0.8, depois: 1.0, musica: 'abertura', ambiente: ['vento'], sepia: 0.7,
    atualizar(c, P, { camera }) {
      c.estado.clima = 'manhaCinza';
      c.mostrar('damaso');
      const d = c.damaso;
      const bx = PENHASCO.x - 1, z = PENHASCO.margem;
      const sobe = S(1.2, P.dur - 0.4, P.t);
      d.raiz.position.set(bx, 0.12 * (1 - sobe), z);
      d.raiz.rotation.set(-1.45 * (1 - sobe), Math.PI, 0);
      parado(d, P.t);
      aplicar(d, POSES.ajoelhado, Math.sin(sobe * Math.PI) * 0.8);
      cam(camera, [bx + 2.6, 0.7, z - 2.0], [bx, 0.6, z], 42);
    },
  },
  {
    id: '3.5c', cap: 3, cenario: 'brumal', falas: ['3.5.03', '3.5.04', '3.5.05'], antes: 0.6, depois: 1.0, musica: 'abertura', ambiente: ['vento'],
    sepia: (P) => lerp(0.8, 0.15, S(0, P.dur, P.t)),
    sons: (P) => [0.15, 0.35, 0.55, 0.72, 0.86].map((x) => ({ t: P.dur * x + 0.5, som: 'queda' })),
    atualizar(c, P, { camera }) {
      c.estado.clima = 'manhaCinza';
      const x = 24.4, z = -41.6;
      // a armadura sai em pedaços; no meio do plano ele já está só de cueca
      const troca = P.dur * 0.62;
      const quem = P.t < troca ? c.damaso : c.semArmadura;
      c.mostrar(P.t < troca ? 'damaso' : 'semArmadura');
      c.pos(quem, x, z, Math.PI);
      parado(quem, P.t);
      [0.15, 0.35, 0.55, 0.72, 0.86].forEach((fx, i) => {
        const t0 = P.dur * fx, q = (P.t - t0) / 0.5;
        const p = c.pecas[i];
        if (q < 0 || q > 1.3) { p.visible = false; return; }
        p.visible = q <= 1;
        p.position.set(x + (i - 2) * 0.3, 1.3 + q * 1.2 - q * q * 2.2, z - q * 2.4);
        p.rotation.set(q * 5, q * 3, 0);
        if (Math.abs(q - 1) < 0.3) {
          c.respingo.visible = true;
          c.respingo.position.set(x + (i - 2) * 0.3, -0.2, z - 2.4);
          c.respingo.material.opacity = 0.6 * (1 - Math.abs(q - 1) / 0.3);
        }
      });
      const lanca = P.dur * 0.15, ciclo = ((P.t - lanca) % (P.dur * 0.2)) / (P.dur * 0.2);
      if (P.t > lanca && P.t < P.dur * 0.92) aplicar(quem, POSES.arremessar, Math.sin(ciclo * Math.PI) * 0.6);
      cam(camera, L([x + 3.2, 1.5, z + 2.6], [x + 2.6, 1.4, z + 2.0], S(0, 1, P.k)), [x - 0.4, 1.0, z - 1.5], 46);
    },
  },
  {
    id: '3.5d', cap: 3, cenario: 'brumal', falas: ['3.5.06', '3.5.07'], antes: 0.4, depois: 0.8, musica: 'abertura', ambiente: ['vento'], sepia: 0.1,
    atualizar(c, P, { camera }) {
      c.estado.clima = 'manhaCinza';
      c.mostrar('semArmadura');
      const h = c.semArmadura, x = 24.4, z = -41.6;
      c.pos(h, x, z, Math.PI);
      parado(h, P.t);
      const f2 = P.fala(1);
      if (P.t < f2.t0) {
        const e = c.mundo(h.espada, [0, 0.45, 0]);
        cam(camera, [e.x + 0.5, e.y + 0.3, e.z - 0.6], v3(e), 34);
      } else {
        const cab = c.cabecaDe(h, 0.06);
        cam(camera, [cab.x - 0.75, cab.y + 0.02, cab.z - 0.35], v3(cab), 30);
      }
    },
  },
  {
    id: '3.5e', cap: 3, cenario: 'brumal', falas: ['3.5.08', '3.5.09'], antes: 0.8, depois: 2.6, fadeOut: 2.2, musica: 'abertura', ambiente: ['vento'], sepia: 0,
    sons: (P) => [{ t: P.dur - 1.6, som: 'arrastoEspada', dur: 0.5 }],
    atualizar(c, P, { camera }) {
      c.estado.clima = 'manhaCinza';
      c.mostrar();
      // a lâmina vai perdendo o brilho e enferrujando
      const k = S(0.3, P.dur - 1, P.t);
      const m = c.laminaRio.uniforms;
      m.uCor.value.setRGB(lerp(1, 0.75, k), lerp(1, 0.42, k), lerp(1, 0.28, k));
      m.uMapa.value = k > 0.55 ? T.ferrugem(61, 'lamina') : m.uMapa.value;
      m.uBrilhoProprio.value = 0.08 * (1 - k);
      const e = c.mundo(c.espadaRio, [0, 0.35, 0]);
      const k2 = S(0, 1, P.k);
      cam(camera, [e.x + 0.25, e.y + lerp(1.25, 1.0, k2), e.z + 0.45], v3(e), 44);
    },
  },
];

function fogoMulher(c, P) {
  c.estado.clima = 'noiteFogo';
  c.estado.fogo = 1;
  c.mostrar('damaso', 'cavalo', 'mulher');
  c.cavalo.raiz.position.set(9, 0, 1.5);
  c.cavalo.raiz.rotation.set(0, -Math.PI / 2 - 0.05, 0);
  c.montar(P.t);
}

function mulherParada(c, P) {
  c.pos(c.mulher, 6.9, 1.5);
  c.virarPara(c.mulher, 9, 1.5);
  parado(c.mulher, P.t);
  aplicar(c.mulher, POSES.segurarFilho);
  c.mulher.j.cabeca.rotation.x = -0.45;
}
