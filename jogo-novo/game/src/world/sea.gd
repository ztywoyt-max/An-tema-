extends Node3D
## Superfície do mar: malha detalhada perto da câmera (com ondas) + anel até o horizonte.

const WATER := preload("res://shaders/water.gdshader")
const NEAR_HALF := 80.0
const FAR_HALF := 4000.0

var near_mat: ShaderMaterial
var far_mat: ShaderMaterial


func _ready() -> void:
	physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	near_mat = ShaderMaterial.new()
	near_mat.shader = WATER
	near_mat.render_priority = 1
	near_mat.set_shader_parameter("vertex_waves", true)
	near_mat.set_shader_parameter("edge_fade_start", NEAR_HALF - 12.0)
	near_mat.set_shader_parameter("edge_fade_end", NEAR_HALF - 1.0)
	far_mat = near_mat.duplicate()
	far_mat.set_shader_parameter("vertex_waves", false)

	var plane := PlaneMesh.new()
	plane.size = Vector2(NEAR_HALF * 2.0, NEAR_HALF * 2.0)
	plane.subdivide_width = int(NEAR_HALF * 2.0) - 1
	plane.subdivide_depth = int(NEAR_HALF * 2.0) - 1
	var near := MeshInstance3D.new()
	near.name = "MarPerto"
	near.mesh = plane
	near.material_override = near_mat
	near.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	near.custom_aabb = AABB(Vector3(-NEAR_HALF, -3.0, -NEAR_HALF), Vector3(NEAR_HALF * 2.0, 6.0, NEAR_HALF * 2.0))
	add_child(near)

	var far := MeshInstance3D.new()
	far.name = "MarLonge"
	far.mesh = _ring_mesh(NEAR_HALF - 0.5, FAR_HALF)
	far.material_override = far_mat
	far.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	far.position.y = -0.01
	add_child(far)


func _ring_mesh(inner: float, outer: float) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var i := inner
	var o := outer
	var ci := [Vector3(-i, 0, -i), Vector3(i, 0, -i), Vector3(i, 0, i), Vector3(-i, 0, i)]
	var co := [Vector3(-o, 0, -o), Vector3(o, 0, -o), Vector3(o, 0, o), Vector3(-o, 0, o)]
	for k in 4:
		var k2 := (k + 1) % 4
		for v: Vector3 in [co[k], co[k2], ci[k2], co[k], ci[k2], ci[k]]:
			st.set_normal(Vector3.UP)
			st.add_vertex(v)
	return st.commit()


func _process(_delta: float) -> void:
	var cam := get_viewport().get_camera_3d()
	if cam:
		var p := cam.global_position
		position = Vector3(snappedf(p.x, 2.0), Tide.level, snappedf(p.z, 2.0))
	else:
		position.y = Tide.level
