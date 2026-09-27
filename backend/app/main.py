"""CareFlow Iran - FastAPI application entrypoint."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import Base, SessionLocal, engine
from .routers import analytics, auth, integrations, overview, pathways, patients, public
from .seed import seed

settings = get_settings()
logger = logging.getLogger("careflow")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    if settings.seed_on_startup:
        with SessionLocal() as db:
            seed(db)
        logger.info("demo dataset ready")
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "Operational intelligence layer for Iranian hospitals - care pathway "
        "standardisation, clinical collaboration and predictive capacity analytics."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (auth, overview, analytics, patients, pathways, integrations, public):
    app.include_router(module.router, prefix=settings.api_prefix)


@app.get("/health", tags=["system"])
@app.get(f"{settings.api_prefix}/health", tags=["system"])
def health() -> dict:
    return {"status": "ok", "service": "careflow-api", "version": "1.0.0"}
