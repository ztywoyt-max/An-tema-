// Pós-processo "desenhado" (tela cheia, dentro do 3D):
// 1) efeito pintura (filtro Kuwahara) sobre a cena opaca
// 2) contorno a traço, por profundidade e normais, só do lado do objeto da frente.
shader_type spatial;
render_mode unshaded, cull_disabled, depth_test_disabled, depth_draw_never, fog_disabled;

uniform sampler2D screen_tex : hint_screen_texture, repeat_disable, filter_linear;
uniform sampler2D depth_tex : hint_depth_texture, repeat_disable, filter_nearest;
uniform sampler2D normal_tex : hint_normal_roughness_texture, repeat_disable, filter_nearest;

uniform vec4 line_color : source_color = vec4(0.12, 0.09, 0.26, 1.0);
uniform float line_alpha = 0.85;
uniform float thickness = 1.2;        // em pixels a 1080p
uniform float depth_sens = 0.035;
uniform float normal_sens = 0.42;
uniform int paint_radius = 3;         // 0 desliga o efeito pintura
uniform float paint_step = 1.35;
uniform bool outline_enabled = true;

void vertex() {
	POSITION = vec4(VERTEX.xy, 1.0, 1.0);
}

vec3 kuwahara(vec2 uv, vec2 px, int r) {
	vec3 m0 = vec3(0.0); vec3 m1 = vec3(0.0); vec3 m2 = vec3(0.0); vec3 m3 = vec3(0.0);
	vec3 s0 = vec3(0.0); vec3 s1 = vec3(0.0); vec3 s2 = vec3(0.0); vec3 s3 = vec3(0.0);
	for (int j = 0; j <= r; j++) {
		for (int i = 0; i <= r; i++) {
			vec2 o = vec2(float(i), float(j)) * px;
			vec3 c = min(texture(screen_tex, uv + vec2(-o.x, -o.y)).rgb, vec3(4.0));
			m0 += c; s0 += c * c;
			c = min(texture(screen_tex, uv + vec2(o.x, -o.y)).rgb, vec3(4.0));
			m1 += c; s1 += c * c;
			c = min(texture(screen_tex, uv + vec2(o.x, o.y)).rgb, vec3(4.0));
			m2 += c; s2 += c * c;
			c = min(texture(screen_tex, uv + vec2(-o.x, o.y)).rgb, vec3(4.0));
			m3 += c; s3 += c * c;
		}
	}
	float n = float((r + 1) * (r + 1));
	m0 /= n; m1 /= n; m2 /= n; m3 /= n;
	s0 = abs(s0 / n - m0 * m0); s1 = abs(s1 / n - m1 * m1);
	s2 = abs(s2 / n - m2 * m2); s3 = abs(s3 / n - m3 * m3);
	float g0 = s0.r + s0.g + s0.b; float g1 = s1.r + s1.g + s1.b;
	float g2 = s2.r + s2.g + s2.b; float g3 = s3.r + s3.g + s3.b;
	vec3 res = m0; float g = g0;
	if (g1 < g) { g = g1; res = m1; }
	if (g2 < g) { g = g2; res = m2; }
	if (g3 < g) { g = g3; res = m3; }
	return res;
}

void fragment() {
	vec2 uv = SCREEN_UV;
	vec2 px = 1.0 / VIEWPORT_SIZE;
	float res_scale = VIEWPORT_SIZE.y / 1080.0;
	vec3 col;
	if (paint_radius > 0) {
		col = kuwahara(uv, px * paint_step * max(res_scale, 0.5), paint_radius);
	} else {
		col = texture(screen_tex, uv).rgb;
	}
	float edge = 0.0;
	if (outline_enabled) {
		vec2 o = px * max(thickness * res_scale, 1.0);
		float dc = texture(depth_tex, uv).r;
		float dl = texture(depth_tex, uv - vec2(o.x, 0.0)).r;
		float dr = texture(depth_tex, uv + vec2(o.x, 0.0)).r;
		float du = texture(depth_tex, uv - vec2(0.0, o.y)).r;
		float dd = texture(depth_tex, uv + vec2(0.0, o.y)).r;
		// profundidade invertida (perto = maior): laplaciano positivo = este pixel está na frente
		float lap = (4.0 * dc - dl - dr - du - dd) / max(dc, 1e-6);
		float e_depth = smoothstep(depth_sens, depth_sens * 2.2, lap);
		vec3 nc = texture(normal_tex, uv).xyz * 2.0 - 1.0;
		vec3 nl = texture(normal_tex, uv - vec2(o.x, 0.0)).xyz * 2.0 - 1.0;
		vec3 nr = texture(normal_tex, uv + vec2(o.x, 0.0)).xyz * 2.0 - 1.0;
		vec3 nu = texture(normal_tex, uv - vec2(0.0, o.y)).xyz * 2.0 - 1.0;
		vec3 nd = texture(normal_tex, uv + vec2(0.0, o.y)).xyz * 2.0 - 1.0;
		float nm = max(max(1.0 - dot(nc, nl), 1.0 - dot(nc, nr)), max(1.0 - dot(nc, nu), 1.0 - dot(nc, nd)));
		// vincos: só entre pixels de profundidade parecida, e só do lado convexo/da frente
		float e_norm = smoothstep(normal_sens, normal_sens * 1.6, nm) * step(-depth_sens, lap);
		edge = max(e_depth, e_norm);
		// o céu não tem traço; ao longe o traço some
		edge *= step(1e-7, dc);
		vec4 vp = INV_PROJECTION_MATRIX * vec4(uv * 2.0 - 1.0, dc, 1.0);
		float dist = -vp.z / vp.w;
		edge *= 1.0 - smoothstep(90.0, 260.0, dist);
	}
	ALBEDO = mix(col, line_color.rgb, edge * line_alpha);
	ALPHA = 1.0;
}
