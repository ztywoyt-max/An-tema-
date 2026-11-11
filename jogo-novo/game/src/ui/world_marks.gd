extends Control
## Marcas desenhadas sobre o mundo: barras dos inimigos, mira do alvo travado, nomes dos aliados.

const UiKit := preload("res://src/ui/ui_kit.gd")

var _t := 0.0
var _shown: Dictionary = {}      # inimigo -> vida mostrada com atraso


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_preset(Control.PRESET_FULL_RECT)


func _process(delta: float) -> void:
	_t += delta
	queue_redraw()


func _bar(pos: Vector2, width: float, frac: float, color: Color, thick: float, ghost: float = -1.0) -> void:
	var a := pos - Vector2(width * 0.5, 0)
	var b := pos + Vector2(width * 0.5, 0)
	draw_line(a - Vector2(3, 0), b + Vector2(3, 0), UiKit.INK, thick + 6.0, true)
	draw_line(a, b, Color(0.2, 0.17, 0.36), thick, true)
	if ghost > frac:
		draw_line(a, a.lerp(b, clampf(ghost, 0.0, 1.0)), Color(1.0, 0.95, 0.8), thick, true)
	if frac > 0.003:
		draw_line(a, a.lerp(b, clampf(frac, 0.0, 1.0)), color, thick, true)


func _draw() -> void:
	var cam := get_viewport().get_camera_3d()
	var pl: Node3D = Game.player
	if cam == null or pl == null or not is_instance_valid(pl):
		return
	var font: Font = UiKit.font("hand")
	var scale_f: float = clampf(size.y / 1080.0, 0.5, 3.0)
	var delta := get_process_delta_time()
	for e: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not is_instance_valid(e) or not e.alive:
			_shown.erase(e)
			continue
		var head: Vector3 = e.head_pos() + Vector3.UP * 0.42
		var dist: float = cam.global_position.distance_to(head)
		if dist > 34.0 or cam.is_position_behind(head):
			continue
		var p := cam.unproject_position(head)
		var k := clampf(1.25 - dist / 40.0, 0.6, 1.1) * scale_f
		var is_dummy: bool = e.max_hp > 99999.0
		var locked: bool = pl.lock_target == e
		var show_bar: bool = locked or dist < 18.0
		if not show_bar:
			continue
		if font:
			var nm: String = e.display_name
			var tw := font.get_string_size(nm, HORIZONTAL_ALIGNMENT_LEFT, -1, int(26 * k)).x
			draw_string_outline(font, p + Vector2(-tw * 0.5, -16.0 * k), nm, HORIZONTAL_ALIGNMENT_LEFT, -1, int(26 * k), int(7 * k), UiKit.INK)
			draw_string(font, p + Vector2(-tw * 0.5, -16.0 * k), nm, HORIZONTAL_ALIGNMENT_LEFT, -1, int(26 * k), UiKit.PAPER)
		if is_dummy:
			if "dps_damage" in e and e.last_hit < 4.0 and font:
				var txt := "dano %d   %d por segundo" % [int(e.dps_damage), int(e.dps_damage / maxf(e.dps_time, 0.5))]
				var tw2 := font.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, int(22 * k)).x
				draw_string_outline(font, p + Vector2(-tw2 * 0.5, 8.0 * k), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, int(22 * k), int(6 * k), UiKit.INK)
				draw_string(font, p + Vector2(-tw2 * 0.5, 8.0 * k), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, int(22 * k), UiKit.GOLD)
			continue
		var frac: float = e.hp / maxf(e.max_hp, 1.0)
		var g: float = _shown.get(e, frac)
		g = maxf(move_toward(g, frac, delta * 0.5), frac)
		_shown[e] = g
		_bar(p, 150.0 * k, frac, UiKit.CORAL, 9.0 * k, g)
		if e.max_posture > 0.0:
			var pf: float = e.posture / e.max_posture
			var staggered: bool = e.has_method("is_staggered") and e.is_staggered()
			var pc := UiKit.GOLD if not staggered else Color(1, 1, 1).lerp(UiKit.GOLD, 0.5 + 0.5 * sin(_t * 14.0))
			_bar(p + Vector2(0, 13.0 * k), 120.0 * k, 1.0 if staggered else pf, pc, 5.0 * k)
			if staggered and font:
				var msg := "golpe crítico!"
				var tw3 := font.get_string_size(msg, HORIZONTAL_ALIGNMENT_LEFT, -1, int(30 * k)).x
				draw_string_outline(font, p + Vector2(-tw3 * 0.5, 46.0 * k), msg, HORIZONTAL_ALIGNMENT_LEFT, -1, int(30 * k), int(8 * k), UiKit.INK)
				draw_string(font, p + Vector2(-tw3 * 0.5, 46.0 * k), msg, HORIZONTAL_ALIGNMENT_LEFT, -1, int(30 * k), UiKit.GOLD)
	# mira do alvo travado
	if pl.lock_target and is_instance_valid(pl.lock_target):
		var cp: Vector3 = pl.lock_target.center()
		if not cam.is_position_behind(cp):
			var p2 := cam.unproject_position(cp)
			var rr := 26.0 * scale_f * (1.0 + 0.08 * sin(_t * 6.0))
			for i in 4:
				var a := float(i) * PI * 0.5 + _t * 1.2
				var d := Vector2(cos(a), sin(a))
				draw_line(p2 + d * rr, p2 + d * (rr + 14.0 * scale_f), UiKit.INK, 9.0 * scale_f, true)
				draw_line(p2 + d * rr, p2 + d * (rr + 14.0 * scale_f), UiKit.PAPER, 4.5 * scale_f, true)
			draw_circle(p2, 5.0 * scale_f, UiKit.INK)
			draw_circle(p2, 3.0 * scale_f, UiKit.GOLD)
	# aliados
	for o: Node in get_tree().get_nodes_in_group(&"players"):
		if o == pl or not is_instance_valid(o):
			continue
		var hp: Vector3 = o.head_pos() + Vector3.UP * 0.4
		if cam.is_position_behind(hp) or cam.global_position.distance_to(hp) > 60.0:
			continue
		var p3 := cam.unproject_position(hp)
		if font:
			var nm2: String = o.display_name if o.display_name != "" else "Aliado"
			var tw4 := font.get_string_size(nm2, HORIZONTAL_ALIGNMENT_LEFT, -1, 28).x
			draw_string_outline(font, p3 + Vector2(-tw4 * 0.5, -14), nm2, HORIZONTAL_ALIGNMENT_LEFT, -1, 28, 8, UiKit.INK)
			draw_string(font, p3 + Vector2(-tw4 * 0.5, -14), nm2, HORIZONTAL_ALIGNMENT_LEFT, -1, 28, UiKit.GOLD)
		_bar(p3, 110.0 * scale_f, o.hp / maxf(o.max_hp, 1.0), Color("#7be08a"), 7.0 * scale_f)
