"""Application settings for the CareFlow Iran backend."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "CareFlow Iran API"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./careflow.db"
    jwt_secret: str = "careflow-dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 60 * 12
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    seed_on_startup: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
