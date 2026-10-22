"""Pydantic payloads exposed by the API."""
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Bilingual(BaseModel):
    en: str
    fa: str


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=160)
    password: str = Field(min_length=1, max_length=256)  # bounds the PBKDF2 input


class UserOut(ORMModel):
    id: int
    email: str
    name_en: str
    name_fa: str
    role: str
    title_en: str
    title_fa: str
    department_id: int | None
    avatar_hue: int


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class DepartmentOut(ORMModel):
    id: int
    code: str
    name_en: str
    name_fa: str
    kind: str
    bed_capacity: int
    staff_count: int


class DepartmentLoadOut(DepartmentOut):
    occupied_beds: int
    occupancy_rate: float
    admissions_today: int
    discharges_today: int
    avg_discharge_minutes: float
    trend_pct: float


class KpiOut(BaseModel):
    key: str
    label_en: str
    label_fa: str
    value: float
    unit: str
    delta_pct: float
    direction: str  # up | down | flat
    good_when: str  # up | down
    baseline: float | None = None
    target: float | None = None


class OverviewOut(BaseModel):
    generated_at: datetime
    hospital_name_en: str
    hospital_name_fa: str
    kpis: list[KpiOut]
    active_patients: int
    beds_total: int
    beds_occupied: int
    open_alerts: int
    pathway_adherence: float


class SeriesPoint(BaseModel):
    day: date
    occupied: float
    capacity: float
    admissions: int
    discharges: int
    ed_arrivals: int
    occupancy_rate: float


class ForecastPointOut(BaseModel):
    day: date
    value: float
    lower: float
    upper: float


class OccupancyOut(BaseModel):
    department_id: int | None
    department_en: str
    department_fa: str
    capacity: int
    history: list[SeriesPoint]
    forecast: list[ForecastPointOut]
    trend_pct: float
    peak_day: date | None
    peak_value: float


class CaseStepOut(ORMModel):
    id: int
    position: int
    status: str
    name_en: str
    name_fa: str
    owner_role: str
    target_minutes: int
    started_at: datetime | None
    completed_at: datetime | None
    assignee_name_en: str | None = None
    assignee_name_fa: str | None = None
    elapsed_minutes: float | None = None
    overdue: bool = False


class CareTeamOut(BaseModel):
    user_id: int
    name_en: str
    name_fa: str
    role_en: str
    role_fa: str
    avatar_hue: int


class MessageOut(BaseModel):
    id: int
    author_id: int
    author_name_en: str
    author_name_fa: str
    author_role: str
    avatar_hue: int
    body: str
    kind: str
    created_at: datetime


class MessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: str = Field(min_length=1, max_length=2000)
    kind: Literal["note", "request", "decision", "alert"] = "note"


class PatientOut(ORMModel):
    id: int
    mrn: str
    name_en: str
    name_fa: str
    age: int
    sex: str
    bed: str
    acuity: int
    status: str
    diagnosis_en: str
    diagnosis_fa: str
    admitted_at: datetime
    expected_discharge_at: datetime | None
    risk_score: float
    department_id: int
    department_en: str
    department_fa: str
    pathway_en: str
    pathway_fa: str
    progress: float
    current_step_en: str | None
    current_step_fa: str | None
    blocked: bool
    los_hours: float


class PatientDetailOut(PatientOut):
    steps: list[CaseStepOut]
    care_team: list[CareTeamOut]
    messages: list[MessageOut]


class PathwayStepOut(ORMModel):
    id: int
    position: int
    name_en: str
    name_fa: str
    owner_role: str
    target_minutes: int


class PathwayOut(ORMModel):
    id: int
    code: str
    name_en: str
    name_fa: str
    description_en: str
    description_fa: str
    target_hours: float
    department_en: str | None
    department_fa: str | None
    steps: list[PathwayStepOut]
    active_cases: int
    adherence: float
    avg_hours: float


class AlertOut(ORMModel):
    id: int
    severity: str
    kind: str
    title_en: str
    title_fa: str
    detail_en: str
    detail_fa: str
    metric: str
    value: float
    acknowledged: bool
    created_at: datetime
    department_en: str | None
    department_fa: str | None


class IntegrationOut(ORMModel):
    id: int
    code: str
    name_en: str
    name_fa: str
    kind: str
    vendor: str
    status: str
    protocol: str
    latency_ms: int
    records_per_day: int
    last_sync_at: datetime


class RoiRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    beds: int = Field(default=300, ge=20, le=3000)
    occupancy_rate: float = Field(default=78, ge=30, le=100)
    avg_length_of_stay: float = Field(default=4.2, ge=0.5, le=30)
    bed_day_cost: float = Field(default=12.0, ge=0.5, le=500, description="Million IRT per bed-day")
    discharge_delay_minutes: float = Field(default=210, ge=0, le=1440)
    clinical_staff: int = Field(default=420, ge=5, le=20000)
    staff_hourly_cost: float = Field(default=0.9, ge=0.05, le=50, description="Million IRT per hour")
    paperwork_minutes_per_shift: float = Field(default=65, ge=0, le=480)
    annual_subscription: float = Field(default=7200, ge=0, le=200000, description="Million IRT per year")
    implementation_cost: float = Field(default=3000, ge=0, le=100000, description="One-off setup, million IRT")


class RoiLine(BaseModel):
    key: str
    label_en: str
    label_fa: str
    value: float
    detail_en: str
    detail_fa: str


class RoiResponse(BaseModel):
    currency: str = "million IRT"
    lines: list[RoiLine]
    annual_benefit: float          # steady-state, year two onwards
    annual_cost: float             # subscription only
    net_benefit: float             # first-year net, after implementation
    first_year_benefit: float
    first_year_cost: float
    roi_pct: float                 # first-year return on first-year cost
    steady_state_roi_pct: float
    payback_months: float
    bed_days_released: float
    staff_hours_recovered: float
    assumptions_en: list[str]
    assumptions_fa: list[str]


class LeadCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(min_length=2, max_length=120)
    organization: str = Field(min_length=2, max_length=160)
    role: str = Field(default="", max_length=120)
    email: EmailStr = Field(max_length=160)
    phone: str = Field(default="", max_length=40)
    beds: int = Field(default=0, ge=0, le=5000)
    message: str = Field(default="", max_length=2000)
    locale: Literal["fa", "en"] = "fa"
    website: str = Field(default="", max_length=200)  # honeypot: humans never see it


class LeadOut(ORMModel):
    id: int
    full_name: str
    organization: str
    email: str
    created_at: datetime
