// Teste de cenário: ?c=pedralva:dia&cam=x,y,z&alvo=x,y,z
import * as THREE from 'three';
import { cenarios } from '../filmes/cavaleiro-hd/cenarios.js';
import { configurarNevoa } from '../motor-hd/materiais.js';
import { criarPos } from '../motor-hd/pos.js';

export default async function ({ renderer, cena, camera, w, h, q }) {
  const ctx = { renderer, cena, camera };
  const c = await cenarios[q.get('c') ?? 'pedralva:dia'](ctx);
  cena.add(c.base, c.grupo);
  const a = c.ambiente;
  configurarNevoa(a.nevoa);
  cena.fog = new THREE.FogExp2(new THREE.Color(...a.corNevoa), 0.01);
  cena.environment = a.ambiente;
  cena.environmentIntensity = a.intensidadeAmbiente;
  renderer.toneMappingExposure = a.exposicao;
  const cam = (q.get('cam') ?? '2,3,16').split(',').map(Number), alvo = (q.get('alvo') ?? '0,0,-14').split(',').map(Number);
  camera.position.set(...cam);
  camera.lookAt(...alvo);
  camera.fov = 45;
  camera.updateProjectionMatrix();
  c.focar?.(alvo[0], alvo[1], alvo[2]);
  c.entrar?.();
  const pos = criarPos(renderer, cena, camera, { w, h, bloom: 0.5, ao: q.get('ao') !== '0' });
  pos.grade.uniforms.uSat.value = a.saturacao;
  if (a.tinta) pos.grade.uniforms.uTinta.value.set(...a.tinta);
  return { pos, atualizar(t) { c.atualizar?.(0, t); } };
}
