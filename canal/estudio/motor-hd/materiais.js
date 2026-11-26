// Materiais do motor HD: textura projetada pelos três eixos (não precisa de UV), chão com lama e mato,
// e névoa que se acumula perto do chão e brilha na direção da lua.
import * as THREE from 'three';

// ---------- névoa por altura (substitui a névoa padrão de todos os materiais) ----------
// Os parâmetros são uniforms compartilhados: cada cenário muda a névoa sem recompilar nada.
export const NEVOA = {
  uNevDens: { value: 0.05 }, uNevQueda: { value: 3 }, uNevBase: { value: 0 }, uNevMax: { value: 0.97 },
  uNevDirLua: { value: new THREE.Vector3(0, 0.3, -1).normalize() }, uNevCorLua: { value: new THREE.Color(0.1, 0.12, 0.2) }, uNevExp: { value: 6 },
};
export function injetarNevoa(sh) {
  Object.assign(sh.uniforms, NEVOA);
}
let nevoaPronta = false;
function prepararNevoa() {
  if (nevoaPronta) return;
  nevoaPronta = true;
  THREE.Material.prototype.onBeforeCompile = function (sh) { injetarNevoa(sh); };
  THREE.ShaderChunk.fog_pars_vertex = `#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogPos;
#endif`;
  THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogPos = (inverse(viewMatrix) * mvPosition).xyz;
#endif`;
  THREE.ShaderChunk.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogPos;
  uniform float uNevDens, uNevQueda, uNevBase, uNevMax, uNevExp;
  uniform vec3 uNevDirLua, uNevCorLua;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
#endif`;
  THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  {
    vec3 fRaio = vFogPos - cameraPosition;
    float fDist = length(fRaio);
    vec3 fDir = fRaio / max(fDist, 1e-4);
    float fK = fRaio.y / uNevQueda;
    float fInt = abs(fK) > 1e-3 ? (1.0 - exp(-fK)) / fK : 1.0;
    float fOptica = uNevDens * exp(-(cameraPosition.y - uNevBase) / uNevQueda) * fDist * fInt;
    float fogFactor = min(1.0 - exp(-fOptica), uNevMax);
    float fLua = pow(max(dot(fDir, uNevDirLua), 0.0), uNevExp);
    vec3 fCor = fogColor + uNevCorLua * fLua;
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fCor, fogFactor);
  }
#endif`;
}
prepararNevoa();

// ajusta a névoa (pode ser chamado a cada cenário); devolve a direção da lua normalizada
export function configurarNevoa({ densidade = 0.05, base = 0, queda = 3, dirLua = [0, 0.3, -1], corLua = [0.2, 0.25, 0.35], expoente = 6, maximo = 0.97 } = {}) {
  const d = new THREE.Vector3(...dirLua).normalize();
  NEVOA.uNevDens.value = densidade;
  NEVOA.uNevBase.value = base;
  NEVOA.uNevQueda.value = queda;
  NEVOA.uNevMax.value = maximo;
  NEVOA.uNevExp.value = expoente;
  NEVOA.uNevDirLua.value.copy(d);
  NEVOA.uNevCorLua.value.setRGB(...corLua);
  return d;
}

// ---------- triplanar ----------
// tex: { cor, rm, normal } de texturas.js. escala: repetições por metro.
// A projeção usa a posição de repouso do objeto (atributo position): a textura fica presa ao corpo
// mesmo quando o esqueleto mexe a malha. O relevo é girado do repouso para a normal atual.
// sujeira: { cor, y0, y1 } escurece abaixo de y1 (pés sujos de lama). musgo: { cor, qtd } nas faces de cima.
export function triplanar(tex, { escala = 1, cor = 0xffffff, rugosidade = 1, metal = 1, relevo = 1, sujeira = null, musgo = null, emissivo = null, lado = THREE.FrontSide, fisico = null } = {}) {
  const base = {
    color: cor, map: tex.cor, roughnessMap: tex.rm, metalnessMap: tex.rm, normalMap: tex.normal,
    roughness: rugosidade, metalness: metal, normalScale: new THREE.Vector2(relevo, relevo), side: lado,
  };
  // fisico: parâmetros extras do MeshPhysicalMaterial (ex.: brilho aveludado da pele)
  const m = fisico ? new THREE.MeshPhysicalMaterial({ ...base, ...fisico }) : new THREE.MeshStandardMaterial(base);
  if (emissivo) m.emissive = new THREE.Color(emissivo);
  const defs = [`#define TRI_ESC ${escala.toFixed(4)}`];
  if (sujeira) {
    const c = new THREE.Color(sujeira.cor);
    defs.push('#define TRI_SUJ', `#define SUJ_COR vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`, `#define SUJ_Y0 ${sujeira.y0.toFixed(3)}`, `#define SUJ_Y1 ${sujeira.y1.toFixed(3)}`);
  }
  if (musgo) {
    const c = new THREE.Color(musgo.cor);
    defs.push('#define TRI_MUSGO', `#define MUSGO_COR vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`, `#define MUSGO_QTD ${musgo.qtd.toFixed(3)}`);
  }
  m.onBeforeCompile = (sh) => {
    injetarNevoa(sh);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriNorm;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
  vTriPos = position;
  vTriNorm = normal;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${defs.join('\n')}\nvarying vec3 vTriPos;\nvarying vec3 vTriNorm;
vec3 triGirar(vec3 v, vec3 a, vec3 b) {
  vec3 c = cross(a, b);
  float d = dot(a, b);
  if (d < -0.95) return b;
  return v * d + cross(c, v) + c * dot(c, v) / (1.0 + d + 1e-4);
}`)
      .replace('#include <map_fragment>', `
  vec3 triWN = normalize(vTriNorm);
  vec3 triB = pow(abs(triWN), vec3(4.0));
  triB /= (triB.x + triB.y + triB.z);
  vec2 tuX = vTriPos.zy * TRI_ESC, tuY = vTriPos.xz * TRI_ESC, tuZ = vTriPos.xy * TRI_ESC;
  vec4 triCor = texture2D(map, tuX) * triB.x + texture2D(map, tuY) * triB.y + texture2D(map, tuZ) * triB.z;
  diffuseColor.rgb *= triCor.rgb;
  #ifdef TRI_SUJ
    diffuseColor.rgb = mix(diffuseColor.rgb, SUJ_COR, smoothstep(SUJ_Y1, SUJ_Y0, vTriPos.y) * (0.55 + 0.45 * triCor.a));
  #endif
  #ifdef TRI_MUSGO
    float triMus = smoothstep(0.35, 0.75, triWN.y + (triCor.a - 0.5) * 0.8) * MUSGO_QTD;
    diffuseColor.rgb = mix(diffuseColor.rgb, MUSGO_COR * (0.7 + 0.6 * triCor.a), triMus);
  #endif`)
      .replace('#include <roughnessmap_fragment>', `
  vec4 triRM = texture2D(roughnessMap, tuX) * triB.x + texture2D(roughnessMap, tuY) * triB.y + texture2D(roughnessMap, tuZ) * triB.z;
  float roughnessFactor = roughness * triRM.g;
  #ifdef TRI_MUSGO
    roughnessFactor = mix(roughnessFactor, 0.95, triMus);
  #endif`)
      .replace('#include <metalnessmap_fragment>', `
  float metalnessFactor = metalness * triRM.b;
  #ifdef TRI_MUSGO
    metalnessFactor *= 1.0 - triMus;
  #endif`)
      .replace('#include <normal_fragment_maps>', `
  {
    vec3 tnX = texture2D(normalMap, tuX).xyz * 2.0 - 1.0;
    vec3 tnY = texture2D(normalMap, tuY).xyz * 2.0 - 1.0;
    vec3 tnZ = texture2D(normalMap, tuZ).xyz * 2.0 - 1.0;
    tnX.xy *= normalScale; tnY.xy *= normalScale; tnZ.xy *= normalScale;
    tnX = vec3(tnX.xy + triWN.zy, abs(tnX.z) * triWN.x);
    tnY = vec3(tnY.xy + triWN.xz, abs(tnY.z) * triWN.y);
    tnZ = vec3(tnZ.xy + triWN.xy, abs(tnZ.z) * triWN.z);
    vec3 triRep = normalize(tnX.zyx * triB.x + tnY.xzy * triB.y + tnZ.xyz * triB.z);
    normal = normalize(triGirar(triRep, triWN, normal));
  }`);
  };
  m.customProgramCacheKey = () => `tri2|${defs.join('|')}`;
  return m;
}

// ---------- chão: lama da estrada misturada com o mato (atributo aLama), poças brilhantes ----------
export function materialChao(lama, terra, { escala = 0.6, pocas = 0.6 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    injetarNevoa(sh);
    Object.assign(sh.uniforms, {
      tLC: { value: lama.cor }, tLR: { value: lama.rm }, tLN: { value: lama.normal },
      tTC: { value: terra.cor }, tTR: { value: terra.rm }, tTN: { value: terra.normal },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aLama;\nvarying float vLama;\nvarying vec3 vChPos;\nvarying vec3 vChNorm;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
  vLama = aLama;
  vChPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vChNorm = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D tLC, tLR, tLN, tTC, tTR, tTN;
varying float vLama;
varying vec3 vChPos;
varying vec3 vChNorm;`)
      .replace('#include <map_fragment>', `
  vec2 chUV = vChPos.xz * ${escala.toFixed(4)};
  vec4 cL = texture2D(tLC, chUV), cT = texture2D(tTC, chUV * 0.8 + 0.37);
  float pocaRuido = texture2D(tLC, vChPos.xz * 0.045).a;
  float misturaL = smoothstep(0.25, 0.75, vLama + (cT.a - 0.5) * 0.5);
  float poca = smoothstep(0.62, 0.7, pocaRuido) * smoothstep(0.6, 0.95, vLama) * ${pocas.toFixed(3)};
  vec3 corCh = mix(cT.rgb, cL.rgb, misturaL);
  corCh = mix(corCh, cL.rgb * 0.45, poca);
  diffuseColor.rgb *= corCh;`)
      .replace('#include <roughnessmap_fragment>', `
  vec4 rL = texture2D(tLR, chUV), rT = texture2D(tTR, chUV * 0.8 + 0.37);
  float roughnessFactor = mix(rT.g, rL.g, misturaL);
  roughnessFactor = mix(roughnessFactor, 0.16, poca);`)
      .replace('#include <normal_fragment_maps>', `
  {
    vec3 nL = texture2D(tLN, chUV).xyz * 2.0 - 1.0;
    vec3 nT = texture2D(tTN, chUV * 0.8 + 0.37).xyz * 2.0 - 1.0;
    vec3 tn = normalize(mix(nT, nL, misturaL));
    tn.xy *= (1.0 - poca);
    vec3 N = normalize(vChNorm);
    vec3 T = normalize(vec3(N.y, -N.x, 0.0));
    vec3 B = cross(T, N);
    vec3 wn = normalize(T * tn.x + B * tn.y + N * tn.z);
    normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
  }`);
  };
  m.customProgramCacheKey = () => `chao|${escala}|${pocas}`;
  return m;
}
