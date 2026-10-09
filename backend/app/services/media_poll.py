"""Shared polling loop for async media jobs (FAL queue, Azure Sora)."""
from __future__ import annotations

import asyncio
import time
from typing import Awaitable, Callable, TypeVar

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
