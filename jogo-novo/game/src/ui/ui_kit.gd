extends RefCounted
## Peças comuns da interface: cores, rótulos em letra de pincel, manchas de aquarela, botões.

const BRUSH := preload("res://shaders/ui_brush.gdshader")
const PAINT := preload("res://shaders/ui_paint.gdshader")

const INK := Color("#17123a")
const PAPER := Color("#fdf8ea")
const TEAL := Color("#1fc9b5")
const TEAL_DARK := Color("#0c4f5c")
const CORAL := Color("#ee5a3c")
const MAGENTA := Color("#d6457a")
const GOLD := Color("#f3d36b")
const SKY := Color("#2d8fd8")
const RANK_COLORS := [Color("#bff5ee"), Color("#8ff2e6"), Color("#59e0ff"), Color("#f3d36b"), Color("#ff9a5a"), Color("#ff5f8f")]


static func font(kind: String) -> Font:
	match kind:
		"title":
			return Game.font_title
		"ui":
			return Game.font_ui
	return Game.font_hand


static func settings(size: int, color: Color = PAPER, kind: String = "hand", outline: int = -1) -> LabelSettings:
	var s := LabelSettings.new()
	s.font = font(kind)
	s.font_size = size
	s.font_color = color
	s.outline_size = outline if outline >= 0 else int(maxf(float(size) * 0.22, 4.0))
	s.outline_color = INK
	s.shadow_size = 0
	return s


static func label(text: String, size: int, color: Color = PAPER, kind: String = "hand", outline: int = -1) -> Label:
	var l := Label.new()
	l.text = text
	l.label_settings = settings(size, color, kind, outline)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


## Mancha de aquarela (fundo de painel).
static func paint(color: Color, seed_value: float = 0.0, roundness: float = 0.35, edge: float = 0.3) -> ColorRect:
	var r := ColorRect.new()
	var m := ShaderMaterial.new()
	m.shader = PAINT
	m.set_shader_parameter("color", color)
	m.set_shader_parameter("seed", seed_value)
	m.set_shader_parameter("roundness", roundness)
	m.set_shader_parameter("edge", edge)
	r.material = m
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	r.resized.connect(func() -> void: m.set_shader_parameter("aspect", r.size.x / maxf(r.size.y, 1.0)))
	return r


## Botão em letra de pincel, com mancha que aparece ao passar o mouse / focar.
static func button(text: String, size: int = 44, on_press: Callable = Callable()) -> Button:
	var b := Button.new()
	b.text = text
	b.flat = true
	b.focus_mode = Control.FOCUS_ALL
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.add_theme_font_override("font", font("hand"))
	b.add_theme_font_size_override("font_size", size)
	b.add_theme_color_override("font_color", PAPER)
	b.add_theme_color_override("font_hover_color", GOLD)
	b.add_theme_color_override("font_focus_color", GOLD)
	b.add_theme_color_override("font_pressed_color", TEAL)
	b.add_theme_color_override("font_outline_color", INK)
	b.add_theme_constant_override("outline_size", int(size * 0.22))
	var empty := StyleBoxEmpty.new()
	empty.content_margin_left = 26.0
	empty.content_margin_right = 26.0
	empty.content_margin_top = 4.0
	empty.content_margin_bottom = 4.0
	for st: String in ["normal", "hover", "pressed", "focus", "disabled"]:
		b.add_theme_stylebox_override(st, empty)
	var blot := paint(Color(TEAL.r, TEAL.g, TEAL.b, 0.0), randf() * 10.0, 0.15, 0.45)
	blot.show_behind_parent = true
	blot.set_anchors_preset(Control.PRESET_FULL_RECT)
	blot.offset_left = -10.0
	blot.offset_right = 10.0
	b.add_child(blot)
	var mat: ShaderMaterial = blot.material
	var show := func(on: bool) -> void:
		var tw := b.create_tween()
		tw.tween_method(func(a: float) -> void: mat.set_shader_parameter("color", Color(0.05, 0.42, 0.46, a)), 0.75 if not on else 0.0, 0.75 if on else 0.0, 0.12)
	b.mouse_entered.connect(func() -> void:
		b.grab_focus())
	b.focus_entered.connect(func() -> void:
		show.call(true)
		Sfx.play("ui_move", -14.0))
	b.focus_exited.connect(func() -> void: show.call(false))
	if on_press.is_valid():
		b.pressed.connect(func() -> void:
			Sfx.play("ui_ok", -8.0)
			on_press.call())
	return b


## Tema para controles comuns (deslizadores, caixas) no estilo do jogo.
static func theme() -> Theme:
	var t := Theme.new()
	t.default_font = font("ui")
	t.default_font_size = 26
	var groove := StyleBoxFlat.new()
	groove.bg_color = Color(INK.r, INK.g, INK.b, 0.7)
	groove.set_corner_radius_all(6)
	groove.content_margin_top = 5.0
	groove.content_margin_bottom = 5.0
	var fill := StyleBoxFlat.new()
	fill.bg_color = TEAL
	fill.set_corner_radius_all(6)
	t.set_stylebox("slider", "HSlider", groove)
	t.set_stylebox("grabber_area", "HSlider", fill)
	t.set_stylebox("grabber_area_highlight", "HSlider", fill)
	var box := StyleBoxFlat.new()
	box.bg_color = Color(INK.r, INK.g, INK.b, 0.75)
	box.border_color = Color(PAPER.r, PAPER.g, PAPER.b, 0.6)
	box.set_border_width_all(2)
	box.set_corner_radius_all(5)
	box.content_margin_left = 12.0
	box.content_margin_right = 12.0
	box.content_margin_top = 6.0
	box.content_margin_bottom = 6.0
	var box_h: StyleBoxFlat = box.duplicate()
	box_h.border_color = GOLD
	for cls: String in ["LineEdit", "OptionButton", "Button"]:
		t.set_stylebox("normal", cls, box)
		t.set_stylebox("hover", cls, box_h)
		t.set_stylebox("focus", cls, box_h)
		t.set_stylebox("pressed", cls, box_h)
		t.set_color("font_color", cls, PAPER)
	t.set_color("font_color", "CheckButton", PAPER)
	t.set_color("font_color", "Label", PAPER)
	return t
