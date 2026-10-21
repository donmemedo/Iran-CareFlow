"""Application settings for the CareFlow Iran backend."""
import logging
import secrets
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("careflow")

# Values that appear in docs, examples or old builds. A token signed with any of
# these can be forged by anyone who has read the repository.
_KNOWN_WEAK_SECRETS = {"", "secret", "changeme", "change-me-in-production", "careflow-dev-secret-change-me"}
_MIN_SECRET_LENGTH = 32


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "CareFlow Iran API"
    app_env: str = "development"  # development | production
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./careflow.db"
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 60
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    seed_on_startup: bool = False
    demo_mode: bool = False  # exposes /auth/demo-users for the sign-in screen
    demo_password: str = "careflow"  # only used when SEED_ON_STARTUP seeds the demo accounts
    trust_proxy_headers: bool = False  # honour X-Forwarded-For (only behind your own proxy)

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in ("production", "prod")

    @property
    def docs_enabled(self) -> bool:
        return not self.is_production

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @model_validator(mode="after")
    def _fail_closed(self) -> "Settings":
        if self.jwt_secret in _KNOWN_WEAK_SECRETS or len(self.jwt_secret) < _MIN_SECRET_LENGTH:
            if self.is_production:
                raise RuntimeError(
                    "JWT_SECRET is missing or weak. Set at least 32 random characters, e.g. "
                    "python3 -c \"import secrets; print(secrets.token_urlsafe(48))\""
                )
            # Development: never sign with a guessable value - mint one per process instead.
            self.jwt_secret = secrets.token_urlsafe(48)
            logger.warning("JWT_SECRET missing or weak; using an ephemeral secret (tokens reset on restart)")
        if self.is_production and (self.seed_on_startup or self.demo_mode):
            raise RuntimeError("SEED_ON_STARTUP and DEMO_MODE must be false in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
