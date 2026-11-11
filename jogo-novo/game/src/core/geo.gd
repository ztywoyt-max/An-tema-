extends RefCounted
## Geometria auxiliar para os testes de golpe.


## Menor distância entre dois segmentos (p1-q1 e p2-q2).
static func seg_seg_dist(p1: Vector3, q1: Vector3, p2: Vector3, q2: Vector3) -> float:
	var d1 := q1 - p1
	var d2 := q2 - p2
	var r := p1 - p2
	var a := d1.dot(d1)
	var e := d2.dot(d2)
	var f := d2.dot(r)
	var s := 0.0
	var t := 0.0
	if a <= 1e-8 and e <= 1e-8:
		return r.length()
	if a <= 1e-8:
		t = clampf(f / e, 0.0, 1.0)
	else:
		var c := d1.dot(r)
		if e <= 1e-8:
			s = clampf(-c / a, 0.0, 1.0)
		else:
			var b := d1.dot(d2)
			var denom := a * e - b * b
			if denom > 1e-8:
				s = clampf((b * f - c * e) / denom, 0.0, 1.0)
			t = (b * s + f) / e
			if t < 0.0:
				t = 0.0
				s = clampf(-c / a, 0.0, 1.0)
			elif t > 1.0:
				t = 1.0
				s = clampf((b - c) / a, 0.0, 1.0)
	return ((p1 + d1 * s) - (p2 + d2 * t)).length()


## A lâmina, varrendo de `prev` até `cur` (cada um [base, ponta]), toca a cápsula?
static func sweep_hits_capsule(prev: Array[Vector3], cur: Array[Vector3], cap: Array[Vector3], reach: float) -> bool:
	for i in 5:
		var k := float(i) / 4.0
		var b := prev[0].lerp(cur[0], k)
		var tip := prev[1].lerp(cur[1], k)
		if seg_seg_dist(b, tip, cap[0], cap[1]) <= reach:
			return true
	return false


static func flat(v: Vector3) -> Vector3:
	return Vector3(v.x, 0.0, v.z)


static func flat_dir(from: Vector3, to: Vector3) -> Vector3:
	var d := Vector3(to.x - from.x, 0.0, to.z - from.z)
	return d.normalized() if d.length_squared() > 1e-8 else Vector3.ZERO
