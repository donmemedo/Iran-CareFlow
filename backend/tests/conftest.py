"""Test harness: isolated throw-away database, deterministic settings, one shared app instance.

Environment is set BEFORE the app is imported - settings and the engine are created at import time.
"""
import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="careflow-test-")
os.environ.update(
    APP_ENV="development",
    DATABASE_URL=f"sqlite:///{_tmp}/test.db",
    JWT_SECRET="test-secret-0123456789-0123456789-0123456789",
    CORS_ORIGINS="http://localhost:3000",
    SEED_ON_STARTUP="true",
    DEMO_MODE="true",
    DEMO_PASSWORD="careflow",
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

API = "/api/v1"


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def login(client):
    cache: dict[str, dict[str, str]] = {}

    def _login(email: str) -> dict[str, str]:
        if email not in cache:  # one real login per account keeps us far below the login throttle
            r = client.post(f"{API}/auth/login", json={"email": email, "password": "careflow"})
            assert r.status_code == 200, r.text
            cache[email] = {"Authorization": f"Bearer {r.json()['access_token']}"}
        return cache[email]

    return _login


@pytest.fixture(scope="session")
def auth(login):
    return login("manager@careflow.ir")
