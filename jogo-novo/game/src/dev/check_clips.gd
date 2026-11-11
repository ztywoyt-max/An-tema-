extends SceneTree
## Ferramenta: gera todos os clipes e confere se há valores inválidos.

const AnimRig := preload("res://src/anim/anim_rig.gd")
const Builder := preload("res://src/anim/anim_builder.gd")
const Clips := preload("res://src/anim/clips_humanoid.gd")
const ModelUtil := preload("res://src/core/model_util.gd")

func _init() -> void:
	var inst: Node = (load("res://assets/models/hero.glb") as PackedScene).instantiate()
	var sk := ModelUtil.find_skeleton(inst)
	var rig := AnimRig.new()
	rig.setup(sk)
	var t0 := Time.get_ticks_usec()
	var total := 0.0
	var bad := 0
	for n in Clips.names():
		var pre := Builder.prepare(rig, Clips.get_clip(n))
		var anim := Builder.to_animation(rig, pre, "Rig/Skeleton3D")
		total += anim.length
		for ti in anim.get_track_count():
			for ki in anim.track_get_key_count(ti):
				var v: Variant = anim.track_get_key_value(ti, ki)
				if (v is Quaternion and not (v as Quaternion).is_finite()) or (v is Vector3 and not (v as Vector3).is_finite()):
					bad += 1
					print("valor inválido em ", n, " trilha ", anim.track_get_path(ti))
					break
	print("clipes: ", Clips.names().size(), "  duração total: ", snappedf(total, 0.01), " s  tempo: ", (Time.get_ticks_usec() - t0) / 1000.0, " ms  inválidos: ", bad)
	print(", ".join(Clips.names()))
	inst.free()
	quit()
