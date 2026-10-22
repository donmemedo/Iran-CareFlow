"""Security + performance regression suite. Every test asserts a control still holds."""
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from sqlalchemy import event, func, select

from app.config import Settings, get_settings
from app.db import SessionLocal, engine
from app.models import Lead
from app import security
from app.security import RateLimiter, hash_password, needs_rehash, verify_password

API = "/api/v1"
SECRET = get_settings().jwt_secret


def _token(secret=SECRET, algorithm="HS256", **overrides):
    now = datetime.now(timezone.utc)
    claims = {
        "sub": "1", "role": "manager", "iss": "careflow-api", "aud": "careflow-web",
        "iat": now, "exp": now + timedelta(minutes=5), "jti": "t-" + algorithm, **overrides,
    }
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, secret, algorithm=algorithm)


# ------------------------------------------------------------------ config: fail closed
def test_production_refuses_a_weak_secret():
    with pytest.raises(RuntimeError):
        Settings(app_env="production", jwt_secret="change-me-in-production", seed_on_startup=False, demo_mode=False)


def test_production_refuses_demo_flags():
    with pytest.raises(RuntimeError):
        Settings(app_env="production", jwt_secret="x" * 40, seed_on_startup=True, demo_mode=False)


def test_development_never_signs_with_a_guessable_secret():
    s = Settings(app_env="development", jwt_secret="careflow-dev-secret-change-me")
    assert len(s.jwt_secret) >= 32 and s.jwt_secret != "careflow-dev-secret-change-me"


def test_docs_are_off_in_production():
    assert Settings(app_env="production", jwt_secret="x" * 40, seed_on_startup=False, demo_mode=False).docs_enabled is False


# ------------------------------------------------------------------ tokens
@pytest.mark.parametrize(
    "bad",
    [
        _token(secret="attacker-secret-0123456789-0123456789-0123"),  # forged signature
        _token(exp=datetime.now(timezone.utc) - timedelta(minutes=1)),  # expired
        _token(jti=None),  # no jti -> cannot be revoked, so not accepted
        _token(aud="another-service"),  # token minted for a different audience
        _token(iss="somebody-else"),  # token from a different issuer
        _token(secret="x" * 48, algorithm="HS384"),  # algorithm not on the allow-list
        jwt.encode(
            {"sub": "1", "jti": "n", "iss": "careflow-api", "aud": "careflow-web", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
            "", algorithm="none",
        ),
        "not.a.jwt",
    ],
)
def test_bad_tokens_are_rejected(client, bad):
    assert client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {bad}"}).status_code == 401


def test_logout_revokes_the_token(client):
    r = client.post(f"{API}/auth/login", json={"email": "records@careflow.ir", "password": "careflow"})
    headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
    assert client.get(f"{API}/auth/me", headers=headers).status_code == 200
    assert client.post(f"{API}/auth/logout", headers=headers).status_code == 204
    assert client.get(f"{API}/auth/me", headers=headers).status_code == 401


# ------------------------------------------------------------------ login abuse
def test_unknown_account_and_wrong_password_are_indistinguishable(client):
    unknown = client.post(f"{API}/auth/login", json={"email": "nobody@careflow.ir", "password": "nope"})
    wrong = client.post(f"{API}/auth/login", json={"email": "manager@careflow.ir", "password": "nope"})
    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json() == wrong.json()


def test_repeated_failures_lock_the_account_for_that_client(client):
    body = {"email": "nurse.jafari@careflow.ir", "password": "wrong"}
    assert [client.post(f"{API}/auth/login", json=body).status_code for _ in range(5)] == [401] * 5
    locked = client.post(f"{API}/auth/login", json={**body, "password": "careflow"})  # even the right password
    assert locked.status_code == 429 and locked.headers["retry-after"]


def test_oversized_password_is_rejected_before_hashing(client):
    r = client.post(f"{API}/auth/login", json={"email": "manager@careflow.ir", "password": "a" * 5000})
    assert r.status_code == 422


# ------------------------------------------------------------------ authorisation
def test_it_role_sees_aggregates_but_no_patient_records(client, login):
    it = login("it@careflow.ir")
    assert client.get(f"{API}/overview", headers=it).status_code == 200
    assert client.get(f"{API}/pathways", headers=it).status_code == 200
    assert client.get(f"{API}/patients", headers=it).status_code == 403
    assert client.get(f"{API}/patients/1", headers=it).status_code == 403
    assert client.get(f"{API}/pathways/1/board", headers=it).status_code == 403


def test_clinicians_only_see_their_scope_and_cannot_probe_other_ids(client, login, auth):
    everyone = {p["id"] for p in client.get(f"{API}/patients?limit=500", headers=auth).json()}
    mine = {p["id"] for p in client.get(f"{API}/patients?limit=500", headers=login("nurse@careflow.ir")).json()}
    assert mine and mine < everyone, "nurse must see a strict subset"
    outsider = sorted(everyone - mine)[0]
    nurse = login("nurse@careflow.ir")
    assert client.get(f"{API}/patients/{outsider}", headers=nurse).status_code == 404
    assert client.get(f"{API}/patients/{outsider}/messages", headers=nurse).status_code == 404
    assert client.post(f"{API}/patients/{outsider}/messages", headers=nurse, json={"body": "x"}).status_code == 404


def test_a_nurse_cannot_complete_a_physician_step(client, login):
    nurse = login("nurse@careflow.ir")
    for p in client.get(f"{API}/patients?status=active&limit=100", headers=nurse).json():
        detail = client.get(f"{API}/patients/{p['id']}", headers=nurse).json()
        step = next((s for s in detail["steps"] if s["status"] == "active" and s["owner_role"] == "physician"), None)
        if step:
            r = client.post(f"{API}/patients/{p['id']}/steps/{step['id']}/advance", headers=nurse)
            assert r.status_code == 403
            return
    pytest.skip("no physician-owned active step in the nurse's scope")


def test_steps_cannot_be_completed_out_of_order(client, login):
    physician = login("physician@careflow.ir")
    for p in client.get(f"{API}/patients?status=active&limit=100", headers=physician).json():
        detail = client.get(f"{API}/patients/{p['id']}", headers=physician).json()
        pending = next((s for s in detail["steps"] if s["status"] == "pending"), None)
        if pending:
            assert client.post(f"{API}/patients/{p['id']}/steps/{pending['id']}/advance", headers=physician).status_code == 409
            return
    pytest.skip("no pending step available")


# ------------------------------------------------------------------ input handling
def test_message_kind_and_length_are_validated(client, auth):
    pid = client.get(f"{API}/patients?limit=1", headers=auth).json()[0]["id"]
    assert client.post(f"{API}/patients/{pid}/messages", headers=auth, json={"body": "x", "kind": "root"}).status_code == 422
    assert client.post(f"{API}/patients/{pid}/messages", headers=auth, json={"body": "x" * 2001}).status_code == 422


@pytest.mark.parametrize("q", ["' OR 1=1 --", "%", "_", "'; DROP TABLE patients; --"])
def test_search_input_is_treated_as_data(client, auth, q):
    r = client.get(f"{API}/patients", params={"q": q}, headers=auth)
    assert r.status_code == 200 and r.json() == []
    assert client.get(f"{API}/patients?limit=1", headers=auth).json(), "table must still exist"


def test_list_limit_is_bounded(client, auth):
    assert client.get(f"{API}/patients?limit=100000", headers=auth).status_code == 422


# ------------------------------------------------------------------ HTTP hardening
def test_api_responses_carry_security_headers(client):
    h = client.get(f"{API}/health").headers
    assert h["x-content-type-options"] == "nosniff"
    assert h["x-frame-options"] == "DENY"
    assert h["cache-control"] == "no-store"
    assert "default-src 'none'" in h["content-security-policy"]


def test_cors_allows_only_the_configured_origin(client):
    ask = {"Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization"}
    evil = client.options(f"{API}/overview", headers={"Origin": "https://evil.example", **ask})
    assert "access-control-allow-origin" not in evil.headers
    ok = client.options(f"{API}/overview", headers={"Origin": "http://localhost:3000", **ask})
    assert ok.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "access-control-allow-credentials" not in ok.headers


def test_oversized_bodies_are_refused(client):
    r = client.post(f"{API}/roi/calculate", content=b"x" * 70_000, headers={"Content-Type": "application/json"})
    assert r.status_code == 413


# ------------------------------------------------------------------ public-endpoint abuse
def test_lead_honeypot_stores_nothing_and_flooding_is_throttled(client):
    def leads() -> int:
        with SessionLocal() as db:
            return db.execute(select(func.count()).select_from(Lead)).scalar_one()

    before = leads()
    bot = {"full_name": "Bot Bot", "organization": "Spam Ltd", "email": "bot@example.com", "website": "http://spam"}
    assert client.post(f"{API}/leads", json=bot).status_code == 201
    assert leads() == before
    codes = [client.post(f"{API}/leads", json={**bot, "website": ""}).status_code for _ in range(8)]
    assert 429 in codes, "flood must be throttled"


def test_rate_limiter_window():
    rl = RateLimiter(limit=2, window=60)
    assert [rl.record("k"), rl.record("k"), rl.record("k"), rl.record("other")] == [True, True, False, True]
    rl.clear("k")
    assert rl.record("k")


# ------------------------------------------------------------------ passwords
def test_legacy_hashes_verify_and_are_flagged_for_upgrade():
    import hashlib

    salt = b"0123456789abcdef"
    legacy = f"pbkdf2_sha256$120000${salt.hex()}${hashlib.pbkdf2_hmac('sha256', b'pw', salt, 120_000).hex()}"
    assert verify_password("pw", legacy) and not verify_password("no", legacy)
    assert needs_rehash(legacy) and not needs_rehash(hash_password("pw"))


def test_demo_users_endpoint_follows_demo_mode(client):
    assert len(client.get(f"{API}/auth/demo-users").json()) == 4


# ------------------------------------------------------------------ performance guards (no N+1)
class _Counter:
    def __enter__(self):
        self.n = 0
        event.listen(engine, "before_cursor_execute", self._hit)
        return self

    def _hit(self, *_):
        self.n += 1

    def __exit__(self, *_):
        event.remove(engine, "before_cursor_execute", self._hit)


@pytest.mark.parametrize(
    ("path", "budget"),
    [("/patients?limit=300", 6), ("/overview", 8), ("/departments", 4), ("/pathways", 8), ("/analytics/resource-demand", 4)],
)
def test_endpoints_stay_within_a_query_budget(client, auth, path, budget):
    with _Counter() as c:
        assert client.get(f"{API}{path}", headers=auth).status_code == 200
    assert c.n <= budget, f"{path} issued {c.n} statements (budget {budget}) - N+1 regression?"


# ------------------------------------------------------------------ added after the skill review
@pytest.mark.parametrize(
    ("path", "body"),
    [
        ("/auth/login", {"email": "manager@careflow.ir", "password": "x", "role": "manager"}),
        ("/roi/calculate", {"beds": 100, "is_admin": True}),
    ],
)
def test_unknown_fields_are_rejected_not_ignored(client, path, body):
    assert client.post(f"{API}{path}", json=body).status_code == 422


def test_every_response_carries_a_server_generated_request_id(client):
    a = client.get(f"{API}/health", headers={"X-Request-ID": "evil\ninjected"})
    b = client.get(f"{API}/health")
    assert a.headers["x-request-id"] != "evil\ninjected"
    assert len(a.headers["x-request-id"]) == 16 and a.headers["x-request-id"] != b.headers["x-request-id"]


def test_forwarded_for_is_only_trusted_when_configured_and_uses_the_proxy_entry(monkeypatch):
    from starlette.requests import Request

    def make(xff: str) -> Request:
        return Request({"type": "http", "headers": [(b"x-forwarded-for", xff.encode())], "client": ("10.0.0.5", 1234)})

    spoofed = "6.6.6.6, 203.0.113.9"  # attacker prepends 6.6.6.6; our proxy appended 203.0.113.9
    assert security.client_ip(make(spoofed)) == "10.0.0.5"  # not trusted by default
    monkeypatch.setattr(security.settings, "trust_proxy_headers", True)
    assert security.client_ip(make(spoofed)) == "203.0.113.9"
    assert security.client_ip(make("not-an-ip")) == "10.0.0.5"
