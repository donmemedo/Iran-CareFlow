"""Unauthenticated endpoints used by the marketing site: ROI model and demo requests."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Lead
from ..schemas import LeadCreate, LeadOut, RoiLine, RoiRequest, RoiResponse

router = APIRouter(tags=["public"])

# Improvement assumptions taken from the pilot targets in the business plan.
# Deliberately conservative: only the share of each gain a finance director
# would actually book is counted, so the result survives a CFO review.
DISCHARGE_TIME_REDUCTION = 0.45      # faster discharge turnaround
LOS_REDUCTION = 0.06                 # shorter average stay from removed bottlenecks
PAPERWORK_REDUCTION = 0.35           # less document search and re-keying
FREED_CAPACITY_UTILISATION = 0.55    # share of released bed-days actually re-filled
CONTRIBUTION_MARGIN = 0.28           # a refilled bed-day earns margin, not full revenue
STAFF_TIME_CONVERSION = 0.40         # share of recovered hours that avoids real cost
VARIABLE_COST_SHARE = 0.45           # variable portion of a bed-day cost
WASTE_REDUCTION = 0.015              # supplies and duplicated tests avoided
SHIFTS_PER_STAFF_YEAR = 230
FIRST_YEAR_RAMP = 0.65               # roll-out means year one captures part of the gain


@router.post("/roi/calculate", response_model=RoiResponse)
def calculate_roi(payload: RoiRequest) -> RoiResponse:
    occupancy = payload.occupancy_rate / 100
    bed_days_per_year = payload.beds * occupancy * 365
    discharges_per_year = bed_days_per_year / max(payload.avg_length_of_stay, 0.5)

    # 1. Bed-days released by a faster discharge turnaround.
    minutes_saved = payload.discharge_delay_minutes * DISCHARGE_TIME_REDUCTION
    bed_days_from_discharge = discharges_per_year * (minutes_saved / 1440)

    # 2. Bed-days released by a shorter average length of stay.
    bed_days_from_los = discharges_per_year * payload.avg_length_of_stay * LOS_REDUCTION

    bed_days_released = bed_days_from_discharge + bed_days_from_los
    capacity_value = (
        bed_days_released * payload.bed_day_cost * FREED_CAPACITY_UTILISATION * CONTRIBUTION_MARGIN
    )

    # 3. Clinical time recovered from paperwork and document search.
    staff_hours = (
        payload.clinical_staff
        * SHIFTS_PER_STAFF_YEAR
        * payload.paperwork_minutes_per_shift
        * PAPERWORK_REDUCTION
        / 60
    )
    staff_value = staff_hours * payload.staff_hourly_cost * STAFF_TIME_CONVERSION

    # 4. Supplies and duplicated work avoided across the released capacity.
    waste_value = bed_days_per_year * payload.bed_day_cost * VARIABLE_COST_SHARE * WASTE_REDUCTION

    annual_benefit = capacity_value + staff_value + waste_value
    annual_cost = payload.annual_subscription
    first_year_benefit = annual_benefit * FIRST_YEAR_RAMP
    first_year_cost = annual_cost + payload.implementation_cost
    net_benefit = first_year_benefit - first_year_cost
    roi_pct = (net_benefit / first_year_cost * 100) if first_year_cost else 0.0
    steady_state_roi_pct = ((annual_benefit - annual_cost) / annual_cost * 100) if annual_cost else 0.0
    monthly_benefit = first_year_benefit / 12
    payback_months = (first_year_cost / monthly_benefit) if monthly_benefit > 0 else 0.0

    lines = [
        RoiLine(
            key="capacity",
            label_en="Value of released bed capacity",
            label_fa="ارزش ظرفیت تخت آزادشده",
            value=round(capacity_value),
            detail_en=f"{round(bed_days_released):,} bed-days/year, {FREED_CAPACITY_UTILISATION:.0%} re-used at {CONTRIBUTION_MARGIN:.0%} margin",
            detail_fa=f"{round(bed_days_released):,} تخت-روز در سال، {FREED_CAPACITY_UTILISATION:.0%} استفاده مجدد با حاشیه {CONTRIBUTION_MARGIN:.0%}",
        ),
        RoiLine(
            key="staff",
            label_en="Clinical time recovered",
            label_fa="زمان بالینی بازیافته",
            value=round(staff_value),
            detail_en=f"{round(staff_hours):,} staff hours/year, {STAFF_TIME_CONVERSION:.0%} booked as avoided cost",
            detail_fa=f"{round(staff_hours):,} ساعت در سال، {STAFF_TIME_CONVERSION:.0%} به‌عنوان هزینه اجتناب‌شده",
        ),
        RoiLine(
            key="waste",
            label_en="Supplies and rework avoided",
            label_fa="کاهش اتلاف اقلام و دوباره‌کاری",
            value=round(waste_value),
            detail_en=f"{WASTE_REDUCTION:.1%} of variable cost across {round(bed_days_per_year):,} bed-days",
            detail_fa=f"{WASTE_REDUCTION:.1%} هزینه متغیر در {round(bed_days_per_year):,} تخت-روز",
        ),
        RoiLine(
            key="cost",
            label_en="CareFlow first-year cost",
            label_fa="هزینه سال اول کرفلو",
            value=-round(first_year_cost),
            detail_en="Subscription and SLA plus one-off implementation",
            detail_fa="اشتراک و تعهد سطح خدمت به‌همراه هزینه یک‌باره استقرار",
        ),
    ]

    return RoiResponse(
        lines=lines,
        annual_benefit=round(annual_benefit),
        annual_cost=round(annual_cost),
        net_benefit=round(net_benefit),
        first_year_benefit=round(first_year_benefit),
        first_year_cost=round(first_year_cost),
        roi_pct=round(roi_pct, 1),
        steady_state_roi_pct=round(steady_state_roi_pct, 1),
        payback_months=round(payback_months, 1),
        bed_days_released=round(bed_days_released),
        staff_hours_recovered=round(staff_hours),
        assumptions_en=[
            f"Discharge turnaround improves by {DISCHARGE_TIME_REDUCTION:.0%}",
            f"Average length of stay falls by {LOS_REDUCTION:.0%}",
            f"Document search and paperwork falls by {PAPERWORK_REDUCTION:.0%}",
            f"{FREED_CAPACITY_UTILISATION:.0%} of released bed-days are re-filled at {CONTRIBUTION_MARGIN:.0%} margin",
            f"Year one captures {FIRST_YEAR_RAMP:.0%} of the gain during roll-out",
            "All figures in million IRT per year",
        ],
        assumptions_fa=[
            f"بهبود {DISCHARGE_TIME_REDUCTION:.0%} در زمان ترخیص",
            f"کاهش {LOS_REDUCTION:.0%} در میانگین مدت بستری",
            f"کاهش {PAPERWORK_REDUCTION:.0%} در کاغذبازی و جست‌وجوی پرونده",
            f"استفاده مجدد از {FREED_CAPACITY_UTILISATION:.0%} تخت-روزهای آزادشده با حاشیه {CONTRIBUTION_MARGIN:.0%}",
            f"در سال اول {FIRST_YEAR_RAMP:.0%} از منفعت طی استقرار محقق می‌شود",
            "همه اعداد به میلیون تومان در سال",
        ],
    )


@router.post("/leads", response_model=LeadOut, status_code=201)
def create_lead(payload: LeadCreate, db: Session = Depends(get_db)) -> LeadOut:
    lead = Lead(
        full_name=payload.full_name.strip(),
        organization=payload.organization.strip(),
        role=payload.role.strip(),
        email=str(payload.email).lower(),
        phone=payload.phone.strip(),
        beds=payload.beds,
        message=payload.message.strip(),
        locale=payload.locale,
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return LeadOut.model_validate(lead)
