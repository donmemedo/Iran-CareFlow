# CareFlow Iran — کِرفلو ایران

**سلامت‌داده نوین** · An operational and analytical layer on top of a hospital's existing HIS.

This is a working implementation of the business plan in `docs/source/` — the IBM Healthcare
model (process standardisation · clinical collaboration · predictive analytics) localised for
Iranian hospitals, as **CareFlow Iran**.

- **Frontend** — Next.js 15 (App Router), TypeScript, Tailwind CSS v4. Bilingual **fa/en** with
  true RTL, light/dark themes, fully responsive, PWA-ready.
- **Backend** — FastAPI + SQLAlchemy 2. JWT auth, a care-pathway workflow engine, a damped
  Holt-style forecaster, and the ROI model from the plan's financials.

---

## Quick start (Docker — recommended)

```bash
cp .env.example .env
python3 -c "import secrets; print(secrets.token_urlsafe(48))"   # run twice: JWT_SECRET and POSTGRES_PASSWORD
# edit .env: paste both values.
# For a local demo ONLY, also set:  APP_ENV=development  SEED_ON_STARTUP=true  DEMO_MODE=true
docker compose up --build
```

Compose refuses to start without `JWT_SECRET` and `POSTGRES_PASSWORD`, and the API refuses to boot in
production with a weak secret or any demo flag. That is deliberate.

| Service | URL |
|---|---|
| Web app | http://localhost:3100 → redirects to `/fa` |
| API docs | http://localhost:8008/docs (development only) |
| Postgres | internal network only, not published |

> Ports default to **3100/8008** and are bound to `127.0.0.1`; put a TLS reverse proxy in front for anything
> beyond your own machine. Change `WEB_PORT` / `API_PORT` in `.env` — and keep `PUBLIC_API_URL` in sync,
> since the browser (not the container) calls the API.

### Demo sign-in (demo mode only)

With `DEMO_MODE=true` and `SEED_ON_STARTUP=true` the sign-in screen lists four personas. Their shared
password is `DEMO_PASSWORD` (default `careflow`). Roles are enforced:

| Role | Email | Sees |
|---|---|---|
| Hospital operations director | `manager@careflow.ir` | everything |
| Attending physician (Internal Medicine) | `physician@careflow.ir` | own department + own care teams; may complete any step |
| Head nurse, emergency | `nurse@careflow.ir` | own department + own care teams; completes nurse steps |
| Head of health IT | `it@careflow.ir` | dashboards and integrations only — no patient records |

---|---|
| Hospital operations director | `manager@careflow.ir` |
| Attending physician | `physician@careflow.ir` |
| Head nurse, emergency | `nurse@careflow.ir` |
| Head of health IT | `it@careflow.ir` |

The sign-in screen lists these; clicking one fills the form.

---

## Running without Docker

**Backend**

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
APP_ENV=development SEED_ON_STARTUP=true DEMO_MODE=true .venv/bin/python -m uvicorn app.main:app --reload --port 8008
```

SQLite is the default (`careflow.db`). With an empty `JWT_SECRET` in development the server mints a random
secret per start, so tokens do not survive a restart.

**Frontend**

```bash
cd frontend
npm ci
NEXT_PUBLIC_API_URL=http://localhost:8008/api/v1 npm run dev
```

**Tests**

```bash
cd backend && .venv/bin/python -m pytest tests -q     # 53 API + security + query-budget tests, temp database
cd frontend && npm run build                          # type-check + production build
```

---

## What the product does

### 1. Process standardisation — `/app/pathways`
Five ready-made care pathways (emergency-to-ward, discharge, elective surgery, sepsis bundle,
chest pain). Each step carries an **owner role**, a **target time** and a status. The case board
shows every live patient sitting on their current step with elapsed time, so a bottleneck is
visible rather than anecdotal. Completing a step advances the case and stamps the audit trail.

### 2. Clinical collaboration — `/app/patients/[id]`, `/app/collaboration`
One documented thread per patient: care team, role-tagged messages (note / request / decision /
alert), and the pathway timeline beside it. This is the plan's "social network with colleagues",
bounded and auditable.

### 3. Predictive analytics — `/app/analytics`
Bed occupancy, emergency arrivals and nursing demand, forecast 7/14/30 days ahead with a
confidence band, plus the weekly load rhythm (Saturday-first, as Iran's week runs).

The model is **damped-trend double exponential smoothing with a weekly seasonal index**
(`backend/app/analytics.py`) — statistical now, ML-ready later, exactly the staging the plan
describes. Pure Python, no heavy dependencies.

### 4. Integration gateway — `/app/integrations`
Connection health for HIS, LIS, PACS, SEPAS, FHIR R4 and the notification gateway.

### 5. Public site — `/fa`, `/en`
Positioning, the three pillars, security posture, 90-day rollout, staged pricing from the plan,
a **live ROI calculator** backed by the API, and a pilot-request form that persists leads.

---

## The ROI model

`POST /api/v1/roi/calculate` (public). Deliberately conservative so the number survives a CFO
review — only the share of each gain a finance director would actually book is counted:

| Input driver | Modelled gain |
|---|---|
| Discharge turnaround | −45% → bed-days released |
| Average length of stay | −6% → bed-days released |
| Released bed-days | 55% re-filled, at a 28% contribution margin (not full revenue) |
| Paperwork / record hunting | −35%, of which 40% converts to avoided cost |
| Variable cost per bed-day | 1.5% waste and rework avoided |
| Year one | 65% of steady-state benefit, plus one-off implementation cost |

A 300-bed hospital lands around **104% first-year ROI with a ~6 month payback**, rising to ~345%
in steady state. All amounts are in million IRT, the plan's unit.

---

## Architecture

```
├── backend/                 FastAPI service
│   ├── app/
│   │   ├── models.py        Departments, users, pathways, patients, case steps,
│   │   │                    messages, alerts, occupancy history, integrations, leads
│   │   ├── analytics.py     Damped Holt forecaster + weekly seasonality
│   │   ├── seed.py          Deterministic 420-bed demo hospital, 180 days of history
│   │   ├── security.py      PBKDF2 password hashing + JWT
│   │   └── routers/         auth · overview · analytics · patients · pathways ·
│   │                        integrations · public (ROI, leads)
│   └── tests/               End-to-end API tests
├── frontend/                Next.js app
│   ├── src/app/[locale]/    Locale-rooted routes; `layout.tsx` sets lang + dir server-side,
│   │                        so RTL is correct on first paint (no flash)
│   ├── src/components/
│   │   ├── charts/          Hand-rolled SVG charts: forecast + band, load bars,
│   │   │                    diverging weekday bars, sparklines
│   │   ├── site/            Marketing sections, ROI calculator, contact form
│   │   └── app/             Dashboard shell and the seven authenticated views
│   ├── src/i18n/            fa.ts / en.ts dictionaries (fa is the source of truth)
│   └── public/              PWA manifest, icons, service worker, self-hosted Vazirmatn
└── docker-compose.yml       db (Postgres 16) · api · web
```

### Design decisions worth knowing

- **Persian is the source language.** `src/i18n/fa.ts` is authored first and `en.ts` is typed
  against it, so an English string can never silently go missing. Wording follows the Persian
  UX-writing conventions — پیش‌خوان for dashboard, اعلان‌ها, حساب کاربری, سفارش‌ها (never سفارشات).
- **Numerals and dates are localised properly.** `Intl` with `fa-IR-u-ca-persian` gives Persian
  digits and the Jalali calendar throughout — including the charts.
- **Charts are hand-built SVG**, not a charting library: one measure per axis, a single hue for
  observed-plus-forecast (the dash carries "forecast"), status colours reserved for genuinely
  unsafe occupancy, a legend plus a data-table view on every chart, and a colourblind-safe
  categorical order. Both themes are separately stepped rather than auto-inverted.
- **Charts render LTR inside RTL pages**, the convention for time series in Persian dashboards,
  while all labels stay Persian.
- **The service worker never caches `/api/`** — stale patient data is worse than no data.

---

## Next steps: PWA, APK and IPA

The PWA groundwork is already in place — `manifest.webmanifest`, maskable icons, an offline
shell, and an install button in **Settings** that uses `beforeinstallprompt`.

For native packages, wrap this same build with Capacitor:

```bash
cd frontend
npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/android @capacitor/ios
npx cap init CareFlow ir.careflow.app
npx cap add android && npx cap add ios
```

Point Capacitor's `server.url` at the deployed web app (or export a static build), then
`npx cap open android` for the APK in Android Studio, and `npx cap open ios` for the IPA in
Xcode — the latter needs macOS and an Apple developer account.

---

## Security notes

Full review, findings, attack tree and residual risk: [`docs/SECURITY.md`](docs/SECURITY.md).
Plan and roadmap: [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md).

In short: fail-closed configuration, role- and department-scoped access, login throttling with lockout,
revocable short-lived tokens, strict CORS and security headers, validated and size-capped inputs, hardened
containers, and CI that scans code, dependencies, secrets and images. Known gaps (token still in browser
storage, process-local rate limits, no migrations tool, no MFA) are listed there with the order to fix them.
Patient data in this repository is synthetic.
