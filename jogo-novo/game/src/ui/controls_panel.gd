extends ScrollContainer
## Lista dos controles (teclado/mouse e controle) e dos golpes.

const UiKit := preload("res://src/ui/ui_kit.gd")

const MOVES := [
	["Leve ×4", "Combo básico; o 4º é um salto com golpe vertical"],
	["Pesado (segurar carrega)", "Corte largo que empurra"],
	["Leve → Pesado", "Giro: acerta todos em volta"],
	["Leve, Leve → Pesado", "Lançador (segure Pulo para subir junto)"],
	["Leve ×3 → Pesado", "Estocada longa"],
	["No ar: Leve, Leve", "Combo aéreo que segura a queda"],
	["No ar: Pesado", "Mergulho com onda de choque"],
	["Investida ou deslize + ataque", "Estocada em investida"],
	["Agachar + Leve", "Rasteira: derruba quem está perto"],
	["Para trás + Pesado", "Chute de vento: joga longe; na parede, atordoa"],
	["Bloquear no instante do golpe", "Parry (perfeito solta uma rajada)"],
	["Leve logo após um parry", "Contra-ataque rápido"],
	["Inimigo com postura quebrada", "Leve = golpe crítico · Pesado = arremesso"],
	["Investida no instante do golpe", "Esquiva perfeita: câmera lenta e fôlego"],
	["Pulo encostado na parede", "Pulo na parede (pode encadear)"],
	["Pulo durante a investida", "Pulo longo que conserva a velocidade"],
]


func _ready() -> void:
	horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var box := VBoxContainer.new()
	box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	box.add_theme_constant_override("separation", 4)
	add_child(box)
	box.add_child(UiKit.label("Controles", 44, UiKit.GOLD, "title", 10))
	var head := _line("Teclado e mouse", "Controle", "Ação", UiKit.TEAL)
	box.add_child(head)
	for row: Array in Controls.HELP:
		box.add_child(_line(row[0], row[1], row[2], UiKit.PAPER))
	box.add_child(UiKit.label("Golpes e manobras", 44, UiKit.GOLD, "title", 10))
	for m: Array in MOVES:
		var h := HBoxContainer.new()
		var a := UiKit.label(m[0], 28, UiKit.TEAL, "hand", 6)
		a.custom_minimum_size = Vector2(400, 34)
		var b := UiKit.label(m[1], 28, UiKit.PAPER, "hand", 6)
		h.add_child(a)
		h.add_child(b)
		box.add_child(h)


func _line(a: String, b: String, c: String, col: Color) -> HBoxContainer:
	var h := HBoxContainer.new()
	for pair: Array in [[a, 300], [b, 230], [c, 520]]:
		var l := UiKit.label(pair[0], 28, col, "hand", 6)
		l.custom_minimum_size = Vector2(pair[1], 34)
		h.add_child(l)
	return h
