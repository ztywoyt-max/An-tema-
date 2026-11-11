extends Node3D
## Bandeirola num mastro: gira para onde o vento sopra e tremula (mostra direção e força).

const Build := preload("res://src/world/build.gd")

var pole_height := 4.6
var cloth_color := Color("#de4f7f")
var _cloth: MeshInstance3D
var _pivot: Node3D


func _ready() -> void:
	var wood := Build.painted(Build.P_PLANKS, Color("#b98250"), Color("#9c693c"), {"tile": Vector2(2.0, 0.2)})
	Build.cylinder(self, Vector3(0, pole_height * 0.5, 0), 0.07, pole_height, wood, true, 0.05, 8)
	Build.cylinder(self, Vector3(0, pole_height + 0.06, 0), 0.11, 0.12, Build.painted(Build.P_PLAIN, Color("#e8bf5a"), Color("#c99a3c")), false, 0.02, 8)
	_pivot = Node3D.new()
	_pivot.position = Vector3(0, pole_height - 0.5, 0)
	_pivot.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	add_child(_pivot)
	# pano: faixa comprida que afina, presa no mastro (alfa 1) e solta na ponta (alfa 0)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var nx := 14
	var length := 2.2
	var rows := []
	for i in nx + 1:
		var u := float(i) / float(nx)
		var half := lerpf(0.42, 0.1, u)
		rows.append([Vector3(u * length, half, 0), Vector3(u * length, -half, 0), u])
	for i in nx:
		var a: Array = rows[i]
		var b: Array = rows[i + 1]
		var quad := [[a[0], a[2], 0.0], [b[0], b[2], 0.0], [b[1], b[2], 1.0], [a[0], a[2], 0.0], [b[1], b[2], 1.0], [a[1], a[2], 1.0]]
		for v: Array in quad:
			var u2: float = v[1]
			var band := 1.0 if (u2 > 0.55 and u2 < 0.68) else 0.0
			var c := cloth_color.lerp(Color("#f3e9cf"), band).lerp(cloth_color.darkened(0.25), u2 * 0.5)
			st.set_color(Color(c.r, c.g, c.b, 1.0 - smoothstep(0.0, 0.5, u2)))
			st.set_uv(Vector2(u2, v[2]))
			st.set_normal(Vector3(0, 0, 1))
			st.add_vertex(v[0])
	_cloth = MeshInstance3D.new()
	_cloth.mesh = st.commit()
	var mat := Build.toon({"flutter": 0.5, "flutter_speed": 1.6, "brush_amount": 0.1, "use_vertex_color": true})
	_cloth.material_override = mat
	_pivot.add_child(_cloth)


func _process(delta: float) -> void:
	var w: Vector3 = Wind.at(global_position + Vector3.UP * pole_height)
	var hw := Vector2(w.x, w.z)
	if hw.length() > 0.2:
		var want := atan2(-w.z, w.x)
		_pivot.rotation.y = lerp_angle(_pivot.rotation.y, want, 1.0 - exp(-2.5 * delta))
	# vento fraco: o pano pende
	var droop := clampf(1.0 - hw.length() / 4.0, 0.0, 1.0)
	_pivot.rotation.z = lerpf(_pivot.rotation.z, -droop * 1.1, 1.0 - exp(-2.0 * delta))
