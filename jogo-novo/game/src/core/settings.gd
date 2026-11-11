extends Node
## Ajustes do jogador, salvos em user://ajustes.cfg.

signal changed

const PATH := "user://ajustes.cfg"

const DEFAULTS := {
	"mouse_sens": 1.0,
	"pad_sens": 1.0,
	"invert_y": false,
	"fov_third": 70.0,
	"fov_first": 90.0,
	"first_person": false,
	"fullscreen": true,
	"vsync": true,
	"max_fps": 0,
	"render_scale": 1.0,
	"msaa": 2,
	"paint": 2,          # 0 desligado, 1 suave, 2 forte
	"outline": true,
	"shadows": 2,        # 0 baixa, 1 média, 2 alta
	"shake": 1.0,
	"vol_master": 0.9,
	"vol_sfx": 1.0,
	"vol_music": 0.7,
	"show_fps": false,
	"player_name": "Condenado",
	"last_ip": "127.0.0.1",
}

var data: Dictionary = DEFAULTS.duplicate()


func _ready() -> void:
	load_file()


func get_v(key: String) -> Variant:
	return data.get(key, DEFAULTS.get(key))


func set_v(key: String, value: Variant, save := true) -> void:
	data[key] = value
	if save:
		save_file()
	apply()
	changed.emit()


func load_file() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(PATH) == OK:
		for key: String in DEFAULTS:
			if cfg.has_section_key("ajustes", key):
				var v: Variant = cfg.get_value("ajustes", key)
				if typeof(v) == typeof(DEFAULTS[key]) or (v is float and DEFAULTS[key] is int) or (v is int and DEFAULTS[key] is float):
					data[key] = v


func save_file() -> void:
	var cfg := ConfigFile.new()
	for key: String in data:
		cfg.set_value("ajustes", key, data[key])
	cfg.save(PATH)


## Aplica os ajustes de vídeo e áudio.
func apply() -> void:
	if DisplayServer.get_name() == "headless":
		return
	var want_full: bool = data["fullscreen"]
	var mode := DisplayServer.window_get_mode()
	var is_full := mode == DisplayServer.WINDOW_MODE_FULLSCREEN or mode == DisplayServer.WINDOW_MODE_EXCLUSIVE_FULLSCREEN
	if want_full != is_full and not Game.capture_mode:
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN if want_full else DisplayServer.WINDOW_MODE_MAXIMIZED)
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_ENABLED if data["vsync"] else DisplayServer.VSYNC_DISABLED)
	Engine.max_fps = int(data["max_fps"])
	var vp := get_viewport()
	if vp:
		vp.scaling_3d_scale = clampf(float(data["render_scale"]), 0.5, 1.0)
		vp.msaa_3d = [Viewport.MSAA_DISABLED, Viewport.MSAA_2X, Viewport.MSAA_4X, Viewport.MSAA_8X][clampi(int(data["msaa"]), 0, 3)]
	_set_bus("Master", float(data["vol_master"]))
	_set_bus("SFX", float(data["vol_sfx"]))
	_set_bus("Musica", float(data["vol_music"]))


func _set_bus(bus: String, linear: float) -> void:
	var idx := AudioServer.get_bus_index(bus)
	if idx >= 0:
		AudioServer.set_bus_volume_db(idx, linear_to_db(maxf(linear, 0.0001)))
		AudioServer.set_bus_mute(idx, linear <= 0.001)
