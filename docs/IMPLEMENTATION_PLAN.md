# CareFlow Iran — Implementation Plan and Status

FastAPI + SQLAlchemy backend, Next.js 15 App Router frontend, Docker Compose for local and single-host runs.
Persian is the source language for UI text; English mirrors it.

## 1. What exists (verified)

| Area | State | Evidence |
|---|---|---|
| Backend API | Auth, overview, departments, alerts, patients, pathways, analytics, integrations, ROI, leads | 53 passing tests on the pinned dependency set |
| Authorisation | Roles, department / care-team scope, step ownership | `tests/test_security.py` |
| Frontend | Public site, ROI calculator, contact form, sign-in, seven authenticated screens, fa/en, RTL, light/dark, PWA shell | `tsc --noEmit` clean; production build result in `LAST_Report.md` |
| Dependencies | `pip-audit` 0, `npm audit` 0 | Run again in CI weekly |
| Containers and CI | Hardened Dockerfiles / compose, security workflow, Dependabot | Compose file validated; images **not built** in this session |

## 2. Architecture in one page

```
Browser (Next.js, fa/en, PWA)  ──HTTPS──▶  Reverse proxy (TLS, outside this repo)
                                              ├──▶ web  (Next standalone, :3000)
                                              └──▶ api  (FastAPI, :8000, one worker)
                                                        └──▶ db (Postgres 16, internal network only)
```

Backend modules: `config` (fail-closed settings) · `security` (hashing, tokens, roles, scope, rate limits, audit) ·
`routers/*` (HTTP only) · `analytics` (forecasting, pure Python) · `models` / `schemas` · `seed` (demo data, opt-in).

Two rules keep the security model intact:
1. Patient data is read only through the scoped loader in `routers/patients.py` (or `patient_scope` for lists).
2. New settings that relax security must be refused in production inside `config.py`.

## 3. Run it

Local demo (SQLite, no Docker):
```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
APP_ENV=development SEED_ON_STARTUP=true DEMO_MODE=true .venv/bin/python -m uvicorn app.main:app --port 8008
cd ../frontend && npm ci && NEXT_PUBLIC_API_URL=http://localhost:8008/api/v1 npm run dev
```
Docker:
```bash
cp .env.example .env     # fill JWT_SECRET and POSTGRES_PASSWORD; for a demo also set APP_ENV=development SEED_ON_STARTUP=true DEMO_MODE=true
docker compose up --build
```

## 4. Roadmap

Each item lists the acceptance check that says it is finished.

### Phase A — before any real user (security gates)
| # | Work | Done when |
|---|---|---|
| A1 | Alembic migrations, first revision = current schema plus indexes | Fresh and existing databases reach the same schema; CI runs `alembic upgrade head` |
| A2 | Cookie-based session (`HttpOnly`, `Secure`, `SameSite=Strict`) + CSRF token + refresh rotation | No token readable from JavaScript; regression test proves it |
| A3 | Redis for rate limits and revocation | Two API workers share limits; test with two processes |
| A4 | Nonce-based CSP | `script-src` has no `'unsafe-inline'`; Playwright smoke passes |
| A5 | MFA (TOTP) for manager and IT roles; password policy | Enrolment, login, recovery covered by tests |
| A6 | Replace constant KPI deltas with computed history | No literal delta in `overview.py` |

### Phase B — product
| # | Work | Done when |
|---|---|---|
| B1 | `records` read-only role (finding N8) | Matrix in `docs/SECURITY.md` updated; tests added |
| B2 | Real HIS / LIS connectors behind the integrations screen | One connector exchanges HL7 / FHIR messages in a sandbox |
| B3 | Notifications (SMS gateway) with consent and opt-out | Opt-out honoured within one send |
| B4 | Frontend tests: Playwright (both locales, both themes), axe on five screens | Run in CI, zero serious violations |
| B5 | Load test (k6) on patients, overview, pathways | p95 under 500 ms at 50 concurrent users on the target host |

### Phase C — mobile and install targets
The web app is already an installable PWA (manifest, icons, offline shell, service worker that never caches `/api/`).

| Target | Approach | Notes |
|---|---|---|
| Android APK / AAB | Trusted Web Activity (Bubblewrap) wrapping the PWA | Fastest path; needs a verified `assetlinks.json` on the production domain |
| iOS IPA | Capacitor shell around the same build | Apple expects native value beyond a web view; plan push notifications and biometric unlock |
| Both | Keep the token in Keystore / Keychain through a secure-storage plugin, certificate pinning for the API host, screen-capture blocking on patient screens | Do after A2 so the native and web session models match |

Build order: stabilise Phase A first; a mobile shell inherits every web weakness.

## 5. Definition of done for any change
- Backend tests pass, including the query-budget tests; new endpoints use `require_role` and the scoped loader.
- `pip-audit` and `npm audit --audit-level=high` clean.
- Persian text follows the UX vocabulary guide (for example «نادرست» rather than «اشتباه», «حذف» consistently for delete).
- Light, dark, RTL and LTR checked by eye on the changed screens.
- `docs/SECURITY.md` updated if a control, finding or residual risk changed.
