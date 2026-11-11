extends SceneTree
## Ferramenta: imprime a árvore de nós e os ossos de um modelo.

func _init() -> void:
	var scene: PackedScene = load("res://assets/models/hero.glb")
	var inst := scene.instantiate()
	_tree(inst, 0)
	var sk: Skeleton3D = inst.find_child("Skeleton3D", true, false)
	print("ossos: ", sk.get_bone_count())
	for i in sk.get_bone_count():
		var n := sk.get_bone_name(i)
		if n in ["hips", "chest", "upper_arm_r", "forearm_r", "hand_r", "weapon_r", "thigh_r", "foot_r", "scarf_a1", "head"]:
			var g := sk.get_bone_global_rest(i)
			print("%-12s pai=%-10s pos=%s  y=%s  z=%s" % [n, sk.get_bone_name(sk.get_bone_parent(i)) if sk.get_bone_parent(i) >= 0 else "-", g.origin.snapped(Vector3.ONE * 0.001), g.basis.y.snapped(Vector3.ONE * 0.01), g.basis.z.snapped(Vector3.ONE * 0.01)])
	for c in ["SpringBoneSimulator3D", "SkeletonModifier3D", "LookAtModifier3D", "TwoBoneIK3D", "BoneConstraint3D"]:
		print(c, " existe: ", ClassDB.class_exists(c))
	if ClassDB.class_exists("SpringBoneSimulator3D"):
		var names := []
		for m in ClassDB.class_get_method_list("SpringBoneSimulator3D", true):
			names.append(m.name)
		print(names)
	quit()

func _tree(n: Node, d: int) -> void:
	print("  ".repeat(d), n.name, " [", n.get_class(), "]")
	for c in n.get_children():
		_tree(c, d + 1)
