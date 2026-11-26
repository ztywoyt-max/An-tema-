// Cache de malhas prontas: o que já foi modelado fica salvo em disco (saida/cache-hd) e volta na hora.
// Mudou o modelo? Troque a versão na chave (ex.: 'damaso-v2/corpo').
import * as THREE from 'three';

const mem = new Map();
const envios = [];

export async function carregarCache() {
  try {
    const r = await fetch('/cache/indice.json');
    if (!r.ok) return;
    const lista = await r.json();
    await Promise.all(lista.map(async (k) => {
      const b = await fetch(`/cache/${encodeURIComponent(k)}.bin`);
      if (b.ok) mem.set(k, await b.arrayBuffer());
    }));
    console.log(`cache: ${mem.size} malhas`);
  } catch (e) { console.warn('cache indisponível', e.message); }
}

const TIPOS = { Float32Array, Uint16Array, Uint32Array, Int32Array, Uint8Array };
function codificar(g) {
  const partes = [];
  const cab = { at: [], idx: null };
  for (const [nome, a] of Object.entries(g.attributes)) {
    cab.at.push({ nome, tipo: a.array.constructor.name, n: a.itemSize, len: a.array.length, norm: a.normalized });
    partes.push(a.array);
  }
  if (g.index) { cab.idx = { tipo: g.index.array.constructor.name, len: g.index.array.length }; partes.push(g.index.array); }
  const json = new TextEncoder().encode(JSON.stringify(cab));
  const pad = (n) => (n + 3) & ~3;
  let total = 4 + pad(json.length);
  for (const p of partes) total += pad(p.byteLength);
  const buf = new Uint8Array(total);
  new DataView(buf.buffer).setUint32(0, json.length, true);
  buf.set(json, 4);
  let o = 4 + pad(json.length);
  for (const p of partes) { buf.set(new Uint8Array(p.buffer, p.byteOffset, p.byteLength), o); o += pad(p.byteLength); }
  return buf;
}
function decodificar(ab) {
  const len = new DataView(ab).getUint32(0, true);
  const cab = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 4, len)));
  const pad = (n) => (n + 3) & ~3;
  let o = 4 + pad(len);
  const g = new THREE.BufferGeometry();
  for (const a of cab.at) {
    const T = TIPOS[a.tipo];
    const arr = new T(ab.slice(o, o + a.len * T.BYTES_PER_ELEMENT));
    o += pad(a.len * T.BYTES_PER_ELEMENT);
    g.setAttribute(a.nome, new THREE.BufferAttribute(arr, a.n, a.norm));
  }
  if (cab.idx) {
    const T = TIPOS[cab.idx.tipo];
    g.setIndex(new THREE.BufferAttribute(new T(ab.slice(o, o + cab.idx.len * T.BYTES_PER_ELEMENT)), 1));
  }
  g.computeBoundingSphere();
  return g;
}

export function geoCache(chave, criar) {
  if (!chave) return criar();
  const b = mem.get(chave);
  if (b) return decodificar(b);
  const g = criar();
  envios.push(fetch(`/cache/${encodeURIComponent(chave)}.bin`, { method: 'PUT', body: codificar(g) }).catch(() => {}));
  return g;
}

export function esperarCache() { return Promise.all(envios); }
window.esperarCache = esperarCache;
