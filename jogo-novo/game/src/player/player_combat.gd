extends RefCounted
## Combate do jogador: combos leves/pesados, ataques no ar, carga, defesa e parry,
## trava de alvo, contador de combo e habilidades de Vento/Água.

const Geo := preload("res://src/core/geo.gd")
const Items := preload("res://src/player/items.gd")

const PARRY_WINDOW := 0.17
const PERFECT_WINDOW := 0.085
const COMBO_TIMEOUT := 3.2
const STEP_REACH := 5.2
const RIPOSTE_WINDOW := 0.9
const RANKS := [[3, "Brisa"], [8, "Rajada"], [15, "Ventania"], [25, "Vendaval"], [40, "Tempestade"], [60, "Furacão"]]

## Golpes. Tempos em segundos do clipe (velocidade 1): a0-a1 = janela que acerta; combo = quando o próximo pode sair.
const MOVES := {
	"l1": {"clip": "atk_l1", "dur": 0.5, "a0": 0.12, "a1": 0.22, "combo": 0.24, "dmg": 13.0, "post": 10.0, "stam": 8.0, "lunge": 2.4, "l0": 0.02, "l1": 0.2, "stop": 0.045, "knock": 2.5, "next_l": "l2", "next_h": "spin"},
	"l2": {"clip": "atk_l2", "dur": 0.48, "a0": 0.1, "a1": 0.21, "combo": 0.23, "dmg": 14.0, "post": 10.0, "stam": 8.0, "lunge": 2.0, "l0": 0.03, "l1": 0.19, "stop": 0.045, "knock": 2.5, "next_l": "l3", "next_h": "launch"},
	"l3": {"clip": "atk_l3", "dur": 0.5, "a0": 0.11, "a1": 0.22, "combo": 0.24, "dmg": 16.0, "post": 12.0, "stam": 9.0, "lunge": 2.0, "l0": 0.04, "l1": 0.2, "stop": 0.05, "knock": 3.0, "next_l": "l4", "next_h": "thrust"},
	"l4": {"clip": "atk_l4", "dur": 0.8, "a0": 0.24, "a1": 0.32, "combo": 0.52, "dmg": 30.0, "post": 28.0, "stam": 14.0, "lunge": 2.6, "l0": 0.1, "l1": 0.28, "stop": 0.1, "knock": 7.0, "aoe": 2.3, "heavy": true, "next_l": "l1", "next_h": "h1"},
	"h1": {"clip": "atk_h1", "dur": 0.78, "a0": 0.3, "a1": 0.43, "combo": 0.5, "dmg": 32.0, "post": 30.0, "stam": 18.0, "lunge": 3.0, "l0": 0.24, "l1": 0.38, "stop": 0.09, "knock": 8.0, "hold": 0.22, "heavy": true, "next_l": "l1", "next_h": "h1"},
	"spin": {"clip": "atk_spin", "dur": 0.7, "a0": 0.2, "a1": 0.5, "combo": 0.52, "dmg": 24.0, "post": 22.0, "stam": 16.0, "lunge": 1.5, "l0": 0.1, "l1": 0.4, "stop": 0.06, "knock": 7.0, "heavy": true, "around": 2.4, "next_l": "l1", "next_h": "h1"},
	"launch": {"clip": "atk_launch", "dur": 0.66, "a0": 0.16, "a1": 0.28, "combo": 0.34, "dmg": 20.0, "post": 18.0, "stam": 15.0, "lunge": 1.6, "l0": 0.08, "l1": 0.24, "stop": 0.07, "knock": 1.0, "launch": 10.5, "heavy": true, "next_l": "l1", "next_h": "h1"},
	"thrust": {"clip": "atk_thrust", "dur": 0.62, "a0": 0.14, "a1": 0.27, "combo": 0.36, "dmg": 26.0, "post": 24.0, "stam": 15.0, "lunge": 4.6, "l0": 0.08, "l1": 0.2, "stop": 0.08, "knock": 9.0, "heavy": true, "next_l": "l1", "next_h": "h1"},
	"dash": {"clip": "atk_thrust", "from": 0.07, "dur": 0.6, "a0": 0.12, "a1": 0.27, "combo": 0.36, "dmg": 22.0, "post": 18.0, "stam": 12.0, "lunge": 5.4, "l0": 0.07, "l1": 0.2, "stop": 0.07, "knock": 8.0, "heavy": true, "next_l": "l2", "next_h": "h1"},
	"air1": {"clip": "atk_air1", "dur": 0.42, "a0": 0.1, "a1": 0.22, "combo": 0.22, "dmg": 12.0, "post": 8.0, "stam": 7.0, "air": true, "lunge": 2.2, "l0": 0.02, "l1": 0.18, "stop": 0.04, "knock": 1.5, "next_l": "air2", "next_h": "plunge"},
	"air2": {"clip": "atk_air2", "dur": 0.42, "a0": 0.09, "a1": 0.22, "combo": 0.22, "dmg": 14.0, "post": 8.0, "stam": 7.0, "air": true, "lunge": 2.2, "l0": 0.02, "l1": 0.18, "stop": 0.04, "knock": 1.5, "next_l": "air1", "next_h": "plunge"},
	"crit": {"clip": "atk_crit", "dur": 1.05, "a0": 0.3, "a1": 0.37, "combo": 0.9, "dmg": 75.0, "post": 0.0, "stam": 0.0, "lunge": 3.5, "l0": 0.2, "l1": 0.32, "stop": 0.16, "knock": 9.0, "heavy": true, "crit": true, "next_l": "l1", "next_h": "h1"},
	"riposte": {"clip": "atk_thrust", "from": 0.1, "dur": 0.56, "a0": 0.13, "a1": 0.27, "combo": 0.32, "dmg": 24.0, "post": 40.0, "stam": 0.0, "lunge": 3.8, "l0": 0.1, "l1": 0.2, "stop": 0.1, "knock": 6.0, "heavy": true, "next_l": "l2", "next_h": "h1"},
	"kick": {"clip": "atk_kick", "dur": 0.52, "a0": 0.13, "a1": 0.25, "combo": 0.34, "dmg": 14.0, "post": 20.0, "stam": 12.0, "lunge": 1.8, "l0": 0.04, "l1": 0.15, "stop": 0.09, "knock": 18.0, "heavy": true, "body": 2.2, "push": true, "next_l": "l1", "next_h": "h1"},
	"sweep": {"clip": "atk_sweep", "dur": 0.6, "a0": 0.13, "a1": 0.36, "combo": 0.44, "dmg": 12.0, "post": 26.0, "stam": 12.0, "lunge": 1.2, "l0": 0.04, "l1": 0.2, "stop": 0.06, "knock": 2.0, "heavy": true, "body": 2.5, "around": 2.5, "trip": true, "next_l": "l1", "next_h": "h1"},
	"throw": {"clip": "atk_throw", "dur": 0.78, "a0": 0.4, "a1": 0.46, "combo": 0.62, "dmg": 30.0, "post": 0.0, "stam": 0.0, "lunge": 3.2, "l0": 0.03, "l1": 0.15, "stop": 0.12, "knock": 17.0, "launch": 6.5, "heavy": true, "body": 3.0, "throw": true, "crit": true, "next_l": "l1", "next_h": "h1"},
	"cast": {"clip": "cast", "dur": 0.55, "a0": 0.22, "a1": 0.22, "combo": 0.4, "dmg": 0.0, "post": 0.0, "stam": 0.0, "skill": true, "next_l": "l1", "next_h": "h1"},
}

var p: Node3D
var move_id := ""
var move: Dictionary = {}
var t := 0.0
var speed := 1.0
var hit_list: Array = []
var prev_seg: Array[Vector3] = []
var has_prev := false
var hit_any := false
var assist_done := false
var aoe_done := false
var charging := false
var charge := 0.0
var charge_mult := 1.0
var lunge_dir := Vector3.FORWARD
var lunge_speed := 0.0
var target: Node3D
var air_combo := 0
var plunge_phase := 0          ## 0 nenhum, 1 preparando, 2 caindo, 3 impacto
var block_time := 10.0
var dodge_rewarded := false
var combo_hits := 0
var combo_damage := 0.0
var combo_timer := 0.0
var combo_best := 0
var skill: Dictionary = {}
var skill_done := false
var pending_item: Dictionary = {}
var launch_jump := false
var riposte_t := 0.0           ## janela de contra-ataque depois de um parry
var throw_dir := Vector3.FORWARD
var lunge_end := 0.0


func setup(player: Node3D) -> void:
	p = player


func weapon_stats() -> Dictionary:
	return Items.WEAPONS.get(p.weapon_id, Items.WEAPONS["sword"])


# =============================================================================== entrada

## Tenta executar a ação guardada (ataque leve/pesado). Devolve true se começou um golpe.
func try_buffered() -> bool:
	if p.buffer_time <= 0.0:
		return false
	var kind: String = p.buffer_action
	if kind != "light" and kind != "heavy":
		return false
	var id := _pick_move(kind)
	if id == "":
		return false
	if id == "plunge":
		p.buffer_action = ""
		_start_plunge()
		return true
	if p.stamina <= 0.0 and float(MOVES[id]["stam"]) > 0.0:
		return false
	p.buffer_action = ""
	start(id)
	return true


func _pick_move(kind: String) -> String:
	var St: Dictionary = p.St
	if p.state == St.ATTACK:
		if plunge_phase != 0 or t < float(move.get("combo", 99.0)):
			return ""
		var nxt: String = move.get("next_l" if kind == "light" else "next_h", "")
		if move.get("air", false) or not p.is_on_floor():
			if nxt == "plunge":
				return "plunge"
			if air_combo >= 3:
				return ""
			return nxt if MOVES.has(nxt) and MOVES[nxt].get("air", false) else ("air1" if kind == "light" else "plunge")
		# no meio do combo: inimigo aberto vira finalização; agachado vira rasteira/chute
		var open_enemy := _staggered_near()
		if open_enemy:
			target = open_enemy
			return "crit" if kind == "light" else "throw"
		if p.held(&"crouch"):
			return "sweep" if kind == "light" else "kick"
		return nxt
	if not p.is_on_floor() and p.state != St.SLIDE and p.coyote <= 0.0:
		if kind == "heavy":
			return "plunge"
		return "air1" if air_combo < 3 else ""
	var st := _staggered_near()
	if st:
		# inimigo aberto: leve = golpe crítico, pesado = arremesso
		target = st
		return "crit" if kind == "light" else "throw"
	if kind == "light" and riposte_t > 0.0:
		return "riposte"
	if p.state == St.SLIDE:
		return "dash" if kind == "light" else "sweep"
	if p.held(&"crouch") and p.is_on_floor():
		return "sweep" if kind == "light" else "kick"
	if p.state == St.DASH or (p.sprinting and p.horizontal_speed() > 8.5):
		return "dash"
	return "l1" if kind == "light" else "h1"


func _staggered_near() -> Node3D:
	for a: Node in p.get_tree().get_nodes_in_group(&"actors"):
		if a != p and a.alive and a.is_enemy_of(p) and a.has_method("is_staggered") and a.is_staggered():
			var d: Vector3 = a.global_position - p.global_position
			if d.length() < 3.4 and Geo.flat(d).normalized().dot(p.forward_dir()) > 0.1:
				return a
	return null


# =============================================================================== golpes

func start(id: String) -> void:
	var St: Dictionary = p.St
	var was_attacking: bool = p.state == St.ATTACK
	move_id = id
	move = MOVES[id]
	var ws := weapon_stats()
	speed = float(ws["speed"]) if not move.get("skill", false) else 1.0
	t = float(move.get("from", 0.0))
	hit_list.clear()
	has_prev = false
	hit_any = false
	assist_done = false
	aoe_done = false
	charging = false
	charge = 0.0
	charge_mult = 1.0
	plunge_phase = 0
	launch_jump = false
	skill_done = false
	if move.get("air", false):
		air_combo += 1
	p.spend_stamina(float(move["stam"]) * float(ws["stam"]))
	p.anim_upper("")
	p.set_state(St.ATTACK)
	# mira: alvo travado, senão o inimigo mais à frente
	if id != "crit" and id != "throw":
		target = _find_target()
	riposte_t = 0.0
	var dir: Vector3 = p.forward_dir()
	if target and is_instance_valid(target):
		dir = Geo.flat_dir(p.global_position, target.global_position)
	elif p.wish_dir.length() > 0.2:
		dir = p.wish_dir.normalized()
	elif p.cam_rig and p.cam_rig.first_person:
		dir = p.cam_rig.flat_forward()
	if dir == Vector3.ZERO:
		dir = p.forward_dir()
	lunge_dir = dir
	p.face_dir(dir, 0.0, 0.0)
	var lunge: float = float(move.get("lunge", 0.0)) * float(ws["lunge"])
	var window: float = maxf(float(move.get("l1", 0.2)) - float(move.get("l0", 0.0)), 0.02)
	var dist := lunge * 0.55
	if target and is_instance_valid(target):
		var gap: float = Geo.flat(target.global_position - p.global_position).length() - (1.25 + target.radius)
		# passo de vento: se o alvo escolhido está um pouco além do alcance, o golpe fecha a distância
		var reach := lunge
		if gap > lunge and gap < STEP_REACH and not move.get("air", false) and p.is_on_floor():
			# chega no alvo antes de a janela do golpe abrir
			reach = gap
			window = maxf(float(move["a0"]) + 0.03 - float(move.get("l0", 0.0)), 0.06)
			Fx.burst("dash", p.center(), -dir, Color(0.85, 1.0, 0.98), 0.8)
		dist = clampf(gap, 0.0, reach)
	lunge_speed = dist / window * speed
	lunge_end = float(move.get("l0", 0.0)) + window
	throw_dir = p.wish_dir.normalized() if p.wish_dir.length() > 0.3 else dir
	if move.has("from"):
		p.visual.play_from(move["clip"], move["from"], 0.06, speed)
		p.net_anim = move["clip"]
		p.net_anim_seq += 1
	else:
		p.anim(move["clip"], 0.07 if was_attacking else 0.05, speed, true)
	if id == "crit" or id == "throw":
		p.invulnerable = maxf(p.invulnerable, 1.0)
	Sfx.play_at("swing_heavy" if move.get("heavy", false) else "swing", p.global_position, -6.0, 1.0 / maxf(speed, 0.5))


func _find_target() -> Node3D:
	if p.lock_target and is_instance_valid(p.lock_target) and p.lock_target.alive:
		return p.lock_target
	var want: Vector3 = p.wish_dir.normalized() if p.wish_dir.length() > 0.2 else p.forward_dir()
	if p.cam_rig and p.wish_dir.length() <= 0.2:
		want = (want + p.cam_rig.flat_forward()).normalized()
	var best: Node3D = null
	var best_score := -1e9
	for a: Node in p.get_tree().get_nodes_in_group(&"actors"):
		if a == p or not a.alive or not a.is_enemy_of(p):
			continue
		var d: Vector3 = a.global_position - p.global_position
		var dist := Geo.flat(d).length()
		if dist > 6.5 or absf(d.y) > 3.5:
			continue
		var dot := Geo.flat(d).normalized().dot(want) if dist > 0.3 else 1.0
		if dot < 0.25:
			continue
		var score := dot * 3.0 - dist * 0.45
		if score > best_score:
			best_score = score
			best = a
	return best


func abort() -> void:
	move_id = ""
	charging = false
	plunge_phase = 0


func physics(delta: float) -> void:
	var St: Dictionary = p.St
	if plunge_phase != 0:
		_plunge(delta)
		return
	var on_floor: bool = p.is_on_floor()
	# carga do golpe pesado: segura na pose de preparo
	if charging:
		charge = minf(charge + delta / 0.9, 1.0)
		p.velocity.x = move_toward(p.velocity.x, 0.0, 60.0 * delta)
		p.velocity.z = move_toward(p.velocity.z, 0.0, 60.0 * delta)
		p.velocity.y = -1.5 if on_floor else p.velocity.y - p.GRAVITY * delta
		_track_target(delta, 8.0)
		if int(p.state_time * 10.0) != int((p.state_time - delta) * 10.0):
			Fx.burst("gather", p.visual.weapon_segment()[1], Vector3.UP, weapon_stats()["color"], 0.5 + charge)
		if not p.held(&"attack_heavy") or charge >= 1.0 and p.state_time > 1.4:
			charging = false
			charge_mult = 1.0 + charge * 0.9
			p.visual.play_from(move["clip"], move["hold"], 0.05, speed)
			p.net_anim = move["clip"]
			p.net_anim_seq += 1
			t = float(move["hold"])
			if charge > 0.6:
				Sfx.play_at("burst", p.global_position, -6.0, 1.2)
		return
	var prev_t := t
	t += delta * speed
	if move.has("hold") and prev_t < float(move["hold"]) and t >= float(move["hold"]) and p.held(&"attack_heavy"):
		charging = true
		charge = 0.0
		p.anim("atk_charge", 0.08, 1.0, true)
		Sfx.play_at("charge", p.global_position, -8.0)
		return
	# movimento do golpe
	var l0 := float(move.get("l0", 0.0))
	var l1 := lunge_end
	if t < float(move["a0"]):
		_track_target(delta, 12.0)
	var hv := Vector3.ZERO
	if t >= l0 and t <= l1:
		hv = lunge_dir * lunge_speed
		if target and is_instance_valid(target):
			var gap: float = Geo.flat(target.global_position - p.global_position).length() - (1.1 + target.radius)
			if gap <= 0.0:
				hv = Vector3.ZERO
	if hv != Vector3.ZERO:
		p.velocity.x = hv.x
		p.velocity.z = hv.z
	else:
		p.velocity.x = move_toward(p.velocity.x, 0.0, 160.0 * delta)
		p.velocity.z = move_toward(p.velocity.z, 0.0, 160.0 * delta)
	if move.get("air", false) or not on_floor:
		# golpes no ar seguram a queda
		if move.get("air", false) and air_combo <= 3:
			p.velocity.y = maxf(p.velocity.y - p.GRAVITY * 0.22 * delta, -2.2)
			if p.velocity.y > 3.0:
				p.velocity.y = lerpf(p.velocity.y, 3.0, 1.0 - exp(-10.0 * delta))
		else:
			p.velocity.y = maxf(p.velocity.y - p.GRAVITY * delta, -p.TERMINAL)
	else:
		p.velocity.y = -1.5
	if move.get("skill", false):
		if not skill_done and t >= float(move["a0"]):
			skill_done = true
			_fire_skill()
	else:
		_hit_window(prev_t)
	# lançador: segurar pulo para subir junto
	if move_id == "launch" and hit_any and not launch_jump and t > 0.26 and p.held(&"jump"):
		launch_jump = true
		p.velocity.y = 10.6
		p.jumps_left = 1
		p.air_dashes_left = 1
		air_combo = 0
		move_id = ""
		p.set_state(St.AIR)
		p.anim("jump", 0.1, 1.0, true)
		return
	# cancelamentos e encadeamento
	if t >= float(move["combo"]):
		if try_buffered():
			return
		if p.take_buffer("dash"):
			_end()
			if p._try_dash():
				return
		if p.held(&"block") and on_floor and t >= float(move["combo"]) + 0.04:
			_end()
			p._enter_block()
			return
	if p.jump_buffer > 0.0 and (hit_any or t >= float(move["a1"])) and t >= float(move["a1"]) and not move.get("crit", false):
		if on_floor or p.jumps_left > 0:
			_end()
			if on_floor:
				p._jump()
			else:
				p._double_jump()
			return
	if t >= float(move["dur"]) or (move.get("air", false) and on_floor and t > float(move["a1"])):
		_end()


func _end() -> void:
	var St: Dictionary = p.St
	move_id = ""
	charging = false
	if p.is_on_floor():
		air_combo = 0
		p.set_state(St.GROUND)
	else:
		p.set_state(St.AIR)
		p.anim("fall", 0.25)


func _track_target(delta: float, rate: float) -> void:
	if target and is_instance_valid(target) and target.alive:
		var dir := Geo.flat_dir(p.global_position, target.global_position)
		if dir != Vector3.ZERO:
			lunge_dir = dir
			p.face_dir(dir, rate, delta)
	elif p.cam_rig and p.cam_rig.first_person:
		lunge_dir = p.cam_rig.flat_forward()
		p.face_dir(lunge_dir, rate, delta)


func _hit_window(prev_t: float) -> void:
	var a0 := float(move["a0"])
	var a1 := float(move["a1"])
	var seg: Array[Vector3] = p.visual.weapon_segment()
	if t < a0 or prev_t > a1:
		has_prev = false
		return
	var ws := weapon_stats()
	var reach: float = float(ws["reach"])
	if not has_prev:
		prev_seg = seg
		has_prev = true
	var mid := (a0 + a1) * 0.5
	var do_assist := not assist_done and t >= mid
	if do_assist:
		assist_done = true
	var do_aoe: bool = move.has("aoe") and not aoe_done
	if do_aoe:
		aoe_done = true
		var c: Vector3 = p.global_position + p.forward_dir() * 1.1
		Fx.ring(c + Vector3.UP * 0.05, Vector3.UP, ws["color"], float(move["aoe"]) * 1.25, 0.4)
		Fx.burst("shock", c, Vector3.UP, Color.WHITE, 1.2)
		Fx.shake(0.4)
		Sfx.play_at("slam", c, 0.0)
	for a: Node in p.get_tree().get_nodes_in_group(&"actors"):
		if a == p or not a.alive or not a.is_enemy_of(p) or hit_list.has(a):
			continue
		var d: Vector3 = a.global_position - p.global_position
		if d.length() > 7.0:
			continue
		var hit := false
		if move.has("body"):
			var fb := Geo.flat(d)
			var body_range: float = float(move["body"]) + a.radius
			var in_arc: bool = move.has("around") or fb.length() < 0.6 or fb.normalized().dot(p.forward_dir()) > 0.35
			hit = fb.length() < body_range and in_arc and absf(d.y) < 1.7
			if move.get("throw", false):
				hit = hit and a == target
		else:
			hit = Geo.sweep_hits_capsule(prev_seg, seg, a.capsule_segment(), reach + a.radius)
		if not hit and do_assist and not move.has("body"):
			# ajuda de mira: quem está bem na frente e ao alcance leva o golpe
			var fl := Geo.flat(d)
			var range_ok: bool = fl.length() < 1.9 + a.radius + (float(p.visual.WEAPON_LENGTH.get(p.weapon_id, 1.0)) - 1.0)
			var arc_ok: bool = move.has("around") or fl.length() < 0.5 or fl.normalized().dot(p.forward_dir()) > 0.45
			hit = range_ok and arc_ok and absf(d.y) < 1.9
		if not hit and do_aoe:
			hit = (a.global_position - (p.global_position + p.forward_dir() * 1.1)).length() < float(move["aoe"]) + a.radius
		if hit:
			_apply_hit(a)
	prev_seg = seg


func _apply_hit(a: Node3D) -> void:
	hit_list.append(a)
	var ws := weapon_stats()
	var bonus := 1.0 + minf(float(combo_hits), 50.0) * 0.005
	var dmg: float = float(move["dmg"]) * float(ws["dmg"]) * charge_mult * bonus
	var dir := Geo.flat_dir(p.global_position, a.global_position)
	if dir == Vector3.ZERO:
		dir = p.forward_dir()
	if move.get("throw", false):
		dir = throw_dir
	var hit := {
		"damage": dmg, "posture": float(move["post"]) * float(ws["posture"]) * charge_mult,
		"knock": dir * float(move["knock"]), "launch": float(move.get("launch", 0.0)),
		"from": p, "from_pos": p.global_position, "kind": move_id, "crit": move.get("crit", false),
		"heavy": move.get("heavy", false), "trip": move.get("trip", false), "push": move.get("push", false),
		"throw": move.get("throw", false),
	}
	var res: String = Net.deal_hit(a, hit)
	if res == "immune" or res == "dodged":
		return
	hit_any = true
	var heavy: bool = move.get("heavy", false)
	var stop: float = float(move["stop"]) * (1.25 if charge_mult > 1.3 else 1.0)
	p.hitstop = stop
	p.visual.hitstop(stop)
	var at: Vector3 = a.center()
	at = at.lerp(p.visual.weapon_segment()[1], 0.35)
	Fx.burst("hit_heavy" if heavy else "hit", at, dir, ws["color"], 1.0 + (charge_mult - 1.0))
	Fx.shake(0.22 if heavy else 0.1)
	if res == "blocked":
		Sfx.play_at("block", at, -3.0)
		Fx.number(a.head_pos(), dmg * 0.2, "block")
	else:
		Sfx.play_at("hit_heavy" if heavy else "hit", at, -2.0)
		register_hit(dmg, a.head_pos(), move.get("crit", false))
	p.gain_breath(3.0 if not heavy else 5.0)
	if move.get("crit", false):
		# finalização: recupera um pouco de vida, como recompensa por quebrar a postura
		p.heal(12.0)
		Fx.number(p.head_pos(), 12.0, "heal")
		Fx.ring(at, Vector3.UP, Color(1.0, 0.85, 0.4), 3.2, 0.45)
		Game.slowmo(0.3, 0.25)
		if p.cam_rig:
			p.cam_rig.kick_fov(-8.0 if false else 6.0)
	if charge_mult > 1.5:
		Fx.ring(at, dir, ws["color"], 3.0, 0.4)


# =============================================================================== mergulho (ataque pesado no ar)

func _start_plunge() -> void:
	var St: Dictionary = p.St
	move_id = "plunge"
	move = {"dmg": 30.0, "post": 30.0, "knock": 7.0, "heavy": true, "stop": 0.1}
	plunge_phase = 1
	t = 0.0
	hit_list.clear()
	hit_any = false
	charge_mult = 1.0
	target = _find_target()
	p.spend_stamina(14.0 * float(weapon_stats()["stam"]))
	p.anim_upper("")
	p.set_state(St.ATTACK)
	p.anim("atk_plunge_start", 0.06, 1.0, true)
	Sfx.play_at("swing_heavy", p.global_position, -5.0, 0.9)


func _plunge(delta: float) -> void:
	var St: Dictionary = p.St
	t += delta
	match plunge_phase:
		1:
			p.velocity = p.velocity.move_toward(Vector3(0, 1.5, 0), 60.0 * delta)
			if target and is_instance_valid(target):
				p.face_dir(Geo.flat_dir(p.global_position, target.global_position), 12.0, delta)
			if t >= 0.24:
				plunge_phase = 2
				t = 0.0
				p.anim("atk_plunge_loop", 0.08)
		2:
			var hv := Vector3.ZERO
			if target and is_instance_valid(target):
				var to := Geo.flat(target.global_position - p.global_position)
				if to.length() > 0.5:
					hv = to.normalized() * minf(to.length() * 6.0, 9.0)
			p.velocity = Vector3(hv.x, -36.0, hv.z)
			if int(t * 20.0) != int((t - delta) * 20.0):
				Fx.burst("streak", p.center() + Vector3.UP, Vector3.UP, weapon_stats()["color"], 1.0)
			if p.is_on_floor() or p.water_depth() > 0.5:
				_plunge_impact()
		3:
			p.velocity.x = move_toward(p.velocity.x, 0.0, 80.0 * delta)
			p.velocity.z = move_toward(p.velocity.z, 0.0, 80.0 * delta)
			p.velocity.y = -1.5 if p.is_on_floor() else p.velocity.y - p.GRAVITY * delta
			if t > 0.34 and (try_buffered() or p.take_buffer("dash") and p._try_dash()):
				return
			if t >= 0.62:
				plunge_phase = 0
				_end()


func _plunge_impact() -> void:
	plunge_phase = 3
	t = 0.0
	air_combo = 0
	p.anim("atk_plunge_land", 0.04, 1.0, true)
	var c: Vector3 = p.global_position
	var ws := weapon_stats()
	Fx.ring(c + Vector3.UP * 0.05, Vector3.UP, ws["color"], 3.6, 0.45)
	Fx.burst("shock", c, Vector3.UP, Color.WHITE, 1.6)
	Fx.shake(0.55)
	Sfx.play_at("slam", c, 2.0)
	if p.cam_rig:
		p.cam_rig.kick_fov(6.0)
	for a: Node in p.get_tree().get_nodes_in_group(&"actors"):
		if a == p or not a.alive or not a.is_enemy_of(p):
			continue
		var d: Vector3 = a.global_position - c
		if d.length() < 2.9 + a.radius and absf(d.y) < 2.2:
			move["launch"] = 5.0
			_apply_hit(a)


# =============================================================================== defesa

func block_started() -> void:
	block_time = 0.0


func tick(delta: float) -> void:
	block_time += delta
	if riposte_t > 0.0:
		riposte_t -= delta
	if p.is_on_floor() and p.state != p.St.ATTACK:
		air_combo = 0
	if combo_timer > 0.0:
		combo_timer -= delta
		if combo_timer <= 0.0:
			_end_combo(false)
	if p.lock_target:
		if not is_instance_valid(p.lock_target) or not p.lock_target.alive or p.lock_target.global_position.distance_to(p.global_position) > 30.0:
			set_lock(null)
	if p.invulnerable <= 0.0:
		dodge_rewarded = false


## Um golpe inimigo chegou. Devolve "hit", "blocked", "parried" ou "dodged".
func receive(hit: Dictionary) -> String:
	var St: Dictionary = p.St
	if p.invulnerable > 0.0:
		if (p.state == St.DASH or p.state == St.BURST) and not dodge_rewarded:
			dodge_rewarded = true
			p.perfect_dodge()
		return "dodged"
	var from_pos: Vector3 = hit.get("from_pos", p.global_position)
	var to_att := Geo.flat_dir(p.global_position, from_pos)
	var front: bool = to_att == Vector3.ZERO or p.forward_dir().dot(to_att) > -0.25
	var attacker: Node = hit.get("from")
	if p.state == St.BLOCK and front and not hit.get("unblockable", false):
		if block_time <= PARRY_WINDOW:
			var perfect := block_time <= PERFECT_WINDOW
			_parry(hit, attacker, perfect)
			return "parried"
		var dmg: float = float(hit.get("damage", 0.0))
		p.apply_damage(dmg * 0.12)
		p.spend_stamina(dmg * 1.15 + 4.0)
		p.knock += (hit.get("knock", Vector3.ZERO) as Vector3) * 0.45
		p.visual.play_upper("block_hit", 0.03)
		p.visual.play_upper("block", 0.2)
		Sfx.play_at("block", p.center(), -2.0)
		Fx.burst("spark", p.center() + p.forward_dir() * 0.5, -to_att, Color(1.0, 0.95, 0.8), 0.9)
		Fx.shake(0.12)
		if p.stamina <= 0.0:
			Game.say("Guarda quebrada!", "bad")
			p.stun(1.0, "stagger")
			Sfx.play("guard_break", -2.0)
		return "blocked"
	# golpe em cheio
	var full: float = float(hit.get("damage", 0.0)) * p.element_factor(hit.get("element", ""))
	p.knock += hit.get("knock", Vector3.ZERO)
	if hit.get("element", "") == "water":
		p.set_wet(12.0)
	if hit.get("element", "") == "fire":
		p.ignite(4.0)
	p.apply_damage(full, hit)
	_end_combo(true)
	p.visual.flash(0.8)
	Fx.burst("hit", p.center(), -to_att, Color(1.0, 0.5, 0.45), 1.0)
	Fx.shake(0.3)
	Sfx.play_at("hurt", p.center(), -1.0)
	if p.alive and float(hit.get("damage", 0.0)) > 0.5 and not hit.get("no_stun", false):
		if full >= 24.0 or hit.get("heavy", false):
			p.stun(0.7, "stagger")
		else:
			p.stun(0.34, "hit")
	return "hit"


func _parry(hit: Dictionary, attacker: Node, perfect: bool) -> void:
	p.visual.play_upper("parry", 0.03)
	p.visual.play_upper("block", 0.3)
	p.gain_breath(25.0 if perfect else 10.0)
	p.stamina = minf(p.stamina + 12.0, p.max_stamina)
	block_time = PARRY_WINDOW + 0.01
	riposte_t = RIPOSTE_WINDOW
	var at: Vector3 = p.center() + p.forward_dir() * 0.6
	Fx.burst("parry", at, p.forward_dir(), Color(1.0, 0.97, 0.8), 1.4 if perfect else 1.0)
	Fx.shake(0.3 if perfect else 0.18)
	Sfx.play_at("parry_perfect" if perfect else "parry", at, 0.0)
	Game.say("Parry perfeito!" if perfect else "Parry", "good")
	if attacker and is_instance_valid(attacker) and attacker.has_method("on_parried"):
		Net.parried(attacker, p, perfect)
	if hit.has("projectile") and is_instance_valid(hit["projectile"]):
		hit["projectile"].reflect(p)
	if perfect:
		# parry perfeito solta uma rajada que empurra quem está em volta
		Fx.ring(p.center(), Vector3.UP, Color(0.75, 1.0, 0.97), 4.6, 0.45)
		Fx.burst("burst", p.center(), p.forward_dir(), Color(0.8, 1.0, 0.97), 1.2)
		for a: Node in p.get_tree().get_nodes_in_group(&"actors"):
			if a == p or not a.alive or not a.is_enemy_of(p):
				continue
			var d: Vector3 = a.global_position - p.global_position
			if d.length() < 4.6:
				var dir := Geo.flat(d).normalized()
				Net.deal_hit(a, {"damage": 4.0, "posture": 12.0, "knock": dir * 9.0, "from": p, "from_pos": p.global_position, "kind": "gust", "element": "wind"})
		Game.slowmo(0.3, 0.3)


# =============================================================================== alvo travado

func toggle_lock() -> void:
	if p.lock_target:
		set_lock(null)
		return
	var best: Node3D = null
	var best_score := -1e9
	var fwd: Vector3 = p.cam_rig.forward() if p.cam_rig else p.forward_dir()
	var origin: Vector3 = p.cam_rig.cam.global_position if p.cam_rig else p.center()
	for a: Node in p.get_tree().get_nodes_in_group(&"actors"):
		if a == p or not a.alive or not a.is_enemy_of(p):
			continue
		var d: Vector3 = a.center() - origin
		var dist := d.length()
		if dist > 26.0:
			continue
		var dot := d.normalized().dot(fwd)
		if dot < 0.35:
			continue
		var score := dot * 10.0 - dist * 0.2
		if score > best_score:
			best_score = score
			best = a
	set_lock(best)


func set_lock(a: Node3D) -> void:
	p.lock_target = a
	if p.cam_rig:
		p.cam_rig.lock_target = a
	if a:
		Sfx.play("lock", -10.0)


# =============================================================================== contador de combo

func rank_index() -> int:
	var idx := -1
	for i in RANKS.size():
		if combo_hits >= int(RANKS[i][0]):
			idx = i
	return idx


func rank_name() -> String:
	var i := rank_index()
	return RANKS[i][1] if i >= 0 else ""


func register_hit(dmg: float, at: Vector3, crit: bool = false) -> void:
	var before := rank_index()
	combo_hits += 1
	combo_damage += dmg
	combo_timer = COMBO_TIMEOUT
	combo_best = maxi(combo_best, combo_hits)
	Fx.number(at, dmg, "crit" if crit else "hit")
	var after := rank_index()
	if after > before:
		Sfx.play("rank_up", -6.0, 1.0 + 0.08 * after)
		p.gain_breath(6.0)
	Game.combo_changed.emit(combo_hits, combo_damage, rank_name(), after, after > before)


func _end_combo(broken: bool) -> void:
	if combo_hits > 0:
		Game.combo_ended.emit(combo_hits, combo_damage, broken)
	combo_hits = 0
	combo_damage = 0.0
	combo_timer = 0.0


func combo_fraction() -> float:
	return clampf(combo_timer / COMBO_TIMEOUT, 0.0, 1.0)


# =============================================================================== itens e habilidades

func use(slot: Dictionary) -> void:
	var St: Dictionary = p.St
	var id: String = slot.get("id", "")
	if id == "flask":
		if p.state != St.GROUND:
			return
		if p.flasks <= 0:
			Game.say("Cantil vazio", "bad")
			return
		if p.hp >= p.max_hp:
			return
		pending_item = slot
		p.start_item("drink", 1.0)
		Sfx.play_at("drink", p.global_position, -6.0)
		return
	if slot.get("kind", "") != "skill":
		return
	if p.state == St.ATTACK and (plunge_phase != 0 or t < float(move.get("combo", 99.0))):
		return
	if not (p.state in [St.GROUND, St.AIR, St.GLIDE, St.ATTACK, St.BLOCK]):
		return
	var cost: float = float(slot.get("cost", 0.0))
	if p.breath < cost:
		Game.say("Fôlego de vento insuficiente", "bad")
		Sfx.play("deny", -8.0)
		return
	p.breath -= cost
	skill = slot
	start("cast")


func finish_item() -> void:
	if pending_item.get("id", "") == "flask" and p.flasks > 0:
		p.flasks -= 1
		p.heal(p.max_hp * 0.45)
		Fx.burst("heal", p.center(), Vector3.UP, Color(0.5, 1.0, 0.75), 1.0)
		Sfx.play_at("heal", p.global_position, -4.0)
	pending_item = {}


func _fire_skill() -> void:
	var dir: Vector3 = lunge_dir
	if p.cam_rig:
		var f: Vector3 = p.cam_rig.forward()
		if target == null or not is_instance_valid(target):
			dir = f
		else:
			dir = (target.center() - p.center()).normalized()
	var origin: Vector3 = p.center() + Geo.flat(dir).normalized() * 0.7
	match skill.get("id", ""):
		"gust":
			Game.spawn_skill("gust", p, origin, dir)
			if not p.is_on_floor():
				# no ar, a rajada te joga para trás (e para cima se mirar para baixo)
				p.velocity -= dir * 10.0
				p.velocity.y = maxf(p.velocity.y, 3.0)
		"wave":
			Game.spawn_skill("wave", p, origin, dir)
		"cyclone":
			var at: Vector3 = p.global_position + Geo.flat(dir).normalized() * 6.0
			if target and is_instance_valid(target):
				at = target.global_position
			Game.spawn_skill("cyclone", p, at, dir)


## Inimigos atravessados pelo impulso de vento.
func burst_hits(charge_amount: float) -> void:
	for a: Node in p.get_tree().get_nodes_in_group(&"actors"):
		if a == p or not a.alive or not a.is_enemy_of(p) or p.burst_hit.has(a):
			continue
		if a.center().distance_to(p.center()) < 1.5 + a.radius:
			p.burst_hit.append(a)
			var dir := Geo.flat(p.burst_dir).normalized()
			var res: String = Net.deal_hit(a, {"damage": 12.0 + 18.0 * charge_amount, "posture": 16.0 + 14.0 * charge_amount,
				"knock": dir * 10.0, "launch": 4.0, "from": p, "from_pos": p.global_position, "kind": "burst", "element": "wind", "heavy": true})
			if res == "hit":
				register_hit(12.0 + 18.0 * charge_amount, a.head_pos())
				Fx.burst("hit_heavy", a.center(), dir, Color(0.8, 1.0, 0.97), 1.2)
				Sfx.play_at("hit_heavy", a.center(), -2.0)
				Fx.shake(0.2)
