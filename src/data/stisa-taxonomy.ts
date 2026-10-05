/**
 * STISA 2034 — CANONICAL INDICATOR TAXONOMY
 * =========================================
 *
 * SOURCE OF TRUTH
 * ---------------
 * Implementation Plan STISA 2034 — "ANNEXURE 1: MEAL PLAN"
 * Printed pages 37-40 (PDF pages 44-47).
 *
 * Every `sourceText` below is a VERBATIM transcription of one row of the
 * "Indicator" column of the MEAL Plan results table, including the source
 * document's own punctuation, capitalisation, spelling and inconsistencies.
 * Nothing has been renamed, merged, split, de-duplicated or reinterpreted.
 *
 * WHAT THE SOURCE DOCUMENT DOES **NOT** PROVIDE
 * ---------------------------------------------
 * The MEAL Plan table has exactly three columns: `Indicator`,
 * `Baseline Data (2024)` and `Target Value`. The latter two are BLANK for
 * every single row. The document therefore supplies NO:
 *   - indicator codes            - units of measure
 *   - indicator definitions      - data types
 *   - calculation methodologies  - baselines
 *   - target values              - directions of improvement
 *   - data sources               - reporting frequency per indicator
 *
 * Fields in this file that are not present in the source are explicitly
 * marked via `provenance`, and every inference is recorded in `flags` so it
 * can be reviewed and replaced with official metadata. See
 * `docs/INDICATOR-EXTRACTION.md` for the full ambiguity register.
 *
 * DO NOT hand-edit derived values here without also updating the extraction
 * report. When the AU issues official metadata, replace the INFERRED values
 * and set the corresponding provenance to SOURCE_DOCUMENT.
 */

// ---------------------------------------------------------------------------
// Enumerations (mirrored 1:1 by the Prisma schema)
// ---------------------------------------------------------------------------

export const RESULT_LEVELS = [
  'OUTCOME',
  'SECTORIAL_PRIORITY',
  'STRATEGIC_PRIORITY',
] as const;
export type ResultLevel = (typeof RESULT_LEVELS)[number];

export const DATA_TYPES = [
  'INTEGER',
  'DECIMAL',
  'PERCENTAGE',
  'CURRENCY',
  'BOOLEAN',
  'TEXT',
  'URL',
  'CATEGORICAL',
] as const;
export type IndicatorDataType = (typeof DATA_TYPES)[number];

/**
 * How progress toward the target is computed for an indicator.
 * `UNDEFINED` means the source document gives no methodology and none can be
 * inferred with confidence — the analytics engine MUST refuse to score these
 * rather than silently applying a default formula.
 */
export const CALCULATION_METHODS = [
  'PERCENTAGE_CHANGE', // value is itself a % change vs. baseline period
  'PERCENTAGE_POINT_CHANGE', // difference of two percentages, in pp
  'ABSOLUTE_COUNT', // raw count; progress = actual vs. target count
  'ABSOLUTE_VALUE', // raw monetary/continuous value
  'SHARE_OF_TOTAL', // a proportion of a defined denominator
  'INDEX_SCORE', // externally published composite index
  'RATIO', // ratio between two counts
  'BINARY_ACHIEVEMENT', // achieved / not achieved
  'CUSTOM', // needs a bespoke formula
  'UNDEFINED', // not derivable from the source — do not score
] as const;
export type CalculationMethod = (typeof CALCULATION_METHODS)[number];

export const DIRECTIONS = [
  'HIGHER_IS_BETTER',
  'LOWER_IS_BETTER',
  'TARGET_IS_BETTER', // closeness to target, in either direction
  'NOT_APPLICABLE',
] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Where a piece of metadata came from. */
export const PROVENANCES = [
  'SOURCE_DOCUMENT', // stated explicitly in the MEAL Plan
  'INFERRED_FROM_WORDING', // derived from the indicator's own phrasing
  'PLATFORM_ASSIGNED', // created by this platform (e.g. indicator codes)
  'NOT_PROVIDED', // absent from the source and not inferable
] as const;
export type Provenance = (typeof PROVENANCES)[number];

/** The level at which an indicator is naturally measured. */
export const UNITS_OF_ANALYSIS = [
  'COUNTRY', // a Member State reports its own value
  'CONTINENTAL', // phrased as a count/share across Member States
  'MIXED', // source mixes units of analysis in one statement
] as const;
export type UnitOfAnalysis = (typeof UNITS_OF_ANALYSIS)[number];

/** Machine-readable ambiguity markers surfaced in the admin UI. */
export const INDICATOR_FLAGS = [
  'NO_BASELINE_IN_SOURCE',
  'NO_TARGET_IN_SOURCE',
  'NO_OFFICIAL_CODE_IN_SOURCE',
  'NO_DEFINITION_IN_SOURCE',
  'NO_METHODOLOGY_IN_SOURCE',
  'COMPOUND_STATEMENT', // one table cell contains 2+ distinct measurements
  'DUPLICATE_OF_ANOTHER_ROW', // row repeats an earlier row verbatim/near-verbatim
  'OVERLAPS_ANOTHER_ROW', // measures substantially the same thing elsewhere
  'REQUIRES_DISAGGREGATION', // source asks for a breakdown not modelled as a single value
  'CONTINENTAL_LEVEL_WORDING', // worded continentally but reported per country
  'UNIT_NOT_SPECIFIED', // e.g. currency with no denomination
  'AMBIGUOUS_MEASUREMENT_BASIS', // e.g. "improvement (percentage)"
  'DIRECTION_INFERRED',
] as const;
export type IndicatorFlag = (typeof INDICATOR_FLAGS)[number];

// ---------------------------------------------------------------------------
// Sectors / categories
// ---------------------------------------------------------------------------

export interface SectorSeed {
  /** Platform-assigned stable key. Not an official AU code. */
  code: string;
  /** Verbatim heading from the MEAL Plan table. */
  name: string;
  /** Verbatim parenthetical sub-title where the source provides one. */
  subtitle: string | null;
  resultLevel: ResultLevel;
  /** Verbatim result statement the group sits under, where given. */
  resultStatement: string | null;
  sortOrder: number;
}

export const SECTORS: SectorSeed[] = [
  // ---- Outcome level ------------------------------------------------------
  {
    code: 'O1',
    name: 'Outcome 1: Increased Economic and Inclusive Development',
    subtitle: null,
    resultLevel: 'OUTCOME',
    resultStatement:
      'Enhanced knowledge-based and innovation-led socio-economic development among AU Member States',
    sortOrder: 30,
  },
  {
    code: 'O2',
    name: 'Outcome 2: Enhanced science diplomacy and open science',
    subtitle: null,
    resultLevel: 'OUTCOME',
    resultStatement:
      'Enhanced knowledge-based and innovation-led socio-economic development among AU Member States',
    sortOrder: 40,
  },
  {
    code: 'O3',
    name: 'Outcome 3: Enhanced human resource and institutional capacities',
    subtitle: null,
    resultLevel: 'OUTCOME',
    resultStatement:
      'Enhanced knowledge-based and innovation-led socio-economic development among AU Member States',
    sortOrder: 50,
  },
  {
    code: 'O4',
    name: 'Outcome 4: Empowered women and youth and jobs created',
    subtitle: null,
    resultLevel: 'OUTCOME',
    resultStatement:
      'Enhanced knowledge-based and innovation-led socio-economic development among AU Member States',
    sortOrder: 60,
  },
  {
    code: 'O5',
    name: 'Outcome 5: Increased public and private sector investment in R&D',
    subtitle: null,
    resultLevel: 'OUTCOME',
    resultStatement:
      'Enhanced knowledge-based and innovation-led socio-economic development among AU Member States',
    sortOrder: 70,
  },

  // ---- Sectorial priorities ----------------------------------------------
  {
    code: 'AGR',
    name: 'Agriculture',
    subtitle: 'Food and Nutritional Security',
    resultLevel: 'SECTORIAL_PRIORITY',
    resultStatement: null,
    sortOrder: 80,
  },
  {
    code: 'HLT',
    name: 'Health',
    subtitle: 'Strengthening Health Systems and Emergence Preparedness',
    resultLevel: 'SECTORIAL_PRIORITY',
    resultStatement: null,
    sortOrder: 90,
  },
  {
    code: 'ICT',
    name: 'Information and Communication Technologies',
    subtitle:
      'Expanding Digital Connectivity, Reducing the Digital Divide and Fostering Digital Skills',
    resultLevel: 'SECTORIAL_PRIORITY',
    resultStatement: null,
    sortOrder: 100,
  },
  {
    code: 'ENE',
    name: 'Energy',
    subtitle: 'Promoting Access to Affordable Clean Energy, An African Just Energy Transition',
    resultLevel: 'SECTORIAL_PRIORITY',
    resultStatement: null,
    sortOrder: 110,
  },
  {
    code: 'ENV',
    name: 'Environment',
    subtitle: 'Tackling Climate Change, Biodiversity Loss, and Water Scarcity',
    resultLevel: 'SECTORIAL_PRIORITY',
    resultStatement: null,
    sortOrder: 120,
  },

  // ---- Strategic priorities ----------------------------------------------
  {
    code: 'SP1',
    name: 'Strategic Priority 1: STI for Accelerating Sustainable and Inclusive Industrialization',
    subtitle: null,
    resultLevel: 'STRATEGIC_PRIORITY',
    resultStatement: null,
    sortOrder: 130,
  },
  {
    code: 'SP2',
    name: 'Strategic Priority 2: Building Human Capital and Infrastructure for Research and Innovation',
    subtitle: null,
    resultLevel: 'STRATEGIC_PRIORITY',
    resultStatement: null,
    sortOrder: 140,
  },
  {
    code: 'SP3',
    name: 'Strategic Priority 3: Building African Capabilities in Frontier and Emerging Technologies',
    subtitle: null,
    resultLevel: 'STRATEGIC_PRIORITY',
    resultStatement: null,
    sortOrder: 150,
  },
  {
    code: 'SP4',
    name: 'Strategic Priority 4: Strengthening Science Diplomacy and Partnerships in STI',
    subtitle: null,
    resultLevel: 'STRATEGIC_PRIORITY',
    resultStatement: null,
    sortOrder: 160,
  },
  {
    code: 'SP5',
    name: 'Strategic Priority 5: Promoting Private Sector Engagement in Research and Innovation (or STI)',
    subtitle: null,
    resultLevel: 'STRATEGIC_PRIORITY',
    resultStatement: null,
    sortOrder: 170,
  },
  {
    code: 'SP6',
    name: 'Strategic Priority 6: Addressing Youth Unemployment and Gender Inequalities',
    subtitle: null,
    resultLevel: 'STRATEGIC_PRIORITY',
    resultStatement: null,
    sortOrder: 180,
  },
];

// ---------------------------------------------------------------------------
// Indicators
// ---------------------------------------------------------------------------

export interface IndicatorSeed {
  /**
   * PLATFORM-ASSIGNED code. The MEAL Plan does not number its indicators.
   * Format: <SECTOR>-<3-digit ordinal within sector, in source row order>.
   */
  code: string;
  sectorCode: string;
  /** Verbatim indicator cell text, exactly as printed. */
  sourceText: string;
  /** Display name: `sourceText` with only trailing punctuation trimmed. */
  officialName: string;
  /** Printed page of the Implementation Plan the row appears on. */
  sourcePage: number;
  /** 1-based row position within the sector group, as printed. */
  sourceRow: number;

  unit: string;
  unitProvenance: Provenance;
  dataType: IndicatorDataType;
  dataTypeProvenance: Provenance;
  calculationMethod: CalculationMethod;
  calculationProvenance: Provenance;
  direction: Direction;
  directionProvenance: Provenance;
  unitOfAnalysis: UnitOfAnalysis;

  /** Source supplies no definitions; always null until officially provided. */
  definition: string | null;

  flags: IndicatorFlag[];
  /** Human-readable note explaining every flag on this row. */
  ambiguityNote: string | null;
  /** Codes of rows this row duplicates or overlaps. */
  relatedCodes: string[];
}

/** Flags that apply to every single row because the source omits them wholesale. */
const UNIVERSAL_FLAGS: IndicatorFlag[] = [
  'NO_BASELINE_IN_SOURCE',
  'NO_TARGET_IN_SOURCE',
  'NO_OFFICIAL_CODE_IN_SOURCE',
  'NO_DEFINITION_IN_SOURCE',
  'NO_METHODOLOGY_IN_SOURCE',
];

type RawIndicator = Omit<IndicatorSeed, 'officialName' | 'flags' | 'definition'> & {
  flags?: IndicatorFlag[];
};

const trimTrailing = (s: string) => s.replace(/[\s;.]+$/u, '');

const raw: RawIndicator[] = [
  // =========================================================================
  // OUTCOME 1 (page 37)
  // =========================================================================
  {
    code: 'O1-001',
    sectorCode: 'O1',
    sourceText: 'Percentage change in the contribution of STI to GDP',
    sourcePage: 37,
    sourceRow: 1,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote:
      '"Contribution of STI to GDP" is not defined in the source and has no standard national-accounts definition. Countries may compute it differently.',
    flags: ['AMBIGUOUS_MEASUREMENT_BASIS'],
    relatedCodes: [],
  },
  {
    code: 'O1-002',
    sectorCode: 'O1',
    sourceText: 'Percentage change in Manufacturing Value Added',
    sourcePage: 37,
    sourceRow: 2,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },
  {
    code: 'O1-003',
    sectorCode: 'O1',
    sourceText: 'Percentage change in GDP per capita',
    sourcePage: 37,
    sourceRow: 3,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },

  // =========================================================================
  // OUTCOME 2 (page 37)
  // =========================================================================
  {
    code: 'O2-001',
    sectorCode: 'O2',
    sourceText:
      'Percentage change in the number of bi-lateral and multi-lateral agreements facilitating scientific exchange and collaboration',
    sourcePage: 37,
    sourceRow: 1,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['OVERLAPS_ANOTHER_ROW'],
    ambiguityNote:
      'Measures substantially the same construct as SP4-005 ("Percentage change in the number of bilateral and multilateral STI agreements signed"). Both rows are preserved as printed.',
    relatedCodes: ['SP4-005'],
  },
  {
    code: 'O2-002',
    sectorCode: 'O2',
    sourceText:
      'Percentage change in the number of African-owned knowledge products in global open access publications',
    sourcePage: 37,
    sourceRow: 2,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },
  {
    code: 'O2-003',
    sectorCode: 'O2',
    sourceText:
      'Percentage change in the share of African research publications in global research publications (disaggregated by sector)',
    sourcePage: 37,
    sourceRow: 3,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['REQUIRES_DISAGGREGATION'],
    ambiguityNote:
      'Source requires disaggregation by sector but defines neither the sector list nor how the disaggregates roll up. The platform captures a single aggregate value plus notes; per-sector capture requires official guidance.',
    relatedCodes: [],
  },

  // =========================================================================
  // OUTCOME 3 (page 37)
  // =========================================================================
  {
    code: 'O3-001',
    sectorCode: 'O3',
    sourceText:
      'Percentage change in the number of STEM graduates with advanced degrees (Master’s, PhDs) in STI and emerging technologies.',
    sourcePage: 37,
    sourceRow: 1,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },
  {
    code: 'O3-002',
    sectorCode: 'O3',
    sourceText:
      'Percentage change in the number of IPs, including patents, (co)-owned by Africans (disaggregated by sector)',
    sourcePage: 37,
    sourceRow: 2,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['REQUIRES_DISAGGREGATION'],
    ambiguityNote:
      'Source requires disaggregation by sector; no sector list or roll-up rule is provided. Captured as a single aggregate value.',
    relatedCodes: [],
  },
  {
    code: 'O3-003',
    sectorCode: 'O3',
    sourceText:
      'Level (Percentage) of resource mobilization achieved through funds leveraged and partnerships formed.',
    sourcePage: 37,
    sourceRow: 3,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'UNDEFINED',
    calculationProvenance: 'NOT_PROVIDED',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['AMBIGUOUS_MEASUREMENT_BASIS'],
    ambiguityNote:
      '"Level (Percentage) of resource mobilization achieved" has no stated denominator (achieved against what mobilisation goal?). The analytics engine will NOT score this indicator until an official methodology is supplied.',
    relatedCodes: [],
  },

  // =========================================================================
  // OUTCOME 4 (page 37)
  // =========================================================================
  {
    code: 'O4-001',
    sectorCode: 'O4',
    sourceText:
      'Percentage change in the number of women and/or youth-led tech start-ups and incubators',
    sourcePage: 37,
    sourceRow: 1,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['OVERLAPS_ANOTHER_ROW'],
    ambiguityNote:
      'Overlaps SP6-003 ("Number of tech start-ups owned by youth and women"), which measures the same population as a count rather than a change.',
    relatedCodes: ['SP6-003'],
  },
  {
    code: 'O4-002',
    sectorCode: 'O4',
    sourceText: 'Percentage change in the number of new jobs in manufacturing SMEs',
    sourcePage: 37,
    sourceRow: 2,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['OVERLAPS_ANOTHER_ROW'],
    ambiguityNote:
      'Overlaps SP1-004 ("Number of new jobs created (particularly in or by manufacturing SMEs)"), which measures the same population as a count.',
    relatedCodes: ['SP1-004'],
  },

  // =========================================================================
  // OUTCOME 5 (page 37)
  // =========================================================================
  {
    code: 'O5-001',
    sectorCode: 'O5',
    sourceText:
      'Percentage change in volume of public and private sector investments in R&D',
    sourcePage: 37,
    sourceRow: 1,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },
  {
    code: 'O5-002',
    sectorCode: 'O5',
    sourceText: 'Percentage of GDP allocated to R&D',
    sourcePage: 37,
    sourceRow: 2,
    unit: 'Percent (%) of GDP',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'SHARE_OF_TOTAL',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['DUPLICATE_OF_ANOTHER_ROW'],
    ambiguityNote:
      'The same indicator text appears again under Strategic Priority 1 (SP1-001). Both rows are preserved; do not double-count when aggregating across result levels.',
    relatedCodes: ['SP1-001'],
  },
  {
    code: 'O5-003',
    sectorCode: 'O5',
    sourceText: 'Percentage of R&D investments allocated to local innovation initiatives',
    sourcePage: 37,
    sourceRow: 3,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'SHARE_OF_TOTAL',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },

  // =========================================================================
  // SECTORIAL PRIORITY — Agriculture (page 38)
  // =========================================================================
  {
    code: 'AGR-001',
    sectorCode: 'AGR',
    sourceText:
      'Number of enterprises (or industries) and research institutes deploying (or specializing in) frontier technologies in food and agricultural production. Number of agricultural businesses involved in the adoption of advanced ICTs (Precision Agriculture, Air and Soil sensors, Smart Plant/animal breeding, Drones/Robotics, AI, Block chain technologies, other).',
    sourcePage: 38,
    sourceRow: 1,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['COMPOUND_STATEMENT'],
    ambiguityNote:
      'This single table cell contains TWO distinct measurement statements: (a) enterprises/industries and research institutes deploying frontier technologies, and (b) agricultural businesses adopting advanced ICTs. The source does not indicate whether these are one indicator or two. Preserved as printed (one row); a single numeric value cannot faithfully represent both. Requires official clarification before scoring.',
    relatedCodes: [],
  },
  {
    code: 'AGR-002',
    sectorCode: 'AGR',
    sourceText:
      'Percentage (population) of African smallholder farmers using frontier technologies such as drones and AI.',
    sourcePage: 38,
    sourceRow: 2,
    unit: 'Percent (%) of smallholder farmers',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'SHARE_OF_TOTAL',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },
  {
    code: 'AGR-003',
    sectorCode: 'AGR',
    sourceText:
      'Number of agricultural businesses actively involved in innovation activities against those that did not engage in any innovation activity.',
    sourcePage: 38,
    sourceRow: 3,
    unit: 'Ratio (innovation-active : non-innovating)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'DECIMAL',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'RATIO',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['AMBIGUOUS_MEASUREMENT_BASIS'],
    ambiguityNote:
      'Phrased as a comparison ("against those that did not") but labelled "Number of". The source does not say whether to report a count, a ratio or both figures. Modelled as a ratio; the notes field should carry both underlying counts.',
    relatedCodes: ['AGR-006'],
  },
  {
    code: 'AGR-004',
    sectorCode: 'AGR',
    sourceText: 'Innovation-active firms by Geographic Export Market.',
    sourcePage: 38,
    sourceRow: 4,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['REQUIRES_DISAGGREGATION'],
    ambiguityNote:
      'Requires a breakdown by geographic export market; the source lists no markets. Captured as a total with the breakdown in notes.',
    relatedCodes: ['AGR-007'],
  },
  {
    code: 'AGR-005',
    sectorCode: 'AGR',
    sourceText: 'Percentage of GDP based on agricultural/food exports.',
    sourcePage: 38,
    sourceRow: 5,
    unit: 'Percent (%) of GDP',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'SHARE_OF_TOTAL',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: ['AGR-008'],
  },
  {
    code: 'AGR-006',
    sectorCode: 'AGR',
    sourceText:
      'Number of agricultural businesses actively involved in innovation activities and those that did not engage in any innovation activity.',
    sourcePage: 38,
    sourceRow: 6,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['DUPLICATE_OF_ANOTHER_ROW'],
    ambiguityNote:
      'Near-verbatim repeat of AGR-003, differing only by "and" in place of "against". Preserved as printed rather than merged, per the source-of-truth rule. Do not double-count.',
    relatedCodes: ['AGR-003'],
  },
  {
    code: 'AGR-007',
    sectorCode: 'AGR',
    sourceText: 'Innovation-active firms by Geographic Export Markets.',
    sourcePage: 38,
    sourceRow: 7,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['DUPLICATE_OF_ANOTHER_ROW', 'REQUIRES_DISAGGREGATION'],
    ambiguityNote:
      'Repeat of AGR-004, differing only by the plural "Markets". Preserved as printed. Do not double-count.',
    relatedCodes: ['AGR-004'],
  },
  {
    code: 'AGR-008',
    sectorCode: 'AGR',
    sourceText: 'Percentage of GDP based on agricultural/food exports.',
    sourcePage: 38,
    sourceRow: 8,
    unit: 'Percent (%) of GDP',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'SHARE_OF_TOTAL',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['DUPLICATE_OF_ANOTHER_ROW'],
    ambiguityNote:
      'Exact verbatim repeat of AGR-005. Preserved as printed. Do not double-count.',
    relatedCodes: ['AGR-005'],
  },

  // =========================================================================
  // SECTORIAL PRIORITY — Health (page 38)
  // =========================================================================
  {
    code: 'HLT-001',
    sectorCode: 'HLT',
    sourceText:
      'AU (ACDC) network for health genomics and proteomics research and innovation established and well-resourced.',
    sourcePage: 38,
    sourceRow: 1,
    unit: 'Yes / No',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'BOOLEAN',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'BINARY_ACHIEVEMENT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'CONTINENTAL',
    flags: ['CONTINENTAL_LEVEL_WORDING', 'AMBIGUOUS_MEASUREMENT_BASIS'],
    ambiguityNote:
      'A continental milestone (an AU/Africa CDC network), not a Member State measurement, and "well-resourced" is undefined. Country-level reporting is optional; continental achievement should be recorded by the AU administrator.',
    relatedCodes: [],
  },
  {
    code: 'HLT-002',
    sectorCode: 'HLT',
    sourceText:
      'Percentage change of scientific publications on patents for human genomes, diagnostics and other medical products. % increase in the local manufacturers of pharmaceuticals.',
    sourcePage: 38,
    sourceRow: 2,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['COMPOUND_STATEMENT', 'OVERLAPS_ANOTHER_ROW'],
    ambiguityNote:
      'This cell contains TWO distinct statements: (a) percentage change of scientific publications on patents for human genomes/diagnostics/medical products, and (b) percentage increase in local pharmaceutical manufacturers. Statement (b) is also printed on its own as HLT-008. Preserved as printed; the stored value is understood to address statement (a) only. Requires official clarification.',
    relatedCodes: ['HLT-008'],
  },
  {
    code: 'HLT-003',
    sectorCode: 'HLT',
    sourceText:
      'Number of countries with functioning (and well-funded) digital health systems based on WHO (and ACDC) criteria.',
    sourcePage: 38,
    sourceRow: 3,
    unit: 'Count of Member States',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'CONTINENTAL',
    flags: ['CONTINENTAL_LEVEL_WORDING'],
    ambiguityNote:
      'Worded as a count of countries, so it is a continental aggregate. At Member State level the meaningful response is Yes/No; the platform derives the continental count from country responses and flags the transformation.',
    relatedCodes: [],
  },
  {
    code: 'HLT-004',
    sectorCode: 'HLT',
    sourceText: '% of national health budgets dedicated to health research and innovation.',
    sourcePage: 38,
    sourceRow: 4,
    unit: 'Percent (%) of national health budget',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'SHARE_OF_TOTAL',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },
  {
    code: 'HLT-005',
    sectorCode: 'HLT',
    sourceText: 'Number of PPP devoted to health RDI.',
    sourcePage: 38,
    sourceRow: 5,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote:
      'Abbreviations "PPP" (public-private partnership) and "RDI" (research, development and innovation) are not expanded in the source.',
    flags: ['AMBIGUOUS_MEASUREMENT_BASIS'],
    relatedCodes: [],
  },
  {
    code: 'HLT-006',
    sectorCode: 'HLT',
    sourceText:
      'Number of health-related innovations developed (and adopted) such as vaccines and diagnostics.',
    sourcePage: 38,
    sourceRow: 6,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['AMBIGUOUS_MEASUREMENT_BASIS'],
    ambiguityNote:
      '"developed (and adopted)" leaves it unclear whether adoption is required for an innovation to be counted.',
    relatedCodes: [],
  },
  {
    code: 'HLT-007',
    sectorCode: 'HLT',
    sourceText:
      'Number of Member States with a policy on procurement for innovation - publicly funded technologies newly introduced into public health, public education, local government service delivery, and safety and security (police and defence).',
    sourcePage: 38,
    sourceRow: 7,
    unit: 'Count of Member States',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'CONTINENTAL',
    flags: ['CONTINENTAL_LEVEL_WORDING'],
    ambiguityNote:
      'Counts Member States, so it is a continental aggregate; at country level the meaningful response is Yes/No.',
    relatedCodes: [],
  },
  {
    code: 'HLT-008',
    sectorCode: 'HLT',
    sourceText: '% increase in the local manufacturers of pharmaceuticals.',
    sourcePage: 38,
    sourceRow: 8,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['DUPLICATE_OF_ANOTHER_ROW'],
    ambiguityNote:
      'Repeats the second statement embedded in HLT-002. Preserved as printed. Do not double-count.',
    relatedCodes: ['HLT-002'],
  },

  // =========================================================================
  // SECTORIAL PRIORITY — ICT (page 38)
  // =========================================================================
  {
    code: 'ICT-001',
    sectorCode: 'ICT',
    sourceText:
      'Number of African countries with advanced digital connectivity infrastructure such as 5G or 6G.',
    sourcePage: 38,
    sourceRow: 1,
    unit: 'Count of Member States',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'CONTINENTAL',
    flags: ['CONTINENTAL_LEVEL_WORDING'],
    ambiguityNote:
      'Counts countries; at Member State level the meaningful response is Yes/No.',
    relatedCodes: [],
  },
  {
    code: 'ICT-002',
    sectorCode: 'ICT',
    sourceText:
      'Number of Member States implementing the AU Protocol on Cybersecurity and Personal Data Protection.',
    sourcePage: 38,
    sourceRow: 2,
    unit: 'Count of Member States',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'CONTINENTAL',
    flags: ['CONTINENTAL_LEVEL_WORDING'],
    ambiguityNote:
      'Counts Member States; at country level the meaningful response is Yes/No.',
    relatedCodes: [],
  },
  {
    code: 'ICT-003',
    sectorCode: 'ICT',
    sourceText:
      'Number of research centres (institutes) with functional frontier and emerging technology systems driven by AI and advanced computing technologies.',
    sourcePage: 38,
    sourceRow: 3,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },
  {
    code: 'ICT-004',
    sectorCode: 'ICT',
    sourceText: 'Percentage increase in internet penetration rate across African countries.',
    sourcePage: 38,
    sourceRow: 4,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['AMBIGUOUS_MEASUREMENT_BASIS'],
    ambiguityNote:
      'The penetration rate is itself a percentage, so "percentage increase" could mean relative % change or percentage-point change. Modelled as relative % change; confirm officially.',
    relatedCodes: [],
  },
  {
    code: 'ICT-005',
    sectorCode: 'ICT',
    sourceText:
      'Improvement (Percentage) in national/regional/continental assessments of digital literacy among learners.',
    sourcePage: 38,
    sourceRow: 5,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'UNDEFINED',
    calculationProvenance: 'NOT_PROVIDED',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'MIXED',
    flags: ['AMBIGUOUS_MEASUREMENT_BASIS', 'REQUIRES_DISAGGREGATION'],
    ambiguityNote:
      'No assessment instrument is named and the measurement basis of "Improvement (Percentage)" is unstated. Also mixes national, regional and continental units of analysis in one row. Not scored until an official methodology is supplied.',
    relatedCodes: [],
  },

  // =========================================================================
  // SECTORIAL PRIORITY — Energy (page 39)
  // =========================================================================
  {
    code: 'ENE-001',
    sectorCode: 'ENE',
    sourceText:
      'Percentage of the continent’s population accessing clean, sustainable energy.',
    sourcePage: 39,
    sourceRow: 1,
    unit: 'Percent (%) of population',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'SHARE_OF_TOTAL',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'CONTINENTAL',
    flags: ['CONTINENTAL_LEVEL_WORDING'],
    ambiguityNote:
      'Expressed against the continent’s population. Member States report their own national share; the continental figure must be a population-weighted aggregate, not a simple mean of country percentages.',
    relatedCodes: [],
  },
  {
    code: 'ENE-002',
    sectorCode: 'ENE',
    sourceText:
      'Number of African (and jointly with non-African partners) energy patents.',
    sourcePage: 39,
    sourceRow: 2,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },
  {
    code: 'ENE-003',
    sectorCode: 'ENE',
    sourceText: 'Number of centres of excellence in energy.',
    sourcePage: 39,
    sourceRow: 3,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },

  // =========================================================================
  // SECTORIAL PRIORITY — Environment (page 39)
  // =========================================================================
  {
    code: 'ENV-001',
    sectorCode: 'ENV',
    sourceText:
      'Percentage reduction in CO₂ emissions per capita compared to the baseline year.',
    sourcePage: 39,
    sourceRow: 1,
    unit: 'Percent (%) reduction',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['DIRECTION_INFERRED'],
    ambiguityNote:
      'The reported quantity is a REDUCTION, so a larger reported value is better even though the underlying variable (CO₂ per capita) is lower-is-better. Report the reduction as a positive number.',
    relatedCodes: [],
  },
  {
    code: 'ENV-002',
    sectorCode: 'ENV',
    sourceText:
      'Number of new research and innovation projects (on climate change, biodiversity and water resources) developed.',
    sourcePage: 39,
    sourceRow: 2,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },
  {
    code: 'ENV-003',
    sectorCode: 'ENV',
    sourceText: 'Number of operational early warning systems across member states.',
    sourcePage: 39,
    sourceRow: 3,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote:
      '"across member states" suggests a continental total; the platform collects national counts and sums them.',
    flags: ['CONTINENTAL_LEVEL_WORDING'],
    relatedCodes: [],
  },
  {
    code: 'ENV-004',
    sectorCode: 'ENV',
    sourceText:
      'Percentage of member states with updated DRR and preparedness guidelines aligned to latest scientific evidence.',
    sourcePage: 39,
    sourceRow: 4,
    unit: 'Percent (%) of Member States',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'SHARE_OF_TOTAL',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'CONTINENTAL',
    flags: ['CONTINENTAL_LEVEL_WORDING'],
    ambiguityNote:
      'A share of Member States, so a continental aggregate; at country level the meaningful response is Yes/No. "DRR" (disaster risk reduction) is not expanded in the source.',
    relatedCodes: [],
  },
  {
    code: 'ENV-005',
    sectorCode: 'ENV',
    sourceText:
      'Number of countries or institutions adopting harmonised biodiversity conservation protocols.',
    sourcePage: 39,
    sourceRow: 5,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'MIXED',
    flags: ['AMBIGUOUS_MEASUREMENT_BASIS', 'CONTINENTAL_LEVEL_WORDING'],
    ambiguityNote:
      'Mixes two incompatible units of analysis ("countries OR institutions") in one count. Values are not comparable across countries without official clarification.',
    relatedCodes: [],
  },
  {
    code: 'ENV-006',
    sectorCode: 'ENV',
    sourceText:
      'Percentage of national policies integrating indigenous knowledge for environmental governance.',
    sourcePage: 39,
    sourceRow: 6,
    unit: 'Percent (%) of national policies',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'SHARE_OF_TOTAL',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['AMBIGUOUS_MEASUREMENT_BASIS'],
    ambiguityNote:
      'The denominator ("national policies" — which policies, in which domain?) is not defined in the source.',
    relatedCodes: [],
  },
  {
    code: 'ENV-007',
    sectorCode: 'ENV',
    sourceText:
      'Number of adaptation projects with documented community participation frameworks.',
    sourcePage: 39,
    sourceRow: 7,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },

  // =========================================================================
  // STRATEGIC PRIORITY 1 (page 39)
  // =========================================================================
  {
    code: 'SP1-001',
    sectorCode: 'SP1',
    sourceText: 'Percentage of GDP allocated to R&D.',
    sourcePage: 39,
    sourceRow: 1,
    unit: 'Percent (%) of GDP',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'SHARE_OF_TOTAL',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['DUPLICATE_OF_ANOTHER_ROW'],
    ambiguityNote:
      'Same indicator text as O5-002 at Outcome level. Both rows preserved; do not double-count across result levels.',
    relatedCodes: ['O5-002'],
  },
  {
    code: 'SP1-002',
    sectorCode: 'SP1',
    sourceText: 'Number of women and youth engaged in STI.',
    sourcePage: 39,
    sourceRow: 2,
    unit: 'Count of persons',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['AMBIGUOUS_MEASUREMENT_BASIS'],
    ambiguityNote:
      '"engaged in STI" is undefined (employment? study? participation?), and women and youth are overlapping populations that the source does not tell us how to handle.',
    relatedCodes: [],
  },
  {
    code: 'SP1-003',
    sectorCode: 'SP1',
    sourceText: 'Share of high-tech products in exports.',
    sourcePage: 39,
    sourceRow: 3,
    unit: 'Percent (%) of exports',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'SHARE_OF_TOTAL',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },
  {
    code: 'SP1-004',
    sectorCode: 'SP1',
    sourceText: 'Number of new jobs created (particularly in or by manufacturing SMEs).',
    sourcePage: 39,
    sourceRow: 4,
    unit: 'Count of jobs',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['OVERLAPS_ANOTHER_ROW', 'AMBIGUOUS_MEASUREMENT_BASIS'],
    ambiguityNote:
      '"particularly in or by manufacturing SMEs" does not say whether the count is restricted to manufacturing SMEs or economy-wide. Overlaps O4-002.',
    relatedCodes: ['O4-002'],
  },
  {
    code: 'SP1-005',
    sectorCode: 'SP1',
    sourceText:
      'Percentage change in number of STI based start-ups and enterprises (public vs private level)',
    sourcePage: 39,
    sourceRow: 5,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['REQUIRES_DISAGGREGATION'],
    ambiguityNote:
      'Requires a public vs. private split that a single value cannot carry. Captured as an aggregate with the split recorded in notes.',
    relatedCodes: [],
  },

  // =========================================================================
  // STRATEGIC PRIORITY 2 (page 39)
  // =========================================================================
  {
    code: 'SP2-001',
    sectorCode: 'SP2',
    sourceText: 'Percentage change in R&D funding for STI skills and education.',
    sourcePage: 39,
    sourceRow: 1,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },
  {
    code: 'SP2-002',
    sectorCode: 'SP2',
    sourceText: 'Number of personnel trained in research and innovation management.',
    sourcePage: 39,
    sourceRow: 2,
    unit: 'Count of persons',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },
  {
    code: 'SP2-003',
    sectorCode: 'SP2',
    sourceText: 'Percentage of the population with basic innovation/entrepreneurial skills.',
    sourcePage: 39,
    sourceRow: 3,
    unit: 'Percent (%) of population',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'SHARE_OF_TOTAL',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['AMBIGUOUS_MEASUREMENT_BASIS'],
    ambiguityNote:
      '"basic innovation/entrepreneurial skills" has no stated assessment standard.',
    relatedCodes: [],
  },
  {
    code: 'SP2-004',
    sectorCode: 'SP2',
    sourceText:
      'Number of research institutes with laboratories (or infrastructures) meeting international standards.',
    sourcePage: 39,
    sourceRow: 4,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['AMBIGUOUS_MEASUREMENT_BASIS'],
    ambiguityNote: 'No specific international standard (e.g. ISO 17025) is named.',
    relatedCodes: [],
  },
  {
    code: 'SP2-005',
    sectorCode: 'SP2',
    sourceText: 'Number of new Research institutes.',
    sourcePage: 39,
    sourceRow: 5,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },

  // =========================================================================
  // STRATEGIC PRIORITY 3 (page 39)
  // =========================================================================
  {
    code: 'SP3-001',
    sectorCode: 'SP3',
    sourceText:
      'Number of national-level institutions offering training in Technology Assessment (TA) and Technology Foresight (TF).',
    sourcePage: 39,
    sourceRow: 1,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },
  {
    code: 'SP3-002',
    sectorCode: 'SP3',
    sourceText:
      'Percentage change in the value of investments in frontier technology start-ups, innovation hubs and emerging technologies.',
    sourcePage: 39,
    sourceRow: 2,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: ['SP3-003'],
  },
  {
    code: 'SP3-003',
    sectorCode: 'SP3',
    sourceText:
      'Percentage change in the value of investments in frontier technology startups, innovation hubs and emerging technologies.',
    sourcePage: 39,
    sourceRow: 3,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['DUPLICATE_OF_ANOTHER_ROW'],
    ambiguityNote:
      'Repeat of SP3-002, differing only by the spelling "startups" vs "start-ups". Preserved as printed. Do not double-count.',
    relatedCodes: ['SP3-002'],
  },

  // =========================================================================
  // STRATEGIC PRIORITY 4 (page 39)
  // =========================================================================
  {
    code: 'SP4-001',
    sectorCode: 'SP4',
    sourceText:
      'Number of African officials and scientists/attaches trained (or course participants) in science diplomacy.',
    sourcePage: 39,
    sourceRow: 1,
    unit: 'Count of persons',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },
  {
    code: 'SP4-002',
    sectorCode: 'SP4',
    sourceText: 'Number of member States with open science policies and platforms.',
    sourcePage: 39,
    sourceRow: 2,
    unit: 'Count of Member States',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'CONTINENTAL',
    flags: ['CONTINENTAL_LEVEL_WORDING'],
    ambiguityNote:
      'Counts Member States; at country level the meaningful response is Yes/No.',
    relatedCodes: [],
  },
  {
    code: 'SP4-003',
    sectorCode: 'SP4',
    sourceText: 'Number of member States with science diplomacy strategies.',
    sourcePage: 39,
    sourceRow: 3,
    unit: 'Count of Member States',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'CONTINENTAL',
    flags: ['CONTINENTAL_LEVEL_WORDING'],
    ambiguityNote:
      'Counts Member States; at country level the meaningful response is Yes/No.',
    relatedCodes: [],
  },
  {
    code: 'SP4-004',
    sectorCode: 'SP4',
    sourceText:
      'Percentage increase in researcher mobility linked to scientific agreements and participation in global STI forums.',
    sourcePage: 39,
    sourceRow: 4,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['AMBIGUOUS_MEASUREMENT_BASIS'],
    ambiguityNote: '"researcher mobility" has no stated unit (people, trips, person-months?).',
    relatedCodes: [],
  },
  {
    code: 'SP4-005',
    sectorCode: 'SP4',
    sourceText:
      'Percentage change in the number of bilateral and multilateral STI agreements signed.',
    sourcePage: 39,
    sourceRow: 5,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'PERCENTAGE_CHANGE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['OVERLAPS_ANOTHER_ROW'],
    ambiguityNote:
      'Measures substantially the same construct as O2-001 at Outcome level. Both preserved; do not double-count.',
    relatedCodes: ['O2-001'],
  },

  // =========================================================================
  // STRATEGIC PRIORITY 5 (page 40)
  // =========================================================================
  {
    code: 'SP5-001',
    sectorCode: 'SP5',
    sourceText:
      'Number of AU Member States with policies for private sector involvement in R&D.',
    sourcePage: 40,
    sourceRow: 1,
    unit: 'Count of Member States',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'CONTINENTAL',
    flags: ['CONTINENTAL_LEVEL_WORDING'],
    ambiguityNote:
      'Counts Member States; at country level the meaningful response is Yes/No.',
    relatedCodes: [],
  },
  {
    code: 'SP5-002',
    sectorCode: 'SP5',
    sourceText:
      'Share of the private sector’s R&D funding (Business Expenditure on R&D (BERD)).',
    sourcePage: 40,
    sourceRow: 2,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'SHARE_OF_TOTAL',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['AMBIGUOUS_MEASUREMENT_BASIS'],
    ambiguityNote:
      'The denominator is unstated — BERD is conventionally expressed as a share of GERD or of GDP, and the source does not say which.',
    relatedCodes: [],
  },
  {
    code: 'SP5-003',
    sectorCode: 'SP5',
    sourceText:
      'Government Budget for Scientific and Technological Activities total and by Socio-economic objectives (SEOs).',
    sourcePage: 40,
    sourceRow: 3,
    unit: 'Currency (denomination not specified in source)',
    unitProvenance: 'NOT_PROVIDED',
    dataType: 'CURRENCY',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_VALUE',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['UNIT_NOT_SPECIFIED', 'REQUIRES_DISAGGREGATION'],
    ambiguityNote:
      'No currency or price basis (nominal/real, local/USD) is specified, so cross-country comparison is unsafe. Also requires a breakdown by socio-economic objective that a single value cannot carry.',
    relatedCodes: [],
  },
  {
    code: 'SP5-004',
    sectorCode: 'SP5',
    sourceText: 'No of incentives/instruments to increase BERD/GERD.',
    sourcePage: 40,
    sourceRow: 4,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },
  {
    code: 'SP5-005',
    sectorCode: 'SP5',
    sourceText: 'Number of STI partnerships and partnership-based projects developed.',
    sourcePage: 40,
    sourceRow: 5,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },
  {
    code: 'SP5-006',
    sectorCode: 'SP5',
    sourceText:
      'Number of STI partnerships between AU Member States and the private sector, with a joint investment level of beyond $10M.',
    sourcePage: 40,
    sourceRow: 6,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote:
      'The $10M threshold is stated in the source; the currency is assumed to be USD as printed ("$").',
    relatedCodes: [],
  },
  {
    code: 'SP5-007',
    sectorCode: 'SP5',
    sourceText:
      'Number of public-private dialogues (national, regional, and pan-African) convened on R&D funding and financing.',
    sourcePage: 40,
    sourceRow: 7,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'MIXED',
    flags: ['REQUIRES_DISAGGREGATION'],
    ambiguityNote:
      'Spans national, regional and pan-African dialogues in one count; the source gives no rule for attributing regional/pan-African events to individual Member States.',
    relatedCodes: [],
  },
  {
    code: 'SP5-008',
    sectorCode: 'SP5',
    sourceText:
      'Number of patents generated for joint private-public innovation activities. Number of joint intellectual property (IP), products, and technologies developed with the private sector.',
    sourcePage: 40,
    sourceRow: 8,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['COMPOUND_STATEMENT'],
    ambiguityNote:
      'This cell contains TWO distinct measurement statements: (a) patents from joint private-public innovation activities, and (b) joint IP, products and technologies developed with the private sector. Preserved as printed (one row); a single value cannot faithfully represent both. Requires official clarification.',
    relatedCodes: [],
  },
  {
    code: 'SP5-009',
    sectorCode: 'SP5',
    sourceText:
      'Number of AU Member State-led strategic programmes aimed at catalysing venture capital investment to support innovation.',
    sourcePage: 40,
    sourceRow: 9,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },

  // =========================================================================
  // STRATEGIC PRIORITY 6 (page 40)
  // =========================================================================
  {
    code: 'SP6-001',
    sectorCode: 'SP6',
    sourceText:
      'Percentage of women and youth population in STEM and TVET programs and projects.',
    sourcePage: 40,
    sourceRow: 1,
    unit: 'Percent (%)',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'PERCENTAGE',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'SHARE_OF_TOTAL',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['AMBIGUOUS_MEASUREMENT_BASIS'],
    ambiguityNote:
      'The denominator is unstated (share of all STEM/TVET enrolment, or share of the women/youth population?).',
    relatedCodes: [],
  },
  {
    code: 'SP6-002',
    sectorCode: 'SP6',
    sourceText: 'Number of patents owned by youth and women.',
    sourcePage: 40,
    sourceRow: 2,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    ambiguityNote: null,
    relatedCodes: [],
  },
  {
    code: 'SP6-003',
    sectorCode: 'SP6',
    sourceText: 'Number of tech start-ups owned by youth and women.',
    sourcePage: 40,
    sourceRow: 3,
    unit: 'Count',
    unitProvenance: 'INFERRED_FROM_WORDING',
    dataType: 'INTEGER',
    dataTypeProvenance: 'INFERRED_FROM_WORDING',
    calculationMethod: 'ABSOLUTE_COUNT',
    calculationProvenance: 'INFERRED_FROM_WORDING',
    direction: 'HIGHER_IS_BETTER',
    directionProvenance: 'INFERRED_FROM_WORDING',
    unitOfAnalysis: 'COUNTRY',
    flags: ['OVERLAPS_ANOTHER_ROW'],
    ambiguityNote:
      'Overlaps O4-001, which measures the same population as a percentage change.',
    relatedCodes: ['O4-001'],
  },
];

export const INDICATORS: IndicatorSeed[] = raw.map((r) => ({
  ...r,
  officialName: trimTrailing(r.sourceText),
  definition: null, // the MEAL Plan supplies no indicator definitions
  flags: Array.from(new Set([...UNIVERSAL_FLAGS, ...(r.flags ?? [])])),
}));

// ---------------------------------------------------------------------------
// Extraction reconciliation
// ---------------------------------------------------------------------------

/**
 * The MEAL Plan table contains exactly 80 indicator rows as printed, of which
 * this platform transcribes 75. The five Impact-level rows are excluded by
 * decision of the programme, not by an extraction failure — the distinction
 * matters, because the transcription is otherwise complete and verbatim.
 *
 * Separately, the project brief refers to "81 indicators". The most likely
 * explanation is that one of the three COMPOUND_STATEMENT cells below is
 * officially counted as two. This platform does NOT guess which one; it
 * surfaces the discrepancy for AU confirmation.
 */
export const EXTRACTION_RECONCILIATION = {
  /** Rows printed in the MEAL Plan table, Impact level included. */
  rowsPrintedInSource: 80,
  /** Impact-level rows excluded from collection: LS-001/002, EDC-001/002/003. */
  rowsExcludedImpactLevel: 5,
  /** Rows this platform stores and collects against. */
  rowsInScope: 75,
  countStatedInProjectBrief: 81,
  discrepancy: 1,
  compoundRowsThatCouldResolveTheDiscrepancy: ['AGR-001', 'HLT-002', 'SP5-008'],
  note:
    'Splitting any one compound cell into its two constituent statements yields 81. ' +
    'The source document provides no numbering, so the split cannot be made without ' +
    'official guidance.',
  impactExclusionNote:
    'The five Impact-level rows (Improved Living Standards, Economic Development and ' +
    'Competitiveness) are outside the scope of this platform and are not collected from ' +
    'Member States.',
} as const;

export const SECTOR_BY_CODE = new Map(SECTORS.map((s) => [s.code, s]));
export const INDICATOR_BY_CODE = new Map(INDICATORS.map((i) => [i.code, i]));

export function indicatorsForSector(sectorCode: string): IndicatorSeed[] {
  return INDICATORS.filter((i) => i.sectorCode === sectorCode);
}
