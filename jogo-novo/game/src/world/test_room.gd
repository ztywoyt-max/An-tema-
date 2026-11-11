extends Node3D
## Sala de teste: uma plataforma grande sobre o mar, com algumas paredes e
## estruturas para exercitar todos os sistemas (movimento, combate, água, vento).

const Build := preload("res://src/world/build.gd")

# Pontos de interesse (lidos por main/world para colocar jogador, inimigos e painéis).
const SPAWN := Vector3(0.0, 0.05, 15.0)
const REST_POINT := Vector3(0.0, 0.0, 11.0)
const DUMMIES := [Vector3(-27.0, 0.0, -12.0), Vector3(-22.0, 0.0, -14.0), Vector3(-17.0, 0.0, -12.0)]
const PARRY_TRAINER := Vector3(-29.0, 0.0, 0.0)
const SUMMON_PANEL := Vector3(-13.0, 0.0, 5.0)
const ARENA_CENTER := Vector3(-22.0, 0.0, -5.0)
const TIDE_PANEL := Vector3(9.0, 0.0, 19.0)
const WIND_PANEL := Vector3(-9.0, 0.0, 19.0)
const BRAZIER := Vector3(14.0, 0.0, 6.0)
const TOWER_TOP := Vector3(32.5, 6.0, -22.5)
const FAR_PLATFORM := Vector3(66.0, 5.0, 0.0)
const PALMS := [Vector3(-33.0, 0.55, 19.0), Vector3(33.0, 0.55, 19.0), Vector3(-33.0, 0.55, -23.0), Vector3(-15.0, 0.55, 19.0), Vector3(15.0, 0.55, -1.0)]
const FLAGS := [Vector3(-34.0, 0.0, -18.5), Vector3(19.0, 0.0, -18.5), Vector3(35.0, 6.0, -25.0), Vector3(71.0, 5.0, -5.0), Vector3(-7.5, 0.0, 9.0), Vector3(7.5, 0.0, 9.0)]
## Zonas de vento: [centro, tamanho, vetor do vento (m/s)]
const UPDRAFTS := [
	[Vector3(31.0, 13.0, -21.0), Vector3(3.2, 15.0, 3.2), Vector3(0.0, 15.0, 0.0)],
	[Vector3(49.0, 6.0, -2.0), Vector3(7.0, 20.0, 7.0), Vector3(0.0, 13.0, 0.0)],
	[Vector3(69.0, 12.0, 3.0), Vector3(3.2, 15.0, 3.2), Vector3(0.0, 15.0, 0.0)],
	[Vector3(3.0, 5.0, -8.0), Vector3(4.0, 11.0, 4.0), Vector3(0.0, 12.0, 0.0)],
]
const STREAMS := [
	[Vector3(-7.0, 2.0, -21.5), Vector3(54.0, 4.0, 4.5), Vector3(13.0, 0.0, 0.0)],
]
## Correnteza na água: [centro, tamanho, vetor (m/s)]
const CURRENTS := [
	[Vector3(23.0, -3.0, 40.0), Vector3(30.0, 6.0, 7.0), Vector3(-5.0, 0.0, 0.0)],
]

var m_floor: ShaderMaterial
var m_stone: ShaderMaterial
var m_wall: ShaderMaterial
var m_teal: ShaderMaterial
var m_coral: ShaderMaterial
var m_wood: ShaderMaterial
var m_sand: ShaderMaterial
var m_seabed: ShaderMaterial
var m_dark: ShaderMaterial
var m_gold: ShaderMaterial


func _ready() -> void:
	_materials()
	_deck()
	_walls()
	_pool()
	_climb_and_tower()
	_terrace_and_beach()
	_sea_structures()
	_decor()


func _materials() -> void:
	m_floor = Build.painted(Build.P_TILES, Color("#ecdcb8"), Color("#dcc79e"), {
		"tile": Vector2(2.0, 2.0), "line_color": Color("#9a8698"), "line_width": 0.035, "brush_scale": 0.16, "brush_amount": 0.13})
	m_stone = Build.painted(Build.P_BLOCKS, Color("#dccaa6"), Color("#c3ad88"), {
		"tile": Vector2(1.6, 0.8), "line_color": Color("#756585"), "line_width": 0.03})
	m_wall = Build.painted(Build.P_PLAIN, Color("#f8f1e2"), Color("#ebdfc6"), {"brush_scale": 0.12, "brush_amount": 0.1})
	m_teal = Build.painted(Build.P_PLAIN, Color("#1fb3a4"), Color("#168f8c"), {"brush_amount": 0.12})
	m_coral = Build.painted(Build.P_PLAIN, Color("#de4f7f"), Color("#c53d6f"), {"brush_amount": 0.12})
	m_wood = Build.painted(Build.P_PLANKS, Color("#b98250"), Color("#9c693c"), {
		"tile": Vector2(2.8, 0.3), "line_color": Color("#4c2f2c"), "line_width": 0.014})
	m_sand = Build.painted(Build.P_SAND, Color("#f4e6bf"), Color("#e8d3a0"), {"brush_scale": 0.1})
	m_seabed = Build.painted(Build.P_SAND, Color("#e2d6a6"), Color("#cdbf8c"), {"brush_scale": 0.06})
	m_dark = Build.painted(Build.P_BLOCKS, Color("#6c6684"), Color("#575270"), {
		"tile": Vector2(1.9, 0.95), "line_color": Color("#35304a"), "top_blend": 0.0})
	m_gold = Build.painted(Build.P_PLAIN, Color("#e8bf5a"), Color("#c99a3c"), {"brush_amount": 0.1})
	m_gold.set_shader_parameter("spec_size", 0.12)


## Laje com tampo de lajotas e corpo de blocos.
func _slab(x0: float, x1: float, z0: float, z1: float, top := 0.0, thick := 1.4, top_mat: Material = null, body_mat: Material = null) -> void:
	var tm: Material = top_mat if top_mat else m_floor
	var bm: Material = body_mat if body_mat else m_stone
	Build.box_mm(self, Vector3(x0, top - thick, z0), Vector3(x1, top - 0.1, z1), bm)
	Build.box_mm(self, Vector3(x0, top - 0.1, z0), Vector3(x1, top, z1), tm)


func _deck() -> void:
	# Convés principal x[-36,36] z[-26,22], com dois vãos: piscina e fosso da corrida na parede.
	_slab(-36, 36, -26, -17)
	_slab(-36, 21, -17, -13)
	_slab(27, 36, -17, -13)
	_slab(-36, -6, -13, -5)
	_slab(6, 21, -13, -5)
	_slab(27, 36, -13, -5)
	_slab(-36, -6, -5, -3)
	_slab(6, 36, -5, -3)
	_slab(-36, 36, -3, 22)
	# Fundo do mar.
	Build.box_mm(self, Vector3(-400, -9.5, -400), Vector3(400, -8.0, 400), m_seabed, true, "FundoDoMar")
	# Pilares que sustentam o convés.
	for p: Vector2 in [Vector2(-30, -21), Vector2(-15, -21), Vector2(0, -21), Vector2(15, -21), Vector2(31, -21),
			Vector2(-30, -6), Vector2(-15, -6), Vector2(13, -8), Vector2(31, -8),
			Vector2(-30, 12), Vector2(-15, 12), Vector2(0, 12), Vector2(15, 12), Vector2(30, 12)]:
		Build.cylinder(self, Vector3(p.x, -5.2, p.y), 1.25, 7.6, m_dark, true, 1.05)
	# Arena: anel no chão.
	var ring := Build.cylinder(self, ARENA_CENTER + Vector3(0, 0.012, 0), 9.5, 0.02, m_coral, false, -1.0, 64)
	ring.name = "AnelArena"
	Build.cylinder(self, ARENA_CENTER + Vector3(0, 0.018, 0), 9.2, 0.02, m_floor, false, -1.0, 64)
	# Pista de corrida (faixa turquesa junto à parede norte).
	Build.box_mm(self, Vector3(-34, 0.0, -24.3), Vector3(19.5, 0.02, -24.0), m_teal, false)
	Build.box_mm(self, Vector3(-34, 0.0, -19.3), Vector3(19.5, 0.02, -19.0), m_teal, false)


func _wall(lo: Vector3, hi: Vector3, cap: Material = null, base_band: Material = null) -> void:
	Build.box_mm(self, lo, hi, m_wall)
	var c: Material = cap if cap else m_teal
	Build.box_mm(self, Vector3(lo.x - 0.08, hi.y, lo.z - 0.08), Vector3(hi.x + 0.08, hi.y + 0.22, hi.z + 0.08), c)
	if base_band:
		Build.box_mm(self, Vector3(lo.x - 0.03, lo.y, lo.z - 0.03), Vector3(hi.x + 0.03, lo.y + 0.45, hi.z + 0.03), base_band, false)


func _walls() -> void:
	# Parede alta do norte (também serve para correr na parede).
	_wall(Vector3(-12, 0, -27), Vector3(20, 6.5, -26), m_teal, m_coral)
	# Muretas.
	_wall(Vector3(-36.6, 0, -26.6), Vector3(-12, 0.9, -26))
	_wall(Vector3(-36.6, 0, -26), Vector3(-36, 0.9, 10))
	_wall(Vector3(36, 0, -19), Vector3(36.6, 0.9, -17))
	_wall(Vector3(36, 0, 8), Vector3(36.6, 0.9, 22))
	# Corredor de corrida na parede: duas paredes paralelas sobre um fosso aberto para o mar.
	_wall(Vector3(20.4, 0, -18), Vector3(21, 5.0, -4), m_coral)
	_wall(Vector3(27, 0, -18), Vector3(27.6, 5.0, -4), m_coral)
	# Paredes soltas na arena (cobertura / corrida na parede em combate).
	_wall(Vector3(-34, 0, 6), Vector3(-26, 3.2, 6.7), m_teal, m_coral)
	_wall(Vector3(-12, 0, -16), Vector3(-11.3, 3.2, -9), m_teal, m_coral)


func _pool() -> void:
	# Vão x[-6,6] z[-13,-3] aberto até o mar; borda turquesa e escada para dentro d'água.
	for r: Array in [[-6.4, 6.4, -13.4, -13.0], [-6.4, 6.4, -3.0, -2.6], [-6.4, -6.0, -13.0, -3.0], [6.0, 6.4, -13.0, -3.0]]:
		Build.box_mm(self, Vector3(r[0], 0.0, r[2]), Vector3(r[1], 0.06, r[3]), m_teal, false)
	for i in 9:
		var top := -0.35 * float(i + 1)
		var z1 := -3.0 - 0.55 * float(i)
		Build.box_mm(self, Vector3(-2.2, top - 0.35, z1 - 0.55), Vector3(2.2, top, z1), m_stone)
	# Parede de apoio da escada.
	Build.box_mm(self, Vector3(-2.2, -3.6, -8.0), Vector3(2.2, -3.15, -3.0), m_stone)


func _climb_and_tower() -> void:
	# Degraus de escalada: 1,3 m (pulo), 2,8 m, 4,4 m (pulo duplo / agarrar a borda) e a torre a 6 m.
	_slab(20.4, 23.4, -26, -22, 1.3, 1.3, m_wood, m_stone)
	_slab(23.4, 26.4, -26, -22, 2.8, 2.8, m_wood, m_stone)
	_slab(26.4, 29.4, -26, -22, 4.4, 4.4, m_wood, m_stone)
	_slab(29.4, 36, -26, -19, 6.0, 6.0, m_floor, m_stone)
	Build.box_mm(self, Vector3(29.4, 6.0, -26.5), Vector3(36.5, 6.9, -26), m_wall)
	Build.box_mm(self, Vector3(36, 6.0, -26), Vector3(36.5, 6.9, -19), m_wall)
	# Rampa de deslizar: da torre (6 m) até o convés.
	Build.ramp(self, Vector3(32.7, 0.0, -6.0), Vector3(32.7, 6.0, -19.0), 4.6, 0.5, m_wood)
	Build.box_mm(self, Vector3(30.2, 0.0, -19.0), Vector3(30.4, 6.0, -18.6), m_stone)
	Build.box_mm(self, Vector3(35.0, 0.0, -19.0), Vector3(35.2, 6.0, -18.6), m_stone)
	# Plataforma distante (alvo do planar), sobre um pilar.
	_slab(60, 72, -6, 6, 5.0, 1.2, m_floor, m_stone)
	Build.cylinder(self, Vector3(66, -2.6, 0), 2.2, 12.8, m_dark, true, 1.7)
	_wall(Vector3(71.5, 5.0, -6), Vector3(72, 5.9, 6))


func _terrace_and_beach() -> void:
	# Terraço da maré (y = -1,6): alaga na maré alta, seca na baixa. Píer de madeira sobre estacas.
	Build.box_mm(self, Vector3(10, -1.85, 22), Vector3(36, -1.6, 34), m_wood)
	for x in [11.0, 19.0, 27.0, 35.0]:
		for z in [23.0, 33.0]:
			Build.cylinder(self, Vector3(x, -5.3, z), 0.28, 7.4, m_wood, true, -1.0, 10)
	# Estacas de amarração (acima do deck).
	for x in [10.4, 35.6]:
		Build.cylinder(self, Vector3(x, -1.0, 33.6), 0.22, 1.2, m_wood, true, -1.0, 10)
	# Escada do convés ao terraço.
	for i in 4:
		var top := -0.4 * float(i + 1)
		var z0 := 22.0 + 0.5 * float(i)
		Build.box_mm(self, Vector3(18, top - 0.4, z0), Vector3(24, top, z0 + 0.5), m_stone)
	# Régua de maré.
	Build.cylinder(self, Vector3(34.5, -1.6, 28.0), 0.16, 5.4, m_wall, true, -1.0, 10)
	for i in 6:
		Build.cylinder(self, Vector3(34.5, -2.6 + 0.5 * float(i), 28.0), 0.2, 0.08, m_coral if i % 2 == 0 else m_teal, false, -1.0, 10)
	# Rampa de areia (praia) do convés até abaixo da maré baixa.
	Build.ramp(self, Vector3(-18, -5.2, 47.0), Vector3(-18, 0.0, 22.0), 24.0, 1.2, m_sand)
	Build.box_mm(self, Vector3(-30, -9.0, 46.0), Vector3(-6, -5.0, 60.0), m_sand)
	Build.ramp(self, Vector3(-18, -9.0, 74.0), Vector3(-18, -5.0, 60.0), 24.0, 1.0, m_sand)
	# Canal raso para surfar (fundo a -2,9: raso na maré baixa).
	Build.box_mm(self, Vector3(8, -3.4, 37.0), Vector3(38, -2.9, 43.5), m_sand)


func _sea_structures() -> void:
	# Pilares de parkour no mar, a oeste, até uma ilhota.
	var pts := [Vector3(-40.5, 0.6, -8.0), Vector3(-45.5, 1.3, -10.5), Vector3(-50.5, 0.8, -6.5), Vector3(-56.5, 2.1, -9.0), Vector3(-62.0, 1.2, -12.0)]
	for p: Vector3 in pts:
		var h: float = p.y + 9.0
		Build.cylinder(self, Vector3(p.x, p.y - h * 0.5, p.z), 1.1, h, m_dark, true, 0.95, 14)
		Build.cylinder(self, Vector3(p.x, p.y + 0.02, p.z), 1.0, 0.06, m_teal, false, -1.0, 14)
	_slab(-76, -66, -17, -7, 1.0, 1.4, m_floor, m_stone)
	Build.cylinder(self, Vector3(-71, -4.7, -12), 2.4, 8.6, m_dark, true, 1.9)
	# Ruínas submersas (para o mergulho).
	for p2: Vector3 in [Vector3(-12, -9, 34), Vector3(-2, -9, 40), Vector3(4, -9, 30), Vector3(-20, -9, 62)]:
		Build.cylinder(self, p2 + Vector3(0, 1.6, 0), 0.7, 3.2, m_wall, true, 0.6, 12)
		Build.box(self, p2 + Vector3(0, 3.35, 0), Vector3(1.9, 0.3, 1.9), m_teal)
	Build.box(self, Vector3(-7, -8.6, 36), Vector3(7.0, 0.8, 1.0), m_wall, true, Vector3(0, 28, 6))


func _decor() -> void:
	# Canteiros das palmeiras.
	for p: Vector3 in PALMS:
		Build.box_mm(self, Vector3(p.x - 1.5, 0.0, p.z - 1.5), Vector3(p.x + 1.5, 0.5, p.z + 1.5), m_stone)
		Build.box_mm(self, Vector3(p.x - 1.25, 0.5, p.z - 1.25), Vector3(p.x + 1.25, 0.56, p.z + 1.25), m_sand, false)
	# Arcos da pista de corrida.
	for x in [-24.0, -6.0, 12.0]:
		Build.box_mm(self, Vector3(x - 0.3, 0, -24.6), Vector3(x + 0.3, 4.2, -24.0), m_wall)
		Build.box_mm(self, Vector3(x - 0.3, 0, -19.0), Vector3(x + 0.3, 4.2, -18.4), m_wall)
		Build.box_mm(self, Vector3(x - 0.4, 4.2, -24.7), Vector3(x + 0.4, 4.7, -18.3), m_coral)
