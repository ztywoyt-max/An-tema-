extends RefCounted
## Resolve uma pose: controles (posições de mãos/pés, ângulos do tronco, direção da
## arma) -> rotações locais dos ossos. Usa IK analítica de dois ossos.
##
## Ângulos em graus: Vector3(pitch, yaw, roll) = (inclinar à frente +, virar à esquerda +, tombar à direita +).


static func euler(v: Vector3) -> Quaternion:
	return Quaternion(Vector3.UP, deg_to_rad(v.y)) * Quaternion(Vector3.RIGHT, deg_to_rad(-v.x)) * Quaternion(Vector3.BACK, deg_to_rad(-v.z))


## Giro em torno de `axis` que leva `from` a `to` (ambos perpendiculares ao eixo).
static func twist_between(from: Vector3, to: Vector3, axis: Vector3) -> Quaternion:
	var ang := atan2(from.cross(to).dot(axis), from.dot(to))
	return Quaternion(axis, ang)


static func two_bone(root: Vector3, target: Vector3, hint: Vector3, l1: float, l2: float) -> Array:
	var to := target - root
	var d := to.length()
	var max_d := (l1 + l2) * 0.9985
	var min_d := absf(l1 - l2) + 0.01
	if d > max_d:
		to = to * (max_d / d)
		d = max_d
	elif d < min_d:
		to = (to.normalized() if d > 1e-5 else Vector3.DOWN) * min_d
		d = min_d
	var axis := to / d
	var a := (l1 * l1 - l2 * l2 + d * d) / (2.0 * d)
	var h := sqrt(maxf(l1 * l1 - a * a, 0.0))
	var pole := hint - root
	pole -= axis * pole.dot(axis)
	if pole.length_squared() < 1e-8:
		pole = axis.cross(Vector3.RIGHT)
		if pole.length_squared() < 1e-6:
			pole = axis.cross(Vector3.UP)
	pole = pole.normalized()
	var mid := root + axis * a + pole * h
	return [mid, root + to]


## c: canais canônicos (ver anim_builder.gd). Devolve {osso: Quaternion local, "hips_pos": Vector3,
## "_fore_r": delta global do antebraço direito (para a pose natural da arma)}.
static func solve(rig: RefCounted, c: Dictionary, feet_hips: bool) -> Dictionary:
	var D := {}
	var d_hips: Quaternion = euler(c["hips_rot"])
	var pos_hips: Vector3 = rig.p["hips"] + c["hips"]
	var d_spine := d_hips * euler(c["spine"])
	var pos_spine: Vector3 = pos_hips + d_hips * (rig.p["spine"] - rig.p["hips"])
	var d_chest := d_spine * euler(c["chest"])
	var pos_chest: Vector3 = pos_spine + d_spine * (rig.p["chest"] - rig.p["spine"])
	var d_neck := d_chest * euler(c["neck"])
	var d_head := d_neck * euler(c["head"])
	D["hips"] = d_hips
	D["spine"] = d_spine
	D["chest"] = d_chest
	D["neck"] = d_neck
	D["head"] = d_head

	var has_wpn: bool = c.has("wpn_d")
	var grip_world := Vector3.ZERO
	var wpn_dir_w := Vector3.ZERO
	for s: String in ["_r", "_l"]:
		var sx := 1.0 if s == "_r" else -1.0
		var wr_t: Vector3 = pos_chest + d_chest * c["wr" + s]
		var el_t: Vector3 = pos_chest + d_chest * c["el" + s]
		if s == "_l" and c.has("grip") and (c["grip"] as Vector3).x > 0.001 and has_wpn:
			var g: Vector3 = c["grip"]
			var two_hand := grip_world + wpn_dir_w * g.y - (d_chest * Vector3(0.0, 0.0, 0.0))
			wr_t = wr_t.lerp(two_hand, clampf(g.x, 0.0, 1.0))
		var sh0: Vector3 = pos_chest + d_chest * (rig.p["shoulder" + s] - rig.p["chest"])
		# clavícula automática: sobe e avança na direção do alvo
		var to_t := (wr_t - sh0).normalized()
		var up_amt := clampf(to_t.dot(d_chest * Vector3.UP), 0.0, 1.0)
		var fw_amt := clampf(to_t.dot(d_chest * Vector3.FORWARD), -1.0, 1.0)
		var q_clav := Quaternion(Vector3.UP, sx * deg_to_rad(fw_amt * (16.0 if fw_amt > 0.0 else 10.0))) * Quaternion(Vector3.BACK, sx * deg_to_rad(up_amt * 28.0))
		var d_sh := d_chest * q_clav
		D["shoulder" + s] = d_sh
		var sh1: Vector3 = sh0 + d_sh * (rig.p["upper_arm" + s] - rig.p["shoulder" + s])
		var l1: float = rig.l_upper[s]
		var l2: float = rig.l_fore[s]
		var ik := two_bone(sh1, wr_t, el_t, l1, l2)
		var el: Vector3 = ik[0]
		var wr: Vector3 = ik[1]
		var u := (el - sh1).normalized()
		var f := (wr - el).normalized()
		var d_up := Quaternion(d_sh * (rig.r_upper[s] as Vector3), u) * d_sh
		var hn := u.cross(f)
		if hn.length_squared() > 1e-6:
			hn = hn.normalized()
			d_up = twist_between(d_up * (rig.h_arm[s] as Vector3), hn, u) * d_up
		var d_fore := Quaternion(d_up * (rig.r_fore[s] as Vector3), f) * d_up
		var d_hand := d_fore
		if s == "_r":
			if has_wpn:
				var wy: Vector3 = (c["wpn_d"] as Vector3).normalized()
				var wz: Vector3 = c["wpn_e"]
				wz = wz - wy * wz.dot(wy)
				if wz.length_squared() < 1e-8:
					wz = wy.cross(Vector3.RIGHT)
				wz = wz.normalized()
				var wq := Basis(wy.cross(wz), wy, wz).get_rotation_quaternion()
				d_hand = wq * (rig.wpn_q as Quaternion).inverse()
				# divide a torção do pulso com o antebraço
				var rel := d_hand * d_fore.inverse()
				var proj := f * Vector3(rel.x, rel.y, rel.z).dot(f)
				var tw := Quaternion(proj.x, proj.y, proj.z, rel.w)
				if tw.length_squared() > 1e-8:
					tw = tw.normalized()
					d_fore = Quaternion.IDENTITY.slerp(tw, 0.5) * d_fore
				wpn_dir_w = wy
			else:
				wpn_dir_w = d_hand * (rig.wpn_dir as Vector3)
			grip_world = wr + d_hand * (rig.grip_off as Vector3)
			D["_fore_r"] = Quaternion(d_up * (rig.r_fore[s] as Vector3), f) * d_up
		D["upper_arm" + s] = d_up
		D["forearm" + s] = d_fore
		D["hand" + s] = d_hand

	for s2: String in ["_r", "_l"]:
		var hip: Vector3 = pos_hips + d_hips * (rig.p["thigh" + s2] - rig.p["hips"])
		var ft: Vector3 = c["ft" + s2]
		var ftr: Vector3 = c["ftr" + s2]
		var kn_hint: Vector3 = c["kn" + s2]
		var ankle: Vector3
		var kdir: Vector3
		if feet_hips:
			ankle = pos_hips + d_hips * ft
			kdir = d_hips * kn_hint
		else:
			ankle = ft
			kdir = Quaternion(Vector3.UP, deg_to_rad(ftr.y)) * kn_hint
		var lt: float = rig.l_thigh[s2]
		var ls: float = rig.l_shin[s2]
		var ik2 := two_bone(hip, ankle, (hip + ankle) * 0.5 + kdir.normalized() * 0.5, lt, ls)
		var kn: Vector3 = ik2[0]
		var an: Vector3 = ik2[1]
		var td := (kn - hip).normalized()
		var sd := (an - kn).normalized()
		var d_th := Quaternion(d_hips * (rig.r_thigh[s2] as Vector3), td) * d_hips
		var hn2 := td.cross(sd)
		if hn2.length_squared() > 1e-5:
			hn2 = hn2.normalized()
			d_th = twist_between(d_th * (rig.h_leg[s2] as Vector3), hn2, td) * d_th
		var d_shin := Quaternion(d_th * (rig.r_shin[s2] as Vector3), sd) * d_th
		var d_foot: Quaternion
		var d_toe: Quaternion
		if feet_hips:
			d_foot = d_shin * euler(Vector3(ftr.x, ftr.y, ftr.z))
			d_toe = d_foot
		else:
			d_foot = euler(ftr)
			# calcanhar levantado: os dedos ficam no chão
			d_toe = euler(Vector3(minf(ftr.x, 0.0), ftr.y, ftr.z)) if ftr.x > 0.0 else d_foot
		D["thigh" + s2] = d_th
		D["shin" + s2] = d_shin
		D["foot" + s2] = d_foot
		D["toe" + s2] = d_toe

	var out := {"hips_pos": pos_hips, "_fore_r": D["_fore_r"]}
	for b: String in rig.ANIMATED:
		var par: String = rig.parent[b]
		var pq: Quaternion = (D[b] as Quaternion) * (rig.gq[b] as Quaternion)
		if par == "":
			out[b] = pq
		else:
			out[b] = ((D[par] as Quaternion) * (rig.gq[par] as Quaternion)).inverse() * pq
	return out
