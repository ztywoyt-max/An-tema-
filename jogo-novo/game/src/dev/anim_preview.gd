extends Node3D
## Ferramenta: mostra N poses de um clipe lado a lado (folha de contato).
## Uso: -- --anim=nome [--n=8] [--t0=0] [--t1=fim] [--gap=1.3] [--model=hero] [--weapon=sword]

const ModelUtil := preload("res://src/core/model_util.gd")
const AnimRig := preload("res://src/anim/anim_rig.gd")
const Builder := preload("res://src/anim/anim_builder.gd")
const Clips := preload("res://src/anim/clips_humanoid.gd")


func _ready() -> void:
	var clip_name := Game.arg("anim")
	var n := int(Game.arg("n", "8"))
	var gap := float(Game.arg("gap", "1.3"))
	var model := Game.arg("model", "hero")
	var scene: PackedScene = load("res://assets/models/%s.glb" % model)
	var weapon: PackedScene = load("res://assets/models/%s.glb" % Game.arg("weapon", "sword"))
	var rig := AnimRig.new()
	var pre: Dictionary = {}
	var at := Game.arg_vec3("at", Vector3(0, 0, 14))
	for i in n:
		var inst: Node3D = scene.instantiate()
		add_child(inst)
		var slot := (n - 1 - i) if Game.args.has("rev") else i
		inst.position = at + Vector3((float(slot) - float(n - 1) * 0.5) * gap, 0, 0)
		inst.rotation_degrees.y = float(Game.arg("yaw", "0"))
		ModelUtil.toonify(inst)
		var sk := ModelUtil.find_skeleton(inst)
		if not rig.valid:
			rig.setup(sk)
			var clip: Dictionary = Clips.get_clip(clip_name)
			if clip.is_empty():
				push_error("clipe não encontrado: " + clip_name)
				return
			var t_start := Time.get_ticks_usec()
			pre = Builder.prepare(rig, clip)
			var anim := Builder.to_animation(rig, pre, "Rig/Skeleton3D")
			print("clipe ", clip_name, ": ", pre["length"], " s, ", anim.get_track_count(), " trilhas, gerado em ", (Time.get_ticks_usec() - t_start) / 1000.0, " ms")
		var t0 := float(Game.arg("t0", "0"))
		var t1 := float(Game.arg("t1", str(pre["length"])))
		var t := lerpf(t0, t1, float(i) / float(maxi(n - 1, 1)))
		Builder.apply_to_skeleton(rig, sk, Builder.sample(rig, pre, t))
		var ba := BoneAttachment3D.new()
		ba.bone_name = "weapon_r"
		sk.add_child(ba)
		var w: Node3D = weapon.instantiate()
		ba.add_child(w)
		ModelUtil.toonify(w)
		var label := Label3D.new()
		label.text = "%.2f" % t
		label.font_size = 48
		label.pixel_size = 0.003
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		label.modulate = Color(0.1, 0.1, 0.3)
		label.outline_modulate = Color(1, 1, 1)
		label.position = inst.position + Vector3(0, 2.15, 0)
		add_child(label)
