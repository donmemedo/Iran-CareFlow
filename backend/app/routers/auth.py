"""Authentication endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import User
from ..schemas import LoginRequest, TokenOut, UserOut
from ..security import (
    DUMMY_HASH,
    RateLimiter,
    audit,
    client_ip,
    create_access_token,
    current_user,
    decode_token,
    hash_password,
    needs_rehash,
    oauth2_scheme,
    rate_limit,
    revoke_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# Brute-force control. Keyed by (client, e-mail) so an attacker cannot lock a real user
# out from another address. ponytail: process-local, share via Redis when scaling out.
_failures = RateLimiter(limit=5, window=15 * 60)


@router.post("/login", response_model=TokenOut, dependencies=[Depends(rate_limit(20, 60))])
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenOut:
    email = payload.email.lower().strip()
    key = f"{client_ip(request)}|{email}"
    if _failures.blocked(key):
        audit("login.locked", ip=client_ip(request))
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts, try again later", {"Retry-After": "900"})

    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    # Always burn one PBKDF2 round so unknown accounts and wrong passwords are indistinguishable by timing.
    ok = verify_password(payload.password, user.password_hash if user else DUMMY_HASH)
    if user is None or not user.is_active or not ok:
        _failures.record(key)
        audit("login.failed", ip=client_ip(request))
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    _failures.clear(key)
    if needs_rehash(user.password_hash):  # transparent upgrade of legacy hashes
        user.password_hash = hash_password(payload.password)
        db.commit()
    audit("login.ok", user=user.id, role=user.role)
    return TokenOut(access_token=create_access_token(user), user=UserOut.model_validate(user))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(token: str | None = Depends(oauth2_scheme), user: User = Depends(current_user)) -> Response:
    """Server-side sign-out: the token's jti goes on the deny-list until it would have expired."""
    revoke_token(decode_token(token or ""))
    audit("logout", user=user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.get("/demo-users", response_model=list[UserOut], dependencies=[Depends(rate_limit(30, 60))])
def demo_users(db: Session = Depends(get_db)) -> list[UserOut]:
    """Persona picker for the sign-in screen. Exists only when DEMO_MODE is on."""
    if not get_settings().demo_mode:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    emails = ["manager@careflow.ir", "physician@careflow.ir", "nurse@careflow.ir", "it@careflow.ir"]
    users = db.execute(select(User).where(User.email.in_(emails))).scalars().all()
    order = {email: index for index, email in enumerate(emails)}
    return [UserOut.model_validate(u) for u in sorted(users, key=lambda u: order[u.email])]
