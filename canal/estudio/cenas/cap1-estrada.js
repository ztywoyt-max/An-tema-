// O Cavaleiro Sem Armadura — Capítulo I, cena de teste.
// Tela de capítulo; depois, estrada na neblina à noite: o Enferrujado surge e caminha até a lanterna da carroça.
import * as O from '../motor/objetos.js';
import * as T from '../motor/texturas.js';
import * as H from '../motor/hud.js';
import { criarPersonagem, andar, parado } from '../motor/personagem.js';
import { ruido1, suave, lerp } from '../motor/ps1.js';

export default function ({ THREE, motor, cena, camera, luzes, hud }) {
  const alea = T.aleatorio(2026);

  // ---- clima ----
  const NEVOA = 0x1a2331;
  luzes.nevoa(NEVOA, 3, 25);
  luzes.ambiente(0x2c3a52, 0x0b0d12);
  luzes.direcional([0.25, -0.55, 0.8], 0x7286b4, 0.5); // lua, por trás (contraluz)

  // ---- terreno ----
  const curva = (z) => (z < -8 ? Math.sin((z + 8) * 0.045) * 4 : 0);
  const altura = (x, z) => {
    const dx = Math.abs(x - curva(z));
    if (dx < 2.3) return 0;
    const b = Math.min((dx - 2.3) * 0.14, 1.4);
    return b + Math.sin(x * 0.35) * Math.cos(z * 0.27) * 0.25 * Math.min(b, 1);
  };
  cena.add(O.chao({ largura: 130, comprimento: 130, seg: 84, repete: [34, 34], altura, centro: [0, -30] }));
  cena.add(O.estrada({ z0: 16, z1: -90, curva, seg: 80 }));

  const pos = (o, x, z, dy = 0) => {
    o.position.set(x, altura(x, z) + dy, z);
    cena.add(o);
    return o;
  };

  // ---- vegetação ----
  for (let z = 14; z > -80; z -= 1.6 + alea() * 1.4) {
    for (const lado of [-1, 1]) {
      if (alea() < 0.25) continue;
      const x = curva(z) + lado * (3.4 + alea() * 12);
      const a = alea() < 0.72 ? O.pinheiro(alea, 1.2) : O.arvoreSeca(alea, 1.1);
      pos(a, x, z, -0.1);
    }
  }
  for (let i = 0; i < 140; i++) {
    const z = 12 - alea() * 70;
    const lado = alea() < 0.5 ? -1 : 1;
    const x = curva(z) + lado * (1.6 + alea() * 5);
    pos(alea() < 0.7 ? O.touceira(alea) : O.arbusto(alea, 0.8), x, z);
  }
  for (let i = 0; i < 26; i++) {
    const z = 10 - alea() * 50;
    const x = curva(z) + (alea() < 0.5 ? -1 : 1) * (1.9 + alea() * 4);
    pos(O.pedra(alea), x, z);
  }

  // ---- carroça parada, com a lanterna ----
  const carroca = O.carroca(alea);
  carroca.grupo.position.set(-1.25, 0, 3.6);
  carroca.grupo.rotation.y = 0.12;
  cena.add(carroca.grupo);
  cena.updateMatrixWorld(true);
  const posChama = carroca.lanterna.grupo.localToWorld(carroca.lanterna.chama.clone());
  const haloPerto = O.halo(0xffb468, 1.1, 0.75);
  const haloLonge = O.halo(0xff9a48, 4.5, 0.16);
  haloPerto.position.copy(posChama);
  haloLonge.position.copy(posChama);
  cena.add(haloPerto, haloLonge);

  // ---- céu ----
  const lua = O.lua(9);
  lua.position.set(-14, 22, -70);
  lua.material.opacity = 0.5;
  cena.add(lua);

  const veus = [];
  for (let i = 0; i < 10; i++) {
    const v = O.veu(0x8a98b2, 8 + alea() * 8, 0.1 + alea() * 0.12);
    v.userData = { x: (alea() - 0.5) * 14, y: 0.4 + alea() * 1.1, z: 4 - alea() * 30, vel: 0.08 + alea() * 0.12 };
    cena.add(v);
    veus.push(v);
  }

  // ---- o Enferrujado ----
  const heroi = criarPersonagem({ pele: T.TONS.curtido, marcas: 296, espada: true, forte: 1.08 });
  cena.add(heroi.raiz);

  // ---- tempo ----
  const TITULO = 4; // segundos de tela de capítulo
  const VEL = 1.12, T_ANDA = 13.2, T_FREIA = 1.8, Z0 = -16.4;
  const distancia = (ts) => {
    if (ts <= 0) return 0;
    if (ts < T_ANDA) return VEL * ts;
    const tau = Math.min(ts - T_ANDA, T_FREIA);
    return VEL * T_ANDA + VEL * (tau - (tau * tau) / (2 * T_FREIA));
  };
  const velocidade = (ts) => (ts < T_ANDA ? 1 : Math.max(0, 1 - (ts - T_ANDA) / T_FREIA));
  const T_CORTE = T_ANDA + T_FREIA + 1.6; // corte para o close no capacete
  const duracao = TITULO + T_CORTE + 6;
  motor.efeitos.uExposicao.value = 1.12;

  const alvo = new THREE.Vector3();

  function atualizar(t) {
    // tela de capítulo sobre o preto
    H.limpar(hud);
    const ts = t - TITULO;
    if (t < TITULO + 0.5) {
      H.tituloCapitulo(hud, 1, 'A Estrada');
      motor.efeitos.uHudOpac.value = suave(0.3, 1.2, t) * (1 - suave(TITULO - 1.0, TITULO, t));
    } else motor.efeitos.uHudOpac.value = 0;
    motor.efeitos.uFade.value = Math.max(1 - suave(TITULO, TITULO + 2.5, t), suave(duracao - 1.2, duracao - 0.1, t));

    // lanterna tremulando
    const tremor = (ruido1(t * 5.5) - 0.5) * 0.3 + (ruido1(t * 15, 7) - 0.5) * 0.14;
    const ii = 1.55 + tremor;
    luzes.pontos([{ pos: posChama, cor: 0xffb070, intensidade: ii, alcance: 9.5 + tremor * 2 }]);
    haloPerto.material.opacity = 0.65 + tremor * 0.6;
    haloLonge.material.opacity = 0.14 + tremor * 0.1;

    // neblina flutuando
    for (const v of veus) {
      const u = v.userData;
      v.position.set(u.x + Math.sin(t * 0.05 + u.z) * 2 + t * u.vel, u.y, u.z);
    }

    // caminhada (pose em 15 quadros/s, como nos jogos da época)
    const ta = Math.floor(Math.max(ts, 0) * 15) / 15;
    const d = distancia(ta);
    const z = Z0 + distancia(ts);
    const x = 0.3 + curva(z) * 0.9;
    heroi.raiz.position.set(x, 0, z);
    const zf = Z0 + distancia(ts + 0.1);
    heroi.raiz.rotation.y = Math.atan2(0.3 + curva(zf) * 0.9 - x, zf - z + 1e-4);
    const v = velocidade(ta);
    if (v > 0.02) {
      andar(heroi, (d / 1.44) * Math.PI * 2, { amplitude: 0.35 + 0.65 * v, peso: 0.7, bracoD: 0.3 });
    } else {
      parado(heroi, ta);
    }
    // no fim, a cabeça vira devagar para a carroça
    heroi.j.cabeca.rotation.y = -0.55 * suave(T_ANDA + 2.2, T_ANDA + 3.6, ta);

    if (ts < T_CORTE) {
      // plano 1: atrás da carroça, avançando devagar e acompanhando o homem
      camera.fov = 50;
      const k = suave(0, T_CORTE, ts);
      camera.position.set(lerp(1.7, 1.2, k) + Math.sin(t * 0.3) * 0.03, lerp(1.32, 1.22, k) + Math.sin(t * 0.47) * 0.015, lerp(7.4, 5.9, k));
      const segue = suave(2, 10, ts);
      alvo.set(lerp(-0.3, x, segue), lerp(1.1, 1.35, segue), lerp(-12, z, segue));
    } else {
      // plano 2: close no capacete, com a luz da lanterna nos riscos
      camera.fov = 34;
      const k = suave(T_CORTE, duracao - TITULO, ts);
      const ang = lerp(-0.62, -0.42, k);
      const dist = lerp(1.35, 1.05, k);
      camera.position.set(x + Math.sin(ang) * dist, 1.72 + Math.sin(t * 0.6) * 0.008, z + Math.cos(ang) * dist);
      alvo.set(x - 0.03, lerp(1.7, 1.73, k), z);
    }
    camera.updateProjectionMatrix();
    camera.lookAt(alvo);
  }

  return { duracao, fps: 30, atualizar };
}
