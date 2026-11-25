#!/usr/bin/env node
// Renderiza uma cena do Estúdio PS1 em vídeo (MP4) ou em quadros soltos (PNG).
//
//   node render.mjs cap1-estrada                      -> saida/cap1-estrada.mp4
//   node render.mjs cap1-estrada --quadros 2,6,11     -> saida/cap1-estrada-6.0s.png ...
//   node render.mjs cap1-estrada --de 3 --ate 8 --escala 10   (trecho, em 4K)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

const raiz = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const cena = args.find((a) => !a.startsWith('--')) ?? 'cap1-estrada';
const opc = (n, padrao) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : padrao;
};
const escala = Number(opc('escala', 5));
const pastaSaida = path.join(raiz, 'saida');
fs.mkdirSync(pastaSaida, { recursive: true });

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json' };
const servidor = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const arq = path.join(raiz, url === '/' ? 'index.html' : url);
  if (!arq.startsWith(raiz) || !fs.existsSync(arq)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] ?? 'application/octet-stream' });
  fs.createReadStream(arq).pipe(res);
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const porta = servidor.address().port;

const navegador = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pagina = await navegador.newPage({ viewport: { width: 400, height: 240 } });
pagina.on('console', (m) => console.log('[página]', m.text()));
let erro = null;
pagina.on('pageerror', (e) => { erro = e; console.error('[erro na página]', e); });
await pagina.goto(`http://127.0.0.1:${porta}/index.html?cena=${cena}&render=1`);
await pagina.waitForFunction(() => window.estudio?.pronto || false, null, { timeout: 180000 }).catch((e) => {
  console.error(erro ?? e);
  process.exit(1);
});
const { duracao, fps, res } = await pagina.evaluate(() => ({ duracao: window.estudio.duracao, fps: window.estudio.fps, res: window.estudio.res }));
const tam = `${res.w}x${res.h}`;
const filtro = `vflip,scale=${res.w * escala}:${res.h * escala}:flags=neighbor`;

async function lerQuadro(t) {
  const b64 = await pagina.evaluate((tt) => window.estudio.quadro(tt), t);
  return Buffer.from(b64, 'base64');
}

function ffmpeg(argsFf) {
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', tam, ...argsFf], { stdio: ['pipe', 'inherit', 'inherit'] });
  const fim = new Promise((ok, falha) => p.on('close', (c) => (c === 0 ? ok() : falha(new Error(`ffmpeg saiu com ${c}`)))));
  return { p, fim };
}

const quadros = opc('quadros');
if (quadros) {
  for (const t of quadros.split(',').map(Number)) {
    const saida = path.join(pastaSaida, `${cena}-${t.toFixed(1)}s.png`);
    const { p, fim } = ffmpeg(['-i', '-', '-vf', filtro, '-frames:v', '1', saida]);
    p.stdin.end(await lerQuadro(t));
    await fim;
    console.log('quadro salvo:', saida);
  }
} else {
  const de = Number(opc('de', 0));
  const ate = Number(opc('ate', duracao));
  const saida = opc('saida', path.join(pastaSaida, `${cena}.mp4`));
  const { p, fim } = ffmpeg(['-r', String(fps), '-i', '-', '-vf', filtro, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', saida]);
  const total = Math.round((ate - de) * fps);
  const inicio = Date.now();
  for (let i = 0; i < total; i++) {
    const buf = await lerQuadro(de + i / fps);
    if (!p.stdin.write(buf)) await new Promise((ok) => p.stdin.once('drain', ok));
    if (i % fps === 0) process.stdout.write(`\r${i}/${total} quadros (${((Date.now() - inicio) / 1000).toFixed(0)}s)`);
  }
  p.stdin.end();
  await fim;
  console.log(`\nvídeo salvo: ${saida}`);
}

await navegador.close();
servidor.close();
if (erro) process.exit(1);
