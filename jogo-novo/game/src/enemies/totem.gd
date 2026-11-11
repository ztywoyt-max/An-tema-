extends "res://src/actors/actor.gd"
## Totem de água: torre parada que atira orbes lentos. O vento desvia os orbes e um
## parry os devolve contra o totem.

const Build := preload("res://src/world/build.gd")

var active := false
var cooldown := 1.5
var body: Node3D
var orb: MeshInstance3D
var uid := 0
var is_puppet := false
var _flash := 0.0
var _meshes: Array = []
var _t := 0.0
var _hidden := false


func _ready() -> void:
	team = TEAM_ENEMY
	display_name = "Totem de água"
	radius = 0.6
	height = 2.6
	max_hp = 90.0
	hp = max_hp
	max_posture = 0.0
	collision_layer = Game.L_ENEMY | Game.L_WORLD
	collision_mask = 0
	var cs := CollisionShape3D.new()
	var cyl := CylinderShape3D.new()
	cyl.radius = 0.55
	cyl.height = 2.2
	cs.shape = cyl
	cs.position.y = 1.1
	add_child(cs)
	add_to_group(&"enemies")
	body = Node3D.new()
	add_child(body)
	var stone := Build.toon({"tint": Color("#6c6684"), "use_vertex_color": false, "brush_world": true, "brush_amount": 0.16})
	var teal := Build.toon({"tint": Color("#1fb3a4"), "use_vertex_color": false, "brush_world": true})
	for i in 4:
		var r := 0.55 - 0.07 * float(i)
		_meshes.append(Build.cylinder(body, Vector3(0, 0.27 + 0.52 * float(i), 0), r, 0.5, stone if i % 2 == 0 else teal, false, r * 0.86, 10))
	orb = MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.3
	sm.height = 0.6
	orb.mesh = sm
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(0.5, 0.95, 1.0)
	mat.emission_enabled = true
	mat.emission = Color(0.3, 0.85, 1.0)
	mat.emission_energy_multiplier = 0.4
	orb.material_override = mat
	orb.position = Vector3(0, 2.55, 0)
	body.add_child(orb)


func is_staggered() -> bool:
	return false


func set_active(value: bool) -> void:
	active = value
	cooldown = 1.2
	(orb.material_override as StandardMaterial3D).emission_energy_multiplier = 2.2 if value else 0.4


func restore() -> void:
	alive = true
	hp = max_hp
	_hidden = false
	body.visible = true
	collision_layer = Game.L_ENEMY | Game.L_WORLD


func receive_hit(hit: Dictionary) -> String:
	if not alive:
		return "immune"
	_flash = 1.0
	if hit.get("element", "") == "water":
		set_wet(12.0)
	apply_damage(float(hit.get("damage", 0.0)), hit)
	return "hit"


func die() -> void:
	if not alive:
		return
	super.die()
	active = false
	body.visible = false
	_hidden = true
	collision_layer = 0
	Fx.burst("shock", global_position + Vector3.UP, Vector3.UP, Color.WHITE, 1.5)
	Fx.burst("splash", global_position + Vector3.UP * 2.0, Vector3.UP, Color(0.6, 0.95, 1.0), 2.0)
	Sfx.play_at("enemy_death", global_position, 0.0)
	if Game.stage:
		Game.stage.enemy_died(self)


func _physics_process(delta: float) -> void:
	tick_status(delta)
	_t += delta
	if _flash > 0.0:
		_flash = maxf(_flash - delta * 7.0, 0.0)
		for m: Node in _meshes:
			if m is MeshInstance3D:
				(m as MeshInstance3D).set_instance_shader_parameter(&"flash", _flash)
	orb.position.y = 2.55 + 0.08 * sin(_t * 2.4)
	if not active or not alive or is_puppet:
		return
	cooldown -= delta
	if cooldown > 0.0:
		return
	var target: Node3D = null
	var bd := 40.0
	for pl: Node in get_tree().get_nodes_in_group(&"players"):
		if pl.alive and pl.global_position.distance_to(global_position) < bd:
			bd = pl.global_position.distance_to(global_position)
			target = pl
	if target == null:
		cooldown = 0.5
		return
	cooldown = 2.4
	var from := orb.global_position
	var speed := 13.0
	var lead: Vector3 = target.center() + target.velocity * (bd / speed) * 0.6
	var dir := (lead - from).normalized()
	Game.stage.spawn_projectile({"pos": from, "vel": dir * speed, "team": TEAM_ENEMY, "owner": get_path(), "damage": 12.0, "posture": 0.0,
		"knock": 4.0, "element": "water", "wind": 1.0, "color": Color(0.45, 0.9, 1.0)})
	Sfx.play_at("orb", from, -2.0)
	Fx.ring(from, dir, Color(0.6, 0.95, 1.0), 1.2, 0.3)
