"""Passwords, tokens, roles and throttling - stdlib + PyJWT only.

Kept in one module so every trust decision in the API is reviewable in one place.
"""
import contextvars
import hashlib
import hmac
import ipaddress
import logging
import os
import secrets
import threading
import time
from collections import deque
from collections.abc import Callable
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql import Select

from .config import get_settings
from .db import get_db
from .models import CareTeamMember, Patient, User

settings = get_settings()
logger = logging.getLogger("careflow.security")
audit_log = logging.getLogger("careflow.audit")
request_id: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")

_ISSUER, _AUDIENCE = "careflow-api", "careflow-web"
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_prefix}/auth/login", auto_error=False)

# --------------------------------------------------------------------------- passwords
# OWASP (2023+) floor for PBKDF2-HMAC-SHA256. Hashes stored with fewer rounds are
# upgraded transparently on the next successful login (see needs_rehash).
_ITERATIONS = 600_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return f"pbkdf2_sha256${_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt_hex, digest_hex = stored.split("$")
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iterations))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(digest.hex(), digest_hex)


def needs_rehash(stored: str) -> bool:
    try:
        return int(stored.split("$")[1]) < _ITERATIONS
    except (IndexError, ValueError):
        return True


# Verified against when the e-mail is unknown, so "no such account" costs the same
# time as "wrong password" and accounts cannot be enumerated by timing.
DUMMY_HASH = hash_password(secrets.token_hex(16))

# --------------------------------------------------------------------------- tokens
_revoked: dict[str, float] = {}  # jti -> exp (epoch seconds)
_revoked_lock = threading.Lock()
# ponytail: per-process deny-list; move to Redis when the API runs more than one worker.


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "iss": _ISSUER,
        "aud": _AUDIENCE,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_ttl_minutes),
        "jti": secrets.token_urlsafe(16),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _credentials_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience=_AUDIENCE,
            issuer=_ISSUER,
            options={"require": ["exp", "sub", "jti", "iss", "aud"]},
            leeway=10,
        )
    except jwt.PyJWTError:
        raise _credentials_error() from None
    if payload["jti"] in _revoked:
        raise _credentials_error()
    return payload


def revoke_token(payload: dict) -> None:
    now = time.time()
    with _revoked_lock:
        for jti, exp in [(j, e) for j, e in _revoked.items() if e < now]:
            del _revoked[jti]
        _revoked[payload["jti"]] = float(payload.get("exp", now))


def current_user(token: str | None = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    if not token:
        raise _credentials_error()
    payload = decode_token(token)
    try:
        user = db.get(User, int(payload["sub"]))
    except (TypeError, ValueError):
        raise _credentials_error() from None
    if user is None or not user.is_active:
        raise _credentials_error()
    return user


# --------------------------------------------------------------------------- roles
MANAGER, PHYSICIAN, NURSE = "manager", "physician", "nurse"
PATIENT_READERS = (MANAGER, PHYSICIAN, NURSE)  # IT sees aggregates only - no patient records


def require_role(*roles: str) -> Callable[..., User]:
    def dependency(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted for your role")
        return user

    return dependency


def patient_scope(query: Select, user: User) -> Select:
    """Staff attached to a department see that department's patients plus any patient
    whose care team they belong to. Hospital-wide roles (no department) see everything."""
    if user.role == MANAGER or user.department_id is None:
        return query
    on_team = select(CareTeamMember.patient_id).where(CareTeamMember.user_id == user.id)
    return query.where(or_(Patient.department_id == user.department_id, Patient.id.in_(on_team)))


def can_advance(user: User, owner_role: str) -> bool:
    """A physician may sign off any step; everyone else only steps their role owns."""
    return user.role == PHYSICIAN or user.role == owner_role


# --------------------------------------------------------------------------- throttling
class RateLimiter:
    """Sliding-window limiter: at most `limit` events per `window` seconds per key.

    ponytail: process-local dict; put a shared store (Redis) behind it when scaling out.
    """

    def __init__(self, limit: int, window: int) -> None:
        self.limit, self.window = limit, window
        self._events: dict[str, deque[float]] = {}
        self._lock = threading.Lock()
        self._ops = 0

    def _bucket(self, key: str, now: float) -> deque[float]:
        bucket = self._events.setdefault(key, deque())
        while bucket and bucket[0] <= now - self.window:
            bucket.popleft()
        self._ops += 1
        if self._ops % 1024 == 0:  # keep memory bounded: drop keys that went quiet
            for stale in [k for k, b in self._events.items() if not b]:
                del self._events[stale]
        return bucket

    def blocked(self, key: str) -> bool:
        with self._lock:
            return len(self._bucket(key, time.monotonic())) >= self.limit

    def record(self, key: str) -> bool:
        """Record one event; False when the key is over its limit."""
        with self._lock:
            bucket = self._bucket(key, time.monotonic())
            if len(bucket) >= self.limit:
                return False
            bucket.append(time.monotonic())
            return True

    def clear(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)


def client_ip(request: Request) -> str:
    """Peer address, or - behind exactly one trusted proxy - the address that proxy appended.

    The LAST X-Forwarded-For entry is the one our proxy wrote; earlier entries are client-supplied and
    spoofable, so using them would let anyone dodge rate limits. Anything unparsable falls back to the peer.
    """
    peer = request.client.host if request.client else "unknown"
    if settings.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for", "").split(",")[-1].strip()
        try:
            return str(ipaddress.ip_address(forwarded))
        except ValueError:
            pass
    return peer


def rate_limit(limit: int, window: int) -> Callable[..., None]:
    """FastAPI dependency: per-client-IP limit for one route."""
    limiter = RateLimiter(limit, window)

    def dependency(request: Request) -> None:
        if not limiter.record(client_ip(request)):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests",
                headers={"Retry-After": str(window)},
            )

    return dependency


def audit(event: str, **fields: object) -> None:
    """One structured line per security-relevant action. Ids only - never names, MRNs or message bodies."""
    audit_log.info("%s rid=%s %s", event, request_id.get(), " ".join(f"{k}={v}" for k, v in fields.items()))
