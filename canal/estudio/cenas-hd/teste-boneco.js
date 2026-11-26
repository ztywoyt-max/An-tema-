// Teste do esqueleto: o Enferrujado em várias poses lado a lado.
import * as THREE from 'three';
import { configurarNevoa } from '../motor-hd/materiais.js';
import { criarDamaso } from '../filmes/cavaleiro-hd/elenco.js';
import { andar, parado, somar } from '../motor-hd/boneco.js';
import { criarPos } from '../motor-hd/pos.js';

export default async function ({ renderer, cena, camera, w, h, q }) {
  configurarNevoa({ densidade: 0.0, queda: 3 });
  cena.fog = new THREE.FogExp2(0x101418, 0.0);
  cena.background = new THREE.Color(0x202630);
  renderer.toneMappingExposure = 1.2;
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 1 }));
  chao.rotation.x = -Math.PI / 2;
  chao.receiveShadow = true;
  cena.add(chao);
  cena.add(new THREE.HemisphereLight(0x8090b0, 0x302820, 1.2));
  const sol = new THREE.DirectionalLight(0xffeedd, 2.5);
  sol.position.set(3, 6, 5);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
  cena.add(sol);
  const t0 = performance.now();
  const b = criarDamaso({ passo: Number(q.get('passo') ?? 0.009) });
  console.log(`boneco em ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  const poses = [{}, parado(0), andar(0.0), andar(0.25), andar(0.5)];
  const pose = poses[Number(q.get('p') ?? 1)];
  b.pose(pose);
  cena.add(b.raiz);
  const vista = q.get('vista') ?? 'frente';
  const cams = { frente: [[0, 1.1, 3.6], [0, 0.95, 0]], lado: [[3.4, 1.1, 0.4], [0, 0.95, 0]], tres: [[2.2, 1.3, 2.8], [0, 0.95, 0]] };
  camera.position.set(...cams[vista][0]);
  camera.lookAt(...cams[vista][1]);
  camera.fov = 40;
  camera.updateProjectionMatrix();
  const pos = criarPos(renderer, cena, camera, { w, h, bloom: 0.2, ao: false });
  return { pos };
}
