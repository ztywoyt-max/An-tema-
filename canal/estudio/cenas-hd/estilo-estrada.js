// Teste de estilo (PS2/PS3, clima Souls): o Enferrujado parado na estrada do vale, de noite,
// com a lua por trás, neblina azulada, o tronco caído e uma lanterna no chão.
import * as THREE from 'three';
import { configurarNevoa } from '../motor-hd/materiais.js';
import { criarChao, criarMato, criarFloresta, criarArvoreSeca, criarPedras, criarTronco, criarLanterna, criarCeu, criarNeblina, criarToco, alturaChao } from '../motor-hd/natureza.js';
import { criarCavaleiro } from '../motor-hd/cavaleiro.js';
import { criarPos } from '../motor-hd/pos.js';

export default async function ({ renderer, cena, camera, w, h, q }) {
  const corNevoa = [0.013, 0.019, 0.034];
  const corLua = [0.07, 0.09, 0.15];
  const dirLua = configurarNevoa({ base: 0, queda: 2.4, dirLua: [-0.7, 0.34, -1], corLua, expoente: 9 });
  cena.fog = new THREE.FogExp2(new THREE.Color(...corNevoa), 0.055);
  renderer.toneMappingExposure = Number(q.get('exp') ?? 1.3);

  const ceu = criarCeu({ dirLua, corNevoa, corLua });
  // reflexos: o metal e as poças refletem o próprio céu noturno
  const soCeu = new THREE.Scene();
  soCeu.add(ceu.clone());
  const pmrem = new THREE.PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(soCeu, 0, 0.1, 1000).texture;
  cena.environmentIntensity = 0.9;
  cena.add(ceu);
  cena.add(criarChao());
  cena.add(criarMato({ qtd: 26000, raio: 22, centro: [-1, -4] }));
  cena.add(criarFloresta({ qtd: 360, evitar: [[1, 3, 9], [0, 0, 4]] }));
  const arvore = criarArvoreSeca(4);
  arvore.position.set(3.4, alturaChao(3.4, -3.2), -3.2);
  arvore.rotation.y = 2.2;
  cena.add(arvore);
  cena.add(criarPedras([[-2.6, -1.8, 0.7], [-2.1, -0.9, 0.3], [2.3, 0.4, 0.38], [2.0, 1.4, 0.22], [-1.9, 1.8, 0.25], [3.0, -6.5, 0.9], [-3.5, -9, 1.2], [1.8, -2.4, 0.18]]));
  cena.add(criarTronco({ x: 0.3, z: -5.2, comp: 6.5, raio: 0.3, giro: 0.14 }));
  // lanterna em cima de um toco, na altura da cintura: luz quente no corpo
  const toco = criarToco({ raio: 0.2, alt: 0.5 });
  toco.position.set(-0.95, alturaChao(-0.95, 0.9) - 0.03, 0.9);
  cena.add(toco);
  const lanterna = criarLanterna({ intensidade: Number(q.get('lant') ?? 6) });
  lanterna.position.set(-0.95, toco.position.y + 0.5, 0.9);
  lanterna.rotation.y = 0.5;
  cena.add(lanterna);
  cena.add(criarNeblina([
    [-3, 0.7, -7, 9, 2.2, 0.35], [4, 0.6, -10, 10, 2, 0.3], [0, 0.8, -14, 14, 2.6, 0.35], [-6, 0.9, -18, 12, 3, 0.3], [6, 1.0, -22, 14, 3, 0.3],
  ], [0.32, 0.4, 0.58]));

  const heroi = criarCavaleiro({ passo: Number(q.get('passo') ?? 0.0065) });
  heroi.position.set(0.12, alturaChao(0.12, 0) - 0.01, 0);
  heroi.rotation.y = -0.18;
  cena.add(heroi);

  // luzes: lua fria por trás, céu fraco e a lanterna quente na frente
  cena.add(new THREE.HemisphereLight(0x2a3a58, 0x0d0b08, 0.7));
  const luar = new THREE.DirectionalLight(0x93a9d8, 0.3); // luar fraco no cenário todo
  luar.position.set(5, 7, 6);
  cena.add(luar);
  // foco de luz no personagem (como num set de filmagem): ilumina ele sem clarear o resto
  const foco = new THREE.SpotLight(0x9fb2dc, Number(q.get('foco') ?? 75), 0, 0.24, 0.85, 2);
  foco.position.set(3.2, 5.2, 5.5);
  foco.target.position.set(0.1, 1.0, 0);
  foco.castShadow = true;
  foco.shadow.mapSize.set(2048, 2048);
  foco.shadow.bias = -0.0004;
  foco.shadow.normalBias = 0.02;
  cena.add(foco, foco.target);
  const lua = new THREE.DirectionalLight(0xa8bcff, 2.2);
  lua.position.copy(dirLua).multiplyScalar(30).add(new THREE.Vector3(0.1, 0, 0));
  lua.target.position.set(0.1, 0.8, -1);
  lua.castShadow = true;
  lua.shadow.mapSize.set(4096, 4096);
  Object.assign(lua.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 70 });
  lua.shadow.bias = -0.0003;
  lua.shadow.normalBias = 0.025;
  cena.add(lua, lua.target);

  const vistas = {
    geral: [[1.35, 1.0, 3.6], [-0.55, 0.92, -1.2], 38],
    baixa: [[1.0, 0.62, 3.5], [0.0, 1.02, -0.3], 36],
    perto: [[0.5, 1.5, 0.82], [0.0, 1.66, 0.0], 30],
  };
  const [cp, alvo, fov] = vistas[q.get('vista') ?? 'geral'];
  camera.fov = fov;
  camera.position.set(cp[0], alturaChao(cp[0], cp[2]) + cp[1], cp[2]);
  camera.lookAt(...alvo);
  camera.updateProjectionMatrix();

  const pos = criarPos(renderer, cena, camera, { w, h, bloom: 0.6, ao: q.get('ao') !== '0' });
  return { pos, duracao: 0, atualizar(t) { pos.grade.uniforms.uTempo.value = t; } };
}
