// Testa a legibilidade das fontes em pixel duro.
import * as H from '../motor/hud.js';
export default function ({ hud, motor }) {
  return {
    duracao: 1,
    atualizar() {
      H.limpar(hud);
      motor.efeitos.uFade.value = 1;
      let y = 16;
      const testes = [['"Pixelify Sans"', 16], ['"Jersey 10"', 10], ['"Jersey 10"', 20], ['"Jersey 15"', 15], ['"Jersey 15"', 16]];
      for (const [f, tam] of testes) {
        H.texto(hud, `${tam} Brana Bandido Brumal: quebra, alguém, você, feriu, decide. Lia ii`, 6, y, { fonte: f, tamanho: tam, cor: '#e8dcc4', contorno: null });
        y += tam + 10;
      }
    },
  };
}
