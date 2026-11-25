// Capítulo V: A Noite do Fogo (a batalha na ponte, sob chuva).
import { lerp } from '../../motor/ps1.js';
import { POSES, aplicar, parado, caminhar, andar, correr } from '../../motor/personagem.js';
import { cavaloAndar } from '../../motor/animais.js';
import { S, cam, L, balanco, somar, v3 } from './util.js';

const chuva = { ambiente: ['chuva', 'vento'] };

function noiteDeChuva(c, P, relampagos = []) {
  const e = c.estado;
  e.clima = 'noiteChuva';
  e.chuva = 1;
  e.relampago = c.relampago(P.t, relampagos);
  c.mostrar('heroi');
  c.barricada.forEach((b) => (b.visible = true));
  // aldeões atrás da barricada
  [0, 1, 2, 3, 4, 8].forEach((n, i) => {
    const a = c.aldeoes[n];
    a.raiz.visible = true;
    c.pos(a, -2.4 + i * 0.95, -8.6 - (i % 2) * 0.6, Math.PI * 0);
    parado(a, P.t + n);
  });
  c.tome.raiz.visible = true;
  c.pos(c.tome, 0.6, -8.2, 0);
  parado(c.tome, P.t);
}

// o exército em bloco na outra margem (avanco empurra para a ponte)
function exercito(c, P, avanco = 0, rindo = 0) {
  c.exercito.forEach((s, i) => {
    s.raiz.visible = true;
    const fila = Math.floor(i / 4), col = i % 4;
    const z = 7.6 + fila * 1.3 - avanco;
    const x = -1.65 + col * 1.1 + (fila % 2) * 0.3;
    c.pos(s, x, z, Math.PI);
    if (Math.abs(z) < 5.2) s.raiz.position.y = 0.48;
    parado(s, P.t + i);
    if (rindo) s.j.tronco.rotation.x = -0.1 + Math.sin(P.t * 13 + i) * 0.06 * rindo;
    if (s.tocha) aplicar(s, { ombroD: [-0.5, 0, 0.1] });
  });
}

function heroiNaPonte(c, P, z = 0.4, rot = 0) {
  c.naPonte(c.heroi, z, 0, rot);
  parado(c.heroi, P.t);
}

function cravar(c, objeto, pai, pos, rot) {
  objeto.visible = true;
  pai.add(objeto);
  objeto.position.set(...pos);
  objeto.rotation.set(...rot);
}

export const planos5 = [
  { id: 'c5', cap: 5, tela: { tipo: 'capitulo', n: 5, nome: 'A Noite do Fogo' }, min: 4.5, antes: 0, ambiente: ['chuva'] },
  {
    id: '5.1a', cap: 5, cenario: 'pedralva', falas: ['5.1.01', '5.1.02'], antes: 2.4, depois: 1.6, fadeIn: 1.4, musica: 'presenca', ...chuva,
    sons: () => [{ t: 1.2, som: 'trovao' }],
    atualizar(c, P, { camera }) {
      noiteDeChuva(c, P, [1.0]);
      heroiNaPonte(c, P);
      c.serpentePos(lerp(0, 0.75, S(0, P.dur, P.t)), P.t);
      cam(camera, somar(L([-1.3, 2.7, -11.0], [-1.0, 2.6, -10.2], S(0, 1, P.k)), balanco(P.t, 0.015)), [0.3, 1.3, 26], 46);
    },
  },
  {
    id: '5.2a', cap: 5, cenario: 'pedralva', falas: ['5.2.01'], antes: 1.6, depois: 0.4, musica: 'tensao', ...chuva,
    atualizar(c, P, { camera }) {
      noiteDeChuva(c, P);
      heroiNaPonte(c, P);
      exercito(c, P);
      c.vozes.soldado = c.exercito[1];
      const s = c.exercito[1];
      aplicar(s, POSES.apontar, S(0.6, 1.2, P.t));
      const cab = c.cabecaDe(c.heroi, 0.1);
      cam(camera, [cab.x - 0.55, cab.y + 0.12, cab.z - 1.0], [0, 1.6, 9.5], 44);
    },
  },
  {
    id: '5.2b', cap: 5, cenario: 'pedralva', falas: ['5.2.02', '5.2.03'], antes: 0.3, depois: 1.8, musica: 'acao', ...chuva,
    sons: (P) => [{ t: 0.1, som: 'risada' }, { t: P.fala(1).t1, som: 'corrida', dur: 1.8 }],
    atualizar(c, P, { camera }) {
      noiteDeChuva(c, P, [P.fala(1).t1 - 0.2]);
      heroiNaPonte(c, P);
      const f2 = P.fala(1);
      const avanca = S(f2.t1 - 0.2, P.dur, P.t);
      exercito(c, P, avanca * 4.5, 1 - S(f2.t0, f2.t0 + 0.4, P.t));
      if (avanca > 0) c.exercito.forEach((s, i) => { correr(s, P.t * 9 + i, 0.8); s.raiz.rotation.y = Math.PI; });
      cam(camera, [5.2, 2.2, 2.2], [0, 1.0, 4.8], 48);
    },
  },
  {
    id: '5.3a', cap: 5, cenario: 'pedralva', falas: ['5.3.01'], antes: 0.4, depois: 0.4, musica: 'acao', ...chuva,
    sons: () => [{ t: 0.55, som: 'impactoFlecha' }, { t: 1.3, som: 'golpe' }, { t: 2.2, som: 'pancada' }],
    atualizar(c, P, { camera }) {
      noiteDeChuva(c, P, [0.55]);
      const h = c.heroi;
      c.naPonte(h, lerp(0.4, 1.3, S(0.8, P.dur, P.t)), 0, 0);
      andar(h, P.t * 3, { peso: 1, amplitude: 0.6 });
      exercito(c, P, 4.2);
      const s = c.exercito[1];
      c.naPonte(s, 2.2, 0.35, Math.PI);
      parado(s, P.t);
      aplicar(s, POSES.apontar, S(0.2, 0.5, P.t));
      if (P.t > 0.55) cravar(c, c.lancasCravadas[0], h.j.tronco, [0.17, 0.4, 0.12], [1.2, 0.2, 0]);
      cam(camera, [2.6, 1.5, 0.6], [0.1, 1.4, 1.4], 42);
    },
  },
  {
    id: '5.3b', cap: 5, cenario: 'pedralva', falas: ['5.3.02'], antes: 0.3, depois: 0.4, musica: 'acao', ...chuva,
    sons: () => [0.4, 1.1, 1.9].map((t) => ({ t, som: 'impactoFlecha' })),
    atualizar(c, P, { camera }) {
      noiteDeChuva(c, P, [1.1]);
      const h = c.heroi;
      c.naPonte(h, 1.3, 0, 0);
      parado(h, P.t);
      exercito(c, P, 4.2);
      cravar(c, c.lancasCravadas[0], h.j.tronco, [0.17, 0.4, 0.12], [1.2, 0.2, 0]);
      [0.4, 1.1, 1.9].forEach((t0, i) => {
        if (P.t > t0) cravar(c, c.flechasCravadas[i], h.j.tronco, [-0.1 + i * 0.1, 0.22 + i * 0.07, -0.13], [-1.7, 0.2 * (i - 1), 0]);
        if (Math.abs(P.t - t0) < 0.15) h.j.tronco.rotation.x += 0.12;
      });
      cam(camera, [0.7, 1.75, -1.6], [0, 1.35, 1.3], 44);
    },
  },
  {
    id: '5.3c', cap: 5, cenario: 'pedralva', falas: ['5.3.03'], antes: 0.3, depois: 0.8, musica: 'acao', ...chuva,
    sons: () => [{ t: 0.6, som: 'madeiraQuebra' }, { t: 1.5, som: 'golpe' }, { t: 2.4, som: 'respingo' }],
    atualizar(c, P, { camera }) {
      noiteDeChuva(c, P, [0.6, 2.4]);
      const h = c.heroi;
      c.naPonte(h, 1.5, 0, 0);
      parado(h, P.t);
      aplicar(h, POSES.empurrar, S(1.2, 1.5, P.t) * (1 - S(2.2, 2.8, P.t)));
      cravar(c, c.lancasCravadas[0], h.j.tronco, [0.17, 0.4, 0.12], [1.2, 0.2, 0]);
      [0, 1, 2].forEach((i) => cravar(c, c.flechasCravadas[i], h.j.tronco, [-0.1 + i * 0.1, 0.22 + i * 0.07, -0.13], [-1.7, 0.2 * (i - 1), 0]));
      exercito(c, P, 4.2);
      // um soldado é empurrado da ponte para o rio
      const s = c.exercito[2];
      const q = S(1.5, 2.4, P.t);
      s.raiz.position.set(lerp(0.4, 2.3, q), lerp(0.48, -0.9, q * q), lerp(2.4, 2.8, q));
      s.raiz.rotation.set(-q * 1.2, Math.PI, q * 0.8);
      aplicar(s, POSES.maosAoAlto, q);
      c.respingo.visible = P.t > 2.35 && P.t < 2.9;
      c.respingo.position.set(2.3, -0.2, 2.8);
      c.respingo.material.opacity = 0.7 * (1 - S(2.35, 2.9, P.t));
      cam(camera, [5.6, 1.1, -1.8], [0.8, 0.8, 2.0], 46);
    },
  },
  {
    id: '5.3d', cap: 5, cenario: 'pedralva', falas: ['5.3.04'], antes: 2.4, depois: 0.8, musica: 'acao', ambiente: ['chuva', 'fogo'],
    sons: () => [{ t: 1.4, som: 'chiado' }],
    atualizar(c, P, { camera }) {
      noiteDeChuva(c, P);
      // uma tocha voa para o telhado da casa do Tomé e se apaga na palha molhada
      const f = c.fogosExercito[0];
      const q = S(0.2, 1.4, P.t);
      f.grupo.visible = P.t < 1.9;
      f.grupo.position.set(lerp(-4.5, -7.2, q), 1.4 + q * 3 - q * q * 1.2, lerp(-4.2, -10.6, q));
      f.grupo.scale.setScalar(P.t > 1.4 ? Math.max(0.01, 1 - (P.t - 1.4) * 2) : 1);
      f.atualizar(P.t, 2);
      c.estado.luzes.push({ pos: v3(f.grupo.position), cor: 0xff8a40, intensidade: P.t < 1.6 ? 1.2 : 0.1, alcance: 6 });
      c.respingo.visible = P.t > 1.4 && P.t < 2.6;
      c.respingo.position.set(-7.2, 3.6, -10.6);
      c.respingo.material.color.set(0xd0d0d0);
      c.respingo.material.opacity = 0.5 * (1 - S(1.4, 2.6, P.t));
      // aldeões com baldes
      [5, 6].forEach((n, i) => {
        const a = c.aldeoes[n];
        a.raiz.visible = true;
        caminhar(a, [-3 + i, -9], [-5.3 + i * 0.4, -10.2], S(1.2, 3.2, P.t), { correndo: true, amplitude: 0.7 });
        const b = c.baldes[i];
        b.visible = true;
        a.maoD.add(b);
        b.position.set(0, -0.05, 0);
      });
      cam(camera, [-2.0, 1.6, -5.4], [-6.6, 2.6, -10.6], 50);
    },
  },
  {
    id: '5.4a', cap: 5, cenario: 'pedralva', falas: ['5.4.01', '5.4.02'], antes: 2.2, depois: 0.6, musica: 'presenca', ...chuva,
    sons: () => [{ t: 0, som: 'passosDescalco', dur: 2.2 }],
    atualizar(c, P, { camera }) {
      noiteDeChuva(c, P, [P.fala(1).t0]);
      heroiNaPonte(c, P, 1.3);
      exercito(c, P, -1.2);
      const m = c.malvar;
      m.raiz.visible = true;
      caminhar(m, [0, 7.2], [0, 2.6], S(0, 2.2, P.t), { peso: 0.2 });
      m.raiz.position.y = Math.abs(m.raiz.position.z) < 5.2 ? 0.48 : 0;
      if (P.t > 2.2) {
        c.naPonte(m, 2.6, 0, Math.PI);
        parado(m, P.t);
        const f1 = P.fala(0), f2 = P.fala(1);
        m.j.cabeca.rotation.x = P.t < f1.t1 ? Math.sin((P.t - f1.t0) * 2.2) * 0.4 + 0.1 : 0.5 * S(f2.t0, f2.t0 + 0.4, P.t);
      }
      c.cavaloBarao.raiz.visible = true;
      c.cavaloBarao.raiz.position.set(1.2, 0, 8.6);
      c.cavaloBarao.raiz.rotation.set(0, Math.PI, 0);
      cavaloAndar(c.cavaloBarao, 0, 0, P.t);
      cam(camera, [3.3, 1.55, 1.9], [0, 1.6, 2.0], 44);
    },
  },
  {
    id: '5.4b', cap: 5, cenario: 'pedralva', falas: ['5.4.03', '5.4.04'], antes: 0.3, depois: 0.4, musica: 'presenca', ...chuva,
    atualizar(c, P, { camera }) {
      duelo(c, P);
      const cab = c.cabecaDe(c.malvar, 0.06);
      cam(camera, [cab.x + 0.45, cab.y + 0.05, cab.z - 0.95], v3(cab), 34);
    },
  },
  {
    id: '5.4c', cap: 5, cenario: 'pedralva', falas: ['5.4.05'], antes: 0.6, depois: 0.8, musica: 'presenca', ...chuva,
    atualizar(c, P, { camera }) {
      duelo(c, P);
      const cab = c.cabecaDe(c.heroi, 0.06);
      const k = S(0, 1, P.k);
      cam(camera, [cab.x - 0.4, cab.y + 0.02, cab.z + lerp(1.0, 0.75, k)], v3(cab), 32);
    },
  },
  {
    id: '5.4d', cap: 5, cenario: 'pedralva', falas: ['5.4.06', '5.4.07'], antes: 2.8, depois: 0.6, musica: 'impacto', ...chuva,
    sons: () => [{ t: 0.75, som: 'metal' }, { t: 2.1, som: 'metalQuebra' }, { t: 2.9, som: 'pancada' }],
    atualizar(c, P, { camera }) {
      duelo(c, P, [2.1]);
      const h = c.heroi, m = c.malvar;
      // o barão golpeia o pescoço: nada acontece
      aplicar(m, POSES.espadaAlto, S(0.1, 0.5, P.t) * (1 - S(0.6, 0.75, P.t)));
      aplicar(m, { ombroD: [-1.5, 0.6, 0.6], cotoveloD: [-0.2, 0, 0], tronco: [0.1, 0.5, 0] }, S(0.6, 0.75, P.t));
      // o herói segura a lâmina com a mão nua e a parte com a espada enferrujada
      aplicar(h, { ombroE: [-1.1, 0, 0.4], cotoveloE: [-0.6, 0, 0] }, S(1.0, 1.4, P.t));
      aplicar(h, POSES.espadaAlto, S(1.4, 1.9, P.t) * (1 - S(2.0, 2.15, P.t)));
      aplicar(h, POSES.espadaBaixo, S(2.0, 2.15, P.t));
      if (P.t > 2.1) {
        m.espada.userData.lamina.forEach((x) => (x.visible = false));
        const q = Math.min(1, (P.t - 2.1) / 0.7);
        c.pontaQuebrada.visible = true;
        c.pontaQuebrada.position.set(0.3 + q * 0.4, lerp(1.4, 0.55, q * q), 2.0 + q * 0.3);
        c.pontaQuebrada.rotation.set(q * 4, q * 2, 0);
      }
      cam(camera, [3.0, 1.45, 1.9], [0, 1.45, 2.0], 42);
    },
  },
  {
    id: '5.4e', cap: 5, cenario: 'pedralva', falas: ['5.4.08'], antes: 0.6, depois: 0.6, musica: 'presenca', ...chuva,
    atualizar(c, P, { camera }) {
      duelo(c, P);
      const h = c.heroi, m = c.malvar;
      m.espada.userData.lamina.forEach((x) => (x.visible = false));
      aplicar(m, POSES.ajoelhado);
      m.j.cabeca.rotation.x = -0.35;
      aplicar(h, POSES.apontar);
      const cab = c.cabecaDe(m, 0.05);
      cam(camera, [cab.x + 0.75, cab.y + 0.12, cab.z - 0.75], v3(cab), 36);
    },
  },
  {
    id: '5.4f', cap: 5, cenario: 'pedralva', falas: ['5.4.09'], antes: 0.6, depois: 4.2, musica: 'calma', ...chuva,
    sons: (P) => [{ t: P.fala(0).t1 + 0.6, som: 'corrida', dur: 3 }],
    atualizar(c, P, { camera }) {
      duelo(c, P);
      const h = c.heroi, m = c.malvar;
      m.espada.userData.lamina.forEach((x) => (x.visible = false));
      aplicar(m, POSES.ajoelhado);
      const f = P.fala(0);
      aplicar(h, POSES.apontar, 1 - S(f.t1, f.t1 + 0.6, P.t));
      if (P.t > f.t1 + 0.6) h.raiz.rotation.y = lerp(Math.PI, 0, S(f.t1 + 0.6, f.t1 + 1.4, P.t));
      // os soldados fogem; os aldeões vêm cercar o barão
      const foge = S(f.t1 + 0.4, P.dur, P.t);
      c.exercito.forEach((s, i) => {
        if (foge > 0) {
          s.raiz.rotation.y = 0;
          correr(s, P.t * 9 + i, 0.9);
          s.raiz.position.z += foge * 12;
        }
      });
      [0, 1, 2, 3].forEach((n, i) => {
        const a = c.aldeoes[n];
        a.raiz.visible = true;
        caminhar(a, [-2 + i, -8.5], [-0.9 + (i % 2) * 1.8, 1.8 + (i > 1 ? 1.4 : 0)], S(f.t1 + 1.0, P.dur, P.t), { peso: 0.3 });
        a.raiz.position.y = Math.abs(a.raiz.position.z) < 5.2 ? 0.48 : 0;
      });
      cam(camera, L([-3.6, 2.6, -4.6], [-3.0, 3.2, -5.4], S(0, 1, P.k)), [0, 0.9, 2.4], 48);
    },
  },
  {
    id: '5.5a', cap: 5, cenario: 'pedralva', falas: ['5.5.01'], antes: 1.6, depois: 0.4, fadeIn: 1.2, musica: 'aurora', ambiente: ['passaros'],
    atualizar(c, P, { camera }) {
      madrugada(c, P);
      // gente saindo do moinho; Lia corre apontando cada um
      [5, 6, 7, 9, 10, 11].forEach((n, i) => {
        const a = c.aldeoes[n];
        a.raiz.visible = true;
        caminhar(a, [10.6, -6.0], [7.5 - (i % 3) * 1.2, -8.5 - Math.floor(i / 3) * 1.1], S(i * 0.3, i * 0.3 + 3, P.t), { peso: 0.4 });
      });
      const l = c.lia;
      l.raiz.visible = true;
      caminhar(l, [7.0, -6.2], [4.0, -8.0], S(0, P.dur, P.t), { correndo: true, amplitude: 0.7 });
      aplicar(l, POSES.apontar, 0.8);
      cam(camera, [2.6, 1.3, -11.6], [7.5, 1.0, -7.4], 46);
    },
  },
  {
    id: '5.5b', cap: 5, cenario: 'pedralva', falas: ['5.5.02'], antes: 0.3, depois: 0.6, musica: 'aurora', ambiente: ['passaros'],
    atualizar(c, P, { camera }) {
      madrugada(c, P);
      const h = c.heroi, l = c.lia;
      c.naPonte(h, -2.6, 0, Math.PI);
      parado(h, P.t);
      [0, 1, 2].forEach((i) => cravar(c, c.flechasCravadas[i], h.j.tronco, [-0.1 + i * 0.1, 0.22 + i * 0.07, -0.13], [-1.7, 0.2 * (i - 1), 0]));
      l.raiz.visible = true;
      c.naPonte(l, -3.6, 0.15, 0);
      parado(l, P.t);
      l.raiz.position.y += Math.abs(Math.sin(P.t * 7)) * 0.08; // pulando
      aplicar(l, POSES.maosAoAlto, 0.6 + Math.sin(P.t * 7) * 0.2);
      const cab = c.cabecaDe(l, 0.04);
      cam(camera, [cab.x + 0.5, cab.y + 0.25, cab.z + 1.2], [cab.x, cab.y - 0.05, cab.z], 40);
    },
  },
  {
    id: '5.5c', cap: 5, cenario: 'pedralva', falas: ['5.5.03', '5.5.04', '5.5.05'], antes: 0.4, depois: 2.4, fadeOut: 2.0, musica: 'aurora', ambiente: ['passaros'],
    atualizar(c, P, { camera }) {
      madrugada(c, P);
      const h = c.heroi;
      c.naPonte(h, -2.6, 0, Math.PI);
      parado(h, P.t);
      [0, 1, 2].forEach((i) => cravar(c, c.flechasCravadas[i], h.j.tronco, [-0.1 + i * 0.1, 0.22 + i * 0.07, -0.13], [-1.7, 0.2 * (i - 1), 0]));
      const cab = c.cabecaDe(h, 0.05);
      const k = S(0, 1, P.k);
      cam(camera, [cab.x + 0.3, cab.y - 0.02, cab.z - lerp(1.1, 0.7, k)], v3(cab), 32);
    },
  },
];

function duelo(c, P, relampagos = []) {
  noiteDeChuva(c, P, relampagos);
  // tochas do exército na cabeceira da ponte iluminam os dois
  c.estado.luzes.push({ pos: [1.4, 1.9, 4.6], cor: 0xff9040, intensidade: 1.3, alcance: 6, tremula: 5 }, { pos: [-1.2, 1.7, 4.2], cor: 0xff8a3a, intensidade: 1.0, alcance: 5, tremula: 6 });
  heroiNaPonte(c, P, 1.3);
  exercito(c, P, -1.2);
  const m = c.malvar;
  m.raiz.visible = true;
  c.naPonte(m, 2.4, 0, Math.PI);
  parado(m, P.t);
  c.cavaloBarao.raiz.visible = true;
  c.cavaloBarao.raiz.position.set(1.2, 0, 8.6);
  c.cavaloBarao.raiz.rotation.set(0, Math.PI, 0);
  cavaloAndar(c.cavaloBarao, 0, 0, P.t);
}

function madrugada(c, P) {
  c.estado.clima = 'madrugada';
  c.mostrar('heroi');
  c.barricada.forEach((b) => (b.visible = true));
}
