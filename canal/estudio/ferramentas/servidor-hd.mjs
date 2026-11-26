// Servidor local do motor HD (arquivos do estúdio + cache de malhas em saida/cache-hd) e o navegador.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.png': 'image/png', '.jpg': 'image/jpeg' };

export async function abrir(raiz, { largura = 1920, altura = 1080 } = {}) {
  const pastaCache = path.join(raiz, 'saida', 'cache-hd');
  fs.mkdirSync(pastaCache, { recursive: true });
  const servidor = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (url.startsWith('/cache/')) {
      const nome = url.slice(7);
      if (nome === 'indice.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(fs.readdirSync(pastaCache).filter((f) => f.endsWith('.bin')).map((f) => decodeURIComponent(f.slice(0, -4)))));
        return;
      }
      const arq = path.join(pastaCache, encodeURIComponent(nome.replace(/\.bin$/, '')) + '.bin');
      if (req.method === 'PUT') {
        const partes = [];
        req.on('data', (c) => partes.push(c));
        req.on('end', () => { fs.writeFileSync(arq, Buffer.concat(partes)); res.writeHead(204).end(); });
        return;
      }
      if (!fs.existsSync(arq)) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
      fs.createReadStream(arq).pipe(res);
      return;
    }
    const arq = path.join(raiz, url === '/' ? 'hd.html' : url);
    if (!arq.startsWith(raiz) || !fs.existsSync(arq) || fs.statSync(arq).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] ?? 'application/octet-stream' });
    fs.createReadStream(arq).pipe(res);
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const navegador = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const pagina = await navegador.newPage({ viewport: { width: Math.min(largura, 1920), height: Math.min(altura, 1080) } });
  const estado = { erro: null };
  pagina.on('console', (m) => { if (!/GPU stall|GL Driver|WebGL/.test(m.text())) console.log('[página]', m.text()); });
  pagina.on('pageerror', (e) => { estado.erro = e; console.error('[erro na página]', e.message); });
  const url = (q) => `http://127.0.0.1:${servidor.address().port}/hd.html?${new URLSearchParams(q)}`;
  const fechar = async () => { await pagina.evaluate(() => window.esperarCache?.()).catch(() => {}); await navegador.close(); servidor.close(); };
  return { pagina, url, fechar, estado };
}
