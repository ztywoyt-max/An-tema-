// Testa uma pose num personagem, vista de lado e de frente.
import * as O from '../motor/objetos.js';
import { figurinos } from '../filmes/cavaleiro/elenco3d.js';
import { parado, aplicar, POSES } from '../motor/personagem.js';

export default function ({ cena, camera, luzes }) {
  const q = new URLSearchParams(location.search);
  luzes.nevoa(0x2a2c34, 14, 40);
  luzes.ambiente(0x8088a0, 0x302820);
  luzes.direcional([-0.4, -0.7, -0.6], 0xfff0d8, 0.75);
  cena.add(O.chao({ largura: 20, comprimento: 20, seg: 10, repete: [5, 5] }));
  const quem = q.get('quem') ?? 'raposa', pose = q.get('pose') ?? 'arcoPronto';
  const a = figurinos[quem](), b = figurinos[quem]();
  a.raiz.position.set(-0.9, 0, 0);
  b.raiz.position.set(0.9, 0, 0);
  b.raiz.rotation.y = Math.PI / 2;
  cena.add(a.raiz, b.raiz);
  return {
    duracao: 2,
    atualizar(t) {
      for (const p of [a, b]) {
        parado(p, 0);
        aplicar(p, POSES[pose] ?? {});
        p.arco?.userData.puxar(0.7);
      }
      camera.position.set(0, 1.4, 4.2);
      camera.lookAt(0, 1.2, 0);
    },
  };
}
