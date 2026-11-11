extends Node3D
## Céu pintado, sol e ambiente.

const SKY_SHADER := preload("res://shaders/sky.gdshader")

var sun: DirectionalLight3D
var env: Environment
var sky_mat: ShaderMaterial
var _underwater := 0.0


func _ready() -> void:
	sun = DirectionalLight3D.new()
	sun.name = "Sol"
	sun.rotation_degrees = Vector3(-50.0, -38.0, 0.0)
	sun.light_color = Color(1.0, 0.97, 0.9)
	sun.light_energy = 1.0
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_4_SPLITS
	sun.directional_shadow_max_distance = 110.0
	sun.directional_shadow_blend_splits = true
	sun.shadow_blur = 0.6
	sun.shadow_bias = 0.04
	sun.shadow_normal_bias = 1.2
	add_child(sun)

	sky_mat = ShaderMaterial.new()
	sky_mat.shader = SKY_SHADER
	var sky := Sky.new()
	sky.sky_material = sky_mat
	sky.radiance_size = Sky.RADIANCE_SIZE_64
	sky.process_mode = Sky.PROCESS_MODE_QUALITY

	env = Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.62, 0.72, 0.95)
	env.ambient_light_energy = 0.55
	env.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	env.glow_enabled = true
	env.glow_intensity = 0.55
	env.glow_strength = 0.9
	env.glow_bloom = 0.0
	env.glow_hdr_threshold = 1.0
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_ADDITIVE
	env.fog_enabled = true
	env.fog_light_color = Color(0.72, 0.89, 0.97)
	env.fog_density = 0.0011
	env.fog_aerial_perspective = 0.0
	env.fog_sky_affect = 0.0
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.06
	env.adjustment_contrast = 1.03
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	RenderingServer.global_shader_parameter_set(&"sun_dir", sun.global_basis.z)


func _process(delta: float) -> void:
	RenderingServer.global_shader_parameter_set(&"sun_dir", sun.global_basis.z)
	# Debaixo d'água: névoa densa azul-esverdeada.
	var cam := get_viewport().get_camera_3d()
	var target := 0.0
	if cam and Tide.depth_at(cam.global_position) > 0.0:
		target = 1.0
	_underwater = move_toward(_underwater, target, delta * 6.0)
	env.fog_density = lerpf(0.0011, 0.055, _underwater)
	env.fog_light_color = Color(0.72, 0.89, 0.97).lerp(Color(0.05, 0.42, 0.55), _underwater)


func underwater_amount() -> float:
	return _underwater
