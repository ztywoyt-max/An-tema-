// Texturas de rostos e roupas (pixel duro, baixa resolução).
// Convenção: o centro horizontal (u=0.5) é a frente; o topo da textura é o topo da peça.
import { textura, fazerRuido, fbm, mix, mul, clamp, TONS } from './texturas.js';

export { TONS };

export const CORES = {
  linho: [190, 176, 146],
  marrom: [108, 76, 50],
  marromEscuro: [70, 50, 36],
  verdeMusgo: [72, 84, 54],
  cinza: [104, 102, 98],
  vinho: [112, 34, 38],
  azulDesbotado: [70, 86, 108],
  preto: [36, 32, 32],
  couro: [96, 64, 40],
  ouro: [196, 150, 60],
  aco: [150, 152, 156],
};

const chaveDe = (o) => JSON.stringify(o);

function tecido(px, r, x, y, cor, { dobras = true, sujeira = 0.6 } = {}) {
  let k = 0.86 + fbm(r, x / 5, y / 5, 13, 2) * 0.22;
  if ((x + y) % 2 === 0) k *= 0.97;
  if (dobras && fbm(r, x / 2.5 + 7, y / 9, 26, 2) < 0.32) k *= 0.84;
  let c = mul(cor, k);
  const s = fbm(r, x / 7 + 30, y / 7, 9, 2);
  if (s > sujeira) c = mix(c, [70, 56, 40], (s - sujeira) * 1.2);
  px(x, y, c);
}

/**
 * Rosto que envolve a cabeça (64x32). Opções:
 * tom, idade ('crianca'|'adulto'|'velho'), feminino, cabelo ('curto'|'longo'|'coque'|'careca'),
 * corCabelo, barba ('cheia'|'curta'|'bigode'|null), corBarba, boca ('fechada'|'aberta'), cicatriz
 */
export function rosto(op = {}) {
  const o = { tom: TONS.curtido, idade: 'adulto', feminino: false, cabelo: 'curto', corCabelo: [58, 42, 30], barba: null, corBarba: null, boca: 'fechada', olhos: [40, 30, 24], ...op };
  const r = fazerRuido(o.semente ?? 5);
  return textura(`rosto-${chaveDe(o)}`, 64, 32, (px, ler, w, h) => {
    const C = w / 2;
    const pele = o.tom;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let k = 0.92 + fbm(r, x / 5, y / 5, 13, 2) * 0.12;
        const dx = Math.abs(x - C);
        if (dx > 9) k *= 0.93; // lados mais escuros
        if (y > 26) k *= 0.9; // queixo/pescoço
        px(x, y, mul(pele, k));
      }
    // orelhas
    for (const ox of [C - 15, C + 15]) for (let y = 12; y < 18; y++) px(ox, y, mul(pele, 0.8));
    // sobrancelhas
    const corSob = mul(o.corCabelo, 0.8);
    for (const s of [-1, 1]) for (let i = 1; i <= 4; i++) px(C + s * (i + 1), 11 - (i === 1 && o.idade === 'velho' ? 0 : 0), corSob);
    // olhos
    for (const s of [-1, 1]) {
      const ex = C + s * 3.5;
      px(ex - 1, 13, [210, 200, 186]);
      px(ex, 13, o.olhos);
      px(ex + 1, 13, [210, 200, 186]);
      px(ex, 14, mul(pele, 0.78));
      if (o.feminino) px(ex + s, 12, [30, 22, 18]);
    }
    // nariz
    for (let y = 14; y < 19; y++) px(C + 1, y, mul(pele, 0.82));
    px(C, 18, mul(pele, 0.72));
    px(C - 1, 18, mul(pele, 0.85));
    // bochechas
    if (o.idade === 'crianca' || o.feminino) for (const s of [-1, 1]) px(C + s * 5, 17, mix(pele, [210, 110, 100], 0.35));
    // rugas
    if (o.idade === 'velho') {
      for (let i = -4; i <= 4; i += 2) px(C + i, 8, mul(pele, 0.82));
      for (const s of [-1, 1]) { px(C + s * 6, 14, mul(pele, 0.8)); px(C + s * 5, 20, mul(pele, 0.82)); }
    }
    // boca
    const corLabio = o.feminino ? mix(pele, [150, 60, 60], 0.45) : mul(pele, 0.62);
    if (o.boca === 'aberta') {
      for (let x = C - 2; x <= C + 2; x++) { px(x, 21, corLabio); px(x, 23, corLabio); }
      for (let x = C - 1; x <= C + 1; x++) px(x, 22, [28, 10, 10]);
      px(C - 2, 22, corLabio); px(C + 2, 22, corLabio);
    } else {
      for (let x = C - 2; x <= C + 2; x++) px(x, 22, corLabio);
    }
    // barba
    if (o.barba) {
      const cb = o.corBarba ?? o.corCabelo;
      for (let y = 18; y < h; y++)
        for (let x = 0; x < w; x++) {
          const dx = Math.abs(x - C);
          const boca = o.boca === 'aberta' ? y >= 21 && y <= 23 && dx <= 2 : y === 22 && dx <= 2;
          if (boca) continue;
          let dentro = false;
          if (o.barba === 'cheia') dentro = (y >= 20 && dx <= 12) || (y >= 18 && dx >= 8 && dx <= 13) || (y >= 19 && y <= 20 && dx <= 4);
          else if (o.barba === 'curta') dentro = (y >= 23 && dx <= 9) || (y === 20 && dx <= 3 && dx >= 1);
          else if (o.barba === 'bigode') dentro = y >= 19 && y <= 20 && dx <= 4;
          if (dentro) px(x, y, mul(cb, 0.82 + fbm(r, x / 1.5, y / 1.5, 42, 1) * 0.35));
        }
    }
    // cabelo
    const ch = o.corCabelo;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = Math.abs(x - C);
        const atras = dx > 18;
        let tem = false;
        if (o.cabelo === 'careca') tem = atras && y >= 10 && y <= 18;
        else if (o.cabelo === 'curto') tem = y < 6 + (dx > 12 ? 4 : 0) + (atras ? 8 : 0) + (dx < 6 ? -1 : 0);
        else if (o.cabelo === 'longo' || o.cabelo === 'coque') tem = y < 5 + (dx > 10 ? 6 : 0) + (atras ? h : 0) || (dx > 13 && y < 22);
        if (o.cabelo === 'coque') tem = y < 5 + (dx > 10 ? 5 : 0) + (atras ? 14 : 0);
        if (tem) px(x, y, mul(ch, 0.8 + fbm(r, x / 1.2, y / 3, 53, 1) * 0.4));
      }
  });
}

/**
 * Tronco vestido (64x64). tipo: 'tunica' | 'camisa' | 'vestido' | 'couro' | 'armadura' | 'cota'
 * cor, corCinto, decote ('v'|'redondo'|null), avental (cor), tom (pele do decote), brilho (armadura)
 */
export function torsoRoupa(op = {}) {
  const o = { tipo: 'tunica', cor: CORES.marrom, corCinto: CORES.couro, decote: 'v', tom: TONS.curtido, ...op };
  const r = fazerRuido(o.semente ?? 21);
  return textura(`torso-roupa-${chaveDe(o)}`, 64, 64, (px, ler, w, h) => {
    const C = w / 2;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (o.tipo === 'armadura' || o.tipo === 'cota') {
          const n = fbm(r, x / 6, y / 6, 11, 2);
          let c = mul(o.cor, 0.8 + n * 0.3);
          if (o.tipo === 'cota') {
            if ((x + (y % 2)) % 2 === 0) c = mul(c, 0.7);
          } else {
            const faixa = Math.floor(y / 9);
            if (y % 9 === 0) c = mul(c, 0.55); // juntas das placas
            if (y % 9 === 1) c = mul(c, 1.25); // brilho na borda
            if (faixa < 3 && Math.abs(x - C) < 14) c = mul(c, 1.12); // peitoral
            if ((x % 8 === 3) && y % 9 === 4) c = mix(c, [230, 220, 190], 0.6); // rebites
            if (Math.abs(x - C) < 1) c = mul(c, 1.3);
          }
          px(x, y, c);
          continue;
        }
        tecido(px, r, x, y, o.cor);
      }
    // decote
    if (o.decote && o.tipo !== 'armadura' && o.tipo !== 'cota') {
      for (let y = 0; y < 12; y++)
        for (let x = 0; x < w; x++) {
          const dx = Math.abs(x - C);
          const dentro = o.decote === 'v' ? dx < 7 - y * 0.6 : dx < 6 && y < 4 - dx * 0.2;
          if (dentro) px(x, y, mul(o.tom, 0.92));
        }
      for (let y = 0; y < 12; y++) {
        const dx = o.decote === 'v' ? Math.max(0, 7 - y * 0.6) : 0;
        if (o.decote === 'v') { px(C - dx, y, mul(o.cor, 0.7)); px(C + dx, y, mul(o.cor, 0.7)); }
      }
    }
    // cordões do vestido
    if (o.tipo === 'vestido') for (let y = 14; y < 34; y += 3) { px(C - 1, y, [40, 30, 20]); px(C + 1, y + 1, [40, 30, 20]); }
    // avental de couro na frente (ferreiro)
    if (o.avental) {
      for (let y = 6; y < h; y++)
        for (let x = 0; x < w; x++) {
          if (Math.abs(x - C) < 11 - (y < 14 ? 3 : 0)) {
            const k = 0.85 + fbm(r, x / 3 + 99, y / 3, 21, 2) * 0.3;
            let c = mul(o.avental, k);
            if (Math.abs(x - C) >= 10 - (y < 14 ? 3 : 0)) c = mul(c, 0.7);
            if (fbm(r, x / 2 + 50, y / 2, 32, 1) > 0.75) c = mix(c, [40, 36, 34], 0.5); // fuligem
            px(x, y, c);
          }
        }
    }
    // cinto
    if (o.tipo === 'tunica' || o.tipo === 'couro' || o.tipo === 'vestido') {
      for (let y = h - 6; y < h - 2; y++) for (let x = 0; x < w; x++) px(x, y, mul(o.corCinto, y === h - 6 ? 1.15 : 0.9));
      for (let y = h - 6; y < h - 2; y++) for (let x = C - 2; x <= C + 2; x++) px(x, y, [150, 130, 80]); // fivela
    }
  });
}

/** Perna/braço vestido (32x32): roupa em cima, e embaixo bota/pele conforme 'corte' (0..1). */
export function membroRoupa(op = {}) {
  const o = { cor: CORES.marrom, corte: 1, baixo: null, tom: TONS.curtido, metal: false, ...op };
  const r = fazerRuido(o.semente ?? 23);
  return textura(`membro-${chaveDe(o)}`, 32, 32, (px, ler, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (y < o.corte * h) {
          if (o.metal) {
            let c = mul(o.cor, 0.8 + fbm(r, x / 5, y / 5, 6, 2) * 0.35);
            if (y % 8 === 0) c = mul(c, 0.55);
            if (y % 8 === 1) c = mul(c, 1.25);
            px(x, y, c);
          } else tecido(px, r, x, y, o.cor);
        } else if (o.baixo) {
          let c = mul(o.baixo, 0.82 + fbm(r, x / 4, y / 4, 8, 2) * 0.3);
          if (y === Math.ceil(o.corte * h)) c = mul(c, 1.25);
          px(x, y, c);
        } else {
          px(x, y, mul(o.tom, 0.9 + fbm(r, x / 6, y / 6, 5, 2) * 0.16));
        }
      }
    if (o.corte < 1 && !o.baixo) for (let x = 0; x < w; x++) px(x, Math.floor(o.corte * h), mul(o.cor, 0.7)); // barra
  });
}

/** Pano liso genérico (saia, capa, capuz, lenço, embrulho do bebê). */
export function panoCor(cor, semente = 31, opc = {}) {
  const r = fazerRuido(semente);
  return textura(`pano-cor-${chaveDe(cor)}-${semente}-${chaveDe(opc)}`, 32, 32, (px, ler, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        tecido(px, r, x, y, cor, { sujeira: opc.sujeira ?? 0.62 });
        if (opc.barra && y > h - 3) px(x, y, mul(cor, 0.65));
        if (opc.listras && y % 8 < 2) px(x, y, mul(cor, 0.75));
      }
  });
}

/** Pele de animal (capuz do Raposa) e couro de cavalo. */
export function pelagem(cor, semente = 41, { manchas = false } = {}) {
  const r = fazerRuido(semente);
  return textura(`pelagem-${chaveDe(cor)}-${semente}-${manchas}`, 32, 32, (px, ler, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let c = mul(cor, 0.8 + fbm(r, x / 1.5, y / 4, 21, 2) * 0.35);
        if (manchas && fbm(r, x / 5 + 9, y / 5, 6, 2) > 0.62) c = mix(c, [220, 210, 196], 0.7);
        px(x, y, c);
      }
  });
}

/** Metal liso polido ou dourado (armaduras, elmos de soldado). */
export function metal(cor = CORES.aco, semente = 51, { riscos = 0 } = {}) {
  const r = fazerRuido(semente);
  return textura(`metal-${chaveDe(cor)}-${semente}-${riscos}`, 32, 32, (px, ler, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let c = mul(cor, 0.78 + fbm(r, x / 6, y / 3, 5, 2) * 0.4);
        if (y < 2) c = mul(c, 1.25);
        px(x, y, c);
      }
  });
}

/** Pele com cicatrizes antigas de queimadura (as mãos de Brana). */
export function peleQueimada(tom = TONS.palido, semente = 141) {
  const r = fazerRuido(semente);
  return textura(`pele-queimada-${tom}-${semente}`, 32, 32, (px, ler, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let c = mul(tom, 0.9 + fbm(r, x / 4, y / 4, 8, 2) * 0.15);
        const q = fbm(r, x / 3 + 20, y / 3, 11, 3);
        if (q > 0.5) c = mix(c, [170, 96, 90], clamp((q - 0.5) * 3));
        if (q > 0.68) c = mix(c, [224, 196, 186], 0.5);
        px(x, y, c);
      }
  });
}
