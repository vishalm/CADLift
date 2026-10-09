"""
Azure OpenAI render provider, same interface as app.services.fal (edit_image, image_to_video).

  images: gpt-image-1 edits on AZURE_IMAGE_DEPLOYMENT_NAME
  video:  Sora 2 (v1 videos API) on AZURE_VIDEO_DEPLOYMENT_NAME

Sora 2 only takes a first frame (input_reference, which must match the output size exactly),
so `end` is ignored: a construction timelapse starts on the site image and builds forward, but
its last frame is not pinned to the photoreal render the way FAL's tail frame is.
"""
from __future__ import annotations

import base64

import cv2
import httpx
import numpy as np

from app.core.config import get_settings
from app.services.media_poll import poll

NAME = "azure"

IMAGE_SIZE = "1536x1024"  # landscape; closest gpt-image-1 size to the 16:9 viewer snapshot
VIDEO_WIDTH, VIDEO_HEIGHT = 1280, 720
VIDEO_SECONDS = "8"  # Sora 2 allows 4, 8 or 12


class AzureMediaError(Exception):
    """An Azure OpenAI image or video request failed, timed out, or returned no output."""


def _base_ok() -> bool:
    s = get_settings()
    return bool(s.azure_openai_api_key and s.azure_openai_endpoint)


def image_enabled() -> bool:
    return _base_ok() and bool(get_settings().azure_image_deployment_name)


def video_enabled() -> bool:
    return _base_ok() and bool(get_settings().azure_video_deployment_name)


def _endpoint() -> str:
    return (get_settings().azure_openai_endpoint or "").rstrip("/")


def _headers() -> dict:
    return {"api-key": get_settings().azure_openai_api_key or ""}


def _fail(what: str, resp: httpx.Response) -> AzureMediaError:
    return AzureMediaError(f"Azure {what} failed ({resp.status_code}): {resp.text[:200]}")


def fit_frame(image: bytes, width: int = VIDEO_WIDTH, height: int = VIDEO_HEIGHT) -> bytes:
    """Centre-crop to the target aspect ratio and resize; returns PNG bytes."""
    img = cv2.imdecode(np.frombuffer(image, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise AzureMediaError("Could not decode the start frame")
    h, w = img.shape[:2]
    target = width / height
    if w / h > target:
        crop = int(round(h * target))
        img = img[:, (w - crop) // 2:(w - crop) // 2 + crop]
    else:
        crop = int(round(w / target))
        img = img[(h - crop) // 2:(h - crop) // 2 + crop, :]
    ok, buf = cv2.imencode(".png", cv2.resize(img, (width, height), interpolation=cv2.INTER_AREA))
    if not ok:
        raise AzureMediaError("Could not encode the start frame")
    return buf.tobytes()


async def edit_image(prompt: str, images: list[bytes]) -> bytes:
    """gpt-image-1 edit of the first image (callers pass one); returns PNG bytes."""
    s = get_settings()
    url = (f"{_endpoint()}/openai/deployments/{s.azure_image_deployment_name}/images/edits"
           f"?api-version={s.azure_openai_api_version}")
    async with httpx.AsyncClient(timeout=300, headers=_headers()) as client:
        resp = await client.post(
            url,
            data={"prompt": prompt, "n": "1", "size": IMAGE_SIZE, "quality": "high"},
            files={"image": ("view.png", images[0], "image/png")},
        )
    if resp.status_code >= 400:
        raise _fail("image edit", resp)
    data = resp.json().get("data") or []
    if not data or not data[0].get("b64_json"):
        raise AzureMediaError("Azure returned no image")
    return base64.b64decode(data[0]["b64_json"])


async def image_to_video(prompt: str, start: bytes, end: bytes | None = None, duration: str = VIDEO_SECONDS) -> bytes:
    """Sora 2 video from a first frame; `end` is not supported and ignored. Returns MP4 bytes."""
    s = get_settings()
    base = f"{_endpoint()}/openai/v1/videos"
    async with httpx.AsyncClient(timeout=120, headers=_headers()) as client:
        resp = await client.post(
            base,
            data={"model": s.azure_video_deployment_name, "prompt": prompt,
                  "size": f"{VIDEO_WIDTH}x{VIDEO_HEIGHT}", "seconds": duration},
            files={"input_reference": ("start.png", fit_frame(start), "image/png")},
        )
        if resp.status_code >= 400:
            raise _fail("video submit", resp)
        video_id = resp.json().get("id")
        if not video_id:
            raise AzureMediaError("Azure video response had no id")

        async def check() -> dict | None:
            r = await client.get(f"{base}/{video_id}")
            if r.status_code >= 400:
                raise _fail("video status", r)
            job = r.json()
            if job.get("status") in ("failed", "cancelled"):
                err = job.get("error")
                reason = (err.get("message") if isinstance(err, dict) else err) or "no reason given"
                raise AzureMediaError(f"Azure video {job.get('status')}: {reason}")
            return job if job.get("status") == "completed" else None

        await poll(check, AzureMediaError, "Azure video", poll_seconds=10)
        resp = await client.get(f"{base}/{video_id}/content", timeout=300)
        if resp.status_code >= 400:
            raise _fail("video download", resp)
        return resp.content
