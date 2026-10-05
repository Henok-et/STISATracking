# STISA 2034 — Monitoring & Evaluation Platform

An institutional monitoring and evaluation system for the **Science, Technology and Innovation
Strategy for Africa (STISA 2034)**, covering all 55 African Union Member States.

Three audiences, one data foundation:

| Area | Who | What |
|---|---|---|
| Public dashboards | Anyone | Published continental, regional, sector and Member State performance |
| `/portal` | National focal points | Secure data entry for one assigned Member State |
| `/admin` | AU Commission | Review, approval, publication, and management of countries, users, indicators and cycles |

---

## Quick start

```bash
# 1. Environment
cp .env.example .env          # then set AUTH_SECRET: npx auth secret

# 2. Schema and reference data
npm install
npm run db:deploy             # apply migrations
npm run db:seed               # 5 regions, 55 Member States, 18 categories,
                              # 75 indicators, 4 reporting cycles, 1 admin

# 3. Run
npm run dev                   # http://localhost:3000
```

Sign in at `/portal/login` with the `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env`.
The account is created with a forced password change.

### Verification

```bash
npm run verify:taxonomy   # indicator extraction is internally consistent
npm run db:check          # database reachable, reference data complete
npm run test:smoke        # 22 end-to-end checks on the data invariants
npm run lint && npm run typecheck && npm run build
```

---

## Demo data

The platform starts empty — every dashboard reads "no published data yet" until Member States
submit and the AU Commission publishes. To evaluate it with something on screen:

```bash
npm run db:demo         # generate ~5,600 synthetic indicator values
npm run db:demo:clear   # remove every trace
```

**Everything it produces is fabricated.** Safeguards so it cannot be mistaken for, or contaminate,
real reporting:

- Refuses to run under `NODE_ENV=production` unless `ALLOW_DEMO_SEED=true`
- Demo focal points use the reserved `.invalid` TLD, which can never resolve to a real address
- **Never overwrites a submission it did not create** — a real focal point's return is skipped and
  reported, not replaced
- Teardown identifies demo data by creator, so reference data and real submissions are untouched
- With `NEXT_PUBLIC_DEMO_MODE=true` in `.env`, a banner appears on every page

It generates a full workflow spread across the 55 Member States (published, approved, under review,
submitted, revision required, draft, not started), a realistic mix of value states — reported, not
reported, not applicable, invalid — two Member States deliberately left without a focal point, and
differentiated regional profiles so the comparison charts show distinct shapes.

Sign in as any demo focal point with `focal.<iso2>@demo.stisa.invalid` / `DemoFocal!2026`,
e.g. `focal.ng@demo.stisa.invalid` for Nigeria.

> The 2028 returns it creates are temporally artificial — 2028 has not opened yet. They exist only
> so the historical trend charts have a second point to draw.

---

## The indicator framework is the source of truth

Indicators are transcribed **verbatim** from *Implementation Plan STISA 2034, Annexure 1: MEAL
Plan* (printed pages 37–40) into [`src/data/stisa-taxonomy.ts`](src/data/stisa-taxonomy.ts).
Nothing was renamed, merged, split, de-duplicated or reinterpreted.

**The table contains 80 indicator rows as printed, not 81.** Three cells each contain two distinct
measurement statements; splitting any one yields 81, but the source provides no numbering so the
split has not been guessed.

**The Impact result level is out of scope and is not collected.** Its two categories and five rows
(`LS-001`, `LS-002`, `EDC-001`, `EDC-002`, `EDC-003`) have been removed, leaving **75 of the 80
printed rows** across three result levels — Outcome, Sectorial priority and Strategic priority.

Full analysis, including the ambiguity register and the open questions for the AU Commission, is in
**[`docs/INDICATOR-EXTRACTION.md`](docs/INDICATOR-EXTRACTION.md)**.

The MEAL Plan's `Baseline Data (2024)` and `Target Value` columns are **blank for every row**, so
baselines and targets are supplied by the reporting Member State. Units, data types and calculation
methodologies are also absent from the source; where they are inferred from indicator wording, the
inference is recorded against the indicator and surfaced in the UI.

---

## Non-negotiable data rules

These are enforced in code and covered by `npm run test:smoke`.

**Missing data is never zero.** Each response carries an explicit state — `REPORTED`,
`NOT_REPORTED`, `NOT_APPLICABLE`, `INVALID`, `PENDING_VALIDATION`. Missing values are excluded from
both numerator and denominator of every average, and every figure is displayed with the denominator
it was computed over ("68% — based on 8 of 10 countries reporting").

**No single progress formula.** The framework mixes counts, index scores, shares, percentage changes,
ratios and binary milestones. Each indicator is scored by its own methodology
([`src/lib/analytics/progress.ts`](src/lib/analytics/progress.ts)). Where the source defines no
methodology, the engine returns *not scored* and says why rather than applying a default.

**Only published data is public.** `DRAFT`, `SUBMITTED`, `UNDER_REVIEW` and `REVISION_REQUIRED` are
private; `APPROVED` is trusted internally but still not public. Only `PUBLISHED` enters public
analytics.

**History is never overwritten.** `@@unique([countryId, reportingCycleId])` makes it structurally
impossible for a 2028 return to replace a 2026 one. Every value pins the `IndicatorVersion` it was
captured under, so re-defining an indicator cannot retroactively change what a historical figure
claims to measure.

**Authorization is server-side.** A submission id from the client is only ever used to *load* a row;
the country compared against the session comes from that row. Editing an id in a request fails the
ownership check rather than reaching another Member State's data. See
[`src/lib/auth/guards.ts`](src/lib/auth/guards.ts).

---

## Reporting schedule

Stored as data in `ReportingCycle`, never written into application code.

| Phase | Implementation | Reporting years |
|---|---|---|
| Phase 1 | 2025–2029 | **2026**, **2028** |
| Phase 2 | 2030–2034 | **2030**, **2033** |

Any year without an open cycle is closed. The portal shows a "reporting is not scheduled for this
year" state with the next cycle, instead of a form that cannot be submitted. Administrators adjust
windows at `/admin/reporting-cycles`.

---

## Architecture

```
PUBLIC EXPERIENCE      app/(public)      dashboard · countries · sectors · methodology
        │
ANALYTICS ENGINE       lib/analytics     progress · aggregation · queries
        │                                (no business logic lives in components)
REPORTING WORKFLOW     lib/submissions   state machine · readiness · validation
        │              lib/actions       Server Actions, all guarded
DATA FOUNDATION        prisma            PostgreSQL · versioned indicators · audit log
```

| Path | Responsibility |
|---|---|
| `src/data/` | Verbatim STISA taxonomy, AU Member States, reporting schedule |
| `src/lib/analytics/` | All calculation and aggregation. Pure functions in `progress.ts` / `aggregate.ts` |
| `src/lib/auth/` | Capability model, guards, rate limiting |
| `src/lib/submissions/` | Workflow state machine, readiness checks |
| `src/lib/actions/` | Server Actions — the only mutation path |
| `src/lib/indicators/` | Per-type validation, definition versioning |
| `src/app/api/v1/` | Versioned public API and CSV exports |

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Framer Motion ·
Lucide · Recharts · Prisma 7 · PostgreSQL 17 · Auth.js v5 · Zod 4.

---

## Public API

Read-only, published data only.

```
GET /api/v1/public/metrics?year=2026            continental + regional headline figures
GET /api/v1/public/countries?year=2026          all Member States
GET /api/v1/public/countries/{ISO2}?year=2026   one Member State, full indicator detail
GET /api/v1/public/sectors?year=2026            the 18 results-framework categories
GET /api/v1/public/indicators                   the taxonomy, with provenance and flags
GET /api/v1/public/exports/continental?year=2026        CSV
GET /api/v1/public/exports/country/{ISO2}.csv?year=2026 CSV
```

Every aggregate carries its denominator and basis sentence. Administrative exports live under
`/api/v1/admin/` and require the `export:administrative` capability.

---

## Operational notes

- **Sessions** are JWT, 8 hours, signed with `AUTH_SECRET`. Set a real secret in production
  (`npx auth secret`) and set `AUTH_URL` to the canonical origin.
- **Rate limiting** on sign-in is database-backed (20/15 min per IP, 5/15 min per account) so limits
  hold across instances. It fails open on database error so an outage cannot lock out every user.
- **Audit log** is append-only and records before/after pairs for value changes. Never expose it
  publicly.
- **Build concurrency** is capped at 2 workers in `next.config.ts` because each static-generation
  worker opens its own connection pool. Raise it if your database can take the concurrency.
- **Backups**: submissions are institutional records. Use managed PostgreSQL with point-in-time
  recovery.

### Adding a Member State's focal point

`/admin/users` → New account → role *National focal point* → assign the Member State. The account
is created with a temporary password and a forced change at first sign in.

### Correcting an indicator definition

`/admin/indicators` → Edit. This creates a **new version**; values already collected stay pinned to
the version they were captured under. `sourceText` is immutable and cannot be edited — it is the
verbatim MEAL Plan transcription.
