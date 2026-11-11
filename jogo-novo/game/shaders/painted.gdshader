// Superfícies do cenário pintadas por projeção no mundo (sem precisar de UV):
// 0 liso, 1 blocos de pedra, 2 tábuas, 3 areia, 4 lajotas.
shader_type spatial;
render_mode cull_back, ambient_light_disabled;

#include "res://shaders/inc/toon.gdshaderinc"

uniform int pattern = 0;
uniform vec4 color_a : source_color = vec4(0.86, 0.8, 0.7, 1.0);
uniform vec4 color_b : source_color = vec4(0.74, 0.69, 0.62, 1.0);
uniform vec4 line_color : source_color = vec4(0.36, 0.3, 0.42, 1.0);
uniform vec4 color_top : source_color = vec4(0.86, 0.8, 0.7, 1.0);
uniform float top_blend = 0.0;
uniform vec2 tile = vec2(1.4, 0.7);
uniform float line_width = 0.028;
uniform float brush_scale = 0.2;
uniform float brush_amount = 0.14;

float hash21(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

void vertex() {
	v_wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	v_wnormal = normalize(MODEL_NORMAL_MATRIX * NORMAL);
}

void fragment() {
	vec3 n = normalize(v_wnormal);
	vec3 an = abs(n);
	vec2 uv;
	if (an.y > an.x && an.y > an.z) {
		uv = v_wpos.xz;
	} else if (an.x > an.z) {
		uv = v_wpos.zy;
	} else {
		uv = v_wpos.xy;
	}
	vec3 br = texture(brush_tex, uv * brush_scale).rgb;
	vec3 nz = texture(noise_tex, uv * 0.07).rgb;
	vec2 wuv = uv + (nz.gb - 0.5) * 0.05;
	vec3 col = color_a.rgb;
	float line = 0.0;
	if (pattern == 1 || pattern == 4) {
		vec2 q = wuv / tile;
		if (pattern == 1) {
			q.x += 0.5 * mod(floor(q.y), 2.0);
		}
		vec2 id = floor(q);
		vec2 f = fract(q);
		vec2 d = min(f, 1.0 - f) * tile;
		float e = min(d.x, d.y);
		float h = hash21(id);
		col = mix(color_a.rgb, color_b.rgb, smoothstep(0.25, 0.85, h));
		col *= 0.94 + 0.12 * hash21(id + 7.3);
		line = 1.0 - smoothstep(line_width, line_width + 0.012, e + (br.g - 0.5) * 0.02);
		// lasca clara junto à aresta de cima de cada bloco
		col += vec3(0.05) * smoothstep(0.1, 0.0, d.y) * step(0.5, f.y);
	} else if (pattern == 2) {
		vec2 q = wuv / tile;
		float row = floor(q.y);
		q.x += hash21(vec2(row, 3.1)) * 3.0;
		vec2 id = floor(q);
		vec2 f = fract(q);
		vec2 d = min(f, 1.0 - f) * tile;
		float e = min(d.x, d.y);
		float h = hash21(id);
		col = mix(color_a.rgb, color_b.rgb, h);
		float grain = texture(noise_tex, wuv * vec2(0.35, 4.0) + h).b;
		col *= 0.9 + 0.2 * grain;
		line = 1.0 - smoothstep(line_width, line_width + 0.01, e);
	} else if (pattern == 3) {
		float big = nz.r;
		col = mix(color_a.rgb, color_b.rgb, smoothstep(0.3, 0.75, big));
		float ripple = sin((uv.x * 0.8 + uv.y * 0.35) * 9.0 + nz.g * 9.0);
		col *= 1.0 + 0.03 * ripple;
		float speck = texture(noise_tex, uv * 1.7).a;
		col *= 0.95 + 0.1 * speck;
		float wet = 1.0 - smoothstep(0.02, 0.4, v_wpos.y - sea_level + (nz.b - 0.5) * 0.15);
		col = mix(col, col * vec3(0.66, 0.68, 0.72), wet);
	} else {
		col = mix(color_a.rgb, color_b.rgb, smoothstep(0.35, 0.7, nz.r));
	}
	col = mix(col, line_color.rgb, line * line_color.a);
	if (top_blend > 0.0) {
		float t = smoothstep(0.6, 0.85, n.y + (br.r - 0.5) * 0.3) * top_blend;
		col = mix(col, color_top.rgb, t);
	}
	// pinceladas: variação de valor e leve desvio de matiz
	col *= 1.0 + (br.r - 0.5) * 2.0 * brush_amount;
	col = mix(col, col * vec3(1.05, 0.98, 0.94), (br.g - 0.5) * brush_amount * 2.0);
	v_brush = br.r;
	ALBEDO = underwater(col, v_wpos, n);
	ROUGHNESS = 1.0;
	SPECULAR = 0.0;
}
