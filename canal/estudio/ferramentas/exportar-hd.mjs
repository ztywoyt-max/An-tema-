#!/usr/bin/env node
// Junta os planos de um filme do motor HD com o som e gera o arquivo para o YouTube, pequeno o bastante para
// o envio pelo app: saida/hd/<filme>-youtube.mp4. Duas passadas do x264 com tamanho fixo; volume acertado
// de forma linear (sem mexer na dinâmica).
//
//   node ferramentas/exportar-hd.mjs cavaleiro-hd                 alvo 280 MiB, -14 LUFS
//   node ferramentas/exportar-hd.mjs cavaleiro-hd --lufs -16      (sem vozes, o fundo não sobe tanto)
//   node ferramentas/exportar-hd.mjs cavaleiro-hd --mb 400
//
// Antes: os planos em saida/hd/<filme>/p-<id>.mp4 (render-hd.mjs), o som em saida/hd/<filme>/som.wav e a
// ordem dos planos em saida/hd/<filme>/som-tabela.json (som-hd.mjs --tabela).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opc = (n, pad) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : pad; };
const filme = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))) ?? 'cavaleiro-hd';
const alvoMiB = Number(opc('mb', 280));
const lufs = Number(opc('lufs', -14));
const pasta = path.join(raiz, 'saida', 'hd', filme);
const final = path.join(raiz, 'saida', 'hd', `${filme}-youtube.mp4`);

const { linha } = JSON.parse(fs.readFileSync(path.join(pasta, 'som-tabela.json'), 'utf8'));
const planos = linha.map((p) => path.join(pasta, `p-${p.id}.mp4`));
const faltam = planos.filter((f) => !fs.existsSync(f));
if (faltam.length) {
  console.error(`faltam ${faltam.length} planos: ${faltam.map((f) => path.basename(f)).join(', ')}`);
  process.exit(1);
}
const som = path.join(pasta, 'som.wav');
const lista = path.join(pasta, 'planos.txt');
fs.writeFileSync(lista, planos.map((f) => `file '${f}'`).join('\n') + '\n');
const dur = linha.at(-1).fim;

// volume
const alvoVolume = `I=${lufs}:TP=-1.5:LRA=11`;
const medida = spawnSync('ffmpeg', ['-hide_banner', '-i', som, '-af', `loudnorm=${alvoVolume}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
const m = JSON.parse(medida.slice(medida.lastIndexOf('{')));
const filtroAudio = `loudnorm=${alvoVolume}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
  `:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000`;
console.log(`som: ${m.input_i} LUFS, pico ${m.input_tp} dB -> ${lufs} LUFS`);

// orçamento: tamanho alvo menos o áudio e 2% de folga para o contêiner
const audioKbps = 192;
const videoKbps = Math.min(12000, Math.floor(((alvoMiB * 1024 * 1024 * 8) / dur / 1000) * 0.98 - audioKbps));
const log = path.join(pasta, '.x264');
const comum = ['-f', 'concat', '-safe', '0', '-i', lista, '-i', som, '-map', '0:v', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'slow', '-tune', 'film', '-x264-params', 'aq-mode=3:aq-strength=0.9', '-b:v', `${videoKbps}k`,
  '-maxrate', `${videoKbps * 2}k`, '-bufsize', `${videoKbps * 4}k`, '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-r', '24', '-fps_mode', 'cfr', '-g', '120', '-bf', '3', '-passlogfile', log];
console.log(`exportando: ${(dur / 60).toFixed(1)} min, ${planos.length} planos, vídeo ${videoKbps} kbps, alvo ${alvoMiB} MiB`);
execFileSync('ffmpeg', ['-v', 'error', '-y', ...comum, '-pass', '1', '-an', '-f', 'null', '-'], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-v', 'error', '-y', ...comum, '-pass', '2', '-af', filtroAudio, '-c:a', 'aac', '-b:a', `${audioKbps}k`, '-ar', '48000', '-movflags', '+faststart', final], { stdio: 'inherit' });
for (const f of fs.readdirSync(pasta)) if (f.startsWith('.x264')) fs.rmSync(path.join(pasta, f));
fs.rmSync(lista);
const mib = fs.statSync(final).size / 1024 / 1024;
console.log(`pronto: ${final} (${mib.toFixed(0)} MiB)`);
