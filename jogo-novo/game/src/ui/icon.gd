extends Control
## Ícones desenhados por código, a traço de pincel (armas, itens, habilidades, estados).

var icon := "sword":
	set(v):
		icon = v
		queue_redraw()
var color := Color("#fdf8ea"):
	set(v):
		color = v
		queue_redraw()
var ink := Color("#17123a")


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(queue_redraw)


func _pts(arr: Array, s: float, c: Vector2) -> PackedVector2Array:
	var out := PackedVector2Array()
	for v: Vector2 in arr:
		out.append(c + v * s)
	return out


func _line(arr: Array, s: float, c: Vector2, w: float, col: Color) -> void:
	var pts := _pts(arr, s, c)
	draw_polyline(pts, ink, w * s + 5.0, true)
	draw_polyline(pts, col, w * s, true)


func _poly(arr: Array, s: float, c: Vector2, col: Color) -> void:
	var pts := _pts(arr, s, c)
	var closed := pts.duplicate()
	closed.append(pts[0])
	draw_polyline(closed, ink, 5.0, true)
	draw_colored_polygon(pts, col)


func _arc_pts(center: Vector2, r: float, a0: float, a1: float, n: int = 14, r1: float = -1.0) -> Array:
	var out := []
	for i in n + 1:
		var k := float(i) / float(n)
		var rr := lerpf(r, r1 if r1 >= 0.0 else r, k)
		var a := lerpf(a0, a1, k)
		out.append(center + Vector2(cos(a), sin(a)) * rr)
	return out


func _draw() -> void:
	var s := minf(size.x, size.y) * 0.5
	var c := size * 0.5
	var steel := Color("#dfeaf5")
	var gold := Color("#f3d36b")
	var wood := Color("#c08a55")
	match icon:
		"sword":
			_poly([Vector2(-0.5, 0.62), Vector2(0.5, -0.5), Vector2(0.72, -0.78), Vector2(0.62, -0.42), Vector2(-0.36, 0.72)], s, c, steel)
			_line([Vector2(-0.66, 0.42), Vector2(-0.24, 0.8)], s, c, 0.12, gold)
			_line([Vector2(-0.5, 0.64), Vector2(-0.74, 0.84)], s, c, 0.13, Color("#27357a"))
		"spear":
			_line([Vector2(-0.72, 0.78), Vector2(0.42, -0.42)], s, c, 0.08, wood)
			_poly([Vector2(0.34, -0.3), Vector2(0.4, -0.62), Vector2(0.8, -0.82), Vector2(0.6, -0.42)], s, c, steel)
			_line([Vector2(0.3, -0.2), Vector2(0.56, 0.0), Vector2(0.46, 0.22)], s, c, 0.07, Color("#1fc9b5"))
		"club":
			_line([Vector2(-0.7, 0.76), Vector2(-0.05, 0.08)], s, c, 0.1, wood)
			_poly([Vector2(-0.14, 0.02), Vector2(0.2, -0.62), Vector2(0.62, -0.84), Vector2(0.84, -0.62), Vector2(0.6, -0.2), Vector2(0.0, 0.16)], s, c, wood)
			_line([Vector2(0.12, -0.3), Vector2(0.42, -0.02)], s, c, 0.06, Color("#1fc9b5"))
		"flask":
			var body := _arc_pts(Vector2(0, 0.28), 0.5, 0.0, TAU, 20)
			_poly(body, s, c, Color("#e3bd62"))
			var neck := _arc_pts(Vector2(0, -0.34), 0.26, 0.0, TAU, 14)
			_poly(neck, s, c, Color("#e3bd62"))
			_poly([Vector2(-0.12, -0.84), Vector2(0.12, -0.84), Vector2(0.1, -0.56), Vector2(-0.1, -0.56)], s, c, Color("#7b4b32"))
			_line(_arc_pts(Vector2(0, 0.28), 0.3, 2.4, 3.6, 6), s, c, 0.06, Color("#fff4cf"))
		"gust":
			_line(_arc_pts(Vector2(0.28, -0.42), 0.26, 2.4, -1.3, 14) + [Vector2(-0.8, -0.2)], s, c, 0.1, color)
			_line([Vector2(-0.84, 0.16)] + _arc_pts(Vector2(0.5, 0.36), 0.22, -1.6, 2.2, 14), s, c, 0.1, color)
			_line([Vector2(-0.6, 0.56), Vector2(-0.05, 0.62)], s, c, 0.09, color)
		"wave":
			var drop := [Vector2(0, -0.82)] + _arc_pts(Vector2(0, 0.22), 0.52, -0.5, PI + 0.5, 16)
			_poly(drop, s, c, Color("#59d8ff"))
			_line(_arc_pts(Vector2(0, 0.22), 0.3, 0.4, 1.9, 6), s, c, 0.07, Color("#e9fbff"))
		"cyclone":
			_line(_arc_pts(Vector2(0, 0), 0.82, 0.3, 0.3 + TAU * 2.1, 44, 0.08), s, c, 0.1, color)
		"essence":
			_poly([Vector2(0, -0.8), Vector2(0.56, 0), Vector2(0, 0.8), Vector2(-0.56, 0)], s, c, Color("#f3d36b"))
			_line([Vector2(-0.2, -0.1), Vector2(0, -0.42)], s, c, 0.07, Color("#fff8dc"))
		"wet":
			_poly([Vector2(0, -0.8)] + _arc_pts(Vector2(0, 0.24), 0.5, -0.5, PI + 0.5, 16), s, c, Color("#59d8ff"))
		"fire":
			_poly([Vector2(0, -0.86), Vector2(0.36, -0.2), Vector2(0.56, 0.3), Vector2(0.3, 0.8), Vector2(-0.3, 0.8), Vector2(-0.56, 0.3), Vector2(-0.2, -0.1)], s, c, Color("#ff8a3a"))
			_poly([Vector2(0.02, -0.2), Vector2(0.24, 0.36), Vector2(0.0, 0.7), Vector2(-0.24, 0.36)], s, c, Color("#ffe07a"))
		"lock":
			for k in 4:
				var a := float(k) * PI * 0.5 + PI * 0.25
				_line([Vector2(cos(a), sin(a)) * 0.95, Vector2(cos(a), sin(a)) * 0.55], s, c, 0.1, color)
		"crest":
			_line(_arc_pts(Vector2(-0.1, 0.1), 0.62, PI * 0.9, PI * 2.35, 20, 0.2), s, c, 0.11, color)
			_line([Vector2(-0.82, 0.5)] + _arc_pts(Vector2(0.3, 0.5), 0.3, -PI * 0.5, PI * 0.55, 10), s, c, 0.1, Color("#8ff2e6"))
		_:
			pass
