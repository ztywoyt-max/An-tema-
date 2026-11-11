extends RefCounted
## Ajudantes para montar cenário por código: materiais pintados e blocos com colisão.

const PAINTED := preload("res://shaders/painted.gdshader")
const TOON := preload("res://shaders/toon.gdshader")

const P_PLAIN := 0
const P_BLOCKS := 1
const P_PLANKS := 2
const P_SAND := 3
const P_TILES := 4


static func painted(pattern: int, a: Color, b: Color, opts: Dictionary = {}) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = PAINTED
	m.set_shader_parameter("pattern", pattern)
	m.set_shader_parameter("color_a", a)
	m.set_shader_parameter("color_b", b)
	for k: String in opts:
		m.set_shader_parameter(k, opts[k])
	return m


static func toon(opts: Dictionary = {}) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = TOON
	for k: String in opts:
		m.set_shader_parameter(k, opts[k])
	return m


## Caixa com malha e colisão. `pos` é o centro.
static func box(parent: Node, pos: Vector3, size: Vector3, mat: Material, collide: bool = true, rot_deg: Vector3 = Vector3.ZERO, node_name: String = "") -> Node3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	var root: Node3D
	if collide:
		var body := StaticBody3D.new()
		body.collision_layer = 1
		body.collision_mask = 0
		var cs := CollisionShape3D.new()
		var shape := BoxShape3D.new()
		shape.size = size
		cs.shape = shape
		body.add_child(cs)
		body.add_child(mi)
		root = body
	else:
		root = mi
	root.position = pos
	root.rotation_degrees = rot_deg
	if node_name != "":
		root.name = node_name
	parent.add_child(root)
	return root


## Caixa definida pelos cantos mínimo e máximo.
static func box_mm(parent: Node, lo: Vector3, hi: Vector3, mat: Material, collide: bool = true, node_name: String = "") -> Node3D:
	return box(parent, (lo + hi) * 0.5, (hi - lo).abs(), mat, collide, Vector3.ZERO, node_name)


static func cylinder(parent: Node, pos: Vector3, radius: float, height: float, mat: Material, collide: bool = true, top_radius: float = -1.0, sides: int = 20) -> Node3D:
	var mesh := CylinderMesh.new()
	mesh.bottom_radius = radius
	mesh.top_radius = radius if top_radius < 0.0 else top_radius
	mesh.height = height
	mesh.radial_segments = sides
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	var root: Node3D
	if collide:
		var body := StaticBody3D.new()
		body.collision_layer = 1
		body.collision_mask = 0
		var cs := CollisionShape3D.new()
		var shape := CylinderShape3D.new()
		shape.radius = maxf(radius, mesh.top_radius)
		shape.height = height
		cs.shape = shape
		body.add_child(cs)
		body.add_child(mi)
		root = body
	else:
		root = mi
	root.position = pos
	parent.add_child(root)
	return root


## Rampa: caixa inclinada que liga dois pontos (centro da borda de baixo ao centro da de cima).
static func ramp(parent: Node, from: Vector3, to: Vector3, width: float, thickness: float, mat: Material) -> Node3D:
	var d := to - from
	var length := d.length()
	var b := StaticBody3D.new()
	b.collision_layer = 1
	b.collision_mask = 0
	var mesh := BoxMesh.new()
	mesh.size = Vector3(width, thickness, length)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	var cs := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = mesh.size
	cs.shape = shape
	b.add_child(cs)
	b.add_child(mi)
	var fwd := d.normalized()
	var right := fwd.cross(Vector3.UP).normalized()
	var up := right.cross(fwd).normalized()
	b.transform = Transform3D(Basis(right, up, -fwd), (from + to) * 0.5 - up * thickness * 0.5)
	parent.add_child(b)
	return b
