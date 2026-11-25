// Executa um filme: carrega cenários, escolhe o plano de cada instante, sincroniza com as falas,
// desenha caixas de diálogo e telas de título automaticamente.
import { luzes, suave } from './ps1.js';
import { montarLinha, contexto } from './linha.js';
import * as H from './hud.js';

export async function montarFilme(ctx, mod, { cap, falas, duracoes }) {
  const { THREE, motor, camera, hud } = ctx;
  const lista = mod.planos.filter((p) => cap === 'todos' || String(p.cap) === String(cap));
  if (!lista.length) throw new Error(`nenhum plano no capítulo ${cap}`);
  const linha = montarLinha(lista, falas, duracoes);

  // carrega os cenários usados neste capítulo
  const cenarios = {};
  for (const nome of new Set(lista.map((p) => p.cenario).filter(Boolean))) {
    const fabrica = mod.cenarios[nome];
    if (!fabrica) throw new Error(`cenário desconhecido: ${nome}`);
    cenarios[nome] = await (await fabrica()).default(ctx);
  }
  const vazio = new THREE.Scene();

  function quadro(t) {
    let i = linha.planos.findIndex((p) => t >= p.inicio && t < p.fim);
    if (i < 0) i = linha.planos.length - 1;
    const p = linha.planos[i];
    const tl = t - p.inicio;
    const P = contexto(p, tl);
    const c = p.cenario ? cenarios[p.cenario] : null;

    camera.fov = 50;
    if (c) {
      c.preparar?.(t, P); // volta o set ao estado padrão antes de cada plano mexer nele
      c.atualizar?.(t, P);
    } else luzes.nevoa(0x000000, 1, 2);
    p.atualizar?.(c, P, ctx);
    if (c) {
      c.cena.updateMatrixWorld(true);
      c.luz?.(t, P); // luzes por último: seguem objetos que o plano moveu
    }
    // bocas mexendo durante as falas
    if (c?.vozes) for (const [voz, ator] of Object.entries(c.vozes)) ator.falar?.(tl, !!P.falando(voz));
    camera.updateProjectionMatrix();

    // fades
    const fi = p.fadeIn ?? 0, fo = p.fadeOut ?? 0;
    let fade = p.cenario ? 0 : 1;
    if (fi > 0) fade = Math.max(fade, 1 - suave(0, fi, tl));
    if (fo > 0) fade = Math.max(fade, suave(p.duracao - fo, p.duracao, tl));
    motor.efeitos.uFade.value = fade;
    motor.efeitos.uFadeCor.value.set(p.fadeCor ?? 0x000000);
    motor.efeitos.uSepia.value = typeof p.sepia === 'function' ? p.sepia(P) : p.sepia ?? 0;
    motor.efeitos.uGrao.value = 0; // granulação desligada: ruído a cada quadro estraga a compressão do vídeo

    // interface: telas de título e caixas de diálogo
    H.limpar(hud);
    let opac = 1;
    if (p.tela) {
      const ent = p.tela.entra ?? 0.4, sai = p.tela.sai ?? 0.6;
      opac = suave(ent, ent + 0.8, tl) * (1 - suave(p.duracao - sai - 0.8, p.duracao - sai, tl));
      if (p.tela.tipo === 'capitulo') H.tituloCapitulo(hud, p.tela.n, p.tela.nome);
      else if (p.tela.tipo === 'titulo') H.tituloFilme(hud, p.tela.texto, p.tela.sub);
      else if (p.tela.tipo === 'fim') H.tituloFilme(hud, 'Fim');
    } else {
      const f = p.falasT.find((x) => x.voz !== 'narrador' && tl >= x.t0 - 0.1 && tl <= x.t1 + 0.6);
      if (f && !p.semDialogo) {
        const prog = (tl - f.t0) / Math.max(0.3, (f.t1 - f.t0) * 0.75);
        H.dialogo(hud, f.personagem ?? f.voz, f.texto, prog);
      }
      p.hud?.(hud, P);
    }
    motor.efeitos.uHudOpac.value = opac;
    motor.desenhar(c?.cena ?? vazio, camera);
  }

  return { linha, duracao: linha.duracao, quadro };
}
