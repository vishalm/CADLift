"""Render studio: viewer snapshot -> photoreal image / orbit video / construction timelapse via FAL."""
import asyncio
from datetime import datetime, timedelta, timezone

import cv2
import httpx
import numpy as np
import pytest
from fastapi.testclient import TestClient

from app import deps
from app.api.v1 import jobs as jobs_api
from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.main import app
from app.models import File as FileModel, Job, User
from app.pipelines import render as render_pipeline
from app.services import fal


def _png(seed: int = 0) -> bytes:
    rng = np.random.default_rng(seed)
    ok, buf = cv2.imencode(".png", rng.integers(0, 255, (360, 640, 3), dtype=np.uint8))
    assert ok
    return buf.tobytes()


SNAPSHOT = _png(0)
PHOTO = _png(1)
SITE = _png(2)
VIDEO = b"\x00\x00\x00\x18ftypmp42fake-video"


async def _job_params(job_id: str) -> dict:
    async with AsyncSessionLocal() as session:
        return (await session.get(Job, job_id)).params


async def _file_bytes(file_id: str) -> bytes:
    from app.services.storage import storage_service

    async with AsyncSessionLocal() as session:
        record = await session.get(FileModel, file_id)
        assert record.role == "render"
        return storage_service.resolve_path(record.storage_key).read_bytes()


def _render(params: dict, render_id: str) -> dict:
    return next(r for r in params["renders"] if r["id"] == render_id)


def _providers(monkeypatch, fal_key=None, azure_image=None, azure_video=None, choice="auto", world_key=None):
    """Pin render provider settings so the developer's real backend/.env never leaks into tests."""
    settings = get_settings()
    monkeypatch.setattr(settings, "world_labs_api_key", world_key)
    monkeypatch.setattr(settings, "render_provider", choice)
    monkeypatch.setattr(settings, "fal_key", fal_key)
    monkeypatch.setattr(settings, "azure_openai_endpoint", "https://res.openai.azure.com/")
    monkeypatch.setattr(settings, "azure_openai_api_key", "azure-key")
    monkeypatch.setattr(settings, "azure_openai_api_version", "2025-04-01-preview")
    monkeypatch.setattr(settings, "azure_image_deployment_name", azure_image)
    monkeypatch.setattr(settings, "azure_video_deployment_name", azure_video)


@pytest.fixture
def owned_job(monkeypatch):
    """A job owned by the signed-in test user, with FAL enabled."""

    async def make():
        async with AsyncSessionLocal() as session:
            user = User(email="render@example.com", password_hash="x", display_name="Render")
            session.add(user)
            await session.flush()
            job = Job(job_type="cad", mode="floor_plan", status="completed", params={"glb_file_id": "g"}, user_id=user.id)
            session.add(job)
            await session.commit()
            return user.id, job.id

    user_id, job_id = asyncio.run(make())
    _providers(monkeypatch, fal_key="test-key")
    app.dependency_overrides[deps.get_current_user] = lambda: type("U", (), {"id": user_id})()
    yield job_id
    app.dependency_overrides.clear()


@pytest.fixture
def render_job(owned_job, monkeypatch):
    """owned_job, with background renders captured instead of run."""
    started = []

    async def fake_run_render(*args):
        started.append(args)

    monkeypatch.setattr(jobs_api.render_pipeline, "run_render", fake_run_render)
    return owned_job, started


def _post(job_id, kind="image", style="daylight", prompt="", snapshot=SNAPSHOT):
    return TestClient(app).post(
        f"/api/v1/jobs/{job_id}/renders",
        data={"kind": kind, "style": style, "prompt": prompt},
        files={"snapshot": ("view.png", snapshot, "image/png")},
    )


# ---- API ------------------------------------------------------------------------


def test_create_render_queues_and_stores_snapshot(render_job):
    job_id, started = render_job
    r = _post(job_id, kind="construction", style="night", prompt="  red brick  ")
    assert r.status_code == 202, r.text
    render = r.json()["render"]
    assert render["status"] == "processing" and render["stage"] == "photo"
    assert (render["kind"], render["style"], render["prompt"]) == ("construction", "night", "red brick")
    assert r.json()["job"]["params"]["renders"][-1]["id"] == render["id"]
    assert asyncio.run(_file_bytes(render["snapshot_file_id"])) == SNAPSHOT
    assert started == [(job_id, render["id"], SNAPSHOT, "construction", "night", "red brick")]
    # The snapshot is reachable through the normal file download route.
    assert TestClient(app).get(f"/api/v1/files/{render['snapshot_file_id']}").content == SNAPSHOT


def test_create_render_requires_fal(render_job, monkeypatch):
    job_id, started = render_job
    monkeypatch.setattr(get_settings(), "fal_key", None)
    r = _post(job_id)
    assert r.status_code == 503 and "FAL_KEY" in r.json()["detail"]
    assert started == []


@pytest.mark.parametrize("field,value", [("kind", "hologram"), ("style", "vaporwave")])
def test_create_render_rejects_unknown_kind_and_style(render_job, field, value):
    job_id, started = render_job
    r = _post(job_id, **{field: value})
    assert r.status_code == 400 and field in r.json()["detail"]
    assert started == []


@pytest.mark.parametrize("snapshot", [b"not an image", cv2.imencode(".png", np.full((360, 640, 3), 200, np.uint8))[1].tobytes()])
def test_create_render_rejects_bad_or_blank_snapshot(render_job, snapshot):
    job_id, started = render_job
    r = _post(job_id, snapshot=snapshot)
    assert r.status_code == 400 and "Invalid snapshot" in r.json()["detail"]
    assert started == []


def test_create_render_rejects_oversized_snapshot(render_job):
    job_id, _ = render_job
    r = _post(job_id, snapshot=b"x" * (jobs_api.MAX_SNAPSHOT_BYTES + 1))
    assert r.status_code == 400 and "10 MB" in r.json()["detail"]


def test_create_render_validates_prompt_and_job(render_job):
    job_id, _ = render_job
    assert _post(job_id, prompt="x" * 501).status_code == 422
    assert _post("does-not-exist").status_code == 404


def test_create_render_caps_active_renders(render_job):
    job_id, started = render_job
    assert _post(job_id).status_code == 202
    assert _post(job_id).status_code == 202
    r = _post(job_id)
    assert r.status_code == 429
    assert len(started) == 2


def test_stale_processing_renders_are_swept(render_job):
    job_id, _ = render_job
    old = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

    async def seed():
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            job.params = {**job.params, "renders": [
                {"id": "a", "status": "processing", "created_at": old},
                {"id": "b", "status": "processing", "created_at": old},
            ]}
            await session.commit()

    asyncio.run(seed())
    assert _post(job_id).status_code == 202  # stale ones no longer count against the cap
    params = asyncio.run(_job_params(job_id))
    assert [r["status"] for r in params["renders"]] == ["failed", "failed", "processing"]
    assert "interrupted" in params["renders"][0]["error"]


def test_render_history_is_trimmed(render_job, monkeypatch):
    job_id, _ = render_job
    monkeypatch.setattr(jobs_api, "MAX_RENDERS", 2)
    monkeypatch.setattr(jobs_api, "MAX_ACTIVE_RENDERS", 99)
    ids = [_post(job_id).json()["render"]["id"] for _ in range(3)]
    assert [r["id"] for r in asyncio.run(_job_params(job_id))["renders"]] == ids[1:]


# ---- Pipeline -------------------------------------------------------------------


def _new_render_in_db(job_id: str, kind: str) -> str:
    async def seed():
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, job_id)
            job.params = {**job.params, "renders": [render_pipeline.new_render("r1", kind, "daylight", "")]}
            await session.commit()

    asyncio.run(seed())
    return "r1"


@pytest.fixture
def fake_fal(monkeypatch):
    calls = {"edit": [], "video": []}

    async def edit_image(prompt, images):
        calls["edit"].append((prompt, images))
        return PHOTO if len(calls["edit"]) == 1 else SITE

    async def image_to_video(prompt, start, end=None, duration="5"):
        calls["video"].append((prompt, start, end))
        return VIDEO

    monkeypatch.setattr(render_pipeline.fal, "edit_image", edit_image)
    monkeypatch.setattr(render_pipeline.fal, "image_to_video", image_to_video)
    return calls


def test_pipeline_image(owned_job, fake_fal):
    job_id = owned_job
    rid = _new_render_in_db(job_id, "image")
    asyncio.run(render_pipeline.run_render(job_id, rid, SNAPSHOT, "image", "golden_hour", "brick facade"))
    render = _render(asyncio.run(_job_params(job_id)), rid)
    assert render["status"] == "completed" and render["stage"] is None
    assert asyncio.run(_file_bytes(render["image_file_id"])) == PHOTO
    assert "video_file_id" not in render
    prompt, images = fake_fal["edit"][0]
    assert images == [SNAPSHOT] and "golden hour" in prompt and prompt.endswith("brick facade")
    assert fake_fal["video"] == []


def test_pipeline_orbit_video(owned_job, fake_fal):
    job_id = owned_job
    rid = _new_render_in_db(job_id, "video")
    asyncio.run(render_pipeline.run_render(job_id, rid, SNAPSHOT, "video", "daylight"))
    render = _render(asyncio.run(_job_params(job_id)), rid)
    assert render["status"] == "completed"
    assert asyncio.run(_file_bytes(render["image_file_id"])) == PHOTO
    assert asyncio.run(_file_bytes(render["video_file_id"])) == VIDEO
    prompt, start, end = fake_fal["video"][0]
    assert (start, end) == (PHOTO, None) and "orbit" in prompt


def test_pipeline_construction_timelapse_goes_site_to_finished(owned_job, fake_fal):
    job_id = owned_job
    rid = _new_render_in_db(job_id, "construction")
    asyncio.run(render_pipeline.run_render(job_id, rid, SNAPSHOT, "construction", "daylight"))
    render = _render(asyncio.run(_job_params(job_id)), rid)
    assert render["status"] == "completed"
    assert asyncio.run(_file_bytes(render["start_image_file_id"])) == SITE
    assert asyncio.run(_file_bytes(render["image_file_id"])) == PHOTO
    assert asyncio.run(_file_bytes(render["video_file_id"])) == VIDEO
    # The site is derived from the photoreal still, and the video runs site -> finished building.
    assert fake_fal["edit"][1] == (render_pipeline.SITE_PROMPT, [PHOTO])
    prompt, start, end = fake_fal["video"][0]
    assert (start, end) == (SITE, PHOTO) and "timelapse" in prompt


def test_pipeline_failure_keeps_partial_output(owned_job, monkeypatch):
    job_id = owned_job
    rid = _new_render_in_db(job_id, "video")

    async def edit_image(prompt, images):
        return PHOTO

    async def broken_video(*args, **kwargs):
        raise fal.FalError("FAL submit failed (402): out of credits")

    monkeypatch.setattr(render_pipeline.fal, "edit_image", edit_image)
    monkeypatch.setattr(render_pipeline.fal, "image_to_video", broken_video)
    asyncio.run(render_pipeline.run_render(job_id, rid, SNAPSHOT, "video", "daylight"))
    render = _render(asyncio.run(_job_params(job_id)), rid)
    assert render["status"] == "failed" and "out of credits" in render["error"]
    assert render["image_file_id"]  # the photo that did finish is still there


def test_pipeline_tolerates_deleted_job(fake_fal):
    asyncio.run(render_pipeline.run_render("missing-job", "r1", SNAPSHOT, "image", "daylight"))  # no raise


# ---- FAL client -----------------------------------------------------------------


def _mock_fal(monkeypatch, handler):
    real = httpx.AsyncClient
    monkeypatch.setattr(fal.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    monkeypatch.setattr(get_settings(), "fal_key", "test-key")


def test_fal_run_polls_until_completed(monkeypatch):
    statuses = iter(["IN_QUEUE", "IN_PROGRESS", "COMPLETED"])
    seen = []

    def handler(request):
        seen.append((request.method, request.url.path, request.headers.get("authorization")))
        if request.method == "POST":
            return httpx.Response(200, json={"request_id": "abc"})
        if request.url.path.endswith("/status"):
            return httpx.Response(200, json={"status": next(statuses)})
        return httpx.Response(200, json={"images": [{"url": "https://cdn/x.png"}]})

    _mock_fal(monkeypatch, handler)
    result = asyncio.run(fal.run("fal-ai/test", {"prompt": "p"}, poll_seconds=0))
    assert result == {"images": [{"url": "https://cdn/x.png"}]}
    assert seen[0] == ("POST", "/fal-ai/test", "Key test-key")
    assert [p for _, p, _ in seen].count("/fal-ai/test/requests/abc/status") == 3


@pytest.mark.parametrize("handler,message", [
    (lambda r: httpx.Response(401, text="bad key"), r"submit failed \(401\)"),
    (lambda r: httpx.Response(200, json={}), "no request_id"),
    (lambda r: httpx.Response(200, json={"request_id": "a"}) if r.method == "POST"
        else httpx.Response(200, json={"status": "COMPLETED", "error": "nsfw"}), "nsfw"),
])
def test_fal_run_errors(monkeypatch, handler, message):
    _mock_fal(monkeypatch, handler)
    with pytest.raises(fal.FalError, match=message):
        asyncio.run(fal.run("fal-ai/test", {}, poll_seconds=0))


def test_fal_run_times_out(monkeypatch):
    _mock_fal(monkeypatch, lambda r: httpx.Response(200, json={"request_id": "a"}) if r.method == "POST"
              else httpx.Response(200, json={"status": "IN_PROGRESS"}))
    monkeypatch.setattr(get_settings(), "render_timeout_seconds", 0)
    with pytest.raises(fal.FalError, match="timed out"):
        asyncio.run(fal.run("fal-ai/test", {}, poll_seconds=0))


def test_fal_run_requires_key(monkeypatch):
    monkeypatch.setattr(get_settings(), "fal_key", None)
    with pytest.raises(fal.FalError, match="FAL_KEY"):
        asyncio.run(fal.run("fal-ai/test", {}))


def test_image_to_video_sends_first_and_last_frame(monkeypatch):
    sent = {}

    async def fake_run(endpoint, payload, poll_seconds=5.0):
        sent.update(endpoint=endpoint, payload=payload)
        return {"video": {"url": "https://cdn/v.mp4"}}

    async def fake_download(url):
        return VIDEO

    monkeypatch.setattr(fal, "run", fake_run)
    monkeypatch.setattr(fal, "download", fake_download)
    assert asyncio.run(fal.image_to_video("p", SITE, PHOTO)) == VIDEO
    assert sent["endpoint"] == get_settings().fal_video_endpoint
    assert sent["payload"]["image_url"] == fal.data_uri(SITE)
    assert sent["payload"]["tail_image_url"] == fal.data_uri(PHOTO)
    asyncio.run(fal.image_to_video("p", SITE))
    assert "tail_image_url" not in sent["payload"]


def test_edit_image_without_output_raises(monkeypatch):
    async def fake_run(endpoint, payload, poll_seconds=5.0):
        return {"images": []}

    monkeypatch.setattr(fal, "run", fake_run)
    with pytest.raises(fal.FalError, match="no image"):
        asyncio.run(fal.edit_image("p", [SNAPSHOT]))


# ---- Provider selection ------------------------------------------------------------


@pytest.mark.parametrize("config,image,video", [
    (dict(fal_key="k"), "fal", "fal"),
    (dict(azure_image="gpt-image-1", azure_video="sora-2"), "azure", "azure"),
    (dict(fal_key="k", azure_image="gpt-image-1", azure_video="sora-2"), "azure", "azure"),  # auto prefers Azure
    (dict(fal_key="k", azure_image="gpt-image-1"), "azure", "fal"),  # mixed: Azure photos, FAL video
    (dict(fal_key="k", azure_image="gpt-image-1", azure_video="sora-2", choice="fal"), "fal", "fal"),
    (dict(fal_key="k", azure_image="gpt-image-1", choice="azure"), "azure", None),
    (dict(azure_image="gpt-image-1", choice="fal"), None, None),
    (dict(), None, None),
])
def test_provider_selection(monkeypatch, config, image, video):
    _providers(monkeypatch, **config)
    assert getattr(render_pipeline.image_backend(), "NAME", None) == image
    assert getattr(render_pipeline.video_backend(), "NAME", None) == video


def test_azure_needs_endpoint_and_key(monkeypatch):
    _providers(monkeypatch, azure_image="gpt-image-1", azure_video="sora-2")
    monkeypatch.setattr(get_settings(), "azure_openai_api_key", None)
    assert render_pipeline.image_backend() is None and render_pipeline.video_backend() is None


def test_video_kinds_need_a_video_provider(render_job, monkeypatch):
    job_id, started = render_job
    _providers(monkeypatch, azure_image="gpt-image-1")  # photos only
    assert _post(job_id, kind="image").status_code == 202
    for kind in ("video", "construction"):
        r = _post(job_id, kind=kind)
        assert r.status_code == 503 and "AZURE_VIDEO_DEPLOYMENT_NAME" in r.json()["detail"]
    assert len(started) == 1


def test_pipeline_records_providers_and_uses_azure(owned_job, monkeypatch):
    job_id = owned_job
    _providers(monkeypatch, fal_key="k", azure_image="gpt-image-1")
    calls = []

    async def azure_edit(prompt, images):
        calls.append("azure-image")
        return PHOTO

    async def fal_video(prompt, start, end=None, duration="5"):
        calls.append("fal-video")
        return VIDEO

    monkeypatch.setattr(render_pipeline.azure_media, "edit_image", azure_edit)
    monkeypatch.setattr(render_pipeline.fal, "image_to_video", fal_video)
    rid = _new_render_in_db(job_id, "video")
    asyncio.run(render_pipeline.run_render(job_id, rid, SNAPSHOT, "video", "daylight"))
    render = _render(asyncio.run(_job_params(job_id)), rid)
    assert render["status"] == "completed"
    assert render["providers"] == {"image": "azure", "video": "fal"}
    assert calls == ["azure-image", "fal-video"]


def test_pipeline_fails_fast_when_video_provider_disappears(owned_job, monkeypatch, fake_fal):
    job_id = owned_job
    _providers(monkeypatch, azure_image="gpt-image-1")  # e.g. config changed after the request was accepted
    rid = _new_render_in_db(job_id, "video")
    asyncio.run(render_pipeline.run_render(job_id, rid, SNAPSHOT, "video", "daylight"))
    render = _render(asyncio.run(_job_params(job_id)), rid)
    assert render["status"] == "failed" and "No video provider" in render["error"]
    assert fake_fal["edit"] == []  # nothing paid for before failing


# ---- Azure OpenAI client ------------------------------------------------------------

from app.services import azure_media  # noqa: E402


def _mock_azure(monkeypatch, handler, **config):
    real = httpx.AsyncClient
    monkeypatch.setattr(azure_media.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    _providers(monkeypatch, azure_image="gpt-image-1", azure_video="sora-2", **config)


def _png_size(data: bytes) -> tuple[int, int]:
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    return img.shape[1], img.shape[0]


def test_azure_edit_image(monkeypatch):
    import base64

    seen = {}

    def handler(request):
        seen.update(url=str(request.url), key=request.headers.get("api-key"), body=request.read())
        return httpx.Response(200, json={"data": [{"b64_json": base64.b64encode(PHOTO).decode()}]})

    _mock_azure(monkeypatch, handler)
    assert asyncio.run(azure_media.edit_image("make it real", [SNAPSHOT])) == PHOTO
    assert seen["url"] == ("https://res.openai.azure.com/openai/deployments/gpt-image-1/images/edits"
                           "?api-version=2025-04-01-preview")
    assert seen["key"] == "azure-key"
    assert b"make it real" in seen["body"] and b"1536x1024" in seen["body"] and SNAPSHOT in seen["body"]


@pytest.mark.parametrize("response,message", [
    (httpx.Response(400, text="content_policy_violation"), r"image edit failed \(400\): content_policy"),
    (httpx.Response(200, json={"data": []}), "no image"),
])
def test_azure_edit_image_errors(monkeypatch, response, message):
    _mock_azure(monkeypatch, lambda r: response)
    with pytest.raises(azure_media.AzureMediaError, match=message):
        asyncio.run(azure_media.edit_image("p", [SNAPSHOT]))


def test_azure_video_submits_fitted_first_frame_and_polls(monkeypatch):
    statuses = iter(["queued", "in_progress", "completed"])
    seen = []

    def handler(request):
        seen.append((request.method, request.url.path))
        if request.method == "POST":
            body = request.read()
            seen.append(body)
            return httpx.Response(200, json={"id": "video_1", "status": "queued"})
        if request.url.path.endswith("/content"):
            return httpx.Response(200, content=VIDEO)
        return httpx.Response(200, json={"id": "video_1", "status": next(statuses)})

    _mock_azure(monkeypatch, handler)
    monkeypatch.setattr(azure_media, "poll", _fast_poll)
    big_photo = cv2.imencode(".png", np.random.default_rng(3).integers(0, 255, (1024, 1536, 3), dtype=np.uint8))[1].tobytes()
    assert asyncio.run(azure_media.image_to_video("orbit", big_photo, end=PHOTO)) == VIDEO

    assert seen[0] == ("POST", "/openai/v1/videos")
    body = seen[1]
    assert b'name="model"' in body and b"sora-2" in body and b"1280x720" in body
    assert b'name="seconds"' in body and b'name="input_reference"' in body
    assert [s for s in seen[2:]].count(("GET", "/openai/v1/videos/video_1")) == 3
    assert seen[-1] == ("GET", "/openai/v1/videos/video_1/content")


async def _fast_poll(check, error, label, poll_seconds=5.0):
    from app.services.media_poll import poll
    return await poll(check, error, label, 0)


@pytest.mark.parametrize("job,message", [
    ({"status": "failed", "error": {"message": "moderation blocked"}}, "failed: moderation blocked"),
    ({"status": "failed", "error": "quota"}, "failed: quota"),
    ({"status": "cancelled"}, "cancelled: no reason given"),
])
def test_azure_video_failure_states(monkeypatch, job, message):
    def handler(request):
        if request.method == "POST":
            return httpx.Response(200, json={"id": "v"})
        return httpx.Response(200, json=job)

    _mock_azure(monkeypatch, handler)
    monkeypatch.setattr(azure_media, "poll", _fast_poll)
    with pytest.raises(azure_media.AzureMediaError, match=message):
        asyncio.run(azure_media.image_to_video("p", PHOTO))


@pytest.mark.parametrize("response,message", [
    (httpx.Response(404, text="DeploymentNotFound"), "video submit failed .*DeploymentNotFound"),
    (httpx.Response(200, json={}), "no id"),
])
def test_azure_video_submit_errors(monkeypatch, response, message):
    _mock_azure(monkeypatch, lambda r: response)
    with pytest.raises(azure_media.AzureMediaError, match=message):
        asyncio.run(azure_media.image_to_video("p", PHOTO))


def test_azure_video_times_out(monkeypatch):
    _mock_azure(monkeypatch, lambda r: httpx.Response(200, json={"id": "v", "status": "in_progress"}))
    monkeypatch.setattr(get_settings(), "render_timeout_seconds", 0)
    monkeypatch.setattr(azure_media, "poll", _fast_poll)
    with pytest.raises(azure_media.AzureMediaError, match="timed out"):
        asyncio.run(azure_media.image_to_video("p", PHOTO))


@pytest.mark.parametrize("w,h", [(1536, 1024), (1024, 1536), (640, 360), (1920, 1080), (100, 100)])
def test_fit_frame_is_exact_video_size(w, h):
    src = cv2.imencode(".png", np.random.default_rng(4).integers(0, 255, (h, w, 3), dtype=np.uint8))[1].tobytes()
    assert _png_size(azure_media.fit_frame(src)) == (1280, 720)


def test_fit_frame_rejects_garbage():
    with pytest.raises(azure_media.AzureMediaError, match="decode"):
        azure_media.fit_frame(b"nope")


def test_job_download_urls_resolve(owned_job):
    """serialize_job used to emit /files/{id}/download, a route that does not exist."""
    async def attach():
        from app.services.storage import save_job_file
        async with AsyncSessionLocal() as session:
            job = await session.get(Job, owned_job)
            glb = save_job_file(session, job, b"glTF", "output", "m.glb", "model/gltf-binary")
            await session.flush()
            job.params = {**job.params, "glb_file_id": glb.id}
            job.output_file_id = glb.id
            await session.commit()

    asyncio.run(attach())
    client = TestClient(app)
    body = client.get(f"/api/v1/jobs/{owned_job}").json()
    for field in ("download_url", "glb_download_url"):
        assert not body[field].endswith("/download")
        assert client.get(body[field]).content == b"glTF"
    assert body["dxf_download_url"] is None and body["step_download_url"] is None
