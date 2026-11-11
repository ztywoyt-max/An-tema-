extends MeshInstance3D
## Quadro de tela cheia que aplica o efeito pintura e o contorno a traço.

const SHADER := preload("res://shaders/post_draw.gdshader")

var mat: ShaderMaterial


func _ready() -> void:
	var quad := QuadMesh.new()
	quad.size = Vector2(2.0, 2.0)
	mesh = quad
	mat = ShaderMaterial.new()
	mat.shader = SHADER
	mat.render_priority = -100
	material_override = mat
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	custom_aabb = AABB(Vector3(-1e5, -1e5, -1e5), Vector3(2e5, 2e5, 2e5))
	extra_cull_margin = 16384.0
	physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	Settings.changed.connect(_apply)
	_apply()


func _apply() -> void:
	var paint: int = int(Settings.get_v("paint"))
	mat.set_shader_parameter("paint_radius", [0, 2, 3][clampi(paint, 0, 2)])
	mat.set_shader_parameter("paint_step", [1.0, 1.2, 1.4][clampi(paint, 0, 2)])
	mat.set_shader_parameter("outline_enabled", bool(Settings.get_v("outline")))
	visible = paint > 0 or bool(Settings.get_v("outline"))
