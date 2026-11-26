// Folha de poses do filme.
import * as THREE from 'three';
import { configurarNevoa } from '../motor-hd/materiais.js';
import { pessoa, criarArco, criarBebe, criarTocha } from '../filmes/cavaleiro-hd/elenco.js';
import * as U from '../filmes/cavaleiro-hd/util.js';
import { criarPos } from '../motor-hd/pos.js';

export default async function ({ renderer, cena, camera, w, h, q }) {
  configurarNevoa({ densidade: 0.0 });
  cena.fog = new THREE.FogExp2(0x101418, 0.0);
  cena.background = new THREE.Color(0x30343c);
  renderer.toneMappingExposure = 1.3;
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 1 }));
  chao.rotation.x = -Math.PI / 2;
  chao.receiveShadow = true;
  cena.add(chao);
  cena.add(new THREE.HemisphereLight(0xa0b0d0, 0x403830, 1.6));
  const sol = new THREE.DirectionalLight(0xffe2c0, 2.6);
  sol.position.set(-3, 5, 6);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -8, right: 8, top: 3, bottom: -1 });
  cena.add(sol);
  const lista = [
    ['damaso', U.somar(U.andar(0.3, { passo: 0.6 }), U.ESPADA_ARRASTA)],
    ['raposa', U.somar(U.parado(0), U.ARCO_TENSO)],
    ['tome', U.somar(U.parado(0), U.SENTADO, U.REDEAS)],
    ['dalia', U.somar(U.parado(0), U.SENTADO, U.COLO)],
    ['damaso', U.somar(U.parado(0), U.EMPURRA)],
    ['bandido2', U.somar(U.parado(0), U.MEDO)],
  ];
  const giro = Number(q.get('giro') ?? 0.6);
  lista.forEach(([n, p], i) => {
    const b = pessoa(n);
    if (n === 'raposa') { const a = criarArco(); a.position.set(...b.J.pulsoE); a.position.y -= 0.0; b.prender('maoE', a); }
    if (n === 'dalia') { const bb = criarBebe(); bb.position.set(0, 1.18, 0.18); bb.rotation.y = 0.3; b.prender('peito', bb); }
    if (n === 'bandido2') { const t = criarTocha(); t.position.set(...b.J.pulsoD); b.prender('maoD', t); }
    b.pose(p);
    b.raiz.position.x = (i - 2.5) * 1.15;
    b.raiz.rotation.y = giro;
    cena.add(b.raiz);
  });
  camera.position.set(0, 1.2, 7.2);
  camera.lookAt(0, 0.85, 0);
  camera.fov = 42;
  camera.updateProjectionMatrix();
  return { pos: criarPos(renderer, cena, camera, { w, h, bloom: 0.2, ao: false }) };
}
