// Núcleo gráfico do Estúdio PS1.
// Imita o hardware do PlayStation: iluminação por vértice (Gouraud), textura sem correção
// de perspectiva (affine), vértices presos à grade de pixels, neblina por vértice e saída
// em 15 bits de cor com pontilhado (dithering) de Bayer.
import * as THREE from 'three';

THREE.ColorManagement.enabled = false;

export const RES = { w: 384, h: 216 }; // 16:9; ampliado 5x vira 1920x1080 sem borrar
export const MAX_LUZES = 8;

// Uniformes compartilhados por todos os materiais (luzes, neblina, resolução).
export const global = {
  uRes: { value: new THREE.Vector2(RES.w, RES.h) },
  uCeu: { value: new THREE.Color(0.1, 0.12, 0.16) },
  uChao: { value: new THREE.Color(0.04, 0.04, 0.05) },
  uDirDir: { value: new THREE.Vector3(0, -1, 0) },
  uDirCor: { value: new THREE.Color(0, 0, 0) },
  uPLPos: { value: Array.from({ length: MAX_LUZES }, () => new THREE.Vector3()) },
  uPLCor: { value: Array.from({ length: MAX_LUZES }, () => new THREE.Color(0, 0, 0)) },
  uPLAlcance: { value: new Array(MAX_LUZES).fill(1) },
  uPLQtd: { value: 0 },
  uNevoaCor: { value: new THREE.Color(0.1, 0.12, 0.16) },
  uNevoaPerto: { value: 4 },
  uNevoaLonge: { value: 30 },
  uTempo: { value: 0 },
};

const VERT = /* glsl */ `
uniform vec2 uRes;
uniform vec3 uCeu, uChao, uDirDir, uDirCor;
uniform vec3 uPLPos[${MAX_LUZES}];
uniform vec3 uPLCor[${MAX_LUZES}];
uniform float uPLAlcance[${MAX_LUZES}];
uniform int uPLQtd;
uniform float uNevoaPerto, uNevoaLonge;
uniform float uSemLuz, uComNevoa, uPrender, uBrilhoProprio;
uniform vec2 uRepete;
varying vec3 vUvW;
varying vec3 vLuz;
varying float vNevoa;
void main() {
  vec4 mundo = modelMatrix * vec4(position, 1.0);
  vec3 n = normalize(transpose(inverse(mat3(modelMatrix))) * normal);
  vec3 luz = mix(uChao, uCeu, n.y * 0.5 + 0.5);
  luz += uDirCor * max(dot(n, -uDirDir), 0.0);
  for (int i = 0; i < ${MAX_LUZES}; i++) {
    if (i >= uPLQtd) break;
    vec3 d = uPLPos[i] - mundo.xyz;
    float dist = length(d);
    float at = clamp(1.0 - dist / uPLAlcance[i], 0.0, 1.0);
    at = at * at;
    float nd = max(dot(n, d / max(dist, 0.0001)) * 0.7 + 0.3, 0.0);
    luz += uPLCor[i] * at * nd;
  }
  luz = mix(luz, vec3(1.0), uSemLuz);
  #ifdef USE_COLOR
    luz *= color;
  #endif
  vLuz = min(luz, vec3(1.8)) + vec3(uBrilhoProprio);

  vec4 vista = viewMatrix * mundo;
  float prof = length(vista.xyz);
  vNevoa = uComNevoa * clamp((prof - uNevoaPerto) / (uNevoaLonge - uNevoaPerto), 0.0, 1.0);

  vec4 clip = projectionMatrix * vista;
  if (uPrender > 0.5 && clip.w > 0.0) {
    vec2 grade = uRes * 0.5;
    vec3 ndc = clip.xyz / clip.w;
    ndc.xy = floor(ndc.xy * grade + 0.5) / grade;
    clip.xyz = ndc * clip.w;
  }
  gl_Position = clip;
  vUvW = vec3(uv * uRepete * clip.w, clip.w);
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uMapa;
uniform float uTemMapa, uCorte, uOpacidade;
uniform vec3 uCor, uEmissivo, uNevoaCor;
varying vec3 vUvW;
varying vec3 vLuz;
varying float vNevoa;
void main() {
  vec2 uv = vUvW.xy / vUvW.z;
  vec4 tx = uTemMapa > 0.5 ? texture2D(uMapa, uv) : vec4(1.0);
  if (tx.a < uCorte) discard;
  vec3 base = tx.rgb * uCor;
  vec3 c = base * vLuz + uEmissivo * tx.rgb;
  c = mix(c, uNevoaCor, vNevoa);
  gl_FragColor = vec4(c, tx.a * uOpacidade);
}
`;

/**
 * Material PS1.
 * opções: mapa (textura), cor, emissivo, semLuz, nevoa (bool), corte (alpha test),
 * transparente, opacidade, aditivo, duplo (dois lados), repete [u, v], prender (vertex snap)
 */
export function material(op = {}) {
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    vertexColors: !!op.coresVertice,
    transparent: !!(op.transparente || op.aditivo),
    depthWrite: op.aditivo ? false : op.depthWrite ?? true,
    blending: op.aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: op.duplo ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: {
      ...global,
      uMapa: { value: op.mapa ?? null },
      uTemMapa: { value: op.mapa ? 1 : 0 },
      uCor: { value: new THREE.Color(op.cor ?? 0xffffff) },
      uEmissivo: { value: new THREE.Color(op.emissivo ?? 0x000000) },
      uSemLuz: { value: op.semLuz ? 1 : 0 },
      uComNevoa: { value: op.nevoa === false ? 0 : 1 },
      uCorte: { value: op.corte ?? 0.5 },
      uOpacidade: { value: op.opacidade ?? 1 },
      uPrender: { value: op.prender === false ? 0 : 1 },
      uBrilhoProprio: { value: op.brilhoProprio ?? 0 },
      uRepete: { value: new THREE.Vector2(...(op.repete ?? [1, 1])) },
    },
  });
  return m;
}

const POS_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const POS_FRAG = /* glsl */ `
uniform sampler2D tCena;
uniform sampler2D tHud;
uniform float uHudOpac;
uniform vec2 uRes;
uniform float uVinheta, uExposicao, uFade;
uniform vec3 uFadeCor;
varying vec2 vUv;
const float bayer[16] = float[](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
void main() {
  vec3 c = texture2D(tCena, vUv).rgb * uExposicao;
  vec2 q = vUv - 0.5;
  q.x *= uRes.x / uRes.y;
  c *= clamp(1.0 - uVinheta * dot(q, q), 0.0, 1.0);
  c = mix(c, uFadeCor, uFade);
  vec4 h = texture2D(tHud, vUv);
  c = mix(c, h.rgb, h.a * uHudOpac);
  int x = int(mod(gl_FragCoord.x, 4.0));
  int y = int(mod(gl_FragCoord.y, 4.0));
  float b = bayer[y * 4 + x] / 16.0 - 0.5;
  c = clamp(c + b / 31.0, 0.0, 1.0);
  c = floor(c * 31.0 + 0.5) / 31.0; // 5 bits por canal = 15 bits, como no PS1
  gl_FragColor = vec4(c, 1.0);
}
`;

export class Motor {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(RES.w, RES.h, false);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.alvo = new THREE.WebGLRenderTarget(RES.w, RES.h, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
    });
    // camada de texto/interface, na mesma resolução do jogo (pixel duro)
    this.hud = document.createElement('canvas');
    this.hud.width = RES.w;
    this.hud.height = RES.h;
    this.hudCtx = this.hud.getContext('2d');
    this.hudTex = new THREE.CanvasTexture(this.hud);
    this.hudTex.magFilter = THREE.NearestFilter;
    this.hudTex.minFilter = THREE.NearestFilter;
    this.hudTex.generateMipmaps = false;
    this.hudTex.colorSpace = THREE.NoColorSpace;
    this.pos = new THREE.ShaderMaterial({
      vertexShader: POS_VERT,
      fragmentShader: POS_FRAG,
      uniforms: {
        tCena: { value: this.alvo.texture },
        tHud: { value: this.hudTex },
        uHudOpac: { value: 1 },
        uRes: global.uRes,
        uVinheta: { value: 0.35 },
        uExposicao: { value: 1 },
        uFade: { value: 0 },
        uFadeCor: { value: new THREE.Color(0, 0, 0) },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.cenaPos = new THREE.Scene();
    this.camPos = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.cenaPos.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.pos));
  }

  get efeitos() {
    return this.pos.uniforms;
  }

  desenhar(cena, camera) {
    this.hudTex.needsUpdate = true;
    this.renderer.setRenderTarget(this.alvo);
    this.renderer.setClearColor(global.uNevoaCor.value, 1);
    this.renderer.clear();
    this.renderer.render(cena, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.cenaPos, this.camPos);
  }

  // Lê o quadro final (RGBA, de baixo para cima) em base64.
  lerQuadro() {
    const gl = this.renderer.getContext();
    const buf = new Uint8Array(RES.w * RES.h * 4);
    gl.readPixels(0, 0, RES.w, RES.h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let s = '';
    const passo = 0x8000;
    for (let i = 0; i < buf.length; i += passo) {
      s += String.fromCharCode.apply(null, buf.subarray(i, i + passo));
    }
    return btoa(s);
  }
}

// Controle de luzes da cena.
export const luzes = {
  ambiente(ceu, chao) {
    global.uCeu.value.set(ceu);
    global.uChao.value.set(chao);
  },
  direcional(dir, cor, intensidade = 1) {
    global.uDirDir.value.set(...dir).normalize();
    global.uDirCor.value.set(cor).multiplyScalar(intensidade);
  },
  nevoa(cor, perto, longe) {
    global.uNevoaCor.value.set(cor);
    global.uNevoaPerto.value = perto;
    global.uNevoaLonge.value = longe;
  },
  // pontos: [{ pos: Vector3|[x,y,z], cor, intensidade, alcance }]
  pontos(lista) {
    global.uPLQtd.value = Math.min(lista.length, MAX_LUZES);
    lista.slice(0, MAX_LUZES).forEach((l, i) => {
      const p = l.pos;
      if (Array.isArray(p)) global.uPLPos.value[i].set(...p);
      else global.uPLPos.value[i].copy(p);
      global.uPLCor.value[i].set(l.cor).multiplyScalar(l.intensidade ?? 1);
      global.uPLAlcance.value[i] = l.alcance ?? 8;
    });
  },
};

// Ruído suave e determinístico (para tremulação de chamas etc.).
export function ruido1(t, semente = 0) {
  const h = (n) => {
    const x = Math.sin(n * 127.1 + semente * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

export function suave(a, b, t) {
  const x = Math.min(Math.max((t - a) / (b - a), 0), 1);
  return x * x * (3 - 2 * x);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
