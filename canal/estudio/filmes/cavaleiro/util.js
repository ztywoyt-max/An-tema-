// Utilidades de câmera e movimento compartilhadas pelos capítulos.
import { suave, lerp } from '../../motor/ps1.js';

export const S = suave;
export { lerp };
export const cam = (camera, p, a, fov) => {
  camera.position.set(p[0], p[1], p[2]);
  camera.lookAt(a[0], a[1], a[2]);
  if (fov) camera.fov = fov;
};
export const L = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
export const balanco = (t, a = 0.02) => [Math.sin(t * 0.37) * a, Math.sin(t * 0.53) * a * 0.6, 0];
export const somar = (a, b) => a.map((v, i) => v + b[i]);
export const sairDe = (ini, k) => 1 - (1 - k) * (1 - k);
export const v3 = (v) => [v.x, v.y, v.z];
