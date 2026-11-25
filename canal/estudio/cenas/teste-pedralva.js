// Vistas de teste da aldeia em vários climas: ?clima=dia&vista=0
import pedralva from '../cenarios/pedralva.js';

export default function (ctx) {
  const q = new URLSearchParams(location.search);
  const c = pedralva(ctx);
  ctx.cena.add(c.cena);
  const vistas = [
    [[6, 4.5, 16], [-1, 1, -10]],
    [[-2, 1.7, -4], [2, 1.4, -20]],
    [[12, 3, -2], [-8, 1, -9]],
  ];
  return {
    duracao: 4,
    atualizar(t) {
      c.preparar(t);
      c.mostrar('todos');
      c.estado.clima = q.get('clima') ?? 'dia';
      c.atualizar(t);
      const [p, a] = vistas[Number(q.get('vista') ?? 0)];
      ctx.camera.position.set(...p);
      ctx.camera.lookAt(...a);
      ctx.camera.updateProjectionMatrix();
      c.cena.updateMatrixWorld(true);
      c.luz(t);
    },
  };
}
