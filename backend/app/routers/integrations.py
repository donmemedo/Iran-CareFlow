"""HIS / LIS / PACS / SEPAS connectivity view."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Integration
from ..schemas import IntegrationOut
from ..security import current_user

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("", response_model=list[IntegrationOut], dependencies=[Depends(current_user)])
def list_integrations(db: Session = Depends(get_db)) -> list[IntegrationOut]:
    items = db.execute(select(Integration).order_by(Integration.id)).scalars().all()
    return [IntegrationOut.model_validate(item) for item in items]
