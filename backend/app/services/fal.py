"""
FAL queue client, ported from image-blaster's fal-queue.mjs: submit, poll status, fetch the
result, download the output file. Inputs go up as data URIs, so nothing needs public hosting.
"""
from __future__ import annotations

import base64

import httpx

from app.core.config import get_settings
from app.services.media_poll import poll

NAME = "fal"

QUEUE_URL = "https://queue.fal.run"


class FalError(Exception):
    """A FAL request failed, timed out, or returned no output."""


def is_enabled() -> bool:
    return bool(get_settings().fal_key)


image_enabled = video_enabled = is_enabled


def data_uri(data: bytes, mime: str = "image/png") -> str:
    return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"


async def run(endpoint: str, payload: dict, poll_seconds: float = 5.0) -> dict:
    """Submit to the FAL queue and block (async) until the result is ready."""
    settings = get_settings()
    if not settings.fal_key:
        raise FalError("FAL_KEY is not set")
    async with httpx.AsyncClient(timeout=60, headers={"Authorization": f"Key {settings.fal_key}"}) as client:
        resp = await client.post(f"{QUEUE_URL}/{endpoint}", json=payload)
        if resp.status_code >= 400:
            raise FalError(f"FAL submit failed ({resp.status_code}): {resp.text[:200]}")
        submitted = resp.json()
        request_id = submitted.get("request_id")
        if not request_id:
            raise FalError("FAL submit response had no request_id")
        status_url = submitted.get("status_url") or f"{QUEUE_URL}/{endpoint}/requests/{request_id}/status"
        response_url = submitted.get("response_url") or f"{QUEUE_URL}/{endpoint}/requests/{request_id}"

        async def check() -> dict | None:
            resp = await client.get(status_url)
            if resp.status_code >= 400:
                raise FalError(f"FAL status failed ({resp.status_code})")
            status = resp.json()
            if status.get("status") != "COMPLETED":
                return None
            if status.get("error"):
                raise FalError(f"FAL request failed: {status['error']}")
            return status

        await poll(check, FalError, "FAL request", poll_seconds)

        resp = await client.get(response_url)
        if resp.status_code >= 400:
            raise FalError(f"FAL result failed ({resp.status_code}): {resp.text[:200]}")
        return resp.json()


async def download(url: str) -> bytes:
    async with httpx.AsyncClient(timeout=180, follow_redirects=True) as client:
        resp = await client.get(url)
        if resp.status_code >= 400:
            raise FalError(f"Download failed ({resp.status_code})")
        return resp.content


async def edit_image(prompt: str, images: list[bytes]) -> bytes:
    """Image edit (nano-banana by default): returns PNG bytes."""
    result = await run(get_settings().fal_image_endpoint, {
        "prompt": prompt,
        "image_urls": [data_uri(image) for image in images],
        "num_images": 1,
        "aspect_ratio": "auto",
        "output_format": "png",
        "resolution": "1K",
    })
    outputs = result.get("images") or []
    if not outputs or not outputs[0].get("url"):
        raise FalError("FAL returned no image")
    return await download(outputs[0]["url"])


async def image_to_video(prompt: str, start: bytes, end: bytes | None = None, duration: str = "5") -> bytes:
    """Image to video (Kling by default); `end` sets the last frame. Returns MP4 bytes."""
    payload = {"prompt": prompt, "image_url": data_uri(start), "duration": duration}
    if end is not None:
        payload["tail_image_url"] = data_uri(end)
    result = await run(get_settings().fal_video_endpoint, payload)
    url = (result.get("video") or {}).get("url")
    if not url:
        raise FalError("FAL returned no video")
    return await download(url)
