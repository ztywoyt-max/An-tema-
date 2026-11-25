// Foto de elenco: todos os personagens lado a lado, para conferir figurino e proporções.
import * as O from '../motor/objetos.js';
import { figurinos } from '../filmes/cavaleiro/elenco3d.js';
import { cavalo, cavaloAndar } from '../motor/animais.js';
import { parado, aplicar, POSES } from '../motor/personagem.js';

export default function ({ THREE, cena, camera, luzes }) {
  luzes.nevoa(0x2a2c34, 14, 40);
  luzes.ambiente(0x8088a0, 0x302820);
  luzes.direcional([-0.4, -0.7, -0.6], 0xfff0d8, 0.75);
  luzes.pontos([{ pos: [0, 2.5, 4], cor: 0xffc890, intensidade: 0.6, alcance: 12 }]);
  cena.add(O.chao({ largura: 40, comprimento: 40, seg: 30, repete: [10, 10] }));
  const nomes = ['enferrujado', 'tome', 'dalia', 'lia', 'brana', 'malvar', 'soldado', 'raposa', 'bandido1', 'bandido2'];
  const atores = nomes.map((n, i) => {
    const p = figurinos[n]();
    p.raiz.position.set((i - (nomes.length - 1) / 2) * 0.95, 0, 0);
    cena.add(p.raiz);
    return p;
  });
  const c = cavalo();
  c.raiz.position.set(-6.2, 0, -1);
  c.raiz.rotation.y = Math.PI / 2;
  cena.add(c.raiz);
  const vista = new URLSearchParams(location.search).get('vista') ?? 'frente';
  return {
    duracao: 4,
    atualizar(t) {
      atores.forEach((p, i) => {
        parado(p, t + i);
        if (p.arco) aplicar(p, POSES.arcoPronto, 0);
      });
      cavaloAndar(c, 0, 0, t);
      if (vista === 'frente') {
        camera.position.set(0, 1.25, 7.2);
        camera.lookAt(0, 1.0, 0);
      } else if (vista === 'rostos') {
        camera.fov = 30;
        camera.position.set(1.0, 1.65, 3.2);
        camera.lookAt(1.0, 1.5, 0);
      } else {
        camera.position.set(-4, 1.6, 5);
        camera.lookAt(-4.5, 1.0, 0);
      }
      camera.updateProjectionMatrix();
    },
  };
}
