#!/usr/bin/env node
// Vozes do filme pela ElevenLabs.
//
//   node ferramentas/vozes.mjs testar cavaleiro          confere a chave e lista os modelos
//   node ferramentas/vozes.mjs escalar cavaleiro         escolhe as vozes na biblioteca (só as que faltam)
//   node ferramentas/vozes.mjs gerar cavaleiro [--cap 1] gera um MP3 por fala (só o que mudou)
//   node ferramentas/vozes.mjs tudo cavaleiro-hd         testar + escalar + gerar
//
// Filme com imagem travada (filmes/<filme>/tempos.json = espaço de cada fala): a fala bruta fica em vozes/bruto/,
// e vozes/<id>.mp3 é ela sem o silêncio das pontas e, se passar do espaço, um pouco acelerada (sem mudar o tom);
// se precisar acelerar demais, a fala é gerada de novo com a voz mais rápida.
// "igual": "<outro papel>" no elenco usa a mesma voz de outro papel (economiza vaga de voz na conta).
//
// A chave vem de ELEVENLABS_API_KEY ou é injetada pelo proxy do ambiente (Network secret do host
// api.elevenlabs.io, cabeçalho xi-api-key).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [comando = 'testar', filme = 'cavaleiro', ...resto] = process.argv.slice(2);
const opc = (n) => {
  const i = resto.indexOf(`--${n}`);
  return i >= 0 ? resto[i + 1] : undefined;
};
const pasta = path.join(raiz, 'filmes', filme);
const arqElenco = path.join(pasta, 'elenco.json');
const arqFalas = path.join(pasta, 'falas.json');
const pastaVozes = path.join(pasta, 'vozes');
const arqDur = path.join(pastaVozes, 'duracoes.json');
const arqTempos = path.join(pasta, 'tempos.json');
const API = 'https://api.elevenlabs.io';

// sem a variável, o cabeçalho não é enviado: o proxy do ambiente coloca a chave salva
const chave = process.env.ELEVENLABS_API_KEY;

async function api(metodo, rota, corpo, { binario = false, tentativas = 5 } = {}) {
  for (let i = 0; ; i++) {
    const r = await fetch(API + rota, {
      method: metodo,
      headers: { ...(chave ? { 'xi-api-key': chave } : {}), ...(corpo ? { 'Content-Type': 'application/json' } : {}), Accept: binario ? 'audio/mpeg' : 'application/json' },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    if (r.ok) return binario ? Buffer.from(await r.arrayBuffer()) : r.json();
    const txt = await r.text();
    if ((r.status === 429 || r.status >= 500) && i < tentativas) {
      const espera = 2000 * 2 ** i;
      console.warn(`  ${r.status}, tentando de novo em ${espera / 1000}s`);
      await new Promise((ok) => setTimeout(ok, espera));
      continue;
    }
    if (r.status === 401 || r.status === 403) {
      throw new Error(`A ElevenLabs recusou a chave (${r.status}). Confira o Network secret de api.elevenlabs.io (cabeçalho xi-api-key) ou ELEVENLABS_API_KEY.\n${txt}`);
    }
    throw new Error(`ElevenLabs ${metodo} ${rota}: ${r.status}\n${txt}`);
  }
}

const lerJson = (a, padrao) => (fs.existsSync(a) ? JSON.parse(fs.readFileSync(a, 'utf8')) : padrao);
const salvarJson = (a, d) => fs.writeFileSync(a, JSON.stringify(d, null, 2) + '\n');

function duracaoMp3(arq) {
  const s = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', arq]).toString();
  return Number(s.trim());
}

async function testar() {
  const u = await api('GET', '/v1/user');
  const sub = u.subscription ?? {};
  console.log(`Chave OK. Plano: ${sub.tier ?? '?'} | créditos usados: ${sub.character_count ?? '?'} de ${sub.character_limit ?? '?'}`);
  const modelos = await api('GET', '/v1/models');
  for (const m of modelos) {
    const pt = (m.languages ?? []).some((l) => l.language_id === 'pt');
    console.log(`  ${m.model_id.padEnd(28)} ${pt ? 'pt ✓' : '    '} ${m.name}`);
  }
}

// Escolhe vozes da biblioteca compartilhada: preferência por clones profissionais de falantes do Brasil.
async function escalar() {
  const elenco = lerJson(arqElenco);
  const usados = new Set(Object.values(elenco.vozes).map((v) => v.voice_id).filter(Boolean));
  fs.mkdirSync(path.join(pastaVozes, 'amostras'), { recursive: true });
  for (const [nome, v] of Object.entries(elenco.vozes)) {
    if (v.voice_id || v.igual) continue;
    const b = v.busca;
    const candidatos = new Map();
    const consultas = [
      { gender: b.gender, age: b.age, use_cases: b.use_cases },
      { gender: b.gender, age: b.age },
      { gender: b.gender },
    ];
    for (const q of consultas) {
      for (const termo of [...b.termos, '']) {
        const p = new URLSearchParams({ page_size: '50', language: 'pt', ...q, ...(termo ? { search: termo } : {}) });
        const r = await api('GET', `/v1/shared-voices?${p}`);
        for (const c of r.voices ?? []) candidatos.set(c.voice_id, c);
      }
      if (candidatos.size >= 8) break;
    }
    const brasil = (c) => /bra[sz]il|pt-br/i.test(`${c.accent} ${c.locale} ${c.description} ${c.name}`);
    const lista = [...candidatos.values()]
      .filter((c) => !usados.has(c.voice_id))
      .map((c) => {
        const texto = `${c.name} ${c.description ?? ''} ${c.descriptive ?? ''}`.toLowerCase();
        const termos = b.termos.filter((t) => texto.includes(t.toLowerCase())).length;
        const pontos =
          (brasil(c) ? 1000 : 0) +
          (c.category === 'professional' ? 300 : 0) +
          (c.gender === b.gender ? 200 : 0) +
          (c.age === b.age ? 120 : 0) +
          (c.use_case === b.use_cases ? 80 : 0) +
          termos * 60 +
          Math.log10(1 + (c.cloned_by_count ?? 0)) * 40 +
          Math.log10(1 + (c.usage_character_count_1y ?? 0)) * 10;
        return { c, pontos };
      })
      .sort((a, z) => z.pontos - a.pontos);
    if (!lista.length) {
      console.warn(`${nome}: nenhuma voz encontrada`);
      continue;
    }
    const { c } = lista[0];
    const add = await api('POST', `/v1/voices/add/${c.public_owner_id}/${c.voice_id}`, { new_name: `Canal · ${nome}` });
    v.voice_id = add.voice_id ?? c.voice_id;
    v.escolhida = { nome: c.name, sotaque: c.accent, idade: c.age, genero: c.gender, categoria: c.category, descricao: c.description };
    v.alternativas = lista.slice(1, 6).map(({ c: a }) => ({ voice_id: a.voice_id, dono: a.public_owner_id, nome: a.name, sotaque: a.accent, descricao: a.description?.slice(0, 120) }));
    usados.add(v.voice_id);
    if (c.preview_url) {
      const r = await fetch(c.preview_url);
      if (r.ok) fs.writeFileSync(path.join(pastaVozes, 'amostras', `${nome}.mp3`), Buffer.from(await r.arrayBuffer()));
    }
    console.log(`${nome.padEnd(12)} -> ${c.name} (${c.accent ?? '?'}, ${c.age ?? '?'}, ${c.category ?? '?'})`);
    salvarJson(arqElenco, elenco);
  }
}

// tira o silêncio das pontas e, se preciso, acelera até caber no espaço; devolve a duração final
function encaixar(bruto, arq, espaco, limite = 1.18) {
  const pontas = 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.04,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.08,areverse';
  const tmp = arq + '.tmp.wav';
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', bruto, '-af', pontas, tmp]);
  const d = duracaoMp3(tmp);
  const r = espaco ? d / espaco : 1;
  const filtro = r > 1.0 ? [`atempo=${Math.min(r, limite).toFixed(4)}`] : [];
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', tmp, ...(filtro.length ? ['-af', filtro.join(',')] : []), '-c:a', 'libmp3lame', '-b:a', '192k', arq]);
  fs.rmSync(tmp);
  return { d, r, final: duracaoMp3(arq) };
}

async function gerar() {
  const elenco = lerJson(arqElenco);
  const falas = lerJson(arqFalas);
  const dur = lerJson(arqDur, {});
  const tempos = lerJson(arqTempos, null);
  const cap = opc('cap');
  const pastaBruto = path.join(pastaVozes, 'bruto');
  fs.mkdirSync(pastaBruto, { recursive: true });
  const alvo = falas.filter((f) => cap === undefined || String(f.capitulo) === cap);
  let feitas = 0, gastos = 0;
  const pedir = async (f, v, voz, modelo, ajustes) => {
    const i = falas.indexOf(f);
    const corpo = { text: f.texto, model_id: modelo, voice_settings: ajustes, previous_text: falas[i - 1]?.texto, next_text: falas[i + 1]?.texto };
    if (/turbo|flash|v3/.test(modelo)) corpo.language_code = 'pt';
    gastos += f.texto.length;
    return api('POST', `/v1/text-to-speech/${voz}?output_format=mp3_44100_128`, corpo, { binario: true });
  };
  for (const f of alvo) {
    const v = elenco.vozes[f.voz];
    const voz = v?.igual ? elenco.vozes[v.igual]?.voice_id : v?.voice_id;
    if (!voz) throw new Error(`A voz "${f.voz}" ainda não foi escolhida. Rode: node ferramentas/vozes.mjs escalar ${filme}`);
    const modelo = v.modelo ?? elenco.modelo;
    const hash = crypto.createHash('sha1').update(JSON.stringify([f.texto, voz, modelo, v.ajustes])).digest('hex').slice(0, 12);
    const arq = path.join(pastaVozes, `${f.id}.mp3`);
    if (dur[f.id]?.hash === hash && fs.existsSync(arq)) continue;
    const bruto = path.join(pastaBruto, `${f.id}.mp3`);
    fs.writeFileSync(bruto, await pedir(f, v, voz, modelo, v.ajustes));
    const espaco = tempos?.[f.id]?.dur;
    let e = encaixar(bruto, arq, espaco);
    // passou muito do espaço: gera de novo com a voz mais rápida (a ElevenLabs aceita até 1.2)
    if (e.r > 1.18) {
      const vel = Math.min(1.2, (v.ajustes?.speed ?? 1) * e.r * 1.03);
      fs.writeFileSync(bruto, await pedir(f, v, voz, modelo, { ...v.ajustes, speed: Number(vel.toFixed(2)) }));
      e = encaixar(bruto, arq, espaco, 1.3);
      if (e.r > 1.3) console.warn(`  ATENÇÃO ${f.id}: a fala não coube (${e.d.toFixed(1)} s para ${espaco.toFixed(1)} s)`);
    }
    dur[f.id] = { dur: Number(e.final.toFixed(3)), bruta: Number(e.d.toFixed(3)), espaco: espaco ?? null, hash };
    salvarJson(arqDur, dur);
    feitas++;
    const nota = espaco ? `${e.final.toFixed(1)}/${espaco.toFixed(1)}s${e.r > 1 ? ` (x${Math.min(e.r, 1.3).toFixed(2)})` : ''}` : `${e.final.toFixed(1)}s`;
    console.log(`${f.id.padEnd(7)} ${f.voz.padEnd(11)} ${nota.padEnd(18)} ${f.texto.slice(0, 50)}`);
  }
  console.log(`${feitas} falas geradas (~${gastos} créditos).`);
}

async function tudo() {
  await testar();
  await escalar();
  await gerar();
}

const comandos = { testar, escalar, gerar, tudo };
if (!comandos[comando]) {
  console.error(`Comando desconhecido: ${comando}. Use: testar | escalar | gerar | tudo`);
  process.exit(1);
}
await comandos[comando]().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
