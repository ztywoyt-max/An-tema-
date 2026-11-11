// Ondas do mar. As MESMAS constantes estão em src/core/tide.gd (altura para a física).
global uniform float wave_amp;

const int WAVE_COUNT = 4;
const vec2 WAVE_DIR[4] = vec2[4](vec2(0.970, 0.243), vec2(-0.447, 0.894), vec2(0.707, -0.707), vec2(-0.949, -0.316));
const float WAVE_LEN[4] = float[4](23.0, 13.0, 7.5, 4.1);
const float WAVE_AMP[4] = float[4](0.085, 0.05, 0.028, 0.014);

float wave_height(vec2 p, float t) {
	float h = 0.0;
	for (int i = 0; i < WAVE_COUNT; i++) {
		float k = TAU / WAVE_LEN[i];
		float w = sqrt(9.8 * k) * 0.8;
		h += WAVE_AMP[i] * sin(k * dot(WAVE_DIR[i], p) + w * t + float(i) * 1.7);
	}
	return h * wave_amp;
}

vec3 wave_normal(vec2 p, float t) {
	vec2 g = vec2(0.0);
	for (int i = 0; i < WAVE_COUNT; i++) {
		float k = TAU / WAVE_LEN[i];
		float w = sqrt(9.8 * k) * 0.8;
		g += WAVE_DIR[i] * (WAVE_AMP[i] * k * cos(k * dot(WAVE_DIR[i], p) + w * t + float(i) * 1.7));
	}
	g *= wave_amp;
	return normalize(vec3(-g.x, 1.0, -g.y));
}
