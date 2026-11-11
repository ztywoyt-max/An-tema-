extends RefCounted
## Itens da hotbar: armas, consumíveis e habilidades de Vento e Água.

const DEFS := {
	"sword": {"kind": "weapon", "name": "Sabre", "desc": "Rápido e equilibrado.", "icon": "sword"},
	"spear": {"kind": "weapon", "name": "Lança", "desc": "Alcance longo, estocadas.", "icon": "spear"},
	"club": {"kind": "weapon", "name": "Remo de Guerra", "desc": "Lento e pesado; quebra posturas.", "icon": "club"},
	"flask": {"kind": "item", "name": "Cantil", "desc": "Recupera vida. Reabastece ao descansar.", "icon": "flask"},
	"gust": {"kind": "skill", "name": "Rajada", "desc": "Sopro que empurra inimigos e devolve projéteis. No ar, te joga para trás.", "icon": "gust", "cost": 22.0},
	"wave": {"kind": "skill", "name": "Jato d'Água", "desc": "Projétil que molha e empurra. Alvo molhado escorrega mais longe.", "icon": "wave", "cost": 18.0},
	"cyclone": {"kind": "skill", "name": "Ciclone", "desc": "Redemoinho que puxa e levanta inimigos — e você, se pular dentro.", "icon": "cyclone", "cost": 45.0},
}

## Multiplicadores por arma (as animações são as do sabre; muda alcance, ritmo e peso).
const WEAPONS := {
	"sword": {"reach": 0.42, "speed": 1.0, "dmg": 1.0, "posture": 1.0, "stam": 1.0, "lunge": 1.0, "color": Color(0.75, 1.0, 0.97)},
	"spear": {"reach": 0.4, "speed": 0.92, "dmg": 0.95, "posture": 0.85, "stam": 1.05, "lunge": 1.35, "color": Color(0.6, 0.95, 1.0)},
	"club": {"reach": 0.5, "speed": 0.74, "dmg": 1.55, "posture": 1.9, "stam": 1.6, "lunge": 0.85, "color": Color(1.0, 0.86, 0.6)},
}


static func slot(id: String) -> Dictionary:
	if id == "":
		return {"id": "", "kind": ""}
	var d: Dictionary = (DEFS[id] as Dictionary).duplicate()
	d["id"] = id
	return d


static func default_hotbar() -> Array:
	var out := []
	for id: String in ["sword", "spear", "club", "flask", "gust", "wave", "cyclone", ""]:
		out.append(slot(id))
	return out
