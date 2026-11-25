#!/usr/bin/env node
// Renderiza todos os capítulos de um filme e monta o vídeo final (MP4 + legendas .srt).
//
//   node ferramentas/montar.mjs cavaleiro            renderiza os capítulos que faltam e monta
//   node ferramentas/montar.mjs cavaleiro --tudo     renderiza tudo de novo
//   node ferramentas/montar.mjs cavaleiro --escala 10   em 4K (melhor qualidade no YouTube)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const filme = args.find((a) => !a.startsWith('--')) ?? 'cavaleiro';
const tudo = args.includes('--tudo');
const iEsc = args.indexOf('--escala');
const escala = iEsc >= 0 ? args[iEsc + 1] : '5';
const mod = await import(path.join(raiz, 'filmes', filme, 'filme.js'));
const caps = [...new Set(mod.planos.map((p) => p.cap))].sort((a, b) => a - b);
const saida = path.join(raiz, 'saida');

const dur = (arq) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arq]).toString());

for (const cap of caps) {
  const arq = path.join(saida, `${filme}-cap${cap}.mp4`);
  if (!tudo && fs.existsSync(arq)) {
    console.log(`capítulo ${cap}: já existe`);
    continue;
  }
  console.log(`capítulo ${cap}: renderizando...`);
  const extra = args.includes('--legendas') ? ['--legendas'] : [];
  const r = spawnSync('node', [path.join(raiz, 'render.mjs'), '--filme', filme, '--cap', String(cap), '--escala', escala, ...extra], { stdio: ['ignore', 'ignore', 'inherit'] });
  if (r.status !== 0) {
    console.error(`falhou no capítulo ${cap}`);
    process.exit(1);
  }
}

// junta os vídeos (mesmos parâmetros de codificação: cópia direta)
const lista = path.join(saida, `${filme}-lista.txt`);
fs.writeFileSync(lista, caps.map((c) => `file '${filme}-cap${c}.mp4'`).join('\n') + '\n');
const final = path.join(saida, `${filme}-completo.mp4`);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', '-movflags', '+faststart', final]);
fs.rmSync(lista);

// junta as legendas, deslocando cada capítulo
const hms = (s) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), ss = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
const seg = (t) => {
  const [h, m, r] = t.split(':');
  const [s, ms] = r.split(',');
  return +h * 3600 + +m * 60 + +s + +ms / 1000;
};
let desloc = 0, n = 0;
const blocos = [];
for (const cap of caps) {
  const v = path.join(saida, `${filme}-cap${cap}.mp4`);
  const srt = v.replace(/\.mp4$/, '.srt');
  if (fs.existsSync(srt)) {
    for (const b of fs.readFileSync(srt, 'utf8').split(/\n\n+/).filter((x) => x.trim())) {
      const [, tempos, ...texto] = b.split('\n');
      const [a, z] = tempos.split(' --> ');
      blocos.push(`${++n}\n${hms(seg(a) + desloc)} --> ${hms(seg(z) + desloc)}\n${texto.join('\n')}\n`);
    }
  }
  desloc += dur(v);
}
if (blocos.length) {
  fs.writeFileSync(final.replace(/\.mp4$/, '.srt'), blocos.join('\n'));
  console.log(`legendas: ${final.replace(/\.mp4$/, '.srt')}`);
}
console.log(`filme completo: ${final} (${(desloc / 60).toFixed(1)} min)`);
if (desloc > 25 * 60) console.warn(`ATENÇÃO: o filme passou de 25 minutos (${(desloc / 60).toFixed(1)} min). O limite combinado é 25.`);
