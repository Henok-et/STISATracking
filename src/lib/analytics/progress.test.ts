import { describe, expect, it } from 'vitest';
import { calculateProgress, type ProgressInput } from './progress';

/**
 * The calculation engine, driven from a table of cases.
 *
 * Two real bugs shipped from this file before it had tests:
 *
 *   1. PERCENTAGE_CHANGE negated its result for LOWER_IS_BETTER, turning a
 *      genuine 50% into -50%, which the floor then reported as 0%. Every
 *      lower-is-better change indicator silently scored zero.
 *   2. Aggregation spanning two reporting cycles produced completeness above
 *      100% (covered in the query tests, not here).
 *
 * Both would have been caught by a single row in a table. That is the whole
 * argument for this file.
 */

const base: ProgressInput = {
  calculationMethod: 'ABSOLUTE_COUNT',
  direction: 'HIGHER_IS_BETTER',
  dataType: 'INTEGER',
  baseline: null,
  target: null,
  actual: null,
};

const input = (patch: Partial<ProgressInput>): ProgressInput => ({ ...base, ...patch });

describe('level indicators (count, value, share, index)', () => {
  it.each([
    ['halfway between baseline and target', 100, 200, 150, 50],
    ['at the baseline', 100, 200, 100, 0],
    ['at the target', 100, 200, 200, 100],
    ['a quarter of the way', 100, 200, 125, 25],
  ])('%s scores %d%%', (_label, baseline, target, actual, expected) => {
    const r = calculateProgress(input({ baseline, target, actual }));
    expect(r.scored).toBe(true);
    expect(r.percent).toBe(expected);
  });

  it('floors regression at 0 rather than reporting a negative', () => {
    const r = calculateProgress(input({ baseline: 100, target: 200, actual: 80 }));
    expect(r.percent).toBe(0);
  });

  it('does NOT cap over-achievement at 100', () => {
    // Deliberate: exceeding a target is a real result and must stay visible.
    const r = calculateProgress(input({ baseline: 100, target: 200, actual: 250 }));
    expect(r.percent).toBe(150);
  });

  it('measures against the target alone when no baseline was recorded', () => {
    const r = calculateProgress(input({ baseline: null, target: 200, actual: 50 }));
    expect(r.scored).toBe(true);
    expect(r.percent).toBe(25);
    expect(r.explanation).toMatch(/no baseline/i);
  });

  it('refuses to score when baseline equals target', () => {
    const r = calculateProgress(input({ baseline: 100, target: 100, actual: 100 }));
    expect(r.scored).toBe(false);
    expect(r.reason).toBe('DEGENERATE_RANGE');
  });
});

describe('lower-is-better level indicators', () => {
  it.each([
    ['halfway down to target', 100, 50, 75, 50],
    ['target reached', 100, 50, 50, 100],
    ['no movement', 100, 50, 100, 0],
    ['moved the wrong way', 100, 50, 120, 0],
  ])('%s scores %d%%', (_label, baseline, target, actual, expected) => {
    const r = calculateProgress(
      input({ direction: 'LOWER_IS_BETTER', baseline, target, actual }),
    );
    expect(r.percent).toBe(expected);
  });
});

describe('change measures (the value IS already a change)', () => {
  it('compares the reported change against the target change', () => {
    const r = calculateProgress(
      input({
        calculationMethod: 'PERCENTAGE_CHANGE',
        dataType: 'PERCENTAGE',
        target: 8,
        actual: 4,
      }),
    );
    expect(r.percent).toBe(50);
  });

  // REGRESSION: this scored 0% before the negation was removed.
  it('scores a lower-is-better reduction correctly, not as zero', () => {
    const r = calculateProgress(
      input({
        calculationMethod: 'PERCENTAGE_CHANGE',
        direction: 'LOWER_IS_BETTER',
        dataType: 'PERCENTAGE',
        target: -20,
        actual: -10,
      }),
    );
    expect(r.scored).toBe(true);
    expect(r.percent).toBe(50);
  });

  it('treats movement away from a reduction target as no progress', () => {
    const r = calculateProgress(
      input({
        calculationMethod: 'PERCENTAGE_CHANGE',
        direction: 'LOWER_IS_BETTER',
        dataType: 'PERCENTAGE',
        target: -20,
        actual: 5,
      }),
    );
    expect(r.percent).toBe(0);
  });

  it('refuses to score against a target change of zero', () => {
    const r = calculateProgress(
      input({ calculationMethod: 'PERCENTAGE_CHANGE', dataType: 'PERCENTAGE', target: 0, actual: 3 }),
    );
    expect(r.scored).toBe(false);
    expect(r.reason).toBe('DEGENERATE_RANGE');
  });

  it('ignores any baseline, which would double-count the change', () => {
    const withBaseline = calculateProgress(
      input({
        calculationMethod: 'PERCENTAGE_CHANGE',
        dataType: 'PERCENTAGE',
        baseline: 40,
        target: 8,
        actual: 4,
      }),
    );
    expect(withBaseline.percent).toBe(50);
  });
});

describe('indicators the source document never defined', () => {
  it.each(['UNDEFINED', 'CUSTOM'] as const)(
    '%s is never scored, however complete the data',
    (method) => {
      const r = calculateProgress(
        input({ calculationMethod: method, baseline: 10, target: 50, actual: 50 }),
      );
      expect(r.scored).toBe(false);
      expect(r.percent).toBeNull();
      expect(r.reason).toBe('NO_METHODOLOGY');
      expect(r.explanation).toMatch(/no calculation methodology/i);
    },
  );

  it('never silently substitutes a default formula', () => {
    const r = calculateProgress(
      input({ calculationMethod: 'UNDEFINED', baseline: 0, target: 100, actual: 100 }),
    );
    // A default formula would have produced 100 here.
    expect(r.percent).toBeNull();
  });
});

describe('missing inputs are unscored, never zero', () => {
  it('missing actual', () => {
    const r = calculateProgress(input({ baseline: 100, target: 200, actual: null }));
    expect(r.scored).toBe(false);
    expect(r.reason).toBe('NO_ACTUAL');
    expect(r.percent).toBeNull();
  });

  it('missing target', () => {
    const r = calculateProgress(input({ baseline: 100, target: null, actual: 150 }));
    expect(r.scored).toBe(false);
    expect(r.reason).toBe('NO_TARGET');
    expect(r.percent).toBeNull();
  });
});

describe('binary milestones', () => {
  it('achieved is 100', () => {
    const r = calculateProgress(
      input({ calculationMethod: 'BINARY_ACHIEVEMENT', dataType: 'BOOLEAN', booleanValue: true }),
    );
    expect(r.percent).toBe(100);
  });

  it('not achieved is 0 — a real result, not missing data', () => {
    const r = calculateProgress(
      input({ calculationMethod: 'BINARY_ACHIEVEMENT', dataType: 'BOOLEAN', booleanValue: false }),
    );
    expect(r.scored).toBe(true);
    expect(r.percent).toBe(0);
  });

  it('unanswered is unscored, and distinct from "not achieved"', () => {
    const r = calculateProgress(
      input({ calculationMethod: 'BINARY_ACHIEVEMENT', dataType: 'BOOLEAN', booleanValue: null }),
    );
    expect(r.scored).toBe(false);
    expect(r.reason).toBe('NO_ACTUAL');
  });
});

describe('non-numeric indicators', () => {
  it.each(['TEXT', 'URL', 'CATEGORICAL'] as const)('%s has no percentage progress', (dataType) => {
    const r = calculateProgress(input({ dataType, target: 10, actual: 5 }));
    expect(r.scored).toBe(false);
    expect(r.reason).toBe('NON_NUMERIC');
  });
});

describe('closeness-to-target indicators', () => {
  it('scores 100 when exactly on target', () => {
    const r = calculateProgress(
      input({ direction: 'TARGET_IS_BETTER', calculationMethod: 'RATIO', dataType: 'DECIMAL', target: 50, actual: 50 }),
    );
    expect(r.percent).toBe(100);
  });

  it('penalises deviation in either direction equally', () => {
    const over = calculateProgress(
      input({ direction: 'TARGET_IS_BETTER', calculationMethod: 'RATIO', dataType: 'DECIMAL', target: 50, actual: 60 }),
    );
    const under = calculateProgress(
      input({ direction: 'TARGET_IS_BETTER', calculationMethod: 'RATIO', dataType: 'DECIMAL', target: 50, actual: 40 }),
    );
    expect(over.percent).toBe(under.percent);
    expect(over.percent).toBe(80);
  });
});

describe('every scored result explains itself', () => {
  it('carries a formula and an explanation a reader can check', () => {
    const r = calculateProgress(input({ baseline: 100, target: 200, actual: 150 }));
    expect(r.formula).toBeTruthy();
    expect(r.explanation).toBeTruthy();
  });

  it('every unscored result states a reason', () => {
    const r = calculateProgress(input({ calculationMethod: 'UNDEFINED' }));
    expect(r.reason).toBeTruthy();
    expect(r.explanation.length).toBeGreaterThan(20);
  });
});
