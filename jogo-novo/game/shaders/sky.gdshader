// Céu pintado: degradê saturado, cúmulos no horizonte e nuvens altas que
// andam com o vento, tudo em 3 tons de borda definida.
shader_type sky;

global uniform vec3 wind_vec;
global uniform float sea_time;
global uniform sampler2D clouds_tex : repeat_enable, filter_linear_mipmap;

uniform vec3 zenith : source_color = vec3(0.07, 0.33, 0.83);
uniform vec3 mid : source_color = vec3(0.2, 0.6, 0.95);
uniform vec3 horizon : source_color = vec3(0.66, 0.88, 0.97);
uniform vec3 below : source_color = vec3(0.1, 0.5, 0.66);
uniform vec3 cloud_lit : source_color = vec3(1.0, 0.99, 0.95);
uniform vec3 cloud_mid : source_color = vec3(0.86, 0.9, 0.98);
uniform vec3 cloud_dark : source_color = vec3(0.6, 0.68, 0.9);
uniform vec3 sun_color : source_color = vec3(1.0, 0.96, 0.82);
uniform float cover = 0.7;
uniform float horizon_clouds = 0.62;

void sky() {
	vec3 dir = normalize(EYEDIR);
	float h = dir.y;
	vec3 col = mix(horizon, mid, smoothstep(0.0, 0.22, h));
	col = mix(col, zenith, smoothstep(0.18, 0.85, h));
	if (h < 0.0) {
		col = mix(horizon, below, smoothstep(0.0, -0.08, h));
	}
	vec3 sdir = normalize(LIGHT0_DIRECTION);
	float sd = dot(dir, sdir);
	float t = sea_time;
	vec2 wd = wind_vec.xz * 0.012;

	// --- cúmulos gigantes no horizonte (projeção cilíndrica) ---
	if (!AT_CUBEMAP_PASS && h > -0.02 && h < 0.5) {
		float u = atan(dir.x, dir.z) / TAU;
		float mass = texture(clouds_tex, vec2(u * 3.0 + t * 0.0009, 0.37)).r;
		float bump = texture(clouds_tex, vec2(u * 7.0 + t * 0.0012, h * 1.6 + 0.11)).r;
		float fine = texture(clouds_tex, vec2(u * 21.0, h * 4.0 + 0.5)).g;
		float top = (mass - (1.0 - horizon_clouds)) * 0.6 + (bump - 0.5) * 0.17 + (fine - 0.5) * 0.028;
		float m = smoothstep(top - 0.004, top - 0.011, h);
		if (m > 0.0) {
			float rel = clamp(h / max(top, 0.001), 0.0, 1.0);
			float bump_s = texture(clouds_tex, vec2(u * 7.0 + t * 0.0012 + 0.014, h * 1.6 + 0.17)).r;
			float lit = rel * 0.7 + (bump - bump_s) * 5.0 + (bump - 0.5) * 0.7;
			vec3 cc = mix(cloud_dark, cloud_mid, smoothstep(0.2, 0.26, lit));
			cc = mix(cc, cloud_lit, smoothstep(0.46, 0.52, lit));
			cc = mix(cc, horizon, (1.0 - smoothstep(0.0, 0.06, h)) * 0.7);
			col = mix(col, cc, m);
		}
	}

	// --- nuvens altas (plano projetado), levadas pelo vento ---
	if (!AT_CUBEMAP_PASS && h > 0.02) {
		vec2 uv = dir.xz / (h + 0.22);
		vec2 p = uv * 0.05 + wd * t * 0.25;
		float m = texture(clouds_tex, p).r;
		float det = texture(clouds_tex, p * 2.7 + wd * t * 0.2).g;
		float d = m + (det - 0.5) * 0.22;
		float cov = smoothstep(cover, cover + 0.025, d);
		cov *= smoothstep(0.03, 0.22, h);
		if (cov > 0.0) {
			vec2 so = normalize(sdir.xz + vec2(0.0001)) * 0.03;
			float ml = texture(clouds_tex, p + so).r;
			float lit = (m - ml) * 9.0 + 0.2 - smoothstep(cover + 0.08, cover + 0.3, d) * 0.25;
			vec3 cc = mix(cloud_mid, cloud_lit, smoothstep(0.08, 0.16, lit));
			cc = mix(cloud_dark, cc, smoothstep(-0.34, -0.24, lit));
			col = mix(col, cc, cov * 0.97);
		}
		// fiapos
		float ci = texture(clouds_tex, uv * vec2(0.02, 0.07) + wd * t * 0.5 + 0.3).b;
		col = mix(col, cloud_lit, smoothstep(0.66, 0.92, ci) * 0.3 * smoothstep(0.1, 0.5, h));
	}

	// --- sol ---
	float disc = smoothstep(0.9993, 0.9996, sd);
	float halo = pow(max(sd, 0.0), 180.0) * 0.55 + pow(max(sd, 0.0), 12.0) * 0.16;
	col += sun_color * halo;
	col = mix(col, vec3(1.0, 0.99, 0.92) * 1.6, disc);
	COLOR = col;
}
