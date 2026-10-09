"""
Render studio: turns a snapshot of the 3D viewer into a photoreal image, a camera-move video,
or a construction timelapse video (empty site to finished building). Photos and videos each run
on Azure OpenAI (gpt-image-1, Sora 2) when configured, else FAL (image-blaster's models); see
image_backend / video_backend. Renders live in job.params["renders"]; each runs as a background task.

Kinds:
  image         snapshot -> photoreal still
  video         snapshot -> photoreal still -> slow orbit video
  construction  snapshot -> photoreal still -> same view as an early construction site,
                then a video whose first frame is the site and (on FAL) last frame is the finished building
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.db.session import AsyncSessionLocal
from app.models import Job
from app.core.config import get_settings
from app.services import azure_media, fal
from app.services.storage import save_job_file

logger = logging.getLogger("cadlift.pipelines.render")

STYLES = {
    "daylight": "bright natural daylight, clear sky, soft realistic shadows",
    "golden_hour": "warm golden hour sunlight, long soft shadows, glowing sky",
    "night": "blue hour at dusk, warm interior lights glowing through the windows, exterior lighting",
    "interior": "interior architectural photography, soft daylight through windows, furnished and lived in",
    "overcast": "soft overcast light, muted tones, no harsh shadows",
}
KINDS = ("image", "video", "construction")

PHOTO_PROMPT = (
    "Turn this untextured 3D CAD render into a photorealistic architectural photograph. "
    "Keep the exact camera angle, geometry, proportions, openings and layout; do not add or remove building parts. "
    "Replace the flat colours with realistic materials (concrete, plaster, glass, timber, metal, flooring) "
    "and add fitting surroundings (ground, landscaping, sky). Lighting: {style}."
)
SITE_PROMPT = (
    "Same camera angle, same framing and the same building footprint, but show the plot as an active "
    "construction site at the very start of construction: excavated ground, foundation slab with rebar, "
    "formwork, scaffolding, a tower crane, construction workers and machinery. No finished walls or roof. "
    "Photorealistic, matching lighting."
)
MOTION_PROMPTS = {
    "video": "Slow, smooth cinematic camera orbit around the building, steady movement, photorealistic architectural film.",
    "construction": (
        "Construction timelapse with a static camera: the building rises from the foundation to the finished "
        "structure, floors, walls, windows and finishes appear stage by stage, cranes and workers move, clouds race."
    ),
}


def _backend(capability: str):
    """Provider module for "image" or "video": Azure when configured, else FAL (unless RENDER_PROVIDER forces one)."""
    choice = get_settings().render_provider
    for module in (azure_media, fal):
        if choice in ("auto", module.NAME) and getattr(module, f"{capability}_enabled")():
            return module
    return None


def image_backend():
    return _backend("image")


def video_backend():
    return _backend("video")


def _require(backend, what: str):
    if backend is None:
        raise RuntimeError(f"No {what} provider is configured")
    return backend


def photo_prompt(style: str, extra: str = "") -> str:
    prompt = PHOTO_PROMPT.format(style=STYLES[style])
    return f"{prompt} {extra.strip()}" if extra.strip() else prompt


def new_render(render_id: str, kind: str, style: str, prompt: str) -> dict:
    return {
        "id": render_id,
        "kind": kind,
        "style": style,
        "prompt": prompt,
        "status": "processing",
        "stage": "photo",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


async def _patch(job_id: str, render_id: str, fields: dict, files: dict | None = None) -> None:
    """Reload the job, store `files` ({field: (bytes, filename, mime)}) and merge `fields` into the render."""
    async with AsyncSessionLocal() as session:
        job = await session.get(Job, job_id)
        if not job:
            return  # job deleted while rendering
        params = dict(job.params or {})
        renders = [dict(r) for r in params.get("renders") or []]
        render = next((r for r in renders if r.get("id") == render_id), None)
        if render is None:
            return  # trimmed from history
        for field, (data, filename, mime) in (files or {}).items():
            record = save_job_file(session, job, data, "render", filename, mime)
            await session.flush()
            render[field] = record.id
        render.update(fields)
        params["renders"] = renders
        job.params = params
        await session.commit()


async def run_render(job_id: str, render_id: str, snapshot: bytes, kind: str, style: str, prompt: str = "") -> None:
    """Background task; never raises. Failures land on the render as status=failed."""
    # ponytail: lives in the API process, so a restart orphans in-flight renders (see sweep in jobs API).
    try:
        images = _require(image_backend(), "image")
        videos = _require(video_backend(), "video") if kind != "image" else None
        providers = {"image": images.NAME, **({"video": videos.NAME} if videos else {})}
        photo = await images.edit_image(photo_prompt(style, prompt), [snapshot])
        photo_file = {"image_file_id": (photo, f"render_{render_id}.png", "image/png")}
        if kind == "image":
            await _patch(job_id, render_id, {"status": "completed", "stage": None, "providers": providers}, photo_file)
            return

        start, end = photo, None
        if kind == "construction":
            await _patch(job_id, render_id, {"stage": "site"}, photo_file)
            site = await images.edit_image(SITE_PROMPT, [photo])
            await _patch(job_id, render_id, {"stage": "video"},
                         {"start_image_file_id": (site, f"render_{render_id}_site.png", "image/png")})
            start, end = site, photo
        else:
            await _patch(job_id, render_id, {"stage": "video"}, photo_file)

        motion = MOTION_PROMPTS[kind] + (f" {prompt.strip()}" if prompt.strip() else "")
        video = await videos.image_to_video(motion, start, end)
        await _patch(job_id, render_id, {"status": "completed", "stage": None, "providers": providers},
                     {"video_file_id": (video, f"render_{render_id}.mp4", "video/mp4")})
    except Exception as exc:  # noqa: BLE001 - background task: record, do not crash the loop
        logger.exception("render_failed", extra={"job_id": job_id, "render_id": render_id})
        try:
            await _patch(job_id, render_id, {"status": "failed", "stage": None, "error": str(exc)[:300]})
        except Exception:  # noqa: BLE001
            logger.exception("render_failure_not_recorded", extra={"job_id": job_id, "render_id": render_id})
