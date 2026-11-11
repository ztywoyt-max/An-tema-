extends Node3D
## Zona de vento: uma caixa com um vetor de vento (corrente ascendente ou corredor de rajada).
## O vento empurra o jogador, os projéteis e aparece como riscos brancos.

const PARTICLE := preload("res://shaders/particle.gdshader")

var size := Vector3(4, 10, 4)
var vector := Vector3(0, 12, 0)
var show_fx := true


func _enter_tree() -> void:
	if not Wind.zones.has(self):
		Wind.zones.append(self)


func _exit_tree() -> void:
	Wind.zones.erase(self)


func wind_at(pos: Vector3) -> Vector3:
	var l := pos - global_position
	var h := size * 0.5
	if absf(l.x) > h.x or absf(l.y) > h.y or absf(l.z) > h.z:
		return Vector3.ZERO
	var e := minf(minf((h.x - absf(l.x)) / 0.7, (h.z - absf(l.z)) / 0.7), (h.y - absf(l.y)) / 0.9)
	return vector * clampf(e, 0.0, 1.0)


func _ready() -> void:
	if not show_fx or DisplayServer.get_name() == "headless":
		return
	var speed := vector.length()
	var dir := vector.normalized()
	var along := absf(size.x * dir.x) + absf(size.y * dir.y) + absf(size.z * dir.z)
	var e := CPUParticles3D.new()
	var shader := Shader.new()
	shader.code = PARTICLE.code.replace("render_mode unshaded,", "render_mode blend_add, unshaded,")
	var mat := ShaderMaterial.new()
	mat.shader = shader
	mat.set_shader_parameter("shape", 2)
	mat.set_shader_parameter("glow", 1.25)
	mat.set_shader_parameter("billboard", false)
	e.mesh = Fx._cross if Fx._cross else QuadMesh.new()
	e.material_override = mat
	var volume := size.x * size.y * size.z
	e.amount = clampi(int(volume / 9.0), 10, 90)
	e.lifetime = clampf(along * 0.55 / maxf(speed * 0.7, 0.1), 0.5, 2.4)
	e.local_coords = false
	e.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	e.emission_box_extents = size * 0.5 - (dir.abs() * along * 0.22)
	e.position = -dir * along * 0.2
	e.direction = dir
	e.spread = 4.0
	e.gravity = Vector3.ZERO
	e.initial_velocity_min = speed * 0.55
	e.initial_velocity_max = speed * 0.85
	e.particle_flag_align_y = true
	e.split_scale = true
	var cx := Curve.new()
	cx.add_point(Vector2(0, 0.0))
	cx.add_point(Vector2(0.2, 0.09))
	cx.add_point(Vector2(1, 0.0))
	e.scale_curve_x = cx
	e.scale_curve_z = cx
	var cy := Curve.new()
	cy.add_point(Vector2(0, 0.6))
	cy.add_point(Vector2(0.5, 1.0))
	cy.add_point(Vector2(1, 0.6))
	e.scale_curve_y = cy
	e.scale_amount_min = 1.4
	e.scale_amount_max = 3.4
	e.color = Color(0.9, 1.0, 0.98, 0.5)
	e.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	e.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	add_child(e)
