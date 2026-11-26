// Variações de pose lado a lado (?grupo=espada|arco), vistas de lado.
import * as THREE from 'three';
import { configurarNevoa } from '../motor-hd/materiais.js';
import { pessoa, segurarArco, criarArco } from '../filmes/cavaleiro-hd/elenco.js';
import * as U from '../filmes/cavaleiro-hd/util.js';
import { criarPos } from '../motor-hd/pos.js';

const GRUPOS = {
  espada: ['damaso', [
    { maoD: [-60, 0, 0] }, { maoD: [-75, 0, 0], antebracoD: [-10, 0, 0] }, { maoD: [-45, 0, 0], bracoD: [10, 0, 0] },
    { bracoD: [-35, 0, 10], antebracoD: [-55, 0, 0], maoD: [0, 180, 0] }, U.golpe(0), U.golpe(1),
  ]],
  arco: ['raposa', [
    { bracoE: [-85, 0, 10], bracoD: [0, 0, -75], antebracoD: [0, 150, 0], cabeca: [0, -30, 0], peito: [0, -15, 0] },
    { bracoE: [-85, 0, 10], bracoD: [0, 0, -75], antebracoD: [0, -150, 0], cabeca: [0, -30, 0], peito: [0, -15, 0] },
    { bracoE: [-85, 0, 10], bracoD: [-15, 0, -75], antebracoD: [-150, 0, 0], cabeca: [0, -30, 0] },
    { bracoE: [-85, 0, 10], bracoD: [-15, 0, -75], antebracoD: [150, 0, 0], cabeca: [0, -30, 0] },
    { bracoE: [-85, 0, 10], bracoD: [-80, 0, -40], antebracoD: [-120, 0, 0] },
    { bracoE: [-30, 0, -5], antebracoE: [-20, 0, 0], bracoD: [-10, 0, -10], antebracoD: [-30, 0, 0] },
  ]],
};

export default async function ({ renderer, cena, camera, w, h, q }) {
  configurarNevoa({ densidade: 0.0 });
  cena.fog = new THREE.FogExp2(0x101418, 0.0);
  cena.background = new THREE.Color(0x30343c);
  renderer.toneMappingExposure = 1.3;
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 1 }));
  chao.rotation.x = -Math.PI / 2;
  chao.receiveShadow = true;
  cena.add(chao);
  cena.add(new THREE.HemisphereLight(0xa0b0d0, 0x403830, 1.8));
  const sol = new THREE.DirectionalLight(0xffe2c0, 2.6);
  sol.position.set(-3, 5, 6);
  cena.add(sol);
  const [quem, poses] = GRUPOS[q.get('grupo') ?? 'espada'];
  poses.forEach((p, i) => {
    const b = pessoa(quem);
    if (quem === 'raposa') segurarArco(b, criarArco());
    b.pose(U.somar(U.parado(0), p));
    b.raiz.position.x = (i - 2.5) * 1.3;
    b.raiz.rotation.y = Number(q.get('giro') ?? 1.2);
    cena.add(b.raiz);
  });
  camera.position.set(0, 1.3, 8.0);
  camera.lookAt(0, 0.9, 0);
  camera.fov = 40;
  camera.updateProjectionMatrix();
  return { pos: criarPos(renderer, cena, camera, { w, h, bloom: 0.2, ao: false }) };
}
