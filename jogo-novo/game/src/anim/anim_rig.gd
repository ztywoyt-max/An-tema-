extends RefCounted
## Dados de descanso do esqueleto humanoide, usados pelo resolvedor de poses.
## Espaço: X = direita do personagem, Y = cima, -Z = frente.

const ANIMATED := [
	"hips", "spine", "chest", "neck", "head",
	"shoulder_r", "upper_arm_r", "forearm_r", "hand_r",
	"shoulder_l", "upper_arm_l", "forearm_l", "hand_l",
	"thigh_r", "shin_r", "foot_r", "toe_r",
	"thigh_l", "shin_l", "foot_l", "toe_l",
]

var p: Dictionary = {}          ## osso -> posição global de descanso (cabeça do osso)
var gq: Dictionary = {}         ## osso -> rotação global de descanso
var parent: Dictionary = {}     ## osso -> nome do pai ("" na raiz)
var l_upper: Dictionary = {}    ## lado -> comprimento do braço
var l_fore: Dictionary = {}
var l_thigh: Dictionary = {}
var l_shin: Dictionary = {}
var r_upper: Dictionary = {}    ## lado -> direção de descanso
var r_fore: Dictionary = {}
var r_thigh: Dictionary = {}
var r_shin: Dictionary = {}
var h_arm: Dictionary = {}      ## lado -> eixo da dobradiça do cotovelo no descanso
var h_leg: Dictionary = {}
var grip_off: Vector3           ## empunhadura em relação ao pulso direito (descanso)
var wpn_q: Quaternion           ## rotação global de descanso do osso da arma
var wpn_dir: Vector3
var wpn_edge: Vector3
var valid := false


func setup(sk: Skeleton3D) -> void:
	for i in sk.get_bone_count():
		var n := sk.get_bone_name(i)
		var g := sk.get_bone_global_rest(i)
		p[n] = g.origin
		gq[n] = g.basis.get_rotation_quaternion()
		var pi := sk.get_bone_parent(i)
		parent[n] = sk.get_bone_name(pi) if pi >= 0 else ""
	for s: String in ["_r", "_l"]:
		var sh: Vector3 = p["upper_arm" + s]
		var el: Vector3 = p["forearm" + s]
		var wr: Vector3 = p["hand" + s]
		l_upper[s] = sh.distance_to(el)
		l_fore[s] = el.distance_to(wr)
		r_upper[s] = (el - sh).normalized()
		r_fore[s] = (wr - el).normalized()
		h_arm[s] = (r_upper[s] as Vector3).cross(r_fore[s]).normalized()
		var hip: Vector3 = p["thigh" + s]
		var kn: Vector3 = p["shin" + s]
		var an: Vector3 = p["foot" + s]
		l_thigh[s] = hip.distance_to(kn)
		l_shin[s] = kn.distance_to(an)
		r_thigh[s] = (kn - hip).normalized()
		r_shin[s] = (an - kn).normalized()
		var hx := Vector3.LEFT
		hx = (hx - (r_thigh[s] as Vector3) * hx.dot(r_thigh[s])).normalized()
		h_leg[s] = hx
	grip_off = p["weapon_r"] - p["hand_r"]
	wpn_q = gq["weapon_r"]
	wpn_dir = wpn_q * Vector3.UP
	wpn_edge = wpn_q * Vector3.BACK
	valid = true
