// Pós-processamento do motor HD: oclusão de ambiente, brilho (bloom), anti-serrilhado e a "cor de cinema"
// (dessaturado, sombras frias, vinheta, grão de filme e uma leve aberração nas bordas).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const Grade = {
  uniforms: { tDiffuse: { value: null }, uTempo: { value: 0 }, uRes: { value: new THREE.Vector2(1920, 1080) }, uSat: { value: 0.8 }, uVinheta: { value: 0.5 }, uGrao: { value: 0.03 }, uTinta: { value: new THREE.Vector3(1, 1, 1) }, uFade: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTempo, uSat, uVinheta, uGrao, uFade; uniform vec2 uRes; uniform vec3 uTinta; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      float r2 = dot(d, d);
      vec3 c;
      c.r = texture2D(tDiffuse, vUv - d * r2 * 0.006).r;
      c.g = texture2D(tDiffuse, vUv).g;
      c.b = texture2D(tDiffuse, vUv + d * r2 * 0.006).b;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, uSat) * uTinta;
      c += vec3(-0.004, 0.004, 0.012) * (1.0 - smoothstep(0.0, 0.35, l));   // sombras frias
      c *= mix(vec3(1.0), vec3(1.04, 1.0, 0.94), smoothstep(0.35, 1.0, l)); // luzes quentes
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);                           // contraste
      float v = smoothstep(0.2, 0.9, length(d * vec2(1.0, 0.78)) * 1.32);
      c *= 1.0 - v * uVinheta;
      float g = h(vUv * uRes + fract(uTempo) * 61.7) + h(vUv * uRes * 1.3 - fract(uTempo * 1.7) * 17.1) - 1.0;
      c += g * uGrao * (0.6 + 0.4 * (1.0 - l));
      gl_FragColor = vec4(clamp(c, 0.0, 1.0) * uFade, 1.0);
    }`,
};

export function criarPos(renderer, cena, camera, { w = 1920, h = 1080, bloom = 0.55, ao = true } = {}) {
  const alvo = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
  const comp = new EffectComposer(renderer, alvo);
  comp.setSize(w, h);
  comp.addPass(new RenderPass(cena, camera));
  if (ao) {
    const gtao = new GTAOPass(cena, camera, w, h);
    gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.0, scale: 1.2, samples: 16 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    gtao.blendIntensity = 0.9;
    comp.addPass(gtao);
  }
  const b = new UnrealBloomPass(new THREE.Vector2(w, h), bloom, 0.75, 0.82);
  comp.addPass(b);
  comp.addPass(new OutputPass());
  comp.addPass(new SMAAPass(w, h));
  const grade = new ShaderPass(Grade);
  grade.uniforms.uRes.value.set(w, h);
  comp.addPass(grade);
  return { comp, grade, bloom: b };
}
