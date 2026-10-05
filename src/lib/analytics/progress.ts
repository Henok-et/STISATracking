import type { CalculationMethod, Direction, IndicatorDataType } from '@/generated/prisma/enums';

/**
 * Target-progress calculation.
 *
 * There is deliberately no single formula. The MEAL Plan mixes counts, index
 * scores, shares, percentage changes and binary milestones, and applying
 * `(actual - baseline) / (target - baseline) x 100` to all of them would
 * manufacture nonsense. Each indicator's own `calculationMethod` and
 * `direction` select the formula; where the source document defines no
 * methodology the engine returns `scored: false` and says why, instead of
 * guessing.
 *
 * Nothing in this module reads from the database or renders anything — it is
 * pure arithmetic so it can be unit-tested and reused by exports and APIs.
 */

export interface ProgressInput {
  calculationMethod: CalculationMethod;
  direction: Direction;
  dataType: IndicatorDataType;
  baseline: number | null;
  target: number | null;
  actual: number | null;
  booleanValue?: boolean | null;
}

export type UnscoredReason =
  | 'NO_METHODOLOGY'
  | 'NO_ACTUAL'
  | 'NO_TARGET'
  | 'NO_BASELINE'
  | 'DEGENERATE_RANGE'
  | 'NON_NUMERIC';

/**
 * Stable key for the sentence shown next to a score. The English text lives
 * here so exports and the API stay readable without a locale; the same key
 * is translated in `messages/*.json` under `progressNote`.
 */
export type ProgressNarrative =
  | 'NO_METHODOLOGY'
  | 'NO_ACTUAL'
  | 'NO_TARGET'
  | 'NON_NUMERIC'
  | 'DEGENERATE_TARGET_ZERO'
  | 'DEGENERATE_EQUAL_ENDS'
  | 'DEGENERATE_ACTUAL_ZERO'
  | 'DEGENERATE_NON_FINITE'
  | 'BINARY_YES'
  | 'BINARY_NO'
  | 'CHANGE'
  | 'CLOSENESS'
  | 'LEVEL_NO_BASELINE_HIGHER'
  | 'LEVEL_NO_BASELINE_LOWER'
  | 'LEVEL_GAP_HIGHER'
  | 'LEVEL_GAP_LOWER'
  | 'LEVEL_NO_BASELINE_ASSUMED'
  | 'LEVEL_GAP_ASSUMED';

export interface ProgressResult {
  /** True only when a defensible progress percentage could be produced. */
  scored: boolean;
  /** 0-100+, where 100 means the target has been met. Null when unscored. */
  percent: number | null;
  reason: UnscoredReason | null;
  /** Which sentence to show. Always set, including when the value is unscored. */
  narrative: ProgressNarrative;
  /** Plain-language explanation shown next to the figure in the UI. */
  explanation: string;
  /** The formula applied, for methodological transparency. */
  formula: string | null;
}

const NARRATIVE_TEXT: Record<ProgressNarrative, string> = {
  NO_METHODOLOGY:
    'The STISA 2034 MEAL Plan defines no calculation methodology for this indicator, so the reported number is published and left unscored. It is left out of every target-progress average rather than given a guessed percentage.',
  NO_ACTUAL:
    'No current value was reported for this indicator, so there is nothing to compare with the target. The gap is left blank. It is not treated as zero progress.',
  NO_TARGET:
    'A current value was reported, but no target was set, so there is no endpoint to measure against. The value is published and left out of the target-progress average.',
  NON_NUMERIC:
    'This indicator is text, a web address, or a category. It has no numeric distance to a target, so it is published as reported and left out of target-progress averages.',
  DEGENERATE_TARGET_ZERO:
    'The target is zero, so progress cannot be expressed as a percentage of that target. The reported value is kept and the indicator is left unscored.',
  DEGENERATE_EQUAL_ENDS:
    'The baseline and the target are the same number, so there is no gap to close and progress cannot be expressed as a percentage of that gap. The reported value is kept and the indicator is left unscored.',
  DEGENERATE_ACTUAL_ZERO:
    'A lower result is better and the reported value is zero. Dividing the target by zero is undefined, so the indicator is left unscored instead of being shown as infinite progress.',
  DEGENERATE_NON_FINITE:
    'The baseline, target, and reported value do not produce a finite percentage. The reported value is kept and the indicator is left unscored.',
  BINARY_YES:
    'This is a yes-or-no milestone. It was reported as achieved, which scores 100%. An unanswered milestone is left blank; a reported “no” scores 0% because that is a real answer, not missing data.',
  BINARY_NO:
    'This is a yes-or-no milestone. It was reported as not yet achieved, which scores 0%. That zero is a real result. An unanswered milestone is left blank instead of being scored.',
  CHANGE:
    'The reported number is already a change, and the target is the change the Member State aimed for. Progress is the reported change divided by the target change. Record a reduction as a negative number. A baseline is not applied again, because that would count the change twice. 100% means the targeted change was reached. Above 100% means it was exceeded. Movement in the opposite direction scores 0%.',
  CLOSENESS:
    'Progress measures closeness to the target from either side. Exactly on target is 100%. A result 20% of the target away, whether above or below, scores 80%. The baseline is not used. Once the distance reaches the size of the target, the score is shown as 0%.',
  LEVEL_NO_BASELINE_HIGHER:
    'No baseline was recorded, so this is the reported value as a share of the target, not the share of a baseline-to-target gap that has been closed. 100% means the target level was reached. Above 100% means it was exceeded.',
  LEVEL_NO_BASELINE_LOWER:
    'No baseline was recorded, and a lower number is an improvement. The score is the target divided by the reported value. Reaching the target is 100%. A value below the target scores above 100%.',
  LEVEL_GAP_HIGHER:
    'A higher number is an improvement. Progress is the share of the gap from the baseline to the target that has been closed: (reported value − baseline) ÷ (target − baseline). 100% means the target was reached. Above 100% means it was passed. A value at or below the baseline scores 0%, so a worsening is not shown as a negative percentage.',
  LEVEL_GAP_LOWER:
    'A lower number is an improvement. Progress is the share of the intended reduction that has been achieved: (baseline − reported value) ÷ (baseline − target). 100% means the target was reached. A value that moved upward instead scores 0%.',
  LEVEL_NO_BASELINE_ASSUMED:
    'No baseline was recorded, and the source does not say whether a higher or lower result is better. The score therefore treats a higher result as better and is the reported value as a share of the target. 100% means the target level was reached.',
  LEVEL_GAP_ASSUMED:
    'The source does not say whether a higher or lower result is better, so the score assumes a higher result is an improvement. It is the share of the gap from the baseline to the target that has been closed. 100% means the target was reached. A value at or below the baseline scores 0%.',
};

function unscored(reason: UnscoredReason, narrative: ProgressNarrative): ProgressResult {
  return {
    scored: false,
    percent: null,
    reason,
    narrative,
    explanation: NARRATIVE_TEXT[narrative],
    formula: null,
  };
}

function scored(percent: number, formula: string, narrative: ProgressNarrative): ProgressResult {
  return {
    scored: true,
    // Progress is floored at 0 (regression reads as "no progress toward target")
    // but NOT capped at 100 — over-achievement is real and should be visible.
    percent: round2(Math.max(0, percent)),
    reason: null,
    narrative,
    explanation: NARRATIVE_TEXT[narrative],
    formula,
  };
}

export function calculateProgress(input: ProgressInput): ProgressResult {
  const { calculationMethod, direction, baseline, target, actual } = input;

  // 1. Methodologies the source never defined are never scored.
  if (calculationMethod === 'UNDEFINED' || calculationMethod === 'CUSTOM') {
    return unscored('NO_METHODOLOGY', 'NO_METHODOLOGY');
  }

  // 2. Binary milestones: achieved or not.
  if (calculationMethod === 'BINARY_ACHIEVEMENT') {
    if (input.booleanValue === null || input.booleanValue === undefined) {
      return unscored('NO_ACTUAL', 'NO_ACTUAL');
    }
    return scored(
      input.booleanValue ? 100 : 0,
      'achieved ? 100% : 0%',
      input.booleanValue ? 'BINARY_YES' : 'BINARY_NO',
    );
  }

  if (input.dataType === 'TEXT' || input.dataType === 'URL' || input.dataType === 'CATEGORICAL') {
    return unscored('NON_NUMERIC', 'NON_NUMERIC');
  }

  if (actual === null) return unscored('NO_ACTUAL', 'NO_ACTUAL');
  if (target === null) return unscored('NO_TARGET', 'NO_TARGET');

  // 3. Indicators whose reported value IS already a change measure. The target
  //    is a target change, so progress compares the two directly; a baseline
  //    would double-count the change.
  if (
    calculationMethod === 'PERCENTAGE_CHANGE' ||
    calculationMethod === 'PERCENTAGE_POINT_CHANGE'
  ) {
    if (target === 0) return unscored('DEGENERATE_RANGE', 'DEGENERATE_TARGET_ZERO');

    // Direction needs no special case here, and applying one is actively wrong.
    // Both the target change and the reported change use the same sign
    // convention, so the ratio already carries the direction:
    //
    //   higher-is-better  target +8,  actual +4  ->  +50%
    //   lower-is-better   target -20, actual -10 ->  +50%   (both negative)
    //   moving the wrong way, target -20, actual +5 -> -25%, floored to 0
    //
    // Negating for LOWER_IS_BETTER turned a genuine 50% into -50%, which the
    // floor then reported as no progress at all.
    const pct = (actual / target) * 100;
    return scored(pct, 'actual change ÷ target change × 100', 'CHANGE');
  }

  // 4. Level indicators (counts, values, shares, index scores, ratios).
  //    Where a baseline exists, progress is measured across the baseline-to-target
  //    gap. Where it does not, it falls back to actual-against-target and says so.
  const hasBaseline = baseline !== null;

  if (direction === 'TARGET_IS_BETTER') {
    // Closeness to target in either direction.
    if (target === 0) return unscored('DEGENERATE_RANGE', 'DEGENERATE_TARGET_ZERO');
    const deviation = Math.abs(actual - target) / Math.abs(target);
    return scored((1 - deviation) * 100, '(1 − |actual − target| ÷ |target|) × 100', 'CLOSENESS');
  }

  if (!hasBaseline) {
    if (target === 0) return unscored('DEGENERATE_RANGE', 'DEGENERATE_TARGET_ZERO');
    if (direction === 'LOWER_IS_BETTER' && actual === 0) {
      return unscored('DEGENERATE_RANGE', 'DEGENERATE_ACTUAL_ZERO');
    }
    const lower = direction === 'LOWER_IS_BETTER';
    const pct = lower ? (target / actual) * 100 : (actual / target) * 100;
    if (!Number.isFinite(pct)) return unscored('DEGENERATE_RANGE', 'DEGENERATE_NON_FINITE');
    const narrative =
      direction === 'NOT_APPLICABLE'
        ? 'LEVEL_NO_BASELINE_ASSUMED'
        : lower
          ? 'LEVEL_NO_BASELINE_LOWER'
          : 'LEVEL_NO_BASELINE_HIGHER';
    return scored(pct, lower ? 'target ÷ actual × 100' : 'actual ÷ target × 100', narrative);
  }

  const gap = target - baseline;
  if (gap === 0) return unscored('DEGENERATE_RANGE', 'DEGENERATE_EQUAL_ENDS');

  const lower = direction === 'LOWER_IS_BETTER';
  const pct = lower
    ? ((baseline - actual) / (baseline - target)) * 100
    : ((actual - baseline) / gap) * 100;

  if (!Number.isFinite(pct)) return unscored('DEGENERATE_RANGE', 'DEGENERATE_NON_FINITE');

  const narrative =
    direction === 'NOT_APPLICABLE' ? 'LEVEL_GAP_ASSUMED' : lower ? 'LEVEL_GAP_LOWER' : 'LEVEL_GAP_HIGHER';
  return scored(
    pct,
    lower
      ? '(baseline − actual) ÷ (baseline − target) × 100'
      : '(actual − baseline) ÷ (target − baseline) × 100',
    narrative,
  );
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Human label for a calculation method, used in methodology notes. */
export const METHOD_LABELS: Record<CalculationMethod, string> = {
  PERCENTAGE_CHANGE: 'Percentage change',
  PERCENTAGE_POINT_CHANGE: 'Percentage-point change',
  ABSOLUTE_COUNT: 'Absolute count',
  ABSOLUTE_VALUE: 'Absolute value',
  SHARE_OF_TOTAL: 'Share of a total',
  INDEX_SCORE: 'Composite index score',
  RATIO: 'Ratio',
  BINARY_ACHIEVEMENT: 'Binary achievement',
  CUSTOM: 'Custom formula (not yet defined)',
  UNDEFINED: 'Not defined in the source document',
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  HIGHER_IS_BETTER: 'Higher is better',
  LOWER_IS_BETTER: 'Lower is better',
  TARGET_IS_BETTER: 'Closer to target is better',
  NOT_APPLICABLE: 'Not applicable',
};
