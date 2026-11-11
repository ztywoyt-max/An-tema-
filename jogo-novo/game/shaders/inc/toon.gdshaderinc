// Luz "desenhada" compartilhada por todos os materiais opacos.
// Sombra colorida (nunca preta), terminador irregular de pincel, borda de luz.

global uniform vec3 wind_vec;      // xz = direção * força (m/s), y = rajada 0..1
global uniform float sea_level;
global uniform float sea_time;
global uniform vec4 shadow_tint : source_color;
global uniform sampler2D brush_tex : repeat_enable, filter_linear_mipmap;
global uniform sampler2D noise_tex : repeat_enable, filter_linear_mipmap;
global uniform sampler2D caustics_tex : repeat_enable, filter_linear_mipmap;

uniform float band_wobble = 0.16;
uniform float rim_strength = 0.3;
uniform float spec_size = 0.0;
uniform float spec_strength = 0.6;
uniform float light_wrap = 0.0;

varying vec3 v_wpos;
varying vec3 v_wnormal;
varying float v_brush;

// Escurece e tinge o que está debaixo d'água e desenha cáusticas.
vec3 underwater(vec3 albedo, vec3 wpos, vec3 wnormal) {
	float depth = sea_level - wpos.y;
	if (depth <= 0.0) {
		return albedo;
	}
	vec2 uv = wpos.xz * 0.22;
	float c1 = texture(caustics_tex, uv + vec2(sea_time * 0.021, sea_time * 0.013)).r;
	float c2 = texture(caustics_tex, uv * 1.37 - vec2(sea_time * 0.017, -sea_time * 0.019) + 0.37).r;
	float c = min(c1, c2) * 2.2 + c1 * c2;
	float up = clamp(wnormal.y * 0.7 + 0.5, 0.0, 1.0);
	float fade = smoothstep(0.0, 0.6, depth) * exp(-depth * 0.3);
	vec3 deep = vec3(0.08, 0.42, 0.56);
	vec3 col = mix(albedo, albedo * deep * 1.9, 1.0 - exp(-depth * 0.28));
	col += vec3(0.75, 1.0, 0.95) * c * fade * up * 0.38;
	return col;
}

void light() {
	float ndl = dot(NORMAL, LIGHT);
	float wob = (v_brush - 0.5) * band_wobble;
	if (LIGHT_IS_DIRECTIONAL) {
		float sh = smoothstep(0.3, 0.7, ATTENUATION);
		float lit1 = smoothstep(-0.03, 0.05, ndl + wob + light_wrap);
		float lit2 = smoothstep(0.52, 0.6, ndl + wob * 1.6);
		float l = min(lit1, sh);
		float level = l * mix(0.86, 1.0, lit2);
		DIFFUSE_LIGHT += mix(shadow_tint.rgb, vec3(1.0), level) * LIGHT_COLOR / PI;
		float rim = 1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0);
		float r = smoothstep(0.66, 0.74, rim + wob * 0.5) * l;
		DIFFUSE_LIGHT += r * rim_strength * LIGHT_COLOR / PI;
		if (spec_size > 0.0) {
			vec3 h = normalize(VIEW + LIGHT);
			float s = smoothstep(1.0 - spec_size, 1.0 - spec_size * 0.8, dot(NORMAL, h) + wob * 0.05);
			SPECULAR_LIGHT += s * l * spec_strength * LIGHT_COLOR / PI;
		}
	} else {
		float lit = smoothstep(0.0, 0.25, ndl + 0.2) * ATTENUATION;
		DIFFUSE_LIGHT += lit * LIGHT_COLOR / PI;
	}
}
