#!/usr/bin/env node
// Tira uma foto (PNG) de uma cena do motor HD: node ferramentas/foto-hd.mjs estilo-estrada [--t 0] [--res 1920x1080] [--q k=v&k2=v2]
// Para um filme: node ferramentas/foto-hd.mjs --q "filme=cavaleiro-hd&cap=1" --t 12.5
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrir } from './servidor-hd.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opc = (n, pad) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : pad; };
const cena = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))) ?? 'estilo-estrada';
const ts = String(opc('t', 0)).split(',').map(Number);
const res = opc('res', '1920x1080');
const [w, h] = res.split('x').map(Number);
const saida = opc('saida', path.join(raiz, 'saida', `hd-${cena}.png`));

const { pagina, url, fechar, estado } = await abrir(raiz, { largura: w, altura: h });
const qs = { cena, res };
for (const par of (opc('q') ?? '').split('&').filter(Boolean)) { const [k, v] = par.split('='); qs[k] = v ?? ''; }
await pagina.goto(url(qs));
await pagina.waitForFunction(() => window.estudio?.pronto || false, null, { timeout: 3600000, polling: 1000 }).catch((e) => { console.error(estado.erro ?? e); process.exit(1); });
fs.mkdirSync(path.dirname(saida), { recursive: true });
for (const t of ts) {
  const dataUrl = await pagina.evaluate((tt) => window.estudio.foto(tt), t);
  const arq = ts.length > 1 ? saida.replace(/\.png$/, `-${t}.png`) : saida;
  fs.writeFileSync(arq, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('foto salva:', arq);
}
await fechar();
if (estado.erro) process.exit(1);
