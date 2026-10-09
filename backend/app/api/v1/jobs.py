from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import deps
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.validation import validate_dxf_file, validate_image_file, validate_job_parameters
from app.models import Job, User, File as FileModel
from app.schemas.job import JobRead
from app.worker import process_job, process_job_async
from app.services.storage import storage_service
from app.services.llm import llm_service
from app.core.errors import CADLiftError
from app.pipelines.pdf_plan import apply_changes, pdf_to_glb, save_plan_outputs
from app.pipelines import render as render_pipeline
from app.services.storage import save_job_file

logger = get_logger("cadlift.jobs")
settings = get_settings()

router = APIRouter(prefix="/jobs", tags=["jobs"])


def serialize_job(job: Job) -> JobRead:
    
    def file_url(file_id: str | None) -> str | None:
        # Matches GET /api/v1/files/{file_id} (there is no /download suffix route).
        return f"{settings.api_v1_prefix}/files/{file_id}" if file_id else None

    params = job.params or {}
    download_url = file_url(job.output_file_id)
    dxf_id = params.get("dxf_file_id")
    step_id = params.get("step_file_id")
    dxf_url = file_url(dxf_id)
    step_url = file_url(step_id)
    glb_url = file_url(params.get("glb_file_id"))
    
    # Determine output name
    # Usually we don't store the exact output filename on the job model easily accessible
    # But job service often relies on the output_file's name or constructs it
    output_name = f"model.step" if step_id else "output"

    return JobRead(
        id=job.id,
        job_type=job.job_type,
        mode=job.mode,
        status=job.status,
        progress=job.progress,
        params=job.params,
        error_code=job.error_code,
        error_message=job.error_message,
        input_file_id=job.input_file_id,
        output_file_id=job.output_file_id,
        created_at=job.created_at,
        updated_at=job.updated_at,
        completed_at=job.completed_at,
        download_url=download_url,
        dxf_download_url=dxf_url,
        step_download_url=step_url,
        glb_download_url=glb_url,
        outputName=output_name
    )


@router.post("", response_model=JobRead, status_code=status.HTTP_201_CREATED)
async def create_job_endpoint(
    job_type: str = Form(...),
    mode: str = Form(...),
    params: str | None = Form(None),
    upload: UploadFile | None = File(None),
    session: AsyncSession = Depends(deps.get_db),
    user: User = Depends(deps.get_current_user),
):
    # Parse parameters
    job_params = {}
    if params:
        try:
            job_params = json.loads(params)
        except ValueError:
            raise HTTPException(status_code=400, detail="params must be valid JSON")

    # Phase 3.4: Validate parameters
    is_valid, error_msg = validate_job_parameters(job_type, job_params)
    if not is_valid:
        logger.warning("parameter_validation_failed", job_type=job_type, error=error_msg)
        raise HTTPException(status_code=400, detail=f"Invalid parameters: {error_msg}")

    job = Job(job_type=job_type, mode=mode, status="queued", params=job_params, user_id=user.id)
    session.add(job)
    await session.flush()

    max_bytes = int(settings.max_upload_mb * 1024 * 1024)
    # Allowed MIME types - browsers may report various types for DXF/DWG files
    allowed_mimes = {
        "application/dxf", 
        "image/vnd.dxf",
        "image/x-dxf",
        "application/x-dxf",
        "application/x-dwg",  # DWG files
        "image/vnd.dwg",
        "image/x-dwg",
        "application/acad",
        "application/autocad_dwg",
        "text/plain",  # Some browsers report DXF as text
        "application/octet-stream",  # Generic binary
        "image/png", 
        "image/jpeg", 
        "image/jpg",
        "application/pdf",
    }
    # Also allow by file extension for DXF/DWG
    cad_extensions = {".dxf", ".dwg", ".pdf"}
    image_extensions = {".png", ".jpg", ".jpeg"}

    if upload:
        filename_lower = (upload.filename or "").lower()
        file_ext = filename_lower[filename_lower.rfind("."):] if "." in filename_lower else ""
        
        # Check if MIME type is allowed OR file extension is allowed
        mime_allowed = upload.content_type in allowed_mimes
        ext_allowed = file_ext in cad_extensions or file_ext in image_extensions
        
        if not mime_allowed and not ext_allowed:
            logger.warning("unsupported_file_type", content_type=upload.content_type, filename=upload.filename)
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {upload.content_type}")

        # Phase 3.4: Validate uploaded file BEFORE saving
        file_data = await upload.read()
        await upload.seek(0)  # Reset for later reading

        # Validate based on file extension (more reliable than MIME type)
        is_dxf = file_ext == ".dxf"
        is_dwg = file_ext == ".dwg"
        is_image = file_ext in image_extensions
        
        if is_dxf:
            is_valid, error_msg = validate_dxf_file(file_data, upload.filename or "upload.dxf")
            if not is_valid:
                logger.warning("dxf_validation_failed", filename=upload.filename, error=error_msg)
                raise HTTPException(status_code=400, detail=f"Invalid DXF file: {error_msg}")
            logger.info("dxf_validation_passed", filename=upload.filename)
        
        elif is_dwg:
            # DWG files are validated during conversion in the pipeline
            logger.info("dwg_file_accepted", filename=upload.filename)

        elif file_ext == ".pdf":
            if not file_data.startswith(b"%PDF"):
                raise HTTPException(status_code=400, detail="Invalid PDF file: missing %PDF header")
            logger.info("pdf_file_accepted", filename=upload.filename)

        elif is_image:
            is_valid, error_msg = validate_image_file(file_data, upload.filename or "upload.png")
            if not is_valid:
                logger.warning("image_validation_failed", filename=upload.filename, error=error_msg)
                raise HTTPException(status_code=400, detail=f"Invalid image file: {error_msg}")
            logger.info("image_validation_passed", filename=upload.filename)

        # File is valid, proceed with storage
        try:
            storage_key, size = await storage_service.save_upload(
                upload, role="input", job_id=job.id, max_bytes=max_bytes
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        file_record = FileModel(
            user_id=None,
            job_id=job.id,
            role="input",
            storage_key=storage_key,
            original_name=upload.filename or "upload.bin",
            mime_type=upload.content_type,
            size_bytes=size,
        )
        session.add(file_record)
        await session.flush()
        job.input_file_id = file_record.id

    await session.commit()
    await session.refresh(job)
    logger.info(
        "Job queued",
        extra={
            "job_id": job.id,
            "job_type": job.job_type,
            "mode": job.mode,
            "input_file_id": job.input_file_id,
        },
    )
    if settings.enable_task_queue:
        process_job.delay(job.id)
    else:
        # Run in background - don't block the response
        import asyncio
        asyncio.create_task(process_job_async(job.id))
    return serialize_job(job)


@router.get("", response_model=list[JobRead])
async def list_jobs(
    session: AsyncSession = Depends(deps.get_db),
    user: User = Depends(deps.get_current_user)
):
    from datetime import datetime, timedelta
    
    # Auto-cleanup: mark stuck processing jobs as failed (older than 10 minutes)
    timeout_threshold = datetime.utcnow() - timedelta(minutes=10)
    stuck_jobs_result = await session.execute(
        select(Job).where(
            Job.status.in_(["processing", "queued"]),
            Job.updated_at < timeout_threshold
        )
    )
    stuck_jobs = stuck_jobs_result.scalars().all()
    for job in stuck_jobs:
        job.status = "failed"
        job.error_message = "Job timed out (stuck for more than 10 minutes)"
        logger.warning(f"Auto-marked stuck job {job.id} as failed")
    
    if stuck_jobs:
        await session.commit()
    
    result = await session.execute(
        select(Job).where(Job.user_id == user.id).order_by(Job.created_at.desc())
    )
    jobs = result.scalars().all()
    return [serialize_job(job) for job in jobs]


@router.get("/{job_id}", response_model=JobRead)
async def get_job(
    job_id: str,
    session: AsyncSession = Depends(deps.get_db),
    user: User = Depends(deps.get_current_user)
):
    result = await session.execute(select(Job).where(Job.id == job_id, Job.user_id == user.id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return serialize_job(job)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: str,
    session: AsyncSession = Depends(deps.get_db),
    user: User = Depends(deps.get_current_user)
):
    """Delete a job and its associated files."""
    result = await session.execute(select(Job).where(Job.id == job_id, Job.user_id == user.id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Delete associated files
    files_result = await session.execute(select(FileModel).where(FileModel.job_id == job_id))
    files = files_result.scalars().all()
    for file in files:
        try:
            storage_service.delete(file.storage_key)
        except Exception as e:
            logger.warning(f"Failed to delete file {file.storage_key}: {e}")
        await session.delete(file)
    
    await session.delete(job)
    await session.commit()
    logger.info(f"Deleted job {job_id} and {len(files)} associated files")


@router.post("/{job_id}/cancel", response_model=JobRead)
async def cancel_job(
    job_id: str,
    session: AsyncSession = Depends(deps.get_db),
    user: User = Depends(deps.get_current_user)
):
    """Cancel a running or queued job."""
    result = await session.execute(select(Job).where(Job.id == job_id, Job.user_id == user.id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.status in ("completed", "failed", "cancelled"):
        raise HTTPException(status_code=400, detail=f"Job is already {job.status}")
    
    job.status = "cancelled"
    job.error_message = "Job cancelled by user"
    await session.commit()
    logger.info(f"Cancelled job {job_id}")
    return serialize_job(job)


# ---- PDF plan chat editing ----------------------------------------------------

# ponytail: older versions are dropped from history but their files stay on disk until the job is deleted.
MAX_PLAN_VERSIONS = 20
MAX_PLAN_CHAT = 50


class PlanChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


async def _owned_job(session: AsyncSession, job_id: str, user: User) -> Job:
    result = await session.execute(select(Job).where(Job.id == job_id, Job.user_id == user.id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def _plan_params(job: Job) -> dict:
    params = dict(job.params or {})
    if not params.get("plan_spec"):
        raise HTTPException(status_code=400, detail="Chat editing is only available for PDF plan models")
    return params


def _set_plan_version(job: Job, params: dict, version: dict) -> None:
    params["plan_spec"] = version["spec"]
    params["pdf_plan"] = version["meta"]
    params["glb_file_id"] = version["glb_file_id"]
    job.output_file_id = version["glb_file_id"]
    job.params = params


@router.post("/{job_id}/chat")
async def chat_plan(
    job_id: str,
    payload: PlanChatRequest,
    session: AsyncSession = Depends(deps.get_db),
    user: User = Depends(deps.get_current_user),
):
    """Edit a PDF plan model in natural language; rebuilds the GLB when settings change."""
    job = await _owned_job(session, job_id, user)
    params = _plan_params(job)
    if not llm_service.enabled:
        raise HTTPException(
            status_code=503,
            detail="AI chat needs Azure OpenAI: set LLM_PROVIDER=azure and the AZURE_OPENAI_* variables",
        )

    message = payload.message.strip()
    history = list(params.get("plan_chat") or [])
    try:
        result = await llm_service.edit_plan_spec(params["plan_spec"], message, history)
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("plan_chat_llm_failed", job_id=job_id, error=str(exc))
        raise HTTPException(status_code=502, detail=f"AI request failed: {exc}") from exc

    new_spec, applied, skipped = apply_changes(params["plan_spec"], result["changes"])
    if applied:
        input_file = await session.get(FileModel, job.input_file_id) if job.input_file_id else None
        if not input_file:
            raise HTTPException(status_code=404, detail="Original PDF for this job is missing")
        try:
            glb_bytes, meta, new_spec = await asyncio.to_thread(
                pdf_to_glb, storage_service.resolve_path(input_file.storage_key), params, new_spec
            )
        except CADLiftError as exc:
            raise HTTPException(status_code=422, detail=f"Could not rebuild model: {exc}") from exc
        seq = int(params.get("plan_version_seq") or len(params.get("plan_versions") or [])) + 1
        glb_file = save_plan_outputs(session, job, glb_bytes, meta, version=seq)
        await session.flush()
        version = {"glb_file_id": glb_file.id, "spec": new_spec, "meta": meta, "note": message}
        params["plan_versions"] = (list(params.get("plan_versions") or []) + [version])[-MAX_PLAN_VERSIONS:]
        params["plan_version_seq"] = seq
        _set_plan_version(job, params, version)

    reply = result["reply"] or ("Done." if applied else "I could not find anything to change.")
    turn = [{"role": "user", "content": message}, {"role": "assistant", "content": reply}]
    params["plan_chat"] = (history + turn)[-MAX_PLAN_CHAT:]
    job.params = params
    await session.commit()
    await session.refresh(job)
    logger.info("plan_chat", job_id=job_id, applied=len(applied), skipped=len(skipped))
    return {"reply": reply, "applied": applied, "skipped": skipped, "job": serialize_job(job)}


@router.post("/{job_id}/chat/undo")
async def undo_plan_chat(
    job_id: str,
    session: AsyncSession = Depends(deps.get_db),
    user: User = Depends(deps.get_current_user),
):
    """Revert a PDF plan model to its previous version."""
    job = await _owned_job(session, job_id, user)
    params = _plan_params(job)
    versions = list(params.get("plan_versions") or [])
    if len(versions) < 2:
        raise HTTPException(status_code=400, detail="Nothing to undo")
    undone = versions.pop()
    params["plan_versions"] = versions
    params["plan_chat"] = (list(params.get("plan_chat") or []) + [
        {"role": "assistant", "content": f"Undid: {undone.get('note', 'last change')}"}
    ])[-MAX_PLAN_CHAT:]
    _set_plan_version(job, params, versions[-1])
    await session.commit()
    await session.refresh(job)
    return {"job": serialize_job(job)}


# ---- Render studio: photoreal images and videos of a model view -------------------

MAX_RENDERS = 30
MAX_ACTIVE_RENDERS = 2  # FAL video calls are slow and paid: cap in-flight work per job
MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024
RENDER_STALE_AFTER = timedelta(minutes=30)
_render_tasks: set[asyncio.Task] = set()  # strong refs so running tasks are not garbage collected


def _sweep_stale_renders(renders: list[dict]) -> list[dict]:
    """Fail renders stuck in processing (e.g. the server restarted mid-render)."""
    cutoff = datetime.now(timezone.utc) - RENDER_STALE_AFTER
    swept = []
    for render in renders:
        render = dict(render)
        created = datetime.fromisoformat(render["created_at"]) if render.get("created_at") else cutoff
        if render.get("status") == "processing" and created < cutoff:
            render.update(status="failed", stage=None, error="Render was interrupted. Please try again.")
        swept.append(render)
    return swept


def _render_slot(job: Job) -> tuple[dict, list[dict]]:
    """Params plus swept render history; 429 when the job already has its maximum running."""
    params = dict(job.params or {})
    renders = _sweep_stale_renders(list(params.get("renders") or []))
    if sum(r.get("status") == "processing" for r in renders) >= MAX_ACTIVE_RENDERS:
        raise HTTPException(status_code=429, detail="Two renders are already running. Wait for one to finish.")
    return params, renders


async def _launch_render(session: AsyncSession, job: Job, params: dict, renders: list[dict], render: dict, work) -> dict:
    """Append the render, commit, and start `work()` (a coroutine factory) in the background."""
    # ponytail: renders share job.params with plan chat; a chat edit landing mid-render can drop a render
    # update (last write wins). Move renders to their own table if that ever bites.
    # Trimmed renders keep their files on disk until the job is deleted (same as plan versions).
    params["renders"] = (renders + [render])[-MAX_RENDERS:]
    job.params = params
    await session.commit()
    await session.refresh(job)
    task = asyncio.create_task(work())
    _render_tasks.add(task)
    task.add_done_callback(_render_tasks.discard)
    logger.info("render_started", job_id=job.id, render_id=render["id"], kind=render["kind"])
    return {"render": render, "job": serialize_job(job)}


def _require_provider(kind: str) -> None:
    missing = render_pipeline.missing_provider(kind)
    if missing:
        raise HTTPException(status_code=503, detail=missing)


@router.post("/{job_id}/renders", status_code=status.HTTP_202_ACCEPTED)
async def create_render(
    job_id: str,
    snapshot: UploadFile = File(...),
    kind: str = Form("image"),
    style: str = Form("daylight"),
    prompt: str = Form("", max_length=500),
    session: AsyncSession = Depends(deps.get_db),
    user: User = Depends(deps.get_current_user),
):
    """Start a photoreal image, orbit video or construction timelapse from a viewer snapshot."""
    job = await _owned_job(session, job_id, user)
    if kind not in render_pipeline.KINDS:
        raise HTTPException(status_code=400, detail=f"kind must be one of {', '.join(render_pipeline.KINDS)}")
    _require_provider(kind)
    if style not in render_pipeline.STYLES:
        raise HTTPException(status_code=400, detail=f"style must be one of {', '.join(render_pipeline.STYLES)}")

    data = await snapshot.read(MAX_SNAPSHOT_BYTES + 1)
    if len(data) > MAX_SNAPSHOT_BYTES:
        raise HTTPException(status_code=400, detail="Snapshot is larger than 10 MB")
    is_valid, error_msg = validate_image_file(data, snapshot.filename or "snapshot.png")
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Invalid snapshot: {error_msg}")

    params, renders = _render_slot(job)
    render = render_pipeline.new_render(uuid4().hex[:12], kind, style, prompt.strip())
    snapshot_file = save_job_file(session, job, data, "render", f"render_{render['id']}_snapshot.png", "image/png")
    await session.flush()
    render["snapshot_file_id"] = snapshot_file.id
    return await _launch_render(session, job, params, renders, render, lambda: render_pipeline.run_render(
        job.id, render["id"], data, kind, style, render["prompt"]))


@router.post("/{job_id}/renders/{render_id}/derive", status_code=status.HTTP_202_ACCEPTED)
async def derive_from_render(
    job_id: str,
    render_id: str,
    kind: str = Form(...),
    prompt: str = Form("", max_length=500),
    session: AsyncSession = Depends(deps.get_db),
    user: User = Depends(deps.get_current_user),
):
    """From a finished render's photo: an explorable 3D world, a 3D object model, or an ambient sound loop."""
    job = await _owned_job(session, job_id, user)
    if kind not in render_pipeline.DERIVED_KINDS:
        raise HTTPException(status_code=400, detail=f"kind must be one of {', '.join(render_pipeline.DERIVED_KINDS)}")
    if kind == "object" and not prompt.strip():
        raise HTTPException(status_code=400, detail="Name the object to turn into 3D, e.g. sofa")
    _require_provider(kind)

    source = next((r for r in (job.params or {}).get("renders") or [] if r.get("id") == render_id), None)
    if source is None:
        raise HTTPException(status_code=404, detail="Render not found")
    if source.get("kind") not in render_pipeline.KINDS or source.get("status") != "completed" or not source.get("image_file_id"):
        raise HTTPException(status_code=400, detail="Start from a finished photo, video or construction render")
    photo_file = await session.get(FileModel, source["image_file_id"])
    if photo_file is None or photo_file.job_id != job.id:
        raise HTTPException(status_code=404, detail="The render's photo is missing")
    photo = storage_service.resolve_path(photo_file.storage_key).read_bytes()

    params, renders = _render_slot(job)
    render = render_pipeline.new_render(uuid4().hex[:12], kind, source.get("style", "daylight"), prompt.strip(), render_id)
    return await _launch_render(session, job, params, renders, render, lambda: render_pipeline.run_derived(
        job.id, render["id"], kind, photo, render["style"], render["prompt"]))


@router.delete("/{job_id}/renders/{render_id}")
async def delete_render(
    job_id: str,
    render_id: str,
    session: AsyncSession = Depends(deps.get_db),
    user: User = Depends(deps.get_current_user),
):
    """Remove a render and its files. Running renders cannot be deleted (their provider call is already paid)."""
    job = await _owned_job(session, job_id, user)
    params = dict(job.params or {})
    renders = list(params.get("renders") or [])
    render = next((r for r in renders if r.get("id") == render_id), None)
    if render is None:
        raise HTTPException(status_code=404, detail="Render not found")
    if render.get("status") == "processing":
        raise HTTPException(status_code=409, detail="This render is still running. Delete it when it finishes.")

    file_ids = [value for key, value in render.items() if key.endswith("_file_id") and value]
    for file_id in file_ids:
        record = await session.get(FileModel, file_id)
        if record is None or record.job_id != job.id:
            continue
        try:
            storage_service.delete(record.storage_key)
        except (OSError, ValueError) as exc:
            logger.warning("render_file_delete_failed", file_id=file_id, error=str(exc))
        await session.delete(record)

    params["renders"] = [r for r in renders if r.get("id") != render_id]
    job.params = params
    await session.commit()
    await session.refresh(job)
    logger.info("render_deleted", job_id=job_id, render_id=render_id, files=len(file_ids))
    return {"job": serialize_job(job)}
