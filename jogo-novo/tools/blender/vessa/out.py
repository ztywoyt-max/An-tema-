"""Monta malha + esqueleto no Blender e exporta .glb."""
from __future__ import annotations

import bpy
import numpy as np
from mathutils import Vector

from . import geo


def gb(v) -> Vector:
    """Espaço do jogo (Y cima, -Z frente) -> Blender (Z cima, +Y frente)."""
    return Vector((float(v[0]), -float(v[2]), float(v[1])))


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_material(name: str, texture_path: str | None = None, color=(1, 1, 1, 1)):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = 1.0
    if texture_path:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(texture_path)
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    return m


def build_mesh(name: str, parts, textures: dict | None = None):
    """Cria um objeto de malha a partir das peças. textures: material -> caminho da imagem."""
    data = geo.merge(parts)
    mesh = bpy.data.meshes.new(name)
    verts = [gb(v) for v in data["verts"]]
    mesh.from_pydata(verts, [], data["faces"])
    mesh.update()
    # materiais
    for mat_name in data["materials"]:
        tex = (textures or {}).get(mat_name)
        mesh.materials.append(make_material(mat_name, tex))
    mesh.polygons.foreach_set("material_index", data["face_mat"])
    mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))
    # UV (por canto)
    uv_layer = mesh.uv_layers.new(name="UVMap")
    loops_v = np.zeros(len(mesh.loops), dtype=np.int32)
    mesh.loops.foreach_get("vertex_index", loops_v)
    uv = data["uvs"][loops_v].copy()
    uv[:, 1] = 1.0 - uv[:, 1]   # v=0 no topo da imagem
    uv_layer.data.foreach_set("uv", uv.reshape(-1))
    # cor por vértice (linear), alfa = rigidez do pano
    col = mesh.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    col.data.foreach_set("color", data["colors"].reshape(-1))
    mesh.color_attributes.active_color = col
    mesh.color_attributes.render_color_index = 0
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    # grupos de vértices (até 4 influências, normalizados)
    w = data["weights"]
    if w:
        names = list(w.keys())
        arr = np.stack([w[k] for k in names], axis=1)
        arr = np.clip(arr, 0, None)
        if arr.shape[1] > 4:
            idx = np.argsort(arr, axis=1)[:, :-4]
            np.put_along_axis(arr, idx, 0.0, axis=1)
        s = arr.sum(axis=1, keepdims=True)
        missing = np.where(s[:, 0] < 1e-6)[0]
        if len(missing):
            raise RuntimeError(f"{name}: {len(missing)} vértices sem peso de pele (ex.: índice {missing[0]})")
        arr = arr / s
        for bi, bone in enumerate(names):
            vg = obj.vertex_groups.new(name=bone)
            col_w = arr[:, bi]
            nz = np.nonzero(col_w > 1e-4)[0]
            for i in nz:
                vg.add([int(i)], float(col_w[i]), "REPLACE")
    return obj


def build_armature(name: str, bones: dict, rolls: dict | None = None):
    """bones: nome -> (pai, cabeça, cauda) no espaço do jogo. rolls: nome -> vetor para onde aponta o eixo Z do osso."""
    arm = bpy.data.armatures.new(name)
    obj = bpy.data.objects.new(name, arm)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    for bname, (parent, head, tail) in bones.items():
        eb = arm.edit_bones.new(bname)
        eb.head = gb(head)
        eb.tail = gb(tail)
        if parent:
            eb.parent = arm.edit_bones[parent]
            eb.use_connect = False
        ref = (rolls or {}).get(bname, (0.0, 0.0, -1.0))
        eb.align_roll(gb(ref))
    bpy.ops.object.mode_set(mode="OBJECT")
    return obj


def bind(mesh_obj, arm_obj) -> None:
    mesh_obj.parent = arm_obj
    mod = mesh_obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm_obj


def export_glb(path: str, selected_only: bool = False) -> None:
    kw = dict(
        filepath=path,
        export_format="GLB",
        use_selection=selected_only,
        export_yup=True,
        export_apply=False,
        export_animations=False,
        export_skins=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_active_vertex_color_when_no_material=True,
    )
    props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
    kw = {k: v for k, v in kw.items() if k in props}
    bpy.ops.export_scene.gltf(**kw)
    print("exportado:", path)
