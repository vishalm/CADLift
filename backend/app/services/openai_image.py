"""
Azure OpenAI image generation service (text → image bytes).

Uses an Azure OpenAI image deployment (e.g. gpt-image-1) to generate a reference image
for downstream 3D reconstruction (e.g., TripoSG).
"""
from __future__ import annotations

import base64
import logging
from typing import Optional

from app.core.config import get_settings

logger = logging.getLogger("cadlift.services.openai_image")

try:  # optional dependency
    from openai import AzureOpenAI  # type: ignore
    _OPENAI_AVAILABLE = True
except ImportError:  # pragma: no cover
    _OPENAI_AVAILABLE = False


class OpenAIImageError(Exception):
    """Azure OpenAI image generation error."""


class OpenAIImageService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.enabled = False
        s = self.settings
        if not (s.azure_openai_api_key and s.azure_openai_endpoint and s.azure_image_deployment_name):
            logger.warning(
                "Azure OpenAI image service disabled: AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT "
                "or AZURE_IMAGE_DEPLOYMENT_NAME missing"
            )
            return
        if not _OPENAI_AVAILABLE:
            logger.warning("Azure OpenAI image service disabled: openai package not installed")
            return

        self.enabled = True
        masked_key = f"{s.azure_openai_api_key[:6]}...{s.azure_openai_api_key[-4:]}"
        logger.info(
            "Azure OpenAI image service initialized",
            extra={
                "deployment": s.azure_image_deployment_name,
                "size": "1024x1024",
                "quality": "high",
                "key": masked_key,
            },
        )

    def is_available(self) -> bool:
        return self.enabled

    def generate_image(
        self,
        prompt: str,
        *,
        size: str = "1024x1024",
        quality: str = "high",
    ) -> bytes:
        """
        Generate an image from text using the Azure OpenAI image deployment.

        Returns:
            Image bytes.
        """
        if not self.enabled:
            raise OpenAIImageError("Azure OpenAI image service not enabled or missing dependencies.")

        s = self.settings
        try:
            client = AzureOpenAI(
                api_key=s.azure_openai_api_key,
                azure_endpoint=s.azure_openai_endpoint,
                api_version=s.azure_openai_api_version,
            )
            result = client.images.generate(
                model=s.azure_image_deployment_name,
                prompt=prompt,
                size=size,
                quality=quality,
            )
            data = result.data or []
            if not data:
                raise OpenAIImageError("No image data returned from Azure OpenAI.")
            b64 = data[0].b64_json
            if not b64:
                raise OpenAIImageError("Empty image payload from Azure OpenAI.")
            return base64.b64decode(b64)
        except Exception as exc:  # pragma: no cover - network/runtime errors
            logger.error(f"Azure OpenAI image generation failed: {exc}")
            raise OpenAIImageError(str(exc))


_service: Optional[OpenAIImageService] = None


def get_openai_image_service() -> OpenAIImageService:
    global _service
    if _service is None:
        _service = OpenAIImageService()
    return _service
