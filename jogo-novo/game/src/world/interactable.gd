extends Node3D
## Algo com que o jogador interage (F): painel, ponto de descanso...

var prompt := ""
var radius := 2.4
var action: Callable
var enabled := true


func interact(player: Node3D) -> void:
	if enabled and action.is_valid():
		action.call(player)
