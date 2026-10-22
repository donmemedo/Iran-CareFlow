"""CareFlow Iran - FastAPI application entrypoint."""
import logging
import secrets
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from .config import get_settings
from .db import Base, SessionLocal, engine
from .routers import analytics, auth, integrations, overview, pathways, patients, public
from .security import request_id
from .seed import seed

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
settings = get_settings()
logger = logging.getLogger("careflow")

MAX_BODY_BYTES = 64 * 1024  # largest legitimate payload is a 2 000-char message


class HardeningMiddleware:
    """Pure-ASGI (no per-request thread hop) security headers + request body cap."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        headers = [
            (b"x-content-type-options", b"nosniff"),
            (b"referrer-policy", b"no-referrer"),
            (b"x-frame-options", b"DENY"),
            (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
        ]
        if settings.is_production:
            headers.append((b"strict-transport-security", b"max-age=31536000; includeSubDomains"))
        self.headers = headers
        self.api_headers = headers + [
            (b"cache-control", b"no-store"),  # never let a browser or proxy keep patient data
            (b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'"),
        ]
        self.api_prefix = settings.api_prefix

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        for name, value in scope.get("headers", []):
            if name == b"content-length" and value.isdigit() and int(value) > MAX_BODY_BYTES:
                await send({"type": "http.response.start", "status": 413, "headers": self.headers})
                await send({"type": "http.response.body", "body": b'{"detail":"Payload too large"}'})
                return
        extra = self.api_headers if scope["path"].startswith(self.api_prefix) else self.headers
        rid = secrets.token_hex(8)
        request_id.set(rid)  # audit lines carry it; the same value is returned for support / log correlation

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                message["headers"] = list(message.get("headers", [])) + extra + [(b"x-request-id", rid.encode())]
            await send(message)

        await self.app(scope, receive, send_with_headers)


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
    version="1.1.0",
    description=(
        "Operational intelligence layer for Iranian hospitals - care pathway "
        "standardisation, clinical collaboration and predictive capacity analytics."
    ),
    lifespan=lifespan,
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
)

# Middleware order: outermost first. Headers wrap everything; gzip sits inside so the
# compressed body is what gets the headers; CORS innermost so preflights are cheap.
app.add_middleware(HardeningMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1024)
if settings.cors_origin_list:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,  # explicit allow-list, never "*"
        allow_credentials=False,  # bearer tokens, not cookies
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        max_age=600,
    )
else:
    logger.warning("CORS_ORIGINS is empty - browsers on other origins cannot call this API")

for module in (auth, overview, analytics, patients, pathways, integrations, public):
    app.include_router(module.router, prefix=settings.api_prefix)


@app.get("/health", tags=["system"])
@app.get(f"{settings.api_prefix}/health", tags=["system"])
def health() -> dict:
    return {"status": "ok", "service": "careflow-api"}
