// Barra do HUD em forma de pincelada: bordas irregulares, cerdas, ponta seca.
shader_type canvas_item;

global uniform sampler2D noise_tex : repeat_enable, filter_linear_mipmap;
global uniform sampler2D brush_tex : repeat_enable, filter_linear_mipmap;

uniform vec4 color : source_color = vec4(0.91, 0.33, 0.24, 1.0);
uniform vec4 back : source_color = vec4(0.07, 0.06, 0.2, 0.62);
uniform vec4 ghost_color : source_color = vec4(1.0, 0.95, 0.82, 1.0);
uniform float fill = 1.0;
uniform float ghost = 1.0;
uniform float seed = 0.0;
uniform float aspect = 9.0;
uniform float pulse = 0.0;

void fragment() {
	vec2 uv = UV;
	float n = texture(noise_tex, vec2(uv.x * aspect * 0.1 + seed, seed * 3.7)).g;
	float n2 = texture(noise_tex, vec2(uv.x * aspect * 0.4 + seed * 2.0, 0.37 + seed)).b;
	vec3 bt = texture(brush_tex, vec2(uv.x * aspect * 0.22 + seed, uv.y * 0.9 + seed * 1.3)).rgb;
	float halfw = 0.37 + (n - 0.5) * 0.16;
	float center = 0.5 + (n2 - 0.5) * 0.07;
	float d = abs(uv.y - center) / halfw;
	float shape = 1.0 - smoothstep(0.78, 1.0, d + (bt.r - 0.5) * 0.4);
	shape *= smoothstep(0.0, 0.03, uv.x + (n2 - 0.5) * 0.025);
	shape *= 1.0 - smoothstep(0.9, 1.0, uv.x + (bt.g - 0.5) * 0.16);
	float fe = (bt.g - 0.5) * 0.035;
	float f = 1.0 - smoothstep(fill - 0.006, fill + 0.006, uv.x + fe);
	float g = 1.0 - smoothstep(ghost - 0.006, ghost + 0.006, uv.x + fe);
	vec3 paint = color.rgb * mix(0.78, 1.14, bt.r);
	paint = mix(paint, vec3(1.0), (1.0 - smoothstep(0.0, 0.7, d)) * 0.14 + pulse * 0.35);
	paint *= 1.0 - smoothstep(0.55, 1.0, d) * 0.25;
	vec4 outc = vec4(back.rgb, back.a * shape);
	outc = mix(outc, vec4(ghost_color.rgb, shape), g * ghost_color.a);
	outc = mix(outc, vec4(paint, shape), f);
	COLOR = outc * vec4(1.0, 1.0, 1.0, COLOR.a);
}
