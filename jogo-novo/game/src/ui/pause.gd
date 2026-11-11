extends Control
## Menu de pausa: continuar, ajustes, controles, voltar ao menu, sair.

const UiKit := preload("res://src/ui/ui_kit.gd")
const SettingsPanel := preload("res://src/ui/settings_panel.gd")
const ControlsPanel := preload("res://src/ui/controls_panel.gd")

var opened := false
var content: Control
var first_button: Button


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	visible = false
	process_mode = Node.PROCESS_MODE_ALWAYS
	var dim := ColorRect.new()
	dim.color = Color(0.03, 0.05, 0.14, 0.45)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(dim)
	var left := UiKit.paint(Color(0.05, 0.22, 0.32, 0.93), 2.2, 0.12, 0.2)
	left.anchor_top = 0.5
	left.anchor_bottom = 0.5
	left.offset_left = 70
	left.offset_right = 610
	left.offset_top = -380
	left.offset_bottom = 380
	add_child(left)
	var title := UiKit.label("Pausa", 110, UiKit.PAPER, "title", 20)
	title.anchor_top = 0.5
	title.anchor_bottom = 0.5
	title.offset_left = 130
	title.offset_top = -340
	title.offset_right = 600
	title.offset_bottom = -210
	add_child(title)
	var list := VBoxContainer.new()
	list.anchor_top = 0.5
	list.anchor_bottom = 0.5
	list.offset_left = 110
	list.offset_right = 580
	list.offset_top = -190
	list.offset_bottom = 330
	list.add_theme_constant_override("separation", 6)
	add_child(list)
	first_button = UiKit.button("Continuar", 52, close)
	list.add_child(first_button)
	list.add_child(UiKit.button("Ajustes", 52, func() -> void: _show(SettingsPanel.new())))
	list.add_child(UiKit.button("Controles e golpes", 52, func() -> void: _show(ControlsPanel.new())))
	list.add_child(UiKit.button("Voltar ao menu", 52, func() -> void:
		close()
		var main: Node = get_tree().root.get_node_or_null("Main")
		if main:
			main.quit_to_menu()))
	list.add_child(UiKit.button("Sair do jogo", 52, func() -> void: get_tree().quit()))
	var right := UiKit.paint(Color(0.04, 0.16, 0.28, 0.93), 5.1, 0.08, 0.14)
	right.anchor_left = 0.0
	right.anchor_right = 1.0
	right.anchor_top = 0.5
	right.anchor_bottom = 0.5
	right.offset_left = 660
	right.offset_right = -70
	right.offset_top = -420
	right.offset_bottom = 420
	add_child(right)
	content = Control.new()
	content.anchor_left = 0.0
	content.anchor_right = 1.0
	content.anchor_top = 0.5
	content.anchor_bottom = 0.5
	content.offset_left = 730
	content.offset_right = -140
	content.offset_top = -350
	content.offset_bottom = 350
	add_child(content)
	_show(ControlsPanel.new())


func _show(panel: Control) -> void:
	for c in content.get_children():
		c.queue_free()
	panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	content.add_child(panel)


func toggle() -> void:
	if opened:
		close()
	else:
		open()


func open() -> void:
	opened = true
	visible = true
	Game.set_paused(true)
	Game.input_enabled = false
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	first_button.grab_focus()
	Sfx.play("ui_ok", -10.0)


func close() -> void:
	opened = false
	visible = false
	Game.set_paused(false)
	Game.input_enabled = true
	if Game.in_game and DisplayServer.get_name() != "headless":
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
