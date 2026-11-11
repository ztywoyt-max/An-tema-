extends RefCounted
## Animações do humanoide (protagonista e inimigos), escritas como poses-chave.
## Ver src/anim/anim_builder.gd para o formato.
## Espaço: X = direita, Y = cima, -Z = frente. Ângulos: (pitch frente+, yaw esquerda+, roll direita+).

const Builder := preload("res://src/anim/anim_builder.gd")

static var _cache: Dictionary = {}


static func V(x: float, y: float, z: float) -> Vector3:
	return Vector3(x, y, z)


## Direção "para baixo" girada `deg` graus para a frente (negativo = para trás), aberta `out` para fora.
static func swing(deg: float, out: float = 0.0) -> Vector3:
	var a := deg_to_rad(deg)
	return Vector3(out, -cos(a), -sin(a))


# ----------------------------------------------------------------------------- poses-base

## De pé, relaxado, sabre baixo na mão direita.
static func stance() -> Dictionary:
	return {
		"hips": V(0, -0.04, 0), "hips_rot": V(3, -16, 0),
		"spine": V(2, -4, 0), "chest": V(2, -6, 0), "neck": V(0, 8, 0), "head": V(-3, 14, 0),
		"foot_l": V(-0.12, 0.085, -0.13), "foot_l_rot": V(0, 6, 0),
		"foot_r": V(0.14, 0.085, 0.13), "foot_r_rot": V(0, -30, 0),
		"hand_r": V(0.33, 0.95, -0.1), "elbow_r": V(0.6, -0.6, 0.6),
		"wpn": [V(0.2, -0.5, -0.84), V(0.1, -0.8, 0.5)],
		"arm_l": [V(-0.25, -0.95, 0.1), V(-0.1, -0.9, -0.42)],
	}


## Guarda de combate: mais baixa, sabre à frente apontando para o inimigo.
static func guard() -> Dictionary:
	return {
		"hips": V(0, -0.09, 0), "hips_rot": V(5, -22, 0),
		"spine": V(3, -4, 0), "chest": V(4, -8, 0), "neck": V(-2, 12, 0), "head": V(-4, 20, 0),
		"foot_l": V(-0.14, 0.085, -0.2), "foot_l_rot": V(0, 8, 0),
		"foot_r": V(0.17, 0.085, 0.2), "foot_r_rot": V(0, -38, 0),
		"hand_r": V(0.24, 1.08, -0.3), "elbow_r": V(0.7, -0.6, 0.4),
		"wpn": [V(-0.22, 0.42, -0.88), V(0.1, -0.85, -0.5)],
		"arm_l": [V(-0.35, -0.8, -0.3), V(0.2, 0.25, -0.95)],
	}


## No ar (pés relativos ao quadril): corpo solto, joelhos levemente dobrados.
static func air_base() -> Dictionary:
	return {
		"hips": V(0, 0, 0), "hips_rot": V(6, 0, 0), "spine": V(2, 0, 0), "chest": V(2, 0, 0), "neck": V(-3, 0, 0), "head": V(-4, 0, 0),
		"foot_l": V(-0.1, -0.74, -0.12), "foot_l_rot": V(20, 0, 0), "knee_l": V(-0.15, 0, -1),
		"foot_r": V(0.11, -0.7, 0.14), "foot_r_rot": V(35, 0, 0), "knee_r": V(0.15, 0, -1),
		"arm_r": [V(0.5, -0.8, 0.15), V(0.45, -0.55, -0.6)],
		"wpn_c": [V(0.45, 0.3, -0.84), V(0.2, -0.9, -0.3)],
		"arm_l": [V(-0.6, -0.7, 0.1), V(-0.6, -0.3, -0.6)],
	}


# ----------------------------------------------------------------------------- locomoção

## Ciclo de passada gerado por fórmulas.
## p: stride, lift, sf (fração de apoio), bounce, drop, lean, width, arm, elbow, yaw, chest_yaw,
##    dir (graus; 0 frente, 90 direita, 180 trás), upper (pose-base para tronco/braços), back (braços para trás)
static func gait(clip_name: String, length: float, p: Dictionary, keys_n: int = 12) -> Dictionary:
	var keys := []
	var stride: float = p["stride"]
	var sf: float = p["sf"]
	var dir := deg_to_rad(float(p.get("dir", 0.0)))
	var tv := Vector3(sin(dir), 0.0, -cos(dir))
	var fwd := cos(dir)
	var upper: Dictionary = p.get("upper", {})
	var has_upper := not upper.is_empty()
	var hips0: Vector3 = upper.get("hips", Vector3.ZERO)
	var hrot0: Vector3 = upper.get("hips_rot", Vector3.ZERO)
	for i in keys_n:
		var ph := float(i) / float(keys_n)
		var pose := upper.duplicate() if has_upper else {}
		var two := sin(TAU * 2.0 * ph + float(p.get("bounce_phase", 0.6)))
		pose["hips"] = hips0 + V(float(p.get("sway", 0.012)) * sin(TAU * ph), -float(p["drop"]) + float(p["bounce"]) * two, 0.0)
		pose["hips_rot"] = hrot0 + V(float(p["lean"]), float(p["yaw"]) * cos(TAU * ph) * fwd, float(p.get("roll", 2.0)) * sin(TAU * ph))
		if not has_upper:
			pose["spine"] = V(float(p["lean"]) * 0.25, -float(p["chest_yaw"]) * 0.4 * cos(TAU * ph), 0)
			pose["chest"] = V(float(p["lean"]) * 0.25, -float(p["chest_yaw"]) * 0.6 * cos(TAU * ph), -float(p.get("roll", 2.0)) * sin(TAU * ph))
			pose["neck"] = V(-float(p["lean"]) * 0.45, 0, 0)
			pose["head"] = V(-float(p["lean"]) * 0.55, float(p["chest_yaw"]) * 0.25 * cos(TAU * ph), 0)
		for s: String in ["_r", "_l"]:
			var sx := 1.0 if s == "_r" else -1.0
			var lp := fposmod(ph + (0.0 if s == "_r" else 0.5), 1.0)
			var along: float
			var y := 0.085
			var pitch := 0.0
			if lp < sf:
				var st := lp / sf
				along = lerpf(stride * 0.5, -stride * 0.5, st)
				var off := smoothstep(0.62, 1.0, st)
				y += float(p.get("heel", 0.06)) * off * absf(fwd)
				pitch = (float(p.get("toe_off", 45.0)) * off - float(p.get("heel_strike", 14.0)) * (1.0 - smoothstep(0.0, 0.18, st))) * fwd
			else:
				var sw := (lp - sf) / (1.0 - sf)
				var e := sw * sw * (3.0 - 2.0 * sw)
				along = lerpf(-stride * 0.5, stride * 0.5, e)
				var hgt := pow(sin(PI * pow(sw, float(p.get("skew", 0.8)))), 0.9)
				y += float(p.get("heel", 0.06)) * (1.0 - sw) * absf(fwd) + float(p["lift"]) * hgt
				pitch = lerpf(float(p.get("toe_off", 45.0)) + float(p.get("kick", 20.0)) * sin(PI * minf(sw * 1.6, 1.0)), -float(p.get("heel_strike", 14.0)), smoothstep(0.35, 1.0, sw)) * fwd
			var base := V(sx * float(p["width"]), y, float(p.get("z_off", 0.0)))
			pose["foot" + s] = base + tv * along
			var yaw0 := float(upper.get("foot" + s + "_rot", Vector3.ZERO).y) if has_upper else -sx * float(p.get("toe_out", 6.0))
			pose["foot" + s + "_rot"] = V(pitch, yaw0, 0)
			if has_upper:
				continue
			# braço oposto à perna do mesmo lado
			var a := -float(p["arm"]) * cos(TAU * lp)
			if p.get("back", false):
				var ub := -24.0 + 8.0 * cos(TAU * lp)
				pose["arm" + s] = [swing(ub, sx * 0.28), swing(ub + 14.0, sx * 0.36)]
			else:
				var el: float = float(p["elbow"]) + float(p.get("elbow_swing", 10.0)) * cos(TAU * lp + PI)
				pose["arm" + s] = [swing(a, sx * 0.16), swing(a + el, sx * 0.05)]
		if not has_upper:
			if p.get("back", false):
				pose["wpn_c"] = [V(0.3, -0.4, 0.86), V(0.0, -0.9, -0.4)]
			elif p.has("wpn_c"):
				pose["wpn_c"] = p["wpn_c"]
		keys.append([length * ph, pose])
	return {"name": clip_name, "length": length, "loop": true, "fps": 30, "keys": keys}


## Ciclo de braçada/pernada para nadar. pitch = inclinação do corpo.
static func swim_cycle(clip_name: String, length: float, pitch: float, crawl: bool) -> Dictionary:
	var keys := []
	var n := 8
	for i in n:
		var ph := float(i) / float(n)
		var pose := {
			"hips": V(0, 0.0, 0), "hips_rot": V(pitch, 6.0 * sin(TAU * ph), 10.0 * sin(TAU * ph)),
			"spine": V(-4, 0, 0), "chest": V(-6, -8.0 * sin(TAU * ph), 0), "neck": V(-pitch * 0.35, 0, 0), "head": V(-pitch * 0.4, 0, 0),
		}
		for s: String in ["_r", "_l"]:
			var sx := 1.0 if s == "_r" else -1.0
			var lp := fposmod(ph + (0.0 if s == "_r" else 0.5), 1.0)
			var kick := sin(TAU * lp * (2.0 if crawl else 1.0))
			pose["foot" + s] = V(sx * 0.09, -0.8, 0.06 + 0.2 * kick)
			pose["foot" + s + "_rot"] = V(55.0 + 15.0 * kick, 0, 0)
			if crawl:
				# braçada: o braço dá a volta inteira (ângulo no referencial do peito)
				var a := TAU * lp
				var updir := V(sx * (0.25 + 0.2 * absf(sin(a))), cos(a), -sin(a) * 0.35 - 0.1)
				pose["arm" + s] = [updir, updir + V(0, 0.25 * cos(a) + 0.2, -0.2)]
			else:
				var o := 0.5 + 0.5 * sin(TAU * lp)
				pose["arm" + s] = [V(sx * (0.5 + 0.4 * o), -0.35, -0.6 + 0.3 * o), V(sx * (0.3 + 0.6 * o), 0.0, -0.9 + 0.5 * o)]
		pose["wpn_c"] = [V(0.3, 0.9, -0.2), V(0.6, -0.2, -0.75)] if crawl else [V(0.5, 0.2, -0.85), V(0.3, -0.9, 0.2)]
		keys.append([length * ph, pose])
	return {"name": clip_name, "length": length, "loop": true, "feet": "hips", "fps": 30, "keys": keys}


# ----------------------------------------------------------------------------- lista de clipes

static func all_clips() -> Array:
	var clips := []
	var st := stance()
	var gd := guard()
	var air := air_base()

	# ================================================================ parado e guarda
	clips.append({"name": "idle", "length": 3.6, "loop": true, "base": st, "keys": [
		[0.0, {}],
		[1.8, {"hips": V(0, -0.03, 0.004), "chest": V(-0.5, -6, 0), "head": V(-4, 13, 0), "hand_r": V(0.335, 0.962, -0.1),
			"arm_l": [V(-0.26, -0.95, 0.08), V(-0.11, -0.91, -0.4)]}],
	]})
	clips.append({"name": "guard_idle", "length": 1.8, "loop": true, "base": gd, "keys": [
		[0.0, {}],
		[0.9, {"hips": V(0, -0.105, 0), "chest": V(5, -8, 0), "hand_r": V(0.24, 1.07, -0.3)}],
	]})

	# ================================================================ andar, correr, disparar
	clips.append(gait("walk", 0.96, {"stride": 0.62, "lift": 0.11, "sf": 0.6, "bounce": 0.018, "drop": 0.035, "lean": 3.0, "width": 0.085,
		"arm": 22.0, "elbow": 22.0, "yaw": 7.0, "chest_yaw": 9.0, "heel": 0.05, "toe_off": 35.0, "kick": 5.0, "bounce_phase": 2.2,
		"wpn_c": [V(0.15, -0.35, -0.92), V(0.0, -0.9, 0.4)]}))
	clips.append(gait("run", 0.62, {"stride": 1.02, "lift": 0.27, "sf": 0.4, "bounce": 0.035, "drop": 0.07, "lean": 11.0, "width": 0.065,
		"arm": 38.0, "elbow": 78.0, "yaw": 11.0, "chest_yaw": 16.0, "kick": 30.0, "skew": 0.62,
		"wpn_c": [V(0.2, 0.25, -0.94), V(0.0, -0.95, -0.3)]}))
	clips.append(gait("sprint", 0.5, {"stride": 1.3, "lift": 0.36, "sf": 0.34, "bounce": 0.03, "drop": 0.13, "lean": 30.0, "width": 0.055,
		"arm": 10.0, "elbow": 20.0, "yaw": 13.0, "chest_yaw": 10.0, "kick": 42.0, "skew": 0.55, "back": true}))
	# passos em guarda (alvo travado): frente, trás, direita, esquerda
	var gstep := {"stride": 0.5, "lift": 0.09, "sf": 0.56, "bounce": 0.014, "drop": 0.0, "lean": 0.0, "width": 0.15, "yaw": 0.0, "chest_yaw": 0.0,
		"heel": 0.02, "toe_off": 14.0, "kick": 0.0, "heel_strike": 6.0, "upper": gd, "roll": 1.0}
	for d: Array in [["guard_fwd", 0.0], ["guard_back", 180.0], ["guard_right", 90.0], ["guard_left", -90.0]]:
		var gp := gstep.duplicate()
		gp["dir"] = d[1]
		clips.append(gait(d[0], 0.56, gp, 8))

	# ================================================================ pulo, queda, pouso
	clips.append({"name": "jump", "length": 0.4, "feet": "hips", "base": air, "keys": [
		[0.0, {"hips_rot": V(12, 0, 0), "chest": V(-8, 0, 0), "foot_l": V(-0.1, -0.84, 0.1), "foot_l_rot": V(60, 0, 0), "foot_r": V(0.1, -0.83, 0.2), "foot_r_rot": V(65, 0, 0),
			"arm_l": [V(-0.4, -0.5, -0.75), V(-0.3, 0.4, -0.85)], "arm_r": [V(0.45, -0.75, 0.45), V(0.4, -0.85, -0.2)]}],
		[0.16, {"hips_rot": V(4, 0, 0), "chest": V(-6, 0, 0), "foot_l": V(-0.1, -0.52, -0.3), "foot_l_rot": V(10, 0, 0), "foot_r": V(0.1, -0.8, 0.16), "foot_r_rot": V(55, 0, 0),
			"arm_l": [V(-0.55, 0.1, -0.8), V(-0.4, 0.75, -0.5)], "arm_r": [V(0.6, -0.6, 0.3), V(0.6, -0.4, -0.6)]}],
		[0.4, {"foot_l": V(-0.1, -0.6, -0.22), "foot_r": V(0.11, -0.74, 0.12)}],
	]})
	clips.append({"name": "fall", "length": 0.9, "loop": true, "feet": "hips", "base": air, "keys": [
		[0.0, {"hips_rot": V(2, 0, 0), "arm_l": [V(-0.75, 0.15, -0.3), V(-0.6, 0.7, -0.3)], "arm_r": [V(0.75, -0.25, 0.1), V(0.7, 0.2, -0.5)],
			"foot_l": V(-0.11, -0.66, -0.18), "foot_r": V(0.12, -0.76, 0.1)}],
		[0.45, {"hips_rot": V(5, 0, 0), "arm_l": [V(-0.8, 0.3, -0.2), V(-0.5, 0.85, -0.2)], "arm_r": [V(0.8, -0.15, 0.05), V(0.75, 0.3, -0.45)],
			"foot_l": V(-0.11, -0.7, -0.12), "foot_r": V(0.12, -0.72, 0.16)}],
	]})
	clips.append({"name": "land", "length": 0.32, "base": st, "keys": [
		[0.0, {"hips": V(0, -0.14, 0), "hips_rot": V(12, -10, 0), "chest": V(10, -4, 0), "arm_l": [V(-0.6, -0.6, -0.3), V(-0.5, -0.2, -0.8)],
			"hand_r": V(0.42, 0.9, -0.2), "sharp": true}],
		[0.07, {"hips": V(0, -0.3, 0.02), "hips_rot": V(22, -12, 0), "chest": V(14, -4, 0), "head": V(-14, 12, 0),
			"arm_l": [V(-0.7, -0.5, -0.2), V(-0.5, -0.6, -0.6)], "hand_r": V(0.46, 0.7, -0.18)}],
		[0.32, {}],
	]})
	# pulo duplo: pirueta de vento (gira em torno de si)
	clips.append({"name": "double_jump", "length": 0.5, "feet": "hips", "fps": 60, "base": air, "keys": [
		[0.0, {"hips_rot": V(8, 0, 0), "foot_l": V(-0.1, -0.8, 0.1), "foot_r": V(0.1, -0.8, 0.16)}],
		[0.12, {"hips_rot": V(0, -110, 0), "chest": V(-4, -20, 0), "foot_l": V(-0.08, -0.45, -0.22), "foot_r": V(0.09, -0.6, 0.05),
			"arm_l": [V(-0.3, -0.7, -0.6), V(0.5, 0.1, -0.8)], "arm_r": [V(0.3, -0.7, -0.5), V(-0.3, 0.2, -0.9)]}],
		[0.26, {"hips_rot": V(0, -250, 0), "chest": V(-4, -20, 0), "foot_l": V(-0.08, -0.42, -0.24), "foot_r": V(0.09, -0.55, 0.02),
			"arm_l": [V(-0.3, -0.7, -0.6), V(0.5, 0.1, -0.8)], "arm_r": [V(0.3, -0.7, -0.5), V(-0.3, 0.2, -0.9)]}],
		[0.38, {"hips_rot": V(-4, -350, 0), "chest": V(-10, -6, 0), "foot_l": V(-0.12, -0.62, -0.2), "foot_r": V(0.13, -0.76, 0.14),
			"arm_l": [V(-0.85, 0.2, -0.1), V(-0.7, 0.6, -0.2)], "arm_r": [V(0.85, 0.1, 0.0), V(0.75, 0.5, -0.3)]}],
		[0.5, {"hips_rot": V(4, -360, 0), "arm_l": [V(-0.75, 0.15, -0.3), V(-0.6, 0.7, -0.3)], "arm_r": [V(0.75, -0.25, 0.1), V(0.7, 0.2, -0.5)]}],
	]})

	# ================================================================ investidas
	clips.append({"name": "dash_f", "length": 0.34, "fps": 60, "base": gd, "keys": [
		[0.0, {"hips": V(0, -0.2, -0.04), "hips_rot": V(30, 0, 0), "chest": V(10, 0, 0), "neck": V(-12, 0, 0), "head": V(-16, 0, 0),
			"arm_l": [swing(-14, -0.3), swing(-4, -0.35)], "arm_r": [swing(-18, 0.3), swing(-8, 0.38)], "wpn_c": [V(0.3, -0.5, 0.8), V(0, -0.85, -0.5)],
			"foot_l": V(-0.1, 0.12, -0.5), "foot_l_rot": V(-10, 0, 0), "foot_r": V(0.1, 0.24, 0.62), "foot_r_rot": V(70, 0, 0), "sharp": true}],
		[0.18, {"hips": V(0, -0.24, -0.06), "hips_rot": V(38, 0, 0), "chest": V(12, 0, 0), "neck": V(-14, 0, 0), "head": V(-18, 0, 0),
			"arm_l": [swing(-20, -0.3), swing(-10, -0.35)], "arm_r": [swing(-24, 0.3), swing(-14, 0.38)], "wpn_c": [V(0.3, -0.5, 0.8), V(0, -0.85, -0.5)],
			"foot_l": V(-0.1, 0.1, -0.55), "foot_l_rot": V(-10, 0, 0), "foot_r": V(0.1, 0.3, 0.68), "foot_r_rot": V(75, 0, 0)}],
		[0.34, {"hips": V(0, -0.1, 0), "hips_rot": V(14, 0, 0), "chest": V(6, 0, 0), "head": V(-8, 0, 0), "foot_l": V(-0.09, 0.085, 0.25), "foot_l_rot": V(30, 0, 0),
			"foot_r": V(0.09, 0.2, -0.3), "foot_r_rot": V(0, 0, 0), "arm_l": [swing(30, -0.16), swing(100, -0.05)], "arm_r": [swing(-30, 0.16), swing(40, 0.05)]}],
	]})
	clips.append({"name": "dash_b", "length": 0.34, "fps": 60, "base": gd, "keys": [
		[0.0, {"hips": V(0, -0.14, 0.1), "hips_rot": V(16, -10, 0), "chest": V(8, -6, 0), "foot_l": V(-0.14, 0.2, -0.42), "foot_l_rot": V(-12, 6, 0),
			"foot_r": V(0.16, 0.12, 0.3), "foot_r_rot": V(10, -30, 0), "hand_r": V(0.2, 1.0, -0.42), "arm_l": [V(-0.3, -0.6, -0.7), V(0.1, 0.3, -0.95)], "sharp": true}],
		[0.16, {"hips": V(0, -0.1, 0.14), "hips_rot": V(18, -12, 0), "chest": V(10, -6, 0), "foot_l": V(-0.14, 0.26, -0.3), "foot_l_rot": V(-8, 6, 0),
			"foot_r": V(0.16, 0.2, 0.36), "foot_r_rot": V(25, -30, 0), "hand_r": V(0.2, 1.02, -0.44), "arm_l": [V(-0.3, -0.6, -0.7), V(0.1, 0.3, -0.95)]}],
		[0.34, {}],
	]})
	var dash_side := {"name": "dash_r", "length": 0.34, "fps": 60, "base": gd, "keys": [
		[0.0, {"hips": V(0.1, -0.2, 0), "hips_rot": V(8, -22, 22), "chest": V(4, -8, 8), "head": V(-4, 20, -14), "foot_r": V(0.42, 0.16, 0.05), "foot_r_rot": V(0, -38, 20),
			"foot_l": V(-0.22, 0.2, 0.0), "foot_l_rot": V(20, 8, 0), "hand_r": V(0.4, 0.95, -0.24), "arm_l": [V(-0.3, -0.9, -0.2), V(0.3, -0.2, -0.9)], "sharp": true}],
		[0.16, {"hips": V(0.14, -0.22, 0), "hips_rot": V(8, -22, 28), "chest": V(4, -8, 10), "head": V(-4, 20, -18), "foot_r": V(0.5, 0.12, 0.05), "foot_r_rot": V(0, -38, 24),
			"foot_l": V(-0.1, 0.28, 0.0), "foot_l_rot": V(25, 8, 0), "hand_r": V(0.42, 0.93, -0.24), "arm_l": [V(-0.3, -0.9, -0.2), V(0.3, -0.2, -0.9)]}],
		[0.34, {}],
	]}
	clips.append(dash_side)
	clips.append(_mirrored_clip(dash_side, "dash_l"))

	# ================================================================ deslizar, planar, vento
	clips.append({"name": "slide", "length": 1.0, "loop": true, "base": gd, "keys": [
		[0.0, {"hips": V(0.02, -0.6, 0.12), "hips_rot": V(-28, -14, 6), "spine": V(4, -2, 0), "chest": V(10, -6, 0), "neck": V(6, 6, 0), "head": V(8, 10, 0),
			"foot_l": V(-0.1, 0.12, -0.68), "foot_l_rot": V(-28, 0, 0), "foot_r": V(0.2, 0.085, -0.18), "foot_r_rot": V(0, -20, 0), "knee_r": V(0.5, 0, -1),
			"hand_l": V(-0.36, 0.22, 0.34), "elbow_l": V(-0.6, 0.2, 1.0), "hand_r": V(0.42, 0.62, -0.08), "wpn": [V(0.25, 0.5, 0.83), V(0.2, -0.8, 0.5)]}],
		[0.5, {"hips": V(0.02, -0.58, 0.12), "hips_rot": V(-26, -14, 4), "spine": V(4, -2, 0), "chest": V(10, -6, 0), "neck": V(6, 6, 0), "head": V(8, 10, 0),
			"foot_l": V(-0.1, 0.13, -0.68), "foot_l_rot": V(-28, 0, 0), "foot_r": V(0.2, 0.085, -0.18), "foot_r_rot": V(0, -20, 0), "knee_r": V(0.5, 0, -1),
			"hand_l": V(-0.36, 0.22, 0.34), "elbow_l": V(-0.6, 0.2, 1.0), "hand_r": V(0.42, 0.64, -0.08), "wpn": [V(0.25, 0.5, 0.83), V(0.2, -0.8, 0.5)]}],
	]})
	clips.append({"name": "glide", "length": 1.6, "loop": true, "feet": "hips", "base": air, "keys": [
		[0.0, {"hips_rot": V(58, 0, 4), "spine": V(-6, 0, 0), "chest": V(-10, 0, -3), "neck": V(-20, 0, 0), "head": V(-22, 0, 0),
			"arm_l": [V(-0.9, 0.1, 0.4), V(-0.8, 0.05, 0.6)], "arm_r": [V(0.9, 0.1, 0.4), V(0.8, 0.05, 0.6)], "wpn_c": [V(0.4, 0.0, 0.92), V(0.0, -1.0, 0.0)],
			"foot_l": V(-0.1, -0.83, 0.08), "foot_l_rot": V(62, 0, 0), "foot_r": V(0.1, -0.8, 0.2), "foot_r_rot": V(66, 0, 0)}],
		[0.8, {"hips_rot": V(55, 0, -4), "spine": V(-6, 0, 0), "chest": V(-10, 0, 3), "neck": V(-20, 0, 0), "head": V(-22, 0, 0),
			"arm_l": [V(-0.9, 0.18, 0.35), V(-0.8, 0.12, 0.55)], "arm_r": [V(0.9, 0.04, 0.45), V(0.8, 0.0, 0.62)], "wpn_c": [V(0.4, 0.0, 0.92), V(0.0, -1.0, 0.0)],
			"foot_l": V(-0.1, -0.8, 0.18), "foot_l_rot": V(66, 0, 0), "foot_r": V(0.1, -0.83, 0.1), "foot_r_rot": V(62, 0, 0)}],
	]})
	clips.append({"name": "wind_charge", "length": 0.8, "loop": true, "base": gd, "keys": [
		[0.0, {"hips": V(0, -0.26, 0.03), "hips_rot": V(20, -30, 0), "chest": V(12, -14, 0), "head": V(-14, 40, 0), "foot_l": V(-0.16, 0.085, -0.3), "foot_r": V(0.2, 0.085, 0.3), "foot_r_rot": V(30, -38, 0),
			"hand_l": V(-0.1, 0.9, -0.34), "elbow_l": V(-0.8, -0.4, 0.3), "hand_r": V(0.42, 0.78, 0.26), "wpn": [V(0.2, 0.25, 0.94), V(0.1, -0.95, 0.2)]}],
		[0.4, {"hips": V(0, -0.28, 0.03), "hips_rot": V(22, -30, 0), "chest": V(13, -14, 0), "head": V(-14, 40, 0), "foot_l": V(-0.16, 0.085, -0.3), "foot_r": V(0.2, 0.085, 0.3), "foot_r_rot": V(30, -38, 0),
			"hand_l": V(-0.1, 0.89, -0.35), "elbow_l": V(-0.8, -0.4, 0.3), "hand_r": V(0.43, 0.77, 0.27), "wpn": [V(0.2, 0.25, 0.94), V(0.1, -0.95, 0.2)]}],
	]})
	clips.append({"name": "wind_burst", "length": 0.6, "loop": true, "feet": "hips", "base": air, "keys": [
		[0.0, {"hips_rot": V(72, 0, 0), "spine": V(-4, 0, 0), "chest": V(-8, 14, 0), "neck": V(-26, 0, 0), "head": V(-28, 0, 0),
			"arm_l": [V(-0.25, 0.9, -0.3), V(-0.1, 1.0, -0.1)], "arm_r": [swing(-70, 0.25), swing(-62, 0.3)], "wpn_c": [V(0.3, -0.4, 0.86), V(0, -0.9, -0.4)],
			"foot_l": V(-0.08, -0.84, 0.06), "foot_l_rot": V(70, 0, 0), "foot_r": V(0.08, -0.82, 0.14), "foot_r_rot": V(70, 0, 0)}],
		[0.3, {"hips_rot": V(72, 0, 0), "spine": V(-4, 0, 0), "chest": V(-8, 14, 0), "neck": V(-26, 0, 0), "head": V(-28, 0, 0),
			"arm_l": [V(-0.25, 0.9, -0.3), V(-0.1, 1.0, -0.1)], "arm_r": [swing(-70, 0.25), swing(-62, 0.3)], "wpn_c": [V(0.3, -0.4, 0.86), V(0, -0.9, -0.4)],
			"foot_l": V(-0.08, -0.82, 0.14), "foot_l_rot": V(70, 0, 0), "foot_r": V(0.08, -0.84, 0.06), "foot_r_rot": V(70, 0, 0)}],
	]})

	# ================================================================ parede e borda
	var wr := gait("wallrun_r", 0.52, {"stride": 0.9, "lift": 0.24, "sf": 0.4, "bounce": 0.03, "drop": 0.1, "lean": 12.0, "width": 0.07,
		"arm": 30.0, "elbow": 60.0, "yaw": 8.0, "chest_yaw": 8.0, "kick": 28.0, "skew": 0.62, "roll": 2.0})
	for k: Array in wr["keys"]:
		var pose: Dictionary = k[1]
		pose["hips_rot"] = (pose["hips_rot"] as Vector3) + V(0, 0, -24)
		pose["hips"] = (pose["hips"] as Vector3) + V(-0.1, 0, 0)
		pose.erase("arm_r")
		pose["hand_r"] = V(0.5, 1.35, -0.1)
		pose["elbow_r"] = V(0.4, -0.9, 0.5)
		pose["wpn"] = [V(0.2, 0.95, -0.2), V(0.9, -0.2, -0.3)]
		pose["arm_l"] = [V(-0.8, -0.35, 0.1), V(-0.8, 0.1, -0.5)]
		pose["chest"] = (pose["chest"] as Vector3) + V(0, 0, 12)
		pose["head"] = (pose["head"] as Vector3) + V(0, 0, 10)
	clips.append(wr)
	clips.append(_mirrored_clip(wr, "wallrun_l"))
	var hang := {"hips_rot": V(4, 0, 0), "chest": V(-6, 0, 0), "neck": V(-14, 0, 0), "head": V(-18, 0, 0),
		"hand_r": V(0.2, 1.9, -0.3), "elbow_r": V(1.0, -0.3, 0.3), "hand_l": V(-0.2, 1.9, -0.3), "elbow_l": V(-1.0, -0.3, 0.3),
		"wpn": [V(0.95, 0.25, -0.1), V(0.0, -0.3, -0.95)],
		"foot_l": V(-0.1, -0.6, -0.24), "foot_l_rot": V(-10, 0, 0), "foot_r": V(0.1, -0.72, -0.2), "foot_r_rot": V(-6, 0, 0)}
	clips.append({"name": "ledge_hang", "length": 2.0, "loop": true, "feet": "hips", "base": hang, "keys": [
		[0.0, {}],
		[1.0, {"hips": V(0, -0.015, 0.01), "foot_r": V(0.1, -0.73, -0.19)}],
	]})
	clips.append({"name": "mantle", "length": 0.5, "feet": "hips", "fps": 60, "base": hang, "keys": [
		[0.0, {}],
		[0.2, {"hips_rot": V(14, 0, 0), "chest": V(4, 0, 0), "head": V(-10, 0, 0), "hand_r": V(0.24, 1.36, -0.3), "hand_l": V(-0.24, 1.36, -0.3),
			"elbow_r": V(1.0, 0.2, 0.6), "elbow_l": V(-1.0, 0.2, 0.6), "foot_l": V(-0.1, -0.5, -0.26), "foot_r": V(0.1, -0.66, -0.16)}],
		[0.36, {"hips_rot": V(24, 0, 0), "chest": V(8, 0, 0), "head": V(-14, 0, 0), "hand_r": V(0.28, 0.9, -0.2), "hand_l": V(-0.28, 0.9, -0.2),
			"elbow_r": V(1.0, 0.3, 0.8), "elbow_l": V(-1.0, 0.3, 0.8), "foot_l": V(-0.1, -0.42, -0.34), "foot_l_rot": V(0, 0, 0), "foot_r": V(0.1, -0.8, 0.1), "foot_r_rot": V(40, 0, 0)}],
		[0.5, {"hips_rot": V(8, 0, 0), "chest": V(4, 0, 0), "head": V(-6, 0, 0), "hand_r": V(0.34, 0.92, -0.08), "hand_l": V(-0.3, 0.9, -0.05),
			"foot_l": V(-0.1, -0.82, -0.08), "foot_l_rot": V(0, 0, 0), "foot_r": V(0.1, -0.84, 0.08), "foot_r_rot": V(0, 0, 0)}],
	]})

	# ================================================================ nadar
	clips.append({"name": "swim_idle", "length": 1.6, "loop": true, "feet": "hips", "base": air, "keys": [
		[0.0, {"hips_rot": V(8, 0, 0), "chest": V(-4, 0, 0), "arm_l": [V(-0.75, -0.3, -0.5), V(-0.85, 0.05, -0.5)], "arm_r": [V(0.75, -0.3, -0.5), V(0.85, 0.05, -0.5)],
			"wpn_c": [V(0.6, 0.5, -0.6), V(0.2, -0.8, -0.5)], "foot_l": V(-0.14, -0.74, -0.2), "foot_r": V(0.14, -0.78, 0.18), "foot_l_rot": V(40, 0, 0), "foot_r_rot": V(50, 0, 0)}],
		[0.8, {"hips": V(0, 0.03, 0), "hips_rot": V(8, 0, 0), "chest": V(-4, 0, 0), "arm_l": [V(-0.6, -0.4, -0.65), V(-0.4, -0.1, -0.9)], "arm_r": [V(0.6, -0.4, -0.65), V(0.4, -0.1, -0.9)],
			"wpn_c": [V(0.6, 0.5, -0.6), V(0.2, -0.8, -0.5)], "foot_l": V(-0.14, -0.78, 0.18), "foot_r": V(0.14, -0.74, -0.2), "foot_l_rot": V(50, 0, 0), "foot_r_rot": V(40, 0, 0)}],
	]})
	clips.append(swim_cycle("swim", 1.0, 72.0, true))
	clips.append(swim_cycle("dive", 1.1, 84.0, false))

	# ================================================================ combo leve (sabre)
	var l1_end := {"hips": V(-0.04, -0.14, -0.1), "hips_rot": V(10, 26, 0), "spine": V(6, 8, 0), "chest": V(10, 18, 0), "head": V(-6, -40, 0),
		"hand_r": V(-0.36, 0.88, -0.16), "elbow_r": V(0.3, -0.9, 0.5), "wpn": [V(-0.72, -0.42, 0.55), V(0.2, -0.85, -0.45)],
		"hand_l": V(-0.42, 1.0, 0.2), "foot_l": V(-0.14, 0.085, -0.4), "foot_l_rot": V(0, 14, 0), "foot_r_rot": V(34, -30, 0)}
	# L1: corte diagonal da direita-alta para a esquerda-baixa
	clips.append({"name": "atk_l1", "length": 0.56, "fps": 60, "base": gd, "keys": [
		[0.0, {}],
		[0.1, {"hips": V(0.03, -0.07, 0.04), "hips_rot": V(2, -34, 0), "spine": V(0, -8, 0), "chest": V(-4, -16, 0), "head": V(-2, 44, 0),
			"hand_r": V(0.42, 1.56, 0.16), "elbow_r": V(1.0, 0.1, 0.5), "wpn": [V(0.3, 0.72, 0.62), V(-0.4, 0.55, -0.73)],
			"hand_l": V(-0.2, 1.22, -0.36), "foot_l": V(-0.14, 0.085, -0.24)}],
		[0.155, {"hips": V(0.0, -0.1, -0.05), "hips_rot": V(6, -8, 0), "spine": V(3, -2, 0), "chest": V(6, -2, 0), "head": V(-4, 12, 0),
			"hand_r": V(0.3, 1.36, -0.44), "elbow_r": V(1.0, -0.5, 0.2), "wpn": [V(0.5, 0.42, -0.76), V(-0.7, -0.6, -0.4)],
			"hand_l": V(-0.32, 1.1, -0.1), "foot_l": V(-0.14, 0.085, -0.34)}],
		[0.2, {"hips": V(-0.03, -0.13, -0.1), "hips_rot": V(9, 16, 0), "spine": V(5, 6, 0), "chest": V(9, 14, 0), "head": V(-6, -26, 0),
			"hand_r": V(-0.1, 1.02, -0.52), "elbow_r": V(0.6, -0.8, 0.3), "wpn": [V(-0.6, -0.28, -0.75), V(-0.65, -0.5, 0.57)],
			"hand_l": V(-0.4, 1.02, 0.12), "foot_l": V(-0.14, 0.085, -0.4), "foot_l_rot": V(0, 14, 0), "foot_r_rot": V(28, -30, 0)}],
		[0.29, l1_end],
		[0.56, {"foot_l": V(-0.14, 0.085, -0.3)}],
	]})
	# L2: revés horizontal da esquerda para a direita, passo com o pé direito
	var l2_end := {"hips": V(0.04, -0.12, -0.08), "hips_rot": V(8, -34, 0), "spine": V(4, -8, 0), "chest": V(8, -22, 0), "head": V(-6, 52, 0),
		"hand_r": V(0.54, 1.2, 0.06), "elbow_r": V(1.0, -0.4, 0.6), "wpn": [V(0.8, 0.12, 0.58), V(0.3, -0.5, -0.8)],
		"hand_l": V(-0.3, 1.1, -0.3), "foot_l": V(-0.15, 0.085, 0.2), "foot_l_rot": V(30, 20, 0), "foot_r": V(0.16, 0.085, -0.34), "foot_r_rot": V(0, -12, 0)}
	clips.append({"name": "atk_l2", "length": 0.52, "fps": 60, "base": gd, "keys": [
		[0.0, l1_end],
		[0.07, {"hips": V(-0.05, -0.15, -0.06), "hips_rot": V(10, 34, 0), "spine": V(6, 10, 0), "chest": V(10, 22, 0), "head": V(-6, -54, 0),
			"hand_r": V(-0.42, 1.02, -0.04), "elbow_r": V(0.2, -0.9, 0.6), "wpn": [V(-0.78, 0.12, 0.6), V(0.4, -0.3, 0.86)],
			"hand_l": V(-0.4, 1.0, 0.24), "foot_l": V(-0.14, 0.085, -0.3), "foot_l_rot": V(0, 14, 0), "foot_r": V(0.16, 0.14, 0.1), "foot_r_rot": V(20, -30, 0)}],
		[0.13, {"hips": V(0.0, -0.13, -0.08), "hips_rot": V(9, 4, 0), "spine": V(5, 0, 0), "chest": V(9, 0, 0), "head": V(-6, -4, 0),
			"hand_r": V(-0.04, 1.22, -0.52), "elbow_r": V(0.7, -0.7, 0.3), "wpn": [V(-0.82, 0.1, -0.56), V(0.55, 0.0, -0.83)],
			"hand_l": V(-0.36, 1.05, 0.0), "foot_l": V(-0.14, 0.085, -0.1), "foot_l_rot": V(10, 16, 0), "foot_r": V(0.16, 0.16, -0.16), "foot_r_rot": V(-10, -20, 0)}],
		[0.185, {"hips": V(0.03, -0.13, -0.09), "hips_rot": V(8, -20, 0), "spine": V(4, -5, 0), "chest": V(8, -14, 0), "head": V(-6, 34, 0),
			"hand_r": V(0.34, 1.24, -0.42), "elbow_r": V(1.0, -0.5, 0.3), "wpn": [V(0.55, 0.12, -0.82), V(0.8, -0.2, 0.55)],
			"hand_l": V(-0.32, 1.08, -0.2), "foot_l": V(-0.15, 0.085, 0.1), "foot_l_rot": V(22, 18, 0), "foot_r": V(0.16, 0.085, -0.32), "foot_r_rot": V(0, -14, 0)}],
		[0.27, l2_end],
		[0.52, {"foot_l": V(-0.14, 0.085, -0.2), "foot_r": V(0.17, 0.085, 0.2)}],
	]})
	# L3: corte ascendente da direita-baixa para a esquerda-alta
	var l3_end := {"hips": V(-0.02, -0.03, -0.1), "hips_rot": V(2, 22, 0), "spine": V(-2, 6, 0), "chest": V(-8, 16, 0), "head": V(-10, -34, 0),
		"hand_r": V(-0.28, 1.66, -0.1), "elbow_r": V(0.6, 0.4, 0.4), "wpn": [V(-0.5, 0.74, 0.44), V(-0.6, 0.1, -0.8)],
		"hand_l": V(-0.45, 0.95, 0.2), "foot_l": V(-0.15, 0.085, 0.16), "foot_l_rot": V(40, 20, 0), "foot_r": V(0.14, 0.085, -0.36), "foot_r_rot": V(0, -8, 0)}
	clips.append({"name": "atk_l3", "length": 0.54, "fps": 60, "base": gd, "keys": [
		[0.0, l2_end],
		[0.08, {"hips": V(0.05, -0.2, -0.04), "hips_rot": V(12, -40, 0), "spine": V(6, -8, 0), "chest": V(12, -20, 0), "head": V(-8, 56, 0),
			"hand_r": V(0.48, 0.82, 0.16), "elbow_r": V(0.8, -0.3, 0.9), "wpn": [V(0.45, -0.68, 0.58), V(0.6, 0.2, -0.77)],
			"hand_l": V(-0.3, 1.12, -0.3), "foot_l": V(-0.15, 0.085, 0.2), "foot_l_rot": V(30, 20, 0), "foot_r": V(0.16, 0.085, -0.34), "foot_r_rot": V(0, -12, 0)}],
		[0.14, {"hips": V(0.02, -0.17, -0.08), "hips_rot": V(10, -14, 0), "spine": V(4, -3, 0), "chest": V(8, -6, 0), "head": V(-8, 20, 0),
			"hand_r": V(0.3, 0.98, -0.42), "elbow_r": V(1.0, -0.6, 0.4), "wpn": [V(0.5, -0.4, -0.77), V(-0.5, 0.6, -0.62)],
			"hand_l": V(-0.36, 1.05, -0.1), "foot_l": V(-0.15, 0.085, 0.2), "foot_l_rot": V(34, 20, 0), "foot_r": V(0.15, 0.085, -0.35), "foot_r_rot": V(0, -10, 0)}],
		[0.19, {"hips": V(-0.01, -0.08, -0.1), "hips_rot": V(6, 10, 0), "spine": V(1, 3, 0), "chest": V(0, 8, 0), "head": V(-10, -16, 0),
			"hand_r": V(-0.04, 1.36, -0.5), "elbow_r": V(1.0, -0.2, 0.3), "wpn": [V(-0.3, 0.6, -0.74), V(-0.75, 0.3, 0.58)],
			"hand_l": V(-0.42, 0.98, 0.1), "foot_l": V(-0.15, 0.085, 0.18), "foot_l_rot": V(38, 20, 0), "foot_r": V(0.14, 0.085, -0.36), "foot_r_rot": V(0, -8, 0)}],
		[0.28, l3_end],
		[0.54, {"foot_l": V(-0.14, 0.085, -0.2), "foot_r": V(0.17, 0.085, 0.2)}],
	]})
	# L4 (arremate): salto curto e golpe vertical com as duas mãos
	clips.append({"name": "atk_l4", "length": 0.86, "fps": 60, "base": gd, "keys": [
		[0.0, l3_end],
		[0.13, {"hips": V(0, 0.1, 0.0), "hips_rot": V(-8, 0, 0), "spine": V(-6, 0, 0), "chest": V(-14, 0, 0), "neck": V(4, 0, 0), "head": V(0, 0, 0),
			"hand_r": V(0.08, 1.9, 0.1), "elbow_r": V(1.0, 0.3, -0.2), "wpn": [V(0.0, 0.55, 0.84), V(0.0, 0.84, -0.55)], "grip_l": -0.11, "elbow_l": V(-1.0, 0.3, -0.2),
			"foot_l": V(-0.13, 0.32, -0.12), "foot_l_rot": V(30, 6, 0), "foot_r": V(0.13, 0.26, 0.2), "foot_r_rot": V(50, -10, 0)}],
		[0.22, {"hips": V(0, 0.04, -0.06), "hips_rot": V(6, 0, 0), "spine": V(4, 0, 0), "chest": V(6, 0, 0), "head": V(-6, 0, 0),
			"hand_r": V(0.05, 1.62, -0.42), "elbow_r": V(1.0, -0.2, 0.0), "wpn": [V(0.0, 0.8, -0.6), V(0.0, -0.6, -0.8)], "grip_l": -0.11, "elbow_l": V(-1.0, -0.2, 0.0),
			"foot_l": V(-0.16, 0.2, -0.26), "foot_l_rot": V(0, 8, 0), "foot_r": V(0.16, 0.2, 0.2), "foot_r_rot": V(30, -20, 0)}],
		[0.285, {"hips": V(0, -0.34, -0.06), "hips_rot": V(26, 0, 0), "spine": V(12, 0, 0), "chest": V(16, 0, 0), "neck": V(-14, 0, 0), "head": V(-18, 0, 0),
			"hand_r": V(0.04, 0.72, -0.56), "elbow_r": V(1.0, -0.5, 0.2), "wpn": [V(0.0, -0.3, -0.95), V(0.0, -0.95, 0.3)], "grip_l": -0.11, "elbow_l": V(-1.0, -0.5, 0.2),
			"foot_l": V(-0.22, 0.085, -0.34), "foot_l_rot": V(0, 14, 0), "foot_r": V(0.22, 0.085, 0.24), "foot_r_rot": V(20, -30, 0), "sharp": true}],
		[0.46, {"hips": V(0, -0.31, -0.05), "hips_rot": V(24, 0, 0), "spine": V(11, 0, 0), "chest": V(15, 0, 0), "neck": V(-14, 0, 0), "head": V(-18, 0, 0),
			"hand_r": V(0.04, 0.76, -0.55), "elbow_r": V(1.0, -0.5, 0.2), "wpn": [V(0.0, -0.26, -0.96), V(0.0, -0.96, 0.26)], "grip_l": -0.11, "elbow_l": V(-1.0, -0.5, 0.2),
			"foot_l": V(-0.22, 0.085, -0.34), "foot_l_rot": V(0, 14, 0), "foot_r": V(0.22, 0.085, 0.24), "foot_r_rot": V(20, -30, 0)}],
		[0.86, {}],
	]})

	# ================================================================ ataques pesados
	# H1: grande corte horizontal girando o corpo todo (segurar = carregar na pose de 0,24 s)
	var h1_wind := {"hips": V(0.06, -0.2, 0.08), "hips_rot": V(8, -52, 0), "spine": V(2, -12, 0), "chest": V(4, -30, 0), "neck": V(0, 30, 0), "head": V(-4, 58, 0),
		"hand_r": V(0.5, 1.02, 0.42), "elbow_r": V(0.9, 0.2, 0.9), "wpn": [V(0.55, 0.1, 0.83), V(0.75, -0.3, -0.58)],
		"hand_l": V(-0.1, 1.25, -0.42), "foot_l": V(-0.16, 0.085, -0.3), "foot_r": V(0.2, 0.085, 0.3), "foot_r_rot": V(10, -50, 0)}
	clips.append({"name": "atk_charge", "length": 0.6, "loop": true, "base": h1_wind, "keys": [
		[0.0, {}],
		[0.3, {"hips": V(0.06, -0.215, 0.085), "hand_r": V(0.51, 1.01, 0.43), "chest": V(5, -31, 0)}],
	]})
	clips.append({"name": "atk_h1", "length": 0.82, "fps": 60, "base": gd, "keys": [
		[0.0, {}],
		[0.24, h1_wind],
		[0.31, {"hips": V(0.0, -0.2, -0.04), "hips_rot": V(12, -10, 0), "spine": V(5, -2, 0), "chest": V(10, -4, 0), "head": V(-6, 14, 0),
			"hand_r": V(0.5, 1.06, -0.36), "elbow_r": V(1.0, -0.4, 0.4), "wpn": [V(0.8, 0.05, -0.6), V(-0.6, -0.1, -0.8)],
			"hand_l": V(-0.3, 1.15, -0.2), "foot_l": V(-0.16, 0.085, -0.38), "foot_r": V(0.2, 0.085, 0.3), "foot_r_rot": V(30, -40, 0)}],
		[0.36, {"hips": V(-0.04, -0.2, -0.1), "hips_rot": V(14, 30, 0), "spine": V(6, 8, 0), "chest": V(12, 20, 0), "head": V(-6, -44, 0),
			"hand_r": V(-0.12, 1.04, -0.56), "elbow_r": V(0.7, -0.7, 0.3), "wpn": [V(-0.55, 0.0, -0.84), V(-0.84, -0.05, 0.55)],
			"hand_l": V(-0.45, 1.05, 0.15), "foot_l": V(-0.16, 0.085, -0.42), "foot_l_rot": V(0, 20, 0), "foot_r": V(0.2, 0.085, 0.3), "foot_r_rot": V(44, -30, 0)}],
		[0.46, {"hips": V(-0.06, -0.22, -0.1), "hips_rot": V(14, 62, 0), "spine": V(6, 12, 0), "chest": V(12, 30, 0), "neck": V(0, -30, 0), "head": V(-6, -60, 0),
			"hand_r": V(-0.5, 1.0, 0.1), "elbow_r": V(0.2, -0.8, 0.7), "wpn": [V(-0.75, -0.1, 0.65), V(0.6, -0.2, 0.77)],
			"hand_l": V(-0.45, 1.0, 0.3), "foot_l": V(-0.16, 0.085, -0.42), "foot_l_rot": V(0, 24, 0), "foot_r": V(0.2, 0.085, 0.3), "foot_r_rot": V(50, -20, 0)}],
		[0.82, {}],
	]})
	# H após L1: giro completo com o sabre estendido (pés acompanham o quadril)
	clips.append({"name": "atk_spin", "length": 0.74, "feet": "hips", "fps": 60, "base": air, "keys": [
		[0.0, {"hips": V(0, -0.14, 0), "hips_rot": V(10, 40, 0), "chest": V(8, 20, 0), "head": V(-6, -40, 0), "foot_l": V(-0.18, -0.74, -0.22), "foot_l_rot": V(0, 0, 0),
			"foot_r": V(0.2, -0.74, 0.2), "foot_r_rot": V(20, 0, 0), "arm_r": [V(-0.2, -0.5, -0.8), V(-0.8, -0.2, -0.3)], "wpn_c": [V(-0.6, 0.0, 0.8), V(0.8, 0, 0.6)],
			"arm_l": [V(-0.6, -0.6, 0.3), V(-0.5, -0.2, 0.8)]}],
		[0.14, {"hips": V(0, -0.2, 0), "hips_rot": V(10, 70, 0), "chest": V(8, 26, 0), "head": V(-6, -50, 0), "foot_l": V(-0.2, -0.68, -0.2), "foot_r": V(0.22, -0.68, 0.2),
			"arm_r": [V(-0.3, -0.4, -0.85), V(-0.9, -0.1, -0.2)], "wpn_c": [V(-0.7, 0.05, 0.7), V(0.7, 0, 0.7)], "arm_l": [V(-0.7, -0.5, 0.3), V(-0.5, -0.2, 0.8)]}],
		[0.26, {"hips": V(0, -0.1, 0), "hips_rot": V(12, -60, 0), "chest": V(8, -24, 0), "head": V(-6, 30, 0), "foot_l": V(-0.2, -0.6, -0.14), "foot_l_rot": V(30, 0, 0), "foot_r": V(0.24, -0.66, 0.16),
			"arm_r": [V(0.8, -0.1, -0.55), V(0.9, 0.0, -0.4)], "wpn_c": [V(0.8, 0.02, -0.6), V(0.6, 0, 0.8)], "arm_l": [V(-0.8, -0.3, 0.4), V(-0.7, -0.1, 0.7)]}],
		[0.38, {"hips": V(0, -0.1, 0), "hips_rot": V(12, -200, 0), "chest": V(8, -24, 0), "head": V(-6, 30, 0), "foot_l": V(-0.2, -0.6, -0.14), "foot_l_rot": V(30, 0, 0), "foot_r": V(0.24, -0.66, 0.16),
			"arm_r": [V(0.85, -0.1, -0.45), V(0.95, 0.0, -0.25)], "wpn_c": [V(0.9, 0.02, -0.4), V(0.4, 0, 0.9)], "arm_l": [V(-0.8, -0.3, 0.4), V(-0.7, -0.1, 0.7)]}],
		[0.5, {"hips": V(0, -0.2, 0), "hips_rot": V(14, -330, 0), "chest": V(10, -30, 0), "head": V(-6, 50, 0), "foot_l": V(-0.2, -0.7, -0.2), "foot_l_rot": V(0, 0, 0), "foot_r": V(0.22, -0.7, 0.22),
			"arm_r": [V(0.8, -0.2, 0.3), V(0.7, -0.1, 0.7)], "wpn_c": [V(0.6, -0.1, 0.8), V(-0.7, -0.2, 0.6)], "arm_l": [V(-0.5, -0.6, -0.5), V(-0.2, -0.2, -0.95)]}],
		[0.74, {"hips": V(0, -0.09, 0), "hips_rot": V(5, -382, 0), "chest": V(4, -8, 0), "head": V(-4, 20, 0), "foot_l": V(-0.14, -0.78, -0.2), "foot_r": V(0.17, -0.78, 0.2),
			"arm_r": [V(0.35, -0.7, -0.6), V(0.0, -0.3, -0.95)], "wpn_c": [V(-0.1, 0.5, -0.86), V(0.1, -0.85, -0.5)], "arm_l": [V(-0.35, -0.8, -0.3), V(0.2, 0.25, -0.95)]}],
	]})
	# H após L2: corte ascendente que lança o inimigo para o alto
	clips.append({"name": "atk_launch", "length": 0.7, "fps": 60, "base": gd, "keys": [
		[0.0, l2_end],
		[0.12, {"hips": V(0.05, -0.34, -0.02), "hips_rot": V(20, -36, 0), "spine": V(8, -8, 0), "chest": V(14, -18, 0), "head": V(-14, 50, 0),
			"hand_r": V(0.42, 0.5, 0.1), "elbow_r": V(0.9, 0.2, 0.9), "wpn": [V(0.35, -0.75, 0.55), V(0.2, 0.6, 0.77)],
			"hand_l": V(-0.3, 0.9, -0.3), "foot_l": V(-0.16, 0.085, 0.2), "foot_l_rot": V(30, 20, 0), "foot_r": V(0.18, 0.085, -0.34), "foot_r_rot": V(0, -12, 0)}],
		[0.19, {"hips": V(0.02, -0.2, -0.08), "hips_rot": V(10, -10, 0), "spine": V(2, -2, 0), "chest": V(2, -4, 0), "head": V(-10, 14, 0),
			"hand_r": V(0.2, 1.0, -0.5), "elbow_r": V(1.0, -0.5, 0.3), "wpn": [V(0.15, -0.3, -0.94), V(-0.1, 0.94, -0.3)],
			"hand_l": V(-0.4, 0.95, 0.0), "foot_l": V(-0.16, 0.085, 0.2), "foot_l_rot": V(40, 20, 0), "foot_r": V(0.16, 0.085, -0.36), "foot_r_rot": V(0, -8, 0)}],
		[0.25, {"hips": V(0.0, 0.03, -0.1), "hips_rot": V(-4, 6, 0), "spine": V(-6, 2, 0), "chest": V(-12, 6, 0), "neck": V(-8, -6, 0), "head": V(-14, -10, 0),
			"hand_r": V(0.08, 1.74, -0.36), "elbow_r": V(1.0, 0.2, 0.2), "wpn": [V(-0.05, 0.92, -0.38), V(-0.1, 0.38, 0.92)],
			"hand_l": V(-0.45, 0.9, 0.2), "foot_l": V(-0.15, 0.1, 0.16), "foot_l_rot": V(55, 20, 0), "foot_r": V(0.14, 0.09, -0.3), "foot_r_rot": V(30, -8, 0)}],
		[0.36, {"hips": V(0.0, 0.05, -0.08), "hips_rot": V(-6, 10, 0), "spine": V(-7, 3, 0), "chest": V(-14, 8, 0), "neck": V(-8, -8, 0), "head": V(-14, -14, 0),
			"hand_r": V(-0.02, 1.86, -0.1), "elbow_r": V(1.0, 0.3, 0.3), "wpn": [V(-0.15, 0.85, 0.5), V(-0.1, 0.5, -0.86)],
			"hand_l": V(-0.48, 0.9, 0.24), "foot_l": V(-0.15, 0.1, 0.16), "foot_l_rot": V(55, 20, 0), "foot_r": V(0.14, 0.09, -0.3), "foot_r_rot": V(30, -8, 0)}],
		[0.7, {}],
	]})
	# Estocada longa (ataque em investida e H após L3)
	clips.append({"name": "atk_thrust", "length": 0.66, "fps": 60, "base": gd, "keys": [
		[0.0, {"hips": V(0.03, -0.2, 0.06), "hips_rot": V(10, -44, 0), "chest": V(6, -20, 0), "head": V(-6, 60, 0),
			"hand_r": V(0.34, 1.12, 0.3), "elbow_r": V(0.8, 0.0, 1.0), "wpn": [V(-0.05, 0.02, -1.0), V(0.3, -0.95, 0.0)],
			"hand_l": V(-0.12, 1.2, -0.5), "foot_l": V(-0.14, 0.085, -0.3), "foot_r": V(0.18, 0.085, 0.3), "foot_r_rot": V(20, -50, 0)}],
		[0.1, {"hips": V(0.03, -0.24, 0.08), "hips_rot": V(10, -52, 0), "chest": V(6, -24, 0), "head": V(-6, 70, 0),
			"hand_r": V(0.36, 1.1, 0.36), "elbow_r": V(0.8, 0.0, 1.0), "wpn": [V(-0.05, 0.02, -1.0), V(0.3, -0.95, 0.0)],
			"hand_l": V(-0.1, 1.2, -0.52), "foot_l": V(-0.14, 0.085, -0.3), "foot_r": V(0.18, 0.085, 0.3), "foot_r_rot": V(26, -50, 0)}],
		[0.17, {"hips": V(-0.02, -0.26, -0.16), "hips_rot": V(22, 24, 0), "spine": V(6, 6, 0), "chest": V(10, 14, 0), "neck": V(-10, -12, 0), "head": V(-14, -30, 0),
			"hand_r": V(0.06, 1.18, -0.82), "elbow_r": V(1.0, -0.6, 0.2), "wpn": [V(-0.03, 0.0, -1.0), V(0.3, -0.95, 0.0)],
			"hand_l": V(-0.5, 1.1, 0.3), "elbow_l": V(-1.0, -0.2, 0.6), "foot_l": V(-0.14, 0.085, -0.56), "foot_l_rot": V(0, 10, 0), "foot_r": V(0.18, 0.1, 0.42), "foot_r_rot": V(50, -20, 0), "sharp": true}],
		[0.3, {"hips": V(-0.02, -0.25, -0.15), "hips_rot": V(21, 24, 0), "spine": V(6, 6, 0), "chest": V(10, 14, 0), "neck": V(-10, -12, 0), "head": V(-14, -30, 0),
			"hand_r": V(0.06, 1.18, -0.8), "elbow_r": V(1.0, -0.6, 0.2), "wpn": [V(-0.03, 0.0, -1.0), V(0.3, -0.95, 0.0)],
			"hand_l": V(-0.5, 1.1, 0.3), "elbow_l": V(-1.0, -0.2, 0.6), "foot_l": V(-0.14, 0.085, -0.56), "foot_l_rot": V(0, 10, 0), "foot_r": V(0.18, 0.1, 0.42), "foot_r_rot": V(50, -20, 0)}],
		[0.66, {}],
	]})

	# ================================================================ ataques no ar (pés relativos ao quadril)
	var air_l1_end := {"hips_rot": V(14, 40, 0), "chest": V(10, 24, 0), "head": V(-8, -50, 0), "arm_r": [V(-0.5, -0.5, -0.7), V(-0.8, -0.5, 0.2)], "wpn_c": [V(-0.6, -0.5, 0.6), V(0.3, -0.8, -0.5)],
		"arm_l": [V(-0.7, -0.4, 0.5), V(-0.6, -0.1, 0.8)], "foot_l": V(-0.12, -0.6, -0.22), "foot_r": V(0.14, -0.74, 0.2)}
	clips.append({"name": "atk_air1", "length": 0.46, "feet": "hips", "fps": 60, "base": air, "keys": [
		[0.0, {"hips_rot": V(4, -30, 0), "chest": V(-4, -20, 0), "head": V(-4, 44, 0), "arm_r": [V(0.7, 0.5, 0.4), V(0.3, 0.9, 0.3)], "wpn_c": [V(0.4, 0.6, 0.7), V(-0.5, 0.6, -0.6)],
			"arm_l": [V(-0.4, -0.5, -0.75), V(0.1, 0.1, -1.0)], "foot_l": V(-0.1, -0.68, -0.2), "foot_r": V(0.12, -0.7, 0.22)}],
		[0.09, {"hips_rot": V(6, -36, 0), "chest": V(-4, -22, 0), "head": V(-4, 50, 0), "arm_r": [V(0.7, 0.55, 0.45), V(0.3, 0.9, 0.35)], "wpn_c": [V(0.4, 0.6, 0.7), V(-0.5, 0.6, -0.6)],
			"arm_l": [V(-0.4, -0.5, -0.75), V(0.1, 0.1, -1.0)], "foot_l": V(-0.1, -0.66, -0.22), "foot_r": V(0.12, -0.7, 0.24)}],
		[0.15, {"hips_rot": V(10, 4, 0), "chest": V(6, 2, 0), "head": V(-6, -4, 0), "arm_r": [V(0.5, -0.1, -0.85), V(0.2, -0.2, -0.96)], "wpn_c": [V(0.2, 0.2, -0.96), V(-0.8, -0.6, -0.1)],
			"arm_l": [V(-0.6, -0.5, -0.3), V(-0.5, -0.2, 0.4)], "foot_l": V(-0.11, -0.62, -0.22), "foot_r": V(0.13, -0.72, 0.22)}],
		[0.22, air_l1_end],
		[0.46, {}],
	]})
	clips.append({"name": "atk_air2", "length": 0.46, "feet": "hips", "fps": 60, "base": air, "keys": [
		[0.0, air_l1_end],
		[0.08, {"hips_rot": V(14, 50, 0), "chest": V(10, 28, 0), "head": V(-8, -60, 0), "arm_r": [V(-0.5, -0.3, -0.8), V(-0.9, 0.0, 0.3)], "wpn_c": [V(-0.75, 0.1, 0.65), V(0.5, -0.2, 0.84)],
			"arm_l": [V(-0.7, -0.4, 0.5), V(-0.6, -0.1, 0.8)], "foot_l": V(-0.12, -0.6, -0.22), "foot_r": V(0.14, -0.74, 0.2)}],
		[0.15, {"hips_rot": V(10, -4, 0), "chest": V(6, -2, 0), "head": V(-6, 4, 0), "arm_r": [V(0.3, -0.1, -0.95), V(0.3, 0.0, -0.95)], "wpn_c": [V(-0.1, 0.15, -0.98), V(0.9, -0.2, -0.1)],
			"arm_l": [V(-0.6, -0.5, -0.4), V(-0.3, -0.1, -0.9)], "foot_l": V(-0.12, -0.7, -0.1), "foot_r": V(0.14, -0.64, 0.0)}],
		[0.22, {"hips_rot": V(6, -44, 0), "chest": V(2, -26, 0), "head": V(-4, 56, 0), "arm_r": [V(0.85, -0.1, 0.1), V(0.8, 0.1, 0.5)], "wpn_c": [V(0.7, 0.2, 0.68), V(0.4, -0.6, -0.7)],
			"arm_l": [V(-0.4, -0.6, -0.65), V(0.2, -0.1, -0.95)], "foot_l": V(-0.12, -0.76, 0.1), "foot_r": V(0.14, -0.58, -0.2)}],
		[0.46, {}],
	]})
	# mergulho com o sabre para baixo
	var plunge := {"hips_rot": V(10, 0, 0), "chest": V(6, 0, 0), "neck": V(-8, 0, 0), "head": V(-10, 0, 0), "arm_r": [V(0.2, 0.35, -0.9), V(-0.5, 0.2, -0.8)],
		"wpn_c": [V(0.0, -0.98, -0.2), V(0.0, -0.2, 0.98)], "arm_l": [V(-0.2, 0.3, -0.9), V(0.55, 0.2, -0.8)],
		"foot_l": V(-0.12, -0.5, -0.22), "foot_l_rot": V(30, 0, 0), "foot_r": V(0.12, -0.62, 0.22), "foot_r_rot": V(60, 0, 0)}
	clips.append({"name": "atk_plunge_start", "length": 0.26, "feet": "hips", "fps": 60, "base": air, "keys": [
		[0.0, {}],
		[0.12, {"hips_rot": V(-6, 0, 0), "chest": V(-12, 0, 0), "arm_r": [V(0.3, 0.9, -0.2), V(-0.2, 0.95, 0.1)], "wpn_c": [V(0.0, 0.3, 0.95), V(0.0, 0.95, -0.3)],
			"arm_l": [V(-0.3, 0.9, -0.2), V(0.2, 0.95, 0.1)], "foot_l": V(-0.12, -0.56, -0.2), "foot_r": V(0.12, -0.7, 0.16)}],
		[0.26, plunge],
	]})
	clips.append({"name": "atk_plunge_loop", "length": 0.4, "loop": true, "feet": "hips", "base": plunge, "keys": [
		[0.0, {}],
		[0.2, {"hips_rot": V(12, 0, 0), "foot_l": V(-0.12, -0.52, -0.22), "foot_r": V(0.12, -0.6, 0.24)}],
	]})
	clips.append({"name": "atk_plunge_land", "length": 0.7, "fps": 60, "base": gd, "keys": [
		[0.0, {"hips": V(0, -0.4, -0.04), "hips_rot": V(30, 0, 0), "spine": V(10, 0, 0), "chest": V(14, 0, 0), "neck": V(-14, 0, 0), "head": V(-16, 0, 0),
			"hand_r": V(0.05, 0.62, -0.42), "elbow_r": V(1.0, 0.2, 0.3), "wpn": [V(0.0, -0.97, -0.25), V(0.0, -0.25, 0.97)], "grip_l": -0.11, "elbow_l": V(-1.0, 0.2, 0.3),
			"foot_l": V(-0.22, 0.085, -0.3), "foot_l_rot": V(0, 16, 0), "foot_r": V(0.22, 0.085, 0.24), "foot_r_rot": V(25, -30, 0), "sharp": true}],
		[0.25, {"hips": V(0, -0.37, -0.04), "hips_rot": V(28, 0, 0), "spine": V(10, 0, 0), "chest": V(14, 0, 0), "neck": V(-14, 0, 0), "head": V(-16, 0, 0),
			"hand_r": V(0.05, 0.66, -0.42), "elbow_r": V(1.0, 0.2, 0.3), "wpn": [V(0.0, -0.97, -0.25), V(0.0, -0.25, 0.97)], "grip_l": -0.11, "elbow_l": V(-1.0, 0.2, 0.3),
			"foot_l": V(-0.22, 0.085, -0.3), "foot_l_rot": V(0, 16, 0), "foot_r": V(0.22, 0.085, 0.24), "foot_r_rot": V(25, -30, 0)}],
		[0.7, {}],
	]})

	# ================================================================ defesa
	var blk := {"hips": V(0, -0.14, 0.02), "hips_rot": V(6, -26, 0), "spine": V(4, -4, 0), "chest": V(8, -8, 0), "neck": V(-4, 14, 0), "head": V(-6, 22, 0),
		"foot_l": V(-0.15, 0.085, -0.24), "foot_l_rot": V(0, 8, 0), "foot_r": V(0.18, 0.085, 0.24), "foot_r_rot": V(0, -40, 0),
		"hand_r": V(0.22, 1.2, -0.4), "elbow_r": V(1.0, -0.5, 0.3), "wpn": [V(-0.62, 0.74, -0.26), V(-0.2, -0.45, -0.87)],
		"hand_l": V(-0.14, 1.42, -0.44), "elbow_l": V(-1.0, -0.4, 0.2)}
	clips.append({"name": "block", "length": 1.4, "loop": true, "base": blk, "keys": [
		[0.0, {}],
		[0.7, {"hips": V(0, -0.15, 0.02), "hand_r": V(0.22, 1.19, -0.4), "hand_l": V(-0.14, 1.41, -0.44)}],
	]})
	clips.append({"name": "block_hit", "length": 0.3, "fps": 60, "base": blk, "keys": [
		[0.0, {"hips": V(0, -0.17, 0.1), "hips_rot": V(0, -26, 0), "chest": V(0, -8, 0), "hand_r": V(0.24, 1.16, -0.28), "hand_l": V(-0.12, 1.38, -0.32), "sharp": true}],
		[0.3, {}],
	]})
	clips.append({"name": "parry", "length": 0.36, "fps": 60, "base": blk, "keys": [
		[0.0, {}],
		[0.06, {"hips": V(0, -0.12, -0.06), "hips_rot": V(10, -10, 0), "chest": V(10, 6, 0), "head": V(-8, 4, 0),
			"hand_r": V(0.44, 1.42, -0.44), "elbow_r": V(1.0, -0.2, 0.2), "wpn": [V(0.35, 0.88, -0.32), V(0.8, -0.4, -0.45)],
			"hand_l": V(-0.3, 1.1, -0.2), "sharp": true}],
		[0.16, {"hips": V(0, -0.12, -0.05), "hips_rot": V(9, -12, 0), "chest": V(9, 4, 0), "head": V(-8, 6, 0),
			"hand_r": V(0.46, 1.4, -0.4), "elbow_r": V(1.0, -0.2, 0.2), "wpn": [V(0.4, 0.86, -0.3), V(0.8, -0.4, -0.45)], "hand_l": V(-0.3, 1.1, -0.18)}],
		[0.36, {}],
	]})
	# golpe crítico (após quebrar a postura): estocada funda e arranque
	clips.append({"name": "atk_crit", "length": 1.1, "fps": 60, "base": gd, "keys": [
		[0.0, {}],
		[0.22, {"hips": V(0.04, -0.24, 0.1), "hips_rot": V(10, -56, 0), "chest": V(6, -24, 0), "neck": V(0, 30, 0), "head": V(-6, 50, 0),
			"hand_r": V(0.36, 1.14, 0.42), "elbow_r": V(0.8, 0.0, 1.0), "wpn": [V(-0.05, 0.02, -1.0), V(0.3, -0.95, 0.0)],
			"hand_l": V(-0.08, 1.22, -0.56), "foot_r": V(0.18, 0.085, 0.32), "foot_r_rot": V(26, -50, 0)}],
		[0.32, {"hips": V(-0.02, -0.28, -0.2), "hips_rot": V(24, 28, 0), "spine": V(6, 6, 0), "chest": V(10, 14, 0), "neck": V(-10, -14, 0), "head": V(-14, -30, 0),
			"hand_r": V(0.06, 1.16, -0.86), "elbow_r": V(1.0, -0.6, 0.2), "wpn": [V(-0.03, 0.02, -1.0), V(0.3, -0.95, 0.0)],
			"hand_l": V(-0.5, 1.1, 0.3), "foot_l": V(-0.14, 0.085, -0.6), "foot_l_rot": V(0, 10, 0), "foot_r": V(0.18, 0.1, 0.42), "foot_r_rot": V(50, -20, 0), "sharp": true}],
		[0.62, {"hips": V(-0.02, -0.27, -0.2), "hips_rot": V(24, 30, 0), "spine": V(6, 6, 0), "chest": V(10, 14, 0), "neck": V(-10, -14, 0), "head": V(-14, -30, 0),
			"hand_r": V(0.06, 1.16, -0.87), "elbow_r": V(1.0, -0.6, 0.2), "wpn": [V(-0.03, 0.05, -1.0), V(0.3, -0.95, 0.0)],
			"hand_l": V(-0.5, 1.1, 0.3), "foot_l": V(-0.14, 0.085, -0.6), "foot_l_rot": V(0, 10, 0), "foot_r": V(0.18, 0.1, 0.42), "foot_r_rot": V(50, -20, 0), "sharp": true}],
		[0.76, {"hips": V(0.04, -0.18, 0.0), "hips_rot": V(8, -40, 0), "chest": V(2, -20, 0), "head": V(-4, 50, 0),
			"hand_r": V(0.52, 1.3, 0.2), "elbow_r": V(1.0, 0.0, 0.8), "wpn": [V(0.6, 0.3, -0.74), V(0.5, -0.8, 0.2)],
			"hand_l": V(-0.3, 1.15, -0.3)}],
		[1.1, {}],
	]})

	# ================================================================ dano, atordoamento, morte
	clips.append({"name": "hit", "length": 0.38, "fps": 60, "base": gd, "keys": [
		[0.0, {"hips": V(0.0, -0.1, 0.12), "hips_rot": V(-10, -22, 0), "spine": V(-8, -4, 0), "chest": V(-14, -8, 0), "neck": V(10, 12, 0), "head": V(16, 20, 0),
			"hand_r": V(0.44, 1.0, -0.06), "arm_l": [V(-0.7, -0.5, -0.2), V(-0.6, 0.1, -0.7)], "foot_r": V(0.17, 0.085, 0.3), "sharp": true}],
		[0.1, {"hips": V(0.0, -0.12, 0.1), "hips_rot": V(-6, -22, 0), "spine": V(-4, -4, 0), "chest": V(-8, -8, 0), "neck": V(6, 12, 0), "head": V(8, 20, 0),
			"hand_r": V(0.42, 1.0, -0.1), "arm_l": [V(-0.65, -0.55, -0.2), V(-0.5, 0.0, -0.8)], "foot_r": V(0.17, 0.085, 0.3)}],
		[0.38, {}],
	]})
	clips.append({"name": "stagger", "length": 1.0, "fps": 60, "base": gd, "keys": [
		[0.0, {"hips": V(0.0, -0.1, 0.16), "hips_rot": V(-16, -10, 6), "spine": V(-10, 0, 0), "chest": V(-16, 0, 6), "neck": V(14, 0, 0), "head": V(20, 0, 0),
			"hand_r": V(0.6, 1.25, 0.1), "elbow_r": V(1.0, 0.0, 0.5), "wpn": [V(0.6, 0.4, 0.7), V(0.4, -0.9, 0.1)], "arm_l": [V(-0.85, -0.2, -0.1), V(-0.8, 0.4, -0.3)],
			"foot_l": V(-0.14, 0.14, -0.06), "foot_r": V(0.18, 0.085, 0.4), "sharp": true}],
		[0.3, {"hips": V(0.03, -0.2, 0.22), "hips_rot": V(4, -14, 4), "spine": V(4, 0, 0), "chest": V(10, 0, 4), "neck": V(6, 0, 0), "head": V(14, 0, 0),
			"hand_r": V(0.56, 0.86, 0.1), "elbow_r": V(1.0, -0.2, 0.6), "wpn": [V(0.5, -0.5, -0.7), V(0.2, -0.8, 0.55)], "arm_l": [V(-0.7, -0.65, 0.0), V(-0.5, -0.5, -0.7)],
			"foot_l": V(-0.16, 0.085, 0.14), "foot_r": V(0.2, 0.085, 0.42)}],
		[0.62, {"hips": V(0.02, -0.26, 0.2), "hips_rot": V(14, -16, 0), "spine": V(8, 0, 0), "chest": V(14, 0, 0), "neck": V(8, 0, 0), "head": V(16, 0, 0),
			"hand_r": V(0.5, 0.72, 0.0), "elbow_r": V(1.0, -0.2, 0.6), "wpn": [V(0.3, -0.8, -0.5), V(0.2, -0.5, 0.84)], "arm_l": [V(-0.5, -0.8, -0.2), V(-0.3, -0.7, -0.6)],
			"foot_l": V(-0.16, 0.085, 0.1), "foot_r": V(0.2, 0.085, 0.42)}],
		[1.0, {}],
	]})
	# ajoelhado (postura quebrada do inimigo; descanso do jogador)
	var kneel := {"hips": V(0.0, -0.5, 0.06), "hips_rot": V(14, -8, 0), "spine": V(8, 0, 0), "chest": V(14, 0, 0), "neck": V(10, 0, 0), "head": V(18, 0, 0),
		"foot_l": V(-0.15, 0.085, -0.32), "foot_l_rot": V(0, 10, 0), "knee_l": V(-0.2, 0, -1),
		"foot_r": V(0.14, 0.12, 0.46), "foot_r_rot": V(72, -6, 0), "knee_r": V(0.2, -0.6, -1),
		"hand_r": V(0.34, 0.62, -0.3), "elbow_r": V(1.0, 0.2, 0.6), "wpn": [V(0.1, -0.97, -0.2), V(0.5, -0.1, -0.86)],
		"hand_l": V(-0.2, 0.52, -0.3), "elbow_l": V(-1.0, 0.1, 0.5)}
	clips.append({"name": "kneel", "length": 1.6, "loop": true, "base": kneel, "keys": [
		[0.0, {}],
		[0.8, {"hips": V(0.0, -0.515, 0.06), "chest": V(16, 0, 0), "head": V(20, 0, 0)}],
	]})
	clips.append({"name": "rest", "length": 3.0, "loop": true, "base": kneel, "keys": [
		[0.0, {"chest": V(6, 0, 0), "neck": V(0, 0, 0), "head": V(-4, 0, 0), "hips_rot": V(8, -8, 0)}],
		[1.5, {"hips": V(0.0, -0.49, 0.06), "chest": V(4, 0, 0), "neck": V(0, 0, 0), "head": V(-6, 0, 0), "hips_rot": V(8, -8, 0)}],
	]})
	clips.append({"name": "death", "length": 1.5, "fps": 30, "base": gd, "keys": [
		[0.0, {"hips": V(0, -0.1, 0.1), "hips_rot": V(-12, -16, 0), "chest": V(-14, -6, 0), "head": V(14, 10, 0), "hand_r": V(0.5, 1.05, 0.0), "arm_l": [V(-0.7, -0.5, -0.1), V(-0.6, 0.1, -0.6)], "sharp": true}],
		[0.35, {"hips": V(0, -0.34, 0.06), "hips_rot": V(6, -10, 0), "chest": V(8, 0, 0), "neck": V(10, 0, 0), "head": V(20, 0, 0),
			"hand_r": V(0.42, 0.62, -0.1), "wpn": [V(0.4, -0.7, -0.6), V(0.2, -0.6, 0.77)], "arm_l": [V(-0.4, -0.9, -0.1), V(-0.3, -0.9, -0.3)],
			"foot_l": V(-0.15, 0.085, -0.1), "foot_r": V(0.15, 0.085, 0.24)}],
		[0.7, {"hips": V(0, -0.56, -0.02), "hips_rot": V(18, -4, 0), "spine": V(8, 0, 0), "chest": V(14, 0, 0), "neck": V(14, 0, 0), "head": V(24, 0, 0),
			"hand_r": V(0.4, 0.34, -0.3), "wpn": [V(0.6, -0.2, -0.77), V(0.1, -0.97, 0.2)], "arm_l": [V(-0.35, -0.9, -0.25), V(-0.25, -0.85, -0.45)],
			"foot_l": V(-0.15, 0.1, 0.3), "foot_l_rot": V(70, 6, 0), "knee_l": V(-0.2, -0.5, -1), "foot_r": V(0.15, 0.1, 0.4), "foot_r_rot": V(72, -6, 0), "knee_r": V(0.2, -0.5, -1)}],
		[1.15, {"hips": V(0, -0.78, -0.3), "hips_rot": V(78, -6, 4), "spine": V(4, 0, 0), "chest": V(4, 0, 0), "neck": V(-6, 20, 0), "head": V(-8, 40, 0),
			"hand_rc": V(0.36, 0.2, -0.3), "wpn": [V(0.9, 0.0, -0.4), V(0.1, -1.0, 0.0)], "hand_lc": V(-0.34, 0.24, -0.2),
			"foot_l": V(-0.16, 0.09, 0.5), "foot_l_rot": V(88, 10, 0), "knee_l": V(-0.25, -1, -0.3), "foot_r": V(0.16, 0.09, 0.56), "foot_r_rot": V(88, -10, 0), "knee_r": V(0.25, -1, -0.3), "sharp": true}],
		[1.5, {"hips": V(0, -0.79, -0.3), "hips_rot": V(79, -6, 4), "spine": V(4, 0, 0), "chest": V(4, 0, 0), "neck": V(-6, 20, 0), "head": V(-8, 40, 0),
			"hand_rc": V(0.36, 0.2, -0.3), "wpn": [V(0.9, 0.0, -0.4), V(0.1, -1.0, 0.0)], "hand_lc": V(-0.34, 0.24, -0.2),
			"foot_l": V(-0.16, 0.09, 0.5), "foot_l_rot": V(88, 10, 0), "knee_l": V(-0.25, -1, -0.3), "foot_r": V(0.16, 0.09, 0.56), "foot_r_rot": V(88, -10, 0), "knee_r": V(0.25, -1, -0.3)}],
	]})

	# ================================================================ itens e habilidades
	clips.append({"name": "drink", "length": 1.0, "base": st, "keys": [
		[0.0, {}],
		[0.28, {"chest": V(-6, -6, 0), "neck": V(-10, 8, 0), "head": V(-22, 14, 0), "hand_l": V(-0.06, 1.56, -0.2), "elbow_l": V(-1.0, -0.2, -0.2)}],
		[0.7, {"chest": V(-8, -6, 0), "neck": V(-12, 8, 0), "head": V(-26, 14, 0), "hand_l": V(-0.06, 1.58, -0.19), "elbow_l": V(-1.0, -0.1, -0.2)}],
		[1.0, {}],
	]})
	clips.append({"name": "cast", "length": 0.62, "fps": 60, "base": gd, "keys": [
		[0.0, {}],
		[0.14, {"hips_rot": V(6, -40, 0), "chest": V(4, -20, 0), "head": V(-4, 56, 0), "hand_l": V(-0.24, 1.2, 0.0), "elbow_l": V(-0.8, -0.3, 0.8), "hand_r": V(0.4, 0.95, 0.1)}],
		[0.22, {"hips": V(0, -0.14, -0.08), "hips_rot": V(12, 26, 0), "chest": V(8, 20, 0), "head": V(-8, -44, 0), "hand_l": V(-0.04, 1.3, -0.72), "elbow_l": V(-1.0, -0.4, 0.2),
			"hand_r": V(0.46, 0.9, 0.24), "wpn": [V(0.4, 0.1, 0.9), V(0.2, -0.95, 0.1)], "foot_l": V(-0.14, 0.085, -0.36), "sharp": true}],
		[0.4, {"hips": V(0, -0.14, -0.07), "hips_rot": V(12, 26, 0), "chest": V(8, 20, 0), "head": V(-8, -44, 0), "hand_l": V(-0.04, 1.3, -0.7), "elbow_l": V(-1.0, -0.4, 0.2),
			"hand_r": V(0.46, 0.9, 0.24), "wpn": [V(0.4, 0.1, 0.9), V(0.2, -0.95, 0.1)], "foot_l": V(-0.14, 0.085, -0.36)}],
		[0.62, {}],
	]})
	clips.append({"name": "interact", "length": 0.6, "base": st, "keys": [
		[0.0, {}],
		[0.22, {"hips_rot": V(10, -6, 0), "chest": V(8, 10, 0), "head": V(4, 0, 0), "hand_l": V(-0.1, 1.0, -0.5), "elbow_l": V(-1.0, -0.5, 0.3)}],
		[0.6, {}],
	]})
	return clips


static func _mirrored_clip(clip: Dictionary, new_name: String) -> Dictionary:
	var out := clip.duplicate()
	out["name"] = new_name
	if clip.has("base"):
		out["base"] = Builder.mirror(clip["base"])
	var keys := []
	for k: Array in clip["keys"]:
		keys.append([k[0], Builder.mirror(k[1])])
	out["keys"] = keys
	return out


static func get_clip(clip_name: String) -> Dictionary:
	if _cache.is_empty():
		for c: Dictionary in all_clips():
			_cache[c["name"]] = c
	return _cache.get(clip_name, {})


static func names() -> PackedStringArray:
	if _cache.is_empty():
		get_clip("")
	return PackedStringArray(_cache.keys())
