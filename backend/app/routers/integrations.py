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


@router.get("/public-summary")
def public_summary(db: Session = Depends(get_db)) -> dict:
    """Connector catalogue for the marketing site - no authentication required."""
    items = db.execute(select(Integration).order_by(Integration.id)).scalars().all()
    return {
        "connectors": [
            {"code": i.code, "name_en": i.name_en, "name_fa": i.name_fa, "kind": i.kind, "protocol": i.protocol}
            for i in items
        ],
        "count": len(items),
    }
