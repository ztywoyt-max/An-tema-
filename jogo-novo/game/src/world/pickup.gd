extends Node3D
## Orbe de Essência para coletar (os perdidos na morte e os escondidos no fundo do mar).

var amount := 20
var is_drop := false
var _t := 0.0
var _mesh: MeshInstance3D
var _base := Vector3.ZERO


func _ready() -> void:
	_base = position
	_mesh = MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.32 if is_drop else 0.2
	sm.height = sm.radius * 2.0
	_mesh.mesh = sm
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(1.0, 0.9, 0.5) if is_drop else Color(0.55, 1.0, 0.9)
	mat.emission_enabled = true
	mat.emission = mat.albedo_color
	mat.emission_energy_multiplier = 2.0
	_mesh.material_override = mat
	_mesh.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_mesh)


func _physics_process(delta: float) -> void:
	_t += delta
	position = _base + Vector3(0, 0.15 * sin(_t * 2.2), 0)
	_mesh.scale = Vector3.ONE * (1.0 + 0.1 * sin(_t * 5.0))
	if int(_t * 3.0) != int((_t - delta) * 3.0):
		Fx.burst("essence", global_position, Vector3.UP, _mesh.material_override.albedo_color, 0.7)
	var pl: Node3D = Game.player
	if pl and is_instance_valid(pl) and pl.alive and pl.center().distance_to(global_position) < 1.5:
		Game.add_currency(amount)
		Game.say("+%d %s" % [amount, Game.CURRENCY_NAME], "gold")
		Fx.burst("essence", global_position, Vector3.UP, Color(1.0, 0.95, 0.6), 1.4)
		Fx.ring(global_position, Vector3.UP, Color(1.0, 0.95, 0.6), 1.6, 0.4)
		Sfx.play_at("pickup", global_position, -4.0)
		queue_free()
