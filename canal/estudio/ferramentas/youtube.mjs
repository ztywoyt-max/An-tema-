#!/usr/bin/env node
// Gera o texto de publicação no YouTube (título, descrição com capítulos, tags) a partir dos vídeos renderizados.
// Uso: node ferramentas/youtube.mjs cavaleiro
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filme = process.argv[2] ?? 'cavaleiro';
const mod = await import(path.join(raiz, 'filmes', filme, 'filme.js'));
const info = mod.publicacao;
const caps = [...new Set(mod.planos.map((p) => p.cap))].sort((a, b) => a - b);
const dur = (arq) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arq]).toString());
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

let t = 0;
const marcas = [];
for (const c of caps) {
  marcas.push(`${mmss(t)} ${info.capitulos[c]}`);
  t += dur(path.join(raiz, 'saida', `${filme}-cap${c}.mp4`));
}
const texto = `TÍTULO
${info.titulo}

TÍTULOS ALTERNATIVOS
${info.alternativos.map((x) => `- ${x}`).join('\n')}

DESCRIÇÃO
${info.descricao}

${marcas.join('\n')}

${info.rodape}

TAGS
${info.tags.join(', ')}

DURAÇÃO TOTAL: ${mmss(t)}
`;
const saida = path.join(raiz, 'saida', `${filme}-youtube.txt`);
fs.writeFileSync(saida, texto);
console.log(texto);
console.log(`salvo em ${saida}`);
