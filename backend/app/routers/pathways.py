"""Care pathway catalogue and live case board (process standardisation)."""
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from ..db import get_db
from ..models import CarePathway, CaseStep, Patient, PathwayStep, User, utcnow
from ..schemas import PathwayOut, PathwayStepOut
from ..security import PATIENT_READERS, current_user, patient_scope, require_role

router = APIRouter(prefix="/pathways", tags=["pathways"])


def _stats(db: Session) -> tuple[dict[int, int], dict[int, list[tuple[float, bool]]]]:
    """Active case counts and finished-step (hours, on_time) per pathway - two queries for ALL pathways."""
    cases = dict(
        db.execute(
            select(Patient.pathway_id, func.count()).where(Patient.status == "active").group_by(Patient.pathway_id)
        ).all()
    )
    finished: dict[int, list[tuple[float, bool]]] = defaultdict(list)
    rows = db.execute(
        select(Patient.pathway_id, CaseStep.started_at, CaseStep.completed_at, PathwayStep.target_minutes)
        .join(CaseStep, CaseStep.patient_id == Patient.id)
        .join(PathwayStep, PathwayStep.id == CaseStep.step_id)
        .where(
            Patient.status == "active",
            CaseStep.status == "done",
            CaseStep.started_at.is_not(None),
            CaseStep.completed_at.is_not(None),
        )
    ).all()
    for pathway_id, start, end, target in rows:
        minutes = (end - start).total_seconds() / 60
        finished[pathway_id].append((minutes / 60, minutes <= target * 1.25))
    return cases, finished


def _pathway_out(pathway: CarePathway, cases: dict[int, int], finished: dict[int, list[tuple[float, bool]]]) -> PathwayOut:
    steps = sorted(pathway.steps, key=lambda s: s.position)
    done = finished.get(pathway.id, [])
    return PathwayOut(
        id=pathway.id,
        code=pathway.code,
        name_en=pathway.name_en,
        name_fa=pathway.name_fa,
        description_en=pathway.description_en,
        description_fa=pathway.description_fa,
        target_hours=pathway.target_hours,
        department_en=pathway.department.name_en if pathway.department else None,
        department_fa=pathway.department.name_fa if pathway.department else None,
        steps=[PathwayStepOut.model_validate(s) for s in steps],
        active_cases=cases.get(pathway.id, 0),
        adherence=round(sum(1 for _, ok in done if ok) / len(done) * 100, 1) if done else 0.0,
        avg_hours=round(sum(h for h, _ in done) / len(done) * len(steps), 1) if done else 0.0,
    )


_PATHWAY_LOAD = (selectinload(CarePathway.steps), joinedload(CarePathway.department))


@router.get("", response_model=list[PathwayOut], dependencies=[Depends(current_user)])
def list_pathways(db: Session = Depends(get_db)) -> list[PathwayOut]:
    cases, finished = _stats(db)
    pathways = db.execute(select(CarePathway).options(*_PATHWAY_LOAD).order_by(CarePathway.id)).scalars().all()
    return [_pathway_out(p, cases, finished) for p in pathways]


@router.get("/{pathway_id}/board")
def pathway_board(
    pathway_id: int, db: Session = Depends(get_db), user: User = Depends(require_role(*PATIENT_READERS))
) -> dict:
    """Cases grouped by their current step - the Kanban view of standardised care (scoped to the caller)."""
    pathway = db.execute(select(CarePathway).options(*_PATHWAY_LOAD).where(CarePathway.id == pathway_id)).scalar_one_or_none()
    if pathway is None:
        raise HTTPException(status_code=404, detail="Pathway not found")
    steps = sorted(pathway.steps, key=lambda s: s.position)
    patients = (
        db.execute(
            patient_scope(select(Patient), user)
            .where(Patient.pathway_id == pathway_id, Patient.status == "active")
            .options(joinedload(Patient.department), selectinload(Patient.case_steps))
        )
        .unique()
        .scalars()
        .all()
    )

    columns = [
        {
            "step_id": step.id,
            "position": step.position,
            "name_en": step.name_en,
            "name_fa": step.name_fa,
            "owner_role": step.owner_role,
            "target_minutes": step.target_minutes,
            "cases": [],
        }
        for step in steps
    ]
    index = {step.id: column for step, column in zip(steps, columns, strict=True)}

    now = utcnow()
    for patient in patients:
        current = next((cs for cs in sorted(patient.case_steps, key=lambda s: s.position) if cs.status in ("active", "blocked")), None)
        column = index.get(current.step_id) if current else None
        if column is None:
            continue
        column["cases"].append(
            {
                "patient_id": patient.id,
                "case_step_id": current.id,
                "name_en": patient.name_en,
                "name_fa": patient.name_fa,
                "mrn": patient.mrn,
                "bed": patient.bed,
                "acuity": patient.acuity,
                "status": current.status,
                "department_en": patient.department.name_en,
                "department_fa": patient.department.name_fa,
                "elapsed_minutes": round((now - current.started_at).total_seconds() / 60 if current.started_at else 0.0, 1),
            }
        )
    cases, finished = _stats(db)
    return {"pathway": _pathway_out(pathway, cases, finished).model_dump(), "columns": columns}
