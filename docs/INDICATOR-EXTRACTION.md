# STISA 2034 — Indicator Extraction Report

**Source:** Implementation Plan STISA 2034 — *Annexure 1: MEAL Plan*, printed pages 37–40.
**Extracted into:** [`src/data/stisa-taxonomy.ts`](../src/data/stisa-taxonomy.ts)
**Structural check:** `npm run verify:taxonomy`

---

## 0. Scope — the Impact level is excluded

The programme has determined that the **Impact result level is not collected by this platform**.
The two Impact categories and their five rows were transcribed from the source and have since been
removed from the taxonomy, the database and the reporting framework:

| Code | Category | Rows removed |
|---|---|---:|
| `LS` | Improved Living Standards (`LS-001`, `LS-002`) | 2 |
| `EDC` | Economic Development and Competitiveness (`EDC-001`, `EDC-002`, `EDC-003`) | 3 |

**75 of the 80 printed rows are in scope.** Everything below describes the extraction as performed
against the full printed table; the counts in §1 and §2 refer to what the document prints, not to
what the platform collects. `ResultLevel` no longer has an `IMPACT` member.

---

## 1. Headline finding — the table contains 80 rows, not 81

The MEAL Plan indicator table contains **exactly 80 indicator rows as printed**. The project
brief states 81. This is independent of the Impact-level exclusion above.

Nothing has been invented or duplicated to close the gap. The single most likely explanation is
that one of the three table cells below — each of which contains **two distinct measurement
statements in a single cell** — is officially counted as two indicators:

| Code | Page | The two statements in the cell |
|---|---|---|
| `AGR-001` | 38 | (a) enterprises/industries and research institutes deploying frontier technologies in food and agricultural production; (b) agricultural businesses adopting advanced ICTs |
| `HLT-002` | 38 | (a) percentage change of scientific publications on patents for human genomes, diagnostics and other medical products; (b) percentage increase in local pharmaceutical manufacturers |
| `SP5-008` | 40 | (a) patents generated from joint private–public innovation activities; (b) joint IP, products and technologies developed with the private sector |

Splitting any one of these yields 81. **The split has not been made** — the source document
provides no numbering, so choosing which cell to split would be an invention. All 80 rows are
stored verbatim and flagged `COMPOUND_STATEMENT`.

> **Action required from the African Union Commission:** confirm the official indicator count and,
> if 81 is correct, confirm which compound cell constitutes two indicators. The taxonomy file and
> seed can then be updated without touching any collected data.

---

## 2. What the source document does not supply

The MEAL Plan table has three columns: `Indicator`, `Baseline Data (2024)` and `Target Value`.
**The latter two columns are blank for every one of the 80 rows.**

| Field | Present in source? | How the platform handles it |
|---|---|---|
| Indicator text | **Yes** | Transcribed verbatim into `sourceText`; immutable. |
| Result level & category | **Yes** | 4 result levels, 18 categories. |
| Indicator code | No | Platform-assigned in printed row order, flagged `NO_OFFICIAL_CODE_IN_SOURCE`. |
| Definition | No | `null` until the AU issues one. |
| Unit | No | Inferred from wording; provenance recorded. |
| Data type | No | Inferred from wording; provenance recorded. |
| Calculation methodology | No | Inferred where defensible, `UNDEFINED` where not. |
| Direction of improvement | No | Inferred; flagged where non-obvious. |
| Baseline (2024) | **Column present but empty** | Supplied by the reporting Member State. |
| Target value | **Column present but empty** | Supplied by the reporting Member State. |
| Data source | No | Supplied by the reporting Member State. |
| Reporting frequency per indicator | No | Governed by the reporting cycle, not per indicator. |

Every row therefore carries these five flags: `NO_BASELINE_IN_SOURCE`, `NO_TARGET_IN_SOURCE`,
`NO_OFFICIAL_CODE_IN_SOURCE`, `NO_DEFINITION_IN_SOURCE`, `NO_METHODOLOGY_IN_SOURCE`.

**Consequence for interpretation:** because targets are self-set by each Member State,
cross-country comparison of *target progress* is comparison against differing self-set ambitions,
not against a common continental target. The methodology page states this publicly.

---

## 3. Taxonomy as extracted

| Result level | Categories | Indicators |
|---|---:|---:|
| ~~Impact~~ *(removed — out of scope)* | ~~2~~ | ~~5~~ |
| Outcome | 5 | 14 |
| Sectorial priorities | 5 | 31 |
| Strategic priorities | 6 | 30 |
| **Total in scope** | **16** | **75** |

| Code | Category | Rows | Page |
|---|---|---:|---:|
| `O1` | Outcome 1: Increased Economic and Inclusive Development | 3 | 37 |
| `O2` | Outcome 2: Enhanced science diplomacy and open science | 3 | 37 |
| `O3` | Outcome 3: Enhanced human resource and institutional capacities | 3 | 37 |
| `O4` | Outcome 4: Empowered women and youth and jobs created | 2 | 37 |
| `O5` | Outcome 5: Increased public and private sector investment in R&D | 3 | 37 |
| `AGR` | Agriculture (Food and Nutritional Security) | 8 | 38 |
| `HLT` | Health (Strengthening Health Systems and Emergence Preparedness) | 8 | 38 |
| `ICT` | Information and Communication Technologies | 5 | 38 |
| `ENE` | Energy | 3 | 39 |
| `ENV` | Environment | 7 | 39 |
| `SP1` | STI for Accelerating Sustainable and Inclusive Industrialization | 5 | 39 |
| `SP2` | Building Human Capital and Infrastructure for Research and Innovation | 5 | 39 |
| `SP3` | Building African Capabilities in Frontier and Emerging Technologies | 3 | 39 |
| `SP4` | Strengthening Science Diplomacy and Partnerships in STI | 5 | 39 |
| `SP5` | Promoting Private Sector Engagement in Research and Innovation | 9 | 40 |
| `SP6` | Addressing Youth Unemployment and Gender Inequalities | 3 | 40 |

Codes follow `<CATEGORY>-<3-digit ordinal in printed row order>`, e.g. `AGR-006`.

---

## 4. Ambiguity register

| Flag | Rows | Meaning |
|---|---:|---|
| `AMBIGUOUS_MEASUREMENT_BASIS` | 18 | The quantity to report is not determinable from the wording. |
| `CONTINENTAL_LEVEL_WORDING` | 12 | Phrased as a count/share *across* Member States, but reported per country. |
| `REQUIRES_DISAGGREGATION` | 8 | Requires a breakdown the source never defines. |
| `OVERLAPS_ANOTHER_ROW` | 7 | Measures substantially the same construct as another row. |
| `DUPLICATE_OF_ANOTHER_ROW` | 7 | Repeats an earlier row verbatim or near-verbatim. |
| `DIRECTION_INFERRED` | 5 | Direction of improvement is not stated. |
| `COMPOUND_STATEMENT` | 3 | One cell contains two distinct measurements. |
| `UNIT_NOT_SPECIFIED` | 1 | e.g. a monetary value with no currency. |

### 4.1 Duplicated and repeated rows

The source repeats several rows. **All are preserved as printed** — merging them would be an edit
to the official framework. They are flagged so aggregation does not double-count:

| Row | Duplicates | Difference |
|---|---|---|
| `AGR-006` | `AGR-003` | "and" in place of "against" |
| `AGR-007` | `AGR-004` | plural "Markets" |
| `AGR-008` | `AGR-005` | exact repeat |
| `HLT-008` | second statement of `HLT-002` | printed separately as its own row |
| `SP1-001` | `O5-002` | same text at two result levels |
| `SP3-003` | `SP3-002` | "startups" vs "start-ups" |

`O2-001`/`SP4-005`, `O4-001`/`SP6-003` and `O4-002`/`SP1-004` overlap in construct without being
verbatim duplicates, and are flagged `OVERLAPS_ANOTHER_ROW`.

### 4.2 Indicators the analytics engine will not score

Two rows carry `calculationMethod: UNDEFINED`, meaning the engine publishes the reported value but
refuses to compute target progress:

- **`O3-003`** — "Level (Percentage) of resource mobilization achieved…" — achieved *against what*?
  No denominator is stated.
- **`ICT-005`** — "Improvement (Percentage) in national/regional/continental assessments of digital
  literacy…" — no assessment instrument is named and the measurement basis is unstated; the row
  also mixes three units of analysis.

### 4.3 Continental-level wording

Twelve rows count or express a share *of Member States* (e.g. "Number of countries with functioning
digital health systems"). These are continental aggregates, not national measurements. At Member
State level the meaningful response is Yes/No; the platform records `unitOfAnalysis: CONTINENTAL`
and flags the transformation rather than silently reinterpreting the indicator.

Related: `ENE-001` is expressed against *the continent's* population. Its continental figure must be
a **population-weighted** aggregate, not a simple mean of country percentages — `weightedMeanOfValid()`
in `src/lib/analytics/aggregate.ts` exists for this, and needs population data to be supplied before
it can be applied.

### 4.4 Direction of improvement

Where the reported quantity runs opposite to the underlying variable, direction is recorded
explicitly:

- **`ENV-001`** (percentage *reduction* in CO₂ per capita) — `HIGHER_IS_BETTER`, because the
  reported metric is itself a reduction. Countries report the reduction as a positive number.

---

## 5. Rules applied during extraction

1. Indicator text is transcribed **character for character**, including the source's own
   inconsistencies ("Global innovation Index", "startups" vs "start-ups", "member States").
2. Nothing was renamed, merged, split, de-duplicated or reinterpreted.
3. Where information is absent it is recorded as absent — never filled with a plausible value.
4. Every derived field records its `provenance`: `SOURCE_DOCUMENT`, `INFERRED_FROM_WORDING`,
   `PLATFORM_ASSIGNED` or `NOT_PROVIDED`.
5. `sourceText` is immutable in the database and is excluded from indicator versioning.

---

## 6. Open questions for the African Union Commission

1. Is the official indicator count 80 or 81? If 81, which compound cell counts as two?
   (Either way, the five Impact-level rows are out of scope — see §0.)
2. Should the duplicated rows (§4.1) be reported separately, or is one of each pair redundant?
3. What are the official baselines (2024) and target values? The framework currently has none.
4. What is the official methodology for `O3-003` and `ICT-005`?
5. How should continental-level rows (§4.3) be answered by an individual Member State?
6. For `SP5-003` (Government Budget for Scientific and Technological Activities), what currency and
   price basis should be used to make figures comparable across Member States?
7. Which sector taxonomy applies to the rows requiring "disaggregated by sector"?

Answering any of these requires **no schema change** — update
[`src/data/stisa-taxonomy.ts`](../src/data/stisa-taxonomy.ts), re-run `npm run db:seed`, and for
changes after data collection has begun use the indicator versioning flow in
`/admin/indicators`, which preserves the definition each historical value was captured under.
