extends Node
## Estado global do jogo e utilidades.

signal notice(text: String, kind: String)
signal currency_changed(value: int)
signal local_player_ready(player: Node3D)
signal paused_changed(paused: bool)

# Camadas de colisão (valores em bits).
const L_WORLD := 1
const L_PLAYER := 2
const L_ENEMY := 4
const L_HURT := 8
const L_INTERACT := 16
const L_ZONE := 32

const CURRENCY_NAME := "Essência"

var args: Dictionary = {}
var capture_mode := false      ## rodando para captura de tela/vídeo
var test_mode := false         ## rodando testes automáticos
var player: Node3D             ## jogador local
var players: Dictionary = {}   ## id da rede -> jogador
var world: Node3D
var hud: Node
var cam_rig: Node3D
var input_enabled := true
var paused := false
var in_game := false
var currency := 0
var clock := 0.0

var _slow_token := 0


func _enter_tree() -> void:
	for a: String in OS.get_cmdline_user_args():
		var s := a.trim_prefix("--")
		var i := s.find("=")
		if i >= 0:
			args[s.substr(0, i)] = s.substr(i + 1)
		else:
			args[s] = "1"
	capture_mode = args.has("shot") or args.has("demo") or args.has("capture")
	test_mode = args.has("test")
	process_mode = Node.PROCESS_MODE_ALWAYS


func _process(delta: float) -> void:
	if not paused:
		clock += delta


func arg(key: String, default: String = "") -> String:
	return args.get(key, default)


func arg_vec3(key: String, default: Vector3) -> Vector3:
	if not args.has(key):
		return default
	var p: PackedStringArray = String(args[key]).split(",")
	if p.size() != 3:
		return default
	return Vector3(float(p[0]), float(p[1]), float(p[2]))


func say(text: String, kind: String = "info") -> void:
	notice.emit(text, kind)


func add_currency(amount: int) -> void:
	currency = maxi(currency + amount, 0)
	currency_changed.emit(currency)


func set_currency(value: int) -> void:
	currency = maxi(value, 0)
	currency_changed.emit(currency)


## Câmera lenta local (só quando se joga sozinho, para não dessincronizar o co-op).
func slowmo(scale: float, real_seconds: float) -> void:
	if Net.is_online() or test_mode:
		return
	_slow_token += 1
	var token := _slow_token
	Engine.time_scale = scale
	await get_tree().create_timer(real_seconds, true, false, true).timeout
	if token == _slow_token:
		Engine.time_scale = 1.0


func set_paused(value: bool) -> void:
	if paused == value:
		return
	paused = value
	# No co-op o mundo continua; só a entrada local para.
	if not Net.is_online():
		get_tree().paused = value
	paused_changed.emit(value)


func layer_mask(bits: Array) -> int:
	var m := 0
	for b: int in bits:
		m |= b
	return m
