"""Shared helpers for async media providers (FAL, Azure, World Labs): poll a job, download its output."""
from __future__ import annotations

import asyncio
import time
from typing import Awaitable, Callable, TypeVar

import httpx

from app.core.config import get_settings

T = TypeVar("T")


async def poll(
    check: Callable[[], Awaitable[T | None]],
    error: type[Exception],
    label: str,
    poll_seconds: float = 5.0,
) -> T:
    """Call `check` until it returns non-None; raise `error` after RENDER_TIMEOUT_SECONDS."""
    timeout = get_settings().render_timeout_seconds
    deadline = time.monotonic() + timeout
    while True:
        result = await check()
        if result is not None:
            return result
        if time.monotonic() > deadline:
            raise error(f"{label} timed out after {timeout:.0f}s")
        await asyncio.sleep(poll_seconds)


async def download(url: str, error: type[Exception], timeout: float = 600) -> bytes:
    """Fetch a provider output file (follows redirects); raises `error` on HTTP failure."""
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        resp = await client.get(url)
    if resp.status_code >= 400:
        raise error(f"Download failed ({resp.status_code})")
    return resp.content
