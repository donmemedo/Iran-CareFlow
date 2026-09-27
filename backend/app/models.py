"""ORM models for the hospital operations layer.

The schema mirrors the three product pillars of the business plan:
process standardisation (CarePathway/CaseStep), clinical collaboration
(Thread/Message/CareTeamMember) and predictive analytics (OccupancyRecord).
"""
from datetime import datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    """Naive UTC - the DateTime columns are timezone-free, so stay consistent."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name_en: Mapped[str] = mapped_column(String(120))
    name_fa: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(32))  # emergency | icu | ward | surgery | paraclinic
    bed_capacity: Mapped[int] = mapped_column(Integer, default=0)
    staff_count: Mapped[int] = mapped_column(Integer, default=0)

    patients: Mapped[list["Patient"]] = relationship(back_populates="department")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name_en: Mapped[str] = mapped_column(String(120))
    name_fa: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(32))  # manager | physician | nurse | it
    title_en: Mapped[str] = mapped_column(String(120), default="")
    title_fa: Mapped[str] = mapped_column(String(120), default="")
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
    avatar_hue: Mapped[int] = mapped_column(Integer, default=210)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class CarePathway(Base):
    __tablename__ = "care_pathways"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name_en: Mapped[str] = mapped_column(String(160))
    name_fa: Mapped[str] = mapped_column(String(160))
    description_en: Mapped[str] = mapped_column(Text, default="")
    description_fa: Mapped[str] = mapped_column(Text, default="")
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
    target_hours: Mapped[float] = mapped_column(Float, default=24.0)

    department: Mapped["Department | None"] = relationship()
    steps: Mapped[list["PathwayStep"]] = relationship(
        back_populates="pathway", order_by="PathwayStep.position", cascade="all, delete-orphan"
    )


class PathwayStep(Base):
    __tablename__ = "pathway_steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    pathway_id: Mapped[int] = mapped_column(ForeignKey("care_pathways.id"))
    position: Mapped[int] = mapped_column(Integer, default=0)
    name_en: Mapped[str] = mapped_column(String(160))
    name_fa: Mapped[str] = mapped_column(String(160))
    owner_role: Mapped[str] = mapped_column(String(32), default="nurse")
    target_minutes: Mapped[int] = mapped_column(Integer, default=60)

    pathway: Mapped[CarePathway] = relationship(back_populates="steps")


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True)
    mrn: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    name_en: Mapped[str] = mapped_column(String(120))
    name_fa: Mapped[str] = mapped_column(String(120))
    age: Mapped[int] = mapped_column(Integer)
    sex: Mapped[str] = mapped_column(String(8))
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"))
    pathway_id: Mapped[int] = mapped_column(ForeignKey("care_pathways.id"))
    bed: Mapped[str] = mapped_column(String(16), default="")
    acuity: Mapped[int] = mapped_column(Integer, default=3)  # 1 critical .. 5 minor
    status: Mapped[str] = mapped_column(String(24), default="active")  # active | discharged | blocked
    diagnosis_en: Mapped[str] = mapped_column(String(200), default="")
    diagnosis_fa: Mapped[str] = mapped_column(String(200), default="")
    admitted_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expected_discharge_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    discharged_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    risk_score: Mapped[float] = mapped_column(Float, default=0.2)

    department: Mapped[Department] = relationship(back_populates="patients")
    pathway: Mapped[CarePathway] = relationship()
    case_steps: Mapped[list["CaseStep"]] = relationship(
        back_populates="patient", order_by="CaseStep.position", cascade="all, delete-orphan"
    )
    care_team: Mapped[list["CareTeamMember"]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )
    messages: Mapped[list["Message"]] = relationship(
        back_populates="patient", order_by="Message.created_at", cascade="all, delete-orphan"
    )


class CaseStep(Base):
    """A pathway step instantiated for one patient - the audit trail of care."""

    __tablename__ = "case_steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    step_id: Mapped[int] = mapped_column(ForeignKey("pathway_steps.id"))
    position: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(24), default="pending")  # pending | active | done | blocked
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    note_en: Mapped[str] = mapped_column(Text, default="")
    note_fa: Mapped[str] = mapped_column(Text, default="")

    patient: Mapped[Patient] = relationship(back_populates="case_steps")
    step: Mapped[PathwayStep] = relationship()
    assignee: Mapped[User | None] = relationship()


class CareTeamMember(Base):
    __tablename__ = "care_team_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    role_en: Mapped[str] = mapped_column(String(80), default="")
    role_fa: Mapped[str] = mapped_column(String(80), default="")

    patient: Mapped[Patient] = relationship(back_populates="care_team")
    user: Mapped[User] = relationship()


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(24), default="note")  # note | request | decision | alert
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    patient: Mapped[Patient] = relationship(back_populates="messages")
    author: Mapped[User] = relationship()


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), nullable=True)
    severity: Mapped[str] = mapped_column(String(16), default="warning")  # good|warning|serious|critical
    kind: Mapped[str] = mapped_column(String(32), default="bottleneck")
    title_en: Mapped[str] = mapped_column(String(200))
    title_fa: Mapped[str] = mapped_column(String(200))
    detail_en: Mapped[str] = mapped_column(Text, default="")
    detail_fa: Mapped[str] = mapped_column(Text, default="")
    metric: Mapped[str] = mapped_column(String(64), default="")
    value: Mapped[float] = mapped_column(Float, default=0)
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    department: Mapped[Department | None] = relationship()


class OccupancyRecord(Base):
    __tablename__ = "occupancy_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"))
    day: Mapped[datetime] = mapped_column(Date, index=True)
    occupied_beds: Mapped[int] = mapped_column(Integer, default=0)
    capacity: Mapped[int] = mapped_column(Integer, default=0)
    admissions: Mapped[int] = mapped_column(Integer, default=0)
    discharges: Mapped[int] = mapped_column(Integer, default=0)
    ed_arrivals: Mapped[int] = mapped_column(Integer, default=0)
    avg_discharge_minutes: Mapped[float] = mapped_column(Float, default=0)

    department: Mapped[Department] = relationship()


class Integration(Base):
    __tablename__ = "integrations"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name_en: Mapped[str] = mapped_column(String(120))
    name_fa: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(24))  # HIS | LIS | PACS | SEPAS | HL7 | FHIR
    vendor: Mapped[str] = mapped_column(String(80), default="")
    status: Mapped[str] = mapped_column(String(24), default="connected")
    protocol: Mapped[str] = mapped_column(String(32), default="HL7 v2")
    latency_ms: Mapped[int] = mapped_column(Integer, default=120)
    records_per_day: Mapped[int] = mapped_column(Integer, default=0)
    last_sync_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Lead(Base):
    """Demo / pilot requests captured from the public site."""

    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120))
    organization: Mapped[str] = mapped_column(String(160))
    role: Mapped[str] = mapped_column(String(120), default="")
    email: Mapped[str] = mapped_column(String(160))
    phone: Mapped[str] = mapped_column(String(40), default="")
    beds: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str] = mapped_column(Text, default="")
    locale: Mapped[str] = mapped_column(String(8), default="fa")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
