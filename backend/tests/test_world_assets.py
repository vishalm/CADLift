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
