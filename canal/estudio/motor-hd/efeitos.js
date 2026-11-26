// Efeitos do motor HD: fogo, fumaça, brasas, chuva, vela e tocha acesa.
// Partículas são cartões virados para a câmera calculados no shader (o tempo é um uniform: nada de estado por quadro).
import * as THREE from 'three';
import { rng } from './ruido.js';

const RUIDO_GLSL = `
float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hsh(i), hsh(i + vec2(1, 0)), f.x), mix(hsh(i + vec2(0, 1)), hsh(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * rn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }`;

// ---------- chama (cartão virado para a câmera) ----------
export function criarChama({ largura = 0.25, altura = 0.5, intensidade = 4, semente = 1 } = {}) {
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTempo: { value: 0 }, uInt: { value: intensidade }, uSem: { value: semente } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv;
      vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      vec3 esc = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), 1.0);
      c.xy += position.xy * esc.xy;
      gl_Position = projectionMatrix * c; }`,
    fragmentShader: `uniform float uTempo, uInt, uSem; varying vec2 vUv; ${RUIDO_GLSL}
      void main(){
        vec2 p = vUv; p.x -= 0.5;
        float t = uTempo * 2.2 + uSem * 7.0;
        float n = fbm(vec2(p.x * 3.0, p.y * 2.0 - t)) * 0.9 + fbm(vec2(p.x * 7.0 + 3.0, p.y * 5.0 - t * 1.7)) * 0.35;
        float larg = (1.0 - p.y) * 0.42 * (0.7 + 0.3 * sin(p.y * 6.0 - t * 2.0));
        float forma = smoothstep(larg, larg * 0.25, abs(p.x + (n - 0.6) * 0.18 * p.y)) * smoothstep(1.0, 0.25, p.y + (n - 0.5) * 0.5) * smoothstep(0.0, 0.08, p.y);
        float calor = forma * (1.2 - p.y);
        vec3 cor = mix(vec3(0.9, 0.12, 0.01), vec3(1.0, 0.55, 0.12), smoothstep(0.15, 0.6, calor));
        cor = mix(cor, vec3(1.0, 0.92, 0.7), smoothstep(0.65, 1.0, calor));
        gl_FragColor = vec4(cor * forma * uInt, 1.0);
      }`,
  });
  const g = new THREE.PlaneGeometry(1, 1);
  g.translate(0, 0.5, 0);
  const malha = new THREE.Mesh(g, m);
  malha.scale.set(largura, altura, 1);
  malha.frustumCulled = false;
  malha.renderOrder = 10;
  malha.userData.atualizar = (t) => { m.uniforms.uTempo.value = t; };
  return malha;
}

// ---------- partículas (fumaça, brasas, cinzas, faíscas) ----------
// tipo: 'fumaca' (cinza, sobe e abre), 'brasas' (pontos quentes), 'poeira' (flutua)
export function criarParticulas({ qtd = 60, tipo = 'fumaca', area = [0.3, 0.1, 0.3], subida = 0.6, vida = 6, tamanho = 0.6, cor = 0x4a4a4a, opacidade = 0.35, vento = [0.15, 0, 0], semente = 3 } = {}) {
  const r = rng(semente);
  const base = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.attributes.position = base.attributes.position;
  g.attributes.uv = base.attributes.uv;
  const ini = new Float32Array(qtd * 4);
  for (let i = 0; i < qtd; i++) {
    ini[i * 4] = (r() - 0.5) * area[0];
    ini[i * 4 + 1] = (r() - 0.5) * area[1];
    ini[i * 4 + 2] = (r() - 0.5) * area[2];
    ini[i * 4 + 3] = r();
  }
  g.setAttribute('aIni', new THREE.InstancedBufferAttribute(ini, 4));
  g.instanceCount = qtd;
  const quente = tipo === 'brasas';
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: !quente,
    blending: quente ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uTempo: { value: 0 }, uVida: { value: vida }, uSubida: { value: subida }, uTam: { value: tamanho }, uVento: { value: new THREE.Vector3(...vento) },
      uCor: { value: new THREE.Color(cor) }, uOpac: { value: opacidade },
      ...THREE.UniformsLib.fog,
    },
    vertexShader: `attribute vec4 aIni; uniform float uTempo, uVida, uSubida, uTam; uniform vec3 uVento;
      varying vec2 vUv; varying float vIdade; varying float vSem;
      #include <fog_pars_vertex>
      void main(){
        vUv = uv;
        float idade = fract(uTempo / uVida + aIni.w);
        vIdade = idade; vSem = aIni.w;
        vec3 p = aIni.xyz + vec3(0.0, idade * uSubida * uVida, 0.0) + uVento * idade * uVida;
        p.x += sin(idade * 9.0 + aIni.w * 40.0) * 0.08 * idade * uVida * 0.3;
        p.z += cos(idade * 7.0 + aIni.w * 30.0) * 0.08 * idade * uVida * 0.3;
        ${quente ? 'float tam = uTam * (1.0 - idade) * 0.04;' : 'float tam = uTam * (0.3 + idade * 1.4);'}
        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        mvPosition.xy += (position.xy) * tam;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 uCor; uniform float uOpac; varying vec2 vUv; varying float vIdade; varying float vSem; ${RUIDO_GLSL}
      #include <fog_pars_fragment>
      void main(){
        vec2 p = vUv - 0.5;
        float r = length(p);
        ${quente
          ? 'float a = smoothstep(0.5, 0.0, r) * smoothstep(1.0, 0.6, vIdade); vec3 c = mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.8, 0.4), smoothstep(0.3, 0.0, r)) * 6.0 * a; gl_FragColor = vec4(c, 1.0);'
          : 'float n = fbm(p * 3.0 + vSem * 10.0 + vIdade * 1.5); float a = smoothstep(0.5, 0.1, r + (n - 0.5) * 0.35) * smoothstep(0.0, 0.15, vIdade) * smoothstep(1.0, 0.5, vIdade) * uOpac; gl_FragColor = vec4(uCor * (0.7 + 0.5 * n), a);'}
        #include <fog_fragment>
      }`,
  });
  const malha = new THREE.Mesh(g, m);
  malha.frustumCulled = false;
  malha.renderOrder = 9;
  malha.userData.atualizar = (t) => { m.uniforms.uTempo.value = t; };
  return malha;
}

// ---------- chuva (riscos em volta da câmera) ----------
export function criarChuva({ qtd = 6000, raio = 14, altura = 10, velocidade = 9, cor = 0x9aa8c0, opacidade = 0.35, vento = [0.8, 0, 0.3] } = {}) {
  const r = rng(77);
  const base = new THREE.PlaneGeometry(1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = base.index;
  g.attributes.position = base.attributes.position;
  g.attributes.uv = base.attributes.uv;
  const ini = new Float32Array(qtd * 4);
  for (let i = 0; i < qtd; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * raio;
    ini[i * 4] = Math.cos(a) * d; ini[i * 4 + 1] = r() * altura; ini[i * 4 + 2] = Math.sin(a) * d; ini[i * 4 + 3] = r();
  }
  g.setAttribute('aIni', new THREE.InstancedBufferAttribute(ini, 4));
  g.instanceCount = qtd;
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTempo: { value: 0 }, uAlt: { value: altura }, uVel: { value: velocidade }, uCor: { value: new THREE.Color(cor) }, uOpac: { value: opacidade }, uVento: { value: new THREE.Vector3(...vento) }, uCentro: { value: new THREE.Vector3() } },
    vertexShader: `attribute vec4 aIni; uniform float uTempo, uAlt, uVel; uniform vec3 uVento, uCentro; varying float vA; varying vec2 vUv;
      void main(){
        vUv = uv;
        float y = mod(aIni.y - uTempo * uVel - aIni.w * 13.0, uAlt);
        vec3 p = uCentro + vec3(aIni.x, y - 1.0, aIni.z) + uVento * (uAlt - y) * 0.08;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vec4 mv2 = modelViewMatrix * vec4(p + normalize(vec3(uVento.x * 0.08, -1.0, uVento.z * 0.08)) * 0.45, 1.0);
        vec2 dir = normalize(mv2.xy - mv.xy + 1e-5);
        vec2 lado = vec2(-dir.y, dir.x);
        mv.xy += dir * (position.y + 0.5) * length(mv2.xyz - mv.xyz) + lado * position.x * 0.006;
        mv.z = mix(mv.z, mv2.z, position.y + 0.5);
        vA = smoothstep(18.0, 3.0, -mv.z) * smoothstep(0.2, 1.5, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: 'uniform vec3 uCor; uniform float uOpac; varying float vA; varying vec2 vUv; void main(){ float a = (1.0 - abs(vUv.x - 0.5) * 2.0) * vA * uOpac; gl_FragColor = vec4(uCor * a, 1.0); }',
  });
  const malha = new THREE.Mesh(g, m);
  malha.frustumCulled = false;
  malha.renderOrder = 11;
  malha.userData.atualizar = (t, camera) => { m.uniforms.uTempo.value = t; if (camera) m.uniforms.uCentro.value.copy(camera.position); };
  return malha;
}

// ---------- luz que tremula (fogo) ----------
export function luzFogo({ cor = 0xff8a3a, intensidade = 4, alcance = 0, sombra = false, semente = 1 } = {}) {
  const l = new THREE.PointLight(cor, intensidade, alcance, 2);
  if (sombra) {
    l.castShadow = true;
    l.shadow.mapSize.set(512, 512);
    l.shadow.bias = -0.003;
    l.shadow.camera.near = 0.05;
  }
  l.userData.atualizar = (t) => {
    const f = 0.82 + 0.1 * Math.sin(t * 13.1 + semente) + 0.06 * Math.sin(t * 27.7 + semente * 3) + 0.04 * Math.sin(t * 5.3);
    l.intensity = intensidade * f;
  };
  return l;
}

// tocha acesa: cabo, chama, brasas e luz
export function tochaAcesa(criarTocha, { luz = 3, sombra = false, semente = 1 } = {}) {
  const g = criarTocha();
  const chama = criarChama({ largura: 0.16, altura: 0.38, intensidade: 5, semente });
  chama.position.y = 0.36;
  const brasas = criarParticulas({ tipo: 'brasas', qtd: 18, area: [0.05, 0.02, 0.05], subida: 0.5, vida: 1.6, tamanho: 0.6, semente });
  brasas.position.y = 0.42;
  const l = luzFogo({ intensidade: luz, sombra, semente });
  l.position.y = 0.5;
  g.add(chama, brasas, l);
  g.userData.atualizar = (t) => { chama.userData.atualizar(t); brasas.userData.atualizar(t); l.userData.atualizar(t); };
  return g;
}

// vela no chão
export function criarVela({ luz = 1.2 } = {}) {
  const g = new THREE.Group();
  const cera = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.12, 14), new THREE.MeshPhysicalMaterial({ color: 0xe8dcc0, roughness: 0.5, transmission: 0.0, sheen: 0.5, sheenColor: new THREE.Color(0xffd090) }));
  cera.position.y = 0.06;
  const chama = criarChama({ largura: 0.035, altura: 0.08, intensidade: 6, semente: 5 });
  chama.position.y = 0.125;
  const l = luzFogo({ cor: 0xffa050, intensidade: luz, sombra: true, semente: 5 });
  l.position.y = 0.16;
  g.add(cera, chama, l);
  cera.castShadow = false;
  cera.receiveShadow = true;
  g.userData.atualizar = (t) => { chama.userData.atualizar(t); l.userData.atualizar(t); };
  return g;
}

// atualiza tudo o que tiver userData.atualizar dentro de um grupo
export function atualizarEfeitos(grupo, t, camera) {
  grupo.traverse((o) => { if (o.visible !== false && o.userData.atualizar) o.userData.atualizar(t, camera); });
}
