// Ferramentas de direção: câmera, atores andando, poses do filme.
import * as THREE from 'three';
import { parado, andar, somar, misturar, DE_PE } from '../../motor-hd/boneco.js';

export const ease = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
export const lin = (a, b, k) => a + (b - a) * k;
export const lerp3 = (a, b, k) => [lin(a[0], b[0], k), lin(a[1], b[1], k), lin(a[2], b[2], k)];
export const entre = (t, a, b) => ease((t - a) / (b - a));
const tmp = new THREE.Vector3();

// câmera parada, ou indo de A para B (k de 0 a 1); tremor = câmera na mão
export function camera(ctx, pos, alvo, { fov, tremor = 0, t = 0 } = {}) {
  const c = ctx.camera;
  c.position.set(...pos);
  if (tremor) c.position.add(tmp.set(Math.sin(t * 1.3) * 0.6 + Math.sin(t * 3.1) * 0.25, Math.sin(t * 1.7 + 1) * 0.5, Math.sin(t * 1.1 + 2) * 0.4).multiplyScalar(tremor * 0.02));
  c.lookAt(...alvo);
  if (fov && c.fov !== fov) { c.fov = fov; c.updateProjectionMatrix(); }
}
export function trilho(ctx, k, [p0, a0], [p1, a1], opc = {}) {
  const e = opc.linear ? Math.min(1, Math.max(0, k)) : ease(k);
  camera(ctx, lerp3(p0, p1, e), lerp3(a0, a1, e), opc);
}

// coloca o ator no chão do cenário
export function colocar(ctx, b, x, z, giro = 0, dy = 0) {
  const alt = ctx.cen?.altura ?? (() => 0);
  b.raiz.position.set(x, alt(x, z) + dy, z);
  b.raiz.rotation.y = giro;
}

// anda de A até B entre os tempos t0 e t1 (o rosto vira para onde anda); devolve a pose de andar ou de parado
export function caminhar(ctx, b, de, ate, t0, t1, tl, { passo = 1, bracos = 1, passada = 1.35, extra = {} } = {}) {
  const k = Math.min(1, Math.max(0, (tl - t0) / (t1 - t0)));
  const x = lin(de[0], ate[0], k), z = lin(de[1], ate[1], k);
  const giro = Math.atan2(ate[0] - de[0], ate[1] - de[1]);
  colocar(ctx, b, x, z, giro);
  const dist = Math.hypot(ate[0] - de[0], ate[1] - de[1]) * k;
  const andando = tl > t0 && tl < t1;
  const p = andando ? andar(dist / passada, { passo, bracos }) : parado(tl);
  return somar(p, extra);
}

// ---------- poses do filme ----------
// espada arrastando: braço direito solto, punho virado, a ponta riscando o chão atrás
export const ESPADA_ARRASTA = { maoD: [-75, 0, 0], antebracoD: [-10, 0, 0] };
// espada pronta (diante do corpo)
export const ESPADA_GUARDA = { bracoD: [-35, 0, 10], antebracoD: [-55, 0, 0], maoD: [0, 180, 0] };
// arco armado (mão esquerda estica o arco, direita puxa a corda até o rosto)
export const ARCO_TENSO = { bracoE: [-85, 0, 10], antebracoE: [-5, 0, 0], maoE: [0, 0, 0], bracoD: [-80, 0, -40], antebracoD: [-120, 0, 0], peito: [0, -20, 0], cabeca: [0, -25, 0] };
export const ARCO_BAIXO = { bracoE: [-30, 0, -5], antebracoE: [-20, 0, 0], bracoD: [-10, 0, -10], antebracoD: [-30, 0, 0] };
// sentado (banco da carroça): coxas para frente, joelhos dobrados
export const SENTADO = { coxaE: [-85, 0, 4], coxaD: [-85, 0, -4], pernaE: [80, 0, 0], pernaD: [80, 0, 0], peE: [-5, 0, 0], peD: [-5, 0, 0], pos: [0, -0.42, 0.05] };
// segurando as rédeas
export const REDEAS = { bracoE: [-40, 0, 8], antebracoE: [-50, 0, 0], bracoD: [-40, 0, -8], antebracoD: [-50, 0, 0] };
// segurando o bebê no colo (braços cruzados à frente)
export const COLO = { bracoE: [-30, -20, 8], antebracoE: [-95, 30, 0], bracoD: [-30, 20, -8], antebracoD: [-95, -30, 0], cabeca: [14, 0, 0] };
// empurrando (braços esticados à frente, corpo inclinado)
export const EMPURRA = { raiz: [18, 0, 0], coluna: [8, 0, 0], peito: [6, 0, 0], bracoE: [-75, 0, 8], bracoD: [-75, 0, -8], antebracoE: [-10, 0, 0], antebracoD: [-10, 0, 0], coxaE: [-30, 0, 0], pernaE: [35, 0, 0], coxaD: [18, 0, 0], pernaD: [20, 0, 0] };
// soco com a esquerda
export const SOCO = { peito: [0, 25, 0], coluna: [0, 10, 0], bracoE: [-85, 0, 20], antebracoE: [-5, 0, 0], bracoD: [-20, 0, -10], antebracoD: [-60, 0, 0] };
// golpe de espada de cima para baixo (k 0 = erguida, 1 = embaixo)
export function golpe(k) {
  return {
    bracoD: [lin(-150, -40, k), 0, lin(-10, 0, k)], antebracoD: [lin(-40, -10, k), 0, 0], maoD: [lin(-30, 10, k), 0, 0],
    peito: [lin(-8, 12, k), lin(-20, 15, k), 0], coluna: [lin(-5, 10, k), 0, 0],
  };
}
// olhar para baixo (para o próprio peito)
export const OLHA_BAIXO = { pescoco: [25, 0, 0], cabeca: [20, 0, 0] };
// mão esquerda no peito (segurando a flecha)
export const MAO_NO_PEITO = { bracoE: [-35, 0, -10], antebracoE: [-120, 20, 0], maoE: [0, 0, 0] };
// aponta / gesto de fala
export const GESTO = { bracoD: [-40, 0, -15], antebracoD: [-40, 0, 0] };
// medo (encolhido)
export const MEDO = { coluna: [12, 0, 0], peito: [8, 0, 0], pescoco: [10, 0, 0], bracoE: [-20, 0, -15], bracoD: [-20, 0, 15], antebracoE: [-70, 0, 0], antebracoD: [-70, 0, 0] };

export { parado, andar, somar, misturar, DE_PE };

// ---------- poses do Capítulo II em diante ----------
// carregando uma pedra diante do peito (braços dobrados, corpo um pouco para trás)
export const CARREGA = { bracoE: [-38, 0, 12], bracoD: [-38, 0, -12], antebracoE: [-70, 25, 0], antebracoD: [-70, -25, 0], coluna: [-6, 0, 0], peito: [-4, 0, 0] };
// sentado no chão, encostado, pernas esticadas, mãos no colo
export const SENTADO_CHAO = { coxaE: [-88, 0, 10], coxaD: [-88, 0, -10], pernaE: [8, 0, 0], pernaD: [12, 0, 0], peE: [-20, 0, 0], peD: [-20, 0, 0], coluna: [-10, 0, 0], pos: [0, -0.82, -0.1], bracoE: [-20, 0, 0], bracoD: [-20, 0, 0], antebracoE: [-50, 0, 0], antebracoD: [-50, 0, 0] };
// sentado na mureta balançando as pernas (t = tempo)
export function sentadoMureta(t) {
  return { coxaE: [-85, 0, 5], coxaD: [-85, 0, -5], pernaE: [70 + 20 * Math.sin(t * 3.1), 0, 0], pernaD: [70 + 20 * Math.sin(t * 3.1 + 2.4), 0, 0], pos: [0, -0.4, 0.05], bracoE: [-15, 0, 0], bracoD: [-15, 0, 0] };
}
// martelando uma estaca (k = fase do golpe 0..1)
export function martelo(k) {
  const g = Math.sin(k * Math.PI * 2) * 0.5 + 0.5;
  return { bracoD: [lin(-140, -50, g), 0, -10], antebracoD: [lin(-40, -15, g), 0, 0], bracoE: [-45, 0, 10], antebracoE: [-40, 0, 0], coluna: [lin(-4, 10, g), 0, 0], peito: [lin(-4, 8, g), 0, 0] };
}
// convidando (mão aberta para a porta)
export const CONVITE = { bracoE: [-45, 0, -35], antebracoE: [-20, 0, 0] };
// recusa: cabeça vira de um lado para o outro
export const recusa = (t) => ({ cabeca: [0, 18 * Math.sin(t * 5), 0] });
// curvada na bengala (velha)
export const VELHA = { coluna: [14, 0, 0], peito: [8, 0, 0], pescoco: [-12, 0, 0], cabeca: [-6, 0, 0], bracoD: [-28, 0, 12], antebracoD: [-40, 0, 0] };
// espiando (agachada atrás de algo)
export const ESPIA = { coxaE: [-60, 0, 0], coxaD: [-40, 0, 0], pernaE: [90, 0, 0], pernaD: [70, 0, 0], coluna: [20, 0, 0], peito: [10, 0, 0], pescoco: [-20, 0, 0], pos: [0, -0.3, 0] };
// riscando o capacete: mão esquerda segura o capacete, direita risca com o prego
export const RISCA = { bracoE: [-110, 0, 30], antebracoE: [-110, 0, 0], bracoD: [-95, 0, -45], antebracoD: [-95, 0, 0], pescoco: [0, 10, 0] };
// mãos na cintura (criança provocando)
export const CINTURA = { bracoE: [-10, 0, 15], bracoD: [-10, 0, -15], antebracoE: [-100, -40, 0], antebracoD: [-100, 40, 0] };
// sentada abraçando os joelhos
export const ABRACA_JOELHOS = { coxaE: [-120, 0, 8], coxaD: [-120, 0, -8], pernaE: [140, 0, 0], pernaD: [140, 0, 0], pos: [0, -0.62, -0.05], coluna: [18, 0, 0], peito: [12, 0, 0], bracoE: [-55, 0, -14], bracoD: [-55, 0, 14], antebracoE: [-70, 30, 0], antebracoD: [-70, -30, 0] };
// braço erguido, punho fechado (protesto)
export const PROTESTO = { bracoD: [-120, 0, -20], antebracoD: [-40, 0, 0], peito: [-6, 0, 0] };
// jogando água de um balde para cima
export function jogaAgua(k) { return { bracoE: [lin(-20, -150, k), 0, 10], bracoD: [lin(-20, -150, k), 0, -10], antebracoE: [-40, 0, 0], antebracoD: [-40, 0, 0], peito: [lin(10, -12, k), 0, 0] }; }
// batendo na porta / segurando algo diante do corpo
export const SEGURA_FRENTE = { bracoE: [-35, 0, 8], bracoD: [-35, 0, -8], antebracoE: [-75, 20, 0], antebracoD: [-75, -20, 0] };
