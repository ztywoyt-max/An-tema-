// Material dos modelos (personagens, armas, props): cor por vértice x textura,
// pano que balança ao vento (peso no alfa da cor do vértice), clarão de golpe,
// molhado e dissolução.
shader_type spatial;
render_mode cull_disabled, ambient_light_disabled;

#include "res://shaders/inc/toon.gdshaderinc"

uniform vec4 tint : source_color = vec4(1.0);
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_enable, hint_default_white;
uniform bool use_texture = false;
uniform bool use_vertex_color = true;
uniform float alpha_cut = 0.0;
uniform float brush_scale = 1.6;
uniform float brush_amount = 0.1;
uniform bool brush_world = false;
uniform float flutter = 0.0;          // amplitude do pano ao vento (m)
uniform float flutter_speed = 1.0;
uniform vec4 emission_color : source_color = vec4(0.0, 0.0, 0.0, 1.0);
uniform float emission_energy = 0.0;
instance uniform float flash = 0.0;
instance uniform float wet = 0.0;
instance uniform float dissolve = 0.0;
instance uniform vec4 inst_tint : source_color = vec4(1.0);
instance uniform vec3 sway_vel = vec3(0.0);   // velocidade do dono (para o pano atrasar)

varying float v_weight;
varying vec3 v_opos;

void vertex() {
	v_weight = COLOR.a;
	v_opos = VERTEX;
	vec3 wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	if (flutter > 0.0) {
		float w = 1.0 - COLOR.a;   // alfa 1 = rígido, 0 = solto
		vec2 wd = wind_vec.xz;
		float ws = length(wd);
		vec3 dir = ws > 0.01 ? vec3(wd.x, 0.0, wd.y) / ws : vec3(1.0, 0.0, 0.0);
		float t = TIME * flutter_speed * (1.4 + ws * 0.35);
		float ph = dot(wpos, vec3(1.7, 2.3, 1.3));
		float wave = sin(t * 3.1 + ph * 2.2) * 0.6 + sin(t * 5.3 + ph * 4.1) * 0.4;
		vec3 push = dir * (0.35 + 0.65 * wave) * (0.25 + ws * 0.11);
		push -= sway_vel * 0.035;
		push.y += wave * 0.15 + min(ws, 6.0) * 0.02;
		wpos += push * w * flutter;
		VERTEX = (inverse(MODEL_MATRIX) * vec4(wpos, 1.0)).xyz;
	}
	v_wpos = wpos;
	v_wnormal = normalize(MODEL_NORMAL_MATRIX * NORMAL);
}

void fragment() {
	vec3 n = normalize(v_wnormal);
	if (!FRONT_FACING) {
		n = -n;
		NORMAL = -NORMAL;
	}
	vec4 base = tint * inst_tint;
	if (use_vertex_color) {
		base.rgb *= COLOR.rgb;
	}
	if (use_texture) {
		vec4 tx = texture(albedo_tex, UV);
		base *= tx;
	}
	if (alpha_cut > 0.0 && base.a < alpha_cut) {
		discard;
	}
	vec2 buv = brush_world ? (abs(n.y) > 0.6 ? v_wpos.xz : (abs(n.x) > abs(n.z) ? v_wpos.zy : v_wpos.xy)) * 0.3 : UV;
	vec3 br = texture(brush_tex, buv * brush_scale).rgb;
	vec3 col = base.rgb;
	col *= 1.0 + (br.r - 0.5) * 2.0 * brush_amount;
	if (!FRONT_FACING) {
		col *= 0.78;
	}
	if (dissolve > 0.0) {
		float dn = texture(noise_tex, UV * 2.0 + v_opos.xy * 0.7).g;
		float edge = dn - dissolve * 1.15 + 0.08;
		if (edge < 0.0) {
			discard;
		}
		EMISSION += vec3(0.4, 1.0, 0.95) * (1.0 - smoothstep(0.0, 0.07, edge)) * 3.0;
	}
	col = mix(col, col * vec3(0.72, 0.76, 0.84), wet * 0.6);
	v_brush = br.r;
	col = underwater(col, v_wpos, n);
	ALBEDO = mix(col, vec3(1.0), clamp(flash, 0.0, 1.0) * 0.85);
	EMISSION += emission_color.rgb * emission_energy + vec3(1.0, 0.97, 0.9) * flash * 0.6;
	ROUGHNESS = 1.0;
	SPECULAR = 0.0;
}
