// Roda um filme no motor HD: linha do tempo com espaço fixo para cada fala (a dublagem vem depois e cabe nele),
// cenários e atores montados uma vez, e a troca de cenário/atores/câmera a cada plano.
import * as THREE from 'three';
import { montarLinha, contexto } from '../motor/linha.js';
import { configurarNevoa } from './materiais.js';
import { criarPos } from './pos.js';

export async function montarFilme({ renderer, cena, camera, w, h, q }) {
  const nome = q.get('filme');
  const base = `./filmes/${nome}`;
  const mod = await import(`../filmes/${nome}/filme.js`);
  const falas = await (await fetch(`${base}/falas.json`)).json();
  const rt = await fetch(`${base}/tempos.json`);
  const tempos = rt.ok ? await rt.json() : {};
  const cap = q.get('cap');
  const so = q.get('planos')?.split(',');
  const todos = montarLinha(mod.planos, falas, tempos);
  let planos = todos.planos.filter((p) => cap == null || cap === 'todos' || String(p.cap) === cap);
  if (so) planos = planos.filter((p) => so.includes(p.id));
  const pos = criarPos(renderer, cena, camera, { w, h, bloom: 0.55, ao: q.get('ao') !== '0' });

  const ctx = { THREE, renderer, cena, camera, q, w, h, pos, cenarios: {}, atores: {}, tempoFilme: 0 };
  ctx.ator = (n) => ctx.atores[n];
  // monta tudo o que os planos escolhidos usam
  for (const p of planos) {
    if (p.cenario && !ctx.cenarios[p.cenario]) {
      const t0 = performance.now();
      const c = await mod.cenarios[p.cenario](ctx);
      c.grupo.visible = false;
      cena.add(c.grupo);
      if (c.base) { c.base.visible = false; cena.add(c.base); }
      ctx.cenarios[p.cenario] = c;
      console.log(`cenário ${p.cenario}: ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    }
    for (const a of p.atores ?? []) {
      if (ctx.atores[a]) continue;
      const t0 = performance.now();
      const b = await mod.elenco[a](ctx);
      b.raiz.visible = false;
      cena.add(b.raiz);
      ctx.atores[a] = b;
      console.log(`ator ${a}: ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    }
  }

  let atual = null;
  function entrar(p) {
    for (const c of Object.values(ctx.cenarios)) { c.grupo.visible = false; if (c.base) c.base.visible = false; }
    for (const a of Object.values(ctx.atores)) a.raiz.visible = false;
    const c = ctx.cenarios[p.cenario];
    ctx.cen = c;
    if (c) {
      c.grupo.visible = true;
      if (c.base) c.base.visible = true;
      const amb = c.ambiente ?? {};
      if (amb.nevoa) configurarNevoa(amb.nevoa);
      cena.fog = new THREE.FogExp2(new THREE.Color(...(amb.corNevoa ?? [0, 0, 0])), 0.01);
      cena.environment = amb.ambiente ?? null;
      cena.environmentIntensity = amb.intensidadeAmbiente ?? 1;
      cena.background = amb.fundo ?? null;
      renderer.toneMappingExposure = amb.exposicao ?? 1.3;
      Object.assign(pos.grade.uniforms.uSat, { value: amb.saturacao ?? 0.8 });
      pos.grade.uniforms.uVinheta.value = amb.vinheta ?? 0.5;
      pos.grade.uniforms.uTinta.value.set(...(amb.tinta ?? [1, 1, 1]));
      c.entrar?.(p);
    }
    for (const a of p.atores ?? []) ctx.atores[a].raiz.visible = true;
    camera.fov = p.fov ?? 38;
    camera.updateProjectionMatrix();
    p.preparar?.(ctx);
    atual = p;
  }
  function quadro(t) {
    let p = planos.find((x) => t >= x.inicio && t < x.fim) ?? planos[planos.length - 1];
    if (p !== atual) entrar(p);
    const tl = t - p.inicio;
    ctx.tempoFilme = t;
    p.quadro?.(ctx, tl, contexto(p, tl));
    ctx.cen?.atualizar?.(tl, t, p);
    ctx.cen?.seguirCamera?.(camera);
    // entrada e saída em preto
    const fi = p.fadeIn ? Math.min(1, tl / p.fadeIn) : 1, fo = p.fadeOut ? Math.min(1, (p.duracao - tl) / p.fadeOut) : 1;
    pos.grade.uniforms.uFade.value = Math.max(0, Math.min(fi, fo));
    pos.grade.uniforms.uTempo.value = t;
    pos.comp.render();
  }
  return {
    quadro,
    duracao: planos.length ? planos[planos.length - 1].fim - planos[0].inicio : 0,
    planos: planos.map((p) => ({ id: p.id, cap: p.cap, inicio: p.inicio, fim: p.fim })),
    total: todos.duracao,
  };
}
