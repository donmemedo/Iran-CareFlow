> **Superseded (2026-10-22).** The findings below were acted on in branch `security-hardening-2026-10`.
> Current state, evidence and what is still open: [`LAST_Report.md`](LAST_Report.md) and [`docs/SECURITY.md`](docs/SECURITY.md).
> Keep this file for history only; its "no fixes applied yet" status is no longer true.

# CareFlow Iran — Audit & Hardening Handoff

**Purpose:** session handoff so any model/agent can continue the work without re-scouting.
**Last updated:** 2026-10-02
**Status:** audit (read-only) ~80% done. **No fixes applied yet.** No project files modified.

---

## 1. Original task (from the user)

> Use red-team and blue-team agents + security skills to audit and solve all problems; do a
> pentest of this project; add **performance** improvements alongside every security change; for
> UI/UX use the `/apple-design` skill. Budget: unlimited tokens, finish under 5 hours.

So the deliverable is three-fold, and each item must be **fixed**, not just reported:
1. **Security** — pentest + fix findings (red team finds, blue team hardens).
2. **Performance** — pair a perf improvement with each area touched.
3. **UI/UX** — apply Apple-design (`/apple-design` skill) principles to the frontend.

This is the owner's **own** app on their **own** dev box with **synthetic** data — authorized
defensive work. Treat it as a normal secure-coding / hardening task.

---

## 2. Project shape (already scouted — don't re-scan)

**CareFlow Iran** — operational layer over a hospital HIS. Bilingual fa/en, RTL-first, PWA.

```
backend/   FastAPI + SQLAlchemy 2, Python 3.12. SQLite dev / Postgres prod.
  app/main.py            app factory, CORS, router mounting, /health
  app/config.py          pydantic-settings (jwt_secret, cors, ttl, seed flag)
  app/db.py              engine + SessionLocal + get_db
  app/security.py        PBKDF2 hashing + JWT encode/decode + current_user dep
  app/schemas.py         Pydantic DTOs
  app/models.py          ORM: Department, User, CarePathway, PathwayStep, Patient,
                         CaseStep, CareTeamMember, Message, Alert, OccupancyRecord,
                         Integration, Lead
  app/seed.py            deterministic demo data (~420-bed hospital, 180 days history)
  app/analytics.py       damped Holt forecaster + weekly seasonality (pure Python)
  app/routers/           auth, overview, analytics, patients, pathways, integrations, public
  tests/test_api.py      11 e2e tests (ALL PASS at baseline)
frontend/  Next.js 15.1.6 App Router, React 19, Tailwind v4, motion 11, next-themes
  src/app/[locale]/      locale-rooted routes; layout.tsx sets lang+dir server-side
  src/components/app/    dashboard shell + 7 authed views
  src/components/site/   marketing, ROI calculator, contact form
  src/components/charts/ hand-rolled SVG charts
  src/lib/               api.ts (fetch+token), session.tsx, use-api.ts, format.ts
  src/i18n/              fa.ts (source of truth), en.ts
  public/sw.js           offline service worker (never caches /api/)
  next.config.ts         standalone output, 3 security headers, redirects
docker-compose.yml  db(postgres16) + api + web
.env / .env.example  WEB_PORT=3100 API_PORT=8008, JWT_SECRET, CORS_ORIGINS, SEED_ON_STARTUP
```

**Note:** root `main.py` (staged `AD` in git) is the leftover PyCharm `print_hi` sample — delete it,
it is not part of the app.

---

## 3. Environment / running services (current session)

- **Live API running:** `http://127.0.0.1:8008` (uvicorn, SQLite, seeded). Started with:
  ```
  cd backend && .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8008
  ```
  (The `.venv/bin/uvicorn` shebang points at a stale path — **must** use `python -m uvicorn`.)
  Log: `/tmp/claude-1000/.../scratchpad/api.log`. It may have been reaped; re-check with
  `curl -s http://127.0.0.1:8008/health`.
- **Scanners installed** in `/tmp/claude-1000/-home-makhataei-Projects-Mine-Iran-CareFlow/<session>/scratchpad/tools/bin`:
  `bandit` 1.9.4, `pip-audit` 2.10.1.
- **Demo users** (password `careflow` for all): `manager@`, `physician@`, `nurse@`, `it@`,
  `dr.moradi@`, `nurse.shirazi@`, `pharmacy@`, `records@` (all `@careflow.ir`).

### ⚠️ Machine constraint — READ THIS FIRST
The box is **critically low on RAM** (~15.9 GB total, ~200 MB free, swap ~95% full; many other
`claude` processes resident). Consequences you must plan around:
- **`npm run build` / `next build` was started and KILLED by the OOM reaper.** Frontend build is
  **unverified**. Run it only when memory frees up, and expect it may need to be the only heavy
  process running.
- Full `pytest` suite takes **~3 minutes** (seeding 180 days of data is slow) — budget for it.
- Do **not** run docker, semgrep, parallel heavy agents, or multiple node processes at once.
- Prefer short `curl` / `python -m` one-liners.

---

## 4. Baseline verification done

| Check | Result |
|---|---|
| `backend/.venv/bin/python -m pytest tests -q` | **11 passed** (181 s) |
| API `/health` | 200 OK |
| `npm audit` (frontend) | 3 vulns: 1 critical, 2 high (see §5) |
| `bandit -r backend/app` | 1 low (seed RNG, false positive) |
| `pip-audit -r backend/requirements.txt` | **48 vulns across 4 packages** (see §5) |
| `next build` | **NOT RUN — OOM-killed.** Must verify before claiming done. |

---

## 5. Findings (from code review + scanners) — the fix list

Severity is my read; verify before acting. Items are ordered hardest-hitting first.
**Nothing below has been fixed yet.**

### SECURITY

**S1 — CORS falls back to wildcard with credentials. [HIGH]**
`backend/app/main.py:41` — `allow_origins=settings.cors_origin_list or ["*"]` together with
`allow_credentials=True` and `allow_methods=["*"]`, `allow_headers=["*"]`. If `CORS_ORIGINS` is ever
empty, every origin is trusted with credentials (browsers reject `*`+credentials, but the config is
wrong in intent and brittle). **Fix:** never fall back to `["*"]`; require an explicit allowlist;
fail closed if empty. Narrow methods/headers to what's used.

**S2 — Default/weak JWT secret shipped in config and compose. [HIGH / CRITICAL if deployed]**
`backend/app/config.py:13` default `"careflow-dev-secret-change-me"`; root `.env` has
`JWT_SECRET=change-me-in-production`; `docker-compose.yml` defaults the same. Anyone who knows the
default can **forge admin tokens**. **Fix:** no insecure default — require `JWT_SECRET` from env and
refuse to boot (or generate ephemeral + warn) if it's missing/default. Document generating a strong
secret. Confirmed the live instance uses a known default (tokens are forgeable locally).

**S3 — No authorization / RBAC; every authenticated user can do everything. [HIGH]**
`role` is embedded in the JWT (`security.py:39`) but **never checked**. A `nurse` token can read any
patient across any department, advance any pathway step, post messages as a care-team member,
acknowledge any alert. Routers only gate on `current_user` (presence of a valid token). See
`routers/patients.py`, `pathways.py`, `overview.py`. **Fix:** add a role/dependency layer
(e.g. `require_role(...)`), and scope patient/department access to the user's department where the
domain calls for it. This is the biggest "solve all problems" item.

**S4 — No rate limiting on login (or anywhere); shared weak password. [MEDIUM-HIGH]**
`routers/auth.py` `/auth/login` has no throttle/lockout → credential brute-force. All demo accounts
share `careflow`. **Fix:** add rate limiting (e.g. slowapi / a dependency) on `/auth/login` and
public write endpoints; add lockout/backoff; for any real use, per-user strong passwords.

**S5 — Public demo-user enumeration. [MEDIUM]**
`routers/auth.py:27` `/auth/demo-users` returns persona emails/titles **without auth**. Account
enumeration + fills the login form. **Fix:** acceptable for a demo, but gate behind a
`SEED_ON_STARTUP`/`DEMO_MODE` flag so it disappears in production.

**S6 — JWT in `localStorage`; logout is client-only; 12 h TTL; no revocation. [MEDIUM]**
`frontend/src/lib/api.ts` stores token + user in `localStorage` (XSS-exfiltratable).
`clearSession()` just deletes local keys — the token stays valid server-side for up to 12 h
(`config.py:15` `access_token_ttl_minutes = 60*12`). **Fix:** prefer httpOnly+SameSite cookie, or at
minimum shorten TTL, add refresh, and a server-side deny-list / `jti` for logout. Pair with a strict
CSP (S10) to blunt XSS.

**S7 — Unauthenticated public writes: leads + ROI, no abuse control. [MEDIUM]**
`routers/public.py:133` `/leads` (DB insert) and `:26` `/roi/calculate` are unauthenticated with no
rate limit / CAPTCHA / size caps beyond Pydantic. Spam/DoS vector. **Fix:** rate limit, bound sizes,
consider a lightweight bot check on `/leads`.

**S8 — Vulnerable Python dependencies — 48 advisories. [HIGH]**
`pip-audit -r backend/requirements.txt`:
- **pyjwt 2.10.1** — many PYSEC-2026-* advisories (fixed 2.12.0 → 2.15.0). Directly in the auth path
  → **upgrade to latest 2.15.x**.
- **python-multipart 0.0.20** — PYSEC-2026-* (fixed up to 0.0.31) → upgrade.
- **starlette 0.41.3** (transitive via fastapi) — PYSEC-2026-1941/1942/161 (fixed 0.47.2 / 0.49.1 /
  1.0.1) → bump fastapi so starlette moves up.
- **pytest 8.3.4** — PYSEC-2026-1845 (fixed 9.0.3), test-only, low priority.
**Fix:** bump pins in `requirements.txt`, re-run `pip-audit` and the test suite. Watch for the
fastapi/starlette/pydantic compatibility matrix.

**S9 — Vulnerable npm dependencies — 3 (1 critical). [HIGH]**
`npm audit` (frontend):
- **next 15.1.6 — CRITICAL** (dev-server origin info exposure; DoS via cache poisoning). Advisory
  range up to the 16.x line. **Upgrade Next.js** (test the build carefully; 15→16 may have breaking
  changes — check release notes).
- **postcss ≤8.5.22 — HIGH** (XSS via unescaped `</style>`; arbitrary file read via
  sourceMappingURL). Transitive — bump via tooling.
- **sharp ≤0.35.4-rc.0 — HIGH** (libvips/libheif CVEs). Transitive via Next image optimization.
**Fix:** `npm audit fix` where safe; for Next, do the major bump deliberately and re-verify build.

**S10 — Missing hardening headers (no CSP, HSTS, Permissions-Policy). [MEDIUM]**
`frontend/next.config.ts` sets only `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`.
**Fix:** add `Content-Security-Policy` (big XSS mitigation, pairs with S6), `Strict-Transport-Security`,
`Permissions-Policy`, and consider `Cross-Origin-Opener-Policy`. Backend responses could also carry
security headers via middleware.

**S11 — PBKDF2 iteration count low for 2026. [LOW]**
`backend/app/security.py:19` `_ITERATIONS = 120_000`. OWASP 2024+ guidance for PBKDF2-SHA256 is
~600k. **Fix:** raise iterations (or move to argon2/bcrypt), and rehash-on-login for upgrade.

**S12 — `SEED_ON_STARTUP=true` default re-seeds every boot. [LOW]**
`config.py:17` + `.env`. Guarantees demo accounts always exist. **Fix:** default false; only seed on
explicit opt-in.

**S-INFO — bandit:** only `B311` (seed.py `random.Random(1405)`) — **false positive**, it's
deterministic demo data, not security-sensitive. Suppress with `# nosec B311` or ignore.

### PERFORMANCE (pair these with the security work)

**P1 — `GET /overview` loads whole tables into Python. [HIGH]**
`routers/overview.py` pulls **all** `OccupancyRecord`, **all** `CaseStep`, **all** `PathwayStep`
then aggregates in Python (`_daily_totals`, adherence loops). Scales O(history×departments).
**Fix:** push aggregation into SQL (`func.sum/avg`, `group_by(day)`), or precompute. Biggest API win.

**P2 — N+1 lazy loads on patient/pathway lists. [HIGH]**
`routers/patients.py` `_to_out` touches `patient.department`, `.pathway`, `.case_steps[].step` per
patient; `list_patients` loads **all** patients then filters/searches in Python.
`routers/pathways.py` `_pathway_out` walks every active patient's `case_steps`.
**Fix:** `selectinload`/`joinedload` eager loading; move `status`/`department`/search filters and the
`limit` into the SQL query (currently `blocked`/`q`/`limit` are applied post-fetch in Python).

**P3 — No response compression. [MEDIUM]**
No GZip middleware on FastAPI; JSON payloads (overview, occupancy history) ship uncompressed.
**Fix:** add `GZipMiddleware`. Frontend/Next already compresses its own output.

**P4 — Missing DB indexes for common filters. [MEDIUM]**
Queries filter `Patient.status`, `Patient.department_id`, `OccupancyRecord.department_id` +
`day`; only some have indexes (`OccupancyRecord.day`, unique `mrn`). **Fix:** add composite/column
indexes matching the hot filters.

**P5 — Analytics recomputes forecasts per request. [LOW-MEDIUM]**
`routers/analytics.py` runs `holt_forecast` over 90–180 days on every call, per department in
`resource-demand`. **Fix:** cache per (department, day) with a short TTL; data only changes daily.

### UI/UX — Apple-design (`/apple-design` skill loaded this session)

Observations from `globals.css`, `ui.tsx`, `app-shell.tsx` (apply the skill's principles):

**U1 — Motion uses fixed-duration tweens, not velocity-aware springs. [MEDIUM]**
`login-view.tsx` animates with `duration: 0.55/0.6`; `ui.tsx:227` progress bar
`transition-[width] duration-700`; `app-shell.tsx:225` `duration: 0.16`. Apple-design favors
**springs** (critically damped `bounce:0, duration:0.3–0.4` by default; a little bounce only after a
momentum gesture) and **interruptible** motion. The one good spring is `app-shell.tsx:145`
(`stiffness:300, damping:32`). **Fix:** convert gesture/entrance motion to springs; make transitions
interruptible; animate only `transform`/`opacity`.

**U2 — `prefers-reduced-motion` handled, but no `prefers-reduced-transparency` / `prefers-contrast`.
[MEDIUM]** `globals.css:203` has the reduced-motion block (good). There IS `backdrop-filter`
(`:221`, the translucent chrome). **Fix:** add `@media (prefers-reduced-transparency: reduce)` to
make glass solid, and `prefers-contrast: more` for near-solid surfaces + borders. (Skill §14.)

**U3 — Typography tracking/leading not size-specific. [LOW-MEDIUM]**
Check headings vs body: Apple-design wants **negative tracking on large display text** (`-0.02em`),
body near `0`, tight leading on headings. Audit the type scale in `globals.css` / Tailwind usage.
(Skill §15.)

**U4 — Press feedback / latency audit. [LOW]**
Verify every interactive element has instant `:active` feedback on pointer-down (skill §1). Buttons
in `ui.tsx` should scale on `:active` with a ~100 ms ease-out.

**U5 — Verify material/vibrancy legibility in both themes** (skill §12) and that enter/exit paths are
symmetric (skill §7) for the mobile drawer in `app-shell.tsx`.

---

## 6. Recommended continuation plan

1. **Re-confirm services:** `curl http://127.0.0.1:8008/health`; restart API with
   `cd backend && .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8008` if down.
2. **Security fixes** (blue team), in this order: S2 → S1 → S3 → S8/S9 → S4/S7 → S10 → S6 → S5/S11/S12.
   After each, re-run the relevant probe + keep tests green.
3. **Performance:** P1, P2 first (SQL aggregation + eager loading), then P3/P4/P5.
4. **UX:** U1–U5 via apple-design; needs a working build to eyeball.
5. **Verify:**
   - `backend/.venv/bin/python -m pytest tests -q` (expect 11 pass; may add tests for RBAC + rate limit).
   - Re-run `bandit`, `pip-audit`, `npm audit`.
   - **`cd frontend && npm run build`** — *only when RAM allows*; this is the gate that's currently
     unverified. If OOM again, free memory / close other processes first.
6. **Clean up:** delete the stray root `main.py` sample.
7. Update README "Security notes" to reflect the new hardened defaults.

### Verification one-liners
```bash
# API up?
curl -s http://127.0.0.1:8008/health
# Login + call a protected route
TOKEN=$(curl -s -X POST http://127.0.0.1:8008/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"manager@careflow.ir","password":"careflow"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
curl -s http://127.0.0.1:8008/api/v1/overview -H "Authorization: Bearer $TOKEN" | head -c 400
# Scanners
TOOLS=/tmp/claude-1000/-home-makhataei-Projects-Mine-Iran-CareFlow/<session>/scratchpad/tools/bin
$TOOLS/bandit -r backend/app -q
$TOOLS/pip-audit -r backend/requirements.txt --progress-spinner off
cd frontend && npm audit
```

---

## 7. Important caveats for the next model

- **Low RAM is the dominant constraint.** The frontend build is the one unverified baseline; treat
  "done" as blocked until `next build` passes once.
- **Nothing is fixed yet** — this doc is findings only. Don't report fixes as complete without
  re-running the checks in §6.
- The project convention (`CLAUDE.md`): Persian is the source language for i18n; follow the Persian
  UX-writing vocabulary in `~/references/persian-ux-vocab/README.md` for any user-facing strings.
  There's a graphify rule but `graphify-out/` does not exist here — ignore it.
- All findings above were derived from reading the source + the three scanners + a running API. The
  deeper live-exploit red-team pass (token forgery with the default secret, IDOR across departments,
  brute-force timing) was **scoped but not fully executed** — worth completing to confirm S2/S3/S4
  with concrete request/response evidence before/after the fix.
