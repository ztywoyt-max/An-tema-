#!/usr/bin/env node
// Mostra a linha do tempo de um capítulo: início, duração e falas de cada plano.
// Uso: node ferramentas/linha.mjs cavaleiro 1
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { montarLinha } from '../motor/linha.js';

globalThis.document = { createElement: () => ({ getContext: () => ({}) }) };
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [filme = 'cavaleiro', cap = '1'] = process.argv.slice(2);
const base = path.join(raiz, 'filmes', filme);
const mod = await import(path.join(base, 'filme.js'));
const falas = JSON.parse(fs.readFileSync(path.join(base, 'falas.json'), 'utf8'));
const arqDur = path.join(base, 'vozes', 'duracoes.json');
const dur = fs.existsSync(arqDur) ? JSON.parse(fs.readFileSync(arqDur, 'utf8')) : {};
const lista = mod.planos.filter((p) => cap === 'todos' || String(p.cap) === cap);
const l = montarLinha(lista, falas, dur);
for (const p of l.planos) {
  const meio = (p.inicio + p.duracao / 2).toFixed(1);
  console.log(`${p.id.padEnd(7)} ${p.inicio.toFixed(1).padStart(6)}s +${p.duracao.toFixed(1).padStart(4)}s  meio=${meio.padStart(5)}  ${p.falasT.map((f) => f.id).join(' ')}`);
}
console.log(`total ${l.duracao.toFixed(1)}s (${(l.duracao / 60).toFixed(1)} min)${Object.keys(dur).length ? '' : ' — durações estimadas (sem vozes)'}`);
