extends "res://src/actors/actor.gd"
## Sentinela: inimigo humanoide. Persegue, rodeia, anuncia os ataques (pausa na pose de
## preparo), defende depois de apanhar demais, tem postura e fica aberto a golpe crítico.

const Humanoid := preload("res://src/actors/humanoid.gd")
const Geo := preload("res://src/core/geo.gd")

enum St { IDLE, CHASE, CIRCLE, ATTACK, RECOVER, HIT, GUARD, STAGGER, DEAD, RETURN }

## wind = instante do clipe em que para na pose de preparo; hold = quanto tempo segura (o aviso).
const ATTACKS := {
	"slash": {"clip": "atk_l1", "wind": 0.1, "hold": 0.42, "a0": 0.12, "a1": 0.24, "chain": 0.34, "dur": 0.56, "dmg": 15.0, "range": 2.6, "lunge": 2.6, "knock": 4.0},
	"backhand": {"clip": "atk_l2", "wind": 0.07, "hold": 0.2, "a0": 0.1, "a1": 0.23, "chain": 0.33, "dur": 0.52, "dmg": 14.0, "range": 2.6, "lunge": 2.2, "knock": 4.0},
	"heavy": {"clip": "atk_h1", "wind": 0.24, "hold": 0.5, "a0": 0.3, "a1": 0.44, "chain": 0.6, "dur": 0.82, "dmg": 26.0, "range": 3.0, "lunge": 3.2, "knock": 8.0, "heavy": true, "armor": true},
	"thrust": {"clip": "atk_thrust", "wind": 0.1, "hold": 0.55, "a0": 0.14, "a1": 0.28, "chain": 0.5, "dur": 0.66, "dmg": 22.0, "range": 5.4, "lunge": 4.6, "knock": 7.0, "heavy": true, "armor": true},
	"slam": {"clip": "atk_l4", "wind": 0.13, "hold": 0.4, "a0": 0.24, "a1": 0.33, "chain": 0.7, "dur": 0.86, "dmg": 30.0, "range": 3.4, "lunge": 3.0, "knock": 8.0, "heavy": true, "armor": true, "aoe": 2.5, "unblockable": true},
}
const PATTERNS_NEAR := [["slash"], ["slash", "backhand"], ["slash", "backhand", "heavy"], ["heavy"], ["slam"]]
const PATTERNS_FAR := [["thrust"], ["thrust"], ["slam"], ["slash", "backhand"]]
const RUN_SPEED := 5.0
const WALK_SPEED := 2.3
const GRAVITY := 30.0

var state: int = St.IDLE
var state_time := 0.0
var visual: Humanoid
var facing := 0.0
var target: Node3D
var spawn_pos := Vector3.ZERO
var spawn_yaw := 0.0
var mode := "normal"            ## "normal" ou "trainer" (parado, só para treinar parry)
var pattern: Array = []
var pattern_i := 0
var atk: Dictionary = {}
var atk_name := ""
var atk_seq := 0
var atk_phase := 0              ## 0 preparo, 1 segurando (aviso), 2 golpe
var atk_t := 0.0
var hold_t := 0.0
var lunge_speed := 0.0
var hit_players: Array = []
var prev_seg: Array[Vector3] = []
var has_prev := false
var aoe_done := false
var circle_dir := 1.0
var circle_time := 0.0
var stun_t := 0.0
var recent_stuns := 0
var stun_window := 0.0
var guard_t := 0.0
var stagger_t := 0.0
var recover_t := 0.0
var dissolve := 0.0
var reward := 60
var uid := 0
var is_puppet := false
var net_anim := "idle"
var net_anim_seq := 0
var _net_pos := Vector3.ZERO
var _net_has := false
var _last_atk_seq := -1
var _returning_in := false


func _ready() -> void:
	team = TEAM_ENEMY
	display_name = "Sentinela"
	radius = 0.4
	height = 1.9
	max_hp = 150.0
	hp = max_hp
	max_posture = 100.0
	collision_layer = Game.L_ENEMY
	collision_mask = Game.L_WORLD | Game.L_PLAYER | Game.L_ENEMY
	floor_snap_length = 0.3
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = radius
	cap.height = height
	cs.shape = cap
	cs.position.y = height * 0.5
	add_child(cs)
	visual = Humanoid.new()
	visual.name = "Visual"
	add_child(visual)
	visual.setup("sentinel", "sentinel_blade")
	visual.scale = Vector3.ONE * 1.08
	visual.trail_color = Color(1.0, 0.55, 0.6)
	add_to_group(&"enemies")
	spawn_pos = global_position
	facing = spawn_yaw
	visual.rotation.y = facing


func forward_dir() -> Vector3:
	return Vector3(-sin(facing), 0.0, -cos(facing))


func is_staggered() -> bool:
	return state == St.STAGGER and stagger_t > 0.15


func anim(clip: String, blend: float = 0.15, speed: float = 1.0, restart: bool = false) -> void:
	if clip != net_anim or restart:
		net_anim_seq += 1
	net_anim = clip
	visual.play(clip, blend, speed, restart)


func set_state(s: int) -> void:
	state = s
	state_time = 0.0


func face_to(pos: Vector3, rate: float, delta: float) -> void:
	var d := Geo.flat_dir(global_position, pos)
	if d == Vector3.ZERO:
		return
	facing = lerp_angle(facing, atan2(-d.x, -d.z), 1.0 - exp(-rate * delta))


func _pick_target() -> Node3D:
	var best: Node3D = null
	var bd := 1e9
	for pl: Node in get_tree().get_nodes_in_group(&"players"):
		if not pl.alive:
			continue
		var d: float = pl.global_position.distance_to(global_position)
		if d < bd:
			bd = d
			best = pl
	return best if bd < 24.0 else null


# =============================================================================== laço

func _physics_process(delta: float) -> void:
	if is_puppet:
		_puppet(delta)
		_check_attack_hits()
		return
	tick_status(delta)
	if hitstop > 0.0:
		return
	state_time += delta
	if stun_window > 0.0:
		stun_window -= delta
		if stun_window <= 0.0:
			recent_stuns = 0
	if target == null or not is_instance_valid(target) or not target.alive:
		target = _pick_target()
	match state:
		St.IDLE:
			_st_idle(delta)
		St.CHASE:
			_st_chase(delta)
		St.CIRCLE:
			_st_circle(delta)
		St.ATTACK:
			_st_attack(delta)
		St.RECOVER:
			_st_recover(delta)
		St.HIT:
			_st_hit(delta)
		St.GUARD:
			_st_guard(delta)
		St.STAGGER:
			_st_stagger(delta)
		St.DEAD:
			_st_dead(delta)
		St.RETURN:
			_st_return(delta)
	if state != St.RETURN:
		if is_on_floor():
			if velocity.y < 0.0:
				velocity.y = -1.5
		else:
			velocity.y = maxf(velocity.y - GRAVITY * delta, -40.0)
		var kv := knock
		velocity += kv
		move_and_slide()
		velocity -= kv
	_check_attack_hits()
	visual.rotation.y = facing
	visual.owner_velocity = velocity
	visual.set_wet(clampf(wet / 3.0, 0.0, 1.0))
	# caiu na água ou foi longe demais: volta ao posto
	if alive and state != St.RETURN and (Tide.depth_at(global_position) > 1.1 or global_position.distance_to(spawn_pos) > 34.0):
		_begin_return()


func _stop(delta: float) -> void:
	velocity.x = move_toward(velocity.x, 0.0, 40.0 * delta)
	velocity.z = move_toward(velocity.z, 0.0, 40.0 * delta)


func _st_idle(delta: float) -> void:
	_stop(delta)
	anim("idle", 0.25)
	if target == null:
		return
	var dist := global_position.distance_to(target.global_position)
	if mode == "trainer":
		if dist < 5.0:
			face_to(target.global_position, 6.0, delta)
			anim("guard_idle", 0.25)
			if state_time > 1.5 and dist < 4.2:
				pattern = ["slash"]
				pattern_i = 0
				_start_attack()
		return
	if dist < 16.0:
		set_state(St.CHASE)


func _st_chase(delta: float) -> void:
	if target == null:
		set_state(St.IDLE)
		return
	var to := Geo.flat(target.global_position - global_position)
	var dist := to.length()
	face_to(target.global_position, 9.0, delta)
	var dir := to.normalized() if dist > 0.01 else forward_dir()
	velocity.x = move_toward(velocity.x, dir.x * RUN_SPEED, 30.0 * delta)
	velocity.z = move_toward(velocity.z, dir.z * RUN_SPEED, 30.0 * delta)
	anim("run", 0.18, 0.85)
	if dist > 30.0:
		_begin_return()
		return
	if dist < 5.6 and state_time > 0.25:
		if dist < 3.1:
			if randf() < 0.35:
				circle_dir = 1.0 if randf() < 0.5 else -1.0
				circle_time = randf_range(0.7, 1.6)
				set_state(St.CIRCLE)
			else:
				pattern = PATTERNS_NEAR[randi() % PATTERNS_NEAR.size()]
				pattern_i = 0
				_start_attack()
		elif randf() < delta * 2.2:
			pattern = PATTERNS_FAR[randi() % PATTERNS_FAR.size()]
			pattern_i = 0
			_start_attack()


func _st_circle(delta: float) -> void:
	if target == null:
		set_state(St.IDLE)
		return
	var to := Geo.flat(target.global_position - global_position)
	var dist := to.length()
	face_to(target.global_position, 10.0, delta)
	var radial := to.normalized() if dist > 0.01 else forward_dir()
	var tang := radial.cross(Vector3.UP) * circle_dir
	var want := tang * WALK_SPEED + radial * clampf(dist - 3.1, -1.0, 1.0) * 2.0
	velocity.x = move_toward(velocity.x, want.x, 20.0 * delta)
	velocity.z = move_toward(velocity.z, want.z, 20.0 * delta)
	anim("guard_right" if circle_dir < 0.0 else "guard_left", 0.2, 1.0)
	if state_time > circle_time or dist > 6.0:
		if dist > 4.2:
			set_state(St.CHASE)
		else:
			pattern = PATTERNS_NEAR[randi() % PATTERNS_NEAR.size()]
			pattern_i = 0
			_start_attack()


func _start_attack() -> void:
	atk_name = pattern[pattern_i]
	atk = ATTACKS[atk_name]
	atk_seq += 1
	atk_phase = 0
	atk_t = 0.0
	hit_players.clear()
	has_prev = false
	aoe_done = false
	set_state(St.ATTACK)
	visual.stop_upper(0.1)
	anim(atk["clip"], 0.12, 1.0, true)


func _st_attack(delta: float) -> void:
	_stop(delta)
	match atk_phase:
		0:
			atk_t += delta
			if target:
				face_to(target.global_position, 8.0, delta)
			if atk_t >= float(atk["wind"]):
				atk_phase = 1
				hold_t = float(atk["hold"]) * (1.5 if mode == "trainer" else 1.0)
				if pattern_i > 0:
					hold_t *= 0.6
				visual.set_speed(0.0)
				net_anim_seq += 0
				# aviso: brilho na lâmina (vermelho = não dá para defender)
				var tip: Vector3 = visual.weapon_segment()[1]
				var red: bool = atk.get("unblockable", false)
				Fx.burst("parry", tip, Vector3.UP, Color(1.0, 0.25, 0.2) if red else Color(1.0, 0.95, 0.8), 0.9)
				Fx.ring(tip, (Game.cam_rig.cam.global_position - tip) if Game.cam_rig else Vector3.UP, Color(1.0, 0.25, 0.2) if red else Color(1.0, 0.95, 0.85), 0.9, 0.3)
				Sfx.play_at("telegraph_red" if red else "telegraph", tip, -2.0)
		1:
			hold_t -= delta
			if target and hold_t > 0.1:
				face_to(target.global_position, 6.0, delta)
			if hold_t <= 0.0:
				atk_phase = 2
				visual.set_speed(1.0)
				var gap := 2.0
				if target:
					gap = Geo.flat(target.global_position - global_position).length() - 1.5
				lunge_speed = clampf(gap, 0.0, float(atk["lunge"])) / maxf(float(atk["a1"]) - float(atk["wind"]), 0.05)
				Sfx.play_at("swing_heavy" if atk.get("heavy", false) else "swing", global_position, -4.0, 0.9)
		2:
			atk_t += delta
			if atk_t < float(atk["a1"]):
				var f := forward_dir()
				velocity.x = f.x * lunge_speed
				velocity.z = f.z * lunge_speed
			var last := pattern_i >= pattern.size() - 1
			if atk_t >= float(atk["dur"] if last else atk["chain"]):
				if last:
					atk_name = ""
					recover_t = randf_range(0.5, 1.0) if mode != "trainer" else 0.4
					set_state(St.RECOVER)
				else:
					pattern_i += 1
					_start_attack()


func _st_recover(delta: float) -> void:
	_stop(delta)
	anim("guard_idle", 0.3)
	if target:
		face_to(target.global_position, 3.0, delta)
	if state_time >= recover_t:
		set_state(St.IDLE if mode == "trainer" else St.CHASE)


func _enter_hit(seconds: float, heavy: bool) -> void:
	atk_name = ""
	visual.set_speed(1.0)
	visual.stop_upper(0.1)
	stun_t = seconds
	recent_stuns += 1
	stun_window = 3.0
	set_state(St.HIT)
	anim("stagger" if heavy else "hit", 0.05, 1.0, true)


func _st_hit(delta: float) -> void:
	_stop(delta)
	stun_t -= delta
	if stun_t <= 0.0 and is_on_floor():
		if mode == "trainer":
			set_state(St.IDLE)
		elif recent_stuns >= 4:
			recent_stuns = 0
			guard_t = randf_range(1.1, 1.7)
			set_state(St.GUARD)
			anim("guard_idle", 0.12)
			visual.play_upper("block", 0.1)
		else:
			set_state(St.CHASE)


func _st_guard(delta: float) -> void:
	_stop(delta)
	if target:
		face_to(target.global_position, 12.0, delta)
	guard_t -= delta
	if guard_t <= 0.0:
		visual.stop_upper(0.1)
		pattern = ["backhand"]
		pattern_i = 0
		_start_attack()


func _on_posture_broken() -> void:
	super._on_posture_broken()
	if not alive or mode == "trainer":
		posture = 0.0
		return
	atk_name = ""
	visual.set_speed(1.0)
	visual.stop_upper(0.1)
	stagger_t = 3.6
	set_state(St.STAGGER)
	anim("stagger", 0.05, 1.0, true)
	Game.say("Postura quebrada — golpe crítico!", "good")
	Sfx.play_at("guard_break", center(), 0.0)
	Fx.ring(center(), Vector3.UP, Color(1.0, 0.85, 0.4), 2.6, 0.5)
	Fx.burst("parry", center(), Vector3.UP, Color(1.0, 0.85, 0.4), 1.3)


func _st_stagger(delta: float) -> void:
	_stop(delta)
	stagger_t -= delta
	if state_time > 0.55:
		anim("kneel", 0.3)
	if stagger_t <= 0.0:
		posture = 0.0
		set_state(St.RECOVER)
		recover_t = 0.6


func _begin_return() -> void:
	atk_name = ""
	visual.set_speed(1.0)
	visual.stop_upper(0.1)
	_returning_in = false
	set_state(St.RETURN)
	velocity = Vector3.ZERO
	knock = Vector3.ZERO


func _st_return(delta: float) -> void:
	if not _returning_in:
		dissolve = minf(dissolve + delta * 2.2, 1.0)
		visual.set_dissolve(dissolve)
		if dissolve >= 1.0:
			global_position = spawn_pos
			reset_physics_interpolation()
			facing = spawn_yaw
			hp = max_hp
			posture = 0.0
			wet = 0.0
			target = null
			_returning_in = true
			anim("idle", 0.0, 1.0, true)
	else:
		dissolve = maxf(dissolve - delta * 2.2, 0.0)
		visual.set_dissolve(dissolve)
		if dissolve <= 0.0:
			set_state(St.IDLE)


func _st_dead(delta: float) -> void:
	_stop(delta)
	if state_time > 0.9:
		dissolve = minf(dissolve + delta * 1.1, 1.0)
		visual.set_dissolve(dissolve)
	if state_time > 2.2:
		queue_free()


# =============================================================================== golpes recebidos

func receive_hit(hit: Dictionary) -> String:
	if not alive or state == St.RETURN or state == St.DEAD:
		return "immune"
	var from: Node = hit.get("from")
	if from and is_instance_valid(from) and from.is_in_group(&"players"):
		target = from
	var dmg: float = float(hit.get("damage", 0.0)) * element_factor(hit.get("element", ""))
	var heavy: bool = hit.get("heavy", false)
	var k: Vector3 = hit.get("knock", Vector3.ZERO)
	if wet > 0.0:
		k *= 1.4
	if mode == "trainer":
		visual.flash(1.0)
		damaged.emit(dmg, "hit")
		return "hit"
	var from_pos: Vector3 = hit.get("from_pos", global_position)
	var front := forward_dir().dot(Geo.flat_dir(global_position, from_pos)) > 0.1
	var kind: String = hit.get("kind", "")
	if state == St.GUARD and front and not hit.get("crit", false) and kind != "gust" and kind != "burst" and kind != "plunge":
		apply_damage(dmg * 0.2, hit)
		add_posture(float(hit.get("posture", 0.0)) * 0.6)
		knock += k * 0.3
		visual.play_upper("block_hit", 0.03)
		visual.play_upper("block", 0.2)
		Fx.burst("spark", center() + forward_dir() * 0.5, forward_dir(), Color(1.0, 0.95, 0.8), 1.0)
		damaged.emit(dmg * 0.2, "blocked")
		return "blocked"
	var was_staggered := state == St.STAGGER
	if was_staggered and not hit.get("crit", false):
		dmg *= 1.25
	visual.flash(1.0)
	var stop := 0.09 if heavy else 0.05
	hitstop = stop
	visual.hitstop(stop)
	apply_damage(dmg, hit)
	if not alive:
		knock += k
		return "hit"
	knock += k
	var launch: float = float(hit.get("launch", 0.0))
	if launch > 0.0:
		velocity.y = launch
	elif not is_on_floor():
		velocity.y = maxf(velocity.y, 3.2)
	if hit.get("element", "") == "water":
		set_wet(12.0)
	if was_staggered:
		if hit.get("crit", false):
			posture = 0.0
			stagger_t = 0.0
			_enter_hit(0.9, true)
			recent_stuns = 0
		return "hit"
	add_posture(float(hit.get("posture", 0.0)))
	if state == St.STAGGER:
		return "hit"
	var armored: bool = state == St.ATTACK and atk_phase >= 1 and atk.get("armor", false)
	if not armored or launch > 0.0:
		_enter_hit(0.62 if heavy else 0.36, heavy)
	return "hit"


func apply_damage(amount: float, hit: Dictionary = {}) -> void:
	super.apply_damage(amount, hit)


## O jogador aparou nosso golpe.
func on_parried(_by: Node, perfect: bool) -> void:
	if not alive or state == St.DEAD:
		return
	Fx.burst("spark", visual.weapon_segment()[1], Vector3.UP, Color(1.0, 0.9, 0.6), 1.2)
	if mode == "trainer":
		_enter_hit(0.7, true)
		recent_stuns = 0
		return
	add_posture(55.0 if perfect else 34.0)
	if state != St.STAGGER:
		_enter_hit(0.9 if perfect else 0.65, true)
		recent_stuns = 0


func die() -> void:
	if not alive:
		return
	super.die()
	atk_name = ""
	visual.set_speed(1.0)
	visual.stop_upper(0.1)
	collision_layer = 0
	collision_mask = Game.L_WORLD
	set_state(St.DEAD)
	anim("death", 0.08, 1.0, true)
	Sfx.play_at("enemy_death", center(), 0.0)
	if Game.stage:
		Game.stage.enemy_died(self)


# =============================================================================== acerto no jogador

## Roda em toda máquina: cada uma testa o golpe contra o SEU jogador (defesa justa na tela de quem defende).
func _check_attack_hits() -> void:
	if atk_name == "" or not ATTACKS.has(atk_name) or not alive:
		has_prev = false
		return
	if _last_atk_seq != atk_seq:
		_last_atk_seq = atk_seq
		hit_players.clear()
		aoe_done = false
		has_prev = false
	var a: Dictionary = ATTACKS[atk_name]
	if visual.current != a["clip"]:
		return
	var tc: float = visual.time_in_clip
	if tc < float(a["a0"]) or tc > float(a["a1"]):
		has_prev = false
		return
	var seg: Array[Vector3] = visual.weapon_segment()
	if not has_prev:
		prev_seg = seg
		has_prev = true
	var do_aoe: bool = a.has("aoe") and not aoe_done
	if do_aoe:
		aoe_done = true
		var c := global_position + forward_dir() * 1.2
		Fx.ring(c + Vector3.UP * 0.05, Vector3.UP, Color(1.0, 0.4, 0.4), float(a["aoe"]) * 1.3, 0.45)
		Fx.burst("shock", c, Vector3.UP, Color.WHITE, 1.3)
		Sfx.play_at("slam", c, 0.0)
		Fx.shake(0.3)
	for pl: Node in get_tree().get_nodes_in_group(&"players"):
		if not pl.is_local or not pl.alive or hit_players.has(pl):
			continue
		var touched := Geo.sweep_hits_capsule(prev_seg, seg, pl.capsule_segment(), 0.36 + pl.radius)
		if not touched and do_aoe:
			touched = pl.global_position.distance_to(global_position + forward_dir() * 1.2) < float(a["aoe"]) + pl.radius and absf(pl.global_position.y - global_position.y) < 1.4
		# investida colada no golpe conta como esquiva no tempo certo
		if not touched and pl.invulnerable > 0.0 and (pl.state == pl.St.DASH or pl.state == pl.St.BURST):
			touched = pl.global_position.distance_to(global_position) < float(a["range"]) + 1.2
		if touched:
			hit_players.append(pl)
			var dir := Geo.flat_dir(global_position, pl.global_position)
			if dir == Vector3.ZERO:
				dir = forward_dir()
			pl.receive_hit({"damage": float(a["dmg"]), "knock": dir * float(a["knock"]), "from": self, "from_pos": global_position,
				"unblockable": a.get("unblockable", false), "heavy": a.get("heavy", false), "kind": atk_name})
	prev_seg = seg


# =============================================================================== co-op (boneco)

func net_state() -> Array:
	return [global_position, facing, net_anim, net_anim_seq, visual.speed_scale, visual.current_upper if visual._upper_target > 0.5 else "", hp, posture, state, atk_name, atk_seq, dissolve, wet > 0.0, stagger_t]


func apply_net_state(s: Array) -> void:
	_net_pos = s[0]
	if not _net_has:
		global_position = _net_pos
		_net_has = true
	facing = s[1]
	if int(s[3]) != net_anim_seq or String(s[2]) != net_anim:
		net_anim_seq = int(s[3])
		net_anim = s[2]
		visual.play(net_anim, 0.12, float(s[4]), true)
	else:
		visual.set_speed(float(s[4]))
	var up: String = s[5]
	if up == "":
		visual.stop_upper(0.12)
	else:
		visual.play_upper(up, 0.1)
	hp = float(s[6])
	posture = float(s[7])
	var new_state := int(s[8])
	if new_state == St.DEAD and alive:
		alive = false
		collision_layer = 0
	state = new_state
	atk_name = s[9]
	atk_seq = int(s[10])
	dissolve = float(s[11])
	visual.set_dissolve(dissolve)
	wet = 3.0 if bool(s[12]) else 0.0
	stagger_t = float(s[13])


func _puppet(delta: float) -> void:
	if _net_has:
		var prev := global_position
		global_position = global_position.lerp(_net_pos, 1.0 - exp(-16.0 * delta))
		velocity = (global_position - prev) / maxf(delta, 0.0001)
	visual.rotation.y = lerp_angle(visual.rotation.y, facing, 1.0 - exp(-16.0 * delta))
	visual.owner_velocity = velocity
	visual.set_wet(clampf(wet / 3.0, 0.0, 1.0))
