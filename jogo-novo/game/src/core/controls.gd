extends Node
## Mapa de entradas (teclado + mouse e controle), criado em código.

const HOTBAR_SLOTS := 8

## Textos para a tela de controles (ação -> [teclado, controle, descrição]).
const HELP := [
	["WASD", "Analógico esq.", "Mover"],
	["Mouse", "Analógico dir.", "Câmera"],
	["Espaço", "A", "Pular · pulo duplo · segurar no ar: planar"],
	["Shift", "B", "Toque: investida · segurar: correr"],
	["Ctrl / C", "L3", "Deslizar · mergulhar"],
	["Q (segurar)", "LT", "Impulso de vento (carrega e solta)"],
	["Botão esq.", "RB", "Ataque leve (combo)"],
	["E", "RT", "Ataque pesado (segurar carrega)"],
	["Botão dir.", "LB", "Bloquear · no tempo certo: parry"],
	["Botão do meio / Tab", "R3", "Travar alvo"],
	["F", "Y", "Interagir · descansar"],
	["R", "Seta cima", "Usar item selecionado"],
	["1–8 / roda", "Setas esq./dir.", "Hotbar"],
	["V / F5", "Seta baixo", "Câmera 1ª / 3ª pessoa"],
	["Esc", "Start", "Pausa"],
	["F3", "Select", "Painel de depuração"],
]


func _enter_tree() -> void:
	_add("move_left", [_key(KEY_A), _axis(JOY_AXIS_LEFT_X, -1.0)])
	_add("move_right", [_key(KEY_D), _axis(JOY_AXIS_LEFT_X, 1.0)])
	_add("move_forward", [_key(KEY_W), _axis(JOY_AXIS_LEFT_Y, -1.0)])
	_add("move_back", [_key(KEY_S), _axis(JOY_AXIS_LEFT_Y, 1.0)])
	_add("look_left", [_axis(JOY_AXIS_RIGHT_X, -1.0)], 0.15)
	_add("look_right", [_axis(JOY_AXIS_RIGHT_X, 1.0)], 0.15)
	_add("look_up", [_axis(JOY_AXIS_RIGHT_Y, -1.0)], 0.15)
	_add("look_down", [_axis(JOY_AXIS_RIGHT_Y, 1.0)], 0.15)
	_add("jump", [_key(KEY_SPACE), _pad(JOY_BUTTON_A)])
	_add("dash", [_key(KEY_SHIFT), _pad(JOY_BUTTON_B)])
	_add("crouch", [_key(KEY_CTRL), _key(KEY_C), _pad(JOY_BUTTON_LEFT_STICK)])
	_add("wind", [_key(KEY_Q), _axis(JOY_AXIS_TRIGGER_LEFT, 1.0)], 0.4)
	_add("attack_light", [_mouse(MOUSE_BUTTON_LEFT), _pad(JOY_BUTTON_RIGHT_SHOULDER)])
	_add("attack_heavy", [_key(KEY_E), _axis(JOY_AXIS_TRIGGER_RIGHT, 1.0)], 0.4)
	_add("block", [_mouse(MOUSE_BUTTON_RIGHT), _pad(JOY_BUTTON_LEFT_SHOULDER)])
	_add("lock_on", [_mouse(MOUSE_BUTTON_MIDDLE), _key(KEY_TAB), _pad(JOY_BUTTON_RIGHT_STICK)])
	_add("interact", [_key(KEY_F), _pad(JOY_BUTTON_Y)])
	_add("use_item", [_key(KEY_R), _pad(JOY_BUTTON_DPAD_UP)])
	_add("hotbar_next", [_pad(JOY_BUTTON_DPAD_RIGHT)])
	_add("hotbar_prev", [_pad(JOY_BUTTON_DPAD_LEFT)])
	_add("camera_toggle", [_key(KEY_V), _key(KEY_F5), _pad(JOY_BUTTON_DPAD_DOWN)])
	_add("pause", [_key(KEY_ESCAPE), _pad(JOY_BUTTON_START)])
	_add("debug_toggle", [_key(KEY_F3), _pad(JOY_BUTTON_BACK)])
	_add("fullscreen", [_key(KEY_F11)])
	for i in HOTBAR_SLOTS:
		_add("hotbar_%d" % (i + 1), [_key(KEY_1 + i)])


func _add(action: StringName, events: Array, deadzone := 0.3) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action, deadzone)
	for e: InputEvent in events:
		InputMap.action_add_event(action, e)


func _key(code: Key) -> InputEventKey:
	var e := InputEventKey.new()
	e.physical_keycode = code
	return e


func _mouse(button: MouseButton) -> InputEventMouseButton:
	var e := InputEventMouseButton.new()
	e.button_index = button
	return e


func _pad(button: JoyButton) -> InputEventJoypadButton:
	var e := InputEventJoypadButton.new()
	e.button_index = button
	return e


func _axis(axis: JoyAxis, value: float) -> InputEventJoypadMotion:
	var e := InputEventJoypadMotion.new()
	e.axis = axis
	e.axis_value = value
	return e
