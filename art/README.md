# Calf art (procedural Blender renders)

A stylized Holstein heifer calf, about 3 weeks old, drawn in a flat comic style (cel shading, halftone dots, ink outlines). It is rendered in five poses for the osmosis case study.

## Regenerate

From the `OsmosisCaseStudy/` folder:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python art/calf.py
```

- The script was built and tested with Blender 5.1.0 using the EEVEE engine. A full run takes about 20 s.
- It is deterministic: it uses no randomness, and the geometry, patches and anchors come out identical on every run. The PNG bytes can still differ very slightly between runs because of GPU anti-aliasing, but the difference is not visible.
- Set `CALF_ONLY=<pose>` (e.g. `CALF_ONLY=standing`) to render a single pose while iterating. The anchors JSON is still written for all poses.

## Files

| File | What it is |
|---|---|
| `art/calf.py` | Builds the model, materials, camera and poses, then renders everything |
| `art/renders/calf-side-1.png`, `-2`, `-3` | **Lateral recumbency** (flat on her side, stiff extended legs, head down). The frames differ only in a small leg "paddle" and head tilt, so they loop as a 3-frame seizure animation |
| `art/renders/calf-sternal.png` | **Sternal recumbency** (upright on her chest, legs tucked, head up, ears relaxed): stable / recovering |
| `art/renders/calf-standing.png` | **Standing**, head up and alert: healthy |
| `public/art/calf-*.webp` | Web copies of the same five images (WebP with alpha, about 30 KB each), written directly by Blender |
| `art/calf-anchors.json` | Per-pose 2D pixel anchors in the 1200×780 image (origin top-left): `neck` = IV catheter site on the visible side of the neck (jugular groove), `head` = centre of the head, `groundY` = the ground line |

All renders are 1200×780 RGBA with a transparent background. They use the same orthographic camera, raised 20° above the horizontal, with the calf facing left. Swapping between poses keeps her aligned. The ground plane (z = 0) sits at y = 686.4 px, which is 88% of the image height, in every pose.

Because the camera looks slightly down, the hooves and legs nearest the viewer appear a few pixels below `groundY`. A soft contact-shadow ellipse is part of each image.

## How the model works

- **Body:** a single metaball "skeleton" (ellipsoids for the torso and head, tapered capsules for the neck, legs and tail, plus balls at the knee, hock and fetlock joints for knobbly legs). It is converted to a mesh for each pose. Poses are made by moving joint positions (leg segment angles, head frame, tail points). There is no armature.
- **Holstein patches:** each vertex is mapped back to rest-pose coordinates by blending per-bone rigid transforms. A patch field is then computed from hand-placed blobs warped by Blender's built-in Perlin noise, and stored as mesh attributes (`patch`, `pink`). Because the field is computed in rest space, patches stay on the same body regions in every pose. The belly and lower legs are kept white. The face is white apart from a black patch around the visible eye and on the crown. The muzzle is pink.
- **Separate parts:** ears (black with pink inner), eyes with a highlight, nostrils, and dark hooves.
- **Shading:** Diffuse → Shader to RGB → constant 3-step colour ramp → Emission, with shadow-coloured screen-space halftone dots in the mid-tone band.
- **Outlines:** inverted-hull copies (vertices pushed out along the normals, faces flipped, backface culled). They are set not to cast shadows.

## Originality

The calf model, patch pattern, materials and poses are original. They were generated entirely from numbers and code in `calf.py`, and nothing was traced, imported or derived from any existing model, image or asset.

## Known limitations

- The lateral (side-lying) pose is shown from the elevated side camera, so we see mostly her belly with the legs pointing toward the viewer. To show a little more flank, she is rolled 75° rather than a full 90°. The "head pulled back" (dorsal neck extension) points away from the camera and is subtle in 2D.
- Metaball blending makes the tucked legs in the sternal pose soft and blobby rather than crisply jointed.
- The source PNGs are about 260–300 KB each. Use the WebP copies (about 30 KB each) in the app.
