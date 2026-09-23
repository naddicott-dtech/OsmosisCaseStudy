"""Close-up "exam" illustrations in the same comic style as calf.py.

Run from the OsmosisCaseStudy folder:
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python art/exam.py

Outputs (800x600, opaque):
    art/renders/exam-<name>.png, public/art/exam-<name>.webp
    art/exam-anchors.json   overlay rectangles for the thermometer display and tube label

Set EXAM_ONLY=eye,head (comma list) to render a subset while iterating.
Everything is original procedural geometry; the calf is the model from calf.py.
"""
import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import calf  # noqa: E402  (shared model, materials and helpers)

V = Vector
EW, EH = 800, 600
calf.W, calf.H = EW, EH           # halftone cell size and resolution follow the exam size
HERE = calf.HERE
RENDER_DIR, WEB_DIR = calf.RENDER_DIR, calf.WEB_DIR
LENS = 50.0
SENSOR = 36.0
OUTLINE_PX = 3.6                  # target ink-line thickness in pixels at the subject

SC = None
MATS = {}
OW = 0.001                        # outline width (m), set per scene
OBJS = []                         # objects created for the current scene


# ----------------------------------------------------------------------------
# Generic helpers
# ----------------------------------------------------------------------------
def frame_width(dist):
    return 2 * dist * math.tan(math.atan(SENSOR / (2 * LENS)))


def set_outline_for(dist):
    global OW
    OW = OUTLINE_PX * frame_width(dist) / EW


def add(me, mat, outline=True, ol_scale=1.0, shadow=True, name=None):
    if name:
        me.name = name
    me.materials.clear()
    me.materials.append(MATS[mat] if isinstance(mat, str) else mat)
    ob = calf.link(bpy.data.objects.new(me.name, me))
    ob.visible_shadow = shadow
    OBJS.append(ob)
    if outline:
        OBJS.append(calf.make_outline(me, me.name + "_ol", MATS["outline"], OW * ol_scale))
    return ob


def world_mesh(me, M):
    me.transform(M)
    me.update()
    return me


def box_mesh(name, size, center=(0, 0, 0), bevel=0.0, M=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=V(size), verts=bm.verts)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts), offset=bevel,
                        segments=4, profile=0.5, affect="EDGES")
    bmesh.ops.translate(bm, vec=V(center), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    if M is not None:
        world_mesh(me, M)
    return me


def cyl(name, a, b, r1, r2=None, seg=28, smooth=True):
    me = calf.cone_mesh(name, V(a), V(b), r1, r1 if r2 is None else r2, seg)
    if smooth:
        me.shade_smooth()
    return me


def sph(name, radii, center, axes=None, seg=24, rings=14):
    return calf.sphere_mesh(name, radii, V(center), axes if axes is not None else Matrix.Identity(3),
                            seg, rings)


def curve_tube(name, pts, radius):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 4
    cu.resolution_u = 16
    cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    ob = calf.link(bpy.data.objects.new(name, cu))
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.curves.remove(cu)
    me.name = name
    me.shade_smooth()
    return me


def make_camera(loc, target, lens=LENS, roll_up=V((0, 0, 1))):
    cd = bpy.data.cameras.new("ExamCam")
    cd.lens = lens
    cd.sensor_width = SENSOR
    cd.clip_start = 0.01
    cd.clip_end = 30
    cam = calf.link(bpy.data.objects.new("ExamCam", cd))
    d = (V(target) - V(loc)).normalized()
    cam.location = loc
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = d.to_track_quat("-Z", "Y")
    SC.camera = cam
    OBJS.append(cam)
    bpy.context.view_layer.update()
    return cam


def cam_axes(cam):
    R = cam.matrix_world.to_3x3()
    return R.col[0].normalized(), R.col[1].normalized(), -R.col[2].normalized()


def make_sun(cam, side=0.55, down=0.65, energy=3.2):
    right, up, fwd = cam_axes(cam)
    d = (fwd + right * side - up * down).normalized()
    sd = bpy.data.lights.new("ExamSun", "SUN")
    sd.energy = energy
    sd.angle = math.radians(1.5)
    sun = calf.link(bpy.data.objects.new("ExamSun", sd))
    sun.rotation_mode = "QUATERNION"
    sun.rotation_quaternion = d.to_track_quat("-Z", "Y")
    OBJS.append(sun)
    return sun


def bg_material(name, top, bottom, streak=False):
    """Soft emission backdrop: warm vertical gradient + large low-contrast blotches
    (streaky when `streak`, suggesting out-of-focus straw)."""
    mat = bpy.data.materials.new(name)
    nt, nodes, links = calf._nodes(mat)
    tc = nodes.new("ShaderNodeTexCoord")
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(tc.outputs["Object"], sep.inputs[0])
    grad = calf._math(nodes, links, "MULTIPLY_ADD", sep.outputs[1], vb=0.5)
    grad.node.inputs[2].default_value = 0.5
    grad = calf._math(nodes, links, "MINIMUM", calf._math(nodes, links, "MAXIMUM", grad, vb=0.0),
                      vb=1.0)
    mg = calf._mix(nodes)
    links.new(grad, calf._in(mg, "Factor_Float"))
    calf._in(mg, "A_Color").default_value = (*calf.lin(bottom), 1)
    calf._in(mg, "B_Color").default_value = (*calf.lin(top), 1)
    mp = nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1.2, 7.0, 1.0) if streak else (2.0, 2.0, 2.0)
    mp.inputs["Rotation"].default_value = (0, 0, math.radians(18 if streak else 0))
    links.new(tc.outputs["Object"], mp.inputs[0])
    nz = nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 2.2
    nz.inputs["Detail"].default_value = 1.0
    links.new(mp.outputs[0], nz.inputs["Vector"])
    ramp = nodes.new("ShaderNodeValToRGB")
    e = ramp.color_ramp.elements
    e[0].position, e[0].color = 0.3, (0.86, 0.86, 0.86, 1)
    e[1].position, e[1].color = 0.7, (1.1, 1.08, 1.04, 1)
    links.new(nz.outputs["Fac"], ramp.inputs[0])
    mm = calf._mix(nodes, "MULTIPLY")
    calf._in(mm, "Factor_Float").default_value = 1.0
    links.new(calf._out(mg, "Result_Color"), calf._in(mm, "A_Color"))
    links.new(ramp.outputs["Color"], calf._in(mm, "B_Color"))
    calf._emit(nodes, links, calf._out(mm, "Result_Color"), name)
    return mat


def backdrop(cam, dist, mat, size_scale=1.4):
    """Camera-facing emission plane `dist` metres in front of the camera."""
    right, up, fwd = cam_axes(cam)
    w = frame_width(dist) * size_scale
    me = bpy.data.meshes.new("backdrop")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    bm.to_mesh(me)
    bm.free()
    R = Matrix((right, up, -fwd)).transposed().to_4x4()
    M = Matrix.Translation(cam.location + fwd * dist) @ R @ Matrix.Diagonal((w, w, 1, 1))
    me.transform(M)
    ob = add(me, mat, outline=False, shadow=False)
    return ob


def ground_plane(mat, size=4.0, z=0.0):
    me = bpy.data.meshes.new("groundbg")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=size / 2)
    bm.to_mesh(me)
    bm.free()
    me.transform(Matrix.Translation(V((0, 0, z))))
    return add(me, mat, outline=False, shadow=False)


def px(cam, p):
    c = world_to_camera_view(SC, cam, V(p))
    return V((c.x * EW, (1 - c.y) * EH))


def rect_anchor(cam, p0, p1, p3):
    """Oriented rectangle from 3 world corners: p0 (left-bottom), p1 (right-bottom),
    p3 (left-top). Returns x, y = top-left of the rectangle before rotation about its
    centre, width, height, rotationDeg (clockwise positive, CSS convention)."""
    a, b, c = px(cam, p0), px(cam, p1), px(cam, p3)
    wv, hv = b - a, c - a
    w, h = wv.length, abs(wv.x * hv.y - wv.y * hv.x) / max(wv.length, 1e-6)
    ctr = a + wv * 0.5 + hv * 0.5
    ang = math.degrees(math.atan2(wv.y, wv.x))
    return {"x": round(ctr.x - w / 2, 1), "y": round(ctr.y - h / 2, 1),
            "width": round(w, 1), "height": round(h, 1), "rotationDeg": round(ang, 1)}


# ----------------------------------------------------------------------------
# Gloved hand (metaballs, same technique as the calf)
# ----------------------------------------------------------------------------
FINGERS = [  # base y, segment lengths, radius   (index is on the thumb (+y) side)
    (0.027, (0.042, 0.025, 0.021), 0.0098),
    (0.009, (0.046, 0.028, 0.022), 0.0100),
    (-0.009, (0.043, 0.026, 0.021), 0.0095),
    (-0.026, (0.034, 0.021, 0.018), 0.0085),
]


def finger_tip(i, curls):
    y, lens, r = FINGERS[i]
    p = V((0.042, y, 0.0))
    ang = 0.0
    for L, c in zip(lens, curls):
        ang += math.radians(c)
        p = p + V((math.cos(ang), 0, -math.sin(ang))) * L
    return p


def build_hand(M, curls, thumb_tip, res=0.0022):
    """Hand in local coords: palm centre at origin, fingers along +x, palm faces -z,
    thumb on +y. `curls` = 4 x (3 joint angles, deg)."""
    mb = bpy.data.metaballs.new("HandMB")
    mb.resolution = mb.render_resolution = res
    ob = calf.link(bpy.data.objects.new("HandMB", mb))
    calf._elem(mb, "ELLIPSOID", V((0, 0, 0)), 0.046, size_x=1.0, size_y=0.9, size_z=0.36)
    calf.tapered(mb, V((0.034, 0.03, 0.0)), V((0.036, -0.028, 0.0)), 0.0145, 0.013)
    for (y, lens, r), cs in zip(FINGERS, curls):
        p = V((0.042, y, 0.0))
        ang = 0.0
        for k, (L, c) in enumerate(zip(lens, cs)):
            ang += math.radians(c)
            q = p + V((math.cos(ang), 0, -math.sin(ang))) * L
            calf.tapered(mb, p, q, r * (1 - 0.06 * k), r * (0.95 - 0.06 * k))
            p = q
    base = V((-0.006, 0.034, -0.006))
    tip = V(thumb_tip)
    mid = (base + tip) * 0.5 + V((-0.004, 0.016, 0.004))
    calf._elem(mb, "ELLIPSOID", V((-0.012, 0.024, -0.008)), 0.03, size_x=1.0, size_y=0.7,
               size_z=0.5)
    calf.tapered(mb, base, mid, 0.0145, 0.0125)
    calf.tapered(mb, mid, tip, 0.0115, 0.0098)
    calf.tapered(mb, V((-0.04, 0, 0.002)), V((-0.11, 0, 0.004)), 0.026, 0.025)
    me = calf.metaball_to_mesh(ob, "glove")
    me.transform(M)
    me.shade_smooth()
    add(me, "glove")
    # cuff roll and coverall sleeve
    a, b = M @ V((-0.095, 0, 0.004)), M @ V((-0.108, 0, 0.004))
    add(cyl("cuff", a, b, 0.029, 0.029), "glove", ol_scale=0.8)
    add(cyl("sleeve", M @ V((-0.108, 0, 0.004)), M @ V((-0.32, 0, 0.006)), 0.037, 0.041),
        "sleeve")


def hand_matrix(x_dir, z_dir, anchor_world, anchor_local):
    x = x_dir.normalized()
    z = (z_dir - x * z_dir.dot(x)).normalized()
    y = z.cross(x)
    R = Matrix((x, y, z)).transposed()
    return Matrix.Translation(anchor_world - R @ V(anchor_local)) @ R.to_4x4()


# ----------------------------------------------------------------------------
# Calf (reused from calf.py) with scene-appropriate resolution and outline width
# ----------------------------------------------------------------------------
JREST = None


def build_calf(res, drop_eye=False):
    calf.MB_RES = res
    J, objs = calf.build_pose("standing", MATS, JREST)
    keep = []
    for ob in objs:
        if ob.name.endswith("_ol") or (drop_eye and ob.name.split("_")[0] in ("eye", "hl")
                                       and ob.name.endswith("near")):
            data = ob.data
            bpy.data.objects.remove(ob, do_unlink=True)
            if data is not None and data.users == 0:
                bpy.data.meshes.remove(data)
            continue
        keep.append(ob)
    for ob in keep:
        OBJS.append(ob)
        if ob.name in ("ContactShadow",) or ob.name.split("_")[0] in ("hl", "earin", "nos"):
            continue
        sc = 0.55 if ob.name.startswith("eye") else (0.8 if ob.name.split("_")[0] in ("ear", "hoof") else 1.0)
        ol = calf.make_outline(ob.data, ob.name + "_ol", MATS["outline"], OW * sc)
        ol.matrix_world = ob.matrix_world
        OBJS.append(ol)
    J["body"] = next(o for o in keep if o.name == "CalfBody")
    return J


def W_(J, p):
    return J["M"] @ V(p)


def head_world(J, a, b, c):
    return J["M"] @ calf.head_pt(J, a, b, c)


def head_axes_world(J):
    R = J["M"].to_3x3()
    return (R @ J["f"]).normalized(), (R @ J["s"]).normalized(), (R @ J["u"]).normalized()


def surface_hit(ob, origin, direction):
    Mi = ob.matrix_world.inverted()
    ok, loc, nrm, _ = ob.ray_cast(Mi @ origin, (Mi.to_3x3() @ direction).normalized())
    if not ok:
        raise RuntimeError("ray missed the calf")
    return ob.matrix_world @ loc, (ob.matrix_world.to_3x3().inverted().transposed() @ nrm).normalized()


# ----------------------------------------------------------------------------
# Scenes
# ----------------------------------------------------------------------------
def scene_thermometer():
    """Digital thermometer lying on a folded clean towel (display blank)."""
    rot = Matrix.Rotation(math.radians(-6), 4, "Z")
    # towel (two folded layers) with stripes
    add(box_mesh("towel", (0.36, 0.2, 0.018), (0.0, 0.01, 0.009), 0.008, rot), "towel")
    add(box_mesh("towel2", (0.34, 0.17, 0.014), (-0.005, 0.02, 0.025), 0.007, rot), "towel")
    for yy in (-0.045, -0.035, 0.085):
        add(box_mesh("stripe", (0.335, 0.005, 0.002), (-0.005, yy, 0.0325), 0.0, rot),
            "towelstripe", outline=False, shadow=False)
    z0 = 0.032 + 0.008
    T = rot @ Matrix.Translation(V((0.0, 0.015, z0)))
    parts = [
        (box_mesh("thermo_body", (0.12, 0.034, 0.016), (-0.012, 0, 0), 0.0075, T), "plastic", True),
        (box_mesh("thermo_grip", (0.03, 0.036, 0.018), (-0.068, 0, 0), 0.008, T), "teal", True),
        (cyl("thermo_nose", T @ V((0.045, 0, 0)), T @ V((0.075, 0, 0)), 0.0115, 0.0045),
         "plastic", True),
        (cyl("thermo_probe", T @ V((0.074, 0, 0)), T @ V((0.118, 0, 0)), 0.0028), "steel", True),
        (sph("thermo_tip", (0.0033,) * 3, T @ V((0.118, 0, 0))), "steel", True),
        (box_mesh("thermo_bezel", (0.066, 0.027, 0.003), (0.0, 0, 0.0075), 0.0025, T),
         "bezel", True),
        (cyl("thermo_button", T @ V((-0.047, 0, 0.007)), T @ V((-0.047, 0, 0.0105)), 0.0058),
         "teal", True),
    ]
    for me, m, ol in parts:
        add(me, m, outline=ol, ol_scale=0.8)
    # LCD window (blank)
    lcd_w, lcd_h, lcd_z = 0.058, 0.021, 0.0093
    add(box_mesh("thermo_lcd", (lcd_w, lcd_h, 0.0012), (0.0, 0, lcd_z), 0.0, T), "lcd",
        outline=False, shadow=True)
    target = T @ V((0.005, -0.004, 0))
    e = math.radians(58)
    dist = 0.34
    cam = make_camera(target + V((0.0, -math.cos(e), math.sin(e))) * dist, target)
    set_outline_for(dist)
    make_sun(cam, side=0.5, down=0.5)
    ground_plane(bg_material("StrawBg", (0.93, 0.82, 0.58), (0.80, 0.64, 0.38), streak=True),
                 size=3.0)
    zt = lcd_z + 0.0006
    anchor = rect_anchor(cam, T @ V((-lcd_w / 2, -lcd_h / 2, zt)), T @ V((lcd_w / 2, -lcd_h / 2, zt)),
                         T @ V((-lcd_w / 2, lcd_h / 2, zt)))
    return cam, {"display": anchor}


def scene_blood():
    """Red-top serum tube (3/4 full, blank white label) lying on a steel tray."""
    add(box_mesh("tray", (0.34, 0.24, 0.012), (0, 0, 0.006), 0.01), "tray")
    for (cx, cy, sx, sy) in ((0, 0.117, 0.34, 0.008), (0, -0.117, 0.34, 0.008),
                             (0.167, 0, 0.008, 0.24), (-0.167, 0, 0.008, 0.24)):
        add(box_mesh("rim", (sx, sy, 0.02), (cx, cy, 0.016), 0.003), "tray", ol_scale=0.7)
    # gauze square for context
    add(box_mesh("gauze", (0.06, 0.06, 0.004), (0.095, 0.05, 0.014), 0.002,
                 Matrix.Rotation(math.radians(20), 4, "Z")), "gauze")
    r, L = 0.0085, 0.105                   # tube radius and length (x from bottom)
    ang = math.radians(7)
    zc = 0.012 + 0.0105                    # tube axis height (resting on the stopper)
    T = Matrix.Translation(V((-0.04, -0.01, zc))) @ Matrix.Rotation(ang, 4, "Z")
    ax = (T.to_3x3() @ V((1, 0, 0))).normalized()
    fill = 0.75 * 0.085                    # blood length inside the 85 mm barrel
    add(sph("blood_end", (r * 0.86,) * 3, T @ V((r, 0, 0))), "blood", outline=False)
    add(cyl("blood", T @ V((r, 0, 0)), T @ V((fill, 0, 0)), r * 0.86), "blood", outline=False)
    add(sph("tube_end", (r,) * 3, T @ V((r, 0, 0))), "tubeglass", ol_scale=0.8, shadow=False)
    add(cyl("tube", T @ V((r, 0, 0)), T @ V((0.087, 0, 0)), r), "tubeglass", ol_scale=0.8,
        shadow=False)
    lab0, lab1 = 0.021, 0.058
    add(cyl("label", T @ V((lab0, 0, 0)), T @ V((lab1, 0, 0)), r * 1.045, seg=40), "label",
        ol_scale=0.7)
    add(cyl("stopper", T @ V((0.084, 0, 0)), T @ V((0.098, 0, 0)), r * 1.12, r * 1.2), "stopper",
        ol_scale=0.8)
    add(cyl("stopper_top", T @ V((0.098, 0, 0)), T @ V((L, 0, 0)), r * 1.25, r * 1.22), "stopper",
        ol_scale=0.8)
    add(box_mesh("glint", (0.05, 0.0012, 0.0006), (0.052, 0, r * 0.98), 0.0,
                 T @ Matrix.Rotation(math.radians(-35), 4, "X")), "white", outline=False,
        shadow=False)
    target = T @ V((0.052, 0, 0))
    e = math.radians(52)
    dist = 0.2
    cam = make_camera(target + V((0.0, -math.cos(e), math.sin(e))) * dist, target)
    set_outline_for(dist)
    make_sun(cam, side=0.45, down=0.5)
    ground_plane(bg_material("TableBg", (0.9, 0.8, 0.62), (0.76, 0.6, 0.4), streak=True))
    # label anchor on the camera-facing side of the band
    right, up, fwd = cam_axes(cam)
    v = -fwd - ax * (-fwd).dot(ax)
    v.normalize()
    w = ax.cross(v).normalized()
    if w.dot(up) < 0:
        w = -w
    c0 = T @ V((0, 0, 0))
    base = lambda x: c0 + ax * x + v * (r * 1.045)        # noqa: E731
    hh = r * 0.62
    anchor = rect_anchor(cam, base(lab0 + 0.003) - w * hh, base(lab1 - 0.003) - w * hh,
                         base(lab0 + 0.003) + w * hh)
    return cam, {"label": anchor}


def scene_stethoscope():
    J = build_calf(0.005)
    body = J["body"]
    P, n = surface_hit(body, W_(J, (-0.13, -0.8, 0.52)), V((0, 1, 0)))
    upt = (V((0, 0, 1)) - n * n.z).normalized()
    rt = upt.cross(n).normalized()          # tangent toward the calf's tail (image right)
    # chest piece
    add(cyl("diaphragm", P - n * 0.001, P + n * 0.003, 0.025), "rubber", ol_scale=0.7)
    add(cyl("ring", P + n * 0.002, P + n * 0.012, 0.028, 0.027, seg=40), "steel")
    add(cyl("bell", P + n * 0.012, P + n * 0.019, 0.019, 0.014, seg=32), "steeldark", ol_scale=0.8)
    s0 = P + n * 0.014 + upt * 0.004
    s1 = s0 + upt * 0.034 + n * 0.012
    add(cyl("stem", s0, s1, 0.0035), "steel", ol_scale=0.7)
    tube = curve_tube("tubing", [s1 - (s1 - s0).normalized() * 0.004, s1 + upt * 0.06 + n * 0.03,
                                 s1 + upt * 0.16 + n * 0.07 - rt * 0.02,
                                 s1 + upt * 0.34 + n * 0.12 - rt * 0.06], 0.0048)
    add(tube, "rubber")
    # gloved hand pressing the rim from above-right, fingertips on the chest piece
    curls = [(18, 22, 12), (24, 28, 16), (38, 45, 25), (48, 55, 30)]
    thumb = V((0.083, 0.036, -0.022))
    tipL = finger_tip(1, curls[1])
    Mh = hand_matrix(-upt * 0.75 - rt * 0.6, n, P + n * 0.02 + rt * 0.012 + upt * 0.006, tipL)
    build_hand(Mh, curls, thumb)
    dist = 0.6
    target = P - rt * 0.06 - upt * 0.035
    cam = make_camera(target + n * dist + upt * 0.1 - rt * 0.12, target)
    set_outline_for(dist)
    make_sun(cam, side=0.5, down=0.6)
    right, up, fwd = cam_axes(cam)
    backdrop(cam, 2.5, bg_material("BarnBg", (0.9, 0.8, 0.62), (0.7, 0.55, 0.36)))
    return cam, {}


def sunken_eye(J):
    f, s, u = head_axes_world(J)
    hs = calf.HS
    ec = head_world(J, calf.EYE_ABC[0], calf.EYE_ABC[1], calf.EYE_ABC[2]) - s * 0.0045
    eax = calf.frame_from(s, u)
    add(sph("eyeball", (0.019 * hs, 0.031 * hs, 0.033 * hs), ec, eax, 32, 20), "iris",
        ol_scale=0.5)
    front = ec + s * 0.019 * hs
    add(sph("pupil", (0.003, 0.016, 0.0085), front - s * 0.001 + u * 0.002,
            calf.frame_from(s, u)), "eye", outline=False, shadow=False)
    add(sph("hl1", (0.0035, 0.0075, 0.0075), front + u * 0.012 + f * 0.009, eax, 12, 8),
        "white", outline=False, shadow=False)
    add(sph("hl2", (0.002, 0.0035, 0.0035), front - u * 0.009 - f * 0.011, eax, 10, 6),
        "white", outline=False, shadow=False)
    # visible gap: pink conjunctiva crescent between the eyeball and the (slightly
    # dropped) lower lid -- the "sunken eye" sign
    add(sph("gap", (0.005, 0.0075, 0.023 * hs), ec + s * 0.009 - u * 0.0375 - f * 0.002,
            calf.frame_from(s, f), 24, 12), "conj", outline=False, shadow=False)
    ra = 0.037 * hs

    def lid(name, t0, t1, rb, r0, out):
        """Tapered eyelid: a chain of metaballs along an arc around the socket."""
        mb = bpy.data.metaballs.new(name)
        mb.resolution = mb.render_resolution = 0.0012
        ob = calf.link(bpy.data.objects.new(name, mb))
        pts = []
        N = 24
        for k in range(N):
            t = math.radians(t0 + (t1 - t0) * k / (N - 1))
            p = ec + s * out + f * (math.cos(t) * ra) + u * (math.sin(t) * rb)
            pts.append(p)
            rr = r0 * (0.35 + 0.65 * math.sin(math.pi * k / (N - 1)))
            calf._elem(mb, "BALL", p, rr)
        me = calf.metaball_to_mesh(ob, name)
        me.shade_smooth()
        add(me, "coatblack", ol_scale=0.7)
        return pts

    upper = lid("lid_up", 5, 175, 0.037 * hs, 0.0075, 0.019)
    lid("lid_lo", 195, 345, 0.049 * hs, 0.0062, 0.013)
    # lashes on the upper lid
    for k in range(8, 20, 3):
        p = upper[k]
        d = (p - ec).normalized() * 0.6 + s * 0.5
        add(cyl("lash", p, p + d.normalized() * 0.017, 0.0022, 0.0007), "coatblack",
            outline=False)
    return ec


def scene_eye():
    J = build_calf(0.0032, drop_eye=True)
    f, s, u = head_axes_world(J)
    ec = sunken_eye(J)
    dist = 0.42
    target = ec + f * 0.015 - u * 0.005
    cam = make_camera(target + s * dist + u * 0.03 - f * 0.02, target)
    set_outline_for(dist)
    make_sun(cam, side=0.45, down=0.6)
    backdrop(cam, 2.5, bg_material("BarnBg", (0.9, 0.8, 0.62), (0.7, 0.55, 0.36)))
    return cam, {}


def scene_head():
    J = build_calf(0.0045)
    body = J["body"]
    f, s, u = head_axes_world(J)
    ec = head_world(J, *calf.EYE_ABC)
    # small scrape just above the left eye: pink abrasion + a few missing-hair lines
    P, n = surface_hit(body, ec + u * 0.05 - f * 0.01 + s * 0.2, -s)
    tx = (f - n * f.dot(n)).normalized()
    ax = Matrix((tx, n.cross(tx), n)).transposed()
    add(sph("scrape", (0.02, 0.007, 0.0012), P + n * 0.0006, ax, 24, 8), "scrape",
        ol_scale=0.35, shadow=False)
    for k, off in enumerate((-0.0035, 0.0, 0.0035)):
        q = P + n * 0.0014 + ax.col[1] * off + tx * (0.002 * (k - 1))
        add(sph("scratch", (0.011 - 0.002 * abs(k - 1), 0.0009, 0.0006), q, ax, 12, 6),
            "scratch", outline=False, shadow=False)
    # penlight in a gloved hand, shining at the eye from in front / below
    tip = ec + f * 0.055 - u * 0.045 + s * 0.045
    a = (f * 0.55 - u * 0.8 + s * 0.25).normalized()
    add(cyl("pen", tip + a * 0.004, tip + a * 0.13, 0.0058), "steel", ol_scale=0.8)
    add(cyl("pen_cap", tip, tip + a * 0.012, 0.0066, 0.0062), "penblue", ol_scale=0.8)
    add(cyl("pen_clip", tip + a * 0.09 + (a.cross(s)).normalized() * 0.006,
            tip + a * 0.125 + (a.cross(s)).normalized() * 0.006, 0.0016), "steel",
        ol_scale=0.5)
    add(sph("pen_glow", (0.0075,) * 3, tip - a * 0.002), "glow", outline=False, shadow=False)
    beam_end = tip + (ec + s * 0.03 - tip) * 0.55
    add(cyl("beam", tip - a * 0.002, beam_end, 0.005, 0.014), "beam", outline=False, shadow=False)
    curls = [(55, 62, 38), (60, 65, 40), (62, 66, 40), (64, 66, 40)]
    thumb = V((0.07, 0.03, -0.035))
    grip = V((0.062, 0.0, -0.028))
    # re-orient so the pen runs along the hand's y (across the fist)
    x_h = (-u - a * (-u).dot(a)).normalized()
    y_h = a
    z_h = x_h.cross(y_h).normalized()
    if z_h.dot(s) < 0:
        x_h, z_h = -x_h, -z_h
        y_h = z_h.cross(x_h)
    R = Matrix((x_h, y_h, z_h)).transposed()
    Mh = Matrix.Translation(tip + a * 0.075 - R @ grip) @ R.to_4x4()
    build_hand(Mh, curls, thumb)
    dist = 0.85
    target = ec + f * 0.02 - u * 0.06
    cam = make_camera(target + s * dist + u * 0.08 + f * 0.02, target)
    set_outline_for(dist)
    make_sun(cam, side=0.45, down=0.6)
    backdrop(cam, 2.5, bg_material("BarnBg", (0.9, 0.8, 0.62), (0.7, 0.55, 0.36)))
    return cam, {}


SCENES = {
    "thermometer": scene_thermometer,
    "stethoscope": scene_stethoscope,
    "eye": scene_eye,
    "head": scene_head,
    "blood": scene_blood,
}


def exam_materials():
    m = calf.make_materials()
    t = calf.toon_material
    m.update({
        "glove": t("Glove", (0.44, 0.58, 0.96), shade_tint=(0.62, 0.62, 0.84)),
        "sleeve": t("Sleeve", (0.22, 0.38, 0.36), shade_tint=(0.6, 0.62, 0.78)),
        "steel": t("Steel", (0.84, 0.87, 0.9), shade_tint=(0.55, 0.58, 0.72)),
        "steeldark": t("SteelDark", (0.62, 0.66, 0.72), shade_tint=(0.55, 0.58, 0.72)),
        "rubber": t("Rubber", (0.16, 0.16, 0.19), shade_tint=(0.55, 0.55, 0.7)),
        "plastic": t("Plastic", (0.97, 0.97, 0.96)),
        "teal": t("Teal", (0.16, 0.62, 0.66)),
        "bezel": t("Bezel", (0.26, 0.28, 0.32)),
        "lcd": calf.flat_material("LCD", (0.80, 0.85, 0.76)),
        "towel": t("Towel", (0.80, 0.9, 0.97)),
        "towelstripe": t("TowelStripe", (0.36, 0.6, 0.82)),
        "tray": t("Tray", (0.80, 0.83, 0.87), shade_tint=(0.62, 0.65, 0.78)),
        "blood": t("Blood", (0.5, 0.02, 0.06), shade_tint=(0.6, 0.5, 0.6)),
        "gauze": t("Gauze", (0.97, 0.97, 0.95)),
        "label": t("Label", (0.99, 0.99, 0.98), shade_tint=(0.8, 0.8, 0.9)),
        "stopper": t("Stopper", (0.86, 0.12, 0.14), shade_tint=(0.65, 0.55, 0.65)),
        "iris": t("Iris", (0.22, 0.12, 0.08), shade_tint=(0.5, 0.45, 0.5)),
        "conj": t("Conjunctiva", (0.86, 0.46, 0.5)),
        "coatblack": calf.toon_material("CoatBlack", (1, 1, 1)),
        "scrape": t("Scrape", (0.93, 0.5, 0.52)),
        "scratch": t("Scratch", (0.76, 0.26, 0.3)),
        "penblue": t("PenBlue", (0.2, 0.36, 0.7)),
        "glow": calf.flat_material("Glow", (1.0, 0.97, 0.8)),
    })
    # black coat colour for eyelids (matches the body's black patches)
    cb = m["coatblack"]
    nt, nodes, links = calf._nodes(cb)
    s, dot = calf._light_terms(nodes, links)
    c = calf._toned(nodes, links, s, dot, calf.lin(calf.BLACK_LIT), calf.lin(calf.BLACK_MID),
                    calf.lin(calf.BLACK_SH))
    calf._emit(nodes, links, c, "CoatBlack")
    # clear tube plastic and light beam (semi-transparent)
    for key, col, alpha in (("tubeglass", (0.9, 0.95, 1.0), 0.13), ("beam", (1.0, 0.96, 0.7), 0.22)):
        mat = bpy.data.materials.new(key)
        nt, nodes, links = calf._nodes(mat)
        em = nodes.new("ShaderNodeEmission")
        em.inputs["Color"].default_value = (*calf.lin(col), 1)
        tr = nodes.new("ShaderNodeBsdfTransparent")
        mix = nodes.new("ShaderNodeMixShader")
        mix.inputs[0].default_value = alpha
        links.new(tr.outputs[0], mix.inputs[1])
        links.new(em.outputs[0], mix.inputs[2])
        out = nodes.new("ShaderNodeOutputMaterial")
        links.new(mix.outputs[0], out.inputs["Surface"])
        mat.surface_render_method = "BLENDED"
        m[key] = mat
    return m


def clear_scene():
    for ob in OBJS:
        try:
            data = ob.data
            bpy.data.objects.remove(ob, do_unlink=True)
            if isinstance(data, bpy.types.Mesh) and data.users == 0:
                bpy.data.meshes.remove(data)
        except ReferenceError:
            pass
    OBJS.clear()


def save(stem, quality):
    img = bpy.data.images["Render Result"]
    ims = SC.render.image_settings
    ims.file_format = "PNG"
    ims.color_mode = "RGB"
    ims.color_depth = "8"
    ims.compression = 100
    png = os.path.join(RENDER_DIR, stem + ".png")
    img.save_render(png, scene=SC)
    ims.file_format = "WEBP"
    ims.color_mode = "RGB"
    ims.quality = quality
    webp = os.path.join(WEB_DIR, stem + ".webp")
    img.save_render(webp, scene=SC)
    return png, webp


WEBP_Q = {"thermometer": 94, "stethoscope": 92, "eye": 93, "head": 92, "blood": 95}


def main():
    global SC, MATS, JREST
    SC = calf.reset_scene()
    SC.render.film_transparent = False
    SC.render.resolution_x, SC.render.resolution_y = EW, EH
    SC.eevee.taa_render_samples = 32
    MATS = exam_materials()
    JREST = calf.make_pose("rest")
    only = [x for x in os.environ.get("EXAM_ONLY", "").split(",") if x]
    anchors = {}
    apath = os.path.join(HERE, "exam-anchors.json")
    if os.path.exists(apath):
        with open(apath) as fh:
            anchors = json.load(fh)
    for name, fn in SCENES.items():
        if only and name not in only:
            continue
        cam, anc = fn()
        if anc:
            anchors[name] = anc
        bpy.ops.render.render(write_still=False)
        png, webp = save("exam-" + name, WEBP_Q[name])
        print("RENDERED", name, os.path.getsize(png), os.path.getsize(webp), json.dumps(anc))
        clear_scene()
    anchors = {k: anchors[k] for k in ("thermometer", "blood") if k in anchors}
    with open(apath, "w") as fh:
        json.dump(anchors, fh, indent=2)
    print("ANCHORS", json.dumps(anchors))


main()
