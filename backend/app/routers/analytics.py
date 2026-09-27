"""Predictive analytics endpoints - occupancy, emergency load, resource demand."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..analytics import holt_forecast, trend_pct
from ..db import get_db
from ..models import Department, OccupancyRecord
from ..schemas import ForecastPointOut, OccupancyOut, SeriesPoint
from ..security import current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _records(db: Session, department_id: int | None, days: int) -> list[OccupancyRecord]:
    cutoff = date.today() - timedelta(days=days)
    query = select(OccupancyRecord).where(OccupancyRecord.day >= cutoff).order_by(OccupancyRecord.day)
    if department_id:
        query = query.where(OccupancyRecord.department_id == department_id)
    return list(db.execute(query).scalars().all())


@router.get("/occupancy", response_model=OccupancyOut, dependencies=[Depends(current_user)])
def occupancy(
    db: Session = Depends(get_db),
    department_id: int | None = None,
    days: int = Query(default=90, ge=14, le=365),
    horizon: int = Query(default=14, ge=1, le=60),
) -> OccupancyOut:
    department = db.get(Department, department_id) if department_id else None
    if department_id and department is None:
        raise HTTPException(status_code=404, detail="Department not found")

    records = _records(db, department_id, days)
    if not records:
        raise HTTPException(status_code=404, detail="No occupancy data")

    buckets: dict[date, dict[str, float]] = {}
    for record in records:
        bucket = buckets.setdefault(
            record.day, {"occupied": 0.0, "capacity": 0.0, "admissions": 0.0, "discharges": 0.0, "ed": 0.0}
        )
        bucket["occupied"] += record.occupied_beds
        bucket["capacity"] += record.capacity
        bucket["admissions"] += record.admissions
        bucket["discharges"] += record.discharges
        bucket["ed"] += record.ed_arrivals

    ordered_days = sorted(buckets)
    history = [
        SeriesPoint(
            day=day,
            occupied=buckets[day]["occupied"],
            capacity=buckets[day]["capacity"],
            admissions=int(buckets[day]["admissions"]),
            discharges=int(buckets[day]["discharges"]),
            ed_arrivals=int(buckets[day]["ed"]),
            occupancy_rate=round(buckets[day]["occupied"] / max(buckets[day]["capacity"], 1) * 100, 1),
        )
        for day in ordered_days
    ]

    series = [point.occupied for point in history]
    forecast = holt_forecast(series, ordered_days, horizon=horizon)
    capacity = int(history[-1].capacity)
    peak = max(forecast, key=lambda p: p.value) if forecast else None

    return OccupancyOut(
        department_id=department_id,
        department_en=department.name_en if department else "All departments",
        department_fa=department.name_fa if department else "همه بخش‌ها",
        capacity=capacity,
        history=history,
        forecast=[ForecastPointOut(day=p.day, value=round(p.value, 1), lower=round(p.lower, 1), upper=round(p.upper, 1)) for p in forecast],
        trend_pct=trend_pct(series),
        peak_day=peak.day if peak else None,
        peak_value=round(peak.value, 1) if peak else 0.0,
    )


@router.get("/emergency-load", dependencies=[Depends(current_user)])
def emergency_load(
    db: Session = Depends(get_db),
    days: int = Query(default=90, ge=14, le=365),
    horizon: int = Query(default=14, ge=1, le=60),
) -> dict:
    ed = db.execute(select(Department).where(Department.kind == "emergency")).scalars().first()
    if ed is None:
        raise HTTPException(status_code=404, detail="No emergency department")
    records = _records(db, ed.id, days)
    days_list = [r.day for r in records]
    arrivals = [float(r.ed_arrivals) for r in records]
    forecast = holt_forecast(arrivals, days_list, horizon=horizon)
    return {
        "department_en": ed.name_en,
        "department_fa": ed.name_fa,
        "history": [{"day": d.isoformat(), "value": v} for d, v in zip(days_list, arrivals, strict=True)],
        "forecast": [
            {"day": p.day.isoformat(), "value": round(p.value, 1), "lower": round(p.lower, 1), "upper": round(p.upper, 1)}
            for p in forecast
        ],
        "trend_pct": trend_pct(arrivals),
    }


@router.get("/resource-demand", dependencies=[Depends(current_user)])
def resource_demand(db: Session = Depends(get_db), horizon: int = Query(default=7, ge=1, le=30)) -> dict:
    """Nurse/physician demand implied by the forecast, at 1 nurse per 4 occupied beds."""
    departments = db.execute(select(Department).where(Department.bed_capacity > 0)).scalars().all()
    rows = []
    for dept in departments:
        records = _records(db, dept.id, 120)
        if not records:
            continue
        series = [float(r.occupied_beds) for r in records]
        forecast = holt_forecast(series, [r.day for r in records], horizon=horizon)
        peak = max(p.value for p in forecast)
        nurse_ratio = {"icu": 2.0, "emergency": 3.0}.get(dept.kind, 5.0)
        rows.append(
            {
                "department_id": dept.id,
                "name_en": dept.name_en,
                "name_fa": dept.name_fa,
                "kind": dept.kind,
                "capacity": dept.bed_capacity,
                "current": series[-1],
                "peak_forecast": round(peak, 1),
                "peak_rate": round(peak / max(dept.bed_capacity, 1) * 100, 1),
                "nurses_required": round(peak / nurse_ratio, 1),
                "nurses_available": round(dept.staff_count * 0.34, 1),
                "gap": round(peak / nurse_ratio - dept.staff_count * 0.34, 1),
            }
        )
    rows.sort(key=lambda row: row["gap"], reverse=True)
    return {"horizon_days": horizon, "rows": rows}


@router.get("/seasonality", dependencies=[Depends(current_user)])
def seasonality(db: Session = Depends(get_db)) -> dict:
    """Weekday load profile - the operational signature the plan sells on."""
    records = _records(db, None, 180)
    buckets: dict[int, list[float]] = {i: [] for i in range(7)}
    totals: dict[date, float] = {}
    for record in records:
        totals[record.day] = totals.get(record.day, 0) + record.occupied_beds
    for day, value in totals.items():
        buckets[day.weekday()].append(value)
    overall = sum(totals.values()) / max(len(totals), 1)
    labels_en = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    labels_fa = ["دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه", "شنبه", "یک‌شنبه"]
    # Iran's working week starts on Saturday, so report the week in that order.
    week_order = [5, 6, 0, 1, 2, 3, 4]
    return {
        "average": round(overall, 1),
        "weekdays": [
            {
                "index": i,
                "label_en": labels_en[i],
                "label_fa": labels_fa[i],
                "value": round(sum(buckets[i]) / max(len(buckets[i]), 1), 1),
                "delta_pct": round(
                    (sum(buckets[i]) / max(len(buckets[i]), 1) - overall) / max(overall, 1) * 100, 1
                ),
            }
            for i in week_order
        ],
    }
