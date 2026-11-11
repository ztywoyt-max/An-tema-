extends Node3D
## Projétil levado pelo vento. Usado pelo Jato d'Água do jogador e pelos orbes do totem.
## Um parry devolve o projétil para quem atirou.

const Geo := preload("res://src/core/geo.gd")
const PARTICLE := preload("res://shaders/particle.gdshader")

var team := 1
var owner_actor: Node3D
var velocity := Vector3.ZERO
var damage := 10.0
var posture := 8.0
var knock := 4.0
var element := "water"
var radius := 0.32
var life := 6.0
var wind_factor := 0.9
var authoritative := true
var color := Color(0.45, 0.9, 1.0)
var reflected := false
var _mesh: MeshInstance3D
var _t := 0.0


func _ready() -> void:
	physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_ON
	_mesh = MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = radius
	sm.height = radius * 2.0
	sm.radial_segments = 16
	sm.rings = 8
	_mesh.mesh = sm
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = color.lerp(Color.WHITE, 0.35)
	mat.emission_enabled = true
	mat.emission = color
	mat.emission_energy_multiplier = 1.6
	_mesh.material_override = mat
	_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_mesh)


func reflect(by: Node3D) -> void:
	var back := owner_actor
	team = by.team
	owner_actor = by
	reflected = true
	damage *= 2.2
	posture *= 2.5
	life = 5.0
	var speed := velocity.length() * 1.6
	if back and is_instance_valid(back) and back.alive:
		velocity = (back.center() - global_position).normalized() * speed
	else:
		velocity = -velocity.normalized() * speed
	wind_factor = 0.0
	Fx.ring(global_position, velocity, Color(0.8, 1.0, 0.97), 1.6, 0.3)


func _physics_process(delta: float) -> void:
	_t += delta
	life -= delta
	if life <= 0.0:
		_pop(false)
		return
	var w: Vector3 = Wind.at(global_position)
	velocity += Vector3(w.x, w.y * 0.5, w.z) * wind_factor * delta
	var step := velocity * delta
	var from := global_position
	var to := from + step
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(from, to + step.normalized() * radius, Game.L_WORLD)
	var hit := space.intersect_ray(q)
	if not hit.is_empty():
		global_position = hit["position"]
		_pop(true)
		return
	if element == "water" or true:
		if Tide.depth_at(to) > 0.0 and Tide.depth_at(from) <= 0.0:
			Fx.burst("splash", Vector3(to.x, Tide.height_at(to), to.z), Vector3.UP, Color.WHITE, 0.8)
			Sfx.play_at("splash", to, -8.0, 1.4)
			if element == "water":
				queue_free()
				return
	for a: Node in get_tree().get_nodes_in_group(&"actors"):
		if not a.alive or a.team == team or a == owner_actor:
			continue
		var cap: Array[Vector3] = a.capsule_segment()
		if Geo.seg_seg_dist(from, to, cap[0], cap[1]) <= radius + a.radius:
			# quem decide é a máquina dona do alvo
			var mine: bool = authoritative if not a.is_in_group(&"players") else a.is_local
			if mine:
				var dir := velocity.normalized()
				var info := {"damage": damage, "posture": posture, "knock": Geo.flat(dir).normalized() * knock, "from": owner_actor,
					"from_pos": from - dir * 2.0, "kind": "proj", "element": element, "projectile": self, "no_stun": damage < 8.0}
				var res: String
				if a.is_in_group(&"players"):
					res = a.receive_hit(info)
				else:
					res = Net.deal_hit(a, info)
				if res == "parried":
					return
				if res == "hit" and owner_actor and is_instance_valid(owner_actor) and owner_actor.is_in_group(&"players") and owner_actor.is_local:
					owner_actor.combat.register_hit(damage, a.head_pos())
			global_position = to
			_pop(true)
			return
	global_position = to
	_mesh.scale = Vector3.ONE * (1.0 + 0.12 * sin(_t * 18.0))
	if int(_t * 30.0) != int((_t - delta) * 30.0):
		Fx.burst("splash_small" if element == "water" else "spark", global_position, -velocity, color, 0.6)


func _pop(sound: bool) -> void:
	Fx.burst("splash" if element == "water" else "hit", global_position, -velocity, color.lerp(Color.WHITE, 0.5), 1.0)
	Fx.ring(global_position, velocity, color, 1.4, 0.3)
	if sound:
		Sfx.play_at("splash" if element == "water" else "hit", global_position, -5.0, 1.3)
	queue_free()
