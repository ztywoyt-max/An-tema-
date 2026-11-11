extends Node
## Testes automáticos: o jogo joga sozinho e confere se cada sistema funciona.
## Uso: godot --headless --fixed-fps 120 --path game -- --test=all   (ou o nome de um teste)

const Room := preload("res://src/world/test_room.gd")
## Faixa livre de obstáculos para os testes de corrida (vai para leste).
const LANE := Vector3(-30.0, 0.05, 16.0)
const LANE_YAW := -90.0

var p: Node3D
var rig: Node3D
var St: Dictionary
var passed := 0
var failed := 0
var notices: Array = []
var _held: Array = []


func _ready() -> void:
	Game.notice.connect(func(text: String, _kind: String) -> void: notices.append(text))
	process_mode = Node.PROCESS_MODE_ALWAYS
	_run.call_deferred()


func _run() -> void:
	await frames(5)
	p = Game.player
	rig = Game.cam_rig
	St = p.St
	var which := Game.arg("test", "all")
	var all := ["spawn", "run", "dash", "jump", "glide", "updraft", "slide", "wallrun", "walljump", "momentum", "ledge", "burst", "swim", "tide", "wind",
		"combo", "heavy", "air", "skills", "parry", "damage", "sentinel", "freestyle", "tokens", "death", "hotbar", "camera"]
	for t: String in all:
		if which == "all" or which == t:
			await _reset()
			await call("t_" + t)
	print("\n==== TESTES: %d ok, %d falharam ====" % [passed, failed])
	get_tree().quit(1 if failed > 0 else 0)


# ------------------------------------------------------------------------------- utilidades

func frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func wait(seconds: float) -> void:
	await frames(int(ceil(seconds * 120.0)))


func hold(action: String) -> void:
	Input.action_press(action)
	if not _held.has(action):
		_held.append(action)


func release(action: String) -> void:
	Input.action_release(action)
	_held.erase(action)


func tap(action: String, seconds: float = 0.05) -> void:
	hold(action)
	await wait(seconds)
	release(action)
	await frames(1)


func release_all() -> void:
	for a: String in _held.duplicate():
		Input.action_release(a)
	_held.clear()


func check(cond: bool, what: String, detail: String = "") -> void:
	if cond:
		passed += 1
		print("  ok    ", what, ("  [" + detail + "]") if detail != "" else "")
	else:
		failed += 1
		print("  FALHA ", what, ("  [" + detail + "]") if detail != "" else "")


func look(yaw_deg: float, pitch_deg: float = -10.0) -> void:
	rig.yaw = deg_to_rad(yaw_deg)
	rig.pitch = deg_to_rad(pitch_deg)


## Deixa o jogador inteiro, parado, num ponto, olhando para um rumo (0 = norte/-Z, 90 = oeste/-X).
func _reset(pos: Vector3 = Room.SPAWN, yaw_deg: float = 0.0) -> void:
	release_all()
	if not p.alive:
		p.respawn()
	p.hp = p.max_hp
	p.stamina = p.max_stamina
	p.breath = p.max_breath
	p.lungs = p.LUNGS
	p.wet = 0.0
	p.burning = 0.0
	p.knock = Vector3.ZERO
	p.invulnerable = 0.0
	p.buffer_action = ""
	p.jump_buffer = 0.0
	p.dash_cd = 0.0
	p.wall_cd = 0.0
	p.combat.abort()
	p.combat.set_lock(null)
	p.combat._end_combo(false)
	p.anim_upper("")
	p.underwater = false
	p.model_pitch = 0.0
	p.set_state(St.GROUND)
	p.teleport(pos, deg_to_rad(yaw_deg))
	look(yaw_deg)
	Tide.set_mode(Tide.Mode.LOW)
	Tide.level = Tide.LOW
	Wind.set_mode(Wind.Mode.BREEZE)
	Game.stage.dismiss_enemies()
	notices.clear()
	await wait(0.35)


## O golpe do inimigo vai entrar na janela de acerto dentro de `lead` segundos?
func _about_to_hit(e: Node3D, lead: float) -> bool:
	if e.atk_name == "" or e.atk_phase != 2:
		return false
	var tc: float = e.visual.time_in_clip
	return tc >= float(e.atk["a0"]) - lead and tc < float(e.atk["a0"]) + 0.02


func said(text: String) -> bool:
	for n: String in notices:
		if n.contains(text):
			return true
	return false


# ------------------------------------------------------------------------------- movimento

func t_spawn() -> void:
	print("[nascer]")
	check(p != null and p.alive, "jogador existe e está vivo")
	check(p.is_on_floor(), "está no chão", "y=%.2f" % p.global_position.y)
	check(p.state == St.GROUND, "estado inicial: chão")
	check(Game.stage.interactables.size() >= 6, "painéis de teste criados", str(Game.stage.interactables.size()))


func t_run() -> void:
	print("[correr]")
	await _reset(LANE, LANE_YAW)
	var start: Vector3 = p.global_position
	hold("move_forward")
	await wait(1.5)
	var spd: float = p.horizontal_speed()
	var dist: float = start.distance_to(p.global_position)
	check(absf(spd - p.RUN_SPEED) < 0.4, "velocidade de corrida", "%.2f m/s" % spd)
	check(dist > 8.0 and p.global_position.x > start.x + 8.0, "andou para a frente da câmera", "%.1f m" % dist)
	check(p.visual.current == "run", "animação de corrida", p.visual.current)
	release("move_forward")
	await wait(0.4)
	check(p.horizontal_speed() < 0.3, "para ao soltar", "%.2f" % p.horizontal_speed())
	check(p.visual.current == "idle", "animação parado", p.visual.current)
	# correr (segurar a tecla de investida)
	hold("move_forward")
	hold("dash")
	await wait(1.2)
	check(absf(p.horizontal_speed() - p.SPRINT_SPEED) < 0.6, "disparada ao segurar Shift", "%.2f m/s" % p.horizontal_speed())
	check(p.visual.current == "sprint", "animação de disparada", p.visual.current)
	check(p.stamina < p.max_stamina - 5.0, "disparada gasta stamina", "%.0f" % p.stamina)


func t_dash() -> void:
	print("[investida]")
	await _reset(LANE, LANE_YAW)
	var start: Vector3 = p.global_position
	var st0: float = p.stamina
	hold("move_forward")
	await frames(2)
	await tap("dash", 0.03)
	check(p.state == St.DASH, "entra em investida")
	check(p.invulnerable > 0.0, "quadros de invulnerabilidade")
	await wait(p.DASH_TIME + 0.05)
	var dist: float = start.distance_to(p.global_position)
	check(dist > 3.8, "investida percorre distância", "%.1f m" % dist)
	check(p.stamina < st0 - 10.0, "investida gasta stamina")
	check(p.state == St.GROUND, "volta ao chão depois")
	release("move_forward")
	# investida no ar: só uma
	await _reset()
	await tap("jump")
	await wait(0.2)
	hold("move_forward")
	await tap("dash", 0.03)
	check(p.state == St.DASH, "investida no ar")
	await wait(0.3)
	await tap("dash", 0.03)
	check(p.state != St.DASH, "só uma investida por salto")


func t_jump() -> void:
	print("[pulo]")
	var y0: float = p.global_position.y
	hold("jump")
	var peak := y0
	for i in 150:
		await frames(1)
		peak = maxf(peak, p.global_position.y)
	release("jump")
	check(absf((peak - y0) - 1.98) < 0.25, "altura do pulo", "%.2f m" % (peak - y0))
	await wait(0.6)
	check(p.is_on_floor() and p.state == St.GROUND, "pousa")
	# pulo curto ao soltar cedo
	await tap("jump", 0.05)
	peak = y0
	for i in 120:
		await frames(1)
		peak = maxf(peak, p.global_position.y)
	check(peak - y0 < 1.5, "pulo curto ao soltar cedo", "%.2f m" % (peak - y0))
	await wait(0.5)
	# pulo duplo
	await tap("jump", 0.3)
	await wait(0.1)
	await tap("jump", 0.05)
	check(p.visual.current == "double_jump", "pulo duplo", p.visual.current)
	peak = y0
	for i in 120:
		await frames(1)
		peak = maxf(peak, p.global_position.y)
	check(peak - y0 > 3.0, "pulo duplo sobe mais", "%.2f m" % (peak - y0))


func t_glide() -> void:
	print("[planar]")
	await _reset(Room.TOWER_TOP + Vector3(0, 0.1, 2.0), 180.0)
	hold("move_forward")
	await tap("jump", 0.3)
	await wait(0.1)
	hold("jump")
	await wait(1.6)
	check(p.state == St.GLIDE, "planando ao segurar pulo no ar", p.ST_NAMES[p.state])
	check(absf(p.velocity.y - p.GLIDE_FALL) < 0.6, "queda lenta", "%.2f m/s" % p.velocity.y)
	check(p.horizontal_speed() > 8.0, "avança planando", "%.1f m/s" % p.horizontal_speed())
	check(p.visual.current == "glide", "animação de planar", p.visual.current)
	release("jump")
	await frames(3)
	check(p.state == St.AIR, "solta e volta a cair")


func t_updraft() -> void:
	print("[corrente ascendente]")
	var z: Array = Room.UPDRAFTS[3]
	var base: Vector3 = z[0] - Vector3(0, (z[1] as Vector3).y * 0.5, 0)
	await _reset(Vector3(base.x, 0.1, base.z), 0.0)
	var y0: float = p.global_position.y
	await tap("jump", 0.2)
	await wait(0.05)
	await tap("jump", 0.05)
	hold("jump")
	await wait(2.0)
	check(p.global_position.y - y0 > 6.0, "a corrente levanta quem plana", "+%.1f m" % (p.global_position.y - y0))
	check(Wind.zones.size() >= 5, "zonas de vento registradas", str(Wind.zones.size()))


func t_slide() -> void:
	print("[deslizar]")
	await _reset(LANE, LANE_YAW)
	hold("move_forward")
	hold("dash")
	await wait(1.0)
	hold("crouch")
	await wait(0.25)
	check(p.state == St.SLIDE, "desliza ao agachar correndo", p.ST_NAMES[p.state])
	check(p.visual.current == "slide", "animação de deslizar", p.visual.current)
	var v0: float = p.horizontal_speed()
	await wait(0.6)
	check(p.horizontal_speed() < v0, "atrito no chão plano", "%.1f -> %.1f" % [v0, p.horizontal_speed()])
	release("crouch")
	release("dash")
	await wait(0.2)
	check(p.state == St.GROUND, "levanta ao soltar")
	# rampa: ganha velocidade
	await _reset(Vector3(32.7, 8.1, -20.5), 180.0)
	hold("move_forward")
	hold("dash")
	await wait(0.45)
	hold("crouch")
	await wait(1.1)
	check(p.horizontal_speed() > 11.0, "ganha velocidade na rampa", "%.1f m/s" % p.horizontal_speed())


func t_wallrun() -> void:
	print("[correr na parede]")
	# corredor: paredes em x=21 e x=27, fosso entre elas. Corre para o norte colado na parede leste.
	await _reset(Vector3(26.2, 0.1, 2.0), 0.0)
	hold("move_forward")
	hold("dash")
	await wait(0.45)
	await tap("jump", 0.12)
	hold("move_right")
	var seen := false
	var max_t := 0.0
	for i in 200:
		await frames(1)
		if p.state == St.WALLRUN:
			seen = true
			max_t = maxf(max_t, p.state_time)
	check(seen, "corre na parede", "%.2f s" % max_t)
	release("move_right")
	check(p.global_position.z < -8.0, "atravessou parte do fosso pela parede", "z=%.1f" % p.global_position.z)


func t_walljump() -> void:
	print("[pulo na parede]")
	# parede alta do norte (face em z = -26)
	await _reset(Vector3(0.0, 0.1, -23.2), 0.0)
	hold("move_forward")
	await wait(0.15)
	await tap("jump", 0.2)
	await wait(0.12)
	var z0: float = p.global_position.z
	await tap("jump", 0.04)
	check(p.velocity.z > 3.0 and p.velocity.y > 8.0, "pula para longe da parede e para cima", "vz=%.1f vy=%.1f" % [p.velocity.z, p.velocity.y])
	check(p.jumps_left == 1, "não gasta o pulo duplo", str(p.jumps_left))
	release("move_forward")
	await wait(0.25)
	check(p.global_position.z > z0 + 1.0, "afasta da parede", "%.1f m" % (p.global_position.z - z0))
	# mesma parede de novo: não pode; vira pulo duplo
	p.teleport(Vector3(0.0, 2.0, -25.3), 0.0)
	p.velocity = Vector3.ZERO
	await frames(2)
	await tap("jump", 0.04)
	check(p.visual.current == "double_jump", "na mesma parede vira pulo duplo", p.visual.current)


func t_momentum() -> void:
	print("[conservação de impulso]")
	await _reset(LANE, LANE_YAW)
	hold("move_forward")
	await wait(0.3)
	p.velocity = Vector3(18.0, 0.0, 0.0)
	await wait(0.5)
	check(p.horizontal_speed() > 12.0, "segurando a direção, a velocidade extra some devagar", "%.1f m/s" % p.horizontal_speed())
	release("move_forward")
	await wait(0.4)
	check(p.horizontal_speed() < 1.0, "soltando, para rápido", "%.1f m/s" % p.horizontal_speed())
	# pulo durante a investida = pulo longo
	await _reset(LANE, LANE_YAW)
	var start: Vector3 = p.global_position
	hold("move_forward")
	await frames(2)
	await tap("dash", 0.03)
	await wait(0.06)
	await tap("jump", 0.04)
	check(p.horizontal_speed() > 12.0 and p.velocity.y > 8.0, "pulo na investida conserva a velocidade", "%.1f m/s" % p.horizontal_speed())
	for i in 200:
		await frames(1)
		if p.is_on_floor():
			break
	check(start.distance_to(p.global_position) > 11.0, "pulo longo cobre distância", "%.1f m" % start.distance_to(p.global_position))


func t_ledge() -> void:
	print("[agarrar borda]")
	# do degrau de 1,5 m para o de 3,7 m (2,2 m acima): mais alto que o pulo, precisa agarrar a borda
	await _reset(Vector3(21.9, 1.6, -24.0), -90.0)
	hold("move_forward")
	await wait(0.25)
	await tap("jump", 0.25)
	var grabbed := false
	for i in 120:
		await frames(1)
		if p.state == St.LEDGE:
			grabbed = true
			break
	check(grabbed, "agarra a borda", p.ST_NAMES[p.state])
	check(p.visual.current == "ledge_hang", "animação pendurado", p.visual.current)
	release("move_forward")
	await wait(0.2)
	await tap("jump")
	await wait(0.7)
	check(p.global_position.y > 3.6 and p.is_on_floor(), "sobe na borda", "y=%.2f" % p.global_position.y)


func t_burst() -> void:
	print("[impulso de vento]")
	var start: Vector3 = p.global_position
	var b0: float = p.breath
	look(0.0, 25.0)
	hold("wind")
	await wait(0.2)
	check(p.state == St.CHARGE, "carrega ao segurar", p.ST_NAMES[p.state])
	await wait(0.8)
	release("wind")
	await frames(2)
	check(p.state == St.BURST, "dispara ao soltar", p.ST_NAMES[p.state])
	await wait(0.6)
	var d: Vector3 = p.global_position - start
	check(d.length() > 9.0, "impulso percorre distância", "%.1f m" % d.length())
	check(d.y > 3.0, "vai para onde a câmera aponta (para cima)", "+%.1f m" % d.y)
	check(p.breath < b0 - 30.0, "gasta fôlego de vento", "%.0f -> %.0f" % [b0, p.breath])


func t_swim() -> void:
	print("[nadar]")
	await _reset(Vector3(0, -1.0, 60.0), 0.0)
	await wait(1.2)
	check(p.state == St.SWIM, "nada ao cair no mar", p.ST_NAMES[p.state])
	check(not p.underwater, "boia na superfície")
	check(p.wet > 0.0, "fica molhado")
	var surf: float = Tide.height_at(p.global_position)
	check(absf((surf - p.global_position.y) - p.SWIM_DEPTH) < 0.3, "flutua na altura certa", "%.2f" % (surf - p.global_position.y))
	hold("move_forward")
	await wait(1.0)
	check(p.horizontal_speed() > 3.5, "nada para a frente", "%.1f m/s" % p.horizontal_speed())
	check(p.visual.current == "swim", "animação de nado", p.visual.current)
	release("move_forward")
	hold("crouch")
	await wait(1.4)
	check(p.underwater, "mergulha")
	var l0: float = p.lungs
	release("crouch")
	look(0.0, -50.0)
	hold("move_forward")
	await wait(1.0)
	check(p.lungs < l0, "o ar acaba debaixo d'água", "%.1f" % p.lungs)
	check(surf - p.global_position.y > 3.0, "nada para onde olha (para baixo)", "%.1f m" % (surf - p.global_position.y))
	check(p.visual.current == "dive", "animação de mergulho", p.visual.current)
	release("move_forward")
	hold("jump")
	await wait(2.5)
	release("jump")
	check(not p.underwater, "volta à superfície")
	# sair pela praia
	await _reset(Vector3(-18, -3.0, 38.0), 0.0)
	hold("move_forward")
	await wait(3.0)
	check(p.state == St.GROUND and p.global_position.y > -2.5, "sai da água andando pela praia", "%s y=%.2f" % [p.ST_NAMES[p.state], p.global_position.y])


func t_tide() -> void:
	print("[maré]")
	check(absf(Tide.level - Tide.LOW) < 0.05, "maré baixa")
	var terr := Vector3(22, -1.5, 28)
	check(Tide.depth_at(terr) < 0.0, "terraço seco na maré baixa")
	Net.world_action("tide")
	Net.world_action("tide")
	check(Tide.mode == Tide.Mode.HIGH, "painel muda a maré", Tide.MODE_NAMES[Tide.mode])
	await wait(10.5)
	check(absf(Tide.level - Tide.HIGH) < 0.1, "a água sobe", "%.2f" % Tide.level)
	check(Tide.depth_at(terr) > 1.0, "terraço alagado na maré alta", "%.2f m" % Tide.depth_at(terr))
	await _reset(Vector3(22, -1.5, 28), 0.0)
	Tide.set_mode(Tide.Mode.HIGH)
	Tide.level = Tide.HIGH
	await wait(0.8)
	check(p.state == St.SWIM, "no terraço alagado o jogador nada", p.ST_NAMES[p.state])


func t_wind() -> void:
	print("[vento]")
	var s0: float = Wind.strength
	Net.world_action("wind")
	await wait(4.0)
	check(Wind.mode == Wind.Mode.GALE and Wind.strength > s0 + 2.0, "painel aumenta o vento", "%.1f -> %.1f" % [s0, Wind.strength])
	var a0: float = Wind.angle
	Net.world_action("wind_dir")
	check(absf(angle_difference(a0, Wind.angle)) > 0.5, "painel gira o vento")
	# corredor de rajada empurra
	var z: Array = Room.STREAMS[0]
	check((Wind.zone_at(z[0]) as Vector3).length() > 8.0, "corredor de rajada ativo", str(Wind.zone_at(z[0])))
	await _reset(Vector3(-30, 0.1, -21.5), -90.0)
	hold("move_forward")
	await tap("jump", 0.3)
	await wait(0.45)
	check(p.horizontal_speed() > p.RUN_SPEED + 2.0, "vento a favor acelera no ar", "%.1f m/s" % p.horizontal_speed())


# ------------------------------------------------------------------------------- combate

func _dummy() -> Node3D:
	return Game.stage.get_node("Boneco1")


func _face_dummy(dist: float = 2.2) -> void:
	var d := _dummy()
	await _reset(d.global_position + Vector3(0, 0.05, dist), 0.0)


func t_combo() -> void:
	print("[combo leve]")
	await _face_dummy()
	var d := _dummy()
	var hits := [0]
	var total := [0.0]
	var cb := func(amount: float, _r: String) -> void:
		hits[0] += 1
		total[0] += amount
	d.damaged.connect(cb)
	var clips := []
	for i in 4:
		await tap("attack_light", 0.03)
		await frames(3)
		clips.append(p.visual.current)
		await wait(0.3)
	await wait(0.6)
	d.damaged.disconnect(cb)
	check(clips == ["atk_l1", "atk_l2", "atk_l3", "atk_l4"], "cadeia de 4 golpes leves", str(clips))
	check(hits[0] >= 4, "os 4 golpes acertam o boneco", "%d acertos, %.0f de dano" % [hits[0], total[0]])
	check(p.combat.combo_hits >= 4, "contador de combo conta", str(p.combat.combo_hits))
	check(p.combat.rank_name() == "Brisa", "patente do combo", p.combat.rank_name())
	check(p.stamina < p.max_stamina, "golpes gastam stamina")
	await wait(3.4)
	check(p.combat.combo_hits == 0, "combo zera depois de 3 s sem acertar")
	check(p.state == St.GROUND, "volta ao normal")


func t_heavy() -> void:
	print("[pesado, carga e ramificações]")
	await _face_dummy()
	var d := _dummy()
	var dmg := [0.0]
	var cb := func(amount: float, _r: String) -> void: dmg[0] = maxf(dmg[0], amount)
	d.damaged.connect(cb)
	await tap("attack_heavy", 0.03)
	await wait(0.9)
	var quick: float = dmg[0]
	check(quick > 28.0, "golpe pesado acerta", "%.0f" % quick)
	dmg[0] = 0.0
	hold("attack_heavy")
	await wait(0.5)
	check(p.combat.charging, "segurar carrega o golpe")
	await wait(0.9)
	release("attack_heavy")
	await wait(0.8)
	check(dmg[0] > quick * 1.5, "golpe carregado é mais forte", "%.0f contra %.0f" % [dmg[0], quick])
	# L1 -> pesado = giro
	await _face_dummy()
	await tap("attack_light", 0.03)
	await wait(0.3)
	await tap("attack_heavy", 0.03)
	await frames(3)
	check(p.visual.current == "atk_spin", "leve + pesado = giro", p.visual.current)
	await wait(0.9)
	# L1 L2 -> pesado = lançador
	await _face_dummy()
	await tap("attack_light", 0.03)
	await wait(0.3)
	await tap("attack_light", 0.03)
	await wait(0.3)
	await tap("attack_heavy", 0.03)
	await frames(3)
	check(p.visual.current == "atk_launch", "leve, leve + pesado = lançador", p.visual.current)
	await wait(0.9)
	# investida + ataque = estocada
	await _face_dummy(6.0)
	hold("move_forward")
	await frames(2)
	await tap("dash", 0.03)
	await wait(0.09)
	await tap("attack_light", 0.03)
	await frames(3)
	check(p.visual.current == "atk_thrust", "ataque na investida = estocada", p.visual.current)
	release("move_forward")
	await wait(0.8)
	d.damaged.disconnect(cb)


func t_air() -> void:
	print("[ataques no ar]")
	await _face_dummy(1.9)
	var d := _dummy()
	var hits := [0]
	var cb := func(_a: float, _r: String) -> void: hits[0] += 1
	d.damaged.connect(cb)
	await tap("jump", 0.12)
	await wait(0.12)
	await tap("attack_light", 0.03)
	await frames(3)
	check(p.visual.current == "atk_air1", "ataque leve no ar", p.visual.current)
	await wait(0.26)
	await tap("attack_light", 0.03)
	await frames(3)
	check(p.visual.current == "atk_air2", "segundo golpe no ar", p.visual.current)
	check(p.velocity.y > -3.0, "o golpe segura a queda", "%.1f" % p.velocity.y)
	await wait(0.26)
	await tap("attack_heavy", 0.03)
	await wait(0.4)
	check(p.combat.plunge_phase >= 2 or p.combat.plunge_phase == 0, "pesado no ar = mergulho", str(p.combat.plunge_phase))
	await wait(0.9)
	check(p.is_on_floor(), "mergulho termina no chão")
	check(hits[0] >= 2, "golpes no ar acertam", str(hits[0]))
	d.damaged.disconnect(cb)


func t_skills() -> void:
	print("[habilidades de vento e água]")
	await _face_dummy(4.0)
	var d := _dummy()
	var hits := [0]
	var cb := func(_a: float, _r: String) -> void: hits[0] += 1
	d.damaged.connect(cb)
	look(0.0, 0.0)
	var b0: float = p.breath
	p.use_slot(4)
	await wait(0.7)
	check(p.breath < b0 - 15.0, "Rajada gasta fôlego", "%.0f -> %.0f" % [b0, p.breath])
	check(hits[0] >= 1, "Rajada acerta o alvo à frente", str(hits[0]))
	hits[0] = 0
	p.use_slot(5)
	await wait(1.0)
	check(hits[0] >= 1, "Jato d'Água acerta", str(hits[0]))
	check(d.wet > 0.0, "o alvo fica molhado", "%.1f s" % d.wet)
	hits[0] = 0
	p.breath = p.max_breath
	p.use_slot(6)
	await wait(1.6)
	check(hits[0] >= 2, "Ciclone acerta várias vezes", str(hits[0]))
	d.damaged.disconnect(cb)
	# sem fôlego não usa
	await wait(2.5)
	p.breath = 2.0
	notices.clear()
	p.use_slot(4)
	await frames(3)
	check(said("insuficiente"), "sem fôlego a habilidade não sai")


func t_parry() -> void:
	print("[parry e bloqueio]")
	var tr: Node3D = Game.stage.trainer
	await _reset(tr.global_position + Vector3(2.0, 0.05, 0), 90.0)
	# espera o golpe e levanta a guarda no instante certo
	var done := false
	for i in 1200:
		await frames(1)
		if _about_to_hit(tr, 0.06):
			hold("block")
			done = true
			break
	check(done, "a Sentinela de treino ataca")
	await wait(0.3)
	release("block")
	check(said("Parry"), "parry no tempo certo", str(notices))
	check(p.hp >= p.max_hp - 0.01, "parry não perde vida", "%.0f" % p.hp)
	check(tr.state == tr.St.HIT, "o inimigo aparado fica atordoado")
	# bloqueio segurado (fora da janela de parry)
	await _reset(tr.global_position + Vector3(2.0, 0.05, 0), 90.0)
	hold("block")
	var st0: float = p.stamina
	var hp0: float = p.hp
	var blocked := false
	for i in 1200:
		await frames(1)
		if p.stamina < st0 - 5.0:
			blocked = true
			break
	check(blocked, "bloquear gasta stamina no impacto", "%.0f" % p.stamina)
	check(p.hp > hp0 - 5.0 and p.hp < hp0, "bloqueio deixa passar só um pouco de dano", "%.1f" % (hp0 - p.hp))
	release("block")


func t_damage() -> void:
	print("[levar dano]")
	var tr: Node3D = Game.stage.trainer
	await _reset(tr.global_position + Vector3(2.0, 0.05, 0), 90.0)
	var hp0: float = p.hp
	for i in 1200:
		await frames(1)
		if p.hp < hp0:
			break
	check(p.hp < hp0 - 10.0, "golpe em cheio tira vida", "%.0f" % (hp0 - p.hp))
	check(p.state == St.STUN, "fica atordoado ao apanhar", p.ST_NAMES[p.state])
	# esquiva perfeita
	await _reset(tr.global_position + Vector3(2.0, 0.05, 0), 90.0)
	notices.clear()
	hp0 = p.hp
	for i in 1200:
		await frames(1)
		if _about_to_hit(tr, 0.05):
			hold("move_left")
			await tap("dash", 0.03)
			break
	await wait(0.5)
	release("move_left")
	check(p.hp >= hp0, "investida no tempo certo evita o golpe")
	check(said("Esquiva perfeita"), "esquiva perfeita reconhecida", str(notices))
	# cantil
	p.hp = 30.0
	await _reset(Room.SPAWN)
	p.hp = 30.0
	var f0: int = p.flasks
	p.use_slot(3)
	await wait(1.2)
	check(p.hp > 60.0 and p.flasks == f0 - 1, "cantil cura e gasta uma carga", "vida %.0f, cargas %d" % [p.hp, p.flasks])
	# braseiro e estado molhado
	await _reset(Room.BRAZIER + Vector3(0.9, 0.05, 0), 0.0)
	await wait(0.6)
	check(p.burning > 0.0, "o braseiro põe fogo", "%.1f" % p.burning)
	p.set_wet(10.0)
	await frames(2)
	check(p.burning <= 0.0, "molhado apaga o fogo")


func t_sentinel() -> void:
	print("[Sentinela]")
	await _reset(Room.ARENA_CENTER + Vector3(0, 0.05, 6.0), 0.0)
	Net.world_action("summon")
	await frames(3)
	var list: Array = Game.stage.sentinels()
	check(list.size() == 1, "painel invoca uma Sentinela")
	if list.is_empty():
		return
	var s: Node3D = list[0]
	p.invulnerable = 999.0
	await wait(2.0)
	check(s.state != s.St.IDLE, "a Sentinela reage ao jogador", str(s.state))
	var attacked := false
	for i in 1500:
		await frames(1)
		if s.state == s.St.ATTACK:
			attacked = true
			break
	check(attacked, "a Sentinela ataca")
	p.invulnerable = 0.0
	# postura: golpes diretos enchem a barra e quebram
	s.receive_hit({"damage": 5.0, "posture": 60.0, "from": p, "from_pos": p.global_position})
	s.receive_hit({"damage": 5.0, "posture": 60.0, "from": p, "from_pos": p.global_position})
	await frames(2)
	check(s.is_staggered(), "postura quebrada deixa o inimigo aberto")
	check(said("Postura quebrada"), "aviso de postura quebrada")
	# golpe crítico
	p.teleport(s.global_position + Vector3(0, 0.05, 1.6), 0.0)
	look(0.0)
	await wait(0.3)
	var hp0: float = s.hp
	await tap("attack_light", 0.03)
	await frames(3)
	check(p.visual.current == "atk_crit", "ataque em inimigo aberto = golpe crítico", p.visual.current)
	await wait(1.2)
	check(hp0 - s.hp > 60.0, "golpe crítico causa muito dano", "%.0f" % (hp0 - s.hp))
	# matar e ganhar Essência
	var c0: int = Game.currency
	s.receive_hit({"damage": 9999.0, "from": p, "from_pos": p.global_position})
	await frames(3)
	check(not s.alive, "a Sentinela morre")
	check(Game.currency > c0, "matar dá Essência", "+%d" % (Game.currency - c0))
	await wait(2.6)
	check(Game.stage.sentinels().is_empty(), "o corpo some")
	# limite e dispensa
	for i in 6:
		Net.world_action("summon")
	await frames(3)
	check(Game.stage.sentinels().size() == Game.stage.MAX_SENTINELS, "limite de Sentinelas", str(Game.stage.sentinels().size()))
	Net.world_action("dismiss")
	await frames(3)
	check(Game.stage.sentinels().is_empty(), "painel dispensa as Sentinelas")


func _summon_at(pos: Vector3) -> Node3D:
	var s: Node3D = Game.stage.spawn_enemy("sentinel", pos, 0.0)
	await frames(2)
	return s


func t_freestyle() -> void:
	print("[golpes de corpo e finalizações]")
	# passo de aproximação: alvo a 4,5 m, o golpe fecha a distância
	await _face_dummy(5.0)
	var d := _dummy()
	var hits := [0]
	var cb := func(_a: float, _r: String) -> void: hits[0] += 1
	d.damaged.connect(cb)
	await tap("attack_light", 0.03)
	await wait(0.45)
	d.damaged.disconnect(cb)
	check(hits[0] >= 1, "golpe leve alcança alvo a 4,5 m (passo de vento)", str(hits[0]))
	check(p.global_position.distance_to(d.global_position) < 2.4, "terminou colado no alvo", "%.1f m" % p.global_position.distance_to(d.global_position))
	# rasteira derruba
	await _reset(Room.ARENA_CENTER + Vector3(0, 0.05, 1.7), 0.0)
	var s: Node3D = await _summon_at(Room.ARENA_CENTER)
	p.invulnerable = 999.0
	hold("crouch")
	await frames(2)
	await tap("attack_light", 0.03)
	await frames(3)
	check(p.visual.current == "atk_sweep", "agachar + leve = rasteira", p.visual.current)
	await wait(0.4)
	check(s.state == s.St.DOWN, "rasteira derruba o inimigo", str(s.state))
	release("crouch")
	await wait(2.4)
	check(s.state != s.St.DOWN and s.alive, "o inimigo levanta depois")
	# chute empurra longe
	Game.stage.dismiss_enemies()
	await _reset(Room.ARENA_CENTER + Vector3(0, 0.05, 1.7), 0.0)
	s = await _summon_at(Room.ARENA_CENTER)
	p.invulnerable = 999.0
	hold("crouch")
	await frames(2)
	await tap("attack_heavy", 0.03)
	await frames(3)
	check(p.visual.current == "atk_kick", "agachar + pesado = chute", p.visual.current)
	var z0: float = s.global_position.z
	release("crouch")
	await wait(1.0)
	check(z0 - s.global_position.z > 3.0, "chute joga o inimigo longe", "%.1f m" % (z0 - s.global_position.z))
	# chute contra a parede
	Game.stage.dismiss_enemies()
	await _reset(Vector3(-15.0, 0.05, -12.0), -90.0)
	s = await _summon_at(Vector3(-13.3, 0.0, -12.0))
	p.invulnerable = 999.0
	notices.clear()
	hold("crouch")
	await frames(2)
	await tap("attack_heavy", 0.03)
	release("crouch")
	await wait(0.8)
	check(said("Contra a parede"), "inimigo jogado contra a parede fica atordoado", str(notices))
	# arremesso de inimigo com a postura quebrada
	Game.stage.dismiss_enemies()
	await _reset(Room.ARENA_CENTER + Vector3(0, 0.05, 1.7), 0.0)
	s = await _summon_at(Room.ARENA_CENTER)
	p.invulnerable = 999.0
	s.receive_hit({"damage": 1.0, "posture": 60.0, "from": p, "from_pos": p.global_position})
	s.receive_hit({"damage": 1.0, "posture": 60.0, "from": p, "from_pos": p.global_position})
	await frames(2)
	var from: Vector3 = s.global_position
	await tap("attack_heavy", 0.03)
	await frames(3)
	check(p.visual.current == "atk_throw", "pesado em inimigo aberto = arremesso", p.visual.current)
	var thrown := false
	for i in 200:
		await frames(1)
		if s.state == s.St.THROWN:
			thrown = true
	check(thrown, "o inimigo é arremessado")
	check(from.distance_to(s.global_position) > 5.0, "voa longe", "%.1f m" % from.distance_to(s.global_position))
	check(s.state == s.St.DOWN or s.state == s.St.RECOVER or not s.alive, "cai derrubado", str(s.state))
	# afogar
	if s.alive:
		s.global_position = Vector3(0, -3.6, -8.0)
		await wait(0.3)
		check(not s.alive, "inimigo jogado no mar se afoga")
	# contra-ataque depois do parry
	var tr: Node3D = Game.stage.trainer
	await _reset(tr.global_position + Vector3(2.0, 0.05, 0), 90.0)
	var th := [0]
	var cb2 := func(_a: float, _r: String) -> void: th[0] += 1
	tr.damaged.connect(cb2)
	for i in 1200:
		await frames(1)
		if _about_to_hit(tr, 0.06):
			hold("block")
			break
	await wait(0.2)
	await tap("attack_light", 0.03)
	await frames(3)
	check(p.visual.current == "atk_thrust" and p.combat.move_id == "riposte", "leve depois do parry = contra-ataque", p.combat.move_id)
	release("block")
	await wait(0.5)
	check(th[0] >= 1, "o contra-ataque acerta", str(th[0]))
	tr.damaged.disconnect(cb2)


func t_tokens() -> void:
	print("[vários inimigos]")
	await _reset(Room.ARENA_CENTER + Vector3(0, 0.05, 0), 0.0)
	p.invulnerable = 999.0
	for i in 4:
		Net.world_action("summon")
	var most := 0
	var any := false
	for i in 1100:
		await frames(1)
		var n: int = Game.stage.attackers(null)
		most = maxi(most, n)
		if n > 0:
			any = true
	check(any, "os inimigos atacam em grupo")
	check(most <= 2, "no máximo dois atacam ao mesmo tempo", str(most))
	p.invulnerable = 0.0


func t_death() -> void:
	print("[morte e reaparecimento]")
	await _reset(Room.ARENA_CENTER + Vector3(4, 0.05, 4), 0.0)
	Game.set_currency(120)
	var where: Vector3 = p.global_position
	p.receive_hit({"damage": 9999.0, "from_pos": where + Vector3(0, 0, -1)})
	await frames(3)
	check(not p.alive and p.state == St.DEAD, "morre com vida zerada")
	check(p.visual.current == "death", "animação de morte", p.visual.current)
	await wait(5.2)
	check(p.alive and p.hp >= p.max_hp, "reaparece com a vida cheia")
	check(p.global_position.distance_to(p.respawn_point) < 2.0, "reaparece no ponto de descanso")
	check(Game.currency == 0, "perde a Essência ao morrer")
	var drop: Node3D = Game.stage.drop
	check(drop != null and is_instance_valid(drop) and drop.global_position.distance_to(where) < 3.0, "a Essência fica no local da morte")
	p.teleport(where, 0.0)
	await wait(0.4)
	check(Game.currency == 120, "buscar a Essência a recupera", str(Game.currency))
	# descansar
	p.hp = 40.0
	p.flasks = 0
	p.teleport(Room.REST_POINT + Vector3(0, 0.05, 1.8), 0.0)
	await wait(0.4)
	await tap("interact")
	await wait(0.3)
	check(p.state == St.REST, "descansa no ponto de descanso", p.ST_NAMES[p.state])
	check(p.hp >= p.max_hp and p.flasks == p.max_flasks, "descanso cura e reabastece o cantil")
	hold("move_forward")
	await wait(1.2)
	check(p.state == St.GROUND, "levanta ao se mexer")


func t_hotbar() -> void:
	print("[hotbar]")
	check(p.hotbar.size() == 8, "8 espaços", str(p.hotbar.size()))
	await tap("hotbar_2")
	check(p.weapon_id == "spear" and p.visual.weapon_name == "spear", "tecla 2 equipa a lança", p.weapon_id)
	await tap("hotbar_3")
	check(p.weapon_id == "club", "tecla 3 equipa o remo", p.weapon_id)
	await tap("hotbar_next")
	check(p.hotbar_index == 3, "seleção anda para o lado", str(p.hotbar_index))
	await tap("hotbar_1")
	check(p.weapon_id == "sword", "tecla 1 volta ao sabre")
	# a arma muda o golpe
	await _face_dummy()
	p.equip("club")
	var d := _dummy()
	var dmg := [0.0]
	var cb := func(amount: float, _r: String) -> void: dmg[0] = maxf(dmg[0], amount)
	d.damaged.connect(cb)
	await tap("attack_light", 0.03)
	await wait(1.0)
	d.damaged.disconnect(cb)
	check(dmg[0] > 18.0, "o remo bate mais forte que o sabre", "%.0f" % dmg[0])
	p.equip("sword")


func t_camera() -> void:
	print("[câmera]")
	check(not rig.first_person, "começa em terceira pessoa")
	var d3: float = rig.cam.global_position.distance_to(p.global_position + Vector3.UP * 1.5)
	check(d3 > 3.0, "câmera atrás do personagem", "%.1f m" % d3)
	await tap("camera_toggle")
	await wait(0.6)
	check(rig.first_person, "V alterna para primeira pessoa")
	var d1: float = rig.cam.global_position.distance_to(p.global_position + Vector3.UP * 1.64)
	check(d1 < 0.4, "câmera nos olhos", "%.2f m" % d1)
	look(40.0)
	await wait(0.4)
	check(absf(angle_difference(p.facing, deg_to_rad(40.0))) < 0.15, "em 1ª pessoa o corpo acompanha a câmera")
	await tap("camera_toggle")
	await wait(0.6)
	check(not rig.first_person, "volta para terceira pessoa")
	# trava de alvo
	await _face_dummy(5.0)
	await tap("lock_on")
	check(p.lock_target != null, "trava no alvo à frente")
	hold("move_right")
	await wait(0.8)
	release("move_right")
	var to: Vector3 = (p.lock_target.global_position - p.global_position)
	to.y = 0.0
	check(p.forward_dir().dot(to.normalized()) > 0.9, "com alvo travado o corpo encara o alvo")
	check(p.visual.current.begins_with("guard"), "anda em guarda", p.visual.current)
	await tap("lock_on")
	check(p.lock_target == null, "destrava")
