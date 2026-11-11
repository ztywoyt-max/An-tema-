extends Node
## Efeitos visuais: rajadas de partículas, anéis, números de dano e tremor de câmera.
## Tudo vem de reservas (pools), então chamar muitas vezes é barato.

const PARTICLE := preload("res://shaders/particle.gdshader")
const RING := preload("res://shaders/ring.gdshader")

## tipo -> configuração do emissor
const KINDS := {
	"hit": {"amount": 10, "life": 0.28, "speed": [5.0, 11.0], "spread": 55.0, "gravity": -6.0, "size": [0.1, 0.24], "shape": 1, "add": true, "glow": 2.2, "damp": 8.0},
	"hit_heavy": {"amount": 18, "life": 0.38, "speed": [7.0, 15.0], "spread": 70.0, "gravity": -7.0, "size": [0.14, 0.34], "shape": 1, "add": true, "glow": 2.6, "damp": 8.0},
	"spark": {"amount": 12, "life": 0.3, "speed": [6.0, 13.0], "spread": 60.0, "gravity": -14.0, "size": [0.05, 0.11], "shape": 0, "add": true, "glow": 3.0, "damp": 3.0},
	"parry": {"amount": 22, "life": 0.4, "speed": [8.0, 18.0], "spread": 85.0, "gravity": -10.0, "size": [0.08, 0.22], "shape": 1, "add": true, "glow": 3.4, "damp": 6.0},
	"dust": {"amount": 7, "life": 0.55, "speed": [0.8, 2.4], "spread": 80.0, "gravity": 1.2, "size": [0.25, 0.5], "shape": 4, "add": false, "glow": 1.0, "damp": 3.0, "grow": 1.6},
	"shock": {"amount": 20, "life": 0.6, "speed": [3.0, 7.5], "spread": 88.0, "gravity": 1.0, "size": [0.35, 0.7], "shape": 4, "add": false, "glow": 1.0, "damp": 5.0, "grow": 1.8, "flat": true},
	"splash": {"amount": 22, "life": 0.7, "speed": [3.0, 7.5], "spread": 35.0, "gravity": -16.0, "size": [0.1, 0.24], "shape": 3, "add": false, "glow": 1.15, "damp": 0.5},
	"splash_small": {"amount": 7, "life": 0.45, "speed": [1.5, 3.6], "spread": 40.0, "gravity": -14.0, "size": [0.06, 0.14], "shape": 3, "add": false, "glow": 1.15, "damp": 0.5},
	"bubbles": {"amount": 6, "life": 1.3, "speed": [0.3, 0.9], "spread": 40.0, "gravity": 2.4, "size": [0.04, 0.1], "shape": 5, "add": false, "glow": 1.2, "damp": 1.0},
	"dash": {"amount": 14, "life": 0.3, "speed": [2.0, 7.0], "spread": 18.0, "gravity": 0.0, "size": [0.05, 0.6], "shape": 2, "add": true, "glow": 1.6, "damp": 4.0, "align": true},
	"burst": {"amount": 26, "life": 0.45, "speed": [4.0, 14.0], "spread": 30.0, "gravity": 0.0, "size": [0.06, 0.9], "shape": 2, "add": true, "glow": 1.8, "damp": 4.0, "align": true},
	"streak": {"amount": 5, "life": 0.25, "speed": [3.0, 8.0], "spread": 8.0, "gravity": 0.0, "size": [0.05, 0.8], "shape": 2, "add": true, "glow": 1.6, "damp": 2.0, "align": true},
	"wind_puff": {"amount": 9, "life": 0.5, "speed": [1.5, 4.0], "spread": 75.0, "gravity": 0.6, "size": [0.3, 0.6], "shape": 4, "add": false, "glow": 1.1, "damp": 4.0, "grow": 1.5},
	"gather": {"amount": 6, "life": 0.35, "speed": [-5.0, -2.5], "spread": 180.0, "gravity": 0.0, "size": [0.05, 0.13], "shape": 0, "add": true, "glow": 2.4, "damp": 0.0, "radius": 1.3},
	"heal": {"amount": 14, "life": 0.9, "speed": [0.6, 1.8], "spread": 30.0, "gravity": 1.5, "size": [0.06, 0.15], "shape": 1, "add": true, "glow": 2.2, "damp": 1.0, "radius": 0.5},
	"essence": {"amount": 12, "life": 0.8, "speed": [1.0, 3.0], "spread": 180.0, "gravity": 1.0, "size": [0.05, 0.14], "shape": 0, "add": true, "glow": 2.6, "damp": 2.0},
	"fire": {"amount": 5, "life": 0.6, "speed": [0.8, 2.0], "spread": 16.0, "gravity": 2.5, "size": [0.18, 0.4], "shape": 4, "add": true, "glow": 2.0, "damp": 1.0, "radius": 0.25},
	"leaf": {"amount": 4, "life": 2.2, "speed": [1.0, 3.0], "spread": 30.0, "gravity": -0.6, "size": [0.08, 0.16], "shape": 6, "add": false, "glow": 1.0, "damp": 0.3, "spin": true},
}
const POOL := 5
const NUMBERS := 28
const RINGS := 16

var _pools: Dictionary = {}
var _next: Dictionary = {}
var _mats: Dictionary = {}
var _add_shader: Shader
var _numbers: Array[Label3D] = []
var _num_i := 0
var _rings: Array[MeshInstance3D] = []
var _ring_i := 0
var _quad: QuadMesh
var _cross: ArrayMesh
var font: Font


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_PAUSABLE
	if DisplayServer.get_name() == "headless":
		return
	_add_shader = Shader.new()
	_add_shader.code = PARTICLE.code.replace("render_mode unshaded,", "render_mode blend_add, unshaded,")
	_quad = QuadMesh.new()
	_quad.size = Vector2(1, 1)
	_cross = _make_cross()
	for i in RINGS:
		var r := MeshInstance3D.new()
		var q := QuadMesh.new()
		q.size = Vector2(2, 2)
		r.mesh = q
		var m := ShaderMaterial.new()
		m.shader = RING
		r.material_override = m
		r.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		r.visible = false
		r.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
		add_child(r)
		_rings.append(r)
	for i in NUMBERS:
		var l := Label3D.new()
		l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		l.no_depth_test = true
		l.fixed_size = true
		l.pixel_size = 0.0011
		l.font_size = 64
		l.outline_size = 18
		l.outline_modulate = Color(0.1, 0.07, 0.22)
		l.render_priority = 5
		l.outline_render_priority = 4
		l.visible = false
		l.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
		add_child(l)
		_numbers.append(l)


func set_font(f: Font) -> void:
	font = f
	for l in _numbers:
		l.font = f


## Duas lâminas cruzadas (para riscos alinhados à velocidade).
func _make_cross() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for axis: Vector3 in [Vector3.RIGHT, Vector3.BACK]:
		var a := -axis * 0.5 + Vector3.DOWN * 0.5
		var b := axis * 0.5 + Vector3.DOWN * 0.5
		var c := axis * 0.5 + Vector3.UP * 0.5
		var d := -axis * 0.5 + Vector3.UP * 0.5
		var uv := [Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0)]
		var v := [a, b, c, d]
		for i: int in [0, 1, 2, 0, 2, 3]:
			st.set_uv(uv[i])
			st.add_vertex(v[i])
	return st.commit()


func _material(kind: String) -> ShaderMaterial:
	if _mats.has(kind):
		return _mats[kind]
	var cfg: Dictionary = KINDS[kind]
	var m := ShaderMaterial.new()
	m.shader = _add_shader if cfg.get("add", false) else PARTICLE
	m.set_shader_parameter("shape", int(cfg["shape"]))
	m.set_shader_parameter("glow", float(cfg["glow"]))
	m.set_shader_parameter("hardness", 0.85 if int(cfg["shape"]) != 0 else 0.35)
	m.set_shader_parameter("billboard", not cfg.get("align", false))
	_mats[kind] = m
	return m


func _emitter(kind: String) -> CPUParticles3D:
	var cfg: Dictionary = KINDS[kind]
	var e := CPUParticles3D.new()
	e.emitting = false
	e.one_shot = true
	e.explosiveness = 0.92
	e.amount = int(cfg["amount"])
	e.lifetime = float(cfg["life"])
	e.local_coords = false
	e.mesh = _cross if cfg.get("align", false) else _quad
	e.material_override = _material(kind)
	e.spread = float(cfg["spread"])
	var sp: Array = cfg["speed"]
	e.initial_velocity_min = float(sp[0])
	e.initial_velocity_max = float(sp[1])
	e.gravity = Vector3(0, float(cfg["gravity"]), 0)
	e.damping_min = float(cfg.get("damp", 0.0))
	e.damping_max = float(cfg.get("damp", 0.0)) * 1.4
	var sz: Array = cfg["size"]
	e.scale_amount_min = float(sz[0])
	e.scale_amount_max = float(sz[1])
	var curve := Curve.new()
	if cfg.has("grow"):
		curve.add_point(Vector2(0.0, 0.5))
		curve.add_point(Vector2(0.35, 1.0))
		curve.add_point(Vector2(1.0, float(cfg["grow"])))
	else:
		curve.add_point(Vector2(0.0, 1.0))
		curve.add_point(Vector2(0.6, 0.8))
		curve.add_point(Vector2(1.0, 0.0))
	e.scale_amount_curve = curve
	var grad := Gradient.new()
	grad.set_color(0, Color(1, 1, 1, 1))
	grad.set_color(1, Color(1, 1, 1, 0.0 if cfg.has("grow") else 0.85))
	e.color_ramp = grad
	e.anim_offset_min = 0.0
	e.anim_offset_max = 1.0
	e.angle_min = 0.0
	e.angle_max = 360.0 if not cfg.get("align", false) else 0.0
	if cfg.get("spin", false):
		e.angular_velocity_min = -220.0
		e.angular_velocity_max = 220.0
	if cfg.get("align", false):
		e.particle_flag_align_y = true
		e.split_scale = true
		var cx := Curve.new()
		cx.add_point(Vector2(0, 0.12))
		cx.add_point(Vector2(1, 0.02))
		e.scale_curve_x = cx
		e.scale_curve_z = cx
		var cy := Curve.new()
		cy.add_point(Vector2(0, 1.0))
		cy.add_point(Vector2(1, 0.3))
		e.scale_curve_y = cy
	if cfg.has("radius"):
		e.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
		e.emission_sphere_radius = float(cfg["radius"])
	if cfg.get("flat", false):
		e.flatness = 0.85
	e.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	e.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	add_child(e)
	return e


## Solta uma rajada de partículas de um tipo.
func burst(kind: String, pos: Vector3, dir: Vector3 = Vector3.UP, color: Color = Color.WHITE, scale: float = 1.0) -> void:
	if _quad == null or not KINDS.has(kind):
		return
	if not _pools.has(kind):
		var arr: Array = []
		for i in POOL:
			arr.append(_emitter(kind))
		_pools[kind] = arr
		_next[kind] = 0
	var idx: int = _next[kind]
	_next[kind] = (idx + 1) % POOL
	var e: CPUParticles3D = _pools[kind][idx]
	var cfg: Dictionary = KINDS[kind]
	e.global_position = pos
	var d := dir.normalized() if dir.length_squared() > 0.0001 else Vector3.UP
	e.direction = d
	e.color = color
	var sz: Array = cfg["size"]
	e.scale_amount_min = float(sz[0]) * scale
	e.scale_amount_max = float(sz[1]) * scale
	e.restart()
	e.emitting = true


## Anel que se expande a partir de um ponto, deitado no plano perpendicular a `normal`.
func ring(pos: Vector3, normal: Vector3 = Vector3.UP, color: Color = Color.WHITE, radius: float = 2.0, time: float = 0.4) -> void:
	if _rings.is_empty():
		return
	var r := _rings[_ring_i]
	_ring_i = (_ring_i + 1) % _rings.size()
	var n := normal.normalized() if normal.length_squared() > 0.0001 else Vector3.UP
	var up := Vector3.UP if absf(n.dot(Vector3.UP)) < 0.95 else Vector3.RIGHT
	var x := up.cross(n).normalized()
	var y := n.cross(x)
	r.global_transform = Transform3D(Basis(x, y, n), pos)
	r.visible = true
	var m: ShaderMaterial = r.material_override
	m.set_shader_parameter("color", color)
	m.set_shader_parameter("mode", 0)
	var tw := create_tween()
	tw.set_parallel(true)
	r.scale = Vector3.ONE * radius * 0.2
	tw.tween_property(r, "scale", Vector3.ONE * radius, time).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	tw.tween_method(func(v: float) -> void: m.set_shader_parameter("progress", v), 0.0, 1.0, time)
	tw.chain().tween_callback(func() -> void: r.visible = false)


## Número de dano flutuante.
func number(pos: Vector3, value: float, kind: String = "hit") -> void:
	if _numbers.is_empty():
		return
	var l := _numbers[_num_i]
	_num_i = (_num_i + 1) % _numbers.size()
	l.text = str(int(round(value)))
	var col := Color(1.0, 0.98, 0.9)
	var size := 64
	match kind:
		"crit":
			col = Color(1.0, 0.85, 0.3)
			size = 96
		"block":
			col = Color(0.75, 0.8, 0.95)
			size = 48
		"hurt":
			col = Color(1.0, 0.45, 0.45)
		"heal":
			col = Color(0.5, 1.0, 0.7)
			l.text = "+" + l.text
	if value >= 28.0 and kind == "hit":
		size = 84
		col = Color(1.0, 0.93, 0.6)
	l.modulate = col
	l.outline_modulate = Color(0.1, 0.07, 0.22)
	l.font_size = size
	l.global_position = pos + Vector3(randf_range(-0.3, 0.3), randf_range(0.0, 0.2), randf_range(-0.3, 0.3))
	l.visible = true
	l.scale = Vector3.ONE * 0.4
	var tw := create_tween()
	tw.tween_property(l, "scale", Vector3.ONE * 1.25, 0.08).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "scale", Vector3.ONE, 0.1)
	tw.parallel().tween_property(l, "global_position", l.global_position + Vector3(0, 0.9, 0), 0.75).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	tw.tween_property(l, "modulate:a", 0.0, 0.22)
	tw.parallel().tween_property(l, "outline_modulate:a", 0.0, 0.22)
	tw.tween_callback(func() -> void: l.visible = false)


func shake(amount: float) -> void:
	if Game.cam_rig and is_instance_valid(Game.cam_rig):
		Game.cam_rig.shake(amount)
