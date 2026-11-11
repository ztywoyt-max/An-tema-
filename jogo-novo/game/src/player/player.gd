extends "res://src/actors/actor.gd"
## Jogador: movimentação freestyle (correr, investida, impulso de vento, deslizar,
## pulo duplo, planar, correr na parede, agarrar bordas, nadar) e ponte para o combate.

const Humanoid := preload("res://src/actors/humanoid.gd")
const Combat := preload("res://src/player/player_combat.gd")
const Items := preload("res://src/player/items.gd")

enum St { GROUND, AIR, DASH, CHARGE, BURST, SLIDE, GLIDE, WALLRUN, LEDGE, MANTLE, SWIM, ATTACK, BLOCK, STUN, ITEM, REST, DEAD }
const ST_NAMES := ["chão", "ar", "investida", "carregando vento", "impulso de vento", "deslizando", "planando", "parede", "borda", "subindo", "nadando", "atacando", "defendendo", "atordoado", "item", "descansando", "morto"]

# ---- ajuste fino do movimento
const WALK_SPEED := 2.6
const RUN_SPEED := 6.6
const SPRINT_SPEED := 10.2
const GUARD_SPEED := 3.0
const ACCEL := 60.0
const DECEL := 70.0
const AIR_ACCEL := 26.0
const GRAVITY := 30.0
const FALL_MULT := 1.3
const TERMINAL := 40.0
const JUMP_VEL := 10.9
const DOUBLE_JUMP_VEL := 10.2
const COYOTE := 0.12
const JUMP_BUFFER := 0.14
const DASH_TIME := 0.24
const DASH_SPEED := 27.0
const DASH_END_SPEED := 9.0
const DASH_COOLDOWN := 0.34
const DASH_IFRAMES := 0.2
const DASH_COST := 16.0
const SLIDE_MIN_SPEED := 4.6
const MOMENTUM_DECAY := 7.0
const WALLJUMP_OUT := 7.6
const WALLJUMP_UP := 10.4
const GLIDE_FALL := -2.3
const GLIDE_SPEED := 9.6
const WALLRUN_TIME := 1.3
const WALLRUN_SPEED := 8.0
const SWIM_DEPTH := 1.3
const SWIM_SPEED := 4.4
const SWIM_FAST := 6.6
const HANG_OFFSET := 1.9
const BURST_MIN := 19.0
const BURST_MAX := 33.0
const LUNGS := 30.0

var state: int = St.GROUND
var state_time := 0.0
var visual: Humanoid
var combat: Combat
var cam_rig: Node3D
var is_local := true
var peer_id := 1

var max_stamina := 100.0
var stamina := 100.0
var stamina_delay := 0.0
var max_breath := 100.0          ## fôlego de vento
var breath := 100.0
var lungs := LUNGS               ## ar debaixo d'água

var facing := 0.0
var move_input := Vector2.ZERO
var wish_dir := Vector3.ZERO
var sprinting := false
var coyote := 0.0
var jump_buffer := 0.0
var jumps_left := 1
var air_dashes_left := 1
var glide_armed := false
var jump_cut_done := false
var jump_held_t := 0.0
var dash_cd := 0.0
var dash_dir := Vector3.FORWARD
var dash_held_after := false
var charge := 0.0
var burst_dir := Vector3.FORWARD
var burst_time := 0.0
var burst_speed := 0.0
var burst_hit: Array = []
var wall_normal := Vector3.ZERO
var wall_dir := Vector3.ZERO
var wall_cd := 0.0
var walljump_cd := 0.0
var last_wall_normal := Vector3.ZERO
var ledge: Dictionary = {}
var mantle_from := Vector3.ZERO
var mantle_to := Vector3.ZERO
var underwater := false
var stun_time := 0.0
var item_time := 0.0
var item_used := false
var buffer_action := ""
var buffer_time := 0.0
var respawn_point := Vector3.ZERO
var respawn_yaw := 0.0
var lock_target: Node3D
var fall_peak := 0.0
var last_floor_speed := 0.0
var step_phase := 0.0
var lean := Vector2.ZERO
var model_pitch := 0.0

# hotbar
var hotbar: Array = []
var hotbar_index := 0
var weapon_id := "sword"
var flasks := 3
var max_flasks := 3

# sincronização (co-op)
var net_anim := "idle"
var net_anim_seq := 0
var net_upper := ""
var net_speed := 1.0
var _net_pos := Vector3.ZERO
var _net_has := false

var _shape: CollisionShape3D
var _prev_on_floor := true
var _wind_audio := 0.0


func _ready() -> void:
	team = TEAM_PLAYER
	max_hp = 100.0
	hp = max_hp
	max_posture = 0.0
	collision_layer = Game.L_PLAYER
	collision_mask = Game.L_WORLD | Game.L_ENEMY
	floor_snap_length = 0.3
	floor_max_angle = deg_to_rad(48.0)
	floor_stop_on_slope = true
	max_slides = 5
	_shape = CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = radius
	cap.height = height
	_shape.shape = cap
	_shape.position.y = height * 0.5
	add_child(_shape)
	visual = Humanoid.new()
	visual.name = "Visual"
	add_child(visual)
	visual.setup("hero", weapon_id)
	combat = Combat.new()
	combat.setup(self)
	hotbar = Items.default_hotbar()
	respawn_point = global_position
	add_to_group(&"players")


# =============================================================================== utilidades

func forward_dir() -> Vector3:
	return Vector3(-sin(facing), 0.0, -cos(facing))


func right_dir() -> Vector3:
	return Vector3(cos(facing), 0.0, -sin(facing))


func horizontal_speed() -> float:
	return Vector2(velocity.x, velocity.z).length()


func face_dir(dir: Vector3, rate: float, delta: float) -> void:
	if Vector2(dir.x, dir.z).length_squared() < 0.0001:
		return
	var want := atan2(-dir.x, -dir.z)
	facing = lerp_angle(facing, want, 1.0 - exp(-rate * delta)) if rate > 0.0 else want


func set_state(s: int) -> void:
	if state == St.DASH or state == St.BURST:
		collision_mask = Game.L_WORLD | Game.L_ENEMY
	state = s
	state_time = 0.0


func anim(clip: String, blend: float = 0.12, speed: float = 1.0, restart: bool = false) -> void:
	if clip != net_anim or restart:
		net_anim_seq += 1
	net_anim = clip
	net_speed = speed
	visual.play(clip, blend, speed, restart)


func anim_upper(clip: String, blend: float = 0.1) -> void:
	net_upper = clip
	if clip == "":
		visual.stop_upper(blend)
	else:
		visual.play_upper(clip, blend)


func spend_stamina(amount: float) -> void:
	stamina = maxf(stamina - amount, 0.0)
	stamina_delay = 0.75


func gain_breath(amount: float) -> void:
	breath = clampf(breath + amount, 0.0, max_breath)


func pressed(action: StringName) -> bool:
	return is_local and Game.input_enabled and not Game.paused and Input.is_action_just_pressed(action)


func held(action: StringName) -> bool:
	return is_local and Game.input_enabled and not Game.paused and Input.is_action_pressed(action)


func buffer(action: String) -> void:
	buffer_action = action
	buffer_time = 0.28


func take_buffer(action: String) -> bool:
	if buffer_action == action and buffer_time > 0.0:
		buffer_action = ""
		return true
	return false


func water_depth() -> float:
	return Tide.depth_at(global_position)


func can_act() -> bool:
	return alive and state != St.STUN and state != St.DEAD and state != St.REST and state != St.MANTLE


# =============================================================================== laço principal

func _physics_process(delta: float) -> void:
	if not is_local:
		_remote_update(delta)
		return
	tick_status(delta)
	if hitstop > 0.0:
		return
	state_time += delta
	_read_input(delta)
	_tick_resources(delta)
	if alive and state != St.SWIM and state != St.DEAD and state != St.MANTLE and state != St.LEDGE and state != St.BURST:
		if water_depth() > SWIM_DEPTH:
			_enter_swim()
	match state:
		St.GROUND:
			_st_ground(delta)
		St.AIR:
			_st_air(delta)
		St.DASH:
			_st_dash(delta)
		St.CHARGE:
			_st_charge(delta)
		St.BURST:
			_st_burst(delta)
		St.SLIDE:
			_st_slide(delta)
		St.GLIDE:
			_st_glide(delta)
		St.WALLRUN:
			_st_wallrun(delta)
		St.LEDGE:
			_st_ledge(delta)
		St.MANTLE:
			_st_mantle(delta)
		St.SWIM:
			_st_swim(delta)
		St.ATTACK:
			combat.physics(delta)
		St.BLOCK:
			_st_block(delta)
		St.STUN:
			_st_stun(delta)
		St.ITEM:
			_st_item(delta)
		St.REST:
			_st_rest(delta)
		St.DEAD:
			_st_dead(delta)
	if state != St.MANTLE and state != St.LEDGE and state != St.REST:
		var kv := knock
		velocity += kv
		_prev_on_floor = is_on_floor()
		last_floor_speed = velocity.y
		move_and_slide()
		velocity -= kv
	_update_visual(delta)
	combat.tick(delta)


func _read_input(delta: float) -> void:
	if Game.input_enabled and not Game.paused:
		move_input = Input.get_vector(&"move_left", &"move_right", &"move_forward", &"move_back")
	else:
		move_input = Vector2.ZERO
	if cam_rig:
		wish_dir = (cam_rig.flat_right() * move_input.x - cam_rig.flat_forward() * move_input.y)
	else:
		wish_dir = Vector3(move_input.x, 0, move_input.y)
	if wish_dir.length() > 1.0:
		wish_dir = wish_dir.normalized()
	if pressed(&"jump"):
		jump_buffer = JUMP_BUFFER
	else:
		jump_buffer = maxf(jump_buffer - delta, 0.0)
	jump_held_t = jump_held_t + delta if held(&"jump") else 0.0
	if buffer_time > 0.0:
		buffer_time -= delta
	if pressed(&"attack_light"):
		buffer("light")
	if pressed(&"attack_heavy"):
		buffer("heavy")
	if pressed(&"dash"):
		buffer("dash")
	if pressed(&"lock_on"):
		combat.toggle_lock()
	if pressed(&"camera_toggle") and cam_rig:
		cam_rig.set_first_person(not cam_rig.first_person)
	if pressed(&"use_item"):
		use_slot(hotbar_index)
	if pressed(&"hotbar_next"):
		select_slot((hotbar_index + 1) % hotbar.size())
	if pressed(&"hotbar_prev"):
		select_slot((hotbar_index + hotbar.size() - 1) % hotbar.size())
	for i in hotbar.size():
		if pressed("hotbar_%d" % (i + 1)):
			select_slot(i)
			use_slot(i)


func _unhandled_input(event: InputEvent) -> void:
	if not is_local or not Game.input_enabled or Game.paused:
		return
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			select_slot((hotbar_index + 1) % hotbar.size())
		elif event.button_index == MOUSE_BUTTON_WHEEL_UP:
			select_slot((hotbar_index + hotbar.size() - 1) % hotbar.size())


func _tick_resources(delta: float) -> void:
	if dash_cd > 0.0:
		dash_cd -= delta
	if wall_cd > 0.0:
		wall_cd -= delta
	if walljump_cd > 0.0:
		walljump_cd -= delta
	if stamina_delay > 0.0:
		stamina_delay -= delta
	elif stamina < max_stamina:
		var rate := 36.0
		if state == St.BLOCK:
			rate = 14.0
		elif state == St.ATTACK:
			rate = 0.0
		stamina = minf(stamina + rate * delta, max_stamina)
	# o fôlego de vento volta mais rápido onde venta
	var wind_speed: float = Wind.at(global_position).length()
	breath = minf(breath + (5.0 + wind_speed * 1.1) * delta, max_breath)
	if underwater:
		lungs -= delta
		if lungs <= 0.0:
			apply_damage(9.0 * delta, {"element": "drown"})
	else:
		lungs = minf(lungs + delta * 12.0, LUNGS)


# =============================================================================== chão

func _st_ground(delta: float) -> void:
	if not is_on_floor():
		coyote -= delta
		if coyote <= 0.0:
			_enter_air(false)
			return
	else:
		coyote = COYOTE
		jumps_left = 1
		air_dashes_left = 1
		glide_armed = false
		last_wall_normal = Vector3.ZERO
	var guard := lock_target != null and is_instance_valid(lock_target)
	var dash_down := held(&"dash")
	if not dash_down:
		dash_held_after = false
	sprinting = dash_down and dash_held_after and wish_dir.length() > 0.3 and stamina > 0.0 and not guard
	var max_speed := SPRINT_SPEED if sprinting else RUN_SPEED
	if guard:
		max_speed = GUARD_SPEED + 1.6
	var depth := water_depth()
	if depth > 0.25:
		max_speed *= lerpf(1.0, 0.55, clampf(depth / SWIM_DEPTH, 0.0, 1.0))
	if sprinting:
		spend_stamina(6.0 * delta)
	_ground_move(delta, max_speed)
	velocity.y = -1.5 if is_on_floor() else velocity.y - GRAVITY * delta
	# virar o corpo
	if guard or (cam_rig and cam_rig.first_person):
		_face_combat(delta)
	elif wish_dir.length() > 0.1:
		face_dir(wish_dir, 14.0, delta)
	# ações
	if jump_buffer > 0.0:
		_jump()
		return
	if take_buffer("dash"):
		if _try_dash():
			return
	if held(&"crouch") and horizontal_speed() > SLIDE_MIN_SPEED and is_on_floor():
		_enter_slide()
		return
	if held(&"wind") and breath >= 25.0:
		_enter_charge()
		return
	if held(&"block"):
		_enter_block()
		return
	if combat.try_buffered():
		return
	if pressed(&"interact"):
		Game.world_interact(self)
	_ground_anim(guard)
	_footsteps(delta)


func _ground_move(delta: float, max_speed: float) -> void:
	var hv := Vector3(velocity.x, 0.0, velocity.z)
	var spd := hv.length()
	var target := wish_dir * max_speed
	# impulso conservado: acima da velocidade normal, quem segura a direção perde velocidade devagar
	if spd > max_speed + 0.3 and wish_dir.length() > 0.3 and hv.normalized().dot(wish_dir.normalized()) > 0.2:
		var dir := hv.normalized()
		var ang := signf(dir.cross(wish_dir).y) * minf(3.2 * delta, dir.angle_to(wish_dir.normalized()))
		dir = dir.rotated(Vector3.UP, ang)
		hv = dir * maxf(spd - MOMENTUM_DECAY * delta, max_speed)
	else:
		var rate := ACCEL if wish_dir.length() > 0.05 else DECEL
		# virada brusca responde mais rápido
		if spd > 1.0 and target.length() > 0.1 and hv.normalized().dot(target.normalized()) < 0.0:
			rate *= 1.6
		hv = hv.move_toward(target, rate * delta)
	velocity.x = hv.x
	velocity.z = hv.z


func _ground_anim(guard: bool) -> void:
	var spd := horizontal_speed()
	if guard:
		if spd < 0.35:
			anim("guard_idle", 0.18)
		else:
			var local := Vector2(velocity.dot(right_dir()), velocity.dot(forward_dir()))
			var clip := "guard_fwd"
			if absf(local.x) > absf(local.y):
				clip = "guard_right" if local.x > 0.0 else "guard_left"
			elif local.y < 0.0:
				clip = "guard_back"
			anim(clip, 0.14, clampf(spd / 2.6, 0.6, 1.9))
		return
	if spd < 0.35:
		anim("idle", 0.2)
	elif spd < 3.6:
		anim("walk", 0.16, clampf(spd / 2.3, 0.5, 1.7))
	elif spd < 8.4:
		anim("run", 0.14, clampf(spd / 6.4, 0.75, 1.35))
	else:
		anim("sprint", 0.14, clampf(spd / 10.0, 0.85, 1.3))


func _footsteps(delta: float) -> void:
	var spd := horizontal_speed()
	if spd < 1.0 or not is_on_floor():
		return
	step_phase += delta * spd / (1.9 if spd > 4.0 else 1.1)
	if step_phase >= 1.0:
		step_phase -= 1.0
		var depth := water_depth()
		if depth > 0.03:
			Sfx.play_at("step_water", global_position, -8.0, 1.0, 0.15)
			Fx.burst("splash_small", Vector3(global_position.x, Tide.height_at(global_position), global_position.z), Vector3.UP, Color.WHITE, 0.6)
		else:
			Sfx.play_at("step", global_position, -11.0, 1.0, 0.12)
			if spd > 8.0:
				Fx.burst("dust", global_position, Vector3.UP, Color(1, 1, 1, 0.6), 0.6)


func _face_combat(delta: float) -> void:
	if lock_target and is_instance_valid(lock_target):
		face_dir(lock_target.global_position - global_position, 16.0, delta)
	elif cam_rig:
		facing = lerp_angle(facing, cam_rig.yaw, 1.0 - exp(-22.0 * delta))


func _jump() -> void:
	jump_buffer = 0.0
	coyote = 0.0
	velocity.y = JUMP_VEL
	jump_cut_done = false
	set_state(St.AIR)
	anim("jump", 0.06, 1.0, true)
	Sfx.play_at("jump", global_position, -8.0)
	Fx.burst("dust", global_position, Vector3.UP, Color(1, 1, 1, 0.7), 0.8)


func _enter_air(from_jump: bool) -> void:
	set_state(St.AIR)
	if not from_jump:
		anim("fall", 0.2)


# =============================================================================== ar

func _st_air(delta: float) -> void:
	var g := GRAVITY * (FALL_MULT if velocity.y < 0.0 else 1.0)
	velocity.y = maxf(velocity.y - g * delta, -TERMINAL)
	if not jump_cut_done and velocity.y > JUMP_VEL * 0.45 and not held(&"jump"):
		velocity.y *= 0.55
		jump_cut_done = true
	# controle no ar
	var hv := Vector3(velocity.x, 0.0, velocity.z)
	var top := maxf(hv.length(), RUN_SPEED)
	if wish_dir.length() > 0.05:
		hv = hv.move_toward(wish_dir * top, AIR_ACCEL * delta)
		face_dir(wish_dir, 9.0, delta)
	else:
		hv = hv.move_toward(Vector3.ZERO, 3.0 * delta)
	velocity.x = hv.x
	velocity.z = hv.z
	_apply_wind_zones(delta, 1.0)
	if cam_rig and cam_rig.first_person:
		_face_combat(delta)
	if is_on_floor() and velocity.y <= 0.1:
		_land()
		return
	if jump_buffer > 0.0:
		if coyote > 0.0:
			_jump()
			return
		if _try_walljump():
			return
		if jumps_left > 0:
			_double_jump()
			return
		glide_armed = true
		jump_buffer = 0.0
	# planar só depois de segurar um instante (o toque primeiro tenta pulo na parede / pulo duplo)
	if glide_armed and jump_held_t > 0.06 and velocity.y < 0.5:
		_enter_glide()
		return
	coyote = maxf(coyote - delta, 0.0)
	if take_buffer("dash"):
		if _try_dash():
			return
	if held(&"wind") and breath >= 25.0:
		_enter_charge()
		return
	if combat.try_buffered():
		return
	if state_time > 0.1 and velocity.y < 6.0:
		if _try_ledge():
			return
		if _try_wallrun():
			return
	if velocity.y < -1.5 or state_time > 0.42:
		if visual.current == "jump" or visual.current == "double_jump":
			if visual.time_in_clip > 0.3:
				anim("fall", 0.25)
		elif visual.current != "fall":
			anim("fall", 0.2)


## Parede ao alcance (para o pulo na parede): devolve a normal ou zero.
func _wall_near() -> Vector3:
	if is_on_wall():
		var n := get_wall_normal()
		if absf(n.y) < 0.3:
			return Vector3(n.x, 0.0, n.z).normalized()
	var space := get_world_3d().direct_space_state
	var origin := global_position + Vector3.UP * 0.9
	var dirs := [forward_dir(), -forward_dir(), right_dir(), -right_dir()]
	if wish_dir.length() > 0.3:
		dirs.push_front(wish_dir.normalized())
	var hv := Vector3(velocity.x, 0.0, velocity.z)
	if hv.length() > 1.0:
		dirs.push_front(hv.normalized())
	for d: Vector3 in dirs:
		var q := PhysicsRayQueryParameters3D.create(origin, origin + d * (radius + 0.5), Game.L_WORLD)
		var hit := space.intersect_ray(q)
		if not hit.is_empty() and absf((hit["normal"] as Vector3).y) < 0.3:
			var n2: Vector3 = hit["normal"]
			return Vector3(n2.x, 0.0, n2.z).normalized()
	return Vector3.ZERO


## Pulo na parede: chuta a parede e sobe. Não gasta o pulo duplo; para repetir é preciso outra parede.
func _try_walljump() -> bool:
	if walljump_cd > 0.0:
		return false
	var n := _wall_near()
	if n == Vector3.ZERO:
		return false
	if last_wall_normal != Vector3.ZERO and n.dot(last_wall_normal) > 0.85:
		return false
	last_wall_normal = n
	jump_buffer = 0.0
	walljump_cd = 0.2
	wall_cd = 0.25
	var hv := Vector3(velocity.x, 0.0, velocity.z)
	var tang := hv - n * hv.dot(n)
	velocity = n * WALLJUMP_OUT + tang * 0.7
	velocity.y = WALLJUMP_UP
	jump_cut_done = true
	air_dashes_left = 1
	glide_armed = true
	face_dir(velocity, 0.0, 0.0)
	set_state(St.AIR)
	anim("jump", 0.05, 1.0, true)
	Sfx.play_at("jump", global_position, -4.0, 1.15)
	Fx.burst("dust", global_position + Vector3.UP * 0.9 - n * radius, n, Color.WHITE, 0.9)
	Fx.ring(global_position + Vector3.UP * 0.9 - n * radius, n, Color(0.85, 1.0, 0.98), 1.2, 0.25)
	return true


func _double_jump() -> void:
	jump_buffer = 0.0
	jumps_left -= 1
	glide_armed = true
	jump_cut_done = true
	velocity.y = DOUBLE_JUMP_VEL
	if wish_dir.length() > 0.2:
		var spd := maxf(horizontal_speed(), 5.5)
		velocity.x = wish_dir.x * spd
		velocity.z = wish_dir.z * spd
		face_dir(wish_dir, 0.0, 0.0)
	anim("double_jump", 0.06, 1.0, true)
	Sfx.play_at("double_jump", global_position, -5.0)
	Fx.ring(global_position + Vector3.UP * 0.2, Vector3.UP, Color(0.75, 1.0, 0.97), 1.6, 0.35)
	Fx.burst("wind_puff", global_position, Vector3.DOWN, Color(0.8, 1.0, 0.97), 1.0)


func _land() -> void:
	var impact := -last_floor_speed
	set_state(St.GROUND)
	coyote = COYOTE
	if impact > 11.0:
		anim("land", 0.05, 1.0, true)
		Fx.burst("dust", global_position, Vector3.UP, Color(1, 1, 1, 0.8), 1.2)
		Fx.shake(clampf((impact - 10.0) * 0.02, 0.05, 0.3))
		Sfx.play_at("land", global_position, -4.0)
	else:
		Sfx.play_at("step", global_position, -7.0)


## Vento das zonas (correntes ascendentes, corredores) empurrando o jogador.
func _apply_wind_zones(delta: float, factor: float) -> void:
	var w: Vector3 = Wind.zone_at(global_position + Vector3.UP * 0.9)
	if w == Vector3.ZERO:
		return
	if w.y > 0.5:
		velocity.y = move_toward(velocity.y, w.y, 34.0 * delta * factor)
	var hw := Vector3(w.x, 0.0, w.z)
	if hw.length() > 0.5:
		var hv := Vector3(velocity.x, 0.0, velocity.z)
		var along := hv.dot(hw.normalized())
		if along < hw.length():
			hv += hw.normalized() * minf(18.0 * delta * factor, hw.length() - along)
		velocity.x = hv.x
		velocity.z = hv.z


# =============================================================================== investida

func _try_dash() -> bool:
	if dash_cd > 0.0 or stamina <= 0.0 or not can_act():
		return false
	var in_air := not is_on_floor()
	if in_air:
		if air_dashes_left <= 0:
			return false
		air_dashes_left -= 1
	var dir := wish_dir
	var guard := lock_target != null and is_instance_valid(lock_target)
	if dir.length() < 0.2:
		dir = -forward_dir() if guard else forward_dir()
	dash_dir = dir.normalized()
	spend_stamina(DASH_COST)
	dash_cd = DASH_COOLDOWN
	invulnerable = maxf(invulnerable, DASH_IFRAMES)
	collision_mask = Game.L_WORLD
	set_state(St.DASH)
	dash_held_after = true
	anim_upper("")
	if guard:
		var f := forward_dir()
		var r := right_dir()
		var df := dash_dir.dot(f)
		var dr := dash_dir.dot(r)
		if absf(df) >= absf(dr):
			anim("dash_f" if df > 0.0 else "dash_b", 0.05, 1.0, true)
		else:
			anim("dash_r" if dr > 0.0 else "dash_l", 0.05, 1.0, true)
	else:
		face_dir(dash_dir, 0.0, 0.0)
		anim("dash_f", 0.05, 1.0, true)
	Sfx.play_at("dash", global_position, -3.0)
	Fx.burst("dash", global_position + Vector3.UP * 0.9, -dash_dir, Color(0.8, 1.0, 0.97), 1.0)
	if cam_rig:
		cam_rig.kick_fov(7.0)
	return true


func _st_dash(delta: float) -> void:
	var t := clampf(state_time / DASH_TIME, 0.0, 1.0)
	var spd := lerpf(DASH_SPEED, DASH_END_SPEED, t * t)
	# vento a favor empurra mais longe
	var tail: float = Wind.at(global_position).dot(dash_dir)
	if tail > 3.0:
		spd *= 1.0 + minf(tail, 14.0) * 0.022
	velocity = dash_dir * spd
	if is_on_floor():
		velocity.y = -1.0
	else:
		velocity.y = 0.0
	if state_time > 0.07 and (buffer_action == "light" or buffer_action == "heavy"):
		if combat.try_buffered():
			return
	if jump_buffer > 0.0 and (is_on_floor() or coyote > 0.0):
		# pulo longo
		jump_buffer = 0.0
		velocity = dash_dir * 13.0
		velocity.y = JUMP_VEL * 0.93
		jump_cut_done = true
		set_state(St.AIR)
		anim("jump", 0.06, 1.0, true)
		Sfx.play_at("jump", global_position, -6.0)
		return
	if state_time >= DASH_TIME:
		var keep := (SPRINT_SPEED + 1.5) if held(&"dash") else (RUN_SPEED + 1.5)
		velocity.x = dash_dir.x * keep
		velocity.z = dash_dir.z * keep
		if is_on_floor():
			set_state(St.GROUND)
		else:
			_enter_air(false)


## Chamado quando um golpe passa por nós durante os quadros de invulnerabilidade.
func perfect_dodge() -> void:
	gain_breath(15.0)
	stamina = minf(stamina + 20.0, max_stamina)
	Game.say("Esquiva perfeita", "good")
	Sfx.play("perfect", -4.0)
	Fx.ring(center(), Vector3.UP, Color(0.7, 1.0, 0.95), 2.2, 0.35)
	Game.slowmo(0.35, 0.22)


# =============================================================================== impulso de vento

func _enter_charge() -> void:
	set_state(St.CHARGE)
	charge = 0.0
	anim("wind_charge", 0.12)
	Sfx.play_at("charge", global_position, -6.0)


func _st_charge(delta: float) -> void:
	charge = minf(charge + delta / 0.85, 1.0)
	if cam_rig:
		facing = lerp_angle(facing, cam_rig.yaw, 1.0 - exp(-14.0 * delta))
	if is_on_floor():
		_ground_move(delta, 2.2)
		velocity.y = -1.5
	else:
		velocity.y = maxf(velocity.y - GRAVITY * 0.35 * delta, -3.0)
		velocity.x = move_toward(velocity.x, 0.0, 10.0 * delta)
		velocity.z = move_toward(velocity.z, 0.0, 10.0 * delta)
	if int(state_time * 12.0) != int((state_time - delta) * 12.0):
		Fx.burst("gather", center(), Vector3.UP, Color(0.75, 1.0, 0.97), 0.6 + charge)
	if take_buffer("dash"):
		set_state(St.GROUND if is_on_floor() else St.AIR)
		_try_dash()
		return
	if not held(&"wind"):
		if charge >= 0.18:
			_enter_burst()
		else:
			set_state(St.GROUND if is_on_floor() else St.AIR)


func _enter_burst() -> void:
	var dir: Vector3 = cam_rig.forward() if cam_rig else forward_dir()
	if is_on_floor() and dir.y < 0.06:
		dir.y = 0.06
	dir = dir.normalized()
	burst_dir = dir
	burst_speed = lerpf(BURST_MIN, BURST_MAX, charge)
	burst_time = lerpf(0.3, 0.52, charge)
	burst_hit.clear()
	breath = maxf(breath - (25.0 + 30.0 * charge), 0.0)
	invulnerable = maxf(invulnerable, 0.14)
	collision_mask = Game.L_WORLD
	set_state(St.BURST)
	face_dir(dir, 0.0, 0.0)
	anim("wind_burst", 0.08, 1.0, true)
	air_dashes_left = 1
	glide_armed = true
	Sfx.play_at("burst", global_position, 0.0)
	Fx.ring(center(), -dir, Color(0.8, 1.0, 0.97), 2.6, 0.4)
	Fx.burst("burst", center(), -dir, Color(0.85, 1.0, 0.98), 1.0 + charge)
	Fx.shake(0.18 + 0.2 * charge)
	if cam_rig:
		cam_rig.kick_fov(11.0 + 9.0 * charge)


func _st_burst(delta: float) -> void:
	var t := clampf(state_time / burst_time, 0.0, 1.0)
	velocity = burst_dir * burst_speed * lerpf(1.0, 0.62, t * t)
	model_pitch = asin(clampf(burst_dir.y, -1.0, 1.0))
	if int(state_time * 22.0) != int((state_time - delta) * 22.0):
		Fx.ring(center(), -burst_dir, Color(0.8, 1.0, 0.97, 0.8), 1.2, 0.28)
	combat.burst_hits(charge)
	if state_time >= burst_time or (state_time > 0.08 and get_slide_collision_count() > 0 and get_real_velocity().length() < burst_speed * 0.25):
		velocity = burst_dir * burst_speed * 0.45
		model_pitch = 0.0
		if is_on_floor():
			set_state(St.GROUND)
		else:
			_enter_air(false)


# =============================================================================== deslizar

func _enter_slide() -> void:
	set_state(St.SLIDE)
	anim("slide", 0.12)
	Sfx.play_at("slide", global_position, -6.0)


func _st_slide(delta: float) -> void:
	if not is_on_floor():
		coyote = COYOTE
		_enter_air(false)
		return
	var n := get_floor_normal()
	var hv := Vector3(velocity.x, 0.0, velocity.z)
	var spd := hv.length()
	var dir := hv.normalized() if spd > 0.1 else forward_dir()
	# a ladeira acelera; o chão plano freia; água rasa quase não freia (surfe)
	var downhill := Vector3(n.x, 0.0, n.z)
	var depth := water_depth()
	var friction := 0.7 if depth > 0.04 else 3.2
	var v := dir * spd + downhill * GRAVITY * 0.85 * delta
	spd = maxf(v.length() - friction * delta, 0.0)
	dir = v.normalized() if v.length() > 0.01 else dir
	if wish_dir.length() > 0.2:
		var ang := signf(dir.cross(wish_dir).y) * minf(1.5 * delta, dir.angle_to(wish_dir))
		dir = dir.rotated(Vector3.UP, ang)
	if depth > 0.04:
		var cur: Vector3 = Game.water_current(global_position)
		v = dir * spd + cur * delta * 1.6
		spd = v.length()
		dir = v.normalized() if spd > 0.01 else dir
		if int(state_time * 14.0) != int((state_time - delta) * 14.0):
			Fx.burst("splash_small", Vector3(global_position.x, Tide.height_at(global_position), global_position.z), -dir, Color.WHITE, 0.9)
	elif int(state_time * 10.0) != int((state_time - delta) * 10.0):
		Fx.burst("dust", global_position, -dir, Color(1, 1, 1, 0.6), 0.7)
	velocity = dir * minf(spd, 24.0)
	velocity.y = -4.0
	face_dir(dir, 12.0, delta)
	if jump_buffer > 0.0:
		var keep := minf(spd * 1.08, 17.0)
		_jump()
		velocity.x = dir.x * keep
		velocity.z = dir.z * keep
		return
	if buffer_action == "light" or buffer_action == "heavy":
		if combat.try_buffered():
			return
	if take_buffer("dash"):
		set_state(St.GROUND)
		if _try_dash():
			return
	if (not held(&"crouch") and state_time > 0.3) or spd < 2.0:
		set_state(St.GROUND)


# =============================================================================== planar

func _enter_glide() -> void:
	set_state(St.GLIDE)
	anim("glide", 0.2)
	Sfx.play_at("glide_open", global_position, -6.0)
	Fx.burst("wind_puff", center(), Vector3.UP, Color(0.8, 1.0, 0.97), 0.8)


func _st_glide(delta: float) -> void:
	var hv := Vector3(velocity.x, 0.0, velocity.z)
	var dir := hv.normalized() if hv.length() > 0.5 else forward_dir()
	if wish_dir.length() > 0.2:
		var ang := signf(dir.cross(wish_dir).y) * minf(2.4 * delta, dir.angle_to(wish_dir))
		dir = dir.rotated(Vector3.UP, ang)
		lean.x = lerpf(lean.x, clampf(-ang / maxf(delta, 0.001) * 0.16, -0.5, 0.5), 1.0 - exp(-8.0 * delta))
	var wind: Vector3 = Wind.at(global_position)
	var tail := Vector3(wind.x, 0.0, wind.z).dot(dir)
	var target_speed := GLIDE_SPEED + clampf(tail, -3.0, 9.0) * 0.55
	var spd := move_toward(hv.length(), target_speed, 9.0 * delta)
	velocity.x = dir.x * spd
	velocity.z = dir.z * spd
	var lift: float = maxf(Wind.zone_at(global_position + Vector3.UP * 0.9).y, 0.0)
	var fall := GLIDE_FALL + lift * 0.85
	velocity.y = move_toward(velocity.y, fall, (30.0 if velocity.y < fall else 16.0) * delta)
	face_dir(dir, 10.0, delta)
	if is_on_floor():
		_land()
		return
	if not held(&"jump"):
		_enter_air(false)
		return
	if take_buffer("dash"):
		set_state(St.AIR)
		if _try_dash():
			return
	if held(&"wind") and breath >= 25.0:
		_enter_charge()
		return
	if combat.try_buffered():
		return
	if _try_ledge():
		return


# =============================================================================== parede e borda

func _try_wallrun() -> bool:
	if wall_cd > 0.0 or not is_on_wall() or horizontal_speed() < 4.0 or wish_dir.length() < 0.3:
		return false
	var n := get_wall_normal()
	if absf(n.y) > 0.25:
		return false
	n.y = 0.0
	n = n.normalized()
	var hv := Vector3(velocity.x, 0.0, velocity.z)
	var t := n.cross(Vector3.UP)
	if hv.dot(t) < 0.0:
		t = -t
	if absf(wish_dir.dot(t)) < 0.35:
		return false
	wall_normal = n
	wall_dir = t
	set_state(St.WALLRUN)
	velocity.y = maxf(velocity.y, 3.2)
	jumps_left = 1
	air_dashes_left = 1
	# parede à direita do movimento?
	var right := t.cross(Vector3.UP)
	anim("wallrun_r" if (-n).dot(right) > 0.0 else "wallrun_l", 0.12, 1.15)
	Sfx.play_at("step", global_position, -6.0)
	return true


func _st_wallrun(delta: float) -> void:
	var space := get_world_3d().direct_space_state
	var from := global_position + Vector3.UP * 1.0
	var q := PhysicsRayQueryParameters3D.create(from, from - wall_normal * 0.8, Game.L_WORLD)
	var hit := space.intersect_ray(q)
	var spd := maxf(horizontal_speed() - 1.2 * delta, WALLRUN_SPEED)
	velocity.x = wall_dir.x * spd - wall_normal.x * 1.5
	velocity.z = wall_dir.z * spd - wall_normal.z * 1.5
	velocity.y = maxf(velocity.y - GRAVITY * 0.32 * delta, -3.5)
	face_dir(wall_dir, 16.0, delta)
	if int(state_time * 7.0) != int((state_time - delta) * 7.0):
		Sfx.play_at("step", global_position, -9.0, 1.1)
		Fx.burst("dust", global_position + Vector3.UP * 0.2 - wall_normal * 0.3, wall_normal, Color(1, 1, 1, 0.6), 0.5)
	if jump_buffer > 0.0:
		jump_buffer = 0.0
		velocity = wall_normal * 7.0 + wall_dir * spd * 0.8
		velocity.y = JUMP_VEL * 0.95
		jump_cut_done = true
		last_wall_normal = wall_normal
		walljump_cd = 0.2
		wall_cd = 0.35
		set_state(St.AIR)
		anim("jump", 0.06, 1.0, true)
		Sfx.play_at("jump", global_position, -5.0)
		Fx.burst("dust", global_position + Vector3.UP - wall_normal * 0.3, wall_normal, Color.WHITE, 0.8)
		return
	if take_buffer("dash"):
		wall_cd = 0.3
		set_state(St.AIR)
		if _try_dash():
			return
	if hit.is_empty() or state_time > WALLRUN_TIME or is_on_floor() or held(&"crouch"):
		wall_cd = 0.3
		velocity += wall_normal * 2.0
		if is_on_floor():
			set_state(St.GROUND)
		else:
			_enter_air(false)
		return
	if _try_ledge():
		return


func _find_ledge(dir: Vector3) -> Dictionary:
	var space := get_world_3d().direct_space_state
	var origin := global_position + Vector3.UP * 1.25
	var q := PhysicsRayQueryParameters3D.create(origin, origin + dir * 0.8, Game.L_WORLD)
	var wall := space.intersect_ray(q)
	if wall.is_empty():
		return {}
	var n: Vector3 = wall["normal"]
	if absf(n.y) > 0.3:
		return {}
	n.y = 0.0
	n = n.normalized()
	var wp: Vector3 = wall["position"]
	var top_from := Vector3(wp.x, global_position.y + 2.5, wp.z) - n * 0.2
	var q2 := PhysicsRayQueryParameters3D.create(top_from, top_from + Vector3.DOWN * 1.7, Game.L_WORLD)
	var top := space.intersect_ray(q2)
	if top.is_empty() or (top["normal"] as Vector3).y < 0.7:
		return {}
	var ledge_y: float = (top["position"] as Vector3).y
	var rel := ledge_y - global_position.y
	if rel < 0.95 or rel > 2.35:
		return {}
	var tp: Vector3 = top["position"]
	var q3 := PhysicsRayQueryParameters3D.create(tp + Vector3.UP * 0.08, tp + Vector3.UP * 1.75, Game.L_WORLD)
	if not space.intersect_ray(q3).is_empty():
		return {}
	return {"point": Vector3(wp.x, ledge_y, wp.z), "normal": n}


func _try_ledge() -> bool:
	if wall_cd > 0.0 and state != St.SWIM:
		return false
	var dir := wish_dir if wish_dir.length() > 0.3 else forward_dir()
	if is_on_wall():
		var wn := get_wall_normal()
		if wish_dir.length() > 0.3 and wish_dir.dot(-wn) < 0.2:
			return false
		dir = -Vector3(wn.x, 0.0, wn.z).normalized()
	elif wish_dir.length() < 0.3:
		return false
	var found := _find_ledge(dir.normalized())
	if found.is_empty():
		return false
	ledge = found
	var n: Vector3 = found["normal"]
	var p: Vector3 = found["point"]
	global_position = Vector3(p.x, p.y - HANG_OFFSET, p.z) + n * (radius + 0.04)
	reset_physics_interpolation()
	velocity = Vector3.ZERO
	knock = Vector3.ZERO
	face_dir(-n, 0.0, 0.0)
	jumps_left = 1
	air_dashes_left = 1
	underwater = false
	set_state(St.LEDGE)
	anim("ledge_hang", 0.12)
	Sfx.play_at("grab", global_position, -6.0)
	return true


func _st_ledge(_delta: float) -> void:
	velocity = Vector3.ZERO
	if state_time < 0.12:
		return
	if jump_buffer > 0.0 or move_input.y < -0.5:
		jump_buffer = 0.0
		var n: Vector3 = ledge["normal"]
		var p: Vector3 = ledge["point"]
		mantle_from = global_position
		mantle_to = Vector3(p.x, p.y + 0.03, p.z) - n * 0.45
		set_state(St.MANTLE)
		anim("mantle", 0.06, 1.0, true)
		Sfx.play_at("mantle", global_position, -6.0)
		return
	if move_input.y > 0.5 or pressed(&"crouch") or take_buffer("dash"):
		wall_cd = 0.4
		velocity = (ledge["normal"] as Vector3) * 2.0
		_enter_air(false)


func _st_mantle(_delta: float) -> void:
	var t := clampf(state_time / 0.5, 0.0, 1.0)
	var up := smoothstep(0.0, 0.7, t)
	var fw := smoothstep(0.45, 1.0, t)
	var pos := mantle_from
	pos.y = lerpf(mantle_from.y, mantle_to.y, up)
	pos.x = lerpf(mantle_from.x, mantle_to.x, fw)
	pos.z = lerpf(mantle_from.z, mantle_to.z, fw)
	global_position = pos
	velocity = Vector3.ZERO
	if t >= 1.0:
		set_state(St.GROUND)
		coyote = COYOTE
		if move_input.y < -0.3:
			var f := forward_dir()
			velocity = f * RUN_SPEED


# =============================================================================== nadar

func _enter_swim() -> void:
	if state == St.ATTACK:
		combat.abort()
	var impact := -velocity.y
	set_state(St.SWIM)
	underwater = false
	anim_upper("")
	model_pitch = 0.0
	velocity.y *= 0.35
	velocity.x *= 0.6
	velocity.z *= 0.6
	jumps_left = 1
	air_dashes_left = 1
	glide_armed = false
	anim("swim_idle", 0.25)
	var surf := Vector3(global_position.x, Tide.height_at(global_position), global_position.z)
	Fx.burst("splash", surf, Vector3.UP, Color.WHITE, clampf(0.8 + impact * 0.08, 0.8, 2.2))
	Fx.ring(surf, Vector3.UP, Color(1, 1, 1, 0.9), 2.0 + impact * 0.1, 0.7)
	Sfx.play_at("splash", surf, -2.0)


func _st_swim(delta: float) -> void:
	var surface: float = Tide.height_at(global_position)
	var feet_target := surface - SWIM_DEPTH - 0.02
	var head_depth := surface - (global_position.y + height * 0.93)
	var fast := held(&"dash") and stamina > 0.0 and wish_dir.length() > 0.3
	var max_speed := SWIM_FAST if fast else SWIM_SPEED
	if fast:
		spend_stamina(8.0 * delta)
	var was_under := underwater
	underwater = head_depth > 0.12
	var cur: Vector3 = Game.water_current(global_position)
	if underwater:
		# debaixo d'água: nada para onde a câmera olha
		var fwd: Vector3 = cam_rig.forward() if cam_rig else forward_dir()
		var right: Vector3 = cam_rig.flat_right() if cam_rig else right_dir()
		var want := (fwd * -move_input.y + right * move_input.x)
		if held(&"jump"):
			want.y += 0.9
		if held(&"crouch"):
			want.y -= 0.9
		if want.length() > 1.0:
			want = want.normalized()
		velocity = velocity.move_toward(want * max_speed + cur, 16.0 * delta)
		if want.length() > 0.15:
			face_dir(want, 8.0, delta)
			model_pitch = lerpf(model_pitch, asin(clampf(want.normalized().y, -1.0, 1.0)), 1.0 - exp(-6.0 * delta))
			anim("dive", 0.25, 1.15 if fast else 0.9)
		else:
			model_pitch = lerpf(model_pitch, 0.0, 1.0 - exp(-4.0 * delta))
			anim("swim_idle", 0.3)
		if int(state_time * 3.0) != int((state_time - delta) * 3.0):
			Fx.burst("bubbles", head_pos(), Vector3.UP, Color.WHITE, 0.6)
	else:
		model_pitch = lerpf(model_pitch, 0.0, 1.0 - exp(-8.0 * delta))
		var hv := Vector3(velocity.x, 0.0, velocity.z)
		hv = hv.move_toward(wish_dir * max_speed + Vector3(cur.x, 0.0, cur.z), 14.0 * delta)
		velocity.x = hv.x
		velocity.z = hv.z
		if held(&"crouch"):
			velocity.y = move_toward(velocity.y, -3.8, 20.0 * delta)
		else:
			velocity.y = clampf((feet_target - global_position.y) * 7.0, -3.0, 4.5)
		if wish_dir.length() > 0.15:
			face_dir(wish_dir, 8.0, delta)
			anim("swim", 0.25, 1.3 if fast else 1.0)
			if int(state_time * 4.0) != int((state_time - delta) * 4.0):
				Fx.burst("splash_small", Vector3(global_position.x, surface, global_position.z), Vector3.UP, Color.WHITE, 0.8)
		else:
			anim("swim_idle", 0.3)
		if jump_buffer > 0.0:
			# salto de golfinho para fora d'água
			jump_buffer = 0.0
			if _try_ledge():
				return
			velocity.y = 9.8
			jump_cut_done = true
			set_state(St.AIR)
			anim("jump", 0.08, 1.0, true)
			Fx.burst("splash", Vector3(global_position.x, surface, global_position.z), Vector3.UP, Color.WHITE, 1.1)
			Sfx.play_at("splash", global_position, -6.0, 1.3)
			return
	if was_under and not underwater:
		Fx.burst("splash_small", Vector3(global_position.x, surface, global_position.z), Vector3.UP, Color.WHITE, 1.0)
		Sfx.play_at("surface", global_position, -6.0)
	# sair da água andando
	if surface - global_position.y < SWIM_DEPTH - 0.25 and is_on_floor():
		underwater = false
		model_pitch = 0.0
		set_state(St.GROUND)
		return
	if surface - global_position.y < 0.5:
		underwater = false
		model_pitch = 0.0
		_enter_air(false)


# =============================================================================== defesa, atordoamento, itens, descanso, morte

func _enter_block() -> void:
	set_state(St.BLOCK)
	combat.block_started()
	anim_upper("block", 0.07)


func _st_block(delta: float) -> void:
	if not is_on_floor():
		anim_upper("")
		_enter_air(false)
		return
	_ground_move(delta, GUARD_SPEED)
	velocity.y = -1.5
	_face_combat(delta)
	_ground_anim(true)
	if jump_buffer > 0.0:
		anim_upper("")
		_jump()
		return
	if take_buffer("dash"):
		anim_upper("")
		set_state(St.GROUND)
		if _try_dash():
			return
		_enter_block()
	if buffer_action == "light" or buffer_action == "heavy":
		anim_upper("")
		set_state(St.GROUND)
		if combat.try_buffered():
			return
		_enter_block()
	if not held(&"block") and state_time > 0.12:
		anim_upper("", 0.15)
		set_state(St.GROUND)


func stun(seconds: float, clip: String = "hit") -> void:
	if not alive:
		return
	if state == St.ATTACK:
		combat.abort()
	anim_upper("")
	model_pitch = 0.0
	stun_time = seconds
	set_state(St.STUN)
	anim(clip, 0.05, 1.0, true)


func _st_stun(delta: float) -> void:
	if is_on_floor():
		velocity.x = move_toward(velocity.x, 0.0, DECEL * delta)
		velocity.z = move_toward(velocity.z, 0.0, DECEL * delta)
		velocity.y = -1.5
	else:
		velocity.y = maxf(velocity.y - GRAVITY * delta, -TERMINAL)
	stun_time -= delta
	if stun_time <= 0.0:
		set_state(St.GROUND if is_on_floor() else St.AIR)


func _st_item(delta: float) -> void:
	_ground_move(delta, 1.6)
	velocity.y = -1.5 if is_on_floor() else velocity.y - GRAVITY * delta
	if wish_dir.length() > 0.1:
		face_dir(wish_dir, 8.0, delta)
	_ground_anim(false)
	item_time -= delta
	if not item_used and item_time <= 0.5:
		item_used = true
		combat.finish_item()
	if item_time <= 0.0:
		anim_upper("", 0.15)
		set_state(St.GROUND)
	elif take_buffer("dash"):
		anim_upper("", 0.1)
		set_state(St.GROUND)
		_try_dash()


func start_item(clip: String, seconds: float) -> void:
	set_state(St.ITEM)
	item_time = seconds
	item_used = false
	anim_upper(clip, 0.1)


func start_rest() -> void:
	velocity = Vector3.ZERO
	anim_upper("")
	set_state(St.REST)
	anim("rest", 0.35)


func _st_rest(_delta: float) -> void:
	velocity = Vector3.ZERO
	if state_time > 0.8 and (move_input.length() > 0.4 or jump_buffer > 0.0 or buffer_action != ""):
		buffer_action = ""
		jump_buffer = 0.0
		set_state(St.GROUND)


func receive_hit(hit: Dictionary) -> String:
	if not alive:
		return "immune"
	return combat.receive(hit)


func die() -> void:
	if not alive:
		return
	super.die()
	if state == St.ATTACK:
		combat.abort()
	anim_upper("")
	model_pitch = 0.0
	underwater = false
	lock_target = null
	if cam_rig:
		cam_rig.lock_target = null
	set_state(St.DEAD)
	anim("death", 0.1, 1.0, true)
	Sfx.play("death", -2.0)
	Game.player_died(self)


func _st_dead(delta: float) -> void:
	if water_depth() > 0.6:
		velocity = velocity.move_toward(Vector3(0, 0.6, 0), 6.0 * delta)
	elif is_on_floor():
		velocity = Vector3(0, -1.5, 0)
	else:
		velocity.y = maxf(velocity.y - GRAVITY * delta, -TERMINAL)
		velocity.x = move_toward(velocity.x, 0.0, 10.0 * delta)
		velocity.z = move_toward(velocity.z, 0.0, 10.0 * delta)


## Volta à vida no ponto de descanso.
func respawn() -> void:
	alive = true
	hp = max_hp
	stamina = max_stamina
	breath = max_breath
	lungs = LUNGS
	flasks = max_flasks
	wet = 0.0
	burning = 0.0
	knock = Vector3.ZERO
	velocity = Vector3.ZERO
	invulnerable = 1.5
	global_position = respawn_point
	facing = respawn_yaw
	reset_physics_interpolation()
	if cam_rig:
		cam_rig.yaw = respawn_yaw
		cam_rig.snap()
	set_state(St.GROUND)
	anim("idle", 0.0, 1.0, true)


func teleport(pos: Vector3, yaw: float) -> void:
	global_position = pos
	facing = yaw
	velocity = Vector3.ZERO
	reset_physics_interpolation()
	if cam_rig:
		cam_rig.yaw = yaw
		cam_rig.snap()


# =============================================================================== hotbar

func select_slot(i: int) -> void:
	hotbar_index = clampi(i, 0, hotbar.size() - 1)
	var slot: Dictionary = hotbar[hotbar_index]
	if slot.get("kind", "") == "weapon":
		equip(slot["id"])


func equip(id: String) -> void:
	if id == weapon_id or state == St.ATTACK:
		return
	weapon_id = id
	visual.set_weapon(id)
	Sfx.play("equip", -8.0)


func use_slot(i: int) -> void:
	if i < 0 or i >= hotbar.size() or not can_act():
		return
	var slot: Dictionary = hotbar[i]
	match slot.get("kind", ""):
		"weapon":
			equip(slot["id"])
		"item", "skill":
			combat.use(slot)


# =============================================================================== visual

func _update_visual(delta: float) -> void:
	visual.rotation.y = facing
	visual.owner_velocity = velocity
	# inclinar nas curvas e ao acelerar
	var target_roll := 0.0
	if state == St.GROUND and horizontal_speed() > 3.0 and wish_dir.length() > 0.1:
		var turn := forward_dir().cross(wish_dir).y
		target_roll = clampf(turn * 0.35, -0.3, 0.3)
	if state != St.GLIDE:
		lean.x = lerpf(lean.x, target_roll, 1.0 - exp(-8.0 * delta))
	visual.rotation.z = lean.x
	var want_pitch := model_pitch
	if state != St.BURST and state != St.SWIM:
		want_pitch = 0.0
	visual.rotation.x = lerp_angle(visual.rotation.x, want_pitch, 1.0 - exp(-14.0 * delta))
	visual.position.y = (0.9 * (1.0 - cos(visual.rotation.x)) if absf(visual.rotation.x) > 0.01 else 0.0)
	visual.set_wet(clampf(wet / 3.0, 0.0, 1.0))
	if cam_rig and is_local:
		var fp: bool = cam_rig.fp_blend > 0.6
		visual.set_head_hidden(fp)
		cam_rig.extra_distance = lerpf(cam_rig.extra_distance, 0.9 if (sprinting or state == St.GLIDE or state == St.BURST) else 0.0, 1.0 - exp(-3.0 * delta))
	# vento no ouvido conforme a velocidade
	if is_local:
		_wind_audio = lerpf(_wind_audio, clampf((velocity.length() - 7.0) / 20.0, 0.0, 1.0), 1.0 - exp(-4.0 * delta))
		Sfx.loop_volume("rush", lerpf(-50.0, -9.0, _wind_audio), lerpf(0.8, 1.35, _wind_audio))


# =============================================================================== co-op (boneco remoto)

func net_state() -> Array:
	return [global_position, facing, net_anim, net_anim_seq, net_speed, net_upper, weapon_id, hp, state, visual.rotation.x, wet > 0.0]


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
	if String(s[5]) != net_upper:
		net_upper = s[5]
		if net_upper == "":
			visual.stop_upper(0.12)
		else:
			visual.play_upper(net_upper, 0.1)
	if String(s[6]) != weapon_id:
		weapon_id = s[6]
		visual.set_weapon(weapon_id)
	hp = float(s[7])
	state = int(s[8])
	alive = state != St.DEAD
	model_pitch = float(s[9])
	wet = 3.0 if bool(s[10]) else 0.0


func _remote_update(delta: float) -> void:
	if _net_has:
		var prev := global_position
		global_position = global_position.lerp(_net_pos, 1.0 - exp(-18.0 * delta))
		velocity = (global_position - prev) / maxf(delta, 0.0001)
	visual.rotation.y = lerp_angle(visual.rotation.y, facing, 1.0 - exp(-18.0 * delta))
	visual.rotation.x = lerp_angle(visual.rotation.x, model_pitch, 1.0 - exp(-12.0 * delta))
	visual.owner_velocity = velocity
	visual.set_wet(clampf(wet / 3.0, 0.0, 1.0))
