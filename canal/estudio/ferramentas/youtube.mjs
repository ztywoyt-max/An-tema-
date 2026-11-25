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

COMO POSTAR (no PC)
1. Abra studio.youtube.com com a conta do canal e clique em Criar > Enviar vídeos.
2. Escolha o arquivo ${filme}-youtube.mp4.
3. Título: copie o TÍTULO lá de cima. Descrição: copie o bloco DESCRIÇÃO inteiro, com os horários
   (eles viram os capítulos do vídeo sozinhos).
4. Miniatura: Enviar arquivo > ${filme}-miniatura-a.jpg. Se o botão estiver bloqueado, confirme o telefone
   em youtube.com/verify (uma vez só). Opcional: em "Testar e comparar", envie a A e a B e o YouTube
   escolhe a que dá mais cliques.
5. Público: "Não, não é conteúdo para crianças".
6. Conteúdo alterado: "Não" (é uma animação de ficção, sem pessoas reais nem fatos reais).
7. Clique em Mostrar mais: cole as TAGS, idioma do vídeo Português (Brasil), categoria Filmes e animação.
8. Avance até Visibilidade e escolha Público (ou Programar, para sair num dia e hora certos).
`;
const saida = path.join(raiz, 'saida', `${filme}-youtube.txt`);
fs.writeFileSync(saida, texto);
console.log(texto);
console.log(`salvo em ${saida}`);
