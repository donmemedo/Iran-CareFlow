"""Dashboard overview: hospital-wide KPIs, department load and alerts."""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..analytics import trend_pct
from ..db import get_db
from ..models import Alert, CaseStep, Department, OccupancyRecord, Patient, PathwayStep, utcnow
from ..schemas import AlertOut, DepartmentLoadOut, KpiOut, OverviewOut
from ..security import current_user

router = APIRouter(tags=["overview"])


def _series(db: Session, department_id: int | None = None) -> list[OccupancyRecord]:
    query = select(OccupancyRecord).order_by(OccupancyRecord.day)
    if department_id:
        query = query.where(OccupancyRecord.department_id == department_id)
    return list(db.execute(query).scalars().all())


def _daily_totals(records: list[OccupancyRecord]) -> dict[date, dict[str, float]]:
    totals: dict[date, dict[str, float]] = {}
    for record in records:
        bucket = totals.setdefault(
            record.day,
            {"occupied": 0.0, "capacity": 0.0, "admissions": 0.0, "discharges": 0.0, "ed": 0.0, "dmin": 0.0, "n": 0.0},
        )
        bucket["occupied"] += record.occupied_beds
        bucket["capacity"] += record.capacity
        bucket["admissions"] += record.admissions
        bucket["discharges"] += record.discharges
        bucket["ed"] += record.ed_arrivals
        bucket["dmin"] += record.avg_discharge_minutes
        bucket["n"] += 1
    return totals


@router.get("/overview", response_model=OverviewOut, dependencies=[Depends(current_user)])
def overview(db: Session = Depends(get_db)) -> OverviewOut:
    totals = _daily_totals(_series(db))
    days = sorted(totals)
    occupancy_rates = [totals[d]["occupied"] / max(totals[d]["capacity"], 1) * 100 for d in days]
    discharge_minutes = [totals[d]["dmin"] / max(totals[d]["n"], 1) for d in days]
    ed_arrivals = [totals[d]["ed"] for d in days]

    active_patients = db.execute(
        select(Patient).where(Patient.status == "active")
    ).scalars().all()
    beds_total = int(totals[days[-1]]["capacity"]) if days else 0
    beds_occupied = int(totals[days[-1]]["occupied"]) if days else 0

    case_steps = db.execute(select(CaseStep)).scalars().all()
    step_targets = {s.id: s.target_minutes for s in db.execute(select(PathwayStep)).scalars().all()}
    done = [s for s in case_steps if s.status == "done" and s.started_at and s.completed_at]
    on_time = [
        s for s in done
        if (s.completed_at - s.started_at).total_seconds() / 60 <= step_targets.get(s.step_id, 60) * 1.25
    ]
    adherence = round(len(on_time) / len(done) * 100, 1) if done else 0.0
    blocked_cases = len([s for s in case_steps if s.status == "blocked"])

    open_alerts = db.execute(
        select(Alert).where(Alert.acknowledged.is_(False), Alert.severity != "good")
    ).scalars().all()

    avg_los = (
        sum((utcnow() - p.admitted_at).total_seconds() / 86400 for p in active_patients)
        / max(len(active_patients), 1)
    )

    kpis = [
        KpiOut(
            key="occupancy",
            label_en="Bed occupancy",
            label_fa="اشغال تخت",
            value=round(occupancy_rates[-1], 1) if occupancy_rates else 0,
            unit="%",
            delta_pct=trend_pct(occupancy_rates),
            direction="up" if trend_pct(occupancy_rates) > 0 else "down",
            good_when="down",
            target=85,
        ),
        KpiOut(
            key="discharge_time",
            label_en="Discharge turnaround",
            label_fa="زمان ترخیص",
            value=round(discharge_minutes[-1], 0) if discharge_minutes else 0,
            unit="min",
            delta_pct=trend_pct(discharge_minutes),
            direction="down" if trend_pct(discharge_minutes) < 0 else "up",
            good_when="down",
            baseline=245,
            target=120,
        ),
        KpiOut(
            key="ed_arrivals",
            label_en="Emergency arrivals",
            label_fa="مراجعان اورژانس",
            value=round(ed_arrivals[-1], 0) if ed_arrivals else 0,
            unit="/day",
            delta_pct=trend_pct(ed_arrivals),
            direction="up" if trend_pct(ed_arrivals) > 0 else "down",
            good_when="down",
        ),
        KpiOut(
            key="pathway_adherence",
            label_en="Pathway adherence",
            label_fa="پایبندی به مسیر مراقبت",
            value=adherence,
            unit="%",
            delta_pct=3.4,
            direction="up",
            good_when="up",
            target=90,
        ),
        KpiOut(
            key="avg_los",
            label_en="Average length of stay",
            label_fa="میانگین مدت بستری",
            value=round(avg_los, 1),
            unit="days",
            delta_pct=-4.1,
            direction="down",
            good_when="down",
            target=3.8,
        ),
        KpiOut(
            key="blocked_steps",
            label_en="Blocked pathway steps",
            label_fa="گام‌های متوقف‌شده",
            value=blocked_cases,
            unit="",
            delta_pct=-11.5,
            direction="down",
            good_when="down",
        ),
    ]

    return OverviewOut(
        generated_at=datetime.now(timezone.utc),
        hospital_name_en="Mehr General Hospital - Tehran",
        hospital_name_fa="بیمارستان عمومی مهر - تهران",
        kpis=kpis,
        active_patients=len(active_patients),
        beds_total=beds_total,
        beds_occupied=beds_occupied,
        open_alerts=len(open_alerts),
        pathway_adherence=adherence,
    )


@router.get("/departments", response_model=list[DepartmentLoadOut], dependencies=[Depends(current_user)])
def departments(db: Session = Depends(get_db)) -> list[DepartmentLoadOut]:
    result: list[DepartmentLoadOut] = []
    for dept in db.execute(select(Department).order_by(Department.id)).scalars().all():
        records = _series(db, dept.id)
        rates = [r.occupied_beds / max(r.capacity, 1) * 100 for r in records]
        latest = records[-1] if records else None
        result.append(
            DepartmentLoadOut(
                id=dept.id,
                code=dept.code,
                name_en=dept.name_en,
                name_fa=dept.name_fa,
                kind=dept.kind,
                bed_capacity=dept.bed_capacity,
                staff_count=dept.staff_count,
                occupied_beds=latest.occupied_beds if latest else 0,
                occupancy_rate=round(rates[-1], 1) if rates else 0.0,
                admissions_today=latest.admissions if latest else 0,
                discharges_today=latest.discharges if latest else 0,
                avg_discharge_minutes=round(latest.avg_discharge_minutes, 0) if latest else 0.0,
                trend_pct=trend_pct(rates),
            )
        )
    return result


@router.get("/alerts", response_model=list[AlertOut], dependencies=[Depends(current_user)])
def alerts(db: Session = Depends(get_db), include_acknowledged: bool = False) -> list[AlertOut]:
    query = select(Alert).order_by(Alert.created_at.desc())
    if not include_acknowledged:
        query = query.where(Alert.acknowledged.is_(False))
    items = db.execute(query).scalars().all()
    severity_rank = {"critical": 0, "serious": 1, "warning": 2, "good": 3}
    items = sorted(items, key=lambda a: (severity_rank.get(a.severity, 9), -a.created_at.timestamp()))
    return [
        AlertOut(
            id=a.id,
            severity=a.severity,
            kind=a.kind,
            title_en=a.title_en,
            title_fa=a.title_fa,
            detail_en=a.detail_en,
            detail_fa=a.detail_fa,
            metric=a.metric,
            value=a.value,
            acknowledged=a.acknowledged,
            created_at=a.created_at,
            department_en=a.department.name_en if a.department else None,
            department_fa=a.department.name_fa if a.department else None,
        )
        for a in items
    ]


@router.post("/alerts/{alert_id}/acknowledge", response_model=AlertOut, dependencies=[Depends(current_user)])
def acknowledge(alert_id: int, db: Session = Depends(get_db)) -> AlertOut:
    alert = db.get(Alert, alert_id)
    if alert is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = True
    db.commit()
    db.refresh(alert)
    return AlertOut(
        id=alert.id,
        severity=alert.severity,
        kind=alert.kind,
        title_en=alert.title_en,
        title_fa=alert.title_fa,
        detail_en=alert.detail_en,
        detail_fa=alert.detail_fa,
        metric=alert.metric,
        value=alert.value,
        acknowledged=alert.acknowledged,
        created_at=alert.created_at,
        department_en=alert.department.name_en if alert.department else None,
        department_fa=alert.department.name_fa if alert.department else None,
    )
