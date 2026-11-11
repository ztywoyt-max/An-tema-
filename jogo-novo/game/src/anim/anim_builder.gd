extends RefCounted
## Constrói animações a partir de poses-chave escritas em código.
##
## Uma pose-chave é um Dictionary com (todos opcionais; o que faltar vem de "base"):
##   hips        Vector3  deslocamento do quadril (m)
##   hips_rot    Vector3  (pitch, yaw, roll) em graus
##   spine, chest, neck, head   Vector3 graus (relativos ao osso anterior)
##   arm_r/_l    [dir_braço, dir_antebraço]  direções no referencial do peito (FK)
##   hand_r/_l   Vector3  pulso no espaço do personagem (IK)
##   hand_rc/_lc Vector3  pulso relativo à junta do peito, no referencial do peito (IK)
##   elbow_r/_l  Vector3  para onde aponta o cotovelo (referencial do peito)
##   wpn         [dir, fio]  orientação da arma no espaço do personagem
##   wpn_c       [dir, fio]  idem, no referencial do peito
##   grip_l      float    mão esquerda segura o cabo a esta distância (m) da direita
##   foot_r/_l   Vector3  tornozelo (espaço do personagem, ou relativo ao quadril se feet="hips")
##   foot_r_rot  Vector3  graus (pitch +: calcanhar sobe)
##   knee_r/_l   Vector3  para onde aponta o joelho
##   sharp       bool     pose "parada" (tangente zero)
##
## Clipe: {name, length, loop, feet ("root"|"hips"), fps, base (pose), keys: [[tempo, pose], ...]}

const Solver := preload("res://src/anim/pose_solver.gd")

const CHANNELS := ["hips", "hips_rot", "spine", "chest", "neck", "head",
	"wr_r", "el_r", "wr_l", "el_l", "wpn_d", "wpn_e", "grip",
	"ft_r", "ft_l", "ftr_r", "ftr_l", "kn_r", "kn_l"]


## Espelha uma pose (troca direita/esquerda).
static func mirror(pose: Dictionary) -> Dictionary:
	var out := {}
	for k: String in pose:
		var v: Variant = pose[k]
		var k2 := k
		if k == "grip_l":
			pass
		elif k.ends_with("_r"):
			k2 = k.trim_suffix("_r") + "_l"
		elif k.ends_with("_l"):
			k2 = k.trim_suffix("_l") + "_r"
		elif k.ends_with("_rc"):
			k2 = k.trim_suffix("_rc") + "_lc"
		elif k.ends_with("_lc"):
			k2 = k.trim_suffix("_lc") + "_rc"
		elif k.ends_with("_r_rot"):
			k2 = k.trim_suffix("_r_rot") + "_l_rot"
		elif k.ends_with("_l_rot"):
			k2 = k.trim_suffix("_l_rot") + "_r_rot"
		if k in ["hips_rot", "spine", "chest", "neck", "head"] or k.ends_with("_rot"):
			var e: Vector3 = v
			out[k2] = Vector3(e.x, -e.y, -e.z)
		elif v is Vector3:
			out[k2] = Vector3(-v.x, v.y, v.z)
		elif v is Array:
			var arr := []
			for item: Variant in v:
				arr.append(Vector3(-item.x, item.y, item.z) if item is Vector3 else item)
			out[k2] = arr
		else:
			out[k2] = v
	return out


static func merged(base: Dictionary, over: Dictionary) -> Dictionary:
	var out := base.duplicate()
	for k: String in over:
		# uma forma de braço substitui as outras
		for s: String in ["_r", "_l"]:
			if k in ["arm" + s, "hand" + s, "hand" + s + "c"]:
				out.erase("arm" + s)
				out.erase("hand" + s)
				out.erase("hand" + s + "c")
		if k in ["wpn", "wpn_c"]:
			out.erase("wpn")
			out.erase("wpn_c")
		out[k] = over[k]
	return out


## Pose escrita -> canais canônicos (todos Vector3).
static func canon(rig: RefCounted, pose: Dictionary, feet_hips: bool) -> Dictionary:
	var c := {}
	c["hips"] = pose.get("hips", Vector3.ZERO)
	for k: String in ["hips_rot", "spine", "chest", "neck", "head"]:
		c[k] = pose.get(k, Vector3.ZERO)
	var d_hips: Quaternion = Solver.euler(c["hips_rot"])
	var pos_hips: Vector3 = rig.p["hips"] + c["hips"]
	var d_spine: Quaternion = d_hips * Solver.euler(c["spine"])
	var pos_spine: Vector3 = pos_hips + d_hips * (rig.p["spine"] - rig.p["hips"])
	var d_chest: Quaternion = d_spine * Solver.euler(c["chest"])
	var pos_chest: Vector3 = pos_spine + d_spine * (rig.p["chest"] - rig.p["spine"])
	for s: String in ["_r", "_l"]:
		var sx := 1.0 if s == "_r" else -1.0
		var sh: Vector3 = rig.p["upper_arm" + s] - rig.p["chest"]
		var wr: Vector3
		var el: Vector3
		if pose.has("arm" + s):
			var dirs: Array = pose["arm" + s]
			el = sh + (dirs[0] as Vector3).normalized() * (rig.l_upper[s] as float)
			wr = el + (dirs[1] as Vector3).normalized() * (rig.l_fore[s] as float)
		else:
			if pose.has("hand" + s):
				wr = d_chest.inverse() * ((pose["hand" + s] as Vector3) - pos_chest)
			elif pose.has("hand" + s + "c"):
				wr = pose["hand" + s + "c"]
			else:
				wr = rig.p["hand" + s] - rig.p["chest"]
			var hint: Vector3 = pose.get("elbow" + s, Vector3(0.4 * sx, -1.0, 0.5))
			el = (sh + wr) * 0.5 + hint.normalized() * 0.3
		c["wr" + s] = wr
		c["el" + s] = el
		var ft_default: Vector3 = rig.p["foot" + s]
		if feet_hips:
			ft_default -= rig.p["hips"] as Vector3
		c["ft" + s] = pose.get("foot" + s, ft_default)
		c["ftr" + s] = pose.get("foot" + s + "_rot", Vector3.ZERO)
		c["kn" + s] = pose.get("knee" + s, Vector3(0.12 * sx, 0.0, -1.0))
	c["grip"] = Vector3(1.0, float(pose["grip_l"]), 0.0) if pose.has("grip_l") else Vector3.ZERO
	if pose.has("wpn"):
		c["wpn_d"] = pose["wpn"][0]
		c["wpn_e"] = pose["wpn"][1]
	elif pose.has("wpn_c"):
		c["wpn_d"] = d_chest * (pose["wpn_c"][0] as Vector3)
		c["wpn_e"] = d_chest * (pose["wpn_c"][1] as Vector3)
	else:
		# arma "natural": segue o antebraço como no descanso
		var res: Dictionary = Solver.solve(rig, c, feet_hips)
		var dq: Quaternion = res["_fore_r"]
		c["wpn_d"] = dq * (rig.wpn_dir as Vector3)
		c["wpn_e"] = dq * (rig.wpn_edge as Vector3)
	return c


## Prepara um clipe: canais por chave + tangentes (Catmull-Rom).
static func prepare(rig: RefCounted, clip: Dictionary) -> Dictionary:
	var feet_hips: bool = clip.get("feet", "root") == "hips"
	var loop: bool = clip.get("loop", false)
	var base: Dictionary = clip.get("base", {})
	var keys: Array = clip["keys"]
	var times := PackedFloat32Array()
	var sharp: Array[bool] = []
	var canon_keys: Array[Dictionary] = []
	for k: Array in keys:
		var pose: Dictionary = merged(base, k[1])
		times.append(float(k[0]))
		sharp.append(bool(pose.get("sharp", false)))
		canon_keys.append(canon(rig, pose, feet_hips))
	var length: float = clip.get("length", times[times.size() - 1])
	if loop and times[times.size() - 1] < length - 0.0001:
		times.append(length)
		sharp.append(sharp[0])
		canon_keys.append(canon_keys[0])
	var n := times.size()
	var vals := {}
	var tans := {}
	for ch: String in CHANNELS:
		var pv := PackedVector3Array()
		pv.resize(n)
		for i in n:
			pv[i] = canon_keys[i][ch]
		var tv := PackedVector3Array()
		tv.resize(n)
		for i in n:
			var m := Vector3.ZERO
			if not sharp[i]:
				var ia := i - 1
				var ib := i + 1
				var ta := 0.0
				var tb := 0.0
				if loop:
					# a última chave repete a primeira
					if i == 0 or i == n - 1:
						ia = n - 2
						ib = 1
						ta = times[n - 2] - length if i == 0 else times[n - 2]
						tb = times[1] if i == 0 else times[1] + length
						m = (pv[ib] - pv[ia]) / maxf(tb - ta, 1e-5)
					else:
						m = (pv[ib] - pv[ia]) / maxf(times[ib] - times[ia], 1e-5)
				elif i > 0 and i < n - 1:
					m = (pv[ib] - pv[ia]) / maxf(times[ib] - times[ia], 1e-5)
			tv[i] = m
		vals[ch] = pv
		tans[ch] = tv
	return {"name": clip["name"], "length": length, "loop": loop, "feet_hips": feet_hips,
		"times": times, "vals": vals, "tans": tans, "fps": int(clip.get("fps", 30))}


static func channels_at(pre: Dictionary, t: float) -> Dictionary:
	var times: PackedFloat32Array = pre["times"]
	var n := times.size()
	var length: float = pre["length"]
	if pre["loop"]:
		t = fposmod(t, length)
	t = clampf(t, times[0], times[n - 1])
	var i := 0
	while i < n - 2 and t > times[i + 1]:
		i += 1
	var dt := maxf(times[i + 1] - times[i], 1e-6)
	var u := (t - times[i]) / dt
	var u2 := u * u
	var u3 := u2 * u
	var h00 := 2.0 * u3 - 3.0 * u2 + 1.0
	var h10 := u3 - 2.0 * u2 + u
	var h01 := -2.0 * u3 + 3.0 * u2
	var h11 := u3 - u2
	var c := {}
	var vals: Dictionary = pre["vals"]
	var tans: Dictionary = pre["tans"]
	for ch: String in CHANNELS:
		var pv: PackedVector3Array = vals[ch]
		var tv: PackedVector3Array = tans[ch]
		c[ch] = pv[i] * h00 + tv[i] * (h10 * dt) + pv[i + 1] * h01 + tv[i + 1] * (h11 * dt)
	return c


## Rotações locais dos ossos no instante t.
static func sample(rig: RefCounted, pre: Dictionary, t: float) -> Dictionary:
	return Solver.solve(rig, channels_at(pre, t), pre["feet_hips"])


## Aplica uma pose amostrada direto no esqueleto (pré-visualização).
static func apply_to_skeleton(rig: RefCounted, sk: Skeleton3D, pose: Dictionary) -> void:
	for b: String in rig.ANIMATED:
		var idx := sk.find_bone(b)
		if idx >= 0:
			sk.set_bone_pose_rotation(idx, pose[b])
	sk.set_bone_pose_position(sk.find_bone("hips"), pose["hips_pos"])


## Gera o recurso Animation (trilhas de rotação por osso + posição do quadril).
static func to_animation(rig: RefCounted, pre: Dictionary, skeleton_path: String) -> Animation:
	var anim := Animation.new()
	var length: float = pre["length"]
	anim.length = length
	anim.loop_mode = Animation.LOOP_LINEAR if pre["loop"] else Animation.LOOP_NONE
	var fps: int = pre["fps"]
	var steps := maxi(int(ceil(length * fps)), 1)
	var tracks := {}
	for b: String in rig.ANIMATED:
		var ti := anim.add_track(Animation.TYPE_ROTATION_3D)
		anim.track_set_path(ti, NodePath("%s:%s" % [skeleton_path, b]))
		anim.track_set_interpolation_type(ti, Animation.INTERPOLATION_LINEAR)
		tracks[b] = ti
	var pt := anim.add_track(Animation.TYPE_POSITION_3D)
	anim.track_set_path(pt, NodePath("%s:hips" % skeleton_path))
	for i in steps + 1:
		var t := minf(length * float(i) / float(steps), length)
		var pose := sample(rig, pre, t)
		for b2: String in rig.ANIMATED:
			anim.rotation_track_insert_key(tracks[b2], t, pose[b2])
		anim.position_track_insert_key(pt, t, pose["hips_pos"])
	return anim
