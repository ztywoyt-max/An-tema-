// Linha do tempo de um filme: planos (tomadas) ligados às falas.
// A duração de cada fala vem do áudio gerado (duracoes.json) ou, sem áudio, de uma estimativa.
// Assim, trocar as vozes reajusta todas as cenas automaticamente.

export function estimar(f) {
  const cps = f.voz === 'narrador' ? 13.5 : 15; // caracteres por segundo
  return 0.25 + f.texto.length / cps;
}

const RESPIRO = { narrador: 0.45, outro: 0.3 };

/**
 * planos: [{ id, falas?: string[] (ids ou prefixo de cena 'cena:1.3'), antes?, depois?, min?, ... }]
 * Retorna planos com inicio/duracao e falas com t0/t1 locais.
 */
export function montarLinha(planos, falas, duracoes = {}) {
  const porId = new Map(falas.map((f) => [f.id, f]));
  const expandir = (lista = []) =>
    lista.flatMap((x) => {
      if (x.startsWith('cena:')) return falas.filter((f) => f.cena === x.slice(5)).map((f) => f.id);
      const m = x.match(/^(.+)\.\.(.+)$/); // intervalo 'a..b'
      if (m) {
        const i = falas.findIndex((f) => f.id === m[1]), j = falas.findIndex((f) => f.id === m[2]);
        return falas.slice(i, j + 1).map((f) => f.id);
      }
      return [x];
    });
  let t = 0;
  const saida = [];
  for (const p of planos) {
    const ids = expandir(p.falas);
    let local = p.antes ?? 0.6;
    const fs = ids.map((id, k) => {
      const f = porId.get(id);
      if (!f) throw new Error(`fala inexistente: ${id} (plano ${p.id})`);
      const dur = duracoes[id]?.dur ?? estimar(f);
      local += f.pausaAntes;
      const item = { ...f, t0: local, t1: local + dur, dur, real: !!duracoes[id] };
      local = item.t1 + f.pausaDepois + (k < ids.length - 1 ? RESPIRO[f.voz === 'narrador' ? 'narrador' : 'outro'] : 0);
      return item;
    });
    const duracao = Math.max(p.min ?? 0, local + (p.depois ?? 0.8));
    saida.push({ ...p, inicio: t, duracao, fim: t + duracao, falasT: fs });
    t += duracao;
  }
  return { planos: saida, duracao: t };
}

/** Utilidades de tempo dentro de um plano, para as cenas sincronizarem ações com as falas. */
export function contexto(plano, tl) {
  const fs = plano.falasT;
  return {
    t: tl,
    dur: plano.duracao,
    k: tl / plano.duracao,
    falas: fs,
    // início/fim da fala n (índice) ou por id
    fala(n) {
      return typeof n === 'number' ? fs[n] : fs.find((f) => f.id === n);
    },
    // fala ativa de uma voz agora (para mexer a boca)
    falando(voz) {
      return fs.find((f) => f.voz === voz && tl >= f.t0 && tl <= f.t1) ?? null;
    },
  };
}

/** Legendas .srt de todas as falas. */
export function legendasSrt(linha, desloc = 0) {
  const hms = (s) => {
    const ms = Math.round(s * 1000);
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), ss = Math.floor((ms % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
  };
  let n = 0;
  const blocos = [];
  for (const p of linha.planos)
    for (const f of p.falasT) {
      const a = p.inicio + f.t0 + desloc, b = p.inicio + f.t1 + desloc;
      const quem = f.voz === 'narrador' ? '' : `${f.personagem ?? f.voz}: `;
      blocos.push(`${++n}\n${hms(a)} --> ${hms(b)}\n${quem}${f.texto}\n`);
    }
  return blocos.join('\n');
}
