// Foto de perfil do canal: o capacete enferrujado de frente, fogo atrás, brasas nos olhos.
// Renderizar quadrada: ?res=400x400 e --escala 2 (800x800). Composição centralizada para o recorte em círculo.
import * as THREE from 'three';
import * as O from '../motor/objetos.js';
import { figurinos } from '../filmes/cavaleiro/elenco3d.js';
import { parado } from '../motor/personagem.js';

export default function ({ cena, camera, luzes, motor }) {
  const heroi = figurinos.enferrujado({ marcas: 299 });
  heroi.espada.visible = false;
  heroi.sombra.visible = false;
  cena.add(heroi.raiz);
  // fogo atrás (halo grande) e brasas subindo
  const brilho = O.halo(0xc02810, 2.6, 0.45);
  brilho.position.set(0, 1.78, -1.4);
  const brilho2 = O.halo(0xff8a30, 1.2, 0.3);
  brilho2.position.set(0, 1.8, -1.0);
  cena.add(brilho, brilho2);
  const brasas = Array.from({ length: 14 }, (_, i) => {
    const b = O.halo(i % 3 ? 0xffa040 : 0xffd080, 0.07 + (i % 4) * 0.02, 0.95);
    cena.add(b);
    return b;
  });
  // brasas dentro da fenda dos olhos
  const olhos = [-1, 1].map((s) => {
    const o = O.halo(0xffa040, 0.075, 1);
    heroi.j.cabeca.add(o);
    o.position.set(s * 0.05, 0.142, 0.185);
    return o;
  });
  return {
    duracao: 2,
    atualizar(t) {
      parado(heroi, 0.3);
      heroi.j.cabeca.rotation.set(-0.06, 0.18, 0);
      luzes.nevoa(0x12040a, 6, 14);
      luzes.ambiente(0x2a1418, 0x060204);
      luzes.direcional([0.2, -0.2, 0.95], 0xff3a1a, 0.9); // contraluz vermelho (recorta as bordas)
      luzes.pontos([
        { pos: [0.55, 1.95, 0.9], cor: 0xffc080, intensidade: 1.7, alcance: 3.0 },
        { pos: [-0.6, 1.6, 0.5], cor: 0xff6a30, intensidade: 0.5, alcance: 1.4 },
      ]);
      brasas.forEach((b, i) => {
        const f = (0.3 + i * 0.137) % 1;
        b.position.set(Math.sin(i * 2.3) * 0.6, 1.2 + f * 1.2, -0.6 - (i % 3) * 0.3);
        b.material.opacity = 0.95 * (1 - f * 0.7);
      });
      camera.fov = 26;
      camera.position.set(0.22, 1.8, 1.45);
      camera.lookAt(0, 1.74, 0);
      camera.updateProjectionMatrix();
      motor.efeitos.uVinheta.value = 0.9;
      motor.efeitos.uExposicao.value = 1.15;
    },
  };
}
