# Calf art (procedural Blender renders)

A stylized Holstein heifer calf, about 3 weeks old, drawn in a flat comic style (cel shading, halftone dots, ink outlines). It is rendered in eight frames for the osmosis case study: six seizure / lying-down frames and two upright poses.

## Regenerate

From the `OsmosisCaseStudy/` folder:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python art/calf.py
```

- The script was built and tested with Blender 5.1.0 using the EEVEE engine. A full run takes about 20 s.
- It is deterministic: it uses no randomness, and the geometry, patches and anchors come out identical on every run. The PNG bytes can still differ very slightly between runs because of GPU anti-aliasing, but the difference is not visible.
- Set `CALF_ONLY=<frame>[,<frame>...]` (e.g. `CALF_ONLY=tonic,clonic-2`) to render only some frames while iterating. The anchors JSON is still written for all frames.

## Files

| File | What it is |
|---|---|
| `art/calf.py` | Builds the model, materials, camera and poses, then renders everything |
| `art/renders/calf-rest-1.png`, `calf-rest-2.png` | **Lying flat on her side, between episodes.** Legs are loosely flexed, the head rests on the floor, and the eyes are open. rest-2 differs only by a tiny ear, leg and head change, so alternating the two reads as a fine tremor |
| `art/renders/calf-tonic.png` | **Tonic phase.** All four legs are rigidly extended, the head and neck are arched strongly back (opisthotonos), and the mouth is slightly open |
| `art/renders/calf-clonic-1.png`, `-2`, `-3` | **Clonic phase.** The head stays arched back while the legs go through three phases of a running/paddling cycle (fore and hind pairs out of phase, clear knee and hock flexion). The jaw is open in 1 and 3 and closed in 2, for chomping |
| `art/renders/calf-sternal.png` | **Sternal recumbency** (upright on her chest, legs tucked, head up, ears relaxed): stable / recovering |
| `art/renders/calf-standing.png` | **Standing**, head up and alert: healthy |
| `public/art/calf-*.webp` | Web copies of the same eight images (WebP with alpha, about 29–36 KB each), written directly by Blender |
| `art/calf-anchors.json` | Per-frame 2D pixel anchors in the 1200×780 image (origin top-left): `neck` = IV catheter site on the visible side of the neck (jugular groove), `head` = centre of the head, `groundY` = the ground line, `camera` = `"high"` or `"side"` |

The tonic and clonic frames also show a small drool droplet at the mouth.

All renders are 1200×780 RGBA with a transparent background, the calf facing left. Two fixed orthographic cameras are used:

- **`side`** (standing, sternal): raised 20° above the horizontal. The ground plane sits at y = 686.4 px (88% of the height). Because this camera looks slightly down, the hooves nearest the viewer appear a few pixels below `groundY`. These frames have a soft contact-shadow ellipse.
- **`high`** (rest, tonic, clonic): raised 58° above the horizontal, like a vet standing over a calf lying in straw. She is rolled a full 90° onto her right side, with her spine toward the top of the image and her legs toward the bottom. She is also turned 13° on the floor, head nearer the viewer. `groundY` (499.2 px) is the row where the floor point under her body centre-line appears. Her whole body lies on the floor, so other floor contact points sit above or below this row. These frames have a flat two-step contact ellipse plus a crisp cast shadow of the calf on an invisible floor (a toon "shadow catcher"). The light comes from behind the viewer, so the shadow falls "up" the image, above her back. Every frame fits inside roughly x 200–1010, y 190–750, so the app crop (x 90–1140, y 120–780) contains her.

**Why the cameras differ:** from the low side camera, a calf lying flat on her side is seen mostly belly-on. Her legs point at the viewer, so the head-and-neck arch and the paddling happen in depth and can't be seen; the earlier version read as "swimming". From above, the spine, the arch of the neck and the leg strokes are all in the image plane, and the floor shadow makes it clear she is lying on the ground. The six lying frames share one camera, and the two upright poses share the other, so frames within each group swap without jumping.

## How the model works

- **Body:** a single metaball "skeleton" (ellipsoids for the torso and head, tapered capsules for the neck, legs and tail, plus balls at the knee, hock and fetlock joints for knobbly legs). It is converted to a mesh for each pose. Poses are made by moving joint positions (leg segment angles, head frame, tail points). There is no armature.
- **Jaw:** for open-mouth frames the muzzle is split into an upper lip and a lower jaw hinged about the head's side axis, with a dark mouth interior behind it.
- **Holstein patches:** each vertex is mapped back to rest-pose coordinates by blending per-bone rigid transforms. A patch field is then computed from hand-placed blobs warped by Blender's built-in Perlin noise, and stored as mesh attributes (`patch`, `pink`). Because the field is computed in rest space, patches stay on the same body regions in every pose. The belly and lower legs are kept white. The face is white apart from a black patch around the visible eye and on the crown. The muzzle is pink.
- **Separate parts:** ears (black with pink inner), eyes with a highlight, nostrils, and dark hooves.
- **Shading:** Diffuse → Shader to RGB → constant 3-step colour ramp → Emission, with shadow-coloured screen-space halftone dots in the mid-tone band.
- **Outlines:** inverted-hull copies (vertices pushed out along the normals, faces flipped, backface culled). They are set not to cast shadows.
- **Lighting:** the sun direction and sample count switch per camera. The high-camera frames use a lower sun from behind the viewer, a crisp shadow and 48 samples. Their WebP quality is 80, against 88 for the side frames, to keep file sizes down.

## Originality

The calf model, patch pattern, materials and poses are original. They were generated entirely from numbers and code in `calf.py`, and nothing was traced, imported or derived from any existing model, image or asset.

## Known limitations

- Seen from above, a calf on her side has much the same silhouette as a side-on standing calf. What tells the viewer she is lying down is the floor shadow and the splayed legs. In `clonic-3` the forelegs pass through a nearly perpendicular position, which on its own looks a little like walking. The frames read best in sequence, over the app's straw background.
- Eyes do not flick. The tremor in rest-1/rest-2 is only a tiny ear, leg and head change, and there is no eyelid or pupil animation.
- The drool droplet is a simple stylized drop. It does not flow with the head position.
- The high-camera floor shadow is a flat, semi-transparent brown. On a very dark app background it will barely show.
- Metaball blending makes the tucked legs in the sternal pose soft and blobby rather than crisply jointed.
- The source PNGs are about 260–370 KB each. Use the WebP copies (about 29–36 KB each) in the app.
