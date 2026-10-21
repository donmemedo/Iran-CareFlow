"""Dashboard overview: hospital-wide KPIs, department load and alerts (aggregates only - no patient records)."""
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..analytics import trend_pct
from ..db import get_db
from ..models import Alert, CaseStep, Department, OccupancyRecord, Patient, PathwayStep, User, utcnow
from ..schemas import AlertOut, DepartmentLoadOut, KpiOut, OverviewOut
from ..security import audit, current_user, rate_limit

router = APIRouter(tags=["overview"], dependencies=[Depends(current_user)])

_TREND_DAYS = 28  # trend_pct only ever looks at the last two weeks; never load more than this


def _recent_days(db: Session) -> list[tuple[date, float, float, float, float]]:
    """(day, occupied, capacity, ed_arrivals, avg_discharge_minutes) per day, summed in SQL."""
    latest = db.execute(select(func.max(OccupancyRecord.day))).scalar()
    if latest is None:
        return []
    rows = db.execute(
        select(
            OccupancyRecord.day,
            func.sum(OccupancyRecord.occupied_beds),
            func.sum(OccupancyRecord.capacity),
            func.sum(OccupancyRecord.ed_arrivals),
            func.avg(OccupancyRecord.avg_discharge_minutes),
        )
        .where(OccupancyRecord.day > latest - timedelta(days=_TREND_DAYS))
        .group_by(OccupancyRecord.day)
        .order_by(OccupancyRecord.day)
    ).all()
    return [(r[0], float(r[1]), float(r[2]), float(r[3]), float(r[4])) for r in rows]


def _alert_out(a: Alert) -> AlertOut:
    return AlertOut(
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


@router.get("/overview", response_model=OverviewOut)
def overview(db: Session = Depends(get_db)) -> OverviewOut:
    days = _recent_days(db)
    occupancy_rates = [occ / max(cap, 1) * 100 for _, occ, cap, _, _ in days]
    discharge_minutes = [dmin for *_, dmin in days]
    ed_arrivals = [ed for _, _, _, ed, _ in days]
    beds_total = int(days[-1][2]) if days else 0
    beds_occupied = int(days[-1][1]) if days else 0

    admitted = db.execute(select(Patient.admitted_at).where(Patient.status == "active")).scalars().all()

    # Column tuples, not ORM entities: ~10x less work than hydrating every CaseStep + PathwayStep.
    finished = db.execute(
        select(CaseStep.started_at, CaseStep.completed_at, PathwayStep.target_minutes)
        .join(PathwayStep, PathwayStep.id == CaseStep.step_id)
        .where(CaseStep.status == "done", CaseStep.started_at.is_not(None), CaseStep.completed_at.is_not(None))
    ).all()
    on_time = sum(1 for start, end, target in finished if (end - start).total_seconds() / 60 <= target * 1.25)
    adherence = round(on_time / len(finished) * 100, 1) if finished else 0.0
    blocked_cases = db.execute(select(func.count()).select_from(CaseStep).where(CaseStep.status == "blocked")).scalar_one()
    open_alerts = db.execute(
        select(func.count()).select_from(Alert).where(Alert.acknowledged.is_(False), Alert.severity != "good")
    ).scalar_one()

    now = utcnow()
    avg_los = sum((now - a).total_seconds() / 86400 for a in admitted) / max(len(admitted), 1)

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
            delta_pct=3.4,  # demo constant - no historical adherence series is stored yet
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
            delta_pct=-4.1,  # demo constant
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
            delta_pct=-11.5,  # demo constant
            direction="down",
            good_when="down",
        ),
    ]

    return OverviewOut(
        generated_at=datetime.now(timezone.utc),
        hospital_name_en="Mehr General Hospital - Tehran",
        hospital_name_fa="بیمارستان عمومی مهر - تهران",
        kpis=kpis,
        active_patients=len(admitted),
        beds_total=beds_total,
        beds_occupied=beds_occupied,
        open_alerts=open_alerts,
        pathway_adherence=adherence,
    )


@router.get("/departments", response_model=list[DepartmentLoadOut])
def departments(db: Session = Depends(get_db)) -> list[DepartmentLoadOut]:
    latest = db.execute(select(func.max(OccupancyRecord.day))).scalar()
    by_dept: dict[int, list[OccupancyRecord]] = defaultdict(list)
    if latest is not None:  # one query for all departments, last 15 days - was one full-history query each
        recent = db.execute(
            select(OccupancyRecord)
            .where(OccupancyRecord.day > latest - timedelta(days=15))
            .order_by(OccupancyRecord.department_id, OccupancyRecord.day)
        ).scalars()
        for record in recent:
            by_dept[record.department_id].append(record)

    result: list[DepartmentLoadOut] = []
    for dept in db.execute(select(Department).order_by(Department.id)).scalars():
        records = by_dept.get(dept.id, [])
        rates = [r.occupied_beds / max(r.capacity, 1) * 100 for r in records]
        latest_record = records[-1] if records else None
        result.append(
            DepartmentLoadOut(
                id=dept.id,
                code=dept.code,
                name_en=dept.name_en,
                name_fa=dept.name_fa,
                kind=dept.kind,
                bed_capacity=dept.bed_capacity,
                staff_count=dept.staff_count,
                occupied_beds=latest_record.occupied_beds if latest_record else 0,
                occupancy_rate=round(rates[-1], 1) if rates else 0.0,
                admissions_today=latest_record.admissions if latest_record else 0,
                discharges_today=latest_record.discharges if latest_record else 0,
                avg_discharge_minutes=round(latest_record.avg_discharge_minutes, 0) if latest_record else 0.0,
                trend_pct=trend_pct(rates),
            )
        )
    return result


@router.get("/alerts", response_model=list[AlertOut])
def alerts(db: Session = Depends(get_db), include_acknowledged: bool = False) -> list[AlertOut]:
    query = select(Alert).options(joinedload(Alert.department)).order_by(Alert.created_at.desc())
    if not include_acknowledged:
        query = query.where(Alert.acknowledged.is_(False))
    items = db.execute(query).scalars().all()
    severity_rank = {"critical": 0, "serious": 1, "warning": 2, "good": 3}
    items = sorted(items, key=lambda a: (severity_rank.get(a.severity, 9), -a.created_at.timestamp()))
    return [_alert_out(a) for a in items]


@router.post("/alerts/{alert_id}/acknowledge", response_model=AlertOut, dependencies=[Depends(rate_limit(60, 60))])
def acknowledge(alert_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)) -> AlertOut:
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = True
    db.commit()
    db.refresh(alert)
    audit("alert.acknowledged", user=user.id, alert=alert_id)
    return _alert_out(alert)
