"""
Vector PDF floor plan -> navigable, coloured 3D scene (GLB).

Reads every vector path in the first PDF page (lines, rects, curves), crops to the
drawing frame (dropping the title block), scales to millimetres, and extrudes
everything: long strokes become full-height walls, short strokes become
furniture-height blocks, filled shapes become solids. Shapes keep their drawing
colour and are grouped into named layers (kind + colour). A "plan spec" holds the
editable settings (layer colours, heights, visibility, scale) so the model can be
rebuilt after chat edits.
"""
from __future__ import annotations

import collections
import colorsys
import copy
import json
import logging
import re
from pathlib import Path

import numpy as np
import pdfplumber
import trimesh
from shapely.geometry import LineString, MultiPolygon, Polygon, box
from shapely.ops import unary_union

from app.core.errors import CADLiftError, ErrorCode

logger = logging.getLogger("cadlift.pipeline.pdf_plan")

# Fallback when no workstation symbol is found: 1:100 on paper (1pt = 0.3528mm).
DEFAULT_MM_PER_PT = 35.28
# Legend workstation is 3.5' x 2' (1067 x 610mm): aspect 1.75.
WORKSTATION_LONG_MM = 1067.0
# Colours kept as their own layer per kind; the rest merge into "<kind>:other".
MAX_COLORS_PER_KIND = 12
KINDS = ("walls", "furniture", "solids")
KIND_LABELS = {"walls": "Walls", "furniture": "Furniture", "solids": "Solids"}
HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def _to_hex(color) -> str:
    """PDF colour (gray / RGB / CMYK tuple) -> #rrggbb, quantised to merge near-identical shades."""
    if color is None:
        return "#000000"
    if isinstance(color, (int, float)):
        color = (color,)
    c = [float(v) for v in color if isinstance(v, (int, float))]
    if len(c) == 1:
        r = g = b = c[0]
    elif len(c) == 3:
        r, g, b = c
    elif len(c) == 4:
        cc, m, y, k = c
        r, g, b = (1 - cc) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)
    else:  # pattern / unknown colour space
        r = g = b = 0.0
    # ponytail: 16 levels per channel merges #dbdbdb/#dcdcdc; finer if users need exact shades.
    return "#" + "".join(f"{round(max(0.0, min(1.0, v)) * 15) * 17:02x}" for v in (r, g, b))


def color_name(hex_color: str) -> str:
    """Human colour name for layer labels ("dark green", "light grey")."""
    r, g, b = (int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    if s < 0.15 or v < 0.08:
        for limit, name in ((0.15, "black"), (0.4, "dark grey"), (0.7, "grey"), (0.92, "light grey")):
            if v < limit:
                return name
        return "white"
    hue = h * 360
    if 15 <= hue < 45 and v < 0.65:
        return "brown"
    for limit, name in ((15, "red"), (45, "orange"), (70, "yellow"), (170, "green"), (200, "cyan"),
                        (260, "blue"), (300, "purple"), (345, "pink"), (361, "red")):
        if hue < limit:
            return f"dark {name}" if v < 0.45 else name
    return "grey"


def _shape_color(o: dict, filled: bool) -> str:
    return _to_hex(o.get("non_stroking_color") if filled else o.get("stroking_color"))


def _shapes(page) -> list[dict]:
    """Every vector path on the page as {pts: [(x, y_up)], closed, filled, color}."""
    h = float(page.height)
    out = []
    for o in page.rects:
        x0, x1, top, bottom = o["x0"], o["x1"], o["top"], o["bottom"]
        pts = [(x0, h - bottom), (x1, h - bottom), (x1, h - top), (x0, h - top)]
        filled = bool(o.get("fill"))
        out.append({"pts": pts, "closed": True, "filled": filled, "color": _shape_color(o, filled)})
    for o in page.lines + page.curves:
        pts = [(float(x), h - float(y)) for x, y in o.get("pts") or []]
        if len(pts) < 2:
            continue
        closed = len(pts) > 2 and np.hypot(pts[0][0] - pts[-1][0], pts[0][1] - pts[-1][1]) < 0.5
        filled = bool(o.get("fill")) and len(pts) > 2
        out.append({"pts": pts, "closed": closed, "filled": filled, "color": _shape_color(o, filled)})
    return out


def _drawing_frame(page, shapes: list[dict]) -> tuple[float, float, float, float] | None:
    """Drawing area: the innermost tall rectangle holding the most shapes (excludes the title block)."""
    h = float(page.height)
    tall = [(r["x0"], h - r["bottom"], r["x1"], h - r["top"]) for r in page.rects if r["height"] > 0.6 * h]

    def contains(a, b) -> bool:
        return a != b and a[0] <= b[0] and a[1] <= b[1] and a[2] >= b[2] and a[3] >= b[3]

    # Drop outer borders that wrap another tall rectangle.
    inner = [a for a in tall if not any(contains(a, b) for b in tall)]
    if not inner:
        return None
    return max(inner, key=lambda f: len(_crop(shapes, f)))


def _crop(shapes: list[dict], frame: tuple[float, float, float, float] | None) -> list[dict]:
    if frame is None:
        return shapes
    x0, y0, x1, y1 = frame
    inside = []
    for s in shapes:
        xs = [p[0] for p in s["pts"]]
        ys = [p[1] for p in s["pts"]]
        bx0, by0, bx1, by1 = min(xs), min(ys), max(xs), max(ys)
        # Drop the frame border itself and anything not fully inside it.
        if (bx1 - bx0) > 0.95 * (x1 - x0) and (by1 - by0) > 0.95 * (y1 - y0):
            continue
        if bx0 >= x0 - 0.5 and bx1 <= x1 + 0.5 and by0 >= y0 - 0.5 and by1 <= y1 + 0.5:
            inside.append(s)
    return inside


def estimate_mm_per_pt(shapes: list[dict]) -> float:
    """Guess scale from the most common ~1.75-aspect small rectangle (a 3.5'x2' workstation)."""
    # ponytail: office-plan heuristic; users override with plan_width_m for other drawings.
    sizes = collections.Counter()
    for s in shapes:
        if not s["closed"] or len(s["pts"]) != 4:
            continue
        xs = [p[0] for p in s["pts"]]
        ys = [p[1] for p in s["pts"]]
        w, h = max(xs) - min(xs), max(ys) - min(ys)
        lo, hi = sorted((w, h))
        if 2 < lo < 40 and 1.6 <= hi / lo <= 1.9:
            sizes[round(hi, 1)] += 1
    if not sizes or sizes.most_common(1)[0][1] < 5:
        return DEFAULT_MM_PER_PT
    return WORKSTATION_LONG_MM / sizes.most_common(1)[0][0]


def _bounds(shapes: list[dict]) -> tuple[float, float, float, float]:
    xs = [p[0] for s in shapes for p in s["pts"]]
    ys = [p[1] for s in shapes for p in s["pts"]]
    return min(xs), min(ys), max(xs), max(ys)


def _extrude(geom, height: float, z0: float = 0.0) -> list[trimesh.Trimesh]:
    polys = geom.geoms if isinstance(geom, MultiPolygon) else [geom]
    meshes = []
    for p in polys:
        if p.is_empty or p.area <= 0:
            continue
        m = trimesh.creation.extrude_polygon(p, height)
        m.apply_translation((0, 0, z0))
        meshes.append(m)
    return meshes


def initial_spec(shapes: list[dict], params: dict) -> dict:
    """Editable settings for a plan; layers are filled in by build_scene."""
    bx0, _, bx1, _ = _bounds(shapes)
    plan_width_pt = max(bx1 - bx0, 1e-6)
    plan_width_m = params.get("plan_width_m")
    if plan_width_m:
        mm_per_pt, scale_source = float(plan_width_m) * 1000.0 / plan_width_pt, "plan_width_m"
    else:
        mm_per_pt, scale_source = estimate_mm_per_pt(shapes), "estimated"
    return {
        "mm_per_pt": mm_per_pt,
        "scale_source": scale_source,
        "plan_width_pt": plan_width_pt,
        "wall_height": float(params.get("extrude_height") or 3000.0),
        "furniture_height": float(params.get("furniture_height") or 750.0),
        "stroke_thickness": float(params.get("wall_thickness") or 100.0),
        "wall_min_length": 2000.0,
        "min_feature": 150.0,
        "floor": {"color": "#c8c8cd", "visible": True},
        "layers": [],
    }


def _classify(shapes: list[dict], spec: dict) -> list[tuple[str, str, object]]:
    """(kind, colour, 2D geometry in mm) for every shape big enough to keep."""
    bx0, by0, _, _ = _bounds(shapes)
    mm_per_pt = spec["mm_per_pt"]
    half = spec["stroke_thickness"] / 2.0
    out = []
    for s in shapes:
        pts = [((x - bx0) * mm_per_pt, (y - by0) * mm_per_pt) for x, y in s["pts"]]
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        span = max(max(xs) - min(xs), max(ys) - min(ys))
        if span < spec["min_feature"]:
            continue  # hatch dots, glyph fragments
        color = s.get("color", "#000000")
        if s["filled"]:
            poly = Polygon(pts).buffer(0)
            if not poly.is_empty:
                out.append(("solids", color, poly))
            continue
        ring = pts + [pts[0]] if s["closed"] else pts
        strip = LineString(ring).buffer(half, cap_style="flat", join_style="mitre")
        out.append(("walls" if span >= spec["wall_min_length"] else "furniture", color, strip))
    return out


def _layer_ids(classified: list[tuple[str, str, object]]) -> dict[tuple[str, str], str]:
    """Map (kind, colour) -> layer id, keeping the most used colours per kind."""
    counts = collections.Counter((kind, color) for kind, color, _ in classified)
    ids = {}
    for kind in KINDS:
        ranked = sorted(((n, c) for (k, c), n in counts.items() if k == kind), reverse=True)
        for i, (_, color) in enumerate(ranked):
            ids[(kind, color)] = f"{kind}:{color}" if i < MAX_COLORS_PER_KIND else f"{kind}:other"
    return ids


def _default_layer(layer_id: str, kind: str, source_color: str, spec: dict) -> dict:
    other = layer_id.endswith(":other")
    label = "other colours" if other else f"{color_name(source_color)} ({source_color})"
    return {
        "id": layer_id,
        "name": f"{KIND_LABELS[kind]} · {label}",
        "kind": kind,
        "source_color": source_color,
        "color": source_color,
        "height": spec["furniture_height"] if kind == "furniture" else spec["wall_height"],
        "visible": True,
    }


def _material(hex_color: str, name: str):
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (1, 3, 5))
    return trimesh.visual.material.PBRMaterial(
        name=name, baseColorFactor=[r, g, b, 255], metallicFactor=0.0, roughnessFactor=0.9
    )


def _srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _viewer_friendly_materials(tree: dict) -> None:
    """glTF tree post-processor: exact colours and bright shading in Online3DViewer.

    glTF colour factors are linear, so sRGB hex values are converted. Online3DViewer
    renders metallic-roughness materials without an environment map (very dark, all
    colours look grey) but renders KHR_materials_pbrSpecularGlossiness as plain Phong,
    so that extension is added; other viewers keep using the standard material.
    """
    materials = tree.get("materials") or []
    for m in materials:
        pbr = m.setdefault("pbrMetallicRoughness", {})
        r, g, b, a = (pbr.get("baseColorFactor") or [1.0, 1.0, 1.0, 1.0])[:4]
        linear = [_srgb_to_linear(r), _srgb_to_linear(g), _srgb_to_linear(b), a]
        pbr["baseColorFactor"] = linear
        m.setdefault("extensions", {})["KHR_materials_pbrSpecularGlossiness"] = {
            "diffuseFactor": linear,
            "specularFactor": [0.04, 0.04, 0.04],
            "glossinessFactor": 0.1,
        }
    if materials:
        used = tree.setdefault("extensionsUsed", [])
        if "KHR_materials_pbrSpecularGlossiness" not in used:
            used.append("KHR_materials_pbrSpecularGlossiness")


def export_glb(scene: trimesh.Scene) -> bytes:
    return trimesh.exchange.gltf.export_glb(scene, tree_postprocessor=_viewer_friendly_materials)


def build_scene(shapes: list[dict], spec: dict) -> tuple[trimesh.Scene, dict, dict]:
    """Extrude all shapes (cropped, in PDF points) into a coloured Y-up glTF scene in mm.

    Returns the scene, build metadata, and the spec with its layer list refreshed
    (existing layer settings are kept by id; new layers get defaults).
    """
    if not shapes:
        raise CADLiftError(ErrorCode.GEO_NO_POLYGONS, details="No vector geometry found in the PDF drawing area")

    spec = copy.deepcopy(spec)
    classified = _classify(shapes, spec)
    ids = _layer_ids(classified)
    previous = {layer["id"]: layer for layer in spec.get("layers", [])}

    geoms: dict[str, list] = collections.defaultdict(list)
    counts: collections.Counter = collections.Counter()
    source: dict[str, str] = {}
    for kind, color, geom in classified:
        lid = ids[(kind, color)]
        geoms[lid].append(geom)
        counts[lid] += 1
        source.setdefault(lid, color)

    layers = []
    for lid in sorted(geoms, key=lambda i: (KINDS.index(i.split(":")[0]), -counts[i])):
        kind = lid.split(":")[0]
        layer = _default_layer(lid, kind, source[lid], spec)
        if lid in previous:
            layer.update({k: previous[lid][k] for k in ("name", "color", "height", "visible") if k in previous[lid]})
        layer["count"] = counts[lid]
        layers.append(layer)
    spec["layers"] = layers

    unions = {lid: unary_union(g) for lid, g in geoms.items()}
    everything = unary_union(list(unions.values())) if unions else Polygon()
    if everything.is_empty:
        raise CADLiftError(
            ErrorCode.GEO_NO_POLYGONS,
            details=f"All shapes are smaller than {spec['min_feature']}mm; check plan_width_m "
                    f"(scale {spec['mm_per_pt']:.3f} mm/pt)",
        )
    minx, miny, maxx, maxy = everything.bounds

    scene = trimesh.Scene()
    # glTF is Y-up; our extrusion is Z-up.
    z_to_y = trimesh.transformations.rotation_matrix(-np.pi / 2, (1, 0, 0))

    def add(name: str, meshes: list[trimesh.Trimesh], color: str) -> None:
        if not meshes:
            return
        mesh = trimesh.util.concatenate(meshes)
        mesh.apply_transform(z_to_y)
        mesh.visual = trimesh.visual.TextureVisuals(material=_material(color, name))
        scene.add_geometry(mesh, geom_name=name)

    floor = spec["floor"]
    if floor.get("visible", True):
        add("Floor", _extrude(box(minx, miny, maxx, maxy), 100.0, -100.0), floor["color"])
    for layer in layers:
        if layer["visible"]:
            add(layer["name"], _extrude(unions[layer["id"]], float(layer["height"])), layer["color"])

    by_kind = collections.Counter(kind for kind, _, _ in classified)
    meta = {
        "mm_per_pt": round(spec["mm_per_pt"], 3),
        "scale_source": spec["scale_source"],
        "width_mm": round(maxx - minx),
        "depth_mm": round(maxy - miny),
        "wall_height_mm": spec["wall_height"],
        "furniture_height_mm": spec["furniture_height"],
        "shape_count": len(shapes),
        "wall_strips": by_kind["walls"],
        "furniture_strips": by_kind["furniture"],
        "filled_solids": by_kind["solids"],
        "layer_count": len(layers),
    }
    return scene, meta, spec


def load_shapes(path: Path) -> list[dict]:
    """Cropped vector shapes from the first page of a PDF."""
    try:
        pdf = pdfplumber.open(str(path))
    except Exception as exc:  # noqa: BLE001
        raise CADLiftError(ErrorCode.CAD_READ_ERROR, details=f"Could not open PDF: {exc}") from exc
    with pdf:
        if not pdf.pages:
            raise CADLiftError(ErrorCode.CAD_READ_ERROR, details="PDF has no pages")
        page = pdf.pages[0]
        all_shapes = _shapes(page)
        shapes = _crop(all_shapes, _drawing_frame(page, all_shapes))
    if not shapes:
        raise CADLiftError(
            ErrorCode.GEO_NO_POLYGONS,
            details="No vector geometry found. Scanned PDFs are not supported; export the plan as a vector PDF.",
        )
    return shapes


def pdf_to_glb(path: Path, params: dict, spec: dict | None = None) -> tuple[bytes, dict, dict]:
    """Convert the first page of a vector PDF plan to GLB bytes, metadata and the (refreshed) spec."""
    shapes = load_shapes(path)
    scene, meta, spec = build_scene(shapes, spec or initial_spec(shapes, params))
    return export_glb(scene), meta, spec


# ---- Chat edits -------------------------------------------------------------

LAYER_FIELDS = ("color", "height", "visible", "name")
GLOBAL_LIMITS = {
    "stroke_thickness": (10.0, 1000.0),
    "wall_min_length": (100.0, 20000.0),
    "plan_width_m": (1.0, 5000.0),
}


def _num(value, lo: float, hi: float) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if lo <= value <= hi else None


def _set_layer_field(layer: dict, field: str, value, single: bool) -> str | None:
    """Apply one field to a layer; returns an error message when the value is rejected."""
    if field == "color":
        if not isinstance(value, str) or not HEX_RE.match(value):
            return f"color must be #rrggbb, got {value!r}"
        layer["color"] = value.lower()
    elif field == "height":
        num = _num(value, 1.0, 20000.0)
        if num is None:
            return f"height must be 1-20000 mm, got {value!r}"
        layer["height"] = num
    elif field == "visible":
        if not isinstance(value, bool):
            return f"visible must be true/false, got {value!r}"
        layer["visible"] = value
    elif field == "name":
        if not single:
            return "name can only be set on a single layer"
        if not isinstance(value, str) or not 0 < len(value.strip()) <= 60:
            return "name must be 1-60 characters"
        layer["name"] = value.strip()
    else:
        return f"unknown field {field!r}"
    return None


def _target_layers(spec: dict, target: str) -> list[dict]:
    if target == "all":
        return spec["layers"]
    if target in KINDS:
        return [layer for layer in spec["layers"] if layer["kind"] == target]
    return [layer for layer in spec["layers"] if layer["id"] == target]


def apply_changes(spec: dict, changes: list) -> tuple[dict, list[str], list[str]]:
    """Apply chat changes to a copy of the spec.

    Each change is {"target": <layer id | walls | furniture | solids | all | floor | global>,
    "set": {field: value}}. Invalid parts are skipped and reported, never applied.
    """
    spec = copy.deepcopy(spec)
    applied: list[str] = []
    skipped: list[str] = []
    if not isinstance(changes, list):
        return spec, applied, ["changes must be a list"]

    for change in changes:
        if not isinstance(change, dict) or not isinstance(change.get("set"), dict):
            skipped.append(f"malformed change {change!r}")
            continue
        target, fields = change.get("target"), change["set"]

        if target == "global":
            for field, value in fields.items():
                if field not in GLOBAL_LIMITS:
                    skipped.append(f"global: unknown setting {field!r}")
                    continue
                num = _num(value, *GLOBAL_LIMITS[field])
                if num is None:
                    lo, hi = GLOBAL_LIMITS[field]
                    skipped.append(f"global: {field} must be {lo:g}-{hi:g}, got {value!r}")
                    continue
                if field == "plan_width_m":
                    spec["mm_per_pt"] = num * 1000.0 / spec["plan_width_pt"]
                    spec["scale_source"] = "plan_width_m"
                else:
                    spec[field] = num
                applied.append(f"global {field} = {num:g}")
            continue

        if target == "floor":
            for field, value in fields.items():
                if field not in ("color", "visible"):
                    skipped.append(f"floor: unknown field {field!r}")
                    continue
                error = _set_layer_field(spec["floor"], field, value, single=True)
                (skipped.append(f"floor: {error}") if error else applied.append(f"floor {field} = {value}"))
            continue

        layers = _target_layers(spec, target) if isinstance(target, str) else []
        if not layers:
            skipped.append(f"unknown target {target!r}")
            continue
        for field, value in fields.items():
            errors = [_set_layer_field(layer, field, value, single=len(layers) == 1) for layer in layers]
            if errors[0]:
                skipped.append(f"{target}: {errors[0]}")
            else:
                applied.append(f"{target} {field} = {value} ({len(layers)} layer{'s' if len(layers) != 1 else ''})")
    return spec, applied, skipped


def save_plan_outputs(session, job, glb_bytes: bytes, meta: dict, version: int):
    """Store a plan version's GLB + metadata as job files; returns the GLB file record."""
    from app.services.storage import save_job_file

    save_job_file(session, job, json.dumps(meta, indent=2).encode("utf-8"), "output_metadata",
                  f"plan_model_v{version}.json", "application/json")
    return save_job_file(session, job, glb_bytes, "output", f"plan_model_v{version}.glb", "model/gltf-binary")


async def run(job, session, input_path: Path) -> None:
    glb_bytes, meta, spec = pdf_to_glb(input_path, job.params or {})
    logger.info("PDF plan converted", extra={"job_id": job.id, **meta})
    glb_file = save_plan_outputs(session, job, glb_bytes, meta, version=1)
    await session.flush()

    params = dict(job.params or {})
    params.update({
        "glb_file_id": glb_file.id,
        "pdf_plan": meta,
        "plan_spec": spec,
        "plan_versions": [{"glb_file_id": glb_file.id, "spec": spec, "meta": meta, "note": "initial"}],
        "plan_chat": [],
    })
    job.params = params
    job.output_file_id = glb_file.id
    job.status = "completed"
    job.error_code = None
    job.error_message = None
