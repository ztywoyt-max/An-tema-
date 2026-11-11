extends ColorRect
## Barra em pincelada (vida, stamina, fôlego). A parte perdida some com atraso.

const UiKit := preload("res://src/ui/ui_kit.gd")

var value := 1.0
var _ghost := 1.0
var _ghost_wait := 0.0
var _pulse := 0.0
var _mat: ShaderMaterial


func setup(bar_color: Color, seed_value: float) -> void:
	_mat = ShaderMaterial.new()
	_mat.shader = UiKit.BRUSH
	_mat.set_shader_parameter("color", bar_color)
	_mat.set_shader_parameter("seed", seed_value)
	material = _mat
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(func() -> void: _mat.set_shader_parameter("aspect", size.x / maxf(size.y, 1.0)))


func set_value(v: float) -> void:
	v = clampf(v, 0.0, 1.0)
	if v < value - 0.001:
		_ghost_wait = 0.45
	elif v > value + 0.03:
		_pulse = 0.6
	value = v


func pulse() -> void:
	_pulse = 1.0


func _process(delta: float) -> void:
	if _mat == null:
		return
	if _ghost_wait > 0.0:
		_ghost_wait -= delta
	else:
		_ghost = move_toward(_ghost, value, delta * 0.7)
	if _ghost < value:
		_ghost = value
	_pulse = maxf(_pulse - delta * 3.0, 0.0)
	# a escala visual: a pincelada vai de 3% a 95% da largura
	_mat.set_shader_parameter("fill", lerpf(0.02, 0.97, value) if value > 0.001 else 0.0)
	_mat.set_shader_parameter("ghost", lerpf(0.02, 0.97, _ghost) if _ghost > 0.001 else 0.0)
	_mat.set_shader_parameter("pulse", _pulse)
