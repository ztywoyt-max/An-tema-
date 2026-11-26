// Teste: elenco lado a lado.
import * as THREE from 'three';
import { configurarNevoa } from '../motor-hd/materiais.js';
import { pessoa } from '../filmes/cavaleiro-hd/elenco.js';
import { parado } from '../motor-hd/boneco.js';
import { criarPos } from '../motor-hd/pos.js';

export default async function ({ renderer, cena, camera, w, h, q }) {
  configurarNevoa({ densidade: 0.0 });
  cena.fog = new THREE.FogExp2(0x101418, 0.0);
  cena.background = new THREE.Color(0x1c2028);
  renderer.toneMappingExposure = 1.2;
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 1 }));
  chao.rotation.x = -Math.PI / 2;
  chao.receiveShadow = true;
  cena.add(chao);
  cena.add(new THREE.HemisphereLight(0x8090b0, 0x302820, 1.0));
  const sol = new THREE.DirectionalLight(0xffe2c0, 2.4);
  sol.position.set(-3, 5, 6);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -8, right: 8, top: 3, bottom: -1 });
  cena.add(sol);
  const quem = (q.get('quem') ?? 'tome,dalia,lia,brana').split(',');
  quem.forEach((n, i) => {
    const t0 = performance.now();
    const b = pessoa(n);
    console.log(`${n}: ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    b.pose(parado(i));
    b.raiz.position.x = (i - (quem.length - 1) / 2) * 0.95;
    b.raiz.rotation.y = -0.15;
    cena.add(b.raiz);
  });
  const L = quem.length * 0.95;
  camera.position.set(0, 1.1, 1.5 + L * 0.95);
  camera.lookAt(0, 0.95, 0);
  camera.fov = 40;
  camera.updateProjectionMatrix();
  return { pos: criarPos(renderer, cena, camera, { w, h, bloom: 0.2, ao: false }) };
}
