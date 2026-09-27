"""Authentication endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import LoginRequest, TokenOut, UserOut
from ..security import create_access_token, current_user, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenOut:
    user = db.execute(select(User).where(User.email == payload.email.lower().strip())).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return TokenOut(access_token=create_access_token(user), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.get("/demo-users", response_model=list[UserOut])
def demo_users(db: Session = Depends(get_db)) -> list[UserOut]:
    """Public list of the four demo personas shown on the sign-in screen."""
    emails = ["manager@careflow.ir", "physician@careflow.ir", "nurse@careflow.ir", "it@careflow.ir"]
    users = db.execute(select(User).where(User.email.in_(emails))).scalars().all()
    order = {email: index for index, email in enumerate(emails)}
    return [UserOut.model_validate(u) for u in sorted(users, key=lambda u: order[u.email])]
