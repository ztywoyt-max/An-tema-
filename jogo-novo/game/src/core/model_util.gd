extends RefCounted
## Troca os materiais importados (.glb) pelo material toon do jogo, pelo nome do material.

const TOON := preload("res://shaders/toon.gdshader")

const PARAMS := {
	"skin": {"brush_amount": 0.05, "rim_strength": 0.35, "brush_scale": 2.0},
	"cloth": {"brush_amount": 0.11, "flutter": 0.06, "brush_scale": 2.2},
	"hair": {"brush_amount": 0.05, "rim_strength": 0.5, "flutter": 0.012, "brush_scale": 3.0},
	"leather": {"brush_amount": 0.12, "brush_scale": 2.5},
	"metal": {"brush_amount": 0.04, "spec_size": 0.3, "spec_strength": 1.3, "rim_strength": 0.5},
	"eye": {"brush_amount": 0.0, "rim_strength": 0.0, "band_wobble": 0.0, "light_wrap": 0.4},
	"mask": {"brush_amount": 0.07, "rim_strength": 0.4, "spec_size": 0.08, "spec_strength": 0.3},
	"straw": {"brush_amount": 0.14, "brush_scale": 4.0},
	"wood": {"brush_amount": 0.14, "brush_scale": 2.5},
	"leaf": {"brush_amount": 0.1, "flutter": 0.22, "flutter_speed": 0.7, "brush_scale": 1.5},
	"rock": {"brush_amount": 0.16, "brush_world": true, "brush_scale": 0.8},
	"coral": {"brush_amount": 0.13, "brush_world": true, "brush_scale": 0.7, "rim_strength": 0.45},
	"glow": {"brush_amount": 0.0, "emission_energy": 1.6, "emission_color": Color(0.6, 1.0, 0.95)},
	"base": {"brush_amount": 0.1},
}

static var _cache: Dictionary = {}


static func material_for(mat_name: String, source: Material = null) -> ShaderMaterial:
	var key := mat_name
	var tex: Texture2D = null
	if source is BaseMaterial3D and (source as BaseMaterial3D).albedo_texture:
		tex = (source as BaseMaterial3D).albedo_texture
		key += "|" + str(tex.get_rid().get_id())
	if _cache.has(key):
		return _cache[key]
	var m := ShaderMaterial.new()
	m.shader = TOON
	m.resource_name = mat_name
	var base := mat_name.get_slice(".", 0)
	var params: Dictionary = PARAMS.get(base, PARAMS["base"])
	for k: String in params:
		m.set_shader_parameter(k, params[k])
	if tex:
		m.set_shader_parameter("use_texture", true)
		m.set_shader_parameter("albedo_tex", tex)
		m.set_shader_parameter("alpha_cut", 0.5)
	_cache[key] = m
	return m


## Aplica o material toon a todas as malhas abaixo de `root`. Devolve as malhas.
static func toonify(root: Node) -> Array[MeshInstance3D]:
	var found: Array[MeshInstance3D] = []
	_collect(root, found)
	for mi in found:
		if mi.mesh == null:
			continue
		for i in mi.mesh.get_surface_count():
			var src := mi.mesh.surface_get_material(i)
			var mat_name := "base"
			if src and src.resource_name != "":
				mat_name = src.resource_name
			mi.set_surface_override_material(i, material_for(mat_name, src))
	return found


static func _collect(node: Node, out: Array[MeshInstance3D]) -> void:
	if node is MeshInstance3D:
		out.append(node)
	for c in node.get_children():
		_collect(c, out)


static func find_skeleton(root: Node) -> Skeleton3D:
	if root is Skeleton3D:
		return root
	for c in root.get_children():
		var s := find_skeleton(c)
		if s:
			return s
	return null


## Define um parâmetro de instância (clarão, molhado...) em todas as malhas.
static func set_instance_param(meshes: Array[MeshInstance3D], param: StringName, value: Variant) -> void:
	for mi in meshes:
		if is_instance_valid(mi):
			mi.set_instance_shader_parameter(param, value)
