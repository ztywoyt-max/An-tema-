// Efeitos de tela inteira: raios de sol, debaixo d'água, riscos de velocidade,
// dano, vida baixa, clarão e escurecimento.
shader_type canvas_item;

global uniform sampler2D noise_tex : repeat_enable, filter_linear_mipmap;
global uniform sampler2D caustics_tex : repeat_enable, filter_linear_mipmap;

uniform sampler2D screen_tex : hint_screen_texture, repeat_disable, filter_linear;

uniform float underwater = 0.0;
uniform float hurt = 0.0;
uniform float low_hp = 0.0;
uniform float speed = 0.0;
uniform float fade = 0.0;
uniform vec4 fade_color : source_color = vec4(0.03, 0.05, 0.12, 1.0);
uniform float flash = 0.0;
uniform vec4 flash_color : source_color = vec4(1.0, 1.0, 1.0, 1.0);
uniform vec2 sun_pos = vec2(0.5, 0.2);
uniform float sun_vis = 0.0;
uniform float ray_strength = 0.55;
uniform float aspect = 1.777;
uniform float focus = 0.0;          // carregando o impulso de vento

void fragment() {
	vec2 uv = SCREEN_UV;
	float t = TIME;
	vec2 wob = vec2(sin(uv.y * 26.0 + t * 2.2), cos(uv.x * 22.0 + t * 1.9)) * 0.0032 * underwater;
	vec3 col = texture(screen_tex, uv + wob).rgb;
	vec2 c = (uv - 0.5) * vec2(aspect, 1.0);
	float r = length(c);

	// raios de sol: acumula o brilho do céu na direção do sol (some atrás de objetos)
	if (sun_vis > 0.01 && ray_strength > 0.0) {
		vec2 step_v = (sun_pos - uv) / 22.0 * 0.92;
		vec2 pos = uv;
		float acc = 0.0;
		float w = 1.0;
		float jitter = texture(noise_tex, uv * 3.0 + t * 0.01).a;
		pos += step_v * jitter;
		for (int i = 0; i < 22; i++) {
			pos += step_v;
			vec3 s = texture(screen_tex, clamp(pos, vec2(0.001), vec2(0.999))).rgb;
			float lum = max(s.r, max(s.g, s.b));
			acc += smoothstep(0.9, 1.25, lum) * w;
			w *= 0.95;
		}
		vec2 sd = (uv - sun_pos) * vec2(aspect, 1.0);
		float ang = atan(sd.y, sd.x);
		float streak = 0.6 + 0.4 * texture(noise_tex, vec2(ang * 1.4, t * 0.02)).g;
		float near_sun = exp(-length(sd) * 1.1);
		col += vec3(1.0, 0.93, 0.74) * (acc / 22.0) * ray_strength * sun_vis * streak * (0.35 + near_sun);
	}

	// debaixo d'água: tinta azul-esverdeada, feixes de luz descendo e partículas
	if (underwater > 0.01) {
		vec3 tint = col * vec3(0.5, 0.95, 1.08) + vec3(0.0, 0.07, 0.1);
		vec2 sd = (uv - vec2(sun_pos.x, -0.35)) * vec2(aspect, 1.0);
		float ang = atan(sd.x, sd.y);
		float beams = texture(noise_tex, vec2(ang * 2.2 + t * 0.015, 0.3)).r * texture(noise_tex, vec2(ang * 5.0 - t * 0.02, 0.7)).g;
		beams = smoothstep(0.22, 0.5, beams) * (1.0 - smoothstep(0.1, 1.15, uv.y));
		tint += vec3(0.7, 1.0, 0.92) * beams * 0.4;
		float motes = texture(caustics_tex, uv * vec2(aspect, 1.0) * 1.3 + vec2(t * 0.01, t * 0.02)).b;
		tint += vec3(0.8, 1.0, 1.0) * smoothstep(0.02, 0.0, motes) * 0.25;
		tint *= 1.0 - smoothstep(0.35, 1.1, r) * 0.45;
		col = mix(col, tint, underwater);
	}

	// riscos de velocidade nas bordas
	if (speed > 0.01) {
		float ang2 = atan(c.y, c.x);
		float streaks = texture(noise_tex, vec2(ang2 * 2.6, t * 1.7 + r * 0.4)).b;
		float m = smoothstep(0.62, 0.86, streaks) * smoothstep(0.38, 0.95, r) * speed;
		col = mix(col, vec3(1.0), m * 0.55);
	}
	// foco ao carregar o vento: escurece e esfria as bordas
	if (focus > 0.01) {
		col = mix(col, col * vec3(0.55, 0.85, 0.9), smoothstep(0.25, 0.9, r) * focus * 0.7);
	}

	// dano: borda vermelha em pincelada
	float n = texture(noise_tex, uv * vec2(aspect, 1.0) * 1.1 + t * 0.03).g;
	float edge_m = smoothstep(0.42, 0.98, r + (n - 0.5) * 0.3);
	col = mix(col, vec3(0.75, 0.08, 0.14), edge_m * clamp(hurt, 0.0, 1.0) * 0.75);
	// vida baixa: pulsa e perde cor
	if (low_hp > 0.01) {
		float gray = dot(col, vec3(0.3, 0.59, 0.11));
		float pulse = 0.5 + 0.5 * sin(t * 4.2);
		col = mix(col, vec3(gray), low_hp * 0.35);
		col = mix(col, vec3(0.55, 0.05, 0.1), edge_m * low_hp * (0.25 + 0.3 * pulse));
	}
	// vinheta leve
	col *= 1.0 - smoothstep(0.55, 1.25, r) * 0.2;
	col = mix(col, flash_color.rgb, clamp(flash, 0.0, 1.0) * flash_color.a);
	col = mix(col, fade_color.rgb, clamp(fade, 0.0, 1.0));
	COLOR = vec4(col, 1.0);
}
