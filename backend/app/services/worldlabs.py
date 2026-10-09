"""
World Labs Marble client, ported from image-blaster's generate-world.mjs: turns one image into an
explorable world (Gaussian splat .spz, collider mesh .glb, panorama).
"""
from __future__ import annotations

import base64

import httpx

from app.core.config import get_settings
from app.services.media_poll import download, poll

API_URL = "https://api.worldlabs.ai/marble/v1"
# Splat resolutions in order of preference: 500k loads fast in a browser; full_res can be very large.
SPZ_PREFERENCE = ("500k", "full_res", "150k", "100k")


class WorldLabsError(Exception):
    """A World Labs request failed, timed out, or returned no splat."""


def is_enabled() -> bool:
    return bool(get_settings().world_labs_api_key)


def _headers() -> dict:
    return {"WLT-Api-Key": get_settings().world_labs_api_key or ""}


def build_request(image: bytes, prompt: str, name: str) -> dict:
    image_prompt = {
        "type": "image",
        "image_prompt": {
            "source": "data_base64",
            "data_base64": base64.b64encode(image).decode("ascii"),
            "extension": "png",
            "mime_type": "image/png",
        },
    }
    if prompt.strip():
        image_prompt["text_prompt"] = prompt.strip()
    return {"display_name": name, "model": get_settings().world_labs_model, "world_prompt": image_prompt}


def operation_id(operation: dict) -> str:
    raw = operation.get("operation_id") or operation.get("id") or operation.get("name")
    if not raw:
        raise WorldLabsError("World Labs operation had no id")
    return str(raw).split("/")[-1]


def pick_spz(spz_urls: dict) -> str | None:
    for key in SPZ_PREFERENCE:
        if spz_urls.get(key):
            return spz_urls[key]
    return next((url for url in spz_urls.values() if url), None)


async def generate_world(image: bytes, prompt: str = "", name: str = "cadlift-world") -> dict:
    """Returns {"spz": bytes, "collider": bytes | None, "pano": bytes | None, "meta": {...}}."""
    if not is_enabled():
        raise WorldLabsError("WORLD_LABS_API_KEY is not set")
    async with httpx.AsyncClient(timeout=120, headers=_headers()) as client:
        resp = await client.post(f"{API_URL}/worlds:generate", json=build_request(image, prompt, name))
        if resp.status_code >= 400:
            raise WorldLabsError(f"World Labs submit failed ({resp.status_code}): {resp.text[:200]}")
        op_id = operation_id(resp.json())

        async def check() -> dict | None:
            r = await client.get(f"{API_URL}/operations/{op_id}")
            if r.status_code >= 400:
                raise WorldLabsError(f"World Labs status failed ({r.status_code})")
            operation = r.json()
            if operation.get("error"):
                raise WorldLabsError(f"World Labs generation failed: {operation['error']}")
            return operation if operation.get("done") else None

        operation = await poll(check, WorldLabsError, "World Labs generation", poll_seconds=15)

    assets = (operation.get("response") or {}).get("assets") or {}
    splats = assets.get("splats") or {}
    spz_url = pick_spz(splats.get("spz_urls") or {})
    if not spz_url:
        raise WorldLabsError("World Labs returned no splat")
    collider_url = (assets.get("mesh") or {}).get("collider_mesh_url")
    pano_url = (assets.get("imagery") or {}).get("pano_url")
    semantics = splats.get("semantics_metadata") or {}
    return {
        "spz": await download(spz_url, WorldLabsError),
        "collider": await download(collider_url, WorldLabsError) if collider_url else None,
        "pano": await download(pano_url, WorldLabsError) if pano_url else None,
        "meta": {
            # image-blaster's viewer defaults: splats are stored upside down unless told otherwise
            "flip_y": semantics.get("flip_y", True),
            "ground_plane_offset": semantics.get("ground_plane_offset", 0),
            "metric_scale_factor": semantics.get("metric_scale_factor", 1),
            "caption": assets.get("caption") or "",
        },
    }
