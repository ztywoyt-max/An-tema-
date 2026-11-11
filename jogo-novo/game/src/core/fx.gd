extends Node
## Efeitos visuais (versão inicial; preenchida mais adiante).


func burst(_kind: String, _pos: Vector3, _dir: Vector3 = Vector3.UP, _color: Color = Color.WHITE, _scale: float = 1.0) -> void:
	pass


func ring(_pos: Vector3, _normal: Vector3 = Vector3.UP, _color: Color = Color.WHITE, _radius: float = 2.0, _time: float = 0.4) -> void:
	pass


func number(_pos: Vector3, _value: float, _kind: String = "hit") -> void:
	pass


func shake(_amount: float) -> void:
	pass
