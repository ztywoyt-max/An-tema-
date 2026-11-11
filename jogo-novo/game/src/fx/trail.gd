extends MeshInstance3D
## Rastro da arma: uma fita entre a base e a ponta da lâmina nos últimos instantes.

const RING := preload("res://shaders/ring.gdshader")
const MAX_POINTS := 16
const LIFE := 0.2

var color := Color(0.78, 1.0, 0.97)
var _pts: Array = []        # [base, ponta, idade]
var _im: ImmediateMesh
var _mat: ShaderMaterial


func _ready() -> void:
	top_level = true
	physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	_im = ImmediateMesh.new()
	mesh = _im
	_mat = ShaderMaterial.new()
	_mat.shader = RING
	_mat.set_shader_parameter("mode", 1)
	_mat.set_shader_parameter("glow", 1.9)
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	custom_aabb = AABB(Vector3(-1e4, -1e4, -1e4), Vector3(2e4, 2e4, 2e4))
	global_transform = Transform3D.IDENTITY


func add_point(base: Vector3, tip: Vector3) -> void:
	_pts.push_front([base, tip, 0.0])
	if _pts.size() > MAX_POINTS:
		_pts.pop_back()


func _process(delta: float) -> void:
	if _pts.is_empty():
		return
	for pt: Array in _pts:
		pt[2] += delta
	while not _pts.is_empty() and float(_pts[_pts.size() - 1][2]) > LIFE:
		_pts.pop_back()
	_im.clear_surfaces()
	var n := _pts.size()
	if n < 2:
		return
	_mat.set_shader_parameter("color", color)
	global_transform = Transform3D.IDENTITY
	_im.surface_begin(Mesh.PRIMITIVE_TRIANGLE_STRIP, _mat)
	for i in n:
		var u := clampf(float(_pts[i][2]) / LIFE, 0.0, 1.0)
		_im.surface_set_uv(Vector2(u, 0.0))
		_im.surface_add_vertex(_pts[i][0])
		_im.surface_set_uv(Vector2(u, 1.0))
		_im.surface_add_vertex(_pts[i][1])
	_im.surface_end()
