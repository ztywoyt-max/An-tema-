// Figurino de cada personagem de "O Cavaleiro Sem Armadura".
import { criarPersonagem } from '../../motor/personagem.js';
import * as R from '../../motor/roupas.js';
import * as T from '../../motor/texturas.js';

const { CORES, TONS } = R;

export const figurinos = {
  // o protagonista: só cueca de linho, capacete e espada enferrujados, descalço
  enferrujado: (op = {}) => criarPersonagem({ pele: TONS.curtido, marcas: op.marcas ?? 296, espada: true, forte: 1.08 }),

  tome: () =>
    criarPersonagem({
      pele: TONS.moreno,
      forte: 1.14,
      rosto: { idade: 'adulto', cabelo: 'curto', corCabelo: [44, 32, 24], barba: 'cheia', corBarba: [50, 36, 26], semente: 7 },
      torso: R.torsoRoupa({ tipo: 'camisa', cor: [176, 164, 136], decote: 'v', tom: TONS.moreno, avental: [84, 58, 38] }),
      braco: R.membroRoupa({ cor: [176, 164, 136] }),
      antebraco: R.membroRoupa({ cor: [176, 164, 136], corte: 0.35, tom: TONS.moreno }),
      pelve: R.panoCor([70, 56, 44], 61),
      coxa: R.membroRoupa({ cor: [70, 56, 44] }),
      canela: R.membroRoupa({ cor: [70, 56, 44], corte: 0.3, baixo: [60, 42, 30] }),
      pe: R.panoCor([52, 38, 28], 63),
      avental: [84, 58, 38],
    }),

  dalia: () =>
    criarPersonagem({
      pele: TONS.claro,
      feminino: true,
      forte: 0.92,
      rosto: { idade: 'adulto', feminino: true, cabelo: 'coque', corCabelo: [80, 50, 30], olhos: [60, 70, 50], semente: 9 },
      chapeu: 'lenco',
      corChapeu: [150, 120, 90],
      torso: R.torsoRoupa({ tipo: 'vestido', cor: [104, 72, 60], decote: 'redondo', tom: TONS.claro, corCinto: [70, 50, 40] }),
      braco: R.membroRoupa({ cor: [104, 72, 60] }),
      antebraco: R.membroRoupa({ cor: [104, 72, 60] }),
      pelve: R.panoCor([104, 72, 60], 65),
      saia: { cor: [96, 66, 54], comp: 0.86 },
      coxa: R.membroRoupa({ cor: [70, 52, 44] }),
      canela: R.membroRoupa({ cor: [70, 52, 44] }),
      pe: R.panoCor([52, 38, 28], 63),
      bebe: true,
    }),

  lia: () =>
    criarPersonagem({
      pele: TONS.claro,
      feminino: true,
      altura: 0.6,
      forte: 0.92,
      rosto: { idade: 'crianca', feminino: true, cabelo: 'longo', corCabelo: [92, 58, 34], olhos: [60, 44, 30], escala: 1.5, semente: 11 },
      torso: R.torsoRoupa({ tipo: 'vestido', cor: [120, 86, 58], decote: 'redondo', tom: TONS.claro, corCinto: [90, 64, 44] }),
      braco: R.membroRoupa({ cor: [120, 86, 58] }),
      antebraco: R.membroRoupa({ cor: [120, 86, 58], corte: 0.4, tom: TONS.claro }),
      pelve: R.panoCor([120, 86, 58], 67),
      saia: { cor: [112, 80, 54], comp: 0.6 },
    }),

  brana: () =>
    criarPersonagem({
      pele: TONS.palido,
      feminino: true,
      forte: 0.9,
      rosto: { idade: 'velho', feminino: true, cabelo: 'longo', corCabelo: [176, 172, 166], olhos: [70, 80, 90], semente: 13 },
      chapeu: 'capuz',
      corChapeu: [92, 92, 96],
      torso: R.torsoRoupa({ tipo: 'tunica', cor: [92, 92, 96], decote: null, corCinto: [60, 54, 50] }),
      braco: R.membroRoupa({ cor: [92, 92, 96] }),
      antebraco: R.membroRoupa({ cor: [92, 92, 96], corte: 0.7, tom: TONS.palido }),
      pelve: R.panoCor([84, 84, 88], 69),
      saia: { cor: [84, 84, 88], comp: 0.88 },
      coxa: R.membroRoupa({ cor: [60, 58, 60] }),
      canela: R.membroRoupa({ cor: [60, 58, 60] }),
      mao: { D: 'bengala' },
      maos: R.peleQueimada(TONS.palido),
    }),

  malvar: () =>
    criarPersonagem({
      pele: TONS.claro,
      forte: 1.05,
      rosto: { idade: 'velho', cabelo: 'curto', corCabelo: [150, 146, 140], barba: 'curta', corBarba: [140, 136, 130], olhos: [50, 60, 70], semente: 15 },
      torso: R.torsoRoupa({ tipo: 'armadura', cor: CORES.aco }),
      braco: R.membroRoupa({ cor: CORES.aco, metal: true }),
      antebraco: R.membroRoupa({ cor: CORES.aco, metal: true }),
      pelve: R.membroRoupa({ cor: [120, 122, 126], metal: true }),
      coxa: R.membroRoupa({ cor: CORES.aco, metal: true }),
      canela: R.membroRoupa({ cor: CORES.aco, metal: true }),
      pe: R.metal([110, 110, 114], 59),
      capa: { cor: CORES.vinho, comp: 1.2 },
      mao: { D: 'espadaPolida' },
    }),

  soldado: (op = {}) =>
    criarPersonagem({
      pele: op.pele ?? TONS.curtido,
      forte: 1.0,
      rosto: { idade: 'adulto', cabelo: 'curto', corCabelo: [50, 40, 30], barba: op.barba ?? 'curta', semente: op.semente ?? 17 },
      chapeu: 'elmo',
      torso: R.torsoRoupa({ tipo: 'cota', cor: [120, 122, 124] }),
      braco: R.membroRoupa({ cor: [120, 122, 124], metal: true }),
      antebraco: R.membroRoupa({ cor: [70, 56, 44] }),
      pelve: R.panoCor([70, 56, 44], 71),
      coxa: R.membroRoupa({ cor: [70, 56, 44] }),
      canela: R.membroRoupa({ cor: [70, 56, 44], corte: 0.25, baixo: [52, 38, 28] }),
      pe: R.panoCor([52, 38, 28], 63),
      tabardo: CORES.vinho,
      mao: { D: op.arma ?? 'lanca' },
    }),

  raposa: () =>
    criarPersonagem({
      pele: TONS.curtido,
      forte: 0.98,
      rosto: { idade: 'adulto', cabelo: 'curto', corCabelo: [100, 50, 26], barba: 'curta', corBarba: [110, 56, 28], olhos: [90, 70, 30], semente: 19 },
      chapeu: 'capuz',
      texChapeu: R.pelagem([150, 82, 40], 77),
      torso: R.torsoRoupa({ tipo: 'couro', cor: [86, 60, 40], decote: 'v', corCinto: [50, 36, 26] }),
      braco: R.membroRoupa({ cor: [70, 52, 38] }),
      antebraco: R.membroRoupa({ cor: [86, 60, 40] }),
      pelve: R.panoCor([54, 46, 38], 73),
      coxa: R.membroRoupa({ cor: [54, 46, 38] }),
      canela: R.membroRoupa({ cor: [54, 46, 38], corte: 0.2, baixo: [60, 44, 30] }),
      pe: R.panoCor([46, 34, 26], 63),
      mao: { E: 'arco' },
    }),

  bandido1: () =>
    criarPersonagem({
      pele: TONS.moreno,
      forte: 1.1,
      rosto: { idade: 'adulto', cabelo: 'careca', corCabelo: [30, 24, 20], barba: 'cheia', corBarba: [30, 24, 20], semente: 21 },
      chapeu: 'capuz',
      corChapeu: [44, 46, 40],
      torso: R.torsoRoupa({ tipo: 'tunica', cor: CORES.verdeMusgo, decote: 'v', tom: TONS.moreno }),
      braco: R.membroRoupa({ cor: CORES.verdeMusgo, corte: 0.6, tom: TONS.moreno }),
      pelve: R.panoCor([50, 44, 36], 75),
      coxa: R.membroRoupa({ cor: [50, 44, 36] }),
      canela: R.membroRoupa({ cor: [50, 44, 36], corte: 0.3, baixo: [46, 34, 26] }),
      pe: R.panoCor([46, 34, 26], 63),
      mao: { D: 'espadaPolida' },
    }),

  bandido2: () =>
    criarPersonagem({
      pele: TONS.claro,
      forte: 0.9,
      rosto: { idade: 'adulto', cabelo: 'longo', corCabelo: [60, 44, 30], olhos: [50, 50, 40], semente: 23 },
      torso: R.torsoRoupa({ tipo: 'tunica', cor: [96, 90, 80], decote: 'redondo', tom: TONS.claro }),
      braco: R.membroRoupa({ cor: [96, 90, 80] }),
      pelve: R.panoCor([60, 52, 44], 77),
      coxa: R.membroRoupa({ cor: [60, 52, 44] }),
      canela: R.membroRoupa({ cor: [60, 52, 44], corte: 0.3, baixo: [46, 34, 26] }),
      pe: R.panoCor([46, 34, 26], 63),
      mao: { D: 'tocha' },
    }),
};

// Aldeões genéricos de Pedralva: variações por semente (roupa, cabelo, barba, lenço, saia).
const PALETA = [[110, 80, 56], [86, 96, 70], [120, 104, 80], [96, 70, 62], [80, 84, 96], [140, 120, 90], [104, 90, 70]];
const CABELOS = [[40, 30, 22], [70, 48, 30], [110, 80, 46], [30, 26, 24], [150, 144, 136]];
figurinos.aldeao = (semente = 1) => {
  const r = T.aleatorio(semente * 977);
  const esc = (l) => l[Math.floor(r() * l.length)];
  const feminino = r() < 0.45;
  const velho = r() < 0.25;
  const tom = esc([TONS.claro, TONS.curtido, TONS.moreno, TONS.palido]);
  const roupa = esc(PALETA), calca = esc(PALETA);
  const cab = velho ? [150, 146, 140] : esc(CABELOS);
  if (feminino)
    return criarPersonagem({
      pele: tom, feminino: true, forte: 0.9 + r() * 0.1,
      rosto: { idade: velho ? 'velho' : 'adulto', feminino: true, cabelo: esc(['coque', 'longo']), corCabelo: cab, semente },
      chapeu: r() < 0.6 ? 'lenco' : undefined, corChapeu: esc(PALETA),
      torso: R.torsoRoupa({ tipo: 'vestido', cor: roupa, decote: 'redondo', tom, semente }),
      braco: R.membroRoupa({ cor: roupa }), antebraco: R.membroRoupa({ cor: roupa, corte: r() < 0.5 ? 0.5 : 1, tom }),
      pelve: R.panoCor(roupa, 80 + semente), saia: { cor: roupa.map((v) => v * 0.9), comp: 0.84 },
      pe: R.panoCor([52, 38, 28], 63),
    });
  return criarPersonagem({
    pele: tom, forte: 0.95 + r() * 0.2,
    rosto: { idade: velho ? 'velho' : 'adulto', cabelo: esc(['curto', 'curto', 'careca', 'longo']), corCabelo: cab, barba: esc([null, 'cheia', 'curta', 'bigode']), semente },
    chapeu: r() < 0.25 ? 'capuz' : undefined, corChapeu: esc(PALETA),
    torso: R.torsoRoupa({ tipo: 'tunica', cor: roupa, decote: esc(['v', 'redondo']), tom, semente }),
    braco: R.membroRoupa({ cor: roupa }), antebraco: R.membroRoupa({ cor: roupa, corte: r() < 0.5 ? 0.4 : 1, tom }),
    pelve: R.panoCor(calca, 90 + semente), coxa: R.membroRoupa({ cor: calca }),
    canela: R.membroRoupa({ cor: calca, corte: 0.3, baixo: [60, 44, 30] }), pe: R.panoCor([52, 38, 28], 63),
  });
};

// ---------- flashback (vinte anos antes) ----------
const OURO = [200, 158, 70];
figurinos.damaso = (op = {}) =>
  criarPersonagem({
    pele: TONS.curtido,
    forte: 1.08,
    capaceteNovo: !op.semArmadura || op.capaceteNovo,
    torso: op.semArmadura ? undefined : R.torsoRoupa({ tipo: 'armadura', cor: OURO }),
    braco: op.semArmadura ? undefined : R.membroRoupa({ cor: OURO, metal: true }),
    antebraco: op.semArmadura ? undefined : R.membroRoupa({ cor: OURO, metal: true }),
    pelve: op.semArmadura ? undefined : R.membroRoupa({ cor: [180, 140, 64], metal: true }),
    coxa: op.semArmadura ? undefined : R.membroRoupa({ cor: OURO, metal: true }),
    canela: op.semArmadura ? undefined : R.membroRoupa({ cor: OURO, metal: true }),
    pe: op.semArmadura ? undefined : R.metal([170, 134, 60], 81),
    capa: op.semArmadura ? undefined : { cor: [214, 208, 196], comp: 1.2 },
    mao: { D: op.espadaRuim ? 'espada' : 'espadaDourada' },
  });

figurinos.malvarJovem = () =>
  criarPersonagem({
    pele: TONS.claro,
    forte: 1.05,
    rosto: { idade: 'adulto', cabelo: 'curto', corCabelo: [54, 40, 32], barba: 'curta', corBarba: [60, 44, 34], olhos: [50, 60, 70], semente: 15 },
    torso: R.torsoRoupa({ tipo: 'tunica', cor: [92, 26, 32], decote: 'redondo', tom: TONS.claro, corCinto: [180, 140, 60] }),
    braco: R.membroRoupa({ cor: [92, 26, 32] }),
    antebraco: R.membroRoupa({ cor: [92, 26, 32] }),
    pelve: R.panoCor([40, 32, 30], 85),
    coxa: R.membroRoupa({ cor: [40, 32, 30] }),
    canela: R.membroRoupa({ cor: [40, 32, 30], corte: 0.2, baixo: [50, 36, 26] }),
    pe: R.panoCor([44, 32, 24], 63),
    capa: { cor: [120, 30, 36], comp: 1.3 },
  });

figurinos.branaJovem = () =>
  criarPersonagem({
    pele: TONS.claro,
    feminino: true,
    forte: 0.9,
    rosto: { idade: 'adulto', feminino: true, cabelo: 'longo', corCabelo: [60, 40, 28], olhos: [70, 80, 90], semente: 13 },
    torso: R.torsoRoupa({ tipo: 'vestido', cor: [120, 112, 100], decote: 'redondo', tom: TONS.claro }),
    braco: R.membroRoupa({ cor: [120, 112, 100] }),
    antebraco: R.membroRoupa({ cor: [120, 112, 100], corte: 0.45, tom: TONS.claro }),
    pelve: R.panoCor([110, 102, 92], 87),
    saia: { cor: [110, 102, 92], comp: 0.86 },
    maos: R.peleQueimada(TONS.claro, 143),
  });

// ---------- o rosto (Capítulo VI) ----------
// Dâmaso sem o capacete: um homem cansado, de barba grisalha. Com camisa, no fim.
figurinos.damasoRosto = (op = {}) =>
  criarPersonagem({
    pele: TONS.curtido,
    forte: 1.08,
    rosto: { idade: 'velho', cabelo: 'longo', corCabelo: [92, 86, 80], barba: 'cheia', corBarba: [132, 126, 118], olhos: [60, 70, 80], semente: 29 },
    torso: op.camisa ? R.torsoRoupa({ tipo: 'camisa', cor: [196, 186, 160], decote: 'v', tom: TONS.curtido }) : undefined,
    braco: op.camisa ? R.membroRoupa({ cor: [196, 186, 160] }) : undefined,
    antebraco: op.camisa ? R.membroRoupa({ cor: [196, 186, 160], corte: 0.45, tom: TONS.curtido }) : undefined,
    espada: !op.espadaNasCostas,
  });
