#!/usr/bin/env node
// Renderiza no Estúdio PS1: uma cena solta ou um capítulo de um filme, em vídeo (MP4) ou quadros (PNG).
//
//   node render.mjs cap1-estrada                         cena solta -> saida/cap1-estrada.mp4
//   node render.mjs --filme cavaleiro --cap 1            capítulo -> saida/cavaleiro-cap1.mp4 (+ .srt, + áudio)
//   node render.mjs --filme cavaleiro --cap 1 --quadros 3,10   quadros soltos em PNG
//   node render.mjs ... --de 3 --ate 8                   só um trecho
//   node render.mjs ... --escala 10                      4K (o YouTube comprime menos)
//   node render.mjs teste-elenco --q vista=rostos        parâmetros extras para a cena
//   node render.mjs ... --sem-audio                      não gera nem mistura áudio
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { legendasSrt } from './motor/linha.js';

const { chromium } = createRequire(import.meta.url)('playwright');

const raiz = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opc = (n, padrao) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : padrao;
};
const tem = (n) => args.includes(`--${n}`);
const valores = new Set(['--filme', '--cap', '--quadros', '--de', '--ate', '--escala', '--saida', '--q'].flatMap((k) => { const i = args.indexOf(k); return i >= 0 ? [args[i + 1]] : []; }));
const cena = args.find((a) => !a.startsWith('--') && !valores.has(a));
const filme = opc('filme');
const cap = opc('cap', '1');
const escala = Number(opc('escala', 5));
const nome = filme ? `${filme}-cap${cap}` : cena ?? 'cap1-estrada';
const pastaSaida = path.join(raiz, 'saida');
fs.mkdirSync(pastaSaida, { recursive: true });

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const servidor = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const arq = path.join(raiz, url === '/' ? 'index.html' : url);
  if (!arq.startsWith(raiz) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] ?? 'application/octet-stream' });
  fs.createReadStream(arq).pipe(res);
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const porta = servidor.address().port;

const navegador = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const pagina = await navegador.newPage({ viewport: { width: 400, height: 240 } });
pagina.on('console', (m) => { if (!/GPU stall|GL Driver/.test(m.text())) console.log('[página]', m.text()); });
let erro = null;
pagina.on('pageerror', (e) => { erro = e; console.error('[erro na página]', e); });
const q = new URLSearchParams(filme ? { filme, cap, render: '1' } : { cena, render: '1' });
for (const par of (opc('q') ?? '').split('&').filter(Boolean)) { const [k, v] = par.split('='); q.set(k, v ?? ''); }
await pagina.goto(`http://127.0.0.1:${porta}/index.html?${q}`);
await pagina.waitForFunction(() => window.estudio?.pronto || false, null, { timeout: 300000 }).catch((e) => {
  console.error(erro ?? e);
  process.exit(1);
});
const { duracao, fps, res, linha } = await pagina.evaluate(() => ({ duracao: window.estudio.duracao, fps: window.estudio.fps, res: window.estudio.res, linha: window.estudio.linha }));
const tam = `${res.w}x${res.h}`;
const filtro = `vflip,scale=${res.w * escala}:${res.h * escala}:flags=neighbor`;
console.log(`${nome}: ${duracao.toFixed(1)}s${linha ? `, ${linha.planos.length} planos` : ''}`);

async function lerQuadro(t) {
  const b64 = await pagina.evaluate((tt) => window.estudio.quadro(tt), t);
  return Buffer.from(b64, 'base64');
}

function ffmpeg(argsFf, entrada = true) {
  const pre = entrada ? ['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', tam] : [];
  const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...pre, ...argsFf], { stdio: ['pipe', 'inherit', 'inherit'] });
  const fim = new Promise((ok, falha) => p.on('close', (c) => (c === 0 ? ok() : falha(new Error(`ffmpeg saiu com ${c}`)))));
  return { p, fim };
}

const quadros = opc('quadros');
if (quadros) {
  for (const t of quadros.split(',').map(Number)) {
    const saida = path.join(pastaSaida, `${nome}-${t.toFixed(1)}s.png`);
    const { p, fim } = ffmpeg(['-i', '-', '-vf', filtro, '-frames:v', '1', saida]);
    p.stdin.end(await lerQuadro(t));
    await fim;
    console.log('quadro salvo:', saida);
  }
} else {
  const de = Number(opc('de', 0));
  const ate = Math.min(Number(opc('ate', duracao)), duracao);
  const final = opc('saida', path.join(pastaSaida, `${nome}.mp4`));
  const soVideo = path.join(pastaSaida, `${nome}.video.mp4`);
  const { p, fim } = ffmpeg(['-r', String(fps), '-i', '-', '-vf', filtro, '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', soVideo]);
  const total = Math.round((ate - de) * fps);
  const inicio = Date.now();
  for (let i = 0; i < total; i++) {
    const buf = await lerQuadro(de + i / fps);
    if (!p.stdin.write(buf)) await new Promise((ok) => p.stdin.once('drain', ok));
    if (i % fps === 0) process.stdout.write(`\r${i}/${total} quadros (${((Date.now() - inicio) / 1000).toFixed(0)}s)`);
  }
  p.stdin.end();
  await fim;
  process.stdout.write('\n');

  // áudio: mixado na própria página (vozes, trilha, ambiente e efeitos)
  let wav = null;
  const temAudio = await pagina.evaluate(() => typeof window.estudio.audio === 'function');
  if (temAudio && !tem('sem-audio')) {
    console.log('mixando áudio...');
    const partes = await pagina.evaluate(async ([a, b]) => window.estudio.audio(a, b), [de, ate]);
    wav = path.join(pastaSaida, `${nome}.wav`);
    fs.writeFileSync(wav, Buffer.concat(partes.map((x) => Buffer.from(x, 'base64'))));
  }
  if (wav) {
    // volume final no padrão do YouTube (-14 LUFS)
    const { fim: f2 } = ffmpeg(['-i', soVideo, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', '-movflags', '+faststart', final], false);
    await f2;
    fs.rmSync(soVideo);
  } else fs.renameSync(soVideo, final);
  console.log(`vídeo salvo: ${final}`);
  if (linha) {
    const srt = final.replace(/\.mp4$/, '.srt');
    fs.writeFileSync(srt, legendasSrt(linha, -de));
    console.log(`legendas: ${srt}`);
  }
}

await navegador.close();
servidor.close();
if (erro) process.exit(1);
