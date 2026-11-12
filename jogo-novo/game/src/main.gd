extends Node
## Ponto de entrada: monta o mundo e decide o modo (menu, jogo, captura de tela, testes).
##
## Argumentos (depois de "--"):
##   --play                 entra direto na sala de teste (sem menu)
##   --shot=arq.png         salva uma captura e sai   [--cam=x,y,z --look=x,y,z --frames=N --wait=segundos]
##   --view=hero,...        visualizador de modelos
##   --anim=clipe           folha de contato de uma animação
##   --bot=roteiro          joga sozinho seguindo um roteiro (src/dev/bot.gd)
##   --test=nome            testes automáticos (src/dev/tests.gd)

const World := preload("res://src/world/world.gd")
const Stage := preload("res://src/world/stage.gd")
const ModelUtil := preload("res://src/core/model_util.gd")

var world: Node3D
var stage: Node3D
var hud: Node
var menu: Node
var _shot_frames := 0
var _shot_wait := 0.0


func _ready() -> void:
	_load_fonts()
	Settings.apply()
	world = World.new()
	add_child(world)
	if Game.args.has("view"):
		_setup_view()
	if Game.args.has("anim"):
		var prev: Node3D = load("res://src/dev/anim_preview.gd").new()
		add_child(prev)
	var direct := Game.args.has("play") or Game.args.has("bot") or Game.args.has("test")
	if direct:
		start_game()
	elif not Game.args.has("shot") or Game.args.has("menu"):
		_show_menu()
	if Game.args.has("shot"):
		_setup_shot(not direct and not Game.args.has("menu"))
	if Game.args.has("bot"):
		var bot: Node = load("res://src/dev/bot.gd").new()
		add_child(bot)
	if Game.args.has("test"):
		var tests: Node = load("res://src/dev/tests.gd").new()
		add_child(tests)


func _load_fonts() -> void:
	for pair: Array in [["font_title", "res://assets/fonts/titulo.woff2"], ["font_ui", "res://assets/fonts/interface.woff2"], ["font_hand", "res://assets/fonts/mao.woff2"]]:
		if ResourceLoader.exists(pair[1]):
			Game.set(pair[0], load(pair[1]))
	if Game.font_hand:
		Fx.set_font(Game.font_hand)


func _show_menu() -> void:
	if ResourceLoader.exists("res://src/ui/menu.gd"):
		menu = load("res://src/ui/menu.gd").new()
		add_child(menu)
		menu.main = self
	else:
		start_game()


## Começa a partida na sala de teste. mode: "solo", "host" ou "join".
func start_game(mode: String = "solo", address: String = "") -> void:
	if stage:
		return
	if menu:
		menu.queue_free()
		menu = null
	stage = Stage.new()
	add_child(stage)
	if mode == "host":
		Net.host()
	elif mode == "join":
		Net.join(address)
	stage.spawn_player(Net.my_id(), true, str(Settings.get_v("player_name")))
	if ResourceLoader.exists("res://src/ui/hud.gd"):
		hud = load("res://src/ui/hud.gd").new()
		add_child(hud)
		Game.hud = hud
	Game.in_game = true
	Game.input_enabled = true
	if DisplayServer.get_name() != "headless" and not Game.capture_mode:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	Sfx.loop("rush", "wind_rush", -50.0)
	Sfx.loop("sea", "sea_loop", -16.0)
	Sfx.loop("music", "music_loop", -14.0, &"Musica")


## Volta ao menu inicial.
func quit_to_menu() -> void:
	Game.set_paused(false)
	Net.close()
	if hud:
		hud.queue_free()
		hud = null
		Game.hud = null
	if stage:
		stage.queue_free()
		stage = null
		Game.stage = null
	Game.player = null
	Game.players.clear()
	Game.cam_rig = null
	Game.in_game = false
	Wind.zones.clear()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	Engine.time_scale = 1.0
	_show_menu()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"fullscreen"):
		Settings.set_v("fullscreen", not bool(Settings.get_v("fullscreen")))


## Visualizador de modelos: --view=hero,sentinel [--at=x,y,z] [--yaw=graus]
func _setup_view() -> void:
	var at := Game.arg_vec3("at", Vector3(0, 0, 14))
	var names: PackedStringArray = Game.arg("view").split(",")
	var i := 0
	for n in names:
		var scene: PackedScene = load("res://assets/models/%s.glb" % n)
		if scene == null:
			push_error("modelo não encontrado: " + n)
			continue
		var inst: Node3D = scene.instantiate()
		add_child(inst)
		inst.global_position = at + Vector3((float(i) - float(names.size() - 1) * 0.5) * float(Game.arg("gap", "1.2")), 0, 0)
		inst.rotation_degrees.y = float(Game.arg("yaw", "0"))
		ModelUtil.toonify(inst)
		i += 1


## Modo captura: --shot=arquivo.png [--cam=x,y,z --look=x,y,z] [--frames=N] [--wait=s] [--fov=F]
func _setup_shot(own_camera: bool) -> void:
	if own_camera or Game.args.has("cam"):
		var cam := Camera3D.new()
		cam.name = "CameraCaptura"
		cam.fov = float(Game.arg("fov", "70"))
		cam.far = 6000.0
		cam.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
		add_child(cam)
		cam.global_position = Game.arg_vec3("cam", Vector3(0, 6, 30))
		cam.look_at(Game.arg_vec3("look", Vector3(0, 1, 0)))
		cam.make_current()
		set_meta("shot_cam", cam)
	_shot_frames = int(Game.arg("frames", "6"))
	_shot_wait = float(Game.arg("wait", "0"))
	if Game.args.has("tide"):
		Tide.set_mode(int(Game.arg("tide")))
		Tide.level = Tide.target_level()
	if Game.args.has("wind"):
		Wind.set_mode(int(Game.arg("wind")))


func _process(_delta: float) -> void:
	if not Game.args.has("shot"):
		return
	if has_meta("shot_cam"):
		(get_meta("shot_cam") as Camera3D).make_current()
	if _shot_wait > 0.0 and Game.clock < _shot_wait:
		return
	_shot_frames -= 1
	if _shot_frames == 0:
		await RenderingServer.frame_post_draw
		var img := get_viewport().get_texture().get_image()
		img.save_png(Game.arg("shot"))
		print("captura salva: ", Game.arg("shot"))
		get_tree().quit()
