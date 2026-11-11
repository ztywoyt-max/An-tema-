import bpy, math, random, sys
random.seed(7)
out = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def mat_gradient(name, c1, c2, c3, scale=4.0, rough=0.5, axis='Z'):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out_n = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = rough
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    noise = nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value = scale*3
    mix = nt.nodes.new('ShaderNodeMath'); mix.operation = 'ADD'
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = c1
    ramp.color_ramp.elements[1].color = c3
    e = ramp.color_ramp.elements.new(0.5); e.color = c2
    mapr = nt.nodes.new('ShaderNodeMapRange')
    mapr.inputs['From Min'].default_value = 0; mapr.inputs['From Max'].default_value = 3
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    nt.links.new(sep.outputs[2], mapr.inputs['Value'])
    nt.links.new(mapr.outputs['Result'], mix.inputs[0])
    nt.links.new(noise.outputs['Fac'], mix.inputs[1])
    mix.use_clamp = True
    nt.links.new(tc.outputs['Object'], noise.inputs['Vector'])
    nt.links.new(mix.outputs['Value'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(bsdf.outputs['BSDF'], out_n.inputs['Surface'])
    return m

coral_m = mat_gradient("Coral", (0.35,0.12,0.6,1), (0.84,0.27,0.48,1), (1.0,0.55,0.4,1))
moss_m = mat_gradient("Musgo", (0.25,0.5,0.15,1), (0.43,0.66,0.29,1), (0.7,0.8,0.3,1), scale=9)

# Coral: caule + leque de laminas
def blade(loc, rot, size, mat):
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=size*0.5, radius2=size*0.05, depth=size*2.2, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = (1, 0.18, 1)
    bpy.ops.object.shade_smooth()
    mod = o.modifiers.new("d", 'DISPLACE')
    t = bpy.data.textures.new("n", 'CLOUDS'); t.noise_scale = 0.6
    mod.texture = t; mod.strength = 0.15
    o.data.materials.append(mat)
    return o

n = 28
for i in range(n):
    a = i/n*math.tau
    r = 1.0 + random.random()*0.8
    tilt = 0.55 + random.random()*0.5
    blade((math.cos(a)*0.2, math.sin(a)*0.2, 1.4), (tilt*math.sin(a)*-1, tilt*math.cos(a), a), 1.5 + random.random()*0.9, coral_m)
for i in range(16):
    a = random.random()*math.tau; d = 1.1 + random.random()*0.9
    blade((math.cos(a)*d, math.sin(a)*d, 0.5), (0.4*math.sin(a)*-1, 0.4*math.cos(a), a), 0.7 + random.random()*0.5, coral_m)

# Base rochosa com musgo
bpy.ops.mesh.primitive_uv_sphere_add(radius=1.6, location=(0,0,0.2))
base = bpy.context.object; base.scale = (1.2, 1.2, 0.8); bpy.ops.object.shade_smooth()
mod = base.modifiers.new("d", 'DISPLACE'); t = bpy.data.textures.new("n2", 'CLOUDS'); t.noise_scale = 0.9; mod.texture = t; mod.strength = 0.35
base.data.materials.append(moss_m)

# Agua
bpy.ops.mesh.primitive_plane_add(size=60, location=(0,0,0))
w = bpy.context.object
wm = bpy.data.materials.new("Agua"); wm.use_nodes = True
b = wm.node_tree.nodes['Principled BSDF']
b.inputs['Base Color'].default_value = (0.05, 0.8, 0.72, 1)
b.inputs['Roughness'].default_value = 0.08
b.inputs['Transmission Weight'].default_value = 0.6
w.data.materials.append(wm)

# Ceu
world = bpy.data.worlds.new("W"); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.25, 0.55, 0.95, 1); bg.inputs['Strength'].default_value = 1.3

# Sol e camera
bpy.ops.object.light_add(type='SUN', location=(5,-5,10)); s = bpy.context.object
s.data.energy = 4.5; s.rotation_euler = (math.radians(50), math.radians(10), math.radians(35)); s.data.angle = math.radians(2)
bpy.ops.object.camera_add(location=(7.5,-8.5,3.3)); cam = bpy.context.object
d = cam.location*-1
cam.rotation_euler = d.to_track_quat('-Z','Y').to_euler(); cam.location = (7.5,-8.5,3.3)
cam.rotation_euler = (math.radians(77), 0, math.radians(41))
cam.data.lens = 40; sc.camera = cam

sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.device = 'CPU'
sc.cycles.use_denoising = True
sc.render.resolution_x = 960; sc.render.resolution_y = 600
sc.render.filepath = out
sc.view_settings.view_transform = 'Standard'
bpy.ops.render.render(write_still=True)
print("ok")
