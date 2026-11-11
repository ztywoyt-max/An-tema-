// Água estilizada: cor por profundidade, espuma de borda recortada, linhas de
// espuma à deriva, brilho de sol em faíscas e refração do fundo.
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, world_vertex_coords;

global uniform float sea_time;
global uniform vec3 sun_dir;
global uniform vec3 wind_vec;
global uniform sampler2D noise_tex : repeat_enable, filter_linear_mipmap;
global uniform sampler2D caustics_tex : repeat_enable, filter_linear_mipmap;

#include "res://shaders/inc/waves.gdshaderinc"

uniform sampler2D screen_tex : hint_screen_texture, repeat_disable, filter_linear_mipmap;
uniform sampler2D depth_tex : hint_depth_texture, repeat_disable, filter_nearest;

uniform vec3 shallow : source_color = vec3(0.25, 0.93, 0.82);
uniform vec3 mid_color : source_color = vec3(0.05, 0.72, 0.78);
uniform vec3 deep : source_color = vec3(0.02, 0.4, 0.68);
uniform vec3 sky_reflect : source_color = vec3(0.72, 0.9, 0.98);
uniform vec3 foam_color : source_color = vec3(1.0, 1.0, 0.98);
uniform float clarity = 0.32;
uniform float refraction = 0.035;
uniform bool vertex_waves = true;
uniform float edge_fade_start = 70.0;
uniform float edge_fade_end = 80.0;

varying vec3 v_wpos;
varying float v_wave;

vec3 view_pos(vec2 uv, float depth, mat4 inv_proj) {
	vec4 v = inv_proj * vec4(uv * 2.0 - 1.0, depth, 1.0);
	return v.xyz / v.w;
}

void vertex() {
	float h = 0.0;
	if (vertex_waves) {
		float fade = 1.0 - smoothstep(edge_fade_start, edge_fade_end, length(VERTEX.xz - NODE_POSITION_WORLD.xz));
		h = wave_height(VERTEX.xz, sea_time) * fade;
		VERTEX.y += h;
	}
	v_wave = h;
	v_wpos = VERTEX;
}

void fragment() {
	vec2 suv = SCREEN_UV;
	float surf_z = -VERTEX.z;
	vec2 p = v_wpos.xz;
	float t = sea_time;
	vec2 wdir = wind_vec.xz * 0.012;

	vec3 n = wave_normal(p, t);
	vec2 d1 = texture(noise_tex, p * 0.045 + vec2(t * 0.018, t * 0.011) + wdir * t).rg - 0.5;
	vec2 d2 = texture(noise_tex, p * 0.16 - vec2(t * 0.027, -t * 0.021)).gb - 0.5;
	vec2 dn = d1 * 0.55 + d2 * 0.35;
	n = normalize(n + vec3(dn.x, 0.0, dn.y) * 0.6);
	vec3 view_w = normalize(CAMERA_POSITION_WORLD - v_wpos);

	// fundo visto através da água (com refração)
	vec2 off = dn * refraction / (1.0 + surf_z * 0.06);
	float d_raw = texture(depth_tex, suv + off).r;
	vec3 sp = view_pos(suv + off, d_raw, INV_PROJECTION_MATRIX);
	if (-sp.z < surf_z) {
		off = vec2(0.0);
		d_raw = texture(depth_tex, suv).r;
		sp = view_pos(suv, d_raw, INV_PROJECTION_MATRIX);
	}
	vec3 scene_w = (INV_VIEW_MATRIX * vec4(sp, 1.0)).xyz;
	float thick = max(-sp.z - surf_z, 0.0);
	float vdepth = max(v_wpos.y - scene_w.y, 0.0);
	vec3 under = texture(screen_tex, suv + off).rgb;
	vec3 col;

	if (FRONT_FACING) {
		float a1 = 1.0 - exp(-vdepth * 0.6);
		float a2 = 1.0 - exp(-vdepth * 0.1);
		vec3 wcol = mix(shallow, mid_color, a1);
		wcol = mix(wcol, deep, a2);
		float opacity = 1.0 - exp(-thick * clarity);
		col = mix(under * mix(vec3(1.0), shallow * 1.35, 0.55), wcol, clamp(opacity, 0.0, 1.0));

		// reflexo do céu nos ângulos rasantes
		float fres = pow(1.0 - max(dot(n, view_w), 0.0), 3.2);
		col = mix(col, sky_reflect, fres * 0.7);

		// linhas de espuma à deriva (finas; mais fortes perto da costa)
		vec2 drift = vec2(t * 0.012, t * 0.007) + wdir * t * 0.5;
		float cells = texture(caustics_tex, p * 0.17 + drift + dn * 0.05).g;
		float cells2 = texture(caustics_tex, p * 0.07 - drift * 0.6 + 0.4).r;
		float near_shore = 1.0 - smoothstep(0.3, 2.4, vdepth);
		float lines = smoothstep(0.72, 0.9, cells) * (0.05 + near_shore * 0.55) + smoothstep(0.6, 0.9, cells2) * 0.1;
		lines *= 1.0 - smoothstep(40.0, 160.0, surf_z);
		col = mix(col, foam_color, clamp(lines, 0.0, 1.0));

		// espuma recortada na borda
		float fn = texture(caustics_tex, p * 0.33 + vec2(t * 0.02, -t * 0.013)).b;
		float fn2 = texture(noise_tex, p * 0.5 - vec2(t * 0.03, 0.0)).g;
		float lap = sin(vdepth * 9.0 - t * 1.6 + fn2 * 4.0) * 0.5 + 0.5;
		float shore = 1.0 - smoothstep(0.0, 0.55, vdepth + (fn - 0.5) * 0.3);
		float foam = smoothstep(0.42, 0.5, shore + fn2 * 0.35 - 0.15);
		foam = max(foam, smoothstep(0.8, 0.86, lap) * shore * 1.4);
		foam = max(foam, 1.0 - smoothstep(0.03, 0.07, vdepth));
		col = mix(col, foam_color, clamp(foam, 0.0, 1.0));

		// faíscas de sol
		vec3 r = reflect(-view_w, n);
		float sg = dot(r, normalize(sun_dir));
		float glint = smoothstep(0.975, 0.985, sg + (d2.x) * 0.06);
		col += vec3(1.0, 0.98, 0.88) * glint * 0.9;
		// cristas mais claras
		col += shallow * smoothstep(0.05, 0.14, v_wave) * 0.12;
	} else {
		// visto de baixo: teto brilhante e ondulado
		vec3 above = texture(screen_tex, suv + dn * 0.07).rgb;
		float graz = 1.0 - abs(dot(n, view_w));
		float tir = smoothstep(0.45, 0.72, graz);
		float shimmer = texture(caustics_tex, p * 0.12 + vec2(t * 0.02)).r;
		col = mix(above * vec3(0.7, 0.98, 1.0) + vec3(0.04, 0.1, 0.1), mix(deep, mid_color, 0.35), tir);
		col += vec3(0.6, 1.0, 0.95) * shimmer * 0.35 * (1.0 - tir * 0.6);
	}
	ALBEDO = col;
	ALPHA = 1.0;
}
