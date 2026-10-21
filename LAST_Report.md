# LAST_Report — CareFlow Iran hardening, from the first step to now

Branch: `security-hardening-2026-10` · Written 2026-10-22 · Everything below was checked on the final code unless marked otherwise.

## 1. Bottom line

The backend and frontend were audited, hardened and made faster. The work is verified by 53 passing tests, zero known
dependency advisories on both sides, a clean static scan, a successful production build, and a live smoke test of both servers.

Not delivered, and why, in one place:

| Asked for | State |
|---|---|
| A brand-new "shocking" UI | **Not rebuilt.** The app already existed. I applied a focused Apple-design pass instead (section 5). No browser screenshots were taken, so please look at it yourself. |
| APK and IPA | **Not built.** A plan is in `docs/IMPLEMENTATION_PLAN.md`. |
| Docker build and run | **Not done.** The machine cannot run it. Compose is validated with `docker compose config`; CI builds and scans the images. |
| Live penetration test of a deployed system, DAST, fuzzing | **Not done.** What exists is an automated regression pen-test against the API (section 4). |
| Every skill you listed | **Not all were loaded.** Exact list in section 7. |

No part of the work needed a different model, so nothing was skipped for that reason.

## 2. What happened, in order

1. **Before this session (read-only audit).** An earlier session reviewed the code and wrote `HANDOFF.md` on 2026-10-02: 12 security findings, 5 performance findings, 5 UX findings, no fixes applied. Baseline then: 11 tests passing, 48 Python advisories in 4 packages, npm advisories, and a frontend build that had been killed for lack of memory.
2. **2026-10-08.** I loaded the security, red-team, attack-tree, ponytail, apple-design and graphify skills, read the whole backend and the relevant frontend files, and created the branch. I removed the stray PyCharm `main.py` from the git index so it is not in the pull request. I started the backend rewrite (settings, security module, app factory, schema bounds, indexes).
3. **Interruptions.** At least three of my responses were stopped by a safety classifier. I cannot see what triggered it, so I did not repeat that content; I continued with defensive work only (code review, hardening, regression tests). One shell command was refused by the permission classifier because it bundled several actions; I split it into separate steps. One background sub-agent (`security-audit`) died on a network error and produced nothing. Your usage limit reset several times. The model was changed by you (Fable, then Opus, then Sonnet); I never changed it myself.
4. **2026-10-15 to 10-22.** Finished the routers, tests, dependency upgrades, frontend and container hardening, CI, documentation, benchmarks and verification.

## 3. What was changed

**Backend (`backend/app`)**
- `config.py`: no default secret. Production refuses weak secrets and demo flags; development mints a random secret per process.
- `security.py`: 600 000-round password hashing with upgrade on login; tokens with `jti`, `iss`, `aud`, 60-minute life and server-side revocation; role and department scoping; a sliding-window rate limiter; spoof-proof client IP; audit logging with request ids.
- `main.py`: strict CORS allow-list, security headers, 64 KiB body cap, gzip, docs hidden in production.
- `routers/*`: every patient read goes through one scoped loader; out-of-scope ids answer 404; steps can only be completed by the owning role and only in order; login lockout and uniform timing; demo endpoint only in demo mode; public endpoints rate-limited with a honeypot; unused public endpoint removed.
- `models.py`: indexes on the hot filters. `schemas.py`: length bounds, allowed values, unknown fields rejected.
- Dependencies upgraded; `python-multipart` removed (unused); test tools split into `requirements-dev.txt`.

**Frontend (`frontend`)**
- Next.js 15.1.6 → 15.5.27 with overrides for postcss and source-map-js.
- CSP, HSTS, Permissions-Policy, COOP, `DENY` framing.
- Server-side logout; no pre-filled credentials; lockout message; IT role no longer sees screens it cannot load.

**Containers and CI**
- Dockerfile: runtime-only dependencies, numeric non-root user, no curl.
- Compose: required secrets, loopback-only ports, internal database network, dropped capabilities, read-only filesystems, limits, rotated logs.
- `.github/workflows/security.yml` (secrets, SAST, SCA, tests, build, Dockerfile lint, image scan, SBOM, one gate job; third-party actions pinned to commit SHAs after an automated review flagged floating tags, which also exposed a wrong Trivy tag name that would have failed the first run), `dependabot.yml`, `.pre-commit-config.yaml`, `.gitleaks.toml`.

**Documentation**: `README.md`, `docs/SECURITY.md` (findings, attack tree, red/blue view, PO / tech lead / QA notes, residual risk, checklist), `docs/IMPLEMENTATION_PLAN.md`, this report. `HANDOFF.md` is marked superseded. `.gitignore` now tracks `docs/` except `docs/source/` (your third-party business-plan PDFs stay local).

## 4. Evidence

| Check | Before | After |
|---|---|---|
| Backend tests | 11 passing | **53 passing** (42 new: security controls and query budgets), on a throw-away database |
| `pip-audit` | 48 advisories, 4 packages | **0** |
| `npm audit` | 4 (1 critical, 3 high) | **0** |
| `bandit` | 1 low (false positive) | **0** |
| `tsc --noEmit` | not run | exit 0 |
| `next build` | killed by the OOM reaper | **exit 0**, 21 pages, no errors or warnings, 4 minutes |
| Live smoke test (API + built web) | not possible | passed: headers present, no token → 401, IT role → 403, evil CORS origin refused, gzip on, page is RTL |
| `docker compose config` | n/a | fails closed without secrets, valid with them |

Regression pen-test coverage (`backend/tests/test_security.py`): forged, expired, wrong-algorithm, no-`jti`, wrong-issuer
and wrong-audience tokens; `alg=none`; brute force and lockout; account-enumeration comparison; cross-department access
and id probing; role abuse; step skipping; injection strings and wildcards; unknown-field rejection; CORS; oversized
bodies; flooding and honeypot; header spoofing; request-id injection.

Performance, same database and interpreter, median of 7, loaded machine so read the ratios:

| Endpoint | SQL statements | Median | Bytes on the wire |
|---|---|---|---|
| Patient list | 140 → 3 | 2 003 → 595 ms | 61.3 → 7.8 KiB |
| Pathways | 113 → 5 | 1 543 → 280 ms | 6.4 → 2.0 KiB |
| Overview | 6 → 7 | 1 013 → 253 ms | 1.5 → 0.7 KiB |
| Departments | 10 → 4 | 748 → 201 ms | 2.0 → 0.7 KiB |
| Resource demand | 9 → 3 | 571 → 325 ms | 1.5 → 0.5 KiB |

**graphify** built a code graph (640 nodes, 1 890 edges, 26 communities, no API cost; output in `graphify-out/`, not
committed). It confirmed the access rule: every route that returns patient rows reaches `patient_scope`, directly or through `_load`.

## 5. UI / UX (Apple-design pass)

Done: translucent surfaces turn solid under reduced-transparency and more-contrast settings; Persian text no longer gets
letter-spacing (it breaks cursive joins); press feedback is instant and animates only transform and colour; entrances and the
notification popover use critically damped springs and grow from their trigger; IT users see only screens that work; new
strings follow the Persian UX vocabulary («نادرست» rather than «اشتباه»).

Not done: progress bars still animate width rather than transform; scroll reveals still use a fixed curve; no visual regression
or accessibility scan; I did not audit the existing Persian copy against the whole vocabulary guide (only the strings I added).

## 6. ponytail review of my own diff

```
config.py: yagni: EXPOSE_DOCS override nobody sets. Docs are off in production, one line.      (applied)
main.py: shrink: api prefix kept as bytes then decoded per request. Keep it a str.            (applied)
security.py: delete: unused IT role constant.                                                 (applied)
login-view.tsx: shrink: two booleans (error, locked) can be one state.                        (left)
tests/test_security.py: shrink: _Counter class can be a contextmanager function.              (left)
net: about -6 lines applied, about -10 more possible.
```
Kept on purpose: the rate limiter's periodic cleanup (bounds memory against attacker-chosen keys), request ids, rehash-on-login.

## 7. Skills

| Skill | Use |
|---|---|
| security-auditor, security-scanning-security-sast, attack-tree-construction, red-team-tactics, red-team-tools | Loaded; method applied (SAST scan, attack tree, ATT&CK mapping). Offensive tooling was not run against anything. |
| apple-design | Loaded and applied (section 5) |
| ponytail (mode) and ponytail-review | Active throughout; review in section 6 |
| graphify | Loaded; graph built and queried |
| hardening-docker-containers-for-production, implementing-devsecops-security-scanning, fastapi-security-scan, backend-security-coder, python-observability, implementing-threat-intelligence-lifecycle-management | Loaded late; each produced a concrete change (compose limits and log rotation, CI stages, issuer/audience, unknown-field rejection, request ids, advisory-intelligence table) |
| security-audit | Started as a background agent; died on a network error; **no output** |
| implementation-planner, fastapi-pro, fastapi-expert, fastapi-templates, fastapi-attack-probe, backend-architect, backend-development-feature-development, python-pro, python-code-style, python-error-handling, python-background-jobs, python-testing-patterns, python-fastapi-development | **Not loaded.** I used general knowledge in those areas and did not read those skill files. |

The product-owner, tech-lead, red-team, blue-team and QA reviews are written into `docs/SECURITY.md` section 8 from my own
reading of the code; I did not run the separate review agents.

## 8. Memory

No memory existed for this project at the start. I saved two files in the project memory folder:
`dev-machine-memory-limits.md` (how to build and test on this RAM-starved machine) and
`model-and-safeguard-handling.md` (your rule: report and skip, never switch models; write findings to a report file).

## 9. Open items and decisions for you

1. **Your local `.env`** still has `JWT_SECRET=change-me-in-production`. Compose will refuse production mode with it. Generate two secrets (command in `.env.example`) and set `POSTGRES_PASSWORD`.
2. **Existing databases** do not get the new indexes (`create_all` only creates missing tables). Delete and reseed the dev database, and add Alembic before any real deployment.
3. **`records@careflow.ir`** is a records officer seeded with the `it` role, which now sees aggregates only. Decide whether to add a read-only `records` role.
4. **Three dashboard KPI deltas** are constants shown as measurements. Compute or hide them.
5. **Token still lives in browser storage.** Moving to an `HttpOnly` cookie with CSRF protection is the first backlog item.
6. Rate limits and revocation are per process, so run one API worker until Redis is added.
7. Please build the images once on a machine with Docker and view the UI in both languages and both themes.
8. Real patient data needs a legal review before any pilot.

## 10. Reproduce

```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt && .venv/bin/python -m pytest tests -q
cd ../frontend && npm ci && npm audit && NEXT_PUBLIC_API_URL=http://localhost:8008/api/v1 npm run build
cd .. && docker compose config -q    # needs JWT_SECRET and POSTGRES_PASSWORD in .env
```
