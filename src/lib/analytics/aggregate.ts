/**
 * Aggregation primitives.
 *
 * The governing rule: missing data is NEVER treated as zero. Every aggregate
 * carries the denominator it was computed over, so the UI can always say
 * "68% — based on 8 of 10 countries reporting" instead of implying a complete
 * dataset.
 */

export interface Aggregate {
  /** Mean of the valid values, or null when nothing valid was available. */
  value: number | null;
  /** Number of valid observations that fed the mean. */
  n: number;
  /** Number of observations that were expected. */
  expected: number;
  /** Share of expected observations that were valid, 0-100. */
  coveragePct: number;
  /** Full sentence: what was averaged, what was left out, and why. */
  basis: string;
  /** Same fact in a few words, e.g. "12 of 16 reported indicators scored", for dense rows. */
  basisShort: string;
}

export interface AggregateOptions {
  /** Noun for the denominator sentence, e.g. "countries" or "reported values". */
  unit?: string;
  /** Total expected observations. Defaults to the number of inputs supplied. */
  expected?: number;
  /**
   * `progress` means the numbers are already target-progress percentages.
   * The basis sentence then says so, including what 100% means and that
   * unscored inputs were left out rather than entered as zero.
   */
  kind?: 'values' | 'progress';
}

function meanBasisShort(
  n: number,
  expected: number,
  unit: string,
  kind: 'values' | 'progress',
): string {
  if (n === 0) return kind === 'progress' ? `No ${unit} could be scored` : `No usable ${unit}`;
  return kind === 'progress' ? `${n} of ${expected} ${unit} scored` : `${n} of ${expected} ${unit}`;
}

function meanBasis(n: number, expected: number, unit: string, kind: 'values' | 'progress'): string {
  if (kind === 'progress') {
    if (expected === 0) {
      return 'No target-progress average, because there were no reported values to score. A missing value is not entered as zero.';
    }
    if (n === 0) {
      return `No target-progress average. None of the ${expected} ${unit} produced a score. Values that cannot be scored are left out of the average and are not entered as zero.`;
    }
    if (n === expected) {
      return `Unweighted average of target-progress scores from all ${n} ${unit}. Each one counts equally. On each score, 100% means that indicator's target was met, and a figure above 100% means the target was exceeded. Movement away from the target is shown as 0%, not as a negative percentage.`;
    }
    const omitted = expected - n;
    return `Unweighted average of target-progress scores from ${n} of ${expected} ${unit}. The other ${omitted} were reported but could not be scored, so they are left out of this average and are not counted as zero. On each score, 100% means that indicator's target was met.`;
  }

  if (expected === 0) {
    return `No average, because no ${unit} were supplied.`;
  }
  if (n === 0) {
    return `No average. None of the ${expected} ${unit} had a usable number. Blank values are left out and are not entered as zero.`;
  }
  if (n === expected) {
    return `Average of all ${n} ${unit}. Every supplied number was usable.`;
  }
  const omitted = expected - n;
  return `Average of ${n} usable ${unit}, out of ${expected} expected. The other ${omitted} had no usable number and are left out of both the total and the count, not entered as zero.`;
}

/**
 * Mean over defined values only.
 *
 * `values` may contain nulls — they are excluded from both numerator and
 * denominator, never coerced to 0.
 */
export function meanOfValid(
  values: (number | null | undefined)[],
  options: AggregateOptions = {},
): Aggregate {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const expected = options.expected ?? values.length;
  const unit = options.unit ?? 'observations';
  const kind = options.kind ?? 'values';

  if (valid.length === 0) {
    return {
      value: null,
      n: 0,
      expected,
      coveragePct: 0,
      basis: meanBasis(0, expected, unit, kind),
      basisShort: meanBasisShort(0, expected, unit, kind),
    };
  }

  const sum = valid.reduce((a, b) => a + b, 0);
  return {
    value: round2(sum / valid.length),
    n: valid.length,
    expected,
    coveragePct: expected === 0 ? 0 : round2((valid.length / expected) * 100),
    basis: meanBasis(valid.length, expected, unit, kind),
    basisShort: meanBasisShort(valid.length, expected, unit, kind),
  };
}

/**
 * Weighted mean — required where a simple average would misrepresent the
 * continent, e.g. share-of-population indicators, which must be weighted by
 * population rather than treating Seychelles and Nigeria as equal.
 */
export function weightedMeanOfValid(
  pairs: { value: number | null | undefined; weight: number | null | undefined }[],
  options: AggregateOptions = {},
): Aggregate {
  const valid = pairs.filter(
    (p): p is { value: number; weight: number } =>
      typeof p.value === 'number' &&
      Number.isFinite(p.value) &&
      typeof p.weight === 'number' &&
      Number.isFinite(p.weight) &&
      p.weight > 0,
  );
  const expected = options.expected ?? pairs.length;
  const unit = options.unit ?? 'observations';

  if (valid.length === 0) {
    return {
      value: null,
      n: 0,
      expected,
      coveragePct: 0,
      basis: `No weighted average. None of the ${expected} ${unit} had both a usable number and a positive weight. Rows missing either are left out, not treated as zero.`,
      basisShort: `No weightable ${unit}`,
    };
  }

  const totalWeight = valid.reduce((a, p) => a + p.weight, 0);
  const sum = valid.reduce((a, p) => a + p.value * p.weight, 0);

  return {
    value: round2(sum / totalWeight),
    n: valid.length,
    expected,
    coveragePct: expected === 0 ? 0 : round2((valid.length / expected) * 100),
    basis: `Weighted average of ${valid.length} of ${expected} ${unit} that had both a usable number and a positive weight. Rows missing either are left out of the total and the weight, not treated as zero. Each observation is weighted, so a larger weight pulls the average more than a smaller one.`,
    basisShort: `Weighted, ${valid.length} of ${expected} ${unit}`,
  };
}

/** Completeness: valid reported indicators ÷ expected indicators × 100. */
export function completeness(reported: number, expected: number): Aggregate {
  if (expected === 0) {
    return {
      value: null,
      n: 0,
      expected: 0,
      coveragePct: 0,
      basis:
        'No completeness figure, because no indicator values were required. Nothing is filled in as zero.',
      basisShort: 'No values required',
    };
  }
  const pct = round2((reported / expected) * 100);
  const basis =
    reported === 0
      ? `0 of ${expected} required indicator values were reported. Blank answers and answers marked not applicable stay inside that ${expected}, so this measures a gap in coverage. It is not a performance score of zero.`
      : `${reported} of ${expected} required indicator values were reported. Blank answers and answers marked not applicable stay inside the ${expected} and lower this percentage. They are never filled in as zero, and they are not part of the target-progress average.`;
  return {
    value: pct,
    n: reported,
    expected,
    coveragePct: pct,
    basis,
    basisShort: `${reported} of ${expected} required values`,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
