extends ScrollContainer
## Lista de ajustes (vídeo, controles, áudio) no estilo do jogo.

const UiKit := preload("res://src/ui/ui_kit.gd")

var box: VBoxContainer
var show_name := false


func _ready() -> void:
	horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	theme = UiKit.theme()
	box = VBoxContainer.new()
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	box.add_theme_constant_override("separation", 8)
	add_child(box)
	if show_name:
		_header("Jogador")
		_text("Nome", "player_name")
	_header("Controles")
	_slider("Sensibilidade do mouse", "mouse_sens", 0.2, 3.0, 0.05)
	_slider("Sensibilidade do controle", "pad_sens", 0.2, 3.0, 0.05)
	_check("Inverter eixo vertical", "invert_y")
	_slider("Tremor de câmera", "shake", 0.0, 1.5, 0.05)
	_header("Vídeo")
	_check("Tela cheia  (F11)", "fullscreen")
	_check("Sincronia vertical", "vsync")
	_option("Limite de FPS", "max_fps", ["Sem limite", "60", "120", "144", "240"], [0, 60, 120, 144, 240])
	_slider("Campo de visão — 3ª pessoa", "fov_third", 55.0, 100.0, 1.0)
	_slider("Campo de visão — 1ª pessoa", "fov_first", 70.0, 115.0, 1.0)
	_slider("Escala de resolução", "render_scale", 0.5, 1.0, 0.05)
	_option("Suavização de serrilhado", "msaa", ["Desligada", "2x", "4x", "8x"], [0, 1, 2, 3])
	_option("Efeito pintura", "paint", ["Desligado", "Suave", "Forte"], [0, 1, 2])
	_check("Contorno a traço", "outline")
	_check("Mostrar FPS", "show_fps")
	_header("Áudio")
	_slider("Volume geral", "vol_master", 0.0, 1.0, 0.05)
	_slider("Efeitos", "vol_sfx", 0.0, 1.0, 0.05)
	_slider("Música", "vol_music", 0.0, 1.0, 0.05)


func _header(text: String) -> void:
	var l := UiKit.label(text, 44, UiKit.GOLD, "title", 10)
	box.add_child(l)


func _row(text: String) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 16)
	var l := UiKit.label(text, 30, UiKit.PAPER, "hand", 6)
	l.custom_minimum_size = Vector2(430, 40)
	h.add_child(l)
	box.add_child(h)
	return h


func _slider(text: String, key: String, lo: float, hi: float, step: float) -> void:
	var h := _row(text)
	var s := HSlider.new()
	s.min_value = lo
	s.max_value = hi
	s.step = step
	s.value = float(Settings.get_v(key))
	s.custom_minimum_size = Vector2(300, 36)
	s.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	var val := UiKit.label(_fmt(s.value, step), 28, UiKit.TEAL, "hand", 6)
	val.custom_minimum_size = Vector2(70, 36)
	s.value_changed.connect(func(v: float) -> void:
		Settings.set_v(key, v)
		val.text = _fmt(v, step))
	h.add_child(s)
	h.add_child(val)


func _fmt(v: float, step: float) -> String:
	return str(int(v)) if step >= 1.0 else ("%.2f" % v)


func _check(text: String, key: String) -> void:
	var h := _row(text)
	var c := CheckButton.new()
	c.button_pressed = bool(Settings.get_v(key))
	c.toggled.connect(func(on: bool) -> void:
		Settings.set_v(key, on)
		Sfx.play("ui_ok", -12.0))
	h.add_child(c)


func _option(text: String, key: String, names: Array, values: Array) -> void:
	var h := _row(text)
	var o := OptionButton.new()
	o.custom_minimum_size = Vector2(230, 40)
	for i in names.size():
		o.add_item(names[i], i)
	var cur := values.find(int(Settings.get_v(key)))
	o.selected = maxi(cur, 0)
	o.item_selected.connect(func(i: int) -> void:
		Settings.set_v(key, values[i])
		Sfx.play("ui_ok", -12.0))
	h.add_child(o)


func _text(text: String, key: String) -> void:
	var h := _row(text)
	var e := LineEdit.new()
	e.text = str(Settings.get_v(key))
	e.max_length = 16
	e.custom_minimum_size = Vector2(300, 44)
	e.text_changed.connect(func(t: String) -> void: Settings.set_v(key, t.strip_edges() if t.strip_edges() != "" else "Condenado"))
	h.add_child(e)
