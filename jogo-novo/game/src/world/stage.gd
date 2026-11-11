extends Node3D
## A partida na sala de teste: jogadores, inimigos, zonas de vento, painéis, ponto de
## descanso, coletáveis e habilidades.

const Player := preload("res://src/player/player.gd")
const CameraRig := preload("res://src/player/camera_rig.gd")
const Sentinel := preload("res://src/enemies/sentinel.gd")
const Dummy := preload("res://src/enemies/dummy.gd")
const Totem := preload("res://src/enemies/totem.gd")
const Projectile := preload("res://src/fx/projectile.gd")
const WindZone := preload("res://src/world/wind_zone.gd")
const Cyclone := preload("res://src/world/cyclone.gd")
const Interactable := preload("res://src/world/interactable.gd")
const Pickup := preload("res://src/world/pickup.gd")
const Flag := preload("res://src/world/flag.gd")
const Room := preload("res://src/world/test_room.gd")
const Build := preload("res://src/world/build.gd")
const Geo := preload("res://src/core/geo.gd")

const MAX_SENTINELS := 4
const TOTEM_POS := Vector3(-33.5, 0.0, -20.0)

var players: Dictionary = {}
var local_player: Node3D
var cam_rig: Node3D
var interactables: Array = []
var currents: Array = []
var totem: Node3D
var trainer: Node3D
var drop: Node3D
var enemy_uid := 100
var brazier_pos := Room.BRAZIER
var _respawn_pending := false
var _fire_t := 0.0
var _hazard_msg := 0.0


func _ready() -> void:
	name = "Partida"
	Game.stage = self
	_build_zones()
	_build_props()
	_build_interactables()
	_spawn_fixed_enemies()
	_spawn_pickups()


# =============================================================================== montagem

func _build_zones() -> void:
	for z: Array in Room.UPDRAFTS + Room.STREAMS:
		var wz := WindZone.new()
		wz.size = z[1]
		wz.vector = z[2]
		wz.position = z[0]
		add_child(wz)
		if (z[2] as Vector3).y > 1.0:
			# marca no chão onde a corrente sobe
			var base: Vector3 = z[0] - Vector3(0, (z[1] as Vector3).y * 0.5, 0)
			var ring := Build.cylinder(self, base + Vector3(0, 0.03, 0), (z[1] as Vector3).x * 0.48, 0.04, Build.toon({"tint": Color("#8ff2e6"), "use_vertex_color": false, "emission_color": Color(0.5, 1.0, 0.92), "emission_energy": 0.6}), false, -1.0, 28)
			ring.name = "MarcaCorrente"
	for c: Array in Room.CURRENTS:
		currents.append(c)


func _build_props() -> void:
	for p: Vector3 in Room.FLAGS:
		var f := Flag.new()
		f.position = p
		add_child(f)
	# braseiro (perigo de fogo; o estado Molhado protege)
	var stone := Build.painted(Build.P_BLOCKS, Color("#6c6684"), Color("#575270"), {"tile": Vector2(0.6, 0.3)})
	Build.cylinder(self, brazier_pos + Vector3(0, 0.3, 0), 0.75, 0.6, stone, true, 0.9, 12)
	var light := OmniLight3D.new()
	light.position = brazier_pos + Vector3(0, 1.3, 0)
	light.light_color = Color(1.0, 0.6, 0.25)
	light.light_energy = 1.6
	light.omni_range = 7.0
	add_child(light)


func _panel(pos: Vector3, title: String, prompt: String, color: Color, action: Callable, radius: float = 2.4) -> Node3D:
	var it := Interactable.new()
	it.position = pos
	it.prompt = prompt
	it.radius = radius
	it.action = action
	add_child(it)
	var stone := Build.painted(Build.P_BLOCKS, Color("#dccaa6"), Color("#c3ad88"), {"tile": Vector2(0.5, 0.25), "line_color": Color("#756585")})
	Build.box(it, Vector3(0, 0.5, 0), Vector3(0.9, 1.0, 0.9), stone, true)
	Build.box(it, Vector3(0, 1.06, 0), Vector3(1.05, 0.12, 1.05), Build.painted(Build.P_PLAIN, color, color.darkened(0.15)), false)
	var gem := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.2
	sm.height = 0.4
	sm.radial_segments = 6
	sm.rings = 3
	gem.mesh = sm
	gem.material_override = Build.toon({"tint": color.lightened(0.3), "use_vertex_color": false, "emission_color": color, "emission_energy": 0.8, "spec_size": 0.2})
	gem.position = Vector3(0, 1.45, 0)
	it.add_child(gem)
	var label := Label3D.new()
	label.text = title
	label.font = Game.font_title if Game.font_title else null
	label.font_size = 56
	label.pixel_size = 0.0055
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.modulate = Color(1.0, 0.98, 0.92)
	label.outline_modulate = Color(0.1, 0.08, 0.25)
	label.outline_size = 16
	label.position = Vector3(0, 2.15, 0)
	it.add_child(label)
	it.set_meta("label", label)
	interactables.append(it)
	return it


func _build_interactables() -> void:
	# ponto de descanso
	var rest := _panel(Room.REST_POINT, "Ponto de descanso", "Descansar", Color("#1fb3a4"), _do_rest, 2.8)
	rest.name = "PontoDeDescanso"
	_panel(Room.TIDE_PANEL, "Maré", "Mudar a maré", Color("#2d8fd8"), func(_p: Node3D) -> void: Net.world_action("tide"))
	_panel(Room.WIND_PANEL, "Vento · força", "Mudar a força do vento", Color("#8ff2e6"), func(_p: Node3D) -> void: Net.world_action("wind"))
	_panel(Room.WIND_PANEL + Vector3(-3.0, 0, 0), "Vento · direção", "Girar o vento", Color("#8ff2e6"), func(_p: Node3D) -> void: Net.world_action("wind_dir"))
	_panel(Room.SUMMON_PANEL, "Invocar Sentinela", "Invocar uma Sentinela", Color("#d6457a"), func(_p: Node3D) -> void: Net.world_action("summon"))
	_panel(Room.SUMMON_PANEL + Vector3(0, 0, 3.0), "Dispensar inimigos", "Dispensar as Sentinelas", Color("#6b3fa0"), func(_p: Node3D) -> void: Net.world_action("dismiss"))
	_panel(TOTEM_POS + Vector3(3.2, 0, 3.0), "Totem de água", "Ligar / desligar o totem", Color("#2d8fd8"), func(_p: Node3D) -> void: Net.world_action("totem"))


func _spawn_fixed_enemies() -> void:
	var i := 0
	for p: Vector3 in Room.DUMMIES:
		var d := Dummy.new()
		d.position = p
		d.name = "Boneco%d" % i
		add_child(d)
		i += 1
	trainer = Sentinel.new()
	trainer.mode = "trainer"
	trainer.position = Room.PARRY_TRAINER
	trainer.spawn_yaw = -PI * 0.5
	trainer.name = "SentinelaDeTreino"
	trainer.uid = 1
	add_child(trainer)
	trainer.display_name = "Sentinela de treino (parry)"
	totem = Totem.new()
	totem.position = TOTEM_POS
	totem.name = "Totem"
	totem.uid = 2
	add_child(totem)


func _spawn_pickups() -> void:
	for p: Vector3 in [Vector3(-12, -6.9, 34), Vector3(-2, -6.9, 40), Vector3(4, -6.9, 30), Vector3(0, -6.0, -8), Vector3(-71, 2.0, -12), Vector3(66, 6.0, 0), Vector3(24, -3.5, -11)]:
		var pk := Pickup.new()
		pk.amount = 25
		pk.position = p
		add_child(pk)


# =============================================================================== jogadores

func spawn_player(peer_id: int, is_local: bool, player_name: String = "") -> Node3D:
	if players.has(peer_id):
		return players[peer_id]
	var p := Player.new()
	p.name = "Jogador%d" % peer_id
	p.peer_id = peer_id
	p.is_local = is_local
	p.display_name = player_name
	var slot := players.size()
	p.position = Room.SPAWN + Vector3(float(slot % 2) * 1.6 - 0.8 * float(mini(slot, 1)), 0, float(slot / 2) * 1.6)
	add_child(p)
	players[peer_id] = p
	Game.players[peer_id] = p
	p.respawn_point = Room.REST_POINT + Vector3(2.4, 0.05, 1.0)
	p.respawn_yaw = 0.0
	if is_local:
		local_player = p
		Game.player = p
		cam_rig = CameraRig.new()
		cam_rig.name = "CameraDoJogador"
		add_child(cam_rig)
		cam_rig.target = p
		p.cam_rig = cam_rig
		Game.cam_rig = cam_rig
		Game.local_player_ready.emit(p)
	else:
		p.collision_layer = 0
		p.collision_mask = 0
	_rescale_enemies()
	return p


func remove_player(peer_id: int) -> void:
	if players.has(peer_id):
		var p: Node3D = players[peer_id]
		players.erase(peer_id)
		Game.players.erase(peer_id)
		p.queue_free()


func _rescale_enemies() -> void:
	var n := maxi(players.size(), 1)
	for e: Node in get_tree().get_nodes_in_group(&"enemies"):
		if e is Sentinel and e.mode == "normal":
			var ratio: float = e.hp / e.max_hp
			e.max_hp = 150.0 * (1.0 + 0.6 * float(n - 1))
			e.hp = e.max_hp * ratio


# =============================================================================== inimigos

func spawn_enemy(kind: String, pos: Vector3, yaw: float = 0.0, uid: int = -1) -> Node3D:
	if kind == "sentinel":
		var e := Sentinel.new()
		e.position = pos
		e.spawn_yaw = yaw
		if uid < 0:
			enemy_uid += 1
			uid = enemy_uid
		e.uid = uid
		e.name = "Sentinela%d" % uid
		e.is_puppet = Net.is_online() and not Net.is_host()
		add_child(e)
		e.max_hp = 150.0 * (1.0 + 0.6 * float(maxi(players.size(), 1) - 1))
		e.hp = e.max_hp
		Fx.ring(pos + Vector3.UP * 0.1, Vector3.UP, Color(0.85, 0.3, 0.45), 2.4, 0.5)
		Fx.burst("shock", pos, Vector3.UP, Color(0.9, 0.5, 0.6), 1.0)
		Sfx.play_at("summon", pos, -2.0)
		return e
	return null


func sentinels() -> Array:
	var out := []
	for e: Node in get_tree().get_nodes_in_group(&"enemies"):
		if e is Sentinel and e.mode == "normal" and e.alive:
			out.append(e)
	return out


func find_enemy(uid: int) -> Node3D:
	for e: Node in get_tree().get_nodes_in_group(&"enemies"):
		if "uid" in e and e.uid == uid:
			return e
	return null


func enemy_died(e: Node3D) -> void:
	var reward := 40
	if e is Sentinel:
		reward = e.reward
	Game.add_currency(reward)
	Game.say("+%d %s" % [reward, Game.CURRENCY_NAME], "gold")
	Fx.burst("essence", e.center(), Vector3.UP, Color(1.0, 0.95, 0.6), 1.4)


func dismiss_enemies() -> void:
	for e: Node in sentinels():
		e.queue_free()


## Ações do mundo (no co-op só o anfitrião executa; os outros pedem pela rede).
func apply_action(action: String) -> void:
	match action:
		"tide":
			Tide.cycle_mode()
			Game.say("Maré: " + Tide.MODE_NAMES[Tide.mode], "info")
			Sfx.play("bell", -4.0)
		"wind":
			Wind.cycle_mode()
			Game.say("Vento: " + Wind.MODE_NAMES[Wind.mode], "info")
			Sfx.play("chime", -4.0)
		"wind_dir":
			Wind.rotate_direction(PI * 0.25)
			Game.say("O vento mudou de direção", "info")
			Sfx.play("chime", -4.0, 1.2)
		"summon":
			if sentinels().size() >= MAX_SENTINELS:
				Game.say("Já há %d Sentinelas" % MAX_SENTINELS, "bad")
			else:
				var a := randf() * TAU
				spawn_enemy("sentinel", Room.ARENA_CENTER + Vector3(cos(a), 0, sin(a)) * randf_range(1.0, 5.0), a)
		"dismiss":
			dismiss_enemies()
			Game.say("Sentinelas dispensadas", "info")
		"totem":
			if not totem.alive:
				totem.restore()
			totem.set_active(not totem.active)
			Game.say("Totem de água " + ("ligado" if totem.active else "desligado"), "info")


func _do_rest(p: Node3D) -> void:
	if not p.is_on_floor():
		return
	p.respawn_point = Room.REST_POINT + Vector3(2.4, 0.05, 1.0)
	p.hp = p.max_hp
	p.flasks = p.max_flasks
	p.stamina = p.max_stamina
	p.breath = p.max_breath
	p.burning = 0.0
	p.start_rest()
	Game.say("Você descansou. Cantil reabastecido.", "good")
	Sfx.play("rest", -3.0)
	Fx.burst("heal", p.center(), Vector3.UP, Color(0.5, 1.0, 0.8), 1.4)
	Fx.ring(p.global_position + Vector3.UP * 0.1, Vector3.UP, Color(0.5, 1.0, 0.85), 3.0, 0.6)
	if not Net.is_online():
		dismiss_enemies()
		if not totem.alive:
			totem.restore()


# =============================================================================== interação

func nearest_interactable(pos: Vector3) -> Node3D:
	var best: Node3D = null
	var bd := 1e9
	for it: Node3D in interactables:
		if not is_instance_valid(it) or not it.enabled:
			continue
		var d := it.global_position.distance_to(pos)
		if d < it.radius and d < bd:
			bd = d
			best = it
	return best


func interact(player: Node3D) -> void:
	var it := nearest_interactable(player.global_position)
	if it:
		player.anim_upper("interact", 0.08)
		get_tree().create_timer(0.45).timeout.connect(func() -> void:
			if is_instance_valid(player) and player.net_upper == "interact":
				player.anim_upper("", 0.2))
		it.interact(player)


func water_current(pos: Vector3) -> Vector3:
	if Tide.depth_at(pos + Vector3.UP * 0.2) <= 0.0:
		return Vector3.ZERO
	var v := Vector3.ZERO
	for c: Array in currents:
		var l: Vector3 = pos - (c[0] as Vector3)
		var h: Vector3 = (c[1] as Vector3) * 0.5
		if absf(l.x) <= h.x and absf(l.y) <= h.y and absf(l.z) <= h.z:
			v += c[2]
	return v


# =============================================================================== morte e reaparecimento

func on_player_died(p: Node3D) -> void:
	if not p.is_local or _respawn_pending:
		return
	_respawn_pending = true
	Game.say("Você morreu", "death")
	# a Essência fica no local da morte; morrer de novo antes de buscar a perde
	if drop and is_instance_valid(drop):
		drop.queue_free()
		Game.say("A Essência deixada para trás se perdeu", "bad")
	var lost := Game.currency
	if lost > 0:
		drop = Pickup.new()
		drop.amount = lost
		drop.is_drop = true
		var at: Vector3 = p.global_position + Vector3.UP * 1.0
		if Tide.depth_at(at) > 0.0:
			at.y = Tide.level + 0.6
		drop.position = at
		add_child(drop)
		Game.set_currency(0)
	await get_tree().create_timer(3.2).timeout
	if not is_instance_valid(p):
		return
	if Game.hud:
		await Game.hud.fade(true, 0.5)
	if not Net.is_online():
		dismiss_enemies()
		if not totem.alive:
			totem.restore()
	p.respawn()
	_respawn_pending = false
	if Game.hud:
		Game.hud.fade(false, 0.6)


# =============================================================================== habilidades e projéteis

func spawn_projectile(d: Dictionary) -> void:
	Net.broadcast_projectile(d)


func make_projectile(d: Dictionary) -> void:
	var pr := Projectile.new()
	pr.team = int(d["team"])
	pr.velocity = d["vel"]
	pr.damage = float(d["damage"])
	pr.posture = float(d.get("posture", 0.0))
	pr.knock = float(d.get("knock", 4.0))
	pr.element = d.get("element", "water")
	pr.wind_factor = float(d.get("wind", 0.8))
	pr.color = d.get("color", Color(0.45, 0.9, 1.0))
	var owner_node: Node = get_node_or_null(d["owner"]) if d.has("owner") else null
	pr.owner_actor = owner_node
	pr.authoritative = owner_node != null and (owner_node.is_in_group(&"players") and owner_node.is_local or (not owner_node.is_in_group(&"players") and Net.is_host()))
	add_child(pr)
	pr.global_position = d["pos"]


## kind: "gust", "wave" ou "cyclone". local = fomos nós que lançamos (aplicamos o dano).
func spawn_skill(kind: String, owner_actor: Node3D, pos: Vector3, dir: Vector3, local: bool) -> void:
	if local:
		Net.broadcast_skill(kind, owner_actor, pos, dir)
	match kind:
		"gust":
			_gust(owner_actor, pos, dir, local)
		"wave":
			if local:
				spawn_projectile({"pos": pos + dir * 0.4, "vel": dir * 24.0, "team": owner_actor.team, "owner": owner_actor.get_path(), "damage": 14.0,
					"posture": 10.0, "knock": 5.0, "element": "water", "wind": 0.5, "color": Color(0.4, 0.85, 1.0)})
			Sfx.play_at("water_cast", pos, -2.0)
			Fx.burst("splash", pos, dir, Color(0.7, 0.95, 1.0), 1.0)
		"cyclone":
			var c := Cyclone.new()
			c.owner_actor = owner_actor
			c.authoritative = local
			c.position = pos
			add_child(c)


func _gust(owner_actor: Node3D, pos: Vector3, dir: Vector3, local: bool) -> void:
	Sfx.play_at("burst", pos, -1.0, 1.15)
	Fx.burst("burst", pos, dir, Color(0.85, 1.0, 0.98), 1.6)
	for i in 4:
		Fx.ring(pos + dir * (1.2 + 2.2 * float(i)), dir, Color(0.85, 1.0, 0.98, 0.9), 1.6 + 0.9 * float(i), 0.3 + 0.07 * float(i))
	Fx.shake(0.18)
	if not local:
		return
	for a: Node in get_tree().get_nodes_in_group(&"actors"):
		if not a.alive or not a.is_enemy_of(owner_actor):
			continue
		var d: Vector3 = a.center() - pos
		if d.length() < 10.0 and d.normalized().dot(dir) > 0.7:
			var push := Geo.flat(dir).normalized() * 13.0
			var res: String = Net.deal_hit(a, {"damage": 8.0, "posture": 22.0, "knock": push, "launch": 2.5, "from": owner_actor,
				"from_pos": owner_actor.global_position, "kind": "gust", "element": "wind"})
			if res == "hit" and owner_actor.is_in_group(&"players"):
				owner_actor.combat.register_hit(8.0, a.head_pos())
	# devolve projéteis inimigos que estiverem no cone
	for n: Node in get_children():
		if n is Projectile and n.team != owner_actor.team:
			var d2: Vector3 = n.global_position - pos
			if d2.length() < 11.0 and d2.normalized().dot(dir) > 0.6:
				n.reflect(owner_actor)


# =============================================================================== perigos

func _physics_process(delta: float) -> void:
	_fire_t -= delta
	if _fire_t <= 0.0:
		_fire_t = 0.09
		Fx.burst("fire", brazier_pos + Vector3(0, 0.75, 0), Vector3.UP, Color(1.0, 0.62, 0.2), 1.0)
	_hazard_msg -= delta
	var p := local_player
	if p and is_instance_valid(p) and p.alive:
		var d := Geo.flat(p.global_position - brazier_pos).length()
		if d < 1.25 and absf(p.global_position.y - brazier_pos.y) < 1.6:
			if p.wet > 0.0:
				if _hazard_msg <= 0.0:
					_hazard_msg = 3.0
					Game.say("Molhado: o fogo não pega", "info")
					Fx.burst("wind_puff", p.center(), Vector3.UP, Color(0.9, 0.95, 1.0), 1.2)
			elif p.burning <= 0.5:
				p.ignite(3.0)
				if _hazard_msg <= 0.0:
					_hazard_msg = 3.0
					Game.say("Em chamas! Entre na água para apagar", "bad")
