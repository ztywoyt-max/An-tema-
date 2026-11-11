extends Node
## Maré e superfície do mar. O nível sobe e desce em ciclos; as ondas usam as
## MESMAS constantes de shaders/inc/waves.gdshaderinc.

signal mode_changed

enum Mode { AUTO, HIGH, LOW }
const MODE_NAMES := ["Automática", "Maré alta", "Maré baixa"]

const LOW := -2.35
const HIGH := -0.3
const PERIOD := 150.0

const WAVE_DIR := [Vector2(0.970, 0.243), Vector2(-0.447, 0.894), Vector2(0.707, -0.707), Vector2(-0.949, -0.316)]
const WAVE_LEN := [23.0, 13.0, 7.5, 4.1]
const WAVE_AMP := [0.085, 0.05, 0.028, 0.014]

var mode: int = Mode.AUTO
var phase := 0.18             ## 0..1 no ciclo automático
var level := -1.6             ## altura atual da superfície (sem ondas)
var time := 0.0               ## relógio das ondas (sincronizado no co-op)
var wave_amp := 1.0
var _prev_level := -1.6
var _rate := 0.0


func _ready() -> void:
	level = target_level()
	_prev_level = level
	_push()


func target_level() -> float:
	match mode:
		Mode.HIGH:
			return HIGH
		Mode.LOW:
			return LOW
	return lerpf(LOW, HIGH, 0.5 - 0.5 * cos(phase * TAU))


func _process(delta: float) -> void:
	time += delta
	if mode == Mode.AUTO:
		phase = fposmod(phase + delta / PERIOD, 1.0)
	_prev_level = level
	level = move_toward(level, target_level(), delta * 0.22)
	if delta > 0.0:
		_rate = lerpf(_rate, (level - _prev_level) / delta, 0.1)
	wave_amp = lerpf(0.7, 1.9, clampf(Wind.strength / 7.5, 0.0, 1.0))
	_push()


func _push() -> void:
	RenderingServer.global_shader_parameter_set(&"sea_level", level)
	RenderingServer.global_shader_parameter_set(&"sea_time", time)
	RenderingServer.global_shader_parameter_set(&"wave_amp", wave_amp)


func wave(p: Vector2, t: float) -> float:
	var h := 0.0
	for i in 4:
		var k: float = TAU / WAVE_LEN[i]
		var w := sqrt(9.8 * k) * 0.8
		h += WAVE_AMP[i] * sin(k * WAVE_DIR[i].dot(p) + w * t + float(i) * 1.7)
	return h * wave_amp


## Altura da superfície da água (com ondas) na vertical de um ponto.
func height_at(pos: Vector3) -> float:
	return level + wave(Vector2(pos.x, pos.z), time)


## Quanto um ponto está abaixo da superfície (positivo = submerso).
func depth_at(pos: Vector3) -> float:
	return height_at(pos) - pos.y


func is_rising() -> bool:
	return _rate > 0.002


func is_falling() -> bool:
	return _rate < -0.002


func set_mode(m: int) -> void:
	mode = clampi(m, 0, 2)
	mode_changed.emit()


func cycle_mode() -> void:
	set_mode((mode + 1) % 3)


## 0 = maré baixa, 1 = maré alta.
func fraction() -> float:
	return clampf(inverse_lerp(LOW, HIGH, level), 0.0, 1.0)


func set_state(new_mode: int, new_phase: float, new_level: float, new_time: float) -> void:
	mode = new_mode
	phase = new_phase
	level = new_level
	time = new_time
