// Interface na tela: títulos de capítulo e caixas de diálogo, com texto em pixel duro.
import { RES } from './ps1.js';

export const FONTE_TITULO = '"Jacquard 12"';
export const FONTE_TEXTO = '"Pixelify Sans"';

const temp = document.createElement('canvas');
temp.width = RES.w;
temp.height = RES.h;
const tctx = temp.getContext('2d', { willReadFrequently: true });

export function limpar(ctx) {
  ctx.clearRect(0, 0, RES.w, RES.h);
}

/** Escreve texto sem suavização (o PS1 não tinha antialiasing), com contorno opcional. */
export function texto(ctx, str, x, y, { fonte = FONTE_TEXTO, tamanho = 12, cor = '#e8dcc4', contorno = '#000', alinhar = 'left', espaco = 0 } = {}) {
  tctx.clearRect(0, 0, RES.w, RES.h);
  tctx.font = `${tamanho}px ${fonte}`;
  tctx.textAlign = alinhar;
  tctx.textBaseline = 'alphabetic';
  tctx.letterSpacing = `${espaco}px`;
  if (contorno) {
    tctx.fillStyle = contorno;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) tctx.fillText(str, x + dx, y + dy);
  }
  tctx.fillStyle = cor;
  tctx.fillText(str, x, y);
  const img = tctx.getImageData(0, 0, RES.w, RES.h);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
  tctx.putImageData(img, 0, 0);
  ctx.drawImage(temp, 0, 0);
}

function medir(str, fonte, tamanho) {
  tctx.font = `${tamanho}px ${fonte}`;
  tctx.letterSpacing = '0px';
  return tctx.measureText(str).width;
}

const ROMANOS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** Tela de capítulo: "CAPÍTULO I" pequeno e o nome grande, com ornamento. */
export function tituloCapitulo(ctx, numero, nome) {
  const cx = RES.w / 2, cy = RES.h / 2;
  texto(ctx, `CAPÍTULO ${ROMANOS[numero] ?? numero}`, cx, cy - 20, { tamanho: 8, cor: '#9c8a70', alinhar: 'center', espaco: 2 });
  texto(ctx, nome, cx, cy + 10, { fonte: FONTE_TITULO, tamanho: 30, cor: '#ddd0b4', alinhar: 'center' });
  ctx.fillStyle = '#6e2a22';
  const w = Math.max(60, medir(nome, FONTE_TITULO, 30) * 0.8);
  ctx.fillRect(Math.round(cx - w / 2), cy + 18, Math.round(w), 1);
  ctx.fillRect(cx - 2, cy + 16, 4, 4);
}

/**
 * Caixa de diálogo estilo RPG de PS1, com efeito de máquina de escrever.
 * progresso: 0..1 (quanto do texto já apareceu).
 */
export function dialogo(ctx, falante, fala, progresso = 1) {
  const x = 20, w = RES.w - 40, h = 50, y = RES.h - h - 12;
  ctx.fillStyle = 'rgba(8, 6, 10, 0.78)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#8a7a60';
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillStyle = '#3a3026';
  ctx.fillRect(x + 2, y + 2, w - 4, 1);
  let ty = y + 15;
  if (falante) {
    texto(ctx, falante, x + 8, ty, { tamanho: 10, cor: '#c9a35a', contorno: null });
    ty += 13;
  }
  const visivel = fala.slice(0, Math.floor(fala.length * Math.min(Math.max(progresso, 0), 1)));
  const linhas = quebrar(visivel, fala, w - 16, 11);
  for (const l of linhas) {
    texto(ctx, l, x + 8, ty, { tamanho: 11, cor: '#e8dcc4', contorno: null });
    ty += 12;
  }
}

// Quebra pelo texto completo (para as palavras não pularem de linha enquanto aparecem).
function quebrar(visivel, completo, largura, tamanho) {
  const palavras = completo.split(' ');
  const linhas = [];
  let atual = '';
  for (const p of palavras) {
    const teste = atual ? atual + ' ' + p : p;
    if (medir(teste, FONTE_TEXTO, tamanho) > largura && atual) {
      linhas.push(atual);
      atual = p;
    } else atual = teste;
  }
  if (atual) linhas.push(atual);
  const saida = [];
  let resto = visivel.length;
  for (const l of linhas) {
    if (resto <= 0) break;
    saida.push(l.slice(0, resto));
    resto -= l.length + 1;
  }
  return saida;
}
