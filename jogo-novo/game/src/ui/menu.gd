extends CanvasLayer
## Tela inicial: título, jogar sozinho, co-op (criar/entrar), ajustes, controles, sair.

const UiKit := preload("res://src/ui/ui_kit.gd")
const SettingsPanel := preload("res://src/ui/settings_panel.gd")
const ControlsPanel := preload("res://src/ui/controls_panel.gd")

var main: Node
var cam: Camera3D
var content: Control
var right: ColorRect
var first: Button
var _t := 0.0


func _ready() -> void:
	layer = 10
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	cam = Camera3D.new()
	cam.fov = 55.0
	cam.far = 6000.0
	cam.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	add_child(cam)
	cam.make_current()
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(root)
	var left := UiKit.paint(Color(0.04, 0.2, 0.33, 0.88), 0.9, 0.1, 0.22)
	left.anchor_bottom = 1.0
	left.offset_left = 50
	left.offset_right = 690
	left.offset_top = 40
	left.offset_bottom = -40
	root.add_child(left)
	var title := UiKit.label("Vessa", 230, UiKit.PAPER, "title", 34)
	title.position = Vector2(100, 60)
	title.size = Vector2(620, 270)
	root.add_child(title)
	var sub := UiKit.label("sala de teste  ·  água e vento", 40, UiKit.TEAL)
	sub.position = Vector2(118, 318)
	sub.size = Vector2(600, 50)
	root.add_child(sub)
	var list := VBoxContainer.new()
	list.position = Vector2(100, 410)
	list.size = Vector2(560, 560)
	list.add_theme_constant_override("separation", 2)
	root.add_child(list)
	first = UiKit.button("Jogar", 60, func() -> void: main.start_game("solo"))
	list.add_child(first)
	if Net.READY:
		list.add_child(UiKit.button("Co-op: criar sala", 50, func() -> void: _show_host()))
		list.add_child(UiKit.button("Co-op: entrar na sala", 50, func() -> void: _show_join()))
	else:
		var soon := UiKit.label("      Co-op (em construção)", 44, Color(1, 1, 1, 0.45))
		list.add_child(soon)
	list.add_child(UiKit.button("Ajustes", 50, func() -> void:
		var sp := SettingsPanel.new()
		sp.show_name = true
		_show(sp)))
	list.add_child(UiKit.button("Controles e golpes", 50, func() -> void: _show(ControlsPanel.new())))
	list.add_child(UiKit.button("Sair", 50, func() -> void: get_tree().quit()))
	var ver := UiKit.label("versão %s  —  feito com Godot" % ProjectSettings.get_setting("application/config/version"), 24, Color(1, 1, 1, 0.7))
	ver.anchor_top = 1.0
	ver.anchor_bottom = 1.0
	ver.offset_left = 110
	ver.offset_top = -86
	ver.offset_right = 700
	ver.offset_bottom = -56
	root.add_child(ver)
	right = UiKit.paint(Color(0.04, 0.16, 0.28, 0.9), 5.1, 0.08, 0.14)
	right.anchor_right = 1.0
	right.anchor_bottom = 1.0
	right.offset_left = 740
	right.offset_right = -50
	right.offset_top = 60
	right.offset_bottom = -60
	right.visible = false
	root.add_child(right)
	content = Control.new()
	content.anchor_right = 1.0
	content.anchor_bottom = 1.0
	content.offset_left = 810
	content.offset_right = -120
	content.offset_top = 120
	content.offset_bottom = -120
	root.add_child(content)
	first.grab_focus.call_deferred()


func _show(panel: Control) -> void:
	for c in content.get_children():
		c.queue_free()
	right.visible = true
	panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	content.add_child(panel)


func _show_host() -> void:
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 14)
	box.add_child(UiKit.label("Criar sala de co-op", 64, UiKit.GOLD, "title", 12))
	box.add_child(_wrap("Você será o anfitrião. Até 4 jogadores. Seus amigos entram digitando o seu endereço (IP) em \"Entrar na sala\"."))
	box.add_child(_wrap("Na mesma rede (casa/LAN): use o endereço local mostrado abaixo. Pela internet: é preciso liberar a porta %d (UDP) no roteador; o jogo tenta fazer isso sozinho (UPnP) ao criar a sala." % Net.PORT))
	var ips := Net.local_addresses()
	box.add_child(UiKit.label("Endereço local: " + (", ".join(ips) if not ips.is_empty() else "não encontrado"), 36, UiKit.TEAL))
	box.add_child(UiKit.button("Criar sala e jogar", 54, func() -> void: main.start_game("host")))
	_show(box)


func _show_join() -> void:
	var box := VBoxContainer.new()
	box.theme = UiKit.theme()
	box.add_theme_constant_override("separation", 14)
	box.add_child(UiKit.label("Entrar na sala", 64, UiKit.GOLD, "title", 12))
	box.add_child(_wrap("Digite o endereço (IP) do anfitrião. Para testar no mesmo computador, use 127.0.0.1."))
	var e := LineEdit.new()
	e.text = str(Settings.get_v("last_ip"))
	e.placeholder_text = "endereço do anfitrião"
	e.custom_minimum_size = Vector2(420, 56)
	e.add_theme_font_size_override("font_size", 34)
	box.add_child(e)
	var go := func() -> void:
		var addr := e.text.strip_edges()
		if addr == "":
			return
		Settings.set_v("last_ip", addr)
		main.start_game("join", addr)
	e.text_submitted.connect(func(_t2: String) -> void: go.call())
	box.add_child(UiKit.button("Entrar", 54, go))
	_show(box)


func _wrap(text: String) -> Label:
	var l := UiKit.label(text, 32, UiKit.PAPER, "hand", 6)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(700, 0)
	return l


func _process(delta: float) -> void:
	_t += delta
	var a := _t * 0.05 + 0.6
	var center := Vector3(0, 2.0, -2.0)
	cam.global_position = center + Vector3(cos(a) * 62.0, 15.0 + 2.0 * sin(_t * 0.2), sin(a) * 62.0)
	cam.look_at(center)
	cam.make_current()
