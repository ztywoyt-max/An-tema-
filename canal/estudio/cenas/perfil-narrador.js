// Foto de perfil do canal: "O Contador", o narrador de todas as histórias.
// Figura encapuzada, máscara dourada com olhos acesos, auréola, livro aberto que brilha.
// Renderizar quadrada: ?res=400x400 e --escala 2 (800x800).
import * as THREE from 'three';
import * as O from '../motor/objetos.js';
import * as T from '../motor/texturas.js';
import * as R from '../motor/roupas.js';
import { material } from '../motor/ps1.js';
import { criarPersonagem, parado, aplicar } from '../motor/personagem.js';

// máscara dourada (frente em u=0.5)
function texMascara() {
  const r = T.fazerRuido(171);
  return T.textura('mascara-ouro', 64, 64, (px, ler, w, h) => {
    const C = w / 2;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const dx = Math.abs(x - C);
        let c = T.mul([214, 168, 70], 0.8 + T.fbm(r, x / 5, y / 5, 13, 2) * 0.35);
        if (dx > 12) c = T.mul(c, 0.82);
        if (dx < 2 && y > 22 && y < 40) c = T.mul(c, 1.25); // nariz
        if ((x + y) % 7 === 0 && T.fbm(r, x, y, 64, 1) > 0.7) c = T.mix(c, [255, 236, 170], 0.6); // brilho
        px(x, y, c);
      }
    // olhos amendoados e vazios
    for (const s of [-1, 1])
      for (let y = 20; y <= 26; y++)
        for (let x = 0; x < w; x++) {
          const ex = C + s * 8, d = Math.abs(x - ex) / 5 + Math.abs(y - 23) / 3;
          if (d < 1) px(x, y, [6, 4, 10]);
          else if (d < 1.3) px(x, y, [120, 80, 30]);
        }
    // boca fechada, serena
    for (let x = C - 4; x <= C + 4; x++) px(x, 46, [110, 76, 30]);
    // linhas de ornamento na testa
    for (let x = C - 10; x <= C + 10; x++) if (x % 2 === 0) px(x, 10, [255, 230, 150]);
    for (let y = 11; y < 17; y++) px(C, y, [255, 230, 150]);
  });
}

function texPagina() {
  return T.textura('pagina', 16, 20, (px, ler, w, h) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let c = [236, 222, 186];
        if (y > 3 && y < h - 3 && x > 2 && x < w - 2 && y % 3 === 0 && (x * 7 + y) % 5 !== 0) c = [150, 120, 80]; // linhas de texto
        px(x, y, c);
      }
  });
}

export default function ({ cena, camera, luzes, motor }) {
  const vinho = [74, 16, 28], escuro = [38, 8, 16];
  const p = criarPersonagem({
    pele: R.TONS.palido,
    forte: 1.15,
    rosto: { idade: 'adulto', cabelo: 'careca', semente: 3 },
    chapeu: 'capuz',
    corChapeu: vinho,
    torso: R.torsoRoupa({ tipo: 'tunica', cor: escuro, decote: null, corCinto: [180, 140, 60] }),
    braco: R.membroRoupa({ cor: vinho }),
    antebraco: R.membroRoupa({ cor: vinho }),
    pelve: R.panoCor(escuro, 91),
    saia: { cor: escuro, comp: 1.0 },
    capa: { cor: vinho, comp: 1.4 },
  });
  p.sombra.visible = false;
  cena.add(p.raiz);
  // troca o rosto por um vazio escuro com a máscara dourada
  const cab = p.cabecaMalha;
  cab.children[0].visible = false; // rosto
  cab.children[1].visible = false; // nariz
  p.j.pescoco.children[0].material = material({ cor: 0x0a0408 }); // pescoço na sombra do capuz
  const vazio = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), material({ cor: 0x050308, semLuz: true }));
  vazio.position.set(0, 0.11, 0);
  cab.add(vazio);
  const mg = new THREE.CylinderGeometry(0.098, 0.088, 0.24, 10, 3, true, -Math.PI * 0.32, Math.PI * 0.64);
  mg.translate(0, 0.115, 0.012);
  const pm = mg.attributes.position;
  for (let i = 0; i < pm.count; i++) {
    const y = pm.getY(i);
    // contorno oval: estreita no queixo e na testa
    const k = y < 0.01 ? 0.45 : y < 0.09 ? 0.85 : y < 0.17 ? 1.0 : 0.82;
    pm.setX(i, pm.getX(i) * k);
    if (y < 0.01) pm.setY(i, y - 0.025);
    if (Math.abs(pm.getX(i)) < 0.02) pm.setZ(i, pm.getZ(i) + 0.012); // nariz
  }
  mg.computeVertexNormals();
  const mascara = new THREE.Mesh(mg, material({ mapa: texMascara(), duplo: true, brilhoProprio: 0.05 }));
  cab.add(mascara);
  const olhos = [-1, 1].map((s) => {
    const o = O.halo(0xffd890, 0.06, 1);
    cab.add(o);
    o.position.set(s * 0.038, 0.142, 0.115);
    return o;
  });
  // auréola dourada atrás da cabeça
  const aureola = new THREE.Group();
  aureola.add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.016, 4, 32), material({ cor: 0xffd070, semLuz: true, nevoa: false })));
  aureola.add(new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.006, 3, 32), material({ cor: 0xffe8b0, semLuz: true, nevoa: false })));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const raio = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.01), material({ cor: 0xffd070, semLuz: true, nevoa: false }));
    raio.position.set(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0);
    raio.rotation.z = a - Math.PI / 2;
    aureola.add(raio);
  }
  const brilhoAureola = O.halo(0xffb040, 1.4, 0.35);
  aureola.add(brilhoAureola);
  cena.add(aureola);
  // livro aberto nas mãos, com as páginas brilhando
  const livro = new THREE.Group();
  const mCapa = material({ cor: 0x4a1a18 });
  const mPag = material({ mapa: texPagina(), semLuz: true, brilhoProprio: 0.2 });
  for (const s of [-1, 1]) {
    const lado = new THREE.Group();
    lado.rotation.z = s * 0.22;
    lado.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.27).translate(s * 0.1, 0, 0), mCapa));
    lado.add(new THREE.Mesh(new THREE.BoxGeometry(0.185, 0.03, 0.25).translate(s * 0.095, 0.02, 0), mPag));
    livro.add(lado);
  }
  const luzLivro = O.halo(0xffd890, 0.9, 0.6);
  luzLivro.position.y = 0.12;
  livro.add(luzLivro);
  p.j.tronco.add(livro);
  livro.position.set(0, 0.16, 0.36);
  livro.rotation.x = -0.55;
  // páginas e faíscas flutuando
  const tp = texPagina();
  const paginas = Array.from({ length: 7 }, () => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.13), material({ mapa: tp, semLuz: true, duplo: true, brilhoProprio: 0.1 }));
    cena.add(m);
    return m;
  });
  const faiscas = Array.from({ length: 16 }, (_, i) => {
    const f = O.halo(i % 2 ? 0xffd070 : 0xffa040, 0.04 + (i % 3) * 0.02, 0.9);
    cena.add(f);
    return f;
  });
  const fundo = O.halo(0x3a2a80, 6, 0.5);
  fundo.position.set(0, 1.6, -3);
  cena.add(fundo);

  return {
    duracao: 2,
    atualizar(t) {
      parado(p, 0.4);
      aplicar(p, { ombroE: [-0.95, 0, -0.25], cotoveloE: [-1.15, 0, 0], ombroD: [-0.95, 0, 0.25], cotoveloD: [-1.15, 0, 0] });
      p.j.cabeca.rotation.x = 0.12;
      if (p.capa) p.capa.rotation.x = 0.2;
      p.raiz.updateMatrixWorld(true);
      const c = p.j.cabeca.localToWorld(new THREE.Vector3(0, 0.12, -0.16));
      aureola.position.copy(c);
      const lb = livro.localToWorld(new THREE.Vector3(0, 0.15, 0));
      paginas.forEach((m, i) => {
        const a = i * 0.9 + 0.4, f = (0.15 + i * 0.13) % 1;
        m.position.set(lb.x + Math.cos(a) * (0.35 + f * 0.25), lb.y + 0.15 + f * 0.75, lb.z + Math.sin(a) * 0.2 - 0.1);
        m.rotation.set(f * 2 + i, a, f * 3);
      });
      faiscas.forEach((s, i) => {
        const f = (0.3 + i * 0.113) % 1;
        s.position.set(lb.x + Math.sin(i * 2.7) * 0.6, lb.y + f * 1.1, lb.z - 0.3 + Math.cos(i * 1.9) * 0.3);
        s.material.opacity = 0.9 * (1 - f * 0.6);
      });
      luzes.nevoa(0x0c0818, 5, 14);
      luzes.ambiente(0x2a2448, 0x08060c);
      luzes.direcional([0.3, -0.3, 0.9], 0x6a5ab0, 0.6); // contraluz frio
      luzes.pontos([
        { pos: [lb.x, lb.y + 0.12, lb.z + 0.05], cor: 0xffcf80, intensidade: 1.7, alcance: 1.3 }, // o livro ilumina de baixo
        { pos: [c.x, c.y, c.z - 0.1], cor: 0xffb050, intensidade: 1.2, alcance: 0.9 },
      ]);
      const alvo = p.j.cabeca.localToWorld(new THREE.Vector3(0, 0.02, 0));
      camera.fov = 32;
      camera.position.set(alvo.x + 0.15, alvo.y - 0.3, alvo.z + 2.0);
      camera.lookAt(alvo.x, alvo.y - 0.1, alvo.z);
      camera.updateProjectionMatrix();
      motor.efeitos.uVinheta.value = 0.8;
      motor.efeitos.uExposicao.value = 1.2;
    },
  };
}
