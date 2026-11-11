extends Node3D
## Visual de um humanoide: modelo, material toon, animações (AnimationTree),
## arma na mão, panos com mola e efeitos de material (clarão, molhado, dissolver).

const ModelUtil := preload("res://src/core/model_util.gd")
const AnimRig := preload("res://src/anim/anim_rig.gd")
const Builder := preload("res://src/anim/anim_builder.gd")
const Clips := preload("res://src/anim/clips_humanoid.gd")

const SKEL_PATH := "Rig/Skeleton3D"
const UPPER_BONES := ["spine", "chest", "neck", "head", "shoulder_r", "upper_arm_r", "forearm_r", "hand_r", "shoulder_l", "upper_arm_l", "forearm_l", "hand_l"]
const UPPER_CLIPS := ["block", "block_hit", "parry", "drink", "cast", "interact", "guard_idle", "wind_charge"]
## Cadeias com mola: [osso raiz, osso final, rigidez, arrasto, gravidade]
const SPRINGS := [
	["scarf_a1", "scarf_a5", 0.35, 0.35, 0.55],
	["scarf_b1", "scarf_b4", 0.35, 0.35, 0.55],
	["cloth_b1", "cloth_b3", 0.9, 0.45, 0.9],
	["cloth_f1", "cloth_f2", 1.1, 0.45, 0.9],
	["sash1", "sash2", 0.7, 0.4, 0.8],
	["hair1", "hair3", 1.6, 0.45, 0.5],
]
const WEAPON_LENGTH := {"sword": 1.0, "spear": 1.52, "club": 1.24, "sentinel_blade": 0.95}
const Trail := preload("res://src/fx/trail.gd")
## Janela (tempo do clipe) em que a arma deixa rastro.
const TRAIL_WINDOWS := {
	"atk_l1": [0.1, 0.25], "atk_l2": [0.08, 0.24], "atk_l3": [0.09, 0.25], "atk_l4": [0.2, 0.34], "atk_h1": [0.27, 0.46],
	"atk_spin": [0.16, 0.52], "atk_launch": [0.13, 0.31], "atk_thrust": [0.12, 0.28], "atk_air1": [0.08, 0.24], "atk_air2": [0.07, 0.24],
	"atk_crit": [0.26, 0.4], "atk_plunge_loop": [0.0, 9.0], "parry": [0.0, 0.14],
}

static var _library: AnimationLibrary
static var _lengths: Dictionary = {}
static var _loops: Dictionary = {}

var model: Node3D
var skeleton: Skeleton3D
var meshes: Array[MeshInstance3D] = []
var anim_player: AnimationPlayer
var tree: AnimationTree
var springs: SpringBoneSimulator3D
var weapon_attach: BoneAttachment3D
var weapon: Node3D
var weapon_name := ""
var weapon_meshes: Array[MeshInstance3D] = []
var trail: MeshInstance3D
var trail_color := Color(0.78, 1.0, 0.97)
var current := ""
var current_upper := ""
var time_in_clip := 0.0
var speed_scale := 1.0
var owner_velocity := Vector3.ZERO

var _base_tr: AnimationNodeTransition
var _upper_tr: AnimationNodeTransition
var _upper_amount := 0.0
var _upper_target := 0.0
var _upper_rate := 8.0
var _freeze := 0.0
var _flash := 0.0
var _wet := 0.0
var _head_idx := -1
var _head_hidden := false


## Gera (uma vez) a biblioteca de animações compartilhada.
static func ensure_library(sk: Skeleton3D) -> void:
	if _library != null:
		return
	var rig := AnimRig.new()
	rig.setup(sk)
	_library = AnimationLibrary.new()
	for n in Clips.names():
		var pre: Dictionary = Builder.prepare(rig, Clips.get_clip(n))
		_library.add_animation(n, Builder.to_animation(rig, pre, SKEL_PATH))
		_lengths[n] = pre["length"]
		_loops[n] = pre["loop"]


static func clip_length(clip: String) -> float:
	return _lengths.get(clip, 0.5)


func setup(model_name: String, weapon_id: String = "") -> void:
	var scene: PackedScene = load("res://assets/models/%s.glb" % model_name)
	model = scene.instantiate()
	add_child(model)
	# o modelo olha para -Z, igual ao corpo do personagem
	meshes = ModelUtil.toonify(model)
	skeleton = ModelUtil.find_skeleton(model)
	_head_idx = skeleton.find_bone("head")
	ensure_library(skeleton)
	anim_player = AnimationPlayer.new()
	anim_player.name = "Animacoes"
	model.add_child(anim_player)
	anim_player.add_animation_library(&"", _library)
	_build_tree()
	_build_springs()
	weapon_attach = BoneAttachment3D.new()
	weapon_attach.name = "MaoDireita"
	weapon_attach.bone_name = "weapon_r"
	skeleton.add_child(weapon_attach)
	if weapon_id != "":
		set_weapon(weapon_id)
	trail = Trail.new()
	trail.name = "Rastro"
	add_child(trail)
	play("idle", 0.0)


func _build_tree() -> void:
	var bt := AnimationNodeBlendTree.new()
	_base_tr = AnimationNodeTransition.new()
	_base_tr.xfade_time = 0.12
	_base_tr.allow_transition_to_self = true
	var names: Array = _lengths.keys()
	_base_tr.input_count = names.size()
	bt.add_node(&"base", _base_tr)
	for i in names.size():
		var an := AnimationNodeAnimation.new()
		an.animation = names[i]
		bt.add_node("a_" + String(names[i]), an)
		_base_tr.set_input_name(i, names[i])
		_base_tr.set_input_reset(i, true)
		bt.connect_node(&"base", i, "a_" + String(names[i]))
	var seek := AnimationNodeTimeSeek.new()
	bt.add_node(&"seek", seek)
	bt.connect_node(&"seek", 0, &"base")
	var ts := AnimationNodeTimeScale.new()
	bt.add_node(&"speed", ts)
	bt.connect_node(&"speed", 0, &"seek")
	_upper_tr = AnimationNodeTransition.new()
	_upper_tr.xfade_time = 0.1
	_upper_tr.allow_transition_to_self = true
	_upper_tr.input_count = UPPER_CLIPS.size()
	bt.add_node(&"upper", _upper_tr)
	for i in UPPER_CLIPS.size():
		var an2 := AnimationNodeAnimation.new()
		an2.animation = UPPER_CLIPS[i]
		bt.add_node("u_" + String(UPPER_CLIPS[i]), an2)
		_upper_tr.set_input_name(i, UPPER_CLIPS[i])
		_upper_tr.set_input_reset(i, true)
		bt.connect_node(&"upper", i, "u_" + String(UPPER_CLIPS[i]))
	var mix := AnimationNodeBlend2.new()
	mix.filter_enabled = true
	for b: String in UPPER_BONES:
		mix.set_filter_path(NodePath("%s:%s" % [SKEL_PATH, b]), true)
	bt.add_node(&"upper_mix", mix)
	bt.connect_node(&"upper_mix", 0, &"speed")
	bt.connect_node(&"upper_mix", 1, &"upper")
	bt.connect_node(&"output", 0, &"upper_mix")
	tree = AnimationTree.new()
	tree.name = "Arvore"
	model.add_child(tree)
	tree.anim_player = tree.get_path_to(anim_player)
	tree.tree_root = bt
	tree.active = true
	tree.set("parameters/upper_mix/blend_amount", 0.0)
	tree.set("parameters/speed/scale", 1.0)


func _build_springs() -> void:
	springs = SpringBoneSimulator3D.new()
	springs.name = "Molas"
	skeleton.add_child(springs)
	var valid := []
	for s: Array in SPRINGS:
		if skeleton.find_bone(s[0]) >= 0 and skeleton.find_bone(s[1]) >= 0:
			valid.append(s)
	springs.setting_count = valid.size()
	for i in valid.size():
		var s2: Array = valid[i]
		springs.set_root_bone_name(i, s2[0])
		springs.set_end_bone_name(i, s2[1])
		springs.set_extend_end_bone(i, true)
		springs.set_end_bone_length(i, 0.14)
		springs.set_stiffness(i, s2[2])
		springs.set_drag(i, s2[3])
		springs.set_gravity(i, s2[4])
		springs.set_gravity_direction(i, Vector3.DOWN)
		springs.set_radius(i, 0.02)


func set_weapon(weapon_id: String) -> void:
	if weapon_id == weapon_name:
		return
	if weapon:
		weapon.queue_free()
		weapon = null
	weapon_meshes.clear()
	weapon_name = weapon_id
	if weapon_id == "":
		return
	var scene: PackedScene = load("res://assets/models/%s.glb" % weapon_id)
	if scene == null:
		return
	weapon = scene.instantiate()
	weapon_attach.add_child(weapon)
	weapon_meshes = ModelUtil.toonify(weapon)


## Base e ponta da lâmina no mundo.
func weapon_segment() -> Array[Vector3]:
	var t := weapon_attach.global_transform
	var length: float = WEAPON_LENGTH.get(weapon_name, 1.0)
	return [t.origin + t.basis.y * 0.08, t.origin + t.basis.y * length]


func play(clip: String, blend: float = 0.12, speed: float = 1.0, restart: bool = true) -> void:
	if not _lengths.has(clip):
		push_warning("animação inexistente: " + clip)
		return
	if clip == current and not restart:
		set_speed(speed)
		return
	_base_tr.xfade_time = blend
	tree.set("parameters/base/transition_request", clip)
	current = clip
	time_in_clip = 0.0
	set_speed(speed)


## Começa um clipe a partir de um instante.
func play_from(clip: String, from: float, blend: float = 0.08, speed: float = 1.0) -> void:
	play(clip, blend, speed)
	tree.set("parameters/seek/seek_request", from)
	time_in_clip = from


func set_speed(speed: float) -> void:
	speed_scale = speed
	if _freeze <= 0.0:
		tree.set("parameters/speed/scale", speed)


func play_upper(clip: String, blend: float = 0.1) -> void:
	if not UPPER_CLIPS.has(clip):
		return
	if clip != current_upper or _upper_target < 0.5:
		_upper_tr.xfade_time = blend
		tree.set("parameters/upper/transition_request", clip)
		current_upper = clip
	_upper_target = 1.0
	_upper_rate = 1.0 / maxf(blend, 0.01)


func stop_upper(blend: float = 0.15) -> void:
	_upper_target = 0.0
	_upper_rate = 1.0 / maxf(blend, 0.01)


func is_finished() -> bool:
	return not _loops.get(current, true) and time_in_clip >= clip_length(current)


## Congela a animação por alguns instantes (impacto do golpe).
func hitstop(seconds: float) -> void:
	_freeze = maxf(_freeze, seconds)
	tree.set("parameters/speed/scale", 0.0)


func is_frozen() -> bool:
	return _freeze > 0.0


func flash(amount: float = 1.0) -> void:
	_flash = maxf(_flash, amount)


func set_wet(amount: float) -> void:
	if not is_equal_approx(amount, _wet):
		_wet = amount
		ModelUtil.set_instance_param(meshes, &"wet", amount)
		ModelUtil.set_instance_param(weapon_meshes, &"wet", amount)


func set_dissolve(amount: float) -> void:
	ModelUtil.set_instance_param(meshes, &"dissolve", amount)
	ModelUtil.set_instance_param(weapon_meshes, &"dissolve", amount)


func set_tint(color: Color) -> void:
	ModelUtil.set_instance_param(meshes, &"inst_tint", color)


## Esconde a cabeça (visão em primeira pessoa).
func set_head_hidden(hidden: bool) -> void:
	_head_hidden = hidden
	if _head_idx >= 0:
		skeleton.set_bone_pose_scale(_head_idx, Vector3.ONE * (0.001 if hidden else 1.0))


func set_shadow_only(enabled: bool) -> void:
	for mi in meshes:
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON


func bone_position(bone: String) -> Vector3:
	var idx := skeleton.find_bone(bone)
	if idx < 0:
		return global_position
	return skeleton.global_transform * skeleton.get_bone_global_pose(idx).origin


func _process(delta: float) -> void:
	if _freeze > 0.0:
		_freeze -= delta
		if _freeze <= 0.0:
			tree.set("parameters/speed/scale", speed_scale)
	else:
		time_in_clip += delta * speed_scale
	if not is_equal_approx(_upper_amount, _upper_target):
		_upper_amount = move_toward(_upper_amount, _upper_target, delta * _upper_rate)
		tree.set("parameters/upper_mix/blend_amount", _upper_amount)
	if _flash > 0.0:
		_flash = maxf(_flash - delta * 7.0, 0.0)
		ModelUtil.set_instance_param(meshes, &"flash", _flash)
	# rastro da arma durante a parte ativa dos golpes
	if trail and weapon:
		var win: Array = TRAIL_WINDOWS.get(current, [])
		var on := false
		if win.size() == 2 and time_in_clip >= float(win[0]) and time_in_clip <= float(win[1]):
			on = true
		if current_upper == "parry" and _upper_target > 0.5 and _upper_amount > 0.6 and _upper_amount < 0.999:
			on = true
		if on:
			var seg := weapon_segment()
			trail.color = trail_color
			trail.add_point(seg[0].lerp(seg[1], 0.25), seg[1])
	# vento e inércia nos panos
	var wind: Vector3 = Wind.at(global_position)
	if springs:
		springs.external_force = wind * 0.035 - owner_velocity * 0.012
	ModelUtil.set_instance_param(meshes, &"sway_vel", owner_velocity)
