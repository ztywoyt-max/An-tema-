// Partículas desenhadas por fórmula (sem textura): disco macio, estrela, risco,
// gota, tufo de fumaça recortado. Sempre viradas para a câmera.
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, shadows_disabled, fog_disabled;

global uniform sampler2D noise_tex : repeat_enable, filter_linear_mipmap;

uniform int shape = 0;            // 0 disco, 1 estrela, 2 risco, 3 gota, 4 tufo, 5 anel, 6 folha
uniform float hardness = 0.5;
uniform float glow = 1.0;
uniform bool additive = false;
uniform bool billboard = true;

varying float v_seed;

void vertex() {
	v_seed = INSTANCE_CUSTOM.z;
	if (billboard) {
		mat4 mw = mat4(normalize(INV_VIEW_MATRIX[0]), normalize(INV_VIEW_MATRIX[1]), normalize(INV_VIEW_MATRIX[2]), MODEL_MATRIX[3]);
		float a = INSTANCE_CUSTOM.x;
		mw = mw * mat4(vec4(cos(a), -sin(a), 0.0, 0.0), vec4(sin(a), cos(a), 0.0, 0.0), vec4(0.0, 0.0, 1.0, 0.0), vec4(0.0, 0.0, 0.0, 1.0));
		mw = mw * mat4(vec4(length(MODEL_MATRIX[0].xyz), 0.0, 0.0, 0.0), vec4(0.0, length(MODEL_MATRIX[1].xyz), 0.0, 0.0), vec4(0.0, 0.0, length(MODEL_MATRIX[2].xyz), 0.0), vec4(0.0, 0.0, 0.0, 1.0));
		MODELVIEW_MATRIX = VIEW_MATRIX * mw;
		MODELVIEW_NORMAL_MATRIX = mat3(MODELVIEW_MATRIX);
	}
}

void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float r = length(p);
	float a = 0.0;
	float edge = mix(0.6, 0.04, hardness);
	if (shape == 0) {
		a = 1.0 - smoothstep(1.0 - edge, 1.0, r);
	} else if (shape == 1) {
		// estrela de 4 pontas
		float s = abs(p.x) * abs(p.y) * 14.0 + r * 0.9;
		a = 1.0 - smoothstep(0.55, 0.75, s);
	} else if (shape == 2) {
		// risco alongado na vertical
		float w = 1.0 - smoothstep(0.0, 1.0, abs(p.x) / max(0.22 * (1.0 - abs(p.y)), 0.001));
		a = w * (1.0 - smoothstep(0.7, 1.0, abs(p.y)));
	} else if (shape == 3) {
		// gota
		vec2 q = p;
		q.x *= 1.0 + max(q.y, 0.0) * 1.6;
		a = 1.0 - smoothstep(0.62, 0.72, length(q - vec2(0.0, -0.2)));
	} else if (shape == 4) {
		// tufo recortado em dois tons
		float n = texture(noise_tex, UV * 0.7 + vec2(v_seed * 7.3, v_seed * 3.1)).g;
		float d = r + (n - 0.5) * 0.7;
		a = 1.0 - smoothstep(0.7, 0.74, d);
	} else if (shape == 5) {
		a = smoothstep(0.62, 0.7, r) * (1.0 - smoothstep(0.86, 0.96, r));
	} else {
		// folha
		vec2 q = p;
		a = 1.0 - smoothstep(0.9, 1.0, abs(q.x) * 2.6 + q.y * q.y);
	}
	vec3 col = COLOR.rgb;
	if (shape == 4) {
		float n2 = texture(noise_tex, UV * 0.9 + vec2(v_seed * 2.1)).r;
		col *= mix(0.82, 1.0, step(0.5, n2 + p.y * 0.3));
	}
	ALBEDO = col * glow;
	ALPHA = clamp(a * COLOR.a, 0.0, 1.0);
}
