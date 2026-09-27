"""Care pathway catalogue and live case board (process standardisation)."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import CarePathway, CaseStep, Patient, utcnow
from ..schemas import PathwayOut, PathwayStepOut
from ..security import current_user

router = APIRouter(prefix="/pathways", tags=["pathways"])


def _pathway_out(pathway: CarePathway, db: Session) -> PathwayOut:
    patients = db.execute(
        select(Patient).where(Patient.pathway_id == pathway.id, Patient.status == "active")
    ).scalars().all()
    steps = sorted(pathway.steps, key=lambda s: s.position)
    targets = {s.id: s.target_minutes for s in steps}

    done_steps = [
        cs
        for patient in patients
        for cs in patient.case_steps
        if cs.status == "done" and cs.started_at and cs.completed_at
    ]
    on_time = [
        cs for cs in done_steps
        if (cs.completed_at - cs.started_at).total_seconds() / 60 <= targets.get(cs.step_id, 60) * 1.25
    ]
    durations = [
        (cs.completed_at - cs.started_at).total_seconds() / 3600 for cs in done_steps
    ]
    return PathwayOut(
        id=pathway.id,
        code=pathway.code,
        name_en=pathway.name_en,
        name_fa=pathway.name_fa,
        description_en=pathway.description_en,
        description_fa=pathway.description_fa,
        target_hours=pathway.target_hours,
        department_en=pathway.department.name_en if pathway.department_id else None,
        department_fa=pathway.department.name_fa if pathway.department_id else None,
        steps=[PathwayStepOut.model_validate(s) for s in steps],
        active_cases=len(patients),
        adherence=round(len(on_time) / len(done_steps) * 100, 1) if done_steps else 0.0,
        avg_hours=round(sum(durations) / len(durations) * len(steps), 1) if durations else 0.0,
    )


@router.get("", response_model=list[PathwayOut], dependencies=[Depends(current_user)])
def list_pathways(db: Session = Depends(get_db)) -> list[PathwayOut]:
    pathways = db.execute(select(CarePathway).order_by(CarePathway.id)).scalars().all()
    return [_pathway_out(p, db) for p in pathways]


@router.get("/{pathway_id}/board", dependencies=[Depends(current_user)])
def pathway_board(pathway_id: int, db: Session = Depends(get_db)) -> dict:
    """Cases grouped by their current step - the Kanban view of standardised care."""
    pathway = db.get(CarePathway, pathway_id)
    if pathway is None:
        raise HTTPException(status_code=404, detail="Pathway not found")
    steps = sorted(pathway.steps, key=lambda s: s.position)
    patients = db.execute(
        select(Patient).where(Patient.pathway_id == pathway_id, Patient.status == "active")
    ).scalars().all()

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

    for patient in patients:
        current: CaseStep | None = next(
            (cs for cs in sorted(patient.case_steps, key=lambda s: s.position) if cs.status in ("active", "blocked")),
            None,
        )
        if current is None:
            continue
        column = index.get(current.step_id)
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
                "elapsed_minutes": round(
                    (utcnow() - current.started_at).total_seconds() / 60 if current.started_at else 0.0,
                    1,
                ),
            }
        )
    return {
        "pathway": _pathway_out(pathway, db).model_dump(),
        "columns": columns,
    }
