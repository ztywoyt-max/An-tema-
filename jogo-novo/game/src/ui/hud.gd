extends CanvasLayer
## HUD em pincelada: barras, bússola, hotbar, contador de combo, avisos escritos à mão,
## marcas sobre os inimigos, efeitos de tela e menu de pausa.

const UiKit := preload("res://src/ui/ui_kit.gd")
const BrushBar := preload("res://src/ui/brush_bar.gd")
const Icon := preload("res://src/ui/icon.gd")
const Compass := preload("res://src/ui/compass.gd")
const WorldMarks := preload("res://src/ui/world_marks.gd")
const Pause := preload("res://src/ui/pause.gd")
const SCREEN_FX := preload("res://shaders/screen_fx.gdshader")

var root: Control
var fx_rect: ColorRect
var fx: ShaderMaterial
var bar_hp: ColorRect
var bar_stamina: ColorRect
var bar_breath: ColorRect
var bar_lungs: ColorRect
var status_box: HBoxContainer
var compass: Control
var wind_label: Label
var tide_label: Label
var feed: VBoxContainer
var center_label: Label
var prompt_box: Control
var prompt_label: Label
var slots: Array = []
var slot_name: Label
var essence_label: Label
var combo_box: Control
var combo_number: Label
var combo_word: Label
var combo_rank: Label
var combo_bar: ColorRect
var combo_damage: Label
var crosshair: Control
var charge_ring: Control
var debug_label: Label
var death_label: Label
var pause: Control
var hidden_hud := false

var _hurt := 0.0
var _flash := 0.0
var _fade := 0.0
var _speed := 0.0
var _combo_alpha := 0.0
var _center_t := 0.0
var _debug := false
var _last_index := -1
var _status: Dictionary = {}


func _ready() -> void:
	layer = 5
	process_mode = Node.PROCESS_MODE_ALWAYS
	# efeitos de tela (abaixo de tudo)
	fx_rect = ColorRect.new()
	fx_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	fx_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	fx = ShaderMaterial.new()
	fx.shader = SCREEN_FX
	fx_rect.material = fx
	add_child(fx_rect)
	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	root.add_child(WorldMarks.new())
	_build_bars()
	_build_compass()
	_build_feed()
	_build_hotbar()
	_build_combo()
	_build_center()
	pause = Pause.new()
	add_child(pause)
	Game.notice.connect(_on_notice)
	Game.currency_changed.connect(func(v: int) -> void:
		essence_label.text = str(v)
		_pop(essence_label, 1.3))
	Game.combo_changed.connect(_on_combo)
	Game.combo_ended.connect(_on_combo_end)
	if Game.player:
		_bind_player(Game.player)
	Game.local_player_ready.connect(_bind_player)
	essence_label.text = str(Game.currency)
	if Game.args.has("nohud"):
		root.visible = false


func _bind_player(p: Node3D) -> void:
	if not p.damaged.is_connected(_on_player_damaged):
		p.damaged.connect(_on_player_damaged)


func _place(c: Control, anchor: Vector2, pos: Vector2, sz: Vector2) -> void:
	c.anchor_left = anchor.x
	c.anchor_right = anchor.x
	c.anchor_top = anchor.y
	c.anchor_bottom = anchor.y
	c.offset_left = pos.x
	c.offset_top = pos.y
	c.offset_right = pos.x + sz.x
	c.offset_bottom = pos.y + sz.y


func _pop(c: Control, amount: float = 1.25) -> void:
	c.pivot_offset = c.size * 0.5
	var tw := c.create_tween()
	tw.tween_property(c, "scale", Vector2.ONE * amount, 0.07).set_ease(Tween.EASE_OUT)
	tw.tween_property(c, "scale", Vector2.ONE, 0.16).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_BACK)


# =============================================================================== montagem

func _build_bars() -> void:
	# selo redondo com o emblema
	var badge := UiKit.paint(Color(0.07, 0.3, 0.42, 0.95), 1.7, 1.0, 0.22)
	_place(badge, Vector2(0, 0), Vector2(26, 22), Vector2(128, 128))
	root.add_child(badge)
	var crest := Icon.new()
	crest.icon = "crest"
	_place(crest, Vector2(0, 0), Vector2(46, 42), Vector2(88, 88))
	root.add_child(crest)
	bar_hp = BrushBar.new()
	bar_hp.setup(Color("#e8493f"), 0.3)
	_place(bar_hp, Vector2(0, 0), Vector2(140, 30), Vector2(470, 46))
	root.add_child(bar_hp)
	bar_stamina = BrushBar.new()
	bar_stamina.setup(Color("#f5b63f"), 2.1)
	_place(bar_stamina, Vector2(0, 0), Vector2(146, 74), Vector2(380, 32))
	root.add_child(bar_stamina)
	bar_breath = BrushBar.new()
	bar_breath.setup(Color("#34d6c6"), 4.4)
	_place(bar_breath, Vector2(0, 0), Vector2(146, 104), Vector2(330, 32))
	root.add_child(bar_breath)
	status_box = HBoxContainer.new()
	status_box.add_theme_constant_override("separation", 6)
	_place(status_box, Vector2(0, 0), Vector2(152, 140), Vector2(400, 44))
	status_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(status_box)
	# ar debaixo d'água (aparece só mergulhando)
	bar_lungs = BrushBar.new()
	bar_lungs.setup(Color("#8fe6ff"), 6.0)
	_place(bar_lungs, Vector2(0.5, 1), Vector2(-170, -330), Vector2(340, 30))
	bar_lungs.modulate.a = 0.0
	root.add_child(bar_lungs)


func _build_compass() -> void:
	compass = Compass.new()
	_place(compass, Vector2(1, 0), Vector2(-226, 22), Vector2(196, 196))
	root.add_child(compass)
	wind_label = UiKit.label("Vento", 30, UiKit.PAPER)
	wind_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_place(wind_label, Vector2(1, 0), Vector2(-430, 222), Vector2(400, 38))
	root.add_child(wind_label)
	tide_label = UiKit.label("Maré", 30, UiKit.PAPER)
	tide_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_place(tide_label, Vector2(1, 0), Vector2(-430, 256), Vector2(400, 38))
	root.add_child(tide_label)


func _build_feed() -> void:
	feed = VBoxContainer.new()
	feed.add_theme_constant_override("separation", -4)
	feed.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_place(feed, Vector2(0, 0), Vector2(40, 250), Vector2(700, 420))
	root.add_child(feed)


func _build_hotbar() -> void:
	var p: Node3D = Game.player
	var n := 8
	var step := 92.0
	var total := step * float(n)
	for i in n:
		var holder := Control.new()
		holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_place(holder, Vector2(0.5, 1), Vector2(-total * 0.5 + step * float(i), -150), Vector2(84, 84))
		holder.pivot_offset = Vector2(42, 42)
		root.add_child(holder)
		var blot := UiKit.paint(Color(0.06, 0.2, 0.32, 0.82), float(i) * 1.37 + 0.5, 0.7, 0.3)
		blot.set_anchors_preset(Control.PRESET_FULL_RECT)
		blot.offset_left = -8
		blot.offset_top = -8
		blot.offset_right = 8
		blot.offset_bottom = 8
		holder.add_child(blot)
		var ic := Icon.new()
		ic.set_anchors_preset(Control.PRESET_FULL_RECT)
		ic.offset_left = 12
		ic.offset_top = 12
		ic.offset_right = -12
		ic.offset_bottom = -12
		holder.add_child(ic)
		var key := UiKit.label(str(i + 1), 28, UiKit.PAPER)
		key.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		key.position = Vector2(0, 80)
		key.size = Vector2(84, 30)
		holder.add_child(key)
		var count := UiKit.label("", 30, UiKit.GOLD)
		count.position = Vector2(56, -12)
		count.size = Vector2(40, 30)
		holder.add_child(count)
		slots.append({"holder": holder, "blot": blot, "icon": ic, "key": key, "count": count})
	slot_name = UiKit.label("", 36, UiKit.GOLD)
	slot_name.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_place(slot_name, Vector2(0.5, 1), Vector2(-300, -204), Vector2(600, 44))
	root.add_child(slot_name)
	# Essência (canto inferior direito)
	var eic := Icon.new()
	eic.icon = "essence"
	_place(eic, Vector2(1, 1), Vector2(-250, -112), Vector2(60, 60))
	root.add_child(eic)
	essence_label = UiKit.label("0", 52, UiKit.GOLD)
	_place(essence_label, Vector2(1, 1), Vector2(-184, -116), Vector2(170, 64))
	root.add_child(essence_label)
	var hint := UiKit.label("Esc: pausa e controles", 24, Color(1, 1, 1, 0.75))
	hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_place(hint, Vector2(1, 1), Vector2(-420, -46), Vector2(400, 30))
	root.add_child(hint)
	if p:
		_refresh_hotbar(p)


func _build_combo() -> void:
	combo_box = Control.new()
	combo_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_place(combo_box, Vector2(1, 0.5), Vector2(-470, -190), Vector2(440, 260))
	combo_box.modulate.a = 0.0
	root.add_child(combo_box)
	combo_number = UiKit.label("0", 150, UiKit.PAPER, "title", 26)
	combo_number.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	combo_number.position = Vector2(0, 0)
	combo_number.size = Vector2(290, 170)
	combo_box.add_child(combo_number)
	combo_word = UiKit.label("golpes", 46, UiKit.PAPER)
	combo_word.position = Vector2(300, 84)
	combo_word.size = Vector2(160, 54)
	combo_box.add_child(combo_word)
	combo_rank = UiKit.label("", 64, UiKit.TEAL, "title", 14)
	combo_rank.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	combo_rank.position = Vector2(0, 150)
	combo_rank.size = Vector2(440, 76)
	combo_box.add_child(combo_rank)
	combo_bar = BrushBar.new()
	combo_bar.setup(UiKit.PAPER, 7.7)
	combo_bar.position = Vector2(120, 222)
	combo_bar.size = Vector2(320, 20)
	combo_box.add_child(combo_bar)
	combo_damage = UiKit.label("", 30, UiKit.GOLD)
	combo_damage.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	combo_damage.position = Vector2(0, 240)
	combo_damage.size = Vector2(440, 36)
	combo_box.add_child(combo_damage)


func _build_center() -> void:
	center_label = UiKit.label("", 76, UiKit.GOLD, "title", 18)
	center_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_place(center_label, Vector2(0.5, 0), Vector2(-700, 190), Vector2(1400, 100))
	center_label.modulate.a = 0.0
	root.add_child(center_label)
	death_label = UiKit.label("Você morreu", 150, Color("#ff6b6b"), "title", 26)
	death_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_place(death_label, Vector2(0.5, 0.5), Vector2(-800, -140), Vector2(1600, 200))
	death_label.modulate.a = 0.0
	root.add_child(death_label)
	prompt_box = Control.new()
	prompt_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_place(prompt_box, Vector2(0.5, 1), Vector2(-300, -290), Vector2(600, 60))
	prompt_box.modulate.a = 0.0
	root.add_child(prompt_box)
	var pb := UiKit.paint(Color(0.05, 0.2, 0.3, 0.8), 3.3, 0.2, 0.35)
	pb.set_anchors_preset(Control.PRESET_FULL_RECT)
	prompt_box.add_child(pb)
	prompt_label = UiKit.label("", 38, UiKit.PAPER)
	prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	prompt_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	prompt_label.set_anchors_preset(Control.PRESET_FULL_RECT)
	prompt_box.add_child(prompt_label)
	crosshair = Control.new()
	crosshair.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_place(crosshair, Vector2(0.5, 0.5), Vector2(-20, -20), Vector2(40, 40))
	crosshair.draw.connect(func() -> void:
		crosshair.draw_circle(Vector2(20, 20), 5.0, UiKit.INK)
		crosshair.draw_circle(Vector2(20, 20), 3.0, UiKit.PAPER))
	root.add_child(crosshair)
	charge_ring = Control.new()
	charge_ring.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_place(charge_ring, Vector2(0.5, 0.5), Vector2(-70, -70), Vector2(140, 140))
	charge_ring.set_meta("v", 0.0)
	charge_ring.draw.connect(func() -> void:
		var v: float = charge_ring.get_meta("v")
		if v <= 0.01:
			return
		var c := Vector2(70, 70)
		charge_ring.draw_arc(c, 54.0, -PI * 0.5, -PI * 0.5 + TAU, 48, Color(0.09, 0.07, 0.23, 0.6), 12.0, true)
		charge_ring.draw_arc(c, 54.0, -PI * 0.5, -PI * 0.5 + TAU * v, 48, UiKit.TEAL if v < 0.999 else UiKit.PAPER, 7.0, true))
	root.add_child(charge_ring)
	debug_label = Label.new()
	debug_label.add_theme_font_size_override("font_size", 20)
	debug_label.add_theme_color_override("font_color", Color(1, 1, 1))
	debug_label.add_theme_color_override("font_outline_color", Color(0, 0, 0))
	debug_label.add_theme_constant_override("outline_size", 6)
	_place(debug_label, Vector2(0.5, 0), Vector2(-360, 16), Vector2(720, 200))
	debug_label.visible = false
	debug_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(debug_label)


# =============================================================================== avisos

func _on_notice(text: String, kind: String) -> void:
	if kind == "death":
		death_label.modulate.a = 0.0
		var tw := death_label.create_tween()
		tw.tween_property(death_label, "modulate:a", 1.0, 0.8)
		tw.tween_interval(2.0)
		tw.tween_property(death_label, "modulate:a", 0.0, 0.8)
		return
	if kind == "good":
		center_label.text = text
		center_label.modulate.a = 1.0
		_center_t = 1.5
		_pop(center_label, 1.35)
		return
	var col := UiKit.PAPER
	if kind == "gold":
		col = UiKit.GOLD
	elif kind == "bad":
		col = Color("#ff8f7a")
	var l := UiKit.label(text, 36, col)
	l.modulate.a = 0.0
	feed.add_child(l)
	if feed.get_child_count() > 7:
		feed.get_child(0).queue_free()
	var tw2 := l.create_tween()
	tw2.tween_property(l, "modulate:a", 1.0, 0.15)
	tw2.tween_interval(3.0)
	tw2.tween_property(l, "modulate:a", 0.0, 0.5)
	tw2.tween_callback(l.queue_free)


func _on_player_damaged(amount: float, _result: String) -> void:
	_hurt = clampf(_hurt + 0.35 + amount * 0.03, 0.0, 1.2)


func _on_combo(hits: int, damage: float, rank: String, rank_index: int, rank_up: bool) -> void:
	combo_number.text = str(hits)
	combo_word.text = "golpe" if hits == 1 else "golpes"
	combo_damage.text = "dano %d" % int(damage)
	var col: Color = UiKit.PAPER if rank_index < 0 else UiKit.RANK_COLORS[mini(rank_index, UiKit.RANK_COLORS.size() - 1)]
	combo_number.label_settings.font_color = col
	combo_rank.text = rank
	combo_rank.label_settings.font_color = col
	_combo_alpha = 1.0
	combo_box.modulate = Color(1, 1, 1, 1)
	combo_number.rotation = randf_range(-0.05, 0.05)
	_pop(combo_number, 1.22 if not rank_up else 1.55)
	if rank_up:
		_pop(combo_rank, 1.6)
		_flash = maxf(_flash, 0.12)


func _on_combo_end(hits: int, _damage: float, broken: bool) -> void:
	if broken:
		combo_box.modulate = Color(1.0, 0.5, 0.5, combo_box.modulate.a)
	elif hits >= 8:
		_on_notice("Combo de %d golpes" % hits, "gold")


## Escurece (ou clareia) a tela. Pode ser aguardado com await.
func fade(to_dark: bool, seconds: float) -> void:
	var tw := create_tween()
	tw.tween_property(self, "_fade", 1.0 if to_dark else 0.0, seconds)
	await tw.finished


func flash(amount: float) -> void:
	_flash = maxf(_flash, amount)


# =============================================================================== atualização

func _refresh_hotbar(p: Node3D) -> void:
	for i in slots.size():
		var s: Dictionary = slots[i]
		var slot: Dictionary = p.hotbar[i] if i < p.hotbar.size() else {}
		var ic: Control = s["icon"]
		ic.visible = slot.get("kind", "") != ""
		if ic.visible:
			ic.icon = slot.get("icon", "")
	_last_index = -1


func _status_icon(key: String, icon_name: String, on: bool) -> void:
	if on and not _status.has(key):
		var ic := Icon.new()
		ic.icon = icon_name
		ic.custom_minimum_size = Vector2(42, 42)
		status_box.add_child(ic)
		_status[key] = ic
	elif not on and _status.has(key):
		(_status[key] as Control).queue_free()
		_status.erase(key)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"debug_toggle"):
		_debug = not _debug
		debug_label.visible = _debug
	if event.is_action_pressed(&"pause") and Game.in_game:
		pause.toggle()
		get_viewport().set_input_as_handled()


func _process(delta: float) -> void:
	var p: Node3D = Game.player
	var vp := get_viewport().get_visible_rect().size
	# ---- efeitos de tela
	_hurt = maxf(_hurt - delta * 1.6, 0.0)
	_flash = maxf(_flash - delta * 3.0, 0.0)
	var uw := 0.0
	if Game.world and Game.world.sky:
		uw = Game.world.sky.underwater_amount()
	fx.set_shader_parameter("underwater", uw)
	fx.set_shader_parameter("hurt", _hurt)
	fx.set_shader_parameter("flash", _flash)
	fx.set_shader_parameter("fade", _fade)
	fx.set_shader_parameter("aspect", vp.x / maxf(vp.y, 1.0))
	var cam := get_viewport().get_camera_3d()
	if cam and Game.world and Game.world.sky:
		var sdir: Vector3 = Game.world.sky.sun.global_basis.z
		var sp := cam.global_position + sdir * 1000.0
		if cam.is_position_behind(sp) or uw > 0.5:
			fx.set_shader_parameter("sun_vis", 0.0)
		else:
			var s2 := cam.unproject_position(sp) / vp
			var off := maxf(maxf(-s2.x, s2.x - 1.0), maxf(-s2.y, s2.y - 1.0))
			fx.set_shader_parameter("sun_pos", s2)
			fx.set_shader_parameter("sun_vis", clampf(1.0 - off * 1.6, 0.0, 1.0))
	if p == null or not is_instance_valid(p):
		fx.set_shader_parameter("speed", 0.0)
		fx.set_shader_parameter("low_hp", 0.0)
		return
	var St: Dictionary = p.St
	var fast := 0.0
	if p.state == St.BURST:
		fast = 1.0
	elif p.state == St.DASH:
		fast = 0.75
	elif p.velocity.length() > 11.5:
		fast = clampf((p.velocity.length() - 11.5) / 8.0, 0.0, 0.6)
	_speed = lerpf(_speed, fast, 1.0 - exp(-10.0 * delta))
	fx.set_shader_parameter("speed", _speed)
	fx.set_shader_parameter("focus", p.charge if p.state == St.CHARGE else 0.0)
	fx.set_shader_parameter("low_hp", clampf(1.0 - p.hp / (p.max_hp * 0.3), 0.0, 1.0) if p.alive else 0.0)
	# ---- barras
	bar_hp.set_value(p.hp / p.max_hp)
	bar_stamina.set_value(p.stamina / p.max_stamina)
	bar_breath.set_value(p.breath / p.max_breath)
	bar_lungs.set_value(p.lungs / p.LUNGS)
	bar_lungs.modulate.a = move_toward(bar_lungs.modulate.a, 1.0 if p.underwater or p.lungs < p.LUNGS - 0.5 else 0.0, delta * 4.0)
	_status_icon("wet", "wet", p.wet > 0.0)
	_status_icon("fire", "fire", p.burning > 0.0)
	# ---- bússola, vento e maré
	wind_label.text = "Vento: %s" % Wind.MODE_NAMES[Wind.mode]
	var tide_txt := "cheia" if Tide.fraction() > 0.85 else ("baixa" if Tide.fraction() < 0.15 else "meia maré")
	if Tide.is_rising():
		tide_txt += ", subindo"
	elif Tide.is_falling():
		tide_txt += ", descendo"
	tide_label.text = "Maré: " + tide_txt
	# ---- hotbar
	if p.hotbar_index != _last_index:
		_last_index = p.hotbar_index
		var nm: String = p.hotbar[p.hotbar_index].get("name", "")
		slot_name.text = nm
		slot_name.modulate.a = 1.0
		_pop(slots[p.hotbar_index]["holder"], 1.3)
	slot_name.modulate.a = maxf(slot_name.modulate.a - delta * 0.45, 0.0)
	for i in slots.size():
		var s: Dictionary = slots[i]
		var slot: Dictionary = p.hotbar[i] if i < p.hotbar.size() else {}
		var selected: bool = i == p.hotbar_index
		var equipped: bool = slot.get("kind", "") == "weapon" and slot.get("id", "") == p.weapon_id
		var blot_mat: ShaderMaterial = (s["blot"] as ColorRect).material
		var base := Color(0.06, 0.2, 0.32, 0.82)
		if equipped:
			base = Color(0.72, 0.5, 0.1, 0.9)
		elif selected:
			base = Color(0.05, 0.5, 0.52, 0.92)
		blot_mat.set_shader_parameter("color", base)
		var holder: Control = s["holder"]
		holder.position.y = lerpf(holder.position.y, (-162.0 if selected else -150.0) + holder.get_parent_area_size().y, 1.0 - exp(-14.0 * delta))
		var count: Label = s["count"]
		var ic: Control = s["icon"]
		var dim := 1.0
		match slot.get("id", ""):
			"flask":
				count.text = str(p.flasks)
				dim = 1.0 if p.flasks > 0 else 0.35
			_:
				count.text = ""
		if slot.get("kind", "") == "skill" and p.breath < float(slot.get("cost", 0.0)):
			dim = 0.35
		ic.modulate.a = dim
	# ---- combo
	if p.combat.combo_hits > 0:
		combo_bar.set_value(p.combat.combo_fraction())
	else:
		_combo_alpha = maxf(_combo_alpha - delta * 1.6, 0.0)
	combo_box.modulate.a = _combo_alpha if p.combat.combo_hits == 0 else 1.0
	# ---- aviso central e interação
	if _center_t > 0.0:
		_center_t -= delta
	else:
		center_label.modulate.a = maxf(center_label.modulate.a - delta * 2.5, 0.0)
	var it: Node3D = Game.stage.nearest_interactable(p.global_position) if Game.stage and p.alive and p.state != St.REST else null
	if it:
		prompt_label.text = "[F]  " + it.prompt
	elif p.state == St.REST:
		prompt_label.text = "Mova-se para levantar"
		it = p
	elif p.state == St.LEDGE:
		prompt_label.text = "[Espaço] subir   [S] soltar"
		it = p
	prompt_box.modulate.a = move_toward(prompt_box.modulate.a, 1.0 if it else 0.0, delta * 8.0)
	crosshair.visible = Game.cam_rig != null and Game.cam_rig.first_person
	var ch := 0.0
	if p.state == St.CHARGE:
		ch = p.charge
	elif p.combat.charging:
		ch = p.combat.charge
	if not is_equal_approx(ch, charge_ring.get_meta("v")):
		charge_ring.set_meta("v", ch)
		charge_ring.queue_redraw()
	if _debug:
		var w: Vector3 = Wind.at(p.global_position)
		debug_label.text = "%d FPS   estado: %s   vel: %.1f m/s (v %.1f)\npos: %.1f, %.1f, %.1f   vento: %.1f m/s   maré: %.2f m\nvida %.0f  stamina %.0f  fôlego %.0f  ar %.0f   animação: %s" % [
			Engine.get_frames_per_second(), p.ST_NAMES[p.state], p.horizontal_speed(), p.velocity.y,
			p.global_position.x, p.global_position.y, p.global_position.z, w.length(), Tide.level,
			p.hp, p.stamina, p.breath, p.lungs, p.visual.current]
