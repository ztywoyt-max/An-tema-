// Miniatura do vídeo: close do capacete riscado na luz da lanterna, com o título em cima.
import estrada from '../cenarios/estrada.js';
import * as H from '../motor/hud.js';
import { parado } from '../motor/personagem.js';

export default function (ctx) {
  const { camera, hud, motor } = ctx;
  const c = estrada(ctx);
  ctx.cena.add(c.cena);
  return {
    duracao: 1,
    atualizar(t) {
      c.preparar(t);
      c.atualizar(t);
      c.mostrar('heroi', 'carroca');
      c.tronco.visible = false;
      c.carroca.grupo.position.set(-1.0, 0, -2.0);
      c.pos(c.heroi, 0.15, -4.2, 0.35);
      parado(c.heroi, 0);
      c.heroi.j.cabeca.rotation.set(0.05, -0.25, 0);
      const cab = c.cabecaDe(c.heroi, 0.06);
      camera.fov = 30;
      camera.position.set(cab.x + 0.55, cab.y + 0.02, cab.z + 0.95);
      camera.lookAt(cab.x + 0.3, cab.y + 0.02, cab.z);
      c.estado.luzExtra = [{ pos: [cab.x + 0.45, cab.y + 0.2, cab.z + 0.55], cor: 0xffa860, intensidade: 1.25, alcance: 1.6 }];
      camera.updateProjectionMatrix();
      c.cena.updateMatrixWorld(true);
      c.luz(0.4);
      motor.efeitos.uFade.value = 0;
      motor.efeitos.uVinheta.value = 0.9;
      H.limpar(hud);
      H.texto(hud, 'ELE NÃO', 222, 88, { fonte: H.FONTE_TEXTO, tamanho: 34, cor: '#f2e6cc', contorno: '#000' });
      H.texto(hud, 'PODE', 222, 120, { fonte: H.FONTE_TEXTO, tamanho: 34, cor: '#f2e6cc', contorno: '#000' });
      H.texto(hud, 'MORRER', 222, 156, { fonte: H.FONTE_TEXTO, tamanho: 42, cor: '#e0402c', contorno: '#000' });
      motor.efeitos.uHudOpac.value = 1;
    },
  };
}
