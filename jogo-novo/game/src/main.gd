extends Node
## Ponto de entrada: monta o mundo e decide o modo (jogo, captura de tela, testes).

const World := preload("res://src/world/world.gd")
const ModelUtil := preload("res://src/core/model_util.gd")

var world: Node3D
var _shot_frames := 0


func _ready() -> void:
	Settings.apply()
	world = World.new()
	add_child(world)
	if Game.args.has("view"):
		_setup_view()
	if Game.args.has("anim"):
		var prev: Node3D = load("res://src/dev/anim_preview.gd").new()
		add_child(prev)
	if Game.args.has("shot"):
		_setup_shot()


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


## Modo captura: --shot=arquivo.png --cam=x,y,z --look=x,y,z [--frames=N] [--fov=F]
func _setup_shot() -> void:
	var cam := Camera3D.new()
	cam.name = "CameraCaptura"
	cam.fov = float(Game.arg("fov", "70"))
	cam.far = 6000.0
	cam.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	add_child(cam)
	cam.global_position = Game.arg_vec3("cam", Vector3(0, 6, 30))
	cam.look_at(Game.arg_vec3("look", Vector3(0, 1, 0)))
	cam.make_current()
	_shot_frames = int(Game.arg("frames", "6"))
	if Game.args.has("tide"):
		Tide.set_mode(int(Game.arg("tide")))
		Tide.level = Tide.target_level()
	if Game.args.has("wind"):
		Wind.set_mode(int(Game.arg("wind")))
	set_process(true)


func _process(_delta: float) -> void:
	if not Game.args.has("shot"):
		return
	_shot_frames -= 1
	if _shot_frames == 0:
		await RenderingServer.frame_post_draw
		var img := get_viewport().get_texture().get_image()
		img.save_png(Game.arg("shot"))
		print("captura salva: ", Game.arg("shot"))
		get_tree().quit()
