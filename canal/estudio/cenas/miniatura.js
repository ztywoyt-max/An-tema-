// Miniaturas do vídeo, em resolução maior (?res=640x360, ampliar 2x = 1280x720).
//   ?v=a  a flecha cravada no peito, capacete riscado no fogo: "ELE NÃO MORRE"
//   ?v=b  close nos riscos do capacete: "O QUE ESSES RISCOS CONTAM?"
import estrada from '../cenarios/estrada.js';
import * as O from '../motor/objetos.js';
import * as H from '../motor/hud.js';
import { RES } from '../motor/ps1.js';
import { parado, aplicar, POSES } from '../motor/personagem.js';

export default function (ctx) {
  const { camera, hud, motor } = ctx;
  const v = new URLSearchParams(location.search).get('v') ?? 'a';
  const c = estrada(ctx);
  ctx.cena.add(c.cena);
  // chamas ao fundo (manchas quentes no escuro)
  const fundo = [];
  for (let i = 0; i < 7; i++) {
    const f = O.fogo(0.5 + (i % 3) * 0.2, 0xff7a2a);
    c.cena.add(f.grupo);
    fundo.push(f);
  }
  const E = RES.w / 384; // escala do texto em relação à resolução padrão

  return {
    duracao: 1,
    atualizar(t) {
      c.preparar(t);
      c.atualizar(t);
      c.mostrar('heroi');
      c.tronco.visible = false;
      c.estado.lanterna = false;
      c.estado.tocha = false;
      const h = c.heroi;
      c.pos(h, 0.2, -4.2, 0.45);
      parado(h, 0);
      const cab = c.cabecaDe(h, 0.06);
      fundo.forEach((f, i) => {
        f.grupo.position.set(cab.x - 3 + i * 1.3 + Math.sin(i * 3) * 0.6, 0.8 + (i % 3) * 0.7, cab.z - 7 - (i % 2) * 3);
        f.atualizar(0.4, i);
      });
      if (v === 'a') {
        // a flecha cravada no peito
        c.flecha.visible = true;
        h.j.tronco.add(c.flecha);
        // a ponta entra exatamente na ferida; a haste sai para a frente e para o lado
        const ang = Math.PI + 0.6, dx = Math.sin(ang), dz = Math.cos(ang);
        c.flecha.position.set(0.07 - dx * 0.34, 0.33, 0.152 - dz * 0.34);
        c.flecha.rotation.set(0.12, ang, 0);
        c.ferida.visible = true;
        aplicar(h, POSES.olharBaixo, 0.7);
        h.j.cabeca.rotation.y = 0.2;
        camera.fov = 38;
        camera.position.set(cab.x + 0.95, cab.y - 0.35, cab.z + 1.55);
        camera.lookAt(cab.x + 0.62, cab.y - 0.28, cab.z);
        c.estado.luzExtra = [
          { pos: [cab.x + 0.9, cab.y + 0.1, cab.z + 0.9], cor: 0xffa050, intensidade: 1.35, alcance: 2.4 },
          { pos: [cab.x - 0.6, cab.y + 0.3, cab.z - 0.9], cor: 0xff6a20, intensidade: 1.2, alcance: 1.8 },
        ];
      } else {
        h.j.cabeca.rotation.set(0.05, -0.35, 0);
        camera.fov = 28;
        camera.position.set(cab.x + 0.5, cab.y + 0.05, cab.z + 0.8);
        camera.lookAt(cab.x + 0.27, cab.y + 0.08, cab.z);
        c.estado.luzExtra = [{ pos: [cab.x + 0.5, cab.y + 0.25, cab.z + 0.5], cor: 0xffa860, intensidade: 1.3, alcance: 1.6 }];
      }
      c.estado.luaForte = 1;
      camera.updateProjectionMatrix();
      c.cena.updateMatrixWorld(true);
      c.luz(0.4);
      motor.efeitos.uFade.value = 0;
      motor.efeitos.uVinheta.value = 0.5;
      motor.efeitos.uExposicao.value = 1.25;

      // texto à direita, sobre uma faixa escurecida
      H.limpar(hud);
      const g = hud.createLinearGradient(RES.w * 0.48, 0, RES.w, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.35, 'rgba(0,0,0,0.55)');
      g.addColorStop(1, 'rgba(0,0,0,0.7)');
      hud.fillStyle = g;
      hud.fillRect(RES.w * 0.48, 0, RES.w * 0.52, RES.h);
      const x = RES.w * 0.6;
      const op = (tam, cor) => ({ fonte: H.FONTE_TEXTO, tamanho: Math.round(tam * E), cor, contorno: '#000' });
      if (v === 'a') {
        H.texto(hud, 'ELE NÃO', x, 98 * E, op(40, '#f4e8d0'));
        H.texto(hud, 'MORRE', x, 142 * E, op(54, '#e8432e'));
      } else {
        H.texto(hud, 'O QUE', x, 72 * E, op(32, '#f4e8d0'));
        H.texto(hud, 'ESSES', x, 104 * E, op(32, '#f4e8d0'));
        H.texto(hud, 'RISCOS', x, 142 * E, op(42, '#e8432e'));
        H.texto(hud, 'CONTAM?', x, 176 * E, op(32, '#f4e8d0'));
      }
      motor.efeitos.uHudOpac.value = 1;
    },
  };
}
