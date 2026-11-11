// Anel que se expande (onda de choque, respingo, rajada) e rastro de arma.
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, shadows_disabled, fog_disabled, blend_add;

global uniform sampler2D noise_tex : repeat_enable, filter_linear_mipmap;

uniform vec4 color : source_color = vec4(1.0);
uniform float progress = 0.0;     // 0..1
uniform float width = 0.16;
uniform float glow = 1.6;
uniform int mode = 0;             // 0 anel (UV radial), 1 rastro (UV.x ao longo, UV.y através)

void fragment() {
	float a = 0.0;
	if (mode == 0) {
		vec2 p = UV * 2.0 - 1.0;
		float r = length(p);
		float ang = atan(p.y, p.x);
		float n = texture(noise_tex, vec2(ang * 0.5, progress * 0.7)).g;
		float w = width * (1.0 - progress * 0.7);
		float ring = smoothstep(0.92 - w, 0.92 - w * 0.4, r) * (1.0 - smoothstep(0.94, 1.0, r));
		a = ring * smoothstep(0.15, 0.5, n + (1.0 - progress) * 0.6) * (1.0 - progress * progress);
	} else {
		float n = texture(noise_tex, vec2(UV.x * 1.5, UV.y * 0.6 + TIME * 0.3)).g;
		float body = smoothstep(0.0, 0.25, UV.y) * (1.0 - smoothstep(0.75, 1.0, UV.y) * 0.3);
		float tail = 1.0 - UV.x;
		a = body * tail * tail * smoothstep(0.1, 0.55, n + tail * 0.8);
		a *= mix(0.55, 1.0, smoothstep(0.55, 1.0, UV.y));
	}
	ALBEDO = color.rgb * glow;
	ALPHA = clamp(a * color.a, 0.0, 1.0);
}
