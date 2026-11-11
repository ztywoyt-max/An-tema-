extends Node
## Campo de vento: um vento global (direção + força + rajadas) mais zonas locais
## (correntes ascendentes, corredores). A vegetação, os panos, as partículas e a
## jogabilidade leem daqui.

signal changed

enum Mode { CALM, BREEZE, GALE }
const MODE_NAMES := ["Calmaria", "Brisa", "Ventania"]
const MODE_STRENGTH := [0.5, 3.0, 7.5]

var mode: int = Mode.BREEZE
var angle := 0.4              ## direção para onde o vento sopra (rad em torno de Y)
var strength := 3.0           ## força suavizada (m/s)
var gust := 0.0               ## 0..1
var zones: Array = []
var time := 0.0


func direction() -> Vector3:
	return Vector3(cos(angle), 0.0, sin(angle))


func base_vector() -> Vector3:
	return direction() * strength * (0.75 + gust * 0.5)


## Vento num ponto do mundo (m/s).
func at(pos: Vector3) -> Vector3:
	var v := base_vector()
	for z: Node in zones:
		if is_instance_valid(z):
			v += z.wind_at(pos)
	return v


## Só a parte das zonas (para saber se o jogador está numa corrente).
func zone_at(pos: Vector3) -> Vector3:
	var v := Vector3.ZERO
	for z: Node in zones:
		if is_instance_valid(z):
			v += z.wind_at(pos)
	return v


func set_mode(m: int) -> void:
	mode = clampi(m, 0, MODE_STRENGTH.size() - 1)
	changed.emit()


func cycle_mode() -> void:
	set_mode((mode + 1) % MODE_STRENGTH.size())


func rotate_direction(rad: float) -> void:
	angle = wrapf(angle + rad, -PI, PI)
	changed.emit()


func set_state(new_mode: int, new_angle: float) -> void:
	mode = new_mode
	angle = new_angle
	changed.emit()


func _process(delta: float) -> void:
	time += delta
	strength = lerpf(strength, MODE_STRENGTH[mode], 1.0 - exp(-delta * 0.8))
	var g := sin(time * 0.37) * sin(time * 0.13 + 1.3) + 0.35 * sin(time * 1.1)
	gust = clampf(0.5 + 0.5 * g, 0.0, 1.0)
	var d := direction()
	RenderingServer.global_shader_parameter_set(&"wind_vec", Vector3(d.x * strength, gust, d.z * strength))
