extends Node
## Rede do co-op (versão inicial; preenchida mais adiante).


func is_online() -> bool:
	return false


func is_host() -> bool:
	return true


## Aplica um golpe num alvo (no co-op, o dono do alvo é quem decide o resultado).
func deal_hit(target: Node, hit: Dictionary) -> String:
	if target == null or not is_instance_valid(target):
		return "immune"
	return target.receive_hit(hit)


func parried(attacker: Node, by: Node, perfect: bool) -> void:
	if attacker and is_instance_valid(attacker) and attacker.has_method("on_parried"):
		attacker.on_parried(by, perfect)


## Ação do mundo (maré, vento, invocar...). No co-op, quem executa é o anfitrião.
func world_action(action: String) -> void:
	if Game.stage:
		Game.stage.apply_action(action)


func broadcast_projectile(d: Dictionary) -> void:
	if Game.stage:
		Game.stage.make_projectile(d)


func broadcast_skill(_kind: String, _owner_actor: Node3D, _pos: Vector3, _dir: Vector3) -> void:
	pass


func my_id() -> int:
	return 1


func host() -> void:
	pass


func join(_address: String) -> void:
	pass


func close() -> void:
	pass
