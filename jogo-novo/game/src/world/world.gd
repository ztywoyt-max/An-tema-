extends Node3D
## Mundo da sala de teste: céu, mar, cenário e pós-processo.

const SkyEnv := preload("res://src/world/sky_env.gd")
const Sea := preload("res://src/world/sea.gd")
const TestRoom := preload("res://src/world/test_room.gd")
const Post := preload("res://src/world/post.gd")

var sky: Node3D
var sea: Node3D
var room: Node3D
var post: MeshInstance3D


func _ready() -> void:
	name = "Mundo"
	Game.world = self
	sky = SkyEnv.new()
	sky.name = "Ceu"
	add_child(sky)
	room = TestRoom.new()
	room.name = "SalaDeTeste"
	add_child(room)
	sea = Sea.new()
	sea.name = "Mar"
	add_child(sea)
	post = Post.new()
	post.name = "PosProcesso"
	add_child(post)
