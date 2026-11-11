extends "res://src/actors/actor.gd"
## Boneco de treino: não morre, mostra o dano e balança com os golpes.

const Build := preload("res://src/world/build.gd")

var body: Node3D
var _tilt := Vector2.ZERO
var _tilt_vel := Vector2.ZERO
var _flash := 0.0
var _meshes: Array[MeshInstance3D] = []
var dps_damage := 0.0
var dps_time := 0.0
var last_hit := 99.0


func _ready() -> void:
	team = TEAM_ENEMY
	display_name = "Boneco de treino"
	radius = 0.42
	height = 1.8
	max_hp = 999999.0
	hp = max_hp
	max_posture = 0.0
	collision_layer = Game.L_ENEMY
	collision_mask = 0
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = radius
	cap.height = height
	cs.shape = cap
	cs.position.y = height * 0.5
	add_child(cs)
	add_to_group(&"enemies")
	_build()


func _build() -> void:
	var wood := Build.toon({"tint": Color("#9c693c"), "use_vertex_color": false, "brush_world": true, "brush_amount": 0.14})
	var straw := Build.toon({"tint": Color("#e3c477"), "use_vertex_color": false, "brush_world": true, "brush_amount": 0.2, "brush_scale": 2.5})
	var cloth := Build.toon({"tint": Color("#d6457a"), "use_vertex_color": false, "brush_world": true, "brush_amount": 0.12})
	var white := Build.toon({"tint": Color("#f3ead6"), "use_vertex_color": false, "brush_world": true})
	Build.cylinder(self, Vector3(0, 0.06, 0), 0.5, 0.12, wood, false, 0.42, 14)
	body = Node3D.new()
	add_child(body)
	_meshes.append(_part(Build.cylinder(body, Vector3(0, 0.75, 0), 0.07, 1.5, wood, false, -1.0, 10)))
	_meshes.append(_part(Build.cylinder(body, Vector3(0, 1.0, 0), 0.3, 0.75, straw, false, 0.36, 14)))
	_meshes.append(_part(Build.cylinder(body, Vector3(0, 0.78, 0), 0.34, 0.1, cloth, false, -1.0, 14)))
	_meshes.append(_part(Build.cylinder(body, Vector3(0, 1.36, 0), 0.38, 0.06, cloth, false, -1.0, 14)))
	# braços em cruz
	var arm := Build.box(body, Vector3(0, 1.26, 0), Vector3(1.3, 0.09, 0.09), wood, false)
	_meshes.append(_part(arm))
	# cabeça de saco com rosto pintado
	var head := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.2
	sm.height = 0.42
	head.mesh = sm
	head.material_override = white
	head.position = Vector3(0, 1.62, 0)
	body.add_child(head)
	_meshes.append(head)
	for sx: float in [-1.0, 1.0]:
		var eye := Build.box(body, Vector3(0.07 * sx, 1.66, -0.185), Vector3(0.05, 0.02, 0.02), Build.toon({"tint": Color("#27357a"), "use_vertex_color": false}), false, Vector3(0, 0, 25.0 * sx))
		_meshes.append(_part(eye))
	var hat := MeshInstance3D.new()
	var cone := CylinderMesh.new()
	cone.top_radius = 0.02
	cone.bottom_radius = 0.42
	cone.height = 0.22
	cone.radial_segments = 18
	hat.mesh = cone
	hat.material_override = straw
	hat.position = Vector3(0, 1.86, 0)
	body.add_child(hat)
	_meshes.append(hat)


func _part(n: Node3D) -> MeshInstance3D:
	return n as MeshInstance3D


func is_staggered() -> bool:
	return false


func receive_hit(hit: Dictionary) -> String:
	var dmg: float = float(hit.get("damage", 0.0))
	var k: Vector3 = hit.get("knock", Vector3.ZERO)
	var from_pos: Vector3 = hit.get("from_pos", global_position + Vector3.FORWARD)
	var dir := (global_position - from_pos)
	dir.y = 0.0
	dir = dir.normalized() if dir.length() > 0.01 else Vector3.FORWARD
	var power := clampf(k.length() * 0.6 + dmg * 0.12, 1.5, 9.0)
	_tilt_vel += Vector2(dir.z, -dir.x) * power
	_flash = 1.0
	if hit.get("element", "") == "water":
		set_wet(12.0)
	if last_hit > 2.5:
		dps_damage = 0.0
		dps_time = 0.0
	dps_damage += dmg
	last_hit = 0.0
	damaged.emit(dmg, "hit")
	return "hit"


func _physics_process(delta: float) -> void:
	tick_status(delta)
	last_hit += delta
	if last_hit < 2.5:
		dps_time += delta
	# mola amortecida
	_tilt_vel += (-_tilt * 90.0 - _tilt_vel * 7.0) * delta
	_tilt += _tilt_vel * delta
	_tilt = _tilt.limit_length(0.7)
	body.rotation = Vector3(_tilt.x, 0.0, _tilt.y)
	if _flash > 0.0:
		_flash = maxf(_flash - delta * 7.0, 0.0)
		for m in _meshes:
			if m:
				m.set_instance_shader_parameter(&"flash", _flash)
