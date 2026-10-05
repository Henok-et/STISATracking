# STISA 2034 M&E Platform — working notes

Institutional monitoring & evaluation system for the Science, Technology and Innovation Strategy
for Africa, across all 55 AU Member States. Read `README.md` first; this file covers the
conventions that are easy to violate accidentally.

## Commands

```bash
docker compose up -d     # PostgreSQL 17
npm run dev
npm run db:migrate       # create a migration during development
npm run db:deploy        # apply migrations (deployment)
npm run db:seed          # idempotent; never touches submissions
npm run verify:taxonomy  # indicator extraction consistency
npm run verify:coordinates # every Member State has a globe coordinate
npm run build:geo        # regenerate src/data/africa-geo.json (rarely needed)
npm run db:check         # connectivity + reference data
npm run test:smoke       # 22 checks on the data invariants
npm run lint && npm run typecheck && npm run build
```

## Rules that must not be broken

**Never treat missing data as zero.** Excluded from numerator *and* denominator. Every aggregate
returns an `Aggregate` carrying `n`, `expected` and a `basis` sentence — render the basis next to
the figure. `NoData` / `DataBasis` in `src/components/data-display.tsx` exist for this.

**Never put a calculation in a component.** All arithmetic lives in `src/lib/analytics/`. Charts
and tables render pre-computed values so the dashboard, the API and the CSV exports cannot
disagree.

**Never apply one progress formula to all indicators.** `calculateProgress()` dispatches on the
indicator's own `calculationMethod` and `direction`. `UNDEFINED` and `CUSTOM` return
`scored: false` with a reason — do not add a fallback.

**Never widen the public boundary.** Public queries filter `status: 'PUBLISHED'`. `APPROVED` is not
public.

**Never trust an id from the client.** Load the row, compare *its* `countryId` against the session.
`authorizeDataEntry()` is the full gate: authenticated → role → country → submission → open cycle.

**Never edit `Indicator.sourceText`.** It is the verbatim MEAL Plan transcription. Definitional
changes go through `createIndicatorVersion()`, which pins historical values to their original
version.

**Never hard-code a reporting year.** The schedule lives in `ReportingCycle`. Ask
`getReportingAvailability()`.

**Never bypass the workflow state machine.** `TRANSITIONS` in `src/lib/submissions/workflow.ts` is
the only authority; there is no code path that sets `status` directly.

## Conventions

- Server Actions return `ActionResult<T>` and never throw across the boundary; wrap bodies in
  `guarded()`.
- Base UI's `Button` has no `asChild`. For navigation use `ButtonLink` / `AnchorButton` from
  `src/components/ui/button-link.tsx`.
- Numeric columns get the `tnum` utility (tabular figures).
- Wide tables go inside `.scroll-x`; the page body must never scroll horizontally.
- Motion is restrained: `Reveal` only, and it honours `prefers-reduced-motion`.
- The hero globe (`reporting-globe.tsx`) is SVG, not WebGL. Rotation writes `d`
  attributes imperatively through refs — re-rendering 55 React paths per frame
  would be far too slow. The opening frame is computed during render so it is
  in the SSR HTML.
- Colours come from the `--chart-*` / semantic tokens in `globals.css`. Both themes are always
  defined; never define a colour only inside a media query.

## Known gaps

- The Impact result level is out of scope: its two categories and five rows were removed, so the
  framework is 75 indicators across 16 categories and three levels. `ResultLevel` has no `IMPACT`
  member — see the `20260828090000_remove_impact_level_indicators` migration.
- 80 indicator rows were extracted from the source; the brief says 81. Unresolved pending AU
  confirmation, and independent of the Impact exclusion — see `docs/INDICATOR-EXTRACTION.md`.
- No baselines or targets exist in the source document; Member States set their own, so
  cross-country target-progress comparison is against differing self-set ambitions.
- `ENE-001` should be population-weighted continentally. `weightedMeanOfValid()` exists but needs
  population data before it can be wired up.
- PDF national reports are not implemented; the export layer is structured to accept them.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
