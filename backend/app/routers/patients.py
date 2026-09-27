"""Patient list, detail, pathway progression and the collaboration thread."""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import CaseStep, Message, Patient, User, utcnow
from ..schemas import (
    CareTeamOut,
    CaseStepOut,
    MessageCreate,
    MessageOut,
    PatientDetailOut,
    PatientOut,
)
from ..security import current_user

router = APIRouter(prefix="/patients", tags=["patients"])


def _progress(patient: Patient) -> tuple[float, CaseStep | None, bool]:
    steps = sorted(patient.case_steps, key=lambda s: s.position)
    if not steps:
        return 0.0, None, False
    done = len([s for s in steps if s.status == "done"])
    current = next((s for s in steps if s.status in ("active", "blocked")), None)
    return round(done / len(steps) * 100, 1), current, any(s.status == "blocked" for s in steps)


def _to_out(patient: Patient) -> PatientOut:
    progress, current, blocked = _progress(patient)
    return PatientOut(
        id=patient.id,
        mrn=patient.mrn,
        name_en=patient.name_en,
        name_fa=patient.name_fa,
        age=patient.age,
        sex=patient.sex,
        bed=patient.bed,
        acuity=patient.acuity,
        status=patient.status,
        diagnosis_en=patient.diagnosis_en,
        diagnosis_fa=patient.diagnosis_fa,
        admitted_at=patient.admitted_at,
        expected_discharge_at=patient.expected_discharge_at,
        risk_score=patient.risk_score,
        department_id=patient.department_id,
        department_en=patient.department.name_en,
        department_fa=patient.department.name_fa,
        pathway_en=patient.pathway.name_en,
        pathway_fa=patient.pathway.name_fa,
        progress=progress,
        current_step_en=current.step.name_en if current else None,
        current_step_fa=current.step.name_fa if current else None,
        blocked=blocked,
        los_hours=round((utcnow() - patient.admitted_at).total_seconds() / 3600, 1),
    )


def _step_out(case_step: CaseStep) -> CaseStepOut:
    elapsed = None
    if case_step.started_at:
        end = case_step.completed_at or utcnow()
        elapsed = round((end - case_step.started_at).total_seconds() / 60, 1)
    return CaseStepOut(
        id=case_step.id,
        position=case_step.position,
        status=case_step.status,
        name_en=case_step.step.name_en,
        name_fa=case_step.step.name_fa,
        owner_role=case_step.step.owner_role,
        target_minutes=case_step.step.target_minutes,
        started_at=case_step.started_at,
        completed_at=case_step.completed_at,
        assignee_name_en=case_step.assignee.name_en if case_step.assignee else None,
        assignee_name_fa=case_step.assignee.name_fa if case_step.assignee else None,
        elapsed_minutes=elapsed,
        overdue=bool(elapsed and elapsed > case_step.step.target_minutes * 1.25 and case_step.status != "done"),
    )


def _message_out(message: Message) -> MessageOut:
    return MessageOut(
        id=message.id,
        author_id=message.author_id,
        author_name_en=message.author.name_en,
        author_name_fa=message.author.name_fa,
        author_role=message.author.role,
        avatar_hue=message.author.avatar_hue,
        body=message.body,
        kind=message.kind,
        created_at=message.created_at,
    )


@router.get("", response_model=list[PatientOut], dependencies=[Depends(current_user)])
def list_patients(
    db: Session = Depends(get_db),
    department_id: int | None = None,
    status: str | None = None,
    blocked: bool | None = None,
    q: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
) -> list[PatientOut]:
    query = select(Patient).order_by(Patient.acuity, Patient.admitted_at)
    if department_id:
        query = query.where(Patient.department_id == department_id)
    if status:
        query = query.where(Patient.status == status)
    patients = db.execute(query).scalars().all()
    items = [_to_out(p) for p in patients]
    if blocked is not None:
        items = [p for p in items if p.blocked == blocked]
    if q:
        needle = q.strip().lower()
        items = [
            p for p in items
            if needle in p.name_fa.lower() or needle in p.name_en.lower() or needle in p.mrn.lower()
        ]
    return items[:limit]


@router.get("/{patient_id}", response_model=PatientDetailOut, dependencies=[Depends(current_user)])
def patient_detail(patient_id: int, db: Session = Depends(get_db)) -> PatientDetailOut:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    base = _to_out(patient)
    return PatientDetailOut(
        **base.model_dump(),
        steps=[_step_out(s) for s in sorted(patient.case_steps, key=lambda s: s.position)],
        care_team=[
            CareTeamOut(
                user_id=member.user_id,
                name_en=member.user.name_en,
                name_fa=member.user.name_fa,
                role_en=member.role_en,
                role_fa=member.role_fa,
                avatar_hue=member.user.avatar_hue,
            )
            for member in patient.care_team
        ],
        messages=[_message_out(m) for m in sorted(patient.messages, key=lambda m: m.created_at)],
    )


@router.post("/{patient_id}/steps/{case_step_id}/advance", response_model=list[CaseStepOut])
def advance_step(
    patient_id: int,
    case_step_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> list[CaseStepOut]:
    """Complete the given step and activate the next one - the workflow engine in miniature."""
    case_step = db.get(CaseStep, case_step_id)
    if case_step is None or case_step.patient_id != patient_id:
        raise HTTPException(status_code=404, detail="Step not found")
    if case_step.status == "done":
        raise HTTPException(status_code=409, detail="Step already completed")

    now = utcnow()
    case_step.status = "done"
    case_step.started_at = case_step.started_at or now
    case_step.completed_at = now
    case_step.assignee_id = case_step.assignee_id or user.id

    patient = db.get(Patient, patient_id)
    steps = sorted(patient.case_steps, key=lambda s: s.position)
    following = next((s for s in steps if s.position > case_step.position), None)
    if following is not None:
        following.status = "active"
        following.started_at = following.started_at or now
    else:
        patient.status = "discharged"
        patient.discharged_at = now
    db.commit()
    db.refresh(patient)
    return [_step_out(s) for s in sorted(patient.case_steps, key=lambda s: s.position)]


@router.post("/{patient_id}/messages", response_model=MessageOut)
def post_message(
    patient_id: int,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> MessageOut:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    message = Message(patient_id=patient_id, author_id=user.id, body=payload.body.strip(), kind=payload.kind)
    db.add(message)
    db.commit()
    db.refresh(message)
    return _message_out(message)


@router.get("/{patient_id}/messages", response_model=list[MessageOut], dependencies=[Depends(current_user)])
def list_messages(patient_id: int, db: Session = Depends(get_db)) -> list[MessageOut]:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return [_message_out(m) for m in sorted(patient.messages, key=lambda m: m.created_at)]
