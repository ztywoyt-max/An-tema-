#!/usr/bin/env node
// Tira uma foto (PNG) de uma cena do motor HD: node ferramentas/foto-hd.mjs estilo-estrada [--t 0] [--res 1920x1080] [--q k=v&k2=v2]
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opc = (n, pad) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : pad; };
const cena = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))) ?? 'estilo-estrada';
const t = Number(opc('t', 0));
const res = opc('res', '1920x1080');
const [w, h] = res.split('x').map(Number);
const saida = opc('saida', path.join(raiz, 'saida', `hd-${cena}.png`));

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const servidor = http.createServer((req, res2) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const arq = path.join(raiz, url === '/' ? 'hd.html' : url);
  if (!arq.startsWith(raiz) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res2.writeHead(404).end(); return; }
  res2.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] ?? 'application/octet-stream' });
  fs.createReadStream(arq).pipe(res2);
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const navegador = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pagina = await navegador.newPage({ viewport: { width: Math.min(w, 1920), height: Math.min(h, 1080) } });
let erro = null;
pagina.on('console', (m) => { if (!/GPU stall|GL Driver|WebGL/.test(m.text())) console.log('[página]', m.text()); });
pagina.on('pageerror', (e) => { erro = e; console.error('[erro na página]', e.message); });
const qs = new URLSearchParams({ cena, res });
for (const par of (opc('q') ?? '').split('&').filter(Boolean)) { const [k, v] = par.split('='); qs.set(k, v ?? ''); }
await pagina.goto(`http://127.0.0.1:${servidor.address().port}/hd.html?${qs}`);
await pagina.waitForFunction(() => window.estudio?.pronto || false, null, { timeout: 1800000, polling: 1000 }).catch((e) => { console.error(erro ?? e); process.exit(1); });
const url = await pagina.evaluate((tt) => window.estudio.foto(tt), t);
fs.mkdirSync(path.dirname(saida), { recursive: true });
fs.writeFileSync(saida, Buffer.from(url.split(',')[1], 'base64'));
console.log('foto salva:', saida);
await navegador.close();
servidor.close();
if (erro) process.exit(1);
