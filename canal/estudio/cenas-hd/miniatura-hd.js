// Miniaturas do filme no estilo HD (?v=a ou b), com o texto desenhado por cima.
import * as THREE from 'three';
import { cenarios, elenco } from '../filmes/cavaleiro-hd/filme.js';
import { configurarNevoa } from '../motor-hd/materiais.js';
import { criarPos } from '../motor-hd/pos.js';
import { parado, somar } from '../motor-hd/boneco.js';
import * as U from '../filmes/cavaleiro-hd/util.js';

export default async function ({ renderer, cena, camera, w, h, q }) {
  const v = q.get('v') ?? 'a';
  const ctx = { renderer, cena, camera, q, atores: {}, tempoFilme: 2.3 };
  ctx.ator = (n) => ctx.atores[n];
  const usar = (c) => {
    cena.add(c.grupo); if (c.base) cena.add(c.base);
    const a = c.ambiente;
    configurarNevoa(a.nevoa);
    cena.fog = new THREE.FogExp2(new THREE.Color(...a.corNevoa), 0.01);
    cena.environment = a.ambiente;
    cena.environmentIntensity = a.intensidadeAmbiente;
    renderer.toneMappingExposure = a.exposicao;
    ctx.cen = c;
    return c;
  };
  const pos = criarPos(renderer, cena, camera, { w, h, bloom: 0.7, ao: true });
  let texto;
  if (v === 'a') {
    // capacete de perto, à luz da vela, contraluz frio
    const c = usar(await cenarios['pedralva:noite'](ctx));
    c.entrar?.();
    c.preencher(0.25);
    const b = await elenco.damaso(ctx); cena.add(b.raiz); ctx.atores.damaso = b;
    const vela = await elenco.vela(ctx); cena.add(vela.raiz);
    b.raiz.position.set(0, 0.0, 60); b.raiz.rotation.y = -0.5;
    b.pose(somar(parado(0), { cabeca: [6, 20, 0] }));
    b.raiz.updateMatrixWorld(true);
    const cap = b.capacete.getWorldPosition(new THREE.Vector3());
    vela.raiz.position.set(cap.x - 0.35, cap.y - 0.7, cap.z + 0.55);
    vela.raiz.traverse((o) => { if (o.isPointLight) o.intensity = 1.2; });
    vela.raiz.userData.atualizar(2.3);
    vela.raiz.traverse((o) => { if (o.isPointLight) o.userData.atualizar = null; });
    const fria = new THREE.PointLight(0x8aa4ff, 9, 0, 2); fria.position.set(cap.x + 0.6, cap.y + 0.4, cap.z - 0.7); cena.add(fria);
    const quente = new THREE.PointLight(0xff9a50, 0.9, 0, 2); quente.position.set(cap.x - 0.3, cap.y - 0.15, cap.z + 0.5); cena.add(quente);
    c.focar(cap.x, 0, cap.z);
    camera.position.set(cap.x - 0.78, cap.y + 0.17, cap.z + 0.22);
    camera.lookAt(cap.x, cap.y + 0.13, cap.z + 0.3);
    camera.fov = 34;
    texto = { linhas: [['312', 'Cinzel', 600, 300, '#efe2c8']], sub: 'vidas', x: 0.73 };
  } else {
    const c = usar(await cenarios['pedralva:tempestade'](ctx));
    c.entrar?.();
    const b = await elenco.damaso(ctx); cena.add(b.raiz);
    const serp = await elenco.serpente(ctx); cena.add(serp.raiz);
    b.raiz.position.set(0, 0.44, 0.6); b.raiz.rotation.y = 0;
    b.pose(somar(parado(0), U.ESPADA_ARRASTA));
    serp.raiz.userData.atualizar(2.3, 16);
    c.atualizar(0, 2.3);
    c.focar(0, 0, 4);
    camera.position.set(-1.1, 0.9, -3.6);
    camera.lookAt(0.4, 1.6, 6);
    camera.fov = 40;
    texto = { linhas: [['ELE NÃO', 'Cinzel', 600, 120, '#efe2c8'], ['PODE MORRER', 'Cinzel', 600, 120, '#efe2c8']], x: 0.27 };
  }
  camera.updateProjectionMatrix();
  pos.grade.uniforms.uVinheta.value = 0.7;
  return {
    pos,
    sobrepor(canvas) {
      // texto grande, com sombra e um fio vermelho
      const c2 = document.createElement('canvas');
      c2.width = canvas.width; c2.height = canvas.height;
      const g = c2.getContext('2d');
      g.drawImage(canvas, 0, 0);
      const W = c2.width, H = c2.height, k = W / 1920;
      g.textAlign = 'center';
      let y = H * (texto.linhas.length > 1 ? 0.42 : 0.56);
      let base = y;
      for (const [t, f, peso, tam, cor] of texto.linhas) {
        g.font = `${peso} ${tam * k}px ${f}`;
        g.shadowColor = 'rgba(0,0,0,0.9)'; g.shadowBlur = 30 * k; g.shadowOffsetY = 6 * k;
        g.fillStyle = cor;
        g.fillText(t, W * texto.x, y);
        base = y;
        y += tam * k * 1.05;
      }
      g.shadowBlur = 0;
      g.fillStyle = '#9a1a14';
      g.fillRect(W * texto.x - 220 * k, base + 50 * k, 440 * k, 6 * k);
      if (texto.sub) { g.font = `italic 500 ${110 * k}px "Cormorant Garamond"`; g.fillStyle = '#d8c8a8'; g.fillText(texto.sub, W * texto.x, base + 160 * k); }
      return c2.toDataURL('image/jpeg', 0.93);
    },
  };
}
