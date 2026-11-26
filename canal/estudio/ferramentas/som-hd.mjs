#!/usr/bin/env node
// Som de um filme do motor HD: mistura música, ambiente, efeitos (e vozes, se existirem em filmes/<filme>/vozes) num WAV,
// em trechos de ~1 min emendados com transição (o Web Audio fica lento com o filme inteiro de uma vez).
//   node ferramentas/som-hd.mjs cavaleiro-hd                  -> saida/hd/<filme>/som.wav
//   node ferramentas/som-hd.mjs cavaleiro-hd --tabela          lista os planos com música/ambiente (para conferir)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const filme = args.find((a) => !a.startsWith('--')) ?? 'cavaleiro-hd';
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const servidor = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const arq = path.join(raiz, url);
  if (!arq.startsWith(raiz) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] ?? 'application/octet-stream' });
  fs.createReadStream(arq).pipe(res);
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const nav = await chromium.launch();
const pagina = await nav.newPage();
pagina.on('console', (m) => console.log('[página]', m.text()));
pagina.on('pageerror', (e) => console.error('[erro na página]', e.message));
await pagina.goto(`http://127.0.0.1:${servidor.address().port}/som-hd.html?filme=${filme}`);
await pagina.waitForFunction(() => window.estudio?.pronto, null, { timeout: 120000 });
const pasta = path.join(raiz, 'saida', 'hd', filme);
fs.mkdirSync(pasta, { recursive: true });
if (args.includes('--tabela')) {
  const linha = await pagina.evaluate(() => window.estudio.linha());
  const antigo = await pagina.evaluate(() => window.estudio.antigo());
  fs.writeFileSync(path.join(pasta, 'som-tabela.json'), JSON.stringify({ linha, antigo }, null, 1));
  console.log('tabela:', path.join(pasta, 'som-tabela.json'));
} else {
  const dur = await pagina.evaluate(() => window.estudio.duracao);
  const linha = await pagina.evaluate(() => window.estudio.linha());
  // trechos de ~1 min cortados entre planos; cada um começa 2 s antes e os dois se fundem nesses 2 s
  const SOBRA = 2;
  const cortes = [0];
  for (const p of linha) if (p.fim - cortes.at(-1) >= 60 && dur - p.fim > 20) cortes.push(p.fim);
  cortes.push(dur);
  const t0 = Date.now();
  const trechos = [];
  for (let i = 0; i + 1 < cortes.length; i++) {
    const de = Math.max(0, cortes[i] - (i ? SOBRA : 0)), ate = cortes[i + 1];
    const partes = await pagina.evaluate(async ([a, b]) => window.estudio.audio(a, b), [de, ate]);
    const f = path.join(pasta, `som-${i}.wav`);
    fs.writeFileSync(f, Buffer.concat(partes.map((x) => Buffer.from(x, 'base64'))));
    trechos.push(f);
    console.log(`som ${de.toFixed(0)}–${ate.toFixed(0)} s (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  const { execFileSync } = await import('node:child_process');
  const entradas = trechos.flatMap((f) => ['-i', f]);
  let filtro = '', ant = '[0:a]';
  for (let i = 1; i < trechos.length; i++) {
    const sai = i === trechos.length - 1 ? '[saida]' : `[x${i}]`;
    filtro += `${ant}[${i}:a]acrossfade=d=${SOBRA}:c1=qsin:c2=qsin${sai};`;
    ant = sai;
  }
  const destino = path.join(pasta, 'som.wav');
  if (trechos.length > 1) execFileSync('ffmpeg', ['-v', 'error', '-y', ...entradas, '-filter_complex', filtro.slice(0, -1), '-map', '[saida]', '-c:a', 'pcm_s16le', destino]);
  else fs.copyFileSync(trechos[0], destino);
  for (const f of trechos) fs.rmSync(f);
  console.log('som:', path.join(pasta, 'som.wav'), `${dur.toFixed(1)} s`);
}
await nav.close();
servidor.close();
