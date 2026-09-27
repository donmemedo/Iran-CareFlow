"""Deterministic demo dataset for a mid-size Iranian hospital (~420 beds).

Numbers are synthetic but shaped after the business plan's target profile:
100+ bed hospitals with emergency crowding, slow discharge and manual handover.
"""
from __future__ import annotations

import random
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (
    Alert,
    CarePathway,
    CareTeamMember,
    CaseStep,
    Department,
    Integration,
    Message,
    OccupancyRecord,
    Patient,
    PathwayStep,
    User,
    utcnow,
)
from .security import hash_password

RNG = random.Random(1405)

DEPARTMENTS = [
    ("ED", "Emergency", "اورژانس", "emergency", 64, 96),
    ("ICU", "Intensive Care", "مراقبت‌های ویژه", "icu", 36, 84),
    ("CCU", "Cardiac Care", "مراقبت قلبی", "icu", 24, 48),
    ("INT", "Internal Medicine", "داخلی", "ward", 96, 74),
    ("SUR", "Surgery", "جراحی", "surgery", 84, 68),
    ("ORT", "Orthopaedics", "ارتوپدی", "ward", 48, 39),
    ("PED", "Paediatrics", "کودکان", "ward", 42, 44),
    ("LAB", "Laboratory & Imaging", "آزمایشگاه و تصویربرداری", "paraclinic", 0, 52),
]

USERS = [
    ("manager@careflow.ir", "manager", "Sara Ahmadi", "سارا احمدی", "Hospital Operations Director", "مدیر عملیات بیمارستان", None, 210),
    ("physician@careflow.ir", "physician", "Dr. Reza Kamali", "دکتر رضا کمالی", "Attending Physician, Internal Medicine", "پزشک معالج، داخلی", "INT", 28),
    ("nurse@careflow.ir", "nurse", "Mina Rostami", "مینا رستمی", "Head Nurse, Emergency", "سرپرستار اورژانس", "ED", 155),
    ("it@careflow.ir", "it", "Hamed Nouri", "حامد نوری", "Head of Health IT", "مدیر فناوری اطلاعات سلامت", None, 265),
    ("dr.moradi@careflow.ir", "physician", "Dr. Laleh Moradi", "دکتر لاله مرادی", "Intensivist, ICU", "متخصص مراقبت ویژه", "ICU", 340),
    ("dr.tabatabai@careflow.ir", "physician", "Dr. Kaveh Tabatabai", "دکتر کاوه طباطبایی", "Surgeon", "جراح", "SUR", 45),
    ("nurse.shirazi@careflow.ir", "nurse", "Neda Shirazi", "ندا شیرازی", "Charge Nurse, ICU", "پرستار مسئول شیفت ویژه", "ICU", 190),
    ("nurse.jafari@careflow.ir", "nurse", "Omid Jafari", "امید جعفری", "Staff Nurse, Surgery", "پرستار بخش جراحی", "SUR", 120),
    ("pharmacy@careflow.ir", "nurse", "Roya Salehi", "رویا صالحی", "Clinical Pharmacist", "داروساز بالینی", None, 300),
    ("records@careflow.ir", "it", "Behnam Azizi", "بهنام عزیزی", "Medical Records Officer", "کارشناس مدارک پزشکی", None, 88),
]

PATHWAYS = [
    (
        "ED-FLOW", "Emergency to Ward", "مسیر اورژانس تا بستری",
        "Standardised triage, work-up and admission decision for emergency arrivals.",
        "استانداردسازی تریاژ، بررسی اولیه و تصمیم بستری برای مراجعان اورژانس.",
        "ED", 8.0,
        [
            ("Triage", "تریاژ", "nurse", 10),
            ("Physician assessment", "ویزیت پزشک", "physician", 30),
            ("Lab & imaging orders", "درخواست آزمایش و تصویربرداری", "physician", 20),
            ("Results review", "بررسی نتایج", "physician", 90),
            ("Admission decision", "تصمیم بستری", "physician", 30),
            ("Bed assignment", "تخصیص تخت", "nurse", 45),
            ("Handover to ward", "تحویل به بخش", "nurse", 30),
        ],
    ),
    (
        "DISCHARGE", "Discharge Pathway", "مسیر ترخیص",
        "From discharge decision to bed release - the plan's headline KPI.",
        "از تصمیم ترخیص تا آزادسازی تخت - شاخص کلیدی طرح کسب‌وکار.",
        "INT", 5.0,
        [
            ("Discharge decision", "تصمیم ترخیص", "physician", 20),
            ("Medication reconciliation", "تطبیق دارویی", "nurse", 40),
            ("Patient education", "آموزش بیمار", "nurse", 30),
            ("Insurance & billing clearance", "تسویه بیمه و صورت‌حساب", "manager", 60),
            ("Discharge summary", "خلاصه پرونده", "physician", 30),
            ("Bed release & cleaning", "آزادسازی و نظافت تخت", "nurse", 45),
        ],
    ),
    (
        "SURG", "Elective Surgery", "جراحی الکتیو",
        "Pre-op readiness, theatre slot and post-op recovery milestones.",
        "آمادگی پیش از عمل، نوبت اتاق عمل و مراحل ریکاوری.",
        "SUR", 36.0,
        [
            ("Pre-op assessment", "ارزیابی پیش از عمل", "physician", 60),
            ("Anaesthesia clearance", "تأیید بیهوشی", "physician", 45),
            ("Consent & checklist", "رضایت و چک‌لیست ایمنی", "nurse", 20),
            ("Theatre slot", "نوبت اتاق عمل", "manager", 120),
            ("Operation", "عمل جراحی", "physician", 180),
            ("Recovery monitoring", "پایش ریکاوری", "nurse", 240),
            ("Ward transfer", "انتقال به بخش", "nurse", 45),
        ],
    ),
    (
        "ICU-SEP", "Sepsis Bundle", "بسته مراقبت سپسیس",
        "Time-critical sepsis bundle with hourly targets.",
        "بسته زمان‌محور سپسیس با اهداف ساعتی.",
        "ICU", 6.0,
        [
            ("Sepsis screening", "غربالگری سپسیس", "nurse", 15),
            ("Blood cultures", "کشت خون", "nurse", 30),
            ("Antibiotics within 1h", "آنتی‌بیوتیک در یک ساعت", "physician", 60),
            ("Fluid resuscitation", "احیای مایعات", "nurse", 90),
            ("Lactate re-check", "کنترل مجدد لاکتات", "nurse", 120),
            ("Escalation review", "بازبینی ارتقای مراقبت", "physician", 60),
        ],
    ),
    (
        "CARDIO", "Chest Pain Pathway", "مسیر درد قفسه سینه",
        "Door-to-ECG and door-to-balloon tracking for cardiac cases.",
        "پایش زمان تا نوار قلب و تا آنژیوپلاستی برای بیماران قلبی.",
        "CCU", 4.0,
        [
            ("Door to ECG", "زمان تا نوار قلب", "nurse", 10),
            ("Troponin panel", "پنل تروپونین", "nurse", 45),
            ("Cardiology consult", "مشاوره قلب", "physician", 30),
            ("Cath lab activation", "فعال‌سازی آنژیوگرافی", "manager", 30),
            ("Intervention", "مداخله", "physician", 90),
            ("CCU transfer", "انتقال به سی‌سی‌یو", "nurse", 30),
        ],
    ),
]

FIRST_FA = ["علی", "زهرا", "محمد", "فاطمه", "حسین", "مریم", "امیر", "نرگس", "رضا", "سمیرا", "مهدی", "الهام", "سعید", "پریسا", "کاوه", "آیدا", "بهزاد", "شیوا", "نیما", "رعنا"]
LAST_FA = ["رضایی", "محمدی", "حسینی", "کریمی", "موسوی", "نجفی", "قاسمی", "صادقی", "اکبری", "زارع", "شریفی", "عباسی", "کاظمی", "رحیمی", "یوسفی"]
FIRST_EN = ["Ali", "Zahra", "Mohammad", "Fatemeh", "Hossein", "Maryam", "Amir", "Narges", "Reza", "Samira", "Mehdi", "Elham", "Saeed", "Parisa", "Kaveh", "Aida", "Behzad", "Shiva", "Nima", "Rana"]
LAST_EN = ["Rezaei", "Mohammadi", "Hosseini", "Karimi", "Mousavi", "Najafi", "Ghasemi", "Sadeghi", "Akbari", "Zare", "Sharifi", "Abbasi", "Kazemi", "Rahimi", "Yousefi"]

DIAGNOSES = [
    ("Community-acquired pneumonia", "پنومونی اکتسابی از جامعه"),
    ("Acute coronary syndrome", "سندرم حاد کرونری"),
    ("Decompensated heart failure", "نارسایی قلبی جبران‌نشده"),
    ("Sepsis, urinary source", "سپسیس با منشأ ادراری"),
    ("Femur fracture", "شکستگی استخوان ران"),
    ("Acute appendicitis", "آپاندیسیت حاد"),
    ("Diabetic ketoacidosis", "کتواسیدوز دیابتی"),
    ("COPD exacerbation", "تشدید بیماری انسدادی ریه"),
    ("Ischaemic stroke", "سکته مغزی ایسکمیک"),
    ("Acute gastroenteritis", "گاستروانتریت حاد"),
    ("Elective cholecystectomy", "کوله‌سیستکتومی الکتیو"),
    ("Renal colic", "کولیک کلیوی"),
]

MESSAGES = [
    ("request", "Radiology asked for the contrast consent before the CT slot at 14:30.", "رادیولوژی پیش از نوبت سی‌تی ساعت ۱۴:۳۰ رضایت تزریق ماده حاجب را خواست."),
    ("note", "Family briefed on the care plan; son is the contact person.", "برنامه درمان برای خانواده توضیح داده شد؛ پسر بیمار رابط است."),
    ("decision", "Antibiotics de-escalated to oral after 48h of stable vitals.", "پس از ۴۸ ساعت پایداری علائم حیاتی، آنتی‌بیوتیک به خوراکی تغییر کرد."),
    ("alert", "Lab flagged a critical potassium value - repeat sample requested.", "آزمایشگاه مقدار بحرانی پتاسیم را گزارش کرد - نمونه مجدد درخواست شد."),
    ("note", "Physiotherapy started; patient mobilised to the corridor twice today.", "فیزیوتراپی آغاز شد؛ بیمار امروز دو بار در راهرو راه رفت."),
    ("request", "Insurance clearance still pending - billing needs the updated summary.", "تسویه بیمه هنوز انجام نشده - واحد صورت‌حساب خلاصه به‌روز می‌خواهد."),
    ("decision", "Discharge planned for tomorrow morning if the morning labs are clean.", "در صورت طبیعی بودن آزمایش صبح، ترخیص فردا صبح برنامه‌ریزی شد."),
    ("note", "Night shift handover completed through the pathway checklist.", "تحویل شیفت شب از طریق چک‌لیست مسیر مراقبت انجام شد."),
]

INTEGRATIONS = [
    ("HIS-CORE", "Hospital Information System", "سامانه اطلاعات بیمارستانی", "HIS", "Rayavaran", "connected", "HL7 v2.5", 140, 48200),
    ("LIS-LAB", "Laboratory Information System", "سامانه اطلاعات آزمایشگاه", "LIS", "Negin Lab", "connected", "HL7 v2.5 / ASTM", 95, 15600),
    ("PACS-IMG", "Imaging Archive", "بایگانی تصویربرداری", "PACS", "MedView", "connected", "DICOM C-FIND", 210, 3400),
    ("SEPAS", "National Health Record Gateway", "درگاه پرونده الکترونیک سلامت", "SEPAS", "Ministry of Health", "degraded", "SOAP / SEPAS", 640, 9100),
    ("FHIR-API", "FHIR Interoperability Layer", "لایه هم‌کنش‌پذیری FHIR", "FHIR", "CareFlow", "connected", "FHIR R4", 70, 22800),
    ("SMS-GW", "Notification Gateway", "درگاه اعلان و پیامک", "HL7", "Kavenegar", "connected", "REST", 55, 6200),
]


def _clear(db: Session) -> None:
    for model in (Message, CareTeamMember, CaseStep, Alert, OccupancyRecord, Patient, PathwayStep, CarePathway, Integration, User, Department):
        db.query(model).delete()
    db.commit()


def _seasonal_load(day: date) -> float:
    """Respiratory season lifts winter demand; Nowruz holidays dip it."""
    month = day.month
    winter_wave = {11: 1.10, 12: 1.16, 1: 1.18, 2: 1.12, 3: 1.04}.get(month, 1.0)
    summer_dip = 0.94 if month in (6, 7) else 1.0
    nowruz = 0.88 if (month == 3 and day.day >= 20) or (month == 4 and day.day <= 2) else 1.0
    return winter_wave * summer_dip * nowruz


def seed(db: Session, *, force: bool = False) -> None:
    if not force and db.execute(select(Department.id).limit(1)).first():
        return
    _clear(db)

    departments: dict[str, Department] = {}
    for code, name_en, name_fa, kind, beds, staff in DEPARTMENTS:
        dept = Department(code=code, name_en=name_en, name_fa=name_fa, kind=kind, bed_capacity=beds, staff_count=staff)
        db.add(dept)
        departments[code] = dept
    db.flush()

    users: list[User] = []
    for email, role, name_en, name_fa, title_en, title_fa, dept_code, hue in USERS:
        user = User(
            email=email,
            password_hash=hash_password("careflow"),
            name_en=name_en,
            name_fa=name_fa,
            role=role,
            title_en=title_en,
            title_fa=title_fa,
            department_id=departments[dept_code].id if dept_code else None,
            avatar_hue=hue,
        )
        db.add(user)
        users.append(user)
    db.flush()

    pathways: list[CarePathway] = []
    for code, name_en, name_fa, desc_en, desc_fa, dept_code, target_hours, steps in PATHWAYS:
        pathway = CarePathway(
            code=code,
            name_en=name_en,
            name_fa=name_fa,
            description_en=desc_en,
            description_fa=desc_fa,
            department_id=departments[dept_code].id,
            target_hours=target_hours,
        )
        db.add(pathway)
        db.flush()
        for position, (step_en, step_fa, owner, minutes) in enumerate(steps):
            db.add(
                PathwayStep(
                    pathway_id=pathway.id,
                    position=position,
                    name_en=step_en,
                    name_fa=step_fa,
                    owner_role=owner,
                    target_minutes=minutes,
                )
            )
        pathways.append(pathway)
    db.flush()

    for code, name_en, name_fa, kind, vendor, status, protocol, latency, volume in INTEGRATIONS:
        db.add(
            Integration(
                code=code,
                name_en=name_en,
                name_fa=name_fa,
                kind=kind,
                vendor=vendor,
                status=status,
                protocol=protocol,
                latency_ms=latency,
                records_per_day=volume,
                last_sync_at=utcnow() - timedelta(minutes=RNG.randint(1, 55)),
            )
        )

    _seed_occupancy(db, departments)
    _seed_patients(db, departments, pathways, users)
    _seed_alerts(db, departments)
    db.commit()


def _seed_occupancy(db: Session, departments: dict[str, Department]) -> None:
    today = date.today()
    for dept in departments.values():
        if dept.bed_capacity == 0:
            continue
        base_rate = {"emergency": 0.86, "icu": 0.89, "ward": 0.74, "surgery": 0.7}.get(dept.kind, 0.75)
        for offset in range(179, -1, -1):
            day = today - timedelta(days=offset)
            weekday_factor = 1.06 if day.weekday() in (5, 6) else 1.0  # Sat/Sun peak in Iran's week
            noise = RNG.gauss(0, 0.035)
            rate = min(0.99, max(0.42, base_rate * _seasonal_load(day) * weekday_factor + noise))
            occupied = round(dept.bed_capacity * rate)
            admissions = max(0, round(occupied / max(dept.bed_capacity, 1) * RNG.uniform(6, 14)))
            db.add(
                OccupancyRecord(
                    department_id=dept.id,
                    day=day,
                    occupied_beds=occupied,
                    capacity=dept.bed_capacity,
                    admissions=admissions,
                    discharges=max(0, admissions + RNG.randint(-3, 3)),
                    ed_arrivals=round(RNG.uniform(70, 130) * _seasonal_load(day)) if dept.kind == "emergency" else 0,
                    avg_discharge_minutes=max(45, RNG.gauss(196 - offset * 0.32, 22)),
                )
            )


def _seed_patients(db: Session, departments: dict[str, Department], pathways: list[CarePathway], users: list[User]) -> None:
    now = utcnow()
    clinicians = [u for u in users if u.role in ("physician", "nurse")]
    ward_codes = ["ED", "ICU", "CCU", "INT", "SUR", "ORT", "PED"]
    for index in range(96):
        dept = departments[RNG.choice(ward_codes)]
        pathway = next((p for p in pathways if p.department_id == dept.id), RNG.choice(pathways))
        first_index = RNG.randrange(len(FIRST_FA))
        last_index = RNG.randrange(len(LAST_FA))
        diagnosis_en, diagnosis_fa = RNG.choice(DIAGNOSES)
        admitted = now - timedelta(hours=RNG.uniform(2, 190))
        acuity = RNG.choices([1, 2, 3, 4, 5], weights=[6, 18, 38, 26, 12])[0]
        patient = Patient(
            mrn=f"MRN-{140500 + index}",
            name_en=f"{FIRST_EN[first_index]} {LAST_EN[last_index]}",
            name_fa=f"{FIRST_FA[first_index]} {LAST_FA[last_index]}",
            age=RNG.randint(3, 92) if dept.code != "PED" else RNG.randint(1, 15),
            sex=RNG.choice(["male", "female"]),
            department_id=dept.id,
            pathway_id=pathway.id,
            bed=f"{dept.code}-{RNG.randint(1, max(dept.bed_capacity, 10)):02d}",
            acuity=acuity,
            status="active",
            diagnosis_en=diagnosis_en,
            diagnosis_fa=diagnosis_fa,
            admitted_at=admitted,
            expected_discharge_at=admitted + timedelta(hours=RNG.uniform(24, 180)),
            risk_score=round(min(0.97, max(0.03, RNG.gauss(0.62 - acuity * 0.09, 0.14))), 2),
        )
        db.add(patient)
        db.flush()

        steps = sorted(pathway.steps, key=lambda s: s.position)
        progress_index = RNG.randrange(1, len(steps) + 1)
        blocked = RNG.random() < 0.16
        cursor = admitted
        for position, step in enumerate(steps):
            if position < progress_index - 1:
                status = "done"
            elif position == progress_index - 1:
                status = "blocked" if blocked else "active"
            else:
                status = "pending"
            if status == "pending":
                started = None
            elif status == "done":
                started = cursor
            else:
                # The step someone is working on right now must have started
                # recently - otherwise the board shows a triage running six days.
                elapsed = step.target_minutes * (
                    RNG.uniform(0.2, 1.1) if RNG.random() < 0.7 else RNG.uniform(1.3, 2.8)
                )
                started = now - timedelta(minutes=elapsed)
            # Most steps land near target; a tail of overruns keeps adherence honest.
            factor = RNG.uniform(0.55, 1.15) if RNG.random() < 0.72 else RNG.uniform(1.3, 2.6)
            duration = timedelta(minutes=step.target_minutes * factor)
            completed = cursor + duration if status == "done" else None
            if completed:
                cursor = completed + timedelta(minutes=RNG.uniform(5, 70))
            db.add(
                CaseStep(
                    patient_id=patient.id,
                    step_id=step.id,
                    position=position,
                    status=status,
                    assignee_id=RNG.choice(clinicians).id,
                    started_at=started,
                    completed_at=completed,
                )
            )

        team = RNG.sample(clinicians, k=RNG.randint(2, 4))
        for member in team:
            db.add(
                CareTeamMember(
                    patient_id=patient.id,
                    user_id=member.id,
                    role_en=member.title_en,
                    role_fa=member.title_fa,
                )
            )
        for kind, body_en, body_fa in RNG.sample(MESSAGES, k=RNG.randint(2, 4)):
            author = RNG.choice(team)
            db.add(
                Message(
                    patient_id=patient.id,
                    author_id=author.id,
                    body=f"{body_fa}\n---\n{body_en}",
                    kind=kind,
                    created_at=now - timedelta(hours=RNG.uniform(0.5, 72)),
                )
            )


def _seed_alerts(db: Session, departments: dict[str, Department]) -> None:
    now = utcnow()
    specs = [
        ("ED", "critical", "bottleneck", "Emergency boarding above 6 hours", "معطلی اورژانس بیش از ۶ ساعت",
         "11 patients are waiting for an inpatient bed; internal medicine has the longest queue.",
         "۱۱ بیمار در انتظار تخت بستری هستند؛ بلندترین صف مربوط به بخش داخلی است.", "ed_boarding", 6.4),
        ("INT", "serious", "discharge", "Discharge summaries delayed", "تأخیر در خلاصه پرونده ترخیص",
         "9 discharge summaries are older than 4 hours, holding 9 beds.",
         "۹ خلاصه پرونده بیش از ۴ ساعت معطل مانده و ۹ تخت را اشغال کرده است.", "discharge_delay", 4.2),
        ("ICU", "warning", "capacity", "ICU occupancy forecast above 92%", "پیش‌بینی اشغال ویژه بالای ۹۲٪",
         "The 7-day forecast crosses the safe ceiling next Tuesday.",
         "پیش‌بینی هفت‌روزه، سه‌شنبه آینده از سقف ایمن عبور می‌کند.", "icu_forecast", 92.6),
        ("LAB", "warning", "integration", "SEPAS gateway latency", "کندی درگاه سپاس",
         "Average response time is 640 ms, above the 400 ms SLA.",
         "میانگین زمان پاسخ ۶۴۰ میلی‌ثانیه است و از تعهد ۴۰۰ میلی‌ثانیه بیشتر است.", "sepas_latency", 640),
        ("SUR", "good", "pathway", "Surgery pathway adherence improved", "بهبود پایبندی مسیر جراحی",
         "Pre-op checklist completion reached 94% this week.",
         "تکمیل چک‌لیست پیش از عمل این هفته به ۹۴٪ رسید.", "pathway_adherence", 94),
        ("CCU", "serious", "clinical", "Door-to-ECG target missed twice", "دو بار عدم تحقق زمان تا نوار قلب",
         "Two chest-pain cases exceeded the 10-minute ECG target overnight.",
         "دو مورد درد قفسه سینه در شب از هدف ۱۰ دقیقه‌ای نوار قلب عبور کردند.", "door_to_ecg", 14),
    ]
    for dept_code, severity, kind, title_en, title_fa, detail_en, detail_fa, metric, value in specs:
        db.add(
            Alert(
                department_id=departments[dept_code].id,
                severity=severity,
                kind=kind,
                title_en=title_en,
                title_fa=title_fa,
                detail_en=detail_en,
                detail_fa=detail_fa,
                metric=metric,
                value=value,
                created_at=now - timedelta(minutes=RNG.randint(5, 600)),
            )
        )
