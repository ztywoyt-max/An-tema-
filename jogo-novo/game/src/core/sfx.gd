extends Node
## Tocador de efeitos sonoros com reserva de vozes. Sons que não existem em
## assets/audio são ignorados em silêncio.

const DIR := "res://assets/audio/"
const VOICES_2D := 12
const VOICES_3D := 24

var _cache: Dictionary = {}
var _pool2d: Array[AudioStreamPlayer] = []
var _pool3d: Array[AudioStreamPlayer3D] = []
var _loops: Dictionary = {}
var _i2 := 0
var _i3 := 0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_ensure_bus("SFX")
	_ensure_bus("Musica")
	for i in VOICES_2D:
		var p := AudioStreamPlayer.new()
		p.bus = &"SFX"
		add_child(p)
		_pool2d.append(p)
	for i in VOICES_3D:
		var p3 := AudioStreamPlayer3D.new()
		p3.bus = &"SFX"
		p3.unit_size = 6.0
		p3.max_distance = 70.0
		p3.attenuation_filter_cutoff_hz = 20500.0
		p3.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
		add_child(p3)
		_pool3d.append(p3)


func _ensure_bus(bus_name: String) -> void:
	if AudioServer.get_bus_index(bus_name) < 0:
		AudioServer.add_bus()
		var idx := AudioServer.bus_count - 1
		AudioServer.set_bus_name(idx, bus_name)
		AudioServer.set_bus_send(idx, &"Master")


func stream(sound: String) -> AudioStream:
	if _cache.has(sound):
		return _cache[sound]
	var s: AudioStream = null
	for ext: String in [".ogg", ".wav"]:
		var path := DIR + sound + ext
		if ResourceLoader.exists(path):
			s = load(path)
			break
	_cache[sound] = s
	return s


func play(sound: String, volume_db := 0.0, pitch := 1.0, pitch_var := 0.06) -> void:
	var s := stream(sound)
	if s == null:
		return
	var p := _pool2d[_i2]
	_i2 = (_i2 + 1) % _pool2d.size()
	p.stream = s
	p.volume_db = volume_db
	p.pitch_scale = maxf(pitch + randf_range(-pitch_var, pitch_var), 0.05)
	p.play()


func play_at(sound: String, pos: Vector3, volume_db := 0.0, pitch := 1.0, pitch_var := 0.06) -> void:
	var s := stream(sound)
	if s == null:
		return
	var p := _pool3d[_i3]
	_i3 = (_i3 + 1) % _pool3d.size()
	p.stream = s
	p.global_position = pos
	p.volume_db = volume_db
	p.pitch_scale = maxf(pitch + randf_range(-pitch_var, pitch_var), 0.05)
	p.play()


## Som contínuo identificado por uma chave (vento, mar, planar...).
func loop(key: String, sound: String, volume_db := 0.0, bus: StringName = &"SFX") -> void:
	if _loops.has(key):
		return
	var s := stream(sound)
	if s == null:
		return
	if s is AudioStreamOggVorbis:
		(s as AudioStreamOggVorbis).loop = true
	elif s is AudioStreamWAV:
		(s as AudioStreamWAV).loop_mode = AudioStreamWAV.LOOP_FORWARD
	var p := AudioStreamPlayer.new()
	p.stream = s
	p.bus = bus
	p.volume_db = volume_db
	add_child(p)
	p.play()
	_loops[key] = p


func loop_volume(key: String, volume_db: float, pitch := 1.0) -> void:
	if _loops.has(key):
		var p: AudioStreamPlayer = _loops[key]
		p.volume_db = volume_db
		p.pitch_scale = pitch


func stop_loop(key: String) -> void:
	if _loops.has(key):
		var p: AudioStreamPlayer = _loops[key]
		p.queue_free()
		_loops.erase(key)
