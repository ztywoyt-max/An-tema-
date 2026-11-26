// Teste de pessoa: corpo inteiro e rosto de perto.
import * as THREE from 'three';
import { configurarNevoa } from '../motor-hd/materiais.js';
import { pessoa } from '../filmes/cavaleiro-hd/elenco.js';
import { parado } from '../motor-hd/boneco.js';
import { criarPos } from '../motor-hd/pos.js';

export default async function ({ renderer, cena, camera, w, h, q }) {
  configurarNevoa({ densidade: 0.0 });
  cena.fog = new THREE.FogExp2(0x101418, 0.0);
  cena.background = new THREE.Color(0x1c2028);
  renderer.toneMappingExposure = 1.15;
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 1 }));
  chao.rotation.x = -Math.PI / 2;
  chao.receiveShadow = true;
  cena.add(chao);
  cena.add(new THREE.HemisphereLight(0x8090b0, 0x302820, 0.9));
  const sol = new THREE.DirectionalLight(0xffe2c0, 2.6);
  sol.position.set(-2.5, 4, 4);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -2, right: 2, top: 2.5, bottom: -0.5 });
  sol.shadow.bias = -0.0003;
  cena.add(sol);
  const contra = new THREE.DirectionalLight(0x9fb4ff, 1.6);
  contra.position.set(3, 3, -4);
  cena.add(contra);
  const t0 = performance.now();
  const b = pessoa(q.get('quem') ?? 'tome');
  console.log(`pessoa em ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  const p = parado(0);
  if (q.get('fala')) b.falar(p, 0.3);
  b.pose(p);
  b.raiz.rotation.y = -0.35;
  cena.add(b.raiz);
  const J = b.J, cc = J.centroCabeca;
  const vistas = { corpo: [[0.2, 1.0, 3.2], [0, 0.95, 0], 38], rosto: [[0.12, cc[1] + 0.01, cc[2] + 0.62], [0, cc[1] - 0.01, cc[2]], 30] };
  const [cp, alvo, fov] = vistas[q.get('vista') ?? 'corpo'];
  camera.position.set(...cp);
  camera.lookAt(...alvo);
  camera.fov = fov;
  camera.updateProjectionMatrix();
  const pos = criarPos(renderer, cena, camera, { w, h, bloom: 0.2, ao: q.get('ao') !== '0' });
  return { pos };
}
