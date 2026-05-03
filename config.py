"""App settings from env vars."""

import os
from pathlib import Path
from dotenv import load_dotenv

_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(_env_path)


class Settings:


    # OpenRouter
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_BASE_URL: str = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./competeai.db")

    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")

    # CORS
    _raw_origins = [
        o.strip()
        for o in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if o.strip()
    ]
    # Auto-add Vercel deployment URLs
    _vercel_url = os.getenv("VERCEL_URL", "")
    if _vercel_url:
        _raw_origins.append(f"https://{_vercel_url}")
    _vercel_project = os.getenv("VERCEL_PROJECT_PRODUCTION_URL", "")
    if _vercel_project:
        _raw_origins.append(f"https://{_vercel_project}")
    CORS_ORIGINS: list[str] = _raw_origins

    # Rate limiting
    MAX_ANALYSES_PER_MINUTE: int = int(os.getenv("MAX_ANALYSES_PER_MINUTE", "10"))


settings = Settings()
