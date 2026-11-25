#!/usr/bin/env node
// Gera o arquivo para baixar no PC e enviar ao YouTube: saida/<filme>-youtube.mp4, com menos de 500 MB
// (limite de envio de arquivos do app). Duas passadas do x264 com o tamanho final fixo.
//
//   node ferramentas/exportar.mjs cavaleiro            alvo padrão: 470 MiB
//   node ferramentas/exportar.mjs cavaleiro --mb 400
//
// Truque do PS1: o vídeo é a imagem pequena (384x216) ampliada sem suavizar. Antes de codificar,
// cada bloco é reduzido ao pixel central e ampliado de novo: some o ruído da compressão anterior e os
// blocos voltam a ser lisos, o que gasta bem menos bits com a mesma nitidez.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const filme = args.find((a) => !a.startsWith('--')) ?? 'cavaleiro';
const iMb = args.indexOf('--mb');
const alvoMiB = iMb >= 0 ? Number(args[iMb + 1]) : 470;
const saida = path.join(raiz, 'saida');
const fonte = path.join(saida, `${filme}-completo.mp4`);
const final = path.join(saida, `${filme}-youtube.mp4`);
if (!fs.existsSync(fonte)) {
  console.error(`não achei ${fonte}: rode antes ferramentas/montar.mjs ${filme}`);
  process.exit(1);
}

const sonda = (q) => execFileSync('ffprobe', ['-v', 'error', ...q, '-of', 'csv=p=0', fonte]).toString().trim();
const dur = Number(sonda(['-show_entries', 'format=duration']));
const [w, h] = sonda(['-select_streams', 'v:0', '-show_entries', 'stream=width,height']).split(',').map(Number);
const audioKbps = Number(sonda(['-select_streams', 'a:0', '-show_entries', 'stream=bit_rate'])) / 1000 || 256;

// orçamento: tamanho alvo menos áudio (copiado) e 2% de folga para o contêiner
const totalKbps = (alvoMiB * 1024 * 1024 * 8) / dur / 1000;
const videoKbps = Math.min(8000, Math.floor(totalKbps * 0.98 - audioKbps));
if (videoKbps < 1500) {
  console.error(`o filme é longo demais para ${alvoMiB} MiB (${videoKbps} kbps de vídeo)`);
  process.exit(1);
}

const fator = w % 384 === 0 && h % 216 === 0 && w / 384 === h / 216 ? w / 384 : 0;
const filtro = fator > 1 ? ['-vf', `scale=384:216:flags=neighbor,scale=${w}:${h}:flags=neighbor`] : [];
const log = path.join(saida, `.x264-${filme}`);
const comum = ['-i', fonte, ...filtro, '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-b:v', `${videoKbps}k`,
  '-maxrate', `${videoKbps * 2}k`, '-bufsize', `${videoKbps * 4}k`, '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-g', '30', '-bf', '2', '-fps_mode', 'cfr', '-passlogfile', log];

console.log(`exportando ${path.basename(fonte)}: ${(dur / 60).toFixed(1)} min, vídeo ${videoKbps} kbps, alvo ${alvoMiB} MiB`);
execFileSync('ffmpeg', ['-v', 'error', '-y', ...comum, '-pass', '1', '-an', '-f', 'null', '-'], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-v', 'error', '-y', ...comum, '-pass', '2', '-c:a', 'copy', '-movflags', '+faststart', final], { stdio: 'inherit' });
for (const f of fs.readdirSync(saida)) if (f.startsWith(`.x264-${filme}`)) fs.rmSync(path.join(saida, f));

const mib = fs.statSync(final).size / 1024 / 1024;
console.log(`pronto: ${final} (${mib.toFixed(0)} MiB)`);
if (mib >= 500) console.warn('ATENÇÃO: passou de 500 MiB; rode de novo com --mb menor.');
