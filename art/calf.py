"""Procedural stylized Holstein heifer calf, rendered in a flat "comic" style.

Run from the OsmosisCaseStudy folder:
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python art/calf.py

Everything (geometry, patches, materials, camera, poses) is generated here from
numbers in this file. The model is original; no external assets are used.

Outputs:
    art/renders/calf-<pose>.png        1200x780 RGBA, transparent background
    public/art/calf-<pose>.webp        compressed copies for the web app
    art/calf-anchors.json              2D pixel anchors (neck IV site, head, groundY)
"""
import json
import math
import os

import bmesh
import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Quaternion, Vector, noise

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)
RENDER_DIR = os.path.join(HERE, "renders")
WEB_DIR = os.path.join(PROJECT, "public", "art")
W, H = 1200, 780
GROUND_FRAC = 0.88          # ground line at 88% of image height (from top)
CAM_ELEV = 20.0             # side camera: degrees above horizontal (standing, sternal)
HIGH_ELEV = 58.0            # high camera for the lying-on-side frames
HIGH_GROUND_FRAC = 0.64     # body-centre ground point at 64% of height (high camera)
ORTHO_SCALE = 2.45          # metres across the image width
OUTLINE_W = 0.0085          # inverted-hull outline thickness (m)

MB_RES = 0.0085             # metaball mesh resolution (m); exam.py lowers it for close-ups
STIFF = 8.0                                    # metaball stiffness
SURF = math.sqrt(1.0 - (0.6 / STIFF) ** (1 / 3))  # surface radius / element radius

V = Vector


# ----------------------------------------------------------------------------
# Scene setup
# ----------------------------------------------------------------------------
def reset_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.metaballs, bpy.data.materials,
                 bpy.data.cameras, bpy.data.lights):
        for d in list(coll):
            coll.remove(d)
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE"
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = True
    sc.render.filter_size = 1.2
    try:
        sc.eevee.taa_render_samples = 24
    except AttributeError:
        pass
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0
    sc.view_settings.gamma = 1
    if sc.world is None:
        sc.world = bpy.data.worlds.new("World")
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0, 0, 0, 1)
        bg.inputs["Strength"].default_value = 0.0
    return sc


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def make_camera(sc, name, elev_deg, ground_frac):
    cam_data = bpy.data.cameras.new(name)
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ORTHO_SCALE
    cam_data.clip_start, cam_data.clip_end = 0.1, 50
    cam = link(bpy.data.objects.new(name, cam_data))
    e = math.radians(elev_deg)
    d = V((0, math.cos(e), -math.sin(e)))          # looking toward +y, down
    target = V((0.0, 0.0, 0.45))
    cam.location = target - d * 12
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = d.to_track_quat("-Z", "Y")
    sc.camera = cam
    bpy.context.view_layer.update()
    # shift so the ground point (0, 0, 0) sits at ground_frac of the height
    ny = world_to_camera_view(sc, cam, V((0, 0, 0))).y
    cam_data.shift_y = (ny - (1 - ground_frac)) * H / W
    bpy.context.view_layer.update()
    return cam


def setup_camera_and_light(sc):
    cams = {"high": make_camera(sc, "CamHigh", HIGH_ELEV, HIGH_GROUND_FRAC),
            "side": make_camera(sc, "Cam", CAM_ELEV, GROUND_FRAC)}

    sun_data = bpy.data.lights.new("Sun", "SUN")
    sun_data.energy = 3.2
    sun_data.angle = math.radians(2)
    sun_data.use_shadow = True
    sun = link(bpy.data.objects.new("Sun", sun_data))
    ld = V((0.55, 0.75, -0.75)).normalized()        # from upper-left-front
    sun.rotation_mode = "QUATERNION"
    sun.rotation_quaternion = ld.to_track_quat("-Z", "Y")
    cams["sun"] = sun
    return cams


SUN_DIRS = {"side": V((0.55, 0.75, -0.75)),     # from upper-left-front
            "high": V((0.15, 0.79, -0.6))}     # lying frames: from behind the camera so the
                                                # floor shadow shows above her back


def cast_shadow_material():
    """Ground plane that is transparent where lit and darkens only where the calf
    casts a shadow (a toon 'shadow catcher' for EEVEE)."""
    mat = bpy.data.materials.new("GroundShadow")
    nt, nodes, links = _nodes(mat)
    diff = nodes.new("ShaderNodeBsdfDiffuse")
    s2r = nodes.new("ShaderNodeShaderToRGB")
    links.new(diff.outputs[0], s2r.inputs[0])
    bw = nodes.new("ShaderNodeRGBToBW")
    links.new(s2r.outputs["Color"], bw.inputs[0])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "LINEAR"
    e = ramp.color_ramp.elements
    ramp.color_ramp.interpolation = "CONSTANT"
    e[0].position, e[0].color = 0.0, (0.40, 0.40, 0.40, 1)
    e[1].position, e[1].color = 0.3, (0, 0, 0, 1)
    links.new(bw.outputs[0], ramp.inputs[0])
    em = nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*lin((0.25, 0.18, 0.1)), 1)
    tr = nodes.new("ShaderNodeBsdfTransparent")
    mix = nodes.new("ShaderNodeMixShader")
    links.new(ramp.outputs["Color"], mix.inputs[0])
    links.new(tr.outputs[0], mix.inputs[1])
    links.new(em.outputs[0], mix.inputs[2])
    out = nodes.new("ShaderNodeOutputMaterial")
    links.new(mix.outputs[0], out.inputs["Surface"])
    mat.surface_render_method = "BLENDED"
    return mat


# ----------------------------------------------------------------------------
# Materials (flat toon: Diffuse -> Shader to RGB -> constant ramp -> Emission)
# ----------------------------------------------------------------------------
def _nodes(mat):
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return nt, nt.nodes, nt.links


def _mix(nodes, blend="MIX"):
    m = nodes.new("ShaderNodeMix")
    m.data_type = "RGBA"
    m.blend_type = blend
    return m


def _in(node, ident):
    for s in node.inputs:
        if s.identifier == ident:
            return s
    raise KeyError(ident)


def _out(node, ident):
    for s in node.outputs:
        if s.identifier == ident:
            return s
    raise KeyError(ident)


def _math(nodes, links, op, a=None, b=None, va=None, vb=None):
    m = nodes.new("ShaderNodeMath")
    m.operation = op
    if a is not None:
        links.new(a, m.inputs[0])
    elif va is not None:
        m.inputs[0].default_value = va
    if b is not None:
        links.new(b, m.inputs[1])
    elif vb is not None:
        m.inputs[1].default_value = vb
    return m.outputs[0]


def _ramp(nodes, stops):
    r = nodes.new("ShaderNodeValToRGB")
    r.color_ramp.interpolation = "CONSTANT"
    els = r.color_ramp.elements
    while len(els) > 1:
        els.remove(els[-1])
    els[0].position = stops[0][0]
    els[0].color = (*stops[0][1], 1)
    for pos, col in stops[1:]:
        el = els.new(pos)
        el.color = (*col, 1)
    return r


T_SHADOW, T_LIGHT = 0.10, 0.42     # shading thresholds on the diffuse value


def _light_terms(nodes, links):
    """Returns (shade_value_socket, tone_socket[0..1: 0=shadow, .5=mid, 1=lit],
    halftone_dot_socket). Tone is quantised to 3 steps; dots appear in mid band."""
    diff = nodes.new("ShaderNodeBsdfDiffuse")
    diff.inputs["Color"].default_value = (1, 1, 1, 1)
    s2r = nodes.new("ShaderNodeShaderToRGB")
    links.new(diff.outputs[0], s2r.inputs[0])
    bw = nodes.new("ShaderNodeRGBToBW")
    links.new(s2r.outputs["Color"], bw.inputs[0])
    s = bw.outputs[0]
    # halftone dots in screen space (8 px cells, rotated grid)
    tc = nodes.new("ShaderNodeTexCoord")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(tc.outputs["Window"], sep.inputs[0])
    cell = 7.0
    px = _math(nodes, links, "MULTIPLY", sep.outputs[0], vb=W / cell)
    py = _math(nodes, links, "MULTIPLY", sep.outputs[1], vb=H / cell)
    c45 = math.cos(math.radians(45))
    u = _math(nodes, links, "ADD", _math(nodes, links, "MULTIPLY", px, vb=c45),
              _math(nodes, links, "MULTIPLY", py, vb=c45))
    v = _math(nodes, links, "SUBTRACT", _math(nodes, links, "MULTIPLY", py, vb=c45),
              _math(nodes, links, "MULTIPLY", px, vb=c45))
    fu = _math(nodes, links, "SUBTRACT", _math(nodes, links, "FRACT", u), vb=0.5)
    fv = _math(nodes, links, "SUBTRACT", _math(nodes, links, "FRACT", v), vb=0.5)
    d = _math(nodes, links, "SQRT", _math(nodes, links, "ADD",
              _math(nodes, links, "MULTIPLY", fu, fu),
              _math(nodes, links, "MULTIPLY", fv, fv)))
    # dot radius grows as shade approaches the shadow threshold
    t = _math(nodes, links, "DIVIDE", _math(nodes, links, "SUBTRACT", s, vb=T_SHADOW),
              vb=(T_LIGHT - T_SHADOW))
    t = _math(nodes, links, "MINIMUM", _math(nodes, links, "MAXIMUM", t, vb=0.0), vb=1.0)
    rad = _math(nodes, links, "MULTIPLY", _math(nodes, links, "SUBTRACT", va=1.0, b=t), vb=0.42)
    inband = _math(nodes, links, "MULTIPLY",
                   _math(nodes, links, "GREATER_THAN", s, vb=T_SHADOW),
                   _math(nodes, links, "LESS_THAN", s, vb=T_LIGHT))
    dot = _math(nodes, links, "MULTIPLY", _math(nodes, links, "LESS_THAN", d, rad), inband)
    return s, dot


def _toned(nodes, links, s, dot, lit, mid, shadow):
    """Three flat tones + shadow-coloured halftone dots over the mid tone."""
    r = _ramp(nodes, [(0.0, shadow), (T_SHADOW, mid), (T_LIGHT, lit)])
    links.new(s, r.inputs[0])
    m = _mix(nodes)
    links.new(dot, _in(m, "Factor_Float"))
    links.new(r.outputs["Color"], _in(m, "A_Color"))
    _in(m, "B_Color").default_value = (*shadow, 1)
    return _out(m, "Result_Color")


def lin(col):
    """sRGB display colour -> linear (materials are specified in sRGB)."""
    return tuple(((c + 0.055) / 1.055) ** 2.4 if c > 0.04045 else c / 12.92 for c in col)


def _tones(col, shade_tint=(0.70, 0.72, 0.86), mid_tint=(0.87, 0.88, 0.95)):
    lit = lin(col)
    mid = lin(tuple(c * t for c, t in zip(col, mid_tint)))
    sh = lin(tuple(c * t for c, t in zip(col, shade_tint)))
    return lit, mid, sh


def _emit(nodes, links, color_socket, name):
    em = nodes.new("ShaderNodeEmission")
    links.new(color_socket, em.inputs["Color"])
    em.inputs["Strength"].default_value = 1.0
    out = nodes.new("ShaderNodeOutputMaterial")
    links.new(em.outputs[0], out.inputs["Surface"])


def toon_material(name, col, **kw):
    mat = bpy.data.materials.new(name)
    nt, nodes, links = _nodes(mat)
    s, dot = _light_terms(nodes, links)
    c = _toned(nodes, links, s, dot, *_tones(col, **kw))
    _emit(nodes, links, c, name)
    return mat


# colours below are sRGB display values
WHITE = (0.985, 0.975, 0.95)
BLACK_LIT = (0.21, 0.22, 0.31)
BLACK_MID = (0.14, 0.14, 0.2)
BLACK_SH = (0.075, 0.075, 0.11)
PINK = (0.97, 0.69, 0.70)
INK = (0.09, 0.07, 0.11)


def body_material():
    mat = bpy.data.materials.new("CalfBody")
    nt, nodes, links = _nodes(mat)
    s, dot = _light_terms(nodes, links)
    white = _toned(nodes, links, s, dot, *_tones(WHITE))
    black = _toned(nodes, links, s, dot, lin(BLACK_LIT), lin(BLACK_MID), lin(BLACK_SH))
    pink = _toned(nodes, links, s, dot, *_tones(PINK, shade_tint=(0.80, 0.68, 0.78)))
    a_patch = nodes.new("ShaderNodeAttribute")
    a_patch.attribute_name = "patch"
    a_pink = nodes.new("ShaderNodeAttribute")
    a_pink.attribute_name = "pink"
    step_p = _math(nodes, links, "GREATER_THAN", a_patch.outputs["Fac"], vb=0.5)
    step_k = _math(nodes, links, "GREATER_THAN", a_pink.outputs["Fac"], vb=0.5)
    m1 = _mix(nodes)
    links.new(step_p, _in(m1, "Factor_Float"))
    links.new(white, _in(m1, "A_Color"))
    links.new(black, _in(m1, "B_Color"))
    m2 = _mix(nodes)
    links.new(step_k, _in(m2, "Factor_Float"))
    links.new(_out(m1, "Result_Color"), _in(m2, "A_Color"))
    links.new(pink, _in(m2, "B_Color"))
    _emit(nodes, links, _out(m2, "Result_Color"), "CalfBody")
    return mat


def flat_material(name, col):
    mat = bpy.data.materials.new(name)
    nt, nodes, links = _nodes(mat)
    rgb = nodes.new("ShaderNodeRGB")
    rgb.outputs[0].default_value = (*lin(col), 1)
    _emit(nodes, links, rgb.outputs[0], name)
    return mat


def outline_material():
    mat = flat_material("Outline", INK)
    mat.use_backface_culling = True
    try:
        mat.use_backface_culling_shadow = True
    except AttributeError:
        pass
    return mat


def shadow_material(stepped=False):
    mat = bpy.data.materials.new("ContactShadowStepped" if stepped else "ContactShadow")
    nt, nodes, links = _nodes(mat)
    tc = nodes.new("ShaderNodeTexCoord")
    gr = nodes.new("ShaderNodeTexGradient")
    gr.gradient_type = "SPHERICAL"
    links.new(tc.outputs["Object"], gr.inputs[0])
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "EASE"
    e = ramp.color_ramp.elements
    e[0].position, e[0].color = 0.0, (0, 0, 0, 1)
    e[1].position, e[1].color = 0.55, (0.42, 0.42, 0.42, 1)
    if stepped:   # flat two-step shadow for the high-camera frames (small WebP alpha)
        ramp.color_ramp.interpolation = "CONSTANT"
        e[1].position, e[1].color = 0.08, (0.14, 0.14, 0.14, 1)
        e.new(0.3).color = (0.26, 0.26, 0.26, 1)
    links.new(gr.outputs["Fac"], ramp.inputs[0])
    em = nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*lin((0.25, 0.18, 0.1)), 1)
    tr = nodes.new("ShaderNodeBsdfTransparent")
    mix = nodes.new("ShaderNodeMixShader")
    links.new(ramp.outputs["Color"], mix.inputs[0])
    links.new(tr.outputs[0], mix.inputs[1])
    links.new(em.outputs[0], mix.inputs[2])
    out = nodes.new("ShaderNodeOutputMaterial")
    links.new(mix.outputs[0], out.inputs["Surface"])
    mat.surface_render_method = "BLENDED"
    return mat


# ----------------------------------------------------------------------------
# Skeleton: rest (standing) pose and posed variants, in calf-local coordinates.
# x: + toward tail (head faces -x, i.e. image-left), y: + calf's left/far side,
# z: up. Camera looks from -y, so the -y side is the visible flank.
# ----------------------------------------------------------------------------
REST_FORE = [(-0.24, 0.60), (-0.205, 0.43), (-0.225, 0.26), (-0.215, 0.10),
             (-0.232, 0.052), (-0.245, 0.0)]
REST_HIND = [(0.29, 0.62), (0.215, 0.475), (0.345, 0.29), (0.325, 0.10),
             (0.317, 0.052), (0.307, 0.0)]
FORE_R = [(0.066, 0.05), (0.043, 0.033), (0.026, 0.026), (0.027, 0.03)]
FORE_KNOB = [0.047, 0.037, 0.033]            # elbow, knee (carpus), fetlock
HIND_R = [(0.095, 0.06), (0.052, 0.032), (0.026, 0.026), (0.027, 0.03)]
HIND_KNOB = [0.04, 0.036, 0.033]            # stifle, hock, fetlock
LEG_Y = 0.085


def _chain_geom(rest):
    L, A = [], []
    for (x0, z0), (x1, z1) in zip(rest[:-1], rest[1:]):
        dx, dz = x1 - x0, z1 - z0
        L.append(math.hypot(dx, dz))
        A.append(math.degrees(math.atan2(-dx, -dz)))
    return L, A


FORE_L, FORE_A = _chain_geom(REST_FORE)
HIND_L, HIND_A = _chain_geom(REST_HIND)


def leg_joints(root_xz, lengths, angles, y_root, y_foot, root_z_shift=0.0):
    pts = [V((root_xz[0], y_root, root_xz[1] + root_z_shift))]
    n = len(lengths)
    for i, (l, a) in enumerate(zip(lengths, angles)):
        ar = math.radians(a)
        p = pts[-1] + V((-math.sin(ar) * l, 0, -math.cos(ar) * l))
        p.y = y_root + (y_foot - y_root) * (i + 1) / n
        pts.append(p)
    return pts


REST_HC = V((-0.585, 0.0, 0.92))
REST_F = V((-0.74, 0.0, -0.67)).normalized()


def fore_angles(a, fl):
    """Foreleg segment angles from a whole-limb sweep `a` (deg, + = forward) and
    flexion `fl` (+ bends elbow/knee so the cannon folds back; - = rigid extension)."""
    c = -4 + a - 1.3 * fl
    return [-12 + a, 7 + a + 0.3 * fl, c, c + 15, c + 20]


def hind_angles(b, g):
    """Hind-leg angles from sweep `b` and flexion `g` (+ flexes stifle and hock)."""
    c = 5 + b + g
    return [30 + b + 0.5 * g, -35 + b - 0.6 * g, c, c + 10, c + 20]


def head_axes(pitch=0.0, roll=0.0, yaw=0.0):
    """Head frame: f forward (nose), u up, s = u x f (points to camera side)."""
    f0 = REST_F
    u0 = (V((0, 0, 1)) - f0 * f0.z).normalized()
    R = (Matrix.Rotation(math.radians(yaw), 3, "Z") @
         Matrix.Rotation(math.radians(pitch), 3, "Y"))
    f, u = R @ f0, R @ u0
    rr = Matrix.Rotation(math.radians(roll), 3, f)
    u = rr @ u
    s = u.cross(f)
    return f, s, u


def make_pose(name):
    P = {"name": name}
    # defaults = standing rest pose
    fore_a = {"near": list(FORE_A), "far": list(FORE_A)}
    hind_a = {"near": list(HIND_A), "far": list(HIND_A)}
    fy = {"near": (-LEG_Y, -LEG_Y), "far": (LEG_Y, LEG_Y)}
    hy = {"near": (-LEG_Y, -LEG_Y), "far": (LEG_Y, LEG_Y)}
    hc = REST_HC.copy()
    hp = dict(pitch=0.0, roll=0.0, yaw=0.0)
    # ear direction (back, out, up) as if the head were in its rest orientation;
    # it is carried along with the head's rotation
    ears = {"near": (0.8, 0.42, 0.05), "far": (0.8, 0.5, 0.15)}
    n1_off = V((-0.03, 0, -0.02))
    tail = [V((0.43, 0, 0.66)), V((0.47, 0, 0.58)), V((0.485, 0, 0.46)), V((0.48, 0, 0.35))]
    M = Matrix.Identity(4)
    frame = 0
    jaw, drool, cam = 0.0, False, "side"

    if name == "standing":
        hp["pitch"] = 4.0
        hc = V((-0.595, 0.0, 0.95))
    elif name == "sternal":
        fore_a["near"] = [-22, 65, -100, -115, -125]
        fore_a["far"] = [-18, 70, -98, -112, -122]
        fy["near"] = (-0.09, -0.06)
        fy["far"] = (0.09, 0.07)
        hind_a["near"] = [55, -48, 95, 100, 110]
        hind_a["far"] = [50, -45, 92, 98, 108]
        hy["near"] = (-0.1, -0.16)
        hy["far"] = (0.1, 0.15)
        hc = V((-0.585, -0.01, 0.875))
        hp.update(pitch=6.0, roll=-4.0, yaw=-4.0)
        ears = {"near": (0.75, 0.6, -0.25), "far": (0.75, 0.6, -0.2)}
        tail = [V((0.43, 0, 0.66)), V((0.49, 0, 0.60)), V((0.53, -0.03, 0.50)),
                V((0.52, -0.08, 0.40))]
    elif name.split("-")[0] in ("rest", "tonic", "clonic") and name != "rest":
        # ---- lying flat on her right side (lateral recumbency), seen from above
        kind = name.split("-")[0]
        frame = int(name.split("-")[1]) - 1 if "-" in name else 0
        if kind == "rest":           # relaxed, legs loosely flexed; rest-2 = tiny tremor
            tw = frame
            fn, ff = (58 + 2 * tw, 20 - 3 * tw), (52, 16)
            hn, hf = (-50 - 2 * tw, 20 + 3 * tw), (-44, 16)
            hc = V((-0.64, 0.05, 0.72))
            hp.update(pitch=32.0 + 1.5 * tw, roll=0.0)
            ears = {"near": (0.95, 0.15, 0.05 + 0.1 * tw), "far": (0.9, 0.2, 0.1)}
            n1_off = V((-0.02, 0.03, -0.01))
            jaw, drool = 0.0, False
        else:
            if kind == "tonic":      # rigid extension + strong opisthotonos
                fn, ff = (28, -12), (36, -10)
                hn, hf = (-22, -26), (-30, -24)
                hc = V((-0.46, 0.04, 1.04))
                hp.update(pitch=122.0)
                jaw = 12.0
            else:                    # clonic paddling, 3 phases of a running cycle
                ph = math.radians(120 * frame)
                phf = ph + math.radians(55)
                fn = (48 + 26 * math.sin(ph), 20 + 30 * math.cos(ph))
                ff = (48 + 26 * math.sin(phf), 20 + 30 * math.cos(phf))
                qh, qf = ph + math.pi, phf + math.pi
                hn = (-32 + 24 * math.sin(qh), 18 + 24 * math.cos(qh))
                hf = (-32 + 24 * math.sin(qf), 18 + 24 * math.cos(qf))
                hc = V((-0.48, 0.04, 1.01))
                hp.update(pitch=[112.0, 108.0, 114.0][frame])
                jaw = [22.0, 0.0, 18.0][frame]
            ears = {"near": (0.95, 0.12, 0.2), "far": (0.95, 0.15, 0.1)}
            n1_off = V((-0.05, 0.02, -0.01))
            drool = True
        fore_a["near"], fore_a["far"] = fore_angles(*fn), fore_angles(*ff)
        hind_a["near"], hind_a["far"] = hind_angles(*hn), hind_angles(*hf)
        fy["near"], fy["far"] = (-0.085, -0.02), (0.085, 0.14)
        hy["near"], hy["far"] = (-0.085, -0.03), (0.085, 0.14)
        tail = [V((0.43, 0, 0.66)), V((0.50, 0.03, 0.62)), V((0.60, 0.08, 0.57)),
                V((0.69, 0.11, 0.52))]
        # full 90 deg roll onto the right (+y) side: spine -> +y (away from the
        # high camera, top of image), legs -> -y (bottom of image)
        # and turned 10 deg on the floor (head nearer the viewer) so she can't be
        # mistaken for a standing/leaping calf seen side-on
        M = (Matrix.Rotation(math.radians(13), 4, "Z") @ Matrix.Translation(V((0, -0.6, 0))) @
             Matrix.Rotation(math.radians(-90), 4, "X"))
        cam = "high"
    elif name.startswith("side"):
        frame = int(name.split("-")[1]) - 1
        ph = [0.0, 1.0, -1.0][frame]           # paddle phase
        fore_a["near"] = [34 + 7 * ph, 52 + 9 * ph, 56 + 9 * ph, 62 + 9 * ph, 74 + 9 * ph]
        fore_a["far"] = [24 - 6 * ph, 44 - 8 * ph, 48 - 8 * ph, 56 - 8 * ph, 68 - 8 * ph]
        hind_a["near"] = [-8 - 6 * ph, -58 - 8 * ph, -62 - 8 * ph, -70 - 8 * ph, -80 - 8 * ph]
        hind_a["far"] = [-2 + 5 * ph, -50 + 7 * ph, -55 + 7 * ph, -62 + 7 * ph, -72 + 7 * ph]
        # near (-y) legs are the upper ones once she lies on her right side
        fy["near"] = (-0.085, -0.15)
        fy["far"] = (0.085, 0.03)
        hy["near"] = (-0.085, -0.16)
        hy["far"] = (0.085, 0.03)
        # head resting on the ground, pulled back (neck extended dorsally)
        hc = V((-0.62, 0.05, 0.74))
        hp.update(pitch=30.0 + [0, 3, -2][frame], roll=[0, 3, -3][frame], yaw=0.0)
        ears = {"near": (0.7, 0.6, -0.3), "far": (0.9, 0.25, 0.1)}
        n1_off = V((-0.01, 0.03, 0.01))
        tail = [V((0.43, 0, 0.66)), V((0.50, 0.03, 0.64)), V((0.60, 0.08, 0.60)),
                V((0.69, 0.11, 0.56))]
        # lie on the right (+y) side: local -z (legs) -> world -y (toward camera)
        # (rolled 75 deg rather than 90 so a little more flank faces the camera)
        M = Matrix.Translation(V((0, -0.55, 0))) @ Matrix.Rotation(math.radians(-75), 4, "X")

    f, s, u = head_axes(**hp)
    J = {"hc": hc, "f": f, "s": s, "u": u, "M": M, "ears": ears, "frame": frame,
         "jaw": jaw, "drool": drool, "cam": cam,
         # where along the neck the IV anchor sits (clear of the ear when arched)
         "neck_t": 0.55 if cam == "side" else (0.72 if name.startswith("rest") else 0.5),
         "neck_v": 0.035 if cam == "side" else (0.045 if name.startswith("rest") else 0.1)}
    J["hb"] = hc - 0.07 * f - 0.05 * u
    J["n0"] = V((-0.33, 0.0, 0.68))
    J["n1"] = (J["n0"] + J["hb"]) * 0.5 + n1_off
    J["tail"] = tail
    J["legs"] = {}
    for side in ("near", "far"):
        J["legs"]["fore_" + side] = leg_joints(REST_FORE[0], FORE_L, fore_a[side], *fy[side])
        J["legs"]["hind_" + side] = leg_joints(REST_HIND[0], HIND_L, hind_a[side], *hy[side])
    return J


# ----------------------------------------------------------------------------
# Metaball body
# ----------------------------------------------------------------------------
TORSO = [  # centre, surface radii (x, y, z)
    ((-0.17, 0, 0.60), (0.21, 0.155, 0.195)),
    ((0.06, 0, 0.575), (0.22, 0.17, 0.185)),
    ((0.27, 0, 0.625), (0.17, 0.15, 0.16)),
    ((-0.24, 0, 0.70), (0.12, 0.09, 0.08)),
    ((-0.33, 0, 0.58), (0.08, 0.09, 0.10)),
]
HEAD_PARTS = [  # (a, b, c) in head frame, surface radii (a, b, c)
    ((0.0, 0, 0.0), (0.115, 0.10, 0.108)),          # cranium
    ((0.10, 0, -0.03), (0.095, 0.074, 0.075)),      # face
    ((0.185, 0, -0.045), (0.058, 0.068, 0.062)),    # muzzle
    ((0.035, 0, -0.065), (0.08, 0.068, 0.055)),     # cheeks/jaw
    ((-0.035, 0, 0.07), (0.06, 0.08, 0.05)),        # poll
]


HS = 1.1   # overall head scale (big head = baby proportions)


def head_pt(J, a, b, c):
    return J["hc"] + HS * (a * J["f"] + b * J["s"] + c * J["u"])


def head_quat(J):
    return Matrix((J["f"], J["s"], J["u"])).transposed().to_quaternion()


JAW_HINGE = (0.02, 0.0, -0.06)


def jaw_rot(J):
    """Rotation opening the lower jaw by J['jaw'] degrees about the head's side axis."""
    return Matrix.Rotation(math.radians(J.get("jaw", 0.0)), 3, J["s"])


def jaw_pt(J, a, b, c):
    h = head_pt(J, *JAW_HINGE)
    return h + jaw_rot(J) @ (head_pt(J, a, b, c) - h)


def _elem(mb, kind, co, r, **kw):
    e = mb.elements.new(type=kind)
    e.co = co
    e.radius = r / SURF
    e.stiffness = STIFF
    for k, v in kw.items():
        setattr(e, k, v)
    return e


def _capsule(mb, a, b, r):
    d = b - a
    q = V((1, 0, 0)).rotation_difference(d.normalized())
    _elem(mb, "CAPSULE", (a + b) * 0.5, r, size_x=d.length * 0.5, rotation=q)


def tapered(mb, a, b, ra, rb):
    m = (a + b) * 0.5
    _capsule(mb, a, m, ra)
    _capsule(mb, m, b, rb)


def build_metaball(J):
    mb = bpy.data.metaballs.new("CalfMB")
    mb.resolution = MB_RES
    mb.render_resolution = MB_RES
    mb.threshold = 0.6
    ob = link(bpy.data.objects.new("CalfMB", mb))
    for c, r in TORSO:
        m = max(r)
        _elem(mb, "ELLIPSOID", c, m, size_x=r[0] / m, size_y=r[1] / m, size_z=r[2] / m)
    # neck
    tapered(mb, J["n0"], J["n1"], 0.125, 0.10)
    tapered(mb, J["n1"], J["hb"], 0.092, 0.085)
    # head
    q = head_quat(J)
    parts = list(HEAD_PARTS)
    open_mouth = J.get("jaw", 0.0) > 0.5
    if open_mouth:   # split muzzle into upper lip + a hinged lower jaw
        parts[2] = ((0.185, 0, -0.03), (0.058, 0.068, 0.05))
    for (a, b, c), r in parts:
        r = tuple(HS * x for x in r)
        m = max(r)
        _elem(mb, "ELLIPSOID", head_pt(J, a, b, c), m, size_x=r[0] / m,
              size_y=r[1] / m, size_z=r[2] / m, rotation=q)
    if open_mouth:
        qj = jaw_rot(J).to_quaternion() @ q
        r = (0.085 * HS, 0.055 * HS, 0.03 * HS)
        m = max(r)
        _elem(mb, "ELLIPSOID", jaw_pt(J, 0.135, 0, -0.088), m, size_x=r[0] / m,
              size_y=r[1] / m, size_z=r[2] / m, rotation=qj)
    # legs
    for key, pts in J["legs"].items():
        R = FORE_R if key.startswith("fore") else HIND_R
        K = FORE_KNOB if key.startswith("fore") else HIND_KNOB
        for i in range(4):
            tapered(mb, pts[i], pts[i + 1], *R[i])
        for i, kr in enumerate(K):
            _elem(mb, "BALL", pts[i + 1], kr)
        if key.startswith("hind"):   # point of the hock (calcaneus) sticks out behind
            d1 = (pts[2] - pts[1]).normalized()
            d2 = (pts[3] - pts[2]).normalized()
            back = (d1 - d2)
            if back.length > 1e-3:
                _elem(mb, "BALL", pts[2] + back.normalized() * 0.02 - d2 * 0.0, 0.026)
    # tail
    t = J["tail"]
    radii = [0.03, 0.02, 0.016, 0.014]
    for i in range(3):
        tapered(mb, t[i], t[i + 1], radii[i], radii[i + 1])
    d = (t[3] - t[2]).normalized()
    q2 = V((0, 0, 1)).rotation_difference(d)
    _elem(mb, "ELLIPSOID", t[3] + d * 0.015, 0.05, size_x=0.42, size_y=0.42, size_z=1.0,
          rotation=q2)
    return ob


def metaball_to_mesh(ob, name):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    me.name = name
    mbdata = ob.data
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.metaballs.remove(mbdata)
    return me


# ----------------------------------------------------------------------------
# Rest-space mapping so patches stay glued to the same body regions in every pose
# ----------------------------------------------------------------------------
def _seg_frame(a, b):
    x = (b - a).normalized()
    hint = V((0, 1, 0))
    z = x.cross(hint)
    if z.length < 1e-4:
        z = x.cross(V((0, 0, 1)))
    z.normalize()
    y = z.cross(x)
    return np.array(a), np.array([x, y, z]).T


def bones(J, with_jaw=False):
    """List of (seg_a, seg_b, radius, origin, R3x3) used for skin-like mapping."""
    out = []
    ident = np.eye(3)
    out.append((V((-0.3, 0, 0.6)), V((0.3, 0, 0.61)), 0.17, np.zeros(3), ident))
    for a, b, r in ((J["n0"], J["n1"], 0.1), (J["n1"], J["hb"], 0.08)):
        o, R = _seg_frame(a, b)
        out.append((a, b, r, o, R))
    Rh = np.array([J["f"], J["s"], J["u"]]).T
    out.append((J["hc"] - 0.03 * J["f"], J["hc"] + 0.2 * J["f"], 0.085, np.array(J["hc"]), Rh))
    for key in sorted(J["legs"]):
        pts = J["legs"][key]
        R = FORE_R if key.startswith("fore") else HIND_R
        for i in range(4):
            o, Rm = _seg_frame(pts[i], pts[i + 1])
            out.append((pts[i], pts[i + 1], max(R[i]), o, Rm))
    t = J["tail"]
    for i in range(3):
        o, Rm = _seg_frame(t[i], t[i + 1])
        out.append((t[i], t[i + 1], 0.02, o, Rm))
    if not with_jaw:
        return out
    # lower jaw (only used for open-mouth poses)
    Rj = np.array(jaw_rot(J)) @ Rh
    out.append((jaw_pt(J, 0.06, 0, -0.085), jaw_pt(J, 0.2, 0, -0.085), 0.03,
                np.array(head_pt(J, *JAW_HINGE)), Rj))
    return out


def rest_coords(P, J, Jrest):
    wj = J.get("jaw", 0.0) > 0.5
    bp, br = bones(J, wj), bones(Jrest, wj)
    n = len(P)
    acc = np.zeros((n, 3))
    wsum = np.zeros(n)
    head_w = np.zeros(n)
    for k, ((a, b, r, o, R), (_, _, _, o0, R0)) in enumerate(zip(bp, br)):
        a_, b_ = np.array(a), np.array(b)
        ab = b_ - a_
        t = np.clip(((P - a_) @ ab) / max(ab @ ab, 1e-9), 0, 1)
        d = np.linalg.norm(P - (a_ + t[:, None] * ab), axis=1)
        w = 1.0 / (np.maximum(d - r, 0) + 0.012) ** 4
        mapped = ((P - o) @ R) @ R0.T + o0
        acc += w[:, None] * mapped
        wsum += w
        if k == 3 or (wj and k == len(bp) - 1):
            head_w = head_w + w
    return acc / wsum[:, None], head_w / wsum


def _noise3(P, scale, seed):
    off = V((seed * 13.1, seed * 7.7, seed * 3.3))
    return np.array([noise.noise(V(p) * scale + off) for p in P])


EYE_ABC = (0.045, 0.09, 0.016)


def patch_fields(Rp, head_w, Jrest):
    """Return (patch, pink) scalar fields; >0.5 means black / pink."""
    n1 = _noise3(Rp, 7.0, 1)
    n2 = _noise3(Rp, 16.0, 2)
    warp = 0.22 * n1 + 0.07 * n2
    blobs = [  # centre, radii
        ((-0.26, -0.02, 0.70), (0.19, 0.26, 0.19)),     # shoulder/withers saddle
        ((0.30, -0.04, 0.68), (0.15, 0.24, 0.15)),      # rump
        ((0.07, -0.17, 0.61), (0.095, 0.09, 0.06)),     # small flank spot (visible side)
        ((0.05, 0.12, 0.66), (0.14, 0.12, 0.12)),       # far-side spot
        ((-0.50, 0.0, 0.84), (0.09, 0.2, 0.09)),        # upper neck
        ((0.44, 0.0, 0.62), (0.05, 0.08, 0.06)),        # tail head
    ]
    val = np.full(len(Rp), 9.0)
    for c, r in blobs:
        q = (Rp - np.array(c)) / np.array(r)
        val = np.minimum(val, np.linalg.norm(q, axis=1))
    s_body = 1.0 - val + warp
    # white belly and lower legs
    z = Rp[:, 2]
    s_body = np.minimum(s_body, (z - 0.44) * 8.0)
    # head: head-local coordinates in rest frame
    f, s, u, hc = (np.array(Jrest[k]) for k in ("f", "s", "u", "hc"))
    L = Rp - hc
    a, b, c = L @ f, L @ s, L @ u
    eye = np.array(EYE_ABC)
    de = np.sqrt(((a - eye[0]) / 0.058) ** 2 + ((b - eye[1]) / 0.06) ** 2 +
                 ((c - eye[2] - 0.01) / 0.05) ** 2)
    s_eye = 1.0 - de + 0.18 * n2
    crown = np.sqrt(((a + 0.03) / 0.07) ** 2 + (b / 0.13) ** 2 +
                    ((c - 0.10) / 0.06) ** 2)
    s_crown = 1.0 - crown + 0.2 * n2
    s_head = np.maximum(s_eye, s_crown)
    hw = np.clip((head_w - 0.2) * 2.2, 0, 1)
    s_all = s_body * (1 - hw) + s_head * hw
    patch = 0.5 + 2.0 * s_all
    # pink muzzle: front of the snout
    s_pink = (a - 0.162 - 0.012 * n2 + 0.03 * np.clip(-c / 0.06, -1, 1)) * 25.0
    s_pink = np.where(hw > 0.5, s_pink, -1.0)
    pink = 0.5 + s_pink
    return patch, pink


def smooth_field(me, vals, iters=4):
    """Laplacian smoothing of a per-vertex scalar over mesh edges (removes
    one-triangle jaggies where the rest-space mapping changes quickly)."""
    e = np.zeros(len(me.edges) * 2, dtype=np.int64)
    me.edges.foreach_get("vertices", e)
    e = e.reshape(-1, 2)
    n = len(vals)
    deg = np.bincount(e.ravel(), minlength=n).astype(float)
    deg[deg == 0] = 1
    v = vals.copy()
    for _ in range(iters):
        acc = np.zeros(n)
        np.add.at(acc, e[:, 0], v[e[:, 1]])
        np.add.at(acc, e[:, 1], v[e[:, 0]])
        v = 0.5 * v + 0.5 * acc / deg
    return v


def set_point_attr(me, name, vals):
    at = me.attributes.new(name, "FLOAT", "POINT")
    at.data.foreach_set("value", vals.astype(np.float32))


# ----------------------------------------------------------------------------
# Small parts: ears, eyes, nostrils, hooves
# ----------------------------------------------------------------------------
def sphere_mesh(name, radii, center, axes, seg=20, rings=12):
    """Ellipsoid mesh; axes is a 3x3 (columns = local x,y,z world directions)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    A = Matrix(axes) if not isinstance(axes, Matrix) else axes
    Mx = Matrix.Translation(center) @ A.to_4x4() @ Matrix.Diagonal((*radii, 1))
    bmesh.ops.transform(bm, matrix=Mx, verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    return me


def frame_from(x, up_hint):
    x = x.normalized()
    z = up_hint - x * up_hint.dot(x)
    if z.length < 1e-5:
        z = V((0, 0, 1)) - x * x.z
    z.normalize()
    y = z.cross(x)
    return Matrix((x, y, z)).transposed()


def cone_mesh(name, a, b, r_top, r_bot, seg=18):
    bm = bmesh.new()
    d = b - a
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                          radius1=r_bot, radius2=r_top, depth=d.length)
    q = V((0, 0, 1)).rotation_difference(d.normalized())
    # create_cone: z from -depth/2 (radius1) to +depth/2 (radius2) -> flip so top at a
    q = V((0, 0, -1)).rotation_difference(d.normalized())
    Mx = Matrix.Translation((a + b) * 0.5) @ q.to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Mx, verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return me


def small_parts(J):
    """Returns list of (mesh, material_key, outline?, cast_shadow?)."""
    parts = []
    f, s, u = J["f"], J["s"], J["u"]
    for side, sg in (("near", 1.0), ("far", -1.0)):
        eb, eo, eu = J["ears"][side]
        v = V((eb, -eo * sg, eu))
        f0, s0, u0 = head_axes()
        d = (v.dot(f0) * f + v.dot(s0) * s + v.dot(u0) * u).normalized()
        base = head_pt(J, -0.07, sg * 0.08, 0.035)
        c = base + d * 0.1
        ax = frame_from(d, s * sg + 0.25 * f)  # leaf-shaped, opening faces outward
        parts.append((sphere_mesh("ear_" + side, (0.1 * HS, 0.05 * HS, 0.013), c, ax), "ear", True, True))
        inner = c + ax.col[2] * 0.008 + d * 0.008
        parts.append((sphere_mesh("earin_" + side, (0.075 * HS, 0.033 * HS, 0.007), inner, ax), "earin",
                      False, False))
        # eye
        ec = head_pt(J, EYE_ABC[0], sg * EYE_ABC[1], EYE_ABC[2])
        eax = frame_from(s * sg, u)
        parts.append((sphere_mesh("eye_" + side, (0.026 * HS, 0.033 * HS, 0.035 * HS), ec, eax), "eye", True, False))
        hl = ec + s * sg * 0.024 + u * 0.014 + f * 0.006
        parts.append((sphere_mesh("hl_" + side, (0.006, 0.0075, 0.0075), hl, eax, 12, 8),
                      "white", False, False))
        # eyelid/brow bump in body colour would go here; kept simple
        # nostril
        nc = head_pt(J, 0.232, sg * 0.03, -0.03)
        nax = frame_from(f, u)
        parts.append((sphere_mesh("nos_" + side, (0.012, 0.011, 0.017), nc, nax, 12, 8),
                      "nostril", False, False))
    if J.get("jaw", 0.0) > 0.5:
        mc = jaw_pt(J, 0.15, 0, -0.058)
        mc = (mc + head_pt(J, 0.15, 0, -0.055)) * 0.5
        parts.append((sphere_mesh("mouth", (0.07 * HS, 0.05 * HS, 0.02 * HS), mc,
                                  frame_from(f, u)), "mouth", False, False))
    if J.get("drool"):
        lip = (jaw_pt if J.get("jaw", 0) > 0.5 else head_pt)(J, 0.13, 0.055, -0.08)
        # hang toward the floor / image-down (world -z and toward the viewer)
        down = (J["M"].to_3x3().inverted() @ V((0, -0.6, -1))).normalized()
        dv = down
        parts.append((sphere_mesh("drool", (0.055, 0.016, 0.016), lip + dv * 0.04,
                                  frame_from(dv, s)), "drool", True, False))
    for key, pts in J["legs"].items():
        a, b = pts[4], pts[5]
        parts.append((cone_mesh("hoof_" + key, a, b + (b - a).normalized() * 0.004, 0.029, 0.036),
                      "hoof", True, True))
    return parts


# ----------------------------------------------------------------------------
# Assembly
# ----------------------------------------------------------------------------
def make_outline(me, name, mat, width=OUTLINE_W):
    ol = me.copy()
    ol.name = name
    bm = bmesh.new()
    bm.from_mesh(ol)
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * width
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(ol)
    bm.free()
    ol.materials.clear()
    ol.materials.append(mat)
    ob = link(bpy.data.objects.new(name, ol))
    ob.visible_shadow = False
    return ob


def build_pose(name, mats, Jrest):
    J = make_pose(name)
    mbob = build_metaball(J)
    me = metaball_to_mesh(mbob, "CalfBody")
    P = np.zeros(len(me.vertices) * 3)
    me.vertices.foreach_get("co", P)
    P = P.reshape(-1, 3)
    Rp, head_w = rest_coords(P, J, Jrest)
    patch, pink = patch_fields(Rp, head_w, Jrest)
    patch = np.clip(smooth_field(me, np.clip(patch, -1, 2)), 0, 1)
    pink = np.clip(smooth_field(me, np.clip(pink, -1, 2), 2), 0, 1)
    set_point_attr(me, "patch", patch)
    set_point_attr(me, "pink", pink)
    me.shade_smooth()
    me.materials.append(mats["body"])
    objs = [link(bpy.data.objects.new("CalfBody", me))]
    objs.append(make_outline(me, "CalfBody_ol", mats["outline"]))
    for pm, key, outline, shadow in small_parts(J):
        pm.materials.append(mats[key])
        ob = link(bpy.data.objects.new(pm.name, pm))
        ob.visible_shadow = shadow
        objs.append(ob)
        if outline:
            objs.append(make_outline(pm, pm.name + "_ol", mats["outline"],
                                     OUTLINE_W * (0.55 if key == "eye" else 0.8)))
    # ground the calf: lowest vertex of the pose at z = 0
    M = J["M"]
    minz = min((M @ v.co).z for ob in objs if not ob.name.endswith("_ol")
               for v in ob.data.vertices)
    M = Matrix.Translation(V((0, 0, -minz))) @ M
    J["M"] = M
    for ob in objs:
        ob.matrix_world = M
    # contact shadow ellipse under the body
    world = np.array([M @ v.co for v in me.vertices])
    low = world[world[:, 2] < 0.2]
    xmin, xmax = np.percentile(low[:, 0], [2, 98])
    ymin, ymax = np.percentile(low[:, 1], [2, 98])
    sh_me = bpy.data.meshes.new("shadow")
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, segments=48, radius=1.0)
    bm.to_mesh(sh_me)
    bm.free()
    sh_me.materials.append(mats["shadow" if J["cam"] == "side" else "shadow_high"])
    sh = link(bpy.data.objects.new("ContactShadow", sh_me))
    sh.location = ((xmin + xmax) / 2, (ymin + ymax) / 2, 0.002)
    sh.scale = ((xmax - xmin) / 2 * 1.08 + 0.06, max((ymax - ymin) / 2 * 1.1, 0.16) + 0.04, 1)
    sh.visible_shadow = False
    objs.append(sh)
    if J["cam"] == "high":
        # softer ambient ellipse + a real cast shadow caught on an invisible floor
        sh.scale = (sh.scale[0] * 0.9, sh.scale[1] * 0.75, 1)
        gp_me = bpy.data.meshes.new("ground")
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=2.5)
        bm.to_mesh(gp_me)
        bm.free()
        gp_me.materials.append(mats["ground"])
        gp = link(bpy.data.objects.new("GroundCatcher", gp_me))
        gp.location = (0, 0, 0.001)
        gp.visible_shadow = False
        objs.append(gp)
    return J, objs


def anchors_for(J, sc, cam):
    M = J["M"]
    n0, hb = J["n0"], J["hb"]
    p = n0.lerp(hb, J.get("neck_t", 0.55))   # mid-neck (base of neck is inside the chest)
    axis = (hb - n0).normalized()
    ventral = (V((0, 0, -1)) - axis * (-axis.z)).normalized()
    # visible (-y) side of the neck, toward the throat (jugular groove)
    neck_pt = p + V((0, -0.085, 0)) + ventral * J.get("neck_v", 0.035)
    head_pt_c = J["hc"] + 0.08 * J["f"]

    def px(pt):
        c = world_to_camera_view(sc, cam, M @ pt)
        return [round(c.x * W, 1), round((1 - c.y) * H, 1)]

    g = world_to_camera_view(sc, cam, V((0, 0, 0)))
    return {"neck": px(neck_pt), "head": px(head_pt_c), "groundY": round((1 - g.y) * H, 1)}


def save(sc, stem, webp_quality=88):
    img = bpy.data.images["Render Result"]
    ims = sc.render.image_settings
    ims.file_format = "PNG"
    ims.color_mode = "RGBA"
    ims.color_depth = "8"
    ims.compression = 100
    png = os.path.join(RENDER_DIR, stem + ".png")
    img.save_render(png, scene=sc)
    ims.file_format = "WEBP"
    ims.color_mode = "RGBA"
    ims.quality = webp_quality
    webp = os.path.join(WEB_DIR, stem + ".webp")
    img.save_render(webp, scene=sc)
    ims.file_format = "PNG"
    return png, webp


WEBP_Q_HIGH = 80

POSES = ["rest-1", "rest-2", "tonic", "clonic-1", "clonic-2", "clonic-3",
         "sternal", "standing"]


def main():
    os.makedirs(RENDER_DIR, exist_ok=True)
    os.makedirs(WEB_DIR, exist_ok=True)
    sc = reset_scene()
    cams = setup_camera_and_light(sc)
    mats = make_materials()
    Jrest = make_pose("rest")
    only = [x for x in os.environ.get("CALF_ONLY", "").split(",") if x]
    anchors = {}
    for name in POSES:
        J, objs = build_pose(name, mats, Jrest)
        cam = cams[J["cam"]]
        sc.camera = cam
        cams["sun"].rotation_quaternion = SUN_DIRS[J["cam"]].normalized().to_track_quat("-Z", "Y")
        cams["sun"].data.angle = math.radians(2 if J["cam"] == "side" else 0.5)
        # the floor shadow is soft; extra samples keep it smooth (and the WebP small)
        sc.eevee.taa_render_samples = 24 if J["cam"] == "side" else 48
        anchors[name] = anchors_for(J, sc, cam)
        anchors[name]["camera"] = J["cam"]
        if not only or name in only:
            bpy.ops.render.render(write_still=False)
            png, webp = save(sc, "calf-" + name, 88 if J["cam"] == "side" else WEBP_Q_HIGH)
            print("RENDERED", png, os.path.getsize(png), webp, os.path.getsize(webp))
        for ob in objs:
            data = ob.data
            bpy.data.objects.remove(ob, do_unlink=True)
            if data is not None and data.users == 0:
                bpy.data.meshes.remove(data)
    with open(os.path.join(HERE, "calf-anchors.json"), "w") as fh:
        json.dump(anchors, fh, indent=2)
    print("ANCHORS", json.dumps(anchors))


def make_materials():
    return {
        "body": body_material(),
        "outline": outline_material(),
        "ear": toon_material("Ear", (0.10, 0.10, 0.14), shade_tint=(0.5, 0.5, 0.6)),
        "earin": toon_material("EarInner", (0.93, 0.62, 0.64)),
        "eye": flat_material("Eye", (0.045, 0.03, 0.035)),
        "white": flat_material("Highlight", (1, 1, 1)),
        "nostril": flat_material("Nostril", (0.45, 0.2, 0.24)),
        "hoof": toon_material("Hoof", (0.22, 0.2, 0.22), shade_tint=(0.45, 0.45, 0.55)),
        "shadow": shadow_material(),
        "shadow_high": shadow_material(stepped=True),
        "mouth": flat_material("Mouth", (0.45, 0.12, 0.16)),
        "drool": toon_material("Drool", (0.80, 0.90, 1.0)),
        "ground": cast_shadow_material(),
    }


if __name__ == "__main__":
    main()
