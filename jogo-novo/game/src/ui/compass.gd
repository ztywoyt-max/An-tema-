extends Control
## Bússola redonda: rumo, vento (direção e força), ponto de descanso e inimigos por perto.

const UiKit := preload("res://src/ui/ui_kit.gd")
const RANGE := 48.0

var _t := 0.0


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _process(delta: float) -> void:
	_t += delta
	queue_redraw()


func _dir_to_screen(world_yaw: float, cam_yaw: float) -> Vector2:
	var d := world_yaw - cam_yaw
	return Vector2(-sin(d), -cos(d))


func _world_to_disc(pos: Vector3, origin: Vector3, cam_yaw: float, r: float) -> Vector2:
	var rel := Vector2(pos.x - origin.x, pos.z - origin.z)
	var dist := rel.length()
	if dist < 0.01:
		return Vector2.ZERO
	var yaw := atan2(-rel.x, -rel.y)
	return _dir_to_screen(yaw, cam_yaw) * minf(dist / RANGE, 1.0) * r


func _draw() -> void:
	var c := size * 0.5
	var r := minf(size.x, size.y) * 0.5 - 6.0
	var rig: Node3D = Game.cam_rig
	var pl: Node3D = Game.player
	var cam_yaw: float = rig.yaw if rig and is_instance_valid(rig) else 0.0
	# disco
	draw_circle(c, r + 5.0, UiKit.INK)
	draw_circle(c, r, Color("#12a89c"))
	draw_circle(c, r * 0.97, Color("#1fc9b5"))
	draw_arc(c, r * 0.62, 0.0, TAU, 48, Color(1, 1, 1, 0.16), 2.0, true)
	draw_arc(c, r * 0.3, 0.0, TAU, 32, Color(1, 1, 1, 0.16), 2.0, true)
	draw_arc(c, r - 3.0, 0.0, TAU, 64, Color("#fdf8ea"), 3.0, true)
	# pontos cardeais (N = -Z)
	var font: Font = UiKit.font("hand")
	var names := ["N", "O", "S", "L"]
	for i in 4:
		var d := _dir_to_screen(float(i) * PI * 0.5, cam_yaw)
		var p := c + d * (r - 20.0)
		if font:
			var col := UiKit.GOLD if i == 0 else UiKit.PAPER
			draw_string_outline(font, p + Vector2(-9, 10), names[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 30, 7, UiKit.INK)
			draw_string(font, p + Vector2(-9, 10), names[i], HORIZONTAL_ALIGNMENT_LEFT, -1, 30, col)
	if pl == null or not is_instance_valid(pl):
		return
	var origin: Vector3 = pl.global_position
	# vento: riscos brancos correndo na direção para onde sopra
	var w: Vector3 = Wind.at(origin + Vector3.UP)
	var ws := Vector2(w.x, w.z).length()
	if ws > 0.3:
		var wyaw := atan2(-w.x, -w.z)
		var wd := _dir_to_screen(wyaw, cam_yaw)
		var side := Vector2(-wd.y, wd.x)
		var n := 3
		for i in n:
			var off := (float(i) - 1.0) * r * 0.3
			var phase := fposmod(_t * (0.25 + ws * 0.07) + float(i) * 0.37, 1.0)
			var mid := c + side * off + wd * lerpf(-r * 0.75, r * 0.75, phase)
			var ln := r * (0.16 + minf(ws, 12.0) * 0.022)
			var a := sin(phase * PI)
			if (mid - c).length() < r - 8.0:
				draw_line(mid - wd * ln, mid + wd * ln, Color(1, 1, 1, 0.85 * a), 4.0, true)
				draw_line(mid + wd * ln, mid + wd * ln * 0.45 + side * ln * 0.35, Color(1, 1, 1, 0.85 * a), 3.0, true)
	# ponto de descanso e inimigos
	if Game.stage:
		for it: Node3D in Game.stage.interactables:
			if is_instance_valid(it) and it.name == "PontoDeDescanso":
				var p2 := c + _world_to_disc(it.global_position, origin, cam_yaw, r - 12.0)
				draw_circle(p2, 8.0, UiKit.INK)
				draw_circle(p2, 5.5, UiKit.PAPER)
	for e: Node in get_tree().get_nodes_in_group(&"enemies"):
		if not e.alive or e.max_hp > 99999.0:
			continue
		var p3 := c + _world_to_disc(e.global_position, origin, cam_yaw, r - 12.0)
		draw_circle(p3, 7.5, UiKit.INK)
		draw_circle(p3, 5.0, UiKit.CORAL)
	for o: Node in get_tree().get_nodes_in_group(&"players"):
		if o == pl or not o.alive:
			continue
		var p4 := c + _world_to_disc(o.global_position, origin, cam_yaw, r - 12.0)
		draw_circle(p4, 7.5, UiKit.INK)
		draw_circle(p4, 5.0, UiKit.GOLD)
	# seta do jogador (para onde o corpo aponta)
	var fd := _dir_to_screen(pl.facing, cam_yaw)
	var sd := Vector2(-fd.y, fd.x)
	var tri := PackedVector2Array([c + fd * 17.0, c - fd * 10.0 + sd * 10.0, c - fd * 4.0, c - fd * 10.0 - sd * 10.0])
	var outline := tri.duplicate()
	outline.append(tri[0])
	draw_polyline(outline, UiKit.INK, 6.0, true)
	draw_colored_polygon(tri, UiKit.PAPER)
