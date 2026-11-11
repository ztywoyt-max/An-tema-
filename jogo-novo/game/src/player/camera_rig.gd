extends Node3D
## Câmera do jogador: 3ª pessoa (atrás, com colisão) e 1ª pessoa, trava de alvo,
## tremor de impacto e campo de visão dinâmico.

const TP_DISTANCE := 4.4
const TP_HEIGHT := 1.55
const TP_SHOULDER := 0.32
const FP_HEIGHT := 1.64
const PITCH_MIN := -1.35
const PITCH_MAX := 1.2

var target: Node3D
var cam: Camera3D
var yaw := 0.0
var pitch := -0.18
var first_person := false
var lock_target: Node3D
var trauma := 0.0
var fov_kick := 0.0
var extra_distance := 0.0
var fp_blend := 0.0

var _dist := TP_DISTANCE
var _pivot := Vector3.ZERO
var _time := 0.0
var _has_pivot := false


func _ready() -> void:
	top_level = true
	physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	cam = Camera3D.new()
	cam.name = "Camera"
	cam.near = 0.07
	cam.far = 6000.0
	cam.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	add_child(cam)
	cam.make_current()
	first_person = bool(Settings.get_v("first_person"))
	fp_blend = 1.0 if first_person else 0.0
	process_priority = 100


func flat_forward() -> Vector3:
	return Vector3(-sin(yaw), 0.0, -cos(yaw))


func flat_right() -> Vector3:
	return Vector3(cos(yaw), 0.0, -sin(yaw))


func forward() -> Vector3:
	return -Basis.from_euler(Vector3(pitch, yaw, 0.0)).z


func set_first_person(value: bool) -> void:
	first_person = value
	Settings.set_v("first_person", value)


func shake(amount: float) -> void:
	trauma = minf(trauma + amount, 1.0)


func kick_fov(amount: float) -> void:
	fov_kick = maxf(fov_kick, amount)


func snap() -> void:
	_has_pivot = false


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED and Game.input_enabled and not Game.paused:
		var sens: float = 0.0023 * float(Settings.get_v("mouse_sens"))
		var rel: Vector2 = (event as InputEventMouseMotion).relative
		var inv := -1.0 if bool(Settings.get_v("invert_y")) else 1.0
		if lock_target == null or first_person:
			yaw -= rel.x * sens
		pitch = clampf(pitch - rel.y * sens * inv, PITCH_MIN, PITCH_MAX)


func _process(delta: float) -> void:
	if target == null or not is_instance_valid(target):
		return
	_time += delta
	if Game.input_enabled and not Game.paused:
		var look := Input.get_vector(&"look_left", &"look_right", &"look_up", &"look_down")
		if look.length() > 0.01:
			var ps: float = 2.8 * float(Settings.get_v("pad_sens")) * delta
			var inv := -1.0 if bool(Settings.get_v("invert_y")) else 1.0
			if lock_target == null or first_person:
				yaw -= look.x * ps
			pitch = clampf(pitch - look.y * ps * 0.7 * inv, PITCH_MIN, PITCH_MAX)
	var tp: Vector3 = target.get_global_transform_interpolated().origin
	# trava de alvo: a câmera gira para manter o alvo enquadrado
	if lock_target and is_instance_valid(lock_target):
		var to: Vector3 = lock_target.center() - (tp + Vector3.UP * TP_HEIGHT)
		var flat := Vector2(to.x, to.z).length()
		if flat > 0.4:
			var want_yaw := atan2(-to.x, -to.z)
			var want_pitch := clampf(atan2(to.y, flat) - (0.0 if first_person else 0.16), -0.7, 0.5)
			var k := 1.0 - exp(-delta * 9.0)
			yaw = lerp_angle(yaw, want_yaw, k)
			pitch = lerpf(pitch, want_pitch, k * 0.7)
	yaw = wrapf(yaw, -PI, PI)
	fp_blend = move_toward(fp_blend, 1.0 if first_person else 0.0, delta * 5.0)

	var pivot := tp + Vector3.UP * TP_HEIGHT
	if not _has_pivot:
		_pivot = pivot
		_has_pivot = true
	_pivot.x = pivot.x
	_pivot.z = pivot.z
	_pivot.y = lerpf(_pivot.y, pivot.y, 1.0 - exp(-delta * 16.0))
	var rot := Basis.from_euler(Vector3(pitch, yaw, 0.0))
	# 3ª pessoa com colisão
	var want := TP_DISTANCE + extra_distance
	var side := rot.x * TP_SHOULDER
	var from := _pivot + side
	var to_cam := from + rot.z * want + rot.y * 0.25
	var space := get_world_3d().direct_space_state
	var hit_dist := want
	if space:
		var q := PhysicsRayQueryParameters3D.create(from, to_cam, Game.L_WORLD)
		var hit := space.intersect_ray(q)
		if not hit.is_empty():
			hit_dist = maxf(from.distance_to(hit["position"]) - 0.28, 0.5)
	if hit_dist < _dist:
		_dist = hit_dist
	else:
		_dist = move_toward(_dist, hit_dist, delta * 7.0)
	var tp_pos := from + rot.z * _dist + rot.y * (0.25 * _dist / want)
	var fp_pos := tp + Vector3.UP * FP_HEIGHT + flat_forward() * 0.1
	var pos := tp_pos.lerp(fp_pos, smoothstep(0.0, 1.0, fp_blend))
	# tremor
	trauma = maxf(trauma - delta * 1.7, 0.0)
	var amt: float = trauma * trauma * float(Settings.get_v("shake"))
	var sh := Vector3(sin(_time * 61.0) + sin(_time * 37.0 + 1.0), sin(_time * 53.0 + 2.0) + sin(_time * 43.0), 0.0) * 0.5
	pos += (rot.x * sh.x + rot.y * sh.y) * amt * 0.22
	cam.global_transform = Transform3D(rot * Basis.from_euler(Vector3(sh.y * amt * 0.02, sh.x * amt * 0.02, sh.x * amt * 0.03)), pos)
	global_position = _pivot
	# campo de visão
	fov_kick = maxf(fov_kick - delta * 26.0, 0.0)
	var base_fov: float = lerpf(float(Settings.get_v("fov_third")), float(Settings.get_v("fov_first")), fp_blend)
	cam.fov = clampf(base_fov + fov_kick, 30.0, 140.0)
