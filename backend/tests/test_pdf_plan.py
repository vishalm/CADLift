"""PDF floor plan -> 3D (GLB) pipeline tests."""
from pathlib import Path

import pytest
import trimesh
from fastapi.testclient import TestClient

from app import deps
from app.core.errors import CADLiftError
from app.core.validation import validate_job_parameters
from app.main import app
from app.pipelines.pdf_plan import (
    DEFAULT_MM_PER_PT,
    MAX_COLORS_PER_KIND,
    WORKSTATION_LONG_MM,
    _to_hex,
    apply_changes,
    color_name,
    estimate_mm_per_pt,
    pdf_to_glb,
)

PAGE_W, PAGE_H = 1190, 842
FRAME = (46, 35, 925, 770)  # x, y, w, h: drawing area; title block lives to the right of it


def _make_pdf(ops: list[str]) -> bytes:
    """Minimal one-page vector PDF from raw content-stream operators."""
    content = "\n".join(ops).encode()
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_W} {PAGE_H}] /Contents 4 0 R >>".encode(),
        b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream",
    ]
    out = b"%PDF-1.4\n"
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    out += b"".join(b"%010d 00000 n \n" % o for o in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    return out


def _plan_ops(workstations: int = 6, title_block: bool = True) -> list[str]:
    fx, fy, fw, fh = FRAME
    ops = [
        "0.14 w",
        f"{fx} {fy} {fw} {fh} re S",  # drawing frame
        "0 0 0 RG 100 100 m 700 100 l S",  # long black wall, 600pt wide
        "100 100 300 200 re S",  # room outline
        "0 0 1 rg 400 400 8 8 re f",  # filled blue column
        "0 0.6 0 RG",  # desks drawn in green
    ]
    ops += [f"{150 + i * 20} 150 5.3 9.4 re S" for i in range(workstations)]  # 3.5'x2' desks
    if title_block:
        ops.append("1000 100 100 600 re S")  # title block box, outside the frame
    return ops


def _write(tmp_path: Path, ops: list[str]) -> Path:
    path = tmp_path / "plan.pdf"
    path.write_bytes(_make_pdf(ops))
    return path


def _bounds_mm(glb: bytes):
    scene = trimesh.load(trimesh.util.wrap_as_stream(glb), file_type="glb")
    return scene.bounds  # Y-up: [min, max] of (x, y, z)


def test_pdf_to_glb_produces_walls_furniture_and_floor(tmp_path):
    glb, meta, _ = pdf_to_glb(_write(tmp_path, _plan_ops()), {})
    assert glb[:4] == b"glTF"
    scene = trimesh.load(trimesh.util.wrap_as_stream(glb), file_type="glb")
    names = set(scene.geometry)
    assert "Floor" in names
    assert any(n.startswith("Walls") for n in names) and any(n.startswith("Furniture") for n in names)
    assert meta["scale_source"] == "estimated"
    assert meta["wall_strips"] >= 1 and meta["filled_solids"] == 1


def test_scale_estimated_from_workstation_symbols(tmp_path):
    _, meta, _ = pdf_to_glb(_write(tmp_path, _plan_ops()), {})
    assert meta["mm_per_pt"] == pytest.approx(WORKSTATION_LONG_MM / 9.4, rel=1e-3)


def test_scale_falls_back_without_enough_workstations():
    shapes = [{"pts": [(0, 0), (5.3, 0), (5.3, 9.4), (0, 9.4)], "closed": True, "filled": False}] * 4
    assert estimate_mm_per_pt(shapes) == DEFAULT_MM_PER_PT
    assert estimate_mm_per_pt([]) == DEFAULT_MM_PER_PT


def test_plan_width_sets_real_world_scale(tmp_path):
    glb, meta, _ = pdf_to_glb(_write(tmp_path, _plan_ops()), {"plan_width_m": 60})
    assert meta["scale_source"] == "plan_width_m"
    # Geometry spans 100..700pt (600pt) -> 60m; wall strips add half a stroke on each end.
    assert meta["width_mm"] == pytest.approx(60000, abs=200)
    (minx, _, _), (maxx, _, _) = _bounds_mm(glb)
    assert maxx - minx == pytest.approx(60000, abs=200)


def test_title_block_outside_frame_is_cropped(tmp_path):
    _, with_tb, _ = pdf_to_glb(_write(tmp_path, _plan_ops(title_block=True)), {"plan_width_m": 60})
    _, without_tb, _ = pdf_to_glb(_write(tmp_path, _plan_ops(title_block=False)), {"plan_width_m": 60})
    assert with_tb["width_mm"] == without_tb["width_mm"]
    assert with_tb["shape_count"] == without_tb["shape_count"]


def test_heights_follow_params(tmp_path):
    glb, _, _ = pdf_to_glb(_write(tmp_path, _plan_ops()), {"plan_width_m": 60, "extrude_height": 2800})
    (_, miny, _), (_, maxy, _) = _bounds_mm(glb)
    assert maxy == pytest.approx(2800, abs=1)
    assert miny == pytest.approx(-100, abs=1)  # floor slab under z=0


def test_tiny_shapes_are_skipped(tmp_path):
    # Only sub-150mm specks inside the frame -> nothing to build.
    ops = ["0.14 w", "{} {} {} {} re S".format(*FRAME), "200 200 0.5 0.5 re S"]
    with pytest.raises(CADLiftError):
        pdf_to_glb(_write(tmp_path, ops), {})


def test_empty_drawing_raises(tmp_path):
    with pytest.raises(CADLiftError):
        pdf_to_glb(_write(tmp_path, ["0.14 w"]), {})


def test_corrupt_pdf_raises(tmp_path):
    path = tmp_path / "bad.pdf"
    path.write_bytes(b"%PDF-1.4 not really a pdf")
    with pytest.raises(CADLiftError):
        pdf_to_glb(path, {})


@pytest.mark.parametrize(
    "value, ok",
    [(60, True), (1, True), (5000, True), (0.5, False), (6000, False), ("60", False), (True, False)],
)
def test_plan_width_validation(value, ok):
    valid, _ = validate_job_parameters("cad", {"plan_width_m": value})
    assert valid is ok


def test_upload_rejects_fake_pdf():
    app.dependency_overrides[deps.get_current_user] = lambda: type("U", (), {"id": "test-user"})()
    try:
        response = TestClient(app).post(
            "/api/v1/jobs",
            data={"job_type": "cad", "mode": "floor_plan"},
            files={"upload": ("plan.pdf", b"not a pdf", "application/pdf")},
        )
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 400
    assert "PDF" in response.json()["detail"]


# ---- Colour layers ------------------------------------------------------------


def _spec(tmp_path, **params):
    _, _, spec = pdf_to_glb(_write(tmp_path, _plan_ops()), {"plan_width_m": 60, **params})
    return spec


def _layer(spec, layer_id):
    return next(layer for layer in spec["layers"] if layer["id"] == layer_id)


def test_layers_keep_drawing_colours(tmp_path):
    spec = _spec(tmp_path)
    ids = {layer["id"] for layer in spec["layers"]}
    assert {"walls:#000000", "furniture:#009900", "solids:#0000ff"} <= ids
    desks = _layer(spec, "furniture:#009900")
    assert desks["color"] == "#009900" and desks["height"] == 750 and desks["visible"]
    assert desks["name"] == "Furniture · green (#009900)"


def _glb_materials(glb: bytes) -> dict:
    import json
    import struct

    length = struct.unpack("<I", glb[12:16])[0]
    tree = json.loads(glb[20:20 + length])
    assert "KHR_materials_pbrSpecularGlossiness" in tree["extensionsUsed"]
    return {m["name"]: m for m in tree["materials"]}


def _linear_hex(factor) -> str:
    """Linear glTF colour factor back to the sRGB hex the viewer shows."""
    def srgb(c):
        return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
    return "#" + "".join(f"{round(srgb(c) * 255):02x}" for c in factor[:3])


def test_glb_materials_show_exact_layer_colours(tmp_path):
    glb, _, _ = pdf_to_glb(_write(tmp_path, _plan_ops()), {"plan_width_m": 60})
    mats = _glb_materials(glb)
    blue = mats["Solids · blue (#0000ff)"]
    green = mats["Furniture · green (#009900)"]
    assert _linear_hex(blue["pbrMetallicRoughness"]["baseColorFactor"]) == "#0000ff"
    # Online3DViewer reads the spec-gloss diffuse (Phong); it must match the layer colour too.
    assert _linear_hex(green["extensions"]["KHR_materials_pbrSpecularGlossiness"]["diffuseFactor"]) == "#009900"
    assert _linear_hex(mats["Floor"]["pbrMetallicRoughness"]["baseColorFactor"]) == "#c8c8cd"


@pytest.mark.parametrize(
    "pdf_color, expected",
    [((0.0,), "#000000"), ((1.0, 1.0, 1.0), "#ffffff"), ((0, 0, 0, 1), "#000000"), ((0.86,), "#dddddd"),
     ((0.859,), "#dddddd"), (None, "#000000"), (("pattern",), "#000000")],
)
def test_to_hex_handles_colour_spaces(pdf_color, expected):
    assert _to_hex(pdf_color) == expected


@pytest.mark.parametrize(
    "hex_color, name",
    [("#000000", "black"), ("#ffffff", "white"), ("#888888", "grey"), ("#ff0000", "red"),
     ("#009900", "green"), ("#0000ff", "blue"), ("#775544", "brown"), ("#003300", "dark green")],
)
def test_colour_names(hex_color, name):
    assert color_name(hex_color) == name


def test_rare_colours_merge_into_other_layer(tmp_path):
    fx, fy, fw, fh = FRAME
    ops = ["0.14 w", f"{fx} {fy} {fw} {fh} re S"]
    for i in range(MAX_COLORS_PER_KIND + 3):  # more colours than allowed, each one desk
        ops.append(f"{i / 15:.4f} 0 0 RG {100 + i * 20} 300 5 9 re S")  # one distinct quantised red each
    _, _, spec = pdf_to_glb(_write(tmp_path, ops), {"plan_width_m": 60})
    furniture = [layer for layer in spec["layers"] if layer["kind"] == "furniture"]
    assert len(furniture) == MAX_COLORS_PER_KIND + 1
    assert any(layer["id"] == "furniture:other" for layer in furniture)


# ---- Chat edits -----------------------------------------------------------------


def test_apply_changes_by_kind_and_id(tmp_path):
    spec = _spec(tmp_path)
    new, applied, skipped = apply_changes(spec, [
        {"target": "furniture", "set": {"color": "#8B5A2B", "height": 900}},
        {"target": "solids:#0000ff", "set": {"visible": False, "name": "Columns"}},
        {"target": "floor", "set": {"color": "#333333"}},
    ])
    assert not skipped and len(applied) == 5
    desks = _layer(new, "furniture:#009900")
    assert desks["color"] == "#8b5a2b" and desks["height"] == 900
    column = _layer(new, "solids:#0000ff")
    assert column["visible"] is False and column["name"] == "Columns"
    assert new["floor"]["color"] == "#333333"
    assert _layer(spec, "furniture:#009900")["color"] == "#009900"  # original untouched


@pytest.mark.parametrize(
    "change, reason",
    [
        ({"target": "walls", "set": {"color": "brown"}}, "color must be"),
        ({"target": "walls", "set": {"height": 0}}, "height must be"),
        ({"target": "walls", "set": {"height": "tall"}}, "height must be"),
        ({"target": "walls", "set": {"visible": "no"}}, "visible must be"),
        ({"target": "all", "set": {"name": "Group"}}, "single layer"),
        ({"target": "walls", "set": {"texture": "wood"}}, "unknown field"),
        ({"target": "doors", "set": {"color": "#ffffff"}}, "unknown target"),
        ({"target": "floor", "set": {"height": 10}}, "unknown field"),
        ({"target": "global", "set": {"stroke_thickness": 5}}, "must be"),
        ({"target": "global", "set": {"magic": 1}}, "unknown setting"),
        ({"set": {"color": "#ffffff"}}, "unknown target"),
        ("make it blue", "malformed"),
    ],
)
def test_apply_changes_rejects_bad_values(tmp_path, change, reason):
    spec = _spec(tmp_path)
    new, applied, skipped = apply_changes(spec, [change])
    assert not applied and len(skipped) == 1 and reason in skipped[0]
    assert new == spec


def test_apply_changes_requires_a_list(tmp_path):
    spec = _spec(tmp_path)
    _, applied, skipped = apply_changes(spec, {"target": "walls"})
    assert not applied and skipped == ["changes must be a list"]


def test_global_plan_width_rescales(tmp_path):
    spec = _spec(tmp_path)
    new, applied, _ = apply_changes(spec, [{"target": "global", "set": {"plan_width_m": 120}}])
    assert applied
    _, meta, _ = pdf_to_glb(_write(tmp_path, _plan_ops()), {}, new)
    assert meta["width_mm"] == pytest.approx(120000, abs=300)


def test_rebuild_keeps_layer_settings_and_hides_layers(tmp_path):
    path = _write(tmp_path, _plan_ops())
    spec = _spec(tmp_path)
    new, _, _ = apply_changes(spec, [
        {"target": "furniture", "set": {"color": "#8b5a2b"}},
        {"target": "solids", "set": {"visible": False}},
    ])
    glb, _, rebuilt = pdf_to_glb(path, {}, new)
    assert _layer(rebuilt, "furniture:#009900")["color"] == "#8b5a2b"
    scene = trimesh.load(trimesh.util.wrap_as_stream(glb), file_type="glb")
    assert not any(n.startswith("Solids") for n in scene.geometry)
    furniture = _glb_materials(glb)["Furniture · green (#009900)"]
    assert _linear_hex(furniture["extensions"]["KHR_materials_pbrSpecularGlossiness"]["diffuseFactor"]) == "#8b5a2b"


# ---- Chat API ---------------------------------------------------------------------


@pytest.fixture
def plan_job(tmp_path, monkeypatch):
    """A completed PDF plan job owned by a test user, created through the real pipeline."""
    import asyncio

    from app.db.session import AsyncSessionLocal
    from app.models import File as FileModel, Job, User
    from app.pipelines import pdf_plan
    from app.services.storage import storage_service

    async def make():
        async with AsyncSessionLocal() as session:
            user = User(email="chat@example.com", password_hash="x", display_name="Chat")
            session.add(user)
            await session.flush()
            job = Job(job_type="cad", mode="floor_plan", status="queued", params={"plan_width_m": 60}, user_id=user.id)
            session.add(job)
            await session.flush()
            key, size = storage_service.save_bytes(_make_pdf(_plan_ops()), role="input", job_id=job.id, filename="plan.pdf")
            f = FileModel(user_id=user.id, job_id=job.id, role="input", storage_key=key,
                          original_name="plan.pdf", mime_type="application/pdf", size_bytes=size)
            session.add(f)
            await session.flush()
            job.input_file_id = f.id
            await pdf_plan.run(job, session, storage_service.resolve_path(key))
            await session.commit()
            return user.id, job.id

    user_id, job_id = asyncio.run(make())
    app.dependency_overrides[deps.get_current_user] = lambda: type("U", (), {"id": user_id})()
    yield job_id
    app.dependency_overrides.clear()


def _fake_llm(monkeypatch, reply, changes):
    from app.api.v1 import jobs as jobs_api

    async def fake(spec, message, history):
        fake.calls.append((message, history))
        return {"reply": reply, "changes": changes}

    fake.calls = []
    monkeypatch.setattr(jobs_api.llm_service, "provider", "azure")
    monkeypatch.setattr(jobs_api.llm_service, "api_key", "test")
    monkeypatch.setattr(jobs_api.llm_service, "endpoint", "https://test.openai.azure.com")
    monkeypatch.setattr(jobs_api.llm_service, "edit_plan_spec", fake)
    return fake


def test_chat_recolours_and_undo_restores(plan_job, monkeypatch):
    fake = _fake_llm(monkeypatch, "Made the furniture wood brown.", [
        {"target": "furniture", "set": {"color": "#8b5a2b"}},
        {"target": "nonsense", "set": {"color": "#ffffff"}},
    ])
    client = TestClient(app)
    first_glb = client.get(f"/api/v1/jobs/{plan_job}").json()["params"]["glb_file_id"]

    r = client.post(f"/api/v1/jobs/{plan_job}/chat", json={"message": "make furniture wood"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["reply"] == "Made the furniture wood brown."
    assert len(body["applied"]) == 1 and len(body["skipped"]) == 1
    params = body["job"]["params"]
    assert params["glb_file_id"] != first_glb and len(params["plan_versions"]) == 2
    assert _layer(params["plan_spec"], "furniture:#009900")["color"] == "#8b5a2b"
    assert [m["role"] for m in params["plan_chat"]] == ["user", "assistant"]
    assert client.get(f"/api/v1/files/{params['glb_file_id']}").content[:4] == b"glTF"

    # history is passed to the LLM on the next turn
    client.post(f"/api/v1/jobs/{plan_job}/chat", json={"message": "and taller"})
    assert len(fake.calls[1][1]) == 2

    r = client.post(f"/api/v1/jobs/{plan_job}/chat/undo")
    r = client.post(f"/api/v1/jobs/{plan_job}/chat/undo")
    assert r.status_code == 200
    params = r.json()["job"]["params"]
    assert params["glb_file_id"] == first_glb
    assert _layer(params["plan_spec"], "furniture:#009900")["color"] == "#009900"
    assert client.post(f"/api/v1/jobs/{plan_job}/chat/undo").status_code == 400


def test_chat_question_does_not_rebuild(plan_job, monkeypatch):
    _fake_llm(monkeypatch, "There are 3 furniture layers.", [])
    client = TestClient(app)
    before = client.get(f"/api/v1/jobs/{plan_job}").json()["params"]
    r = client.post(f"/api/v1/jobs/{plan_job}/chat", json={"message": "how many furniture layers?"})
    after = r.json()["job"]["params"]
    assert r.status_code == 200 and after["glb_file_id"] == before["glb_file_id"]
    assert len(after["plan_versions"]) == 1


def test_chat_requires_llm(plan_job, monkeypatch):
    from app.api.v1 import jobs as jobs_api

    monkeypatch.setattr(jobs_api.llm_service, "provider", "none")
    r = TestClient(app).post(f"/api/v1/jobs/{plan_job}/chat", json={"message": "hi"})
    assert r.status_code == 503


def test_chat_llm_failure_is_502(plan_job, monkeypatch):
    fake = _fake_llm(monkeypatch, "", [])

    async def boom(spec, message, history):
        raise ValueError("bad json")

    from app.api.v1 import jobs as jobs_api
    monkeypatch.setattr(jobs_api.llm_service, "edit_plan_spec", boom)
    r = TestClient(app).post(f"/api/v1/jobs/{plan_job}/chat", json={"message": "hi"})
    assert r.status_code == 502 and not fake.calls


def test_chat_validates_message_and_job(plan_job, monkeypatch):
    _fake_llm(monkeypatch, "", [])
    client = TestClient(app)
    assert client.post(f"/api/v1/jobs/{plan_job}/chat", json={"message": ""}).status_code == 422
    assert client.post(f"/api/v1/jobs/{plan_job}/chat", json={"message": "x" * 1001}).status_code == 422
    assert client.post("/api/v1/jobs/does-not-exist/chat", json={"message": "hi"}).status_code == 404
