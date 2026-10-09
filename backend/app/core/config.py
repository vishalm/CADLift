from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import List, Literal


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")
    app_name: str = "CADLift Backend"
    api_v1_prefix: str = "/api/v1"
    environment: str = "development"
    debug: bool = True
    database_url: str = "sqlite+aiosqlite:///./cadlift.db"
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_minutes: int = 60 * 24 * 7
    storage_path: str = "./storage"
    log_level: str = "INFO"
    redis_url: str = "redis://localhost:6379/0"
    enable_task_queue: bool = True
    llm_provider: str = "none"  # options: none, azure
    # Azure OpenAI: deployment names are what you named them in Azure AI Foundry
    azure_openai_endpoint: str | None = None  # e.g. https://<resource>.openai.azure.com
    azure_openai_api_key: str | None = None
    azure_openai_api_version: str = "2025-04-01-preview"
    azure_deployment_name: str = "gpt-5-mini"  # chat / prompt-to-CAD
    azure_vision_deployment_name: str | None = None  # blueprint analysis; defaults to azure_deployment_name
    azure_image_deployment_name: str | None = None  # e.g. gpt-image-1; image path disabled if unset
    llm_timeout_seconds: float = 30.0
    # Render studio: photoreal images and videos of a model view. Photos and videos each use Azure OpenAI
    # when its deployment is set (AZURE_IMAGE_DEPLOYMENT_NAME / AZURE_VIDEO_DEPLOYMENT_NAME), else FAL.
    render_provider: Literal["auto", "azure", "fal"] = "auto"  # force one provider instead of auto
    render_timeout_seconds: float = 900.0  # video generation takes minutes
    azure_video_deployment_name: str | None = None  # e.g. sora-2; Azure video disabled if unset
    # FAL (same provider and models as image-blaster)
    fal_key: str | None = None
    fal_image_endpoint: str = "fal-ai/nano-banana-2/edit"
    fal_video_endpoint: str = "fal-ai/kling-video/v2.5-turbo/pro/image-to-video"
    vision_api_url: str | None = None
    vision_api_key: str | None = None
    vision_timeout_seconds: float = 30.0
    max_upload_mb: int = 25
    
    # CORS Configuration - Environment-based security
    # In production, set CORS_ORIGINS to specific allowed domains
    # Example: CORS_ORIGINS=https://cadlift.com,https://app.cadlift.com
    cors_origins: str = "*"  # Comma-separated list or "*" for dev
    cors_allow_credentials: bool = True
    cors_allow_methods: str = "GET,POST,PUT,DELETE,OPTIONS,PATCH"
    cors_allow_headers: str = "Authorization,Content-Type,X-Request-ID"
    cors_expose_headers: str = "Content-Disposition,Content-Length,X-Request-ID"
    
    # Stable Diffusion (local) for cost-free image generation
    enable_stable_diffusion: bool = False
    stable_diffusion_model: str = "runwayml/stable-diffusion-v1-5"
    stable_diffusion_device: str | None = None  # auto-select if None
    stable_diffusion_height: int = 640
    stable_diffusion_width: int = 640
    stable_diffusion_steps: int = 30
    stable_diffusion_guidance: float = 7.5
    
    # OpenSCAD configuration for precision CAD
    openscad_path: str | None = None  # Auto-detect if None
    enable_precision_cad: bool = True
    
    # CAD Engine selection: "auto", "cadquery", "solidpython"
    # - auto: Use CadQuery if available, else SolidPython
    # - cadquery: B-Rep modeling with true curves (requires conda install)
    # - solidpython: Mesh-based modeling (fast, always available)
    cad_engine: str = "solidpython"

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins from comma-separated string to list."""
        if self.cors_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
    
    @property
    def cors_methods_list(self) -> List[str]:
        """Parse CORS methods from comma-separated string to list."""
        return [method.strip() for method in self.cors_allow_methods.split(",") if method.strip()]
    
    @property
    def cors_headers_list(self) -> List[str]:
        """Parse CORS headers from comma-separated string to list."""
        return [header.strip() for header in self.cors_allow_headers.split(",") if header.strip()]
    
    @property
    def cors_expose_headers_list(self) -> List[str]:
        """Parse CORS expose headers from comma-separated string to list."""
        return [header.strip() for header in self.cors_expose_headers.split(",") if header.strip()]
    
    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment.lower() in ("production", "prod")


@lru_cache()
def get_settings() -> Settings:
    return Settings()
