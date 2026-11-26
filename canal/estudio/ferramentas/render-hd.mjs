#!/usr/bin/env node
// Renderiza um filme do motor HD plano a plano (retomável: planos já feitos são pulados) e junta por capítulo.
//   node ferramentas/render-hd.mjs cavaleiro-hd --cap 1              1080p, 24 quadros/s
//   node ferramentas/render-hd.mjs cavaleiro-hd --cap 1 --previa     640x360 (para conferir rápido)
//   node ferramentas/render-hd.mjs cavaleiro-hd --cap 1 --planos 1.1a,1.1b --refazer
//   vários processos podem rodar juntos: cada plano é travado (p-<id>.mp4.trava) por quem o renderiza;
//   --ordem reversa começa do fim (bom para um segundo processo)
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { abrir } from './servidor-hd.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opc = (n, pad) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : pad; };
const tem = (n) => args.includes(`--${n}`);
const filme = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--previa', '--refazer'].includes(args[i - 1]))) ?? 'cavaleiro-hd';
const cap = opc('cap', 'todos');
const previa = tem('previa');
const [w, h] = (opc('res', previa ? '640x360' : '1920x1080')).split('x').map(Number);
const fps = Number(opc('fps', 24));
const pasta = path.join(raiz, 'saida', 'hd', previa ? `${filme}-previa` : filme);
fs.mkdirSync(pasta, { recursive: true });

const { pagina, url, fechar, estado } = await abrir(raiz, { largura: w, altura: h });
const q = { filme, cap, res: `${w}x${h}` };
if (opc('planos')) q.planos = opc('planos');
if (previa) q.ao = '0';
await pagina.goto(url(q));
let vigia;
await Promise.race([
  pagina.waitForFunction(() => window.estudio?.pronto || false, null, { timeout: 3600000, polling: 1000 }),
  new Promise((_, falha) => { vigia = setInterval(() => { if (estado.erro) falha(estado.erro); }, 500); }),
]).catch((e) => { console.error('parou:', e.message ?? e); process.exit(1); });
clearInterval(vigia);
const planos = await pagina.evaluate(() => window.estudio.planos);
console.log(`${planos.length} planos`);
const inicio = Date.now();
let feitos = 0;
// trava de um plano: arquivo com o PID de quem renderiza; trava de processo morto é retomada
const minhas = new Set();
process.on('exit', () => { for (const t of minhas) fs.rmSync(t, { force: true }); });
for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, () => process.exit(1));
function pegar(arq) {
  const trava = arq + '.trava';
  for (let i = 0; i < 2; i++) {
    try {
      const fd = fs.openSync(trava, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      minhas.add(trava);
      return trava;
    } catch {
      let pid = 0;
      try { pid = Number(fs.readFileSync(trava, 'utf8')); } catch { continue; }
      if (!pid) return null;
      try { process.kill(pid, 0); return null; } catch { fs.rmSync(trava, { force: true }); }
    }
  }
  return null;
}
const lista = opc('ordem') === 'reversa' ? [...planos].reverse() : planos;
for (let volta = 0; volta < 3; volta++) {
 let novos = 0;
 for (const p of lista) {
  const arq = path.join(pasta, `p-${p.id}.mp4`);
  if (fs.existsSync(arq) && (!tem('refazer') || volta > 0)) continue;
  const trava = pegar(arq);
  if (!trava) continue;
  if (fs.existsSync(arq) && !tem('refazer')) { fs.rmSync(trava, { force: true }); minhas.delete(trava); continue; }
  const q0 = Math.ceil(p.inicio * fps - 1e-6), q1 = Math.ceil(p.fim * fps - 1e-6);
  const tmp = arq + '.tmp.mp4';
  const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(fps), '-i', '-',
    '-vf', 'vflip', '-c:v', 'libx264', '-preset', previa ? 'veryfast' : 'medium', '-crf', previa ? '24' : '15', '-pix_fmt', 'yuv420p', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  const fim = new Promise((ok, falha) => ff.on('close', (c) => (c === 0 ? ok() : falha(new Error('ffmpeg ' + c)))));
  const t0 = Date.now();
  for (let k = q0; k < q1; k++) {
    const b64 = await pagina.evaluate((t) => window.estudio.quadro(t), k / fps);
    if (estado.erro) { console.error('parou no plano', p.id); process.exit(1); }
    if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise((ok) => ff.stdin.once('drain', ok));
  }
  ff.stdin.end();
  await fim;
  fs.renameSync(tmp, arq);
  fs.rmSync(trava, { force: true });
  minhas.delete(trava);
  feitos++;
  novos++;
  console.log(`${p.id}: ${q1 - q0} quadros em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
 }
 if (!novos) break;
}
await fechar();
// junta os planos por capítulo
const caps = [...new Set(planos.map((p) => p.cap))];
for (const c of caps) {
  const lista = planos.filter((p) => p.cap === c).map((p) => path.join(pasta, `p-${p.id}.mp4`));
  if (!lista.every((f) => fs.existsSync(f))) continue;
  const txt = path.join(pasta, `lista-${c}.txt`);
  fs.writeFileSync(txt, lista.map((f) => `file '${f}'`).join('\n') + '\n');
  const saida = path.join(pasta, `cap${c}.mp4`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', txt, '-c', 'copy', saida]);
  fs.rmSync(txt);
  console.log('capítulo pronto:', saida);
}
console.log(`fim: ${feitos} planos novos em ${((Date.now() - inicio) / 60000).toFixed(1)} min`);
