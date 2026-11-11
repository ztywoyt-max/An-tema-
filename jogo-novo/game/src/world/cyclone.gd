extends Node3D
## Ciclone: puxa e levanta inimigos; quem pula dentro é levado para cima.

const Geo := preload("res://src/core/geo.gd")

var life := 3.6
var radius := 2.4
var owner_actor: Node3D
var authoritative := true
var _t := 0.0
var _tick := 0.0
var _fx := 0.0


func _enter_tree() -> void:
	if not Wind.zones.has(self):
		Wind.zones.append(self)


func _exit_tree() -> void:
	Wind.zones.erase(self)


func wind_at(pos: Vector3) -> Vector3:
	var l := pos - global_position
	if l.y < -0.6 or l.y > 8.0:
		return Vector3.ZERO
	var d := Vector2(l.x, l.z).length()
	if d > radius:
		return Vector3.ZERO
	var tang := Vector3(-l.z, 0.0, l.x).normalized() * 3.0 if d > 0.05 else Vector3.ZERO
	return Vector3(0, 16.0, 0) * clampf((radius - d) / 0.8, 0.0, 1.0) + tang


func _ready() -> void:
	Sfx.play_at("burst", global_position, -2.0, 0.7)
	Fx.ring(global_position + Vector3.UP * 0.1, Vector3.UP, Color(0.8, 1.0, 0.97), radius * 1.6, 0.5)


func _physics_process(delta: float) -> void:
	_t += delta
	_fx -= delta
	if _fx <= 0.0:
		_fx = 0.07
		var h := fposmod(_t * 5.5, 6.0)
		Fx.ring(global_position + Vector3.UP * h, Vector3.UP, Color(0.85, 1.0, 0.98, 0.7), radius * (0.55 + h * 0.13), 0.32)
		var a := _t * 9.0
		Fx.burst("streak", global_position + Vector3(cos(a), 0.2 + h * 0.3, sin(a)) * radius * 0.8, Vector3(-sin(a), 0.6, cos(a)), Color(0.9, 1.0, 0.98), 1.0)
	if authoritative:
		_tick -= delta
		if _tick <= 0.0:
			_tick = 0.35
			for a2: Node in get_tree().get_nodes_in_group(&"actors"):
				if not a2.alive or (owner_actor and not a2.is_enemy_of(owner_actor)):
					continue
				var to := Geo.flat(global_position - a2.global_position)
				var dist := to.length()
				if dist > 6.0 or absf(a2.global_position.y - global_position.y) > 6.0:
					continue
				var pull := to.normalized() * 5.0 if dist > 0.4 else Vector3.ZERO
				if dist < radius + 0.3:
					var res: String = Net.deal_hit(a2, {"damage": 4.0, "posture": 6.0, "knock": pull * 0.4, "launch": 7.5, "from": owner_actor,
						"from_pos": global_position, "kind": "gust", "element": "wind"})
					if res == "hit" and owner_actor and is_instance_valid(owner_actor) and owner_actor.is_in_group(&"players") and owner_actor.is_local:
						owner_actor.combat.register_hit(4.0, a2.head_pos())
				else:
					a2.knock += pull * 0.5
	if _t >= life:
		Fx.ring(global_position + Vector3.UP, Vector3.UP, Color(0.8, 1.0, 0.97), radius * 2.2, 0.5)
		queue_free()
