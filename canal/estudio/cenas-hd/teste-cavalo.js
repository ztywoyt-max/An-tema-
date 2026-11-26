// Teste: cavalo puxando a carroça.
import * as THREE from 'three';
import { configurarNevoa } from '../motor-hd/materiais.js';
import { criarCavalo, cavaloAndar, criarCarroca } from '../motor-hd/cavalo.js';
import { criarPos } from '../motor-hd/pos.js';

export default async function ({ renderer, cena, camera, w, h, q }) {
  configurarNevoa({ densidade: 0.0 });
  cena.fog = new THREE.FogExp2(0x101418, 0.0);
  cena.background = new THREE.Color(0x1c2028);
  renderer.toneMappingExposure = 1.15;
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 1 }));
  chao.rotation.x = -Math.PI / 2;
  chao.receiveShadow = true;
  cena.add(chao);
  cena.add(new THREE.HemisphereLight(0x8090b0, 0x302820, 0.9));
  const sol = new THREE.DirectionalLight(0xffe2c0, 2.6);
  sol.position.set(-3, 5, 4);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
  cena.add(sol);
  const cav = criarCavalo();
  cav.pose(cavaloAndar(Number(q.get('f') ?? 0.1)));
  cav.raiz.position.z = 2.6;
  cena.add(cav.raiz);
  const car = criarCarroca();
  cena.add(car);
  camera.position.set(4.2, 1.7, 4.6);
  camera.lookAt(0, 0.9, 1.4);
  camera.fov = 40;
  camera.updateProjectionMatrix();
  return { pos: criarPos(renderer, cena, camera, { w, h, bloom: 0.2, ao: false }) };
}
