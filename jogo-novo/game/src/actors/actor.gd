extends CharacterBody3D
## Base de jogadores e inimigos: vida, postura, estados (molhado, em chamas),
## recebimento de golpes e empurrão.

signal damaged(amount: float, result: String)
signal died(actor: Node)
signal posture_broken(actor: Node)

const TEAM_PLAYER := 0
const TEAM_ENEMY := 1

var team := TEAM_ENEMY
var display_name := ""
var max_hp := 100.0
var hp := 100.0
var max_posture := 100.0
var posture := 0.0
var posture_regen := 14.0
var posture_delay := 0.0
var alive := true
var invulnerable := 0.0          ## segundos restantes de invulnerabilidade
var wet := 0.0                   ## segundos restantes do estado Molhado
var burning := 0.0               ## segundos restantes em chamas
var hitstop := 0.0
var radius := 0.36
var height := 1.76
var knock := Vector3.ZERO        ## velocidade de empurrão (decai)
var net_id := 0

var _burn_tick := 0.0


func _enter_tree() -> void:
	add_to_group(&"actors")


func center() -> Vector3:
	return global_position + Vector3.UP * (height * 0.55)


func head_pos() -> Vector3:
	return global_position + Vector3.UP * (height * 0.92)


func is_enemy_of(other: Node) -> bool:
	return other != self and other.team != team


## Segmento central da cápsula (para testes de golpe).
func capsule_segment() -> Array[Vector3]:
	return [global_position + Vector3.UP * radius, global_position + Vector3.UP * maxf(height - radius, radius + 0.01)]


## Multiplicador de dano por elemento, considerando o estado Molhado.
func element_factor(element: String) -> float:
	if wet > 0.0:
		match element:
			"fire":
				return 0.5
			"lightning":
				return 1.5
			"ice":
				return 1.3
	return 1.0


## Recebe um golpe. hit: {damage, posture, knock: Vector3, launch, from: Node, from_pos: Vector3,
## kind, unblockable, element}. Devolve "hit", "blocked", "parried", "dodged" ou "immune".
func receive_hit(hit: Dictionary) -> String:
	if not alive:
		return "immune"
	if invulnerable > 0.0:
		return "dodged"
	var dmg: float = float(hit.get("damage", 0.0)) * element_factor(hit.get("element", ""))
	apply_damage(dmg, hit)
	add_posture(float(hit.get("posture", 0.0)))
	var k: Vector3 = hit.get("knock", Vector3.ZERO)
	if k != Vector3.ZERO:
		knock += k
	if hit.get("element", "") == "water":
		set_wet(12.0)
	if hit.get("element", "") == "fire":
		ignite(4.0)
	return "hit"


func apply_damage(amount: float, _hit: Dictionary = {}) -> void:
	if not alive or amount <= 0.0:
		return
	hp = maxf(hp - amount, 0.0)
	damaged.emit(amount, "hit")
	if hp <= 0.0:
		die()


func heal(amount: float) -> void:
	if alive:
		hp = minf(hp + amount, max_hp)


func add_posture(amount: float) -> void:
	if amount <= 0.0 or not alive or max_posture <= 0.0:
		return
	posture = minf(posture + amount, max_posture)
	posture_delay = 2.2
	if posture >= max_posture:
		_on_posture_broken()


func _on_posture_broken() -> void:
	posture_broken.emit(self)


func die() -> void:
	if not alive:
		return
	alive = false
	hp = 0.0
	died.emit(self)


func set_wet(seconds: float) -> void:
	wet = maxf(wet, seconds)
	if burning > 0.0:
		burning = 0.0


func ignite(seconds: float) -> void:
	if wet > 0.0:
		return
	burning = maxf(burning, seconds)


## Atualiza temporizadores comuns. Chamar no _physics_process.
func tick_status(delta: float) -> void:
	if invulnerable > 0.0:
		invulnerable -= delta
	if hitstop > 0.0:
		hitstop -= delta
	if posture_delay > 0.0:
		posture_delay -= delta
	elif posture > 0.0 and posture < max_posture:
		posture = maxf(posture - posture_regen * delta, 0.0)
	if Tide.depth_at(global_position + Vector3.UP * 0.9) > 0.0:
		set_wet(12.0)
	elif wet > 0.0:
		wet -= delta
	if burning > 0.0:
		burning -= delta
		_burn_tick -= delta
		if _burn_tick <= 0.0:
			_burn_tick = 0.5
			apply_damage(3.0, {"element": "fire"})
	if hitstop <= 0.0:
		knock = knock.move_toward(Vector3.ZERO, delta * 28.0)
