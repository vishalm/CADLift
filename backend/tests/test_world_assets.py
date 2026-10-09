"""3D worlds (World Labs), 3D objects (Hunyuan via FAL) and ambient sound (ElevenLabs via FAL)."""
import asyncio
import json

import httpx
import pytest

from app.core.config import get_settings
from app.services import fal, worldlabs
from tests.test_render import PHOTO, _fast_poll

SPZ = b"SPZ-splat-bytes"
GLB = b"glTF-binary"
PANO = b"pano-png"
MP3 = b"ID3-mp3"


def _mock_http(monkeypatch, module, handler):
    real = httpx.AsyncClient
    monkeypatch.setattr(module.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))


# ---- World Labs ----------------------------------------------------------------------


def _world_response(spz_urls=None, semantics=None, mesh=True, pano=True):
    return {
        "done": True,
        "response": {"assets": {
            "splats": {"spz_urls": spz_urls if spz_urls is not None else {"full_res": "https://cdn/full.spz", "500k": "https://cdn/500k.spz"},
                       **({"semantics_metadata": semantics} if semantics is not None else {})},
            **({"mesh": {"collider_mesh_url": "https://cdn/collider.glb"}} if mesh else {}),
            **({"imagery": {"pano_url": "https://cdn/pano.png"}} if pano else {}),
            "caption": "a white villa",
        }},
    }


@pytest.fixture
def world_api(monkeypatch):
    """Fake World Labs API + CDN. Set calls['operations'] to the sequence of poll replies."""
    monkeypatch.setattr(get_settings(), "world_labs_api_key", "wl-key")
    monkeypatch.setattr(worldlabs, "poll", _fast_poll)
    calls = {"requests": [], "operations": [{"done": False}, _world_response()], "submit": None}
    cdn = {"/full.spz": b"FULL", "/500k.spz": SPZ, "/collider.glb": GLB, "/pano.png": PANO}

    def handler(request):
        calls["requests"].append((request.method, request.url.host, request.url.path, request.headers.get("wlt-api-key")))
        if request.url.host == "cdn":
            return httpx.Response(200, content=cdn[request.url.path])
        if request.method == "POST":
            calls["submit"] = json.loads(request.read())
            return calls.get("submit_response") or httpx.Response(200, json={"operation_id": "operations/op-1", "done": False})
        return httpx.Response(200, json=calls["operations"].pop(0))

    _mock_http(monkeypatch, worldlabs, handler)  # httpx is shared, so this also covers media_poll.download
    return calls


def test_generate_world_happy_path(world_api):
    world = asyncio.run(worldlabs.generate_world(PHOTO, "  modern villa  ", "cadlift-r1"))
    assert world["spz"] == SPZ  # 500k preferred over full_res for the browser
    assert (world["collider"], world["pano"]) == (GLB, PANO)
    assert world["meta"] == {"flip_y": True, "ground_plane_offset": 0, "metric_scale_factor": 1, "caption": "a white villa"}

    body = world_api["submit"]
    assert body["model"] == "marble-1.1" and body["display_name"] == "cadlift-r1"
    prompt = body["world_prompt"]
    assert prompt["type"] == "image" and prompt["text_prompt"] == "modern villa"
    assert prompt["image_prompt"]["source"] == "data_base64" and prompt["image_prompt"]["mime_type"] == "image/png"
    api_calls = [c for c in world_api["requests"] if c[1] == "api.worldlabs.ai"]
    assert api_calls[0][:3] == ("POST", "api.worldlabs.ai", "/marble/v1/worlds:generate")
    assert [c[2] for c in api_calls[1:]] == ["/marble/v1/operations/op-1"] * 2
    assert all(c[3] == "wl-key" for c in api_calls)


def test_generate_world_uses_semantics_and_tolerates_missing_extras(world_api):
    world_api["operations"] = [_world_response(
        spz_urls={"full_res": "https://cdn/full.spz"},
        semantics={"flip_y": False, "ground_plane_offset": -1.5, "metric_scale_factor": 2.0},
        mesh=False, pano=False,
    )]
    world = asyncio.run(worldlabs.generate_world(PHOTO))
    assert world["spz"] == b"FULL" and world["collider"] is None and world["pano"] is None
    assert world["meta"]["flip_y"] is False and world["meta"]["ground_plane_offset"] == -1.5
    assert "text_prompt" not in world_api["submit"]["world_prompt"]


@pytest.mark.parametrize("operations,message", [
    ([{"done": True, "error": "image rejected"}], "image rejected"),
    ([_world_response(spz_urls={})], "no splat"),
])
def test_generate_world_errors(world_api, operations, message):
    world_api["operations"] = operations
    with pytest.raises(worldlabs.WorldLabsError, match=message):
        asyncio.run(worldlabs.generate_world(PHOTO))


def test_generate_world_submit_rejected(world_api):
    world_api["submit_response"] = httpx.Response(402, text="insufficient credits")
    with pytest.raises(worldlabs.WorldLabsError, match=r"submit failed \(402\): insufficient credits"):
        asyncio.run(worldlabs.generate_world(PHOTO))


def test_generate_world_requires_key(monkeypatch):
    monkeypatch.setattr(get_settings(), "world_labs_api_key", None)
    assert not worldlabs.is_enabled()
    with pytest.raises(worldlabs.WorldLabsError, match="WORLD_LABS_API_KEY"):
        asyncio.run(worldlabs.generate_world(PHOTO))


@pytest.mark.parametrize("op,expected", [
    ({"operation_id": "operations/abc"}, "abc"), ({"id": "xyz"}, "xyz"), ({"name": "a/b/c"}, "c"),
])
def test_operation_id_shapes(op, expected):
    assert worldlabs.operation_id(op) == expected


def test_operation_id_missing():
    with pytest.raises(worldlabs.WorldLabsError, match="no id"):
        worldlabs.operation_id({})


def test_pick_spz_falls_back_to_any_resolution():
    assert worldlabs.pick_spz({"2m": "u"}) == "u"
    assert worldlabs.pick_spz({"100k": "a", "150k": "b"}) == "b"
    assert worldlabs.pick_spz({"full_res": None}) is None


# ---- FAL: Hunyuan 3D and ElevenLabs ------------------------------------------------------


@pytest.fixture
def fake_run(monkeypatch):
    sent = {}

    def install(result):
        async def run(endpoint, payload, poll_seconds=5.0):
            sent.update(endpoint=endpoint, payload=payload)
            return result

        async def download(url):
            sent["downloaded"] = url
            return b"bytes:" + url.encode()

        monkeypatch.setattr(fal, "run", run)
        monkeypatch.setattr(fal, "download", download)
        return sent

    return install


def test_image_to_3d(fake_run):
    sent = fake_run({"model_glb": {"url": "https://cdn/m.glb"}, "model_urls": {"glb": {"url": "https://cdn/other.glb"}}})
    assert asyncio.run(fal.image_to_3d(PHOTO)) == b"bytes:https://cdn/m.glb"
    assert sent["endpoint"] == "fal-ai/hunyuan3d-v3/image-to-3d"
    assert sent["payload"] == {"input_image_url": fal.data_uri(PHOTO), "generate_type": "Normal",
                               "enable_pbr": True, "face_count": 50000}


def test_image_to_3d_falls_back_to_model_urls(fake_run):
    fake_run({"model_urls": {"glb": {"url": "https://cdn/other.glb"}}})
    assert asyncio.run(fal.image_to_3d(PHOTO)) == b"bytes:https://cdn/other.glb"


def test_image_to_3d_without_model_raises(fake_run):
    fake_run({"model_urls": {}})
    with pytest.raises(fal.FalError, match="no 3D model"):
        asyncio.run(fal.image_to_3d(PHOTO))


def test_sound_effect(fake_run):
    sent = fake_run({"audio": {"url": "https://cdn/a.mp3"}})
    assert asyncio.run(fal.sound_effect("rain on a roof")) == b"bytes:https://cdn/a.mp3"
    assert sent["endpoint"] == "fal-ai/elevenlabs/sound-effects/v2"
    assert sent["payload"] == {"text": "rain on a roof", "loop": True, "duration_seconds": 10.0,
                               "output_format": "mp3_44100_128"}


def test_sound_effect_without_audio_raises(fake_run):
    fake_run({})
    with pytest.raises(fal.FalError, match="no audio"):
        asyncio.run(fal.sound_effect("x"))


# ---- Derive endpoint and pipeline ---------------------------------------------------------

from fastapi.testclient import TestClient  # noqa: E402

from app.api.v1 import jobs as jobs_api  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Job  # noqa: E402
from app.pipelines import render as render_pipeline  # noqa: E402
from tests.test_render import (  # noqa: E402,F401  (owned_job is a fixture)
    SNAPSHOT, _file_bytes, _job_params, _post, _providers, _render, owned_job,
)


def _finished_photo_render(job_id: str, monkeypatch) -> str:
    """Run a real (faked-provider) photo render so the job has a completed render with a stored photo."""
    async def edit_image(prompt, images):
        return PHOTO

    monkeypatch.setattr(render_pipeline.fal, "edit_image", edit_image)

    async def seed():
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            job.params = {**job.params, "renders": [render_pipeline.new_render("src", "image", "night", "")]}
            await session.commit()

    asyncio.run(seed())
    asyncio.run(render_pipeline.run_render(job_id, "src", SNAPSHOT, "image", "night"))
    assert _render(asyncio.run(_job_params(job_id)), "src")["status"] == "completed"
    return "src"


@pytest.fixture
def source_job(owned_job, monkeypatch):
    """A job with one finished photo render ("src"), FAL and World Labs enabled."""
    _providers(monkeypatch, fal_key="k", world_key="wl")
    return owned_job, _finished_photo_render(owned_job, monkeypatch)


@pytest.fixture
def derive_job(source_job, monkeypatch):
    """source_job, with background derived renders captured instead of run."""
    job_id, source = source_job
    started = []

    async def fake_run_derived(*args):
        started.append(args)

    monkeypatch.setattr(jobs_api.render_pipeline, "run_derived", fake_run_derived)
    return job_id, source, started


def _derive(job_id, render_id, kind, prompt=""):
    return TestClient(app).post(f"/api/v1/jobs/{job_id}/renders/{render_id}/derive", data={"kind": kind, "prompt": prompt})


@pytest.mark.parametrize("kind,prompt", [("world", "keep it sunny"), ("object", "sofa"), ("sound", "")])
def test_derive_queues_from_source_photo(derive_job, kind, prompt):
    job_id, source, started = derive_job
    r = _derive(job_id, source, kind, prompt)
    assert r.status_code == 202, r.text
    render = r.json()["render"]
    assert render["kind"] == kind and render["source_render_id"] == source
    assert render["style"] == "night"  # inherited from the source render
    assert render["stage"] == {"world": "world", "object": "isolate", "sound": "sound"}[kind]
    assert started == [(job_id, render["id"], kind, PHOTO, "night", prompt)]


def test_derive_validation(derive_job):
    job_id, source, started = derive_job
    assert _derive(job_id, source, "hologram").status_code == 400
    r = _derive(job_id, source, "object", "   ")
    assert r.status_code == 400 and "Name the object" in r.json()["detail"]
    assert _derive(job_id, "nope", "world").status_code == 404
    assert _derive("no-job", source, "world").status_code == 404
    assert _derive(job_id, source, "sound", "x" * 501).status_code == 422
    assert started == []


def test_derive_needs_a_finished_photo(derive_job):
    job_id, source, started = derive_job

    async def mutate(**fields):
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            renders = [dict(r, **fields) if r["id"] == source else r for r in job.params["renders"]]
            job.params = {**job.params, "renders": renders}
            await session.commit()

    asyncio.run(mutate(status="processing"))
    assert _derive(job_id, source, "world").status_code == 400
    asyncio.run(mutate(status="completed", kind="world"))  # cannot derive from a derived render
    assert _derive(job_id, source, "world").status_code == 400
    assert started == []


@pytest.mark.parametrize("kind,config,missing", [
    ("world", dict(fal_key="k"), "WORLD_LABS_API_KEY"),
    ("object", dict(world_key="wl", azure_image="gpt-image-1"), "FAL_KEY (Hunyuan 3D)"),
    ("sound", dict(world_key="wl", azure_image="gpt-image-1"), "FAL_KEY (ElevenLabs)"),
])
def test_derive_reports_missing_provider(derive_job, monkeypatch, kind, config, missing):
    job_id, source, started = derive_job
    _providers(monkeypatch, **config)
    r = _derive(job_id, source, kind, "sofa")
    assert r.status_code == 503 and missing in r.json()["detail"]
    assert started == []


def test_derive_shares_the_active_cap(derive_job, monkeypatch):
    job_id, source, started = derive_job
    monkeypatch.setattr(jobs_api.render_pipeline, "run_render", lambda *a: asyncio.sleep(0))
    assert _derive(job_id, source, "sound").status_code == 202
    assert _post(job_id).status_code == 202
    assert _derive(job_id, source, "world").status_code == 429


# Pipeline with faked providers


def _derived_in_db(job_id, kind, prompt=""):
    async def seed():
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            job.params = {**job.params, "renders": job.params["renders"] + [
                render_pipeline.new_render("d1", kind, "night", prompt, "src")]}
            await session.commit()

    asyncio.run(seed())
    return "d1"


def test_pipeline_world(source_job, monkeypatch):
    job_id, _ = source_job
    seen = {}

    async def generate_world(image, prompt="", name=""):
        seen.update(image=image, prompt=prompt, name=name)
        return {"spz": SPZ, "collider": GLB, "pano": None, "meta": {"flip_y": True, "ground_plane_offset": 0,
                                                                   "metric_scale_factor": 1, "caption": "c"}}

    monkeypatch.setattr(render_pipeline.worldlabs, "generate_world", generate_world)
    rid = _derived_in_db(job_id, "world", "foggy")
    asyncio.run(render_pipeline.run_derived(job_id, rid, "world", PHOTO, "night", "foggy"))
    render = _render(asyncio.run(_job_params(job_id)), rid)
    assert render["status"] == "completed" and render["world_meta"]["caption"] == "c"
    assert asyncio.run(_file_bytes(render["world_spz_file_id"])) == SPZ
    assert asyncio.run(_file_bytes(render["world_collider_file_id"])) == GLB
    assert "world_pano_file_id" not in render
    assert seen == {"image": PHOTO, "prompt": "foggy", "name": f"cadlift-{rid}"}


def test_pipeline_object(source_job, monkeypatch):
    job_id, _ = source_job
    REFERENCE = b"reference-png"
    seen = {}

    async def edit_image(prompt, images):
        seen.update(prompt=prompt, images=images)
        return REFERENCE

    async def image_to_3d(image):
        seen["model_input"] = image
        return GLB

    monkeypatch.setattr(render_pipeline.fal, "edit_image", edit_image)
    monkeypatch.setattr(render_pipeline.fal, "image_to_3d", image_to_3d)
    rid = _derived_in_db(job_id, "object", "sofa")
    asyncio.run(render_pipeline.run_derived(job_id, rid, "object", PHOTO, "night", " sofa "))
    render = _render(asyncio.run(_job_params(job_id)), rid)
    assert render["status"] == "completed"
    assert asyncio.run(_file_bytes(render["image_file_id"])) == REFERENCE
    assert asyncio.run(_file_bytes(render["model_file_id"])) == GLB
    assert seen["prompt"].startswith("Isolate the sofa from this image") and seen["images"] == [PHOTO]
    assert seen["model_input"] == REFERENCE
    assert render["providers"] == {"image": "fal", "model": "fal"}


@pytest.mark.parametrize("prompt,expected", [("", "crickets"), ("rain on a tin roof", "rain on a tin roof")])
def test_pipeline_sound(source_job, monkeypatch, prompt, expected):
    job_id, _ = source_job
    seen = {}

    async def sound_effect(text, loop=True, duration_seconds=10.0):
        seen["text"] = text
        return MP3

    monkeypatch.setattr(render_pipeline.fal, "sound_effect", sound_effect)
    rid = _derived_in_db(job_id, "sound", prompt)
    asyncio.run(render_pipeline.run_derived(job_id, rid, "sound", PHOTO, "night", prompt))
    render = _render(asyncio.run(_job_params(job_id)), rid)
    assert render["status"] == "completed"
    assert asyncio.run(_file_bytes(render["audio_file_id"])) == MP3
    assert expected in seen["text"] and "No music" in seen["text"]


def test_pipeline_derived_failure_is_recorded(source_job, monkeypatch):
    job_id, _ = source_job

    async def broken(*a, **k):
        raise worldlabs.WorldLabsError("World Labs submit failed (402): no credits")

    monkeypatch.setattr(render_pipeline.worldlabs, "generate_world", broken)
    rid = _derived_in_db(job_id, "world")
    asyncio.run(render_pipeline.run_derived(job_id, rid, "world", PHOTO, "night"))
    render = _render(asyncio.run(_job_params(job_id)), rid)
    assert render["status"] == "failed" and "no credits" in render["error"]


# ---- World placements ------------------------------------------------------------------------


@pytest.fixture
def world_with_objects(owned_job):
    async def seed():
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, owned_job)
            done = {"status": "completed", "stage": None}
            job.params = {**job.params, "renders": [
                {**render_pipeline.new_render("w", "world", "daylight", ""), **done, "world_spz_file_id": "f1"},
                {**render_pipeline.new_render("o1", "object", "daylight", "sofa"), **done, "model_file_id": "m1"},
                {**render_pipeline.new_render("o2", "object", "daylight", "lamp"), "model_file_id": None},  # still running
                {**render_pipeline.new_render("p", "image", "daylight", ""), **done},
            ]}
            await session.commit()

    asyncio.run(seed())
    return owned_job


def _place(job_id, render_id, placements):
    return TestClient(app).put(f"/api/v1/jobs/{job_id}/renders/{render_id}/placements", json={"placements": placements})


def test_save_and_replace_placements(world_with_objects):
    p = {"id": "a", "object_render_id": "o1", "position": [1.5, -1.6, -3], "rotation_y": 0.5, "scale": 1.2}
    r = _place(world_with_objects, "w", [p, {**p, "id": "b", "position": [0, 0, 0]}])
    assert r.status_code == 200, r.text
    world = _render(r.json()["job"]["params"], "w")
    assert [x["id"] for x in world["placements"]] == ["a", "b"]
    assert world["placements"][0] == {**p, "position": [1.5, -1.6, -3.0]}
    # Defaults, and replacing the list
    r = _place(world_with_objects, "w", [{"id": "c", "object_render_id": "o1", "position": [0, 0, 0]}])
    assert _render(r.json()["job"]["params"], "w")["placements"] == [
        {"id": "c", "object_render_id": "o1", "position": [0.0, 0.0, 0.0], "rotation_y": 0.0, "scale": 1.0}]
    assert _render(_place(world_with_objects, "w", []).json()["job"]["params"], "w")["placements"] == []


@pytest.mark.parametrize("placement,status,detail", [
    ({"id": "a", "object_render_id": "o2", "position": [0, 0, 0]}, 400, "unfinished"),
    ({"id": "a", "object_render_id": "p", "position": [0, 0, 0]}, 400, "Unknown"),
    ({"id": "a", "object_render_id": "o1", "position": [0, 20000, 0]}, 400, "out of range"),
    ({"id": "a", "object_render_id": "o1", "position": [0, 0]}, 422, None),
    ({"id": "a", "object_render_id": "o1", "position": [0, 0, 0], "scale": 0}, 422, None),
    ({"id": "", "object_render_id": "o1", "position": [0, 0, 0]}, 422, None),
])
def test_placement_validation(world_with_objects, placement, status, detail):
    r = _place(world_with_objects, "w", [placement])
    assert r.status_code == status
    if detail:
        assert detail in r.json()["detail"]


def test_placement_rejects_duplicates_too_many_and_bad_targets(world_with_objects, monkeypatch):
    p = {"id": "a", "object_render_id": "o1", "position": [0, 0, 0]}
    assert "Duplicate" in _place(world_with_objects, "w", [p, p]).json()["detail"]
    many = [{**p, "id": str(i)} for i in range(jobs_api.MAX_PLACEMENTS + 1)]
    assert _place(world_with_objects, "w", many).status_code == 422
    assert _place(world_with_objects, "p", [p]).status_code == 400  # not a world
    assert _place(world_with_objects, "nope", [p]).status_code == 404
    assert _place("no-job", "w", [p]).status_code == 404
