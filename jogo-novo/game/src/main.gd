extends Node
## Ponto de entrada: monta o mundo e decide o modo (jogo, captura de tela, testes).

const World := preload("res://src/world/world.gd")

var world: Node3D
var _shot_frames := 0


func _ready() -> void:
	Settings.apply()
	world = World.new()
	add_child(world)
	if Game.args.has("shot"):
		_setup_shot()


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
