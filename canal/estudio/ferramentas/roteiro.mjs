// Lê um roteiro em Markdown e extrai as falas (narração e personagens) em ordem.
//
//   > **NARRAÇÃO:** texto            -> voz "narrador" (linhas "> " seguintes continuam a narração)
//   💬 **Nome:** "texto"             -> voz do personagem (ver NOMES)
//   (pausa)                          -> silêncio antes/depois da fala
//   (qualquer outra coisa)           -> indicação de cena, não é falada
//
// Uso: node ferramentas/roteiro.mjs ../roteiros/01-o-cavaleiro-sem-armadura.md filmes/cavaleiro/falas.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const NOMES = {
  'Narração': 'narrador',
  'Enferrujado': 'enferrujado',
  'Dâmaso': 'enferrujado',
  'Lia': 'lia',
  'Tomé': 'tome',
  'Brana': 'brana',
  'Mulher': 'brana', // é ela no passado: a mesma voz é uma pista para quem prestar atenção
  'Malvar': 'malvar',
  'Raposa': 'raposa',
  'Bandido 1': 'bandido1',
  'Bandido 2': 'bandido2',
  'Soldado': 'soldado',
  'Aldeão': 'aldeao',
};

const PAUSA = 1.2; // segundos de um "(pausa)"

export function lerRoteiro(md) {
  const falas = [];
  let cena = 'ab';
  let capitulo = 0;
  const cont = {};
  const nova = (voz, texto, pausaAntes) => {
    texto = texto.replace(/\s+/g, ' ').trim();
    if (!texto) return;
    cont[cena] = (cont[cena] ?? 0) + 1;
    falas.push({ id: `${cena}.${String(cont[cena]).padStart(2, '0')}`, cena, capitulo, voz, texto, pausaAntes, pausaDepois: 0 });
  };
  // quebra um trecho em pedaços separados por (pausa)
  const comPausas = (voz, trecho) => {
    const partes = trecho.split(/\(pausa\)/i);
    partes.forEach((p, i) => {
      const limpo = p.replace(/\([^)]*\)/g, '').replace(/^["“\s]+|["”\s]+$/g, '');
      if (i > 0 && falas.length) falas.at(-1).pausaDepois += PAUSA;
      nova(voz, limpo, 0);
    });
  };
  let emNarracao = false;
  for (const linhaBruta of md.split('\n')) {
    const linha = linhaBruta.trim();
    let m;
    if ((m = linha.match(/^## CAP[ÍI]TULO ([IVX]+)/))) {
      capitulo = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'].indexOf(m[1]);
      cena = `${capitulo}.0`;
      emNarracao = false;
      continue;
    }
    if ((m = linha.match(/^### Cena (\d+\.\d+)/))) {
      cena = m[1];
      emNarracao = false;
      continue;
    }
    if (linha.startsWith('## ')) {
      emNarracao = false;
      if (/notas/i.test(linha)) break;
      continue;
    }
    if (linha.startsWith('>')) {
      let texto = linha.replace(/^>\s?/, '');
      const ehNarr = /^\*\*NARRA[ÇC][ÃA]O:\*\*/.test(texto);
      if (ehNarr) {
        texto = texto.replace(/^\*\*NARRA[ÇC][ÃA]O:\*\*\s*/, '');
        emNarracao = true;
      }
      if (emNarracao) {
        if (/^\(pausa\)$/i.test(texto.trim())) {
          if (falas.length) falas.at(-1).pausaDepois += PAUSA;
        } else comPausas('narrador', texto);
      }
      continue;
    }
    emNarracao = false;
    if ((m = linha.match(/^💬\s*\*\*([^*:]+):\*\*\s*(.*)$/))) {
      const voz = NOMES[m[1].trim()];
      if (!voz) throw new Error(`Personagem sem voz definida: ${m[1]}`);
      const resto = m[2];
      const pausaAntes = /^\(pausa\)/i.test(resto) ? PAUSA : 0;
      const texto = resto.replace(/^\([^)]*\)\s*/, '');
      const antes = falas.length;
      comPausas(voz, texto);
      if (falas.length > antes) falas[antes].pausaAntes += pausaAntes;
      falas.slice(antes).forEach((f) => (f.personagem = m[1].trim()));
    }
  }
  return falas;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [entrada, saida] = process.argv.slice(2);
  const falas = lerRoteiro(fs.readFileSync(entrada, 'utf8'));
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  fs.writeFileSync(saida, JSON.stringify(falas, null, 1));
  const porVoz = {};
  for (const f of falas) porVoz[f.voz] = (porVoz[f.voz] ?? 0) + f.texto.length;
  console.log(`${falas.length} falas -> ${saida}`);
  console.log('caracteres por voz:', porVoz, 'total:', Object.values(porVoz).reduce((a, b) => a + b, 0));
}
