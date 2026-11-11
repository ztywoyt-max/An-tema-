// Mancha de aquarela para fundo de painéis, botões e selos.
shader_type canvas_item;

global uniform sampler2D noise_tex : repeat_enable, filter_linear_mipmap;
global uniform sampler2D brush_tex : repeat_enable, filter_linear_mipmap;

uniform vec4 color : source_color = vec4(0.06, 0.3, 0.36, 0.86);
uniform float seed = 0.0;
uniform float roundness = 0.35;     // 0 = retângulo, 1 = círculo
uniform float edge = 0.3;           // quão irregular é a borda
uniform float aspect = 1.0;

void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	vec2 nuv = UV * vec2(aspect, 1.0);
	float n = texture(noise_tex, nuv * 0.55 + seed).r;
	float n2 = texture(noise_tex, nuv * 1.7 + seed * 2.3).g;
	vec2 q = abs(p);
	float box = max(q.x, q.y);
	float d = mix(box, length(p) * 0.82, roundness);
	float a = 1.0 - smoothstep(0.8, 0.99, d + (n - 0.5) * edge + (n2 - 0.5) * edge * 0.35);
	float rim = smoothstep(0.5, 0.92, d + (n - 0.5) * edge);
	vec3 bt = texture(brush_tex, nuv * 0.7 + seed).rgb;
	vec3 col = color.rgb * mix(0.82, 1.16, bt.r);
	col = mix(col, color.rgb * 0.62, rim * 0.4);
	col += vec3(0.05) * (bt.g - 0.5);
	COLOR = vec4(col, color.a * a) * vec4(1.0, 1.0, 1.0, COLOR.a);
}
