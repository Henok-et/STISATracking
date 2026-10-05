import { describe, expect, it } from 'vitest';
import { meanOfValid, weightedMeanOfValid, completeness } from './aggregate';

/**
 * The missing-data rule, which is the platform's single most important
 * guarantee: a value that was not reported must never behave like a zero, in
 * either the numerator or the denominator.
 */

describe('meanOfValid', () => {
  it('excludes nulls from the mean rather than treating them as zero', () => {
    const r = meanOfValid([80, null, 40], { unit: 'countries', expected: 3 });
    // Zeroing the null would give 40. Averaging over 3 would give 40.
    expect(r.value).toBe(60);
    expect(r.n).toBe(2);
  });

  it('excludes undefined and non-finite values too', () => {
    const r = meanOfValid([10, undefined, Number.NaN, Number.POSITIVE_INFINITY, 30]);
    expect(r.value).toBe(20);
    expect(r.n).toBe(2);
  });

  it('returns null, not 0, when nothing valid was reported', () => {
    const r = meanOfValid([null, null, undefined], { unit: 'countries', expected: 3 });
    expect(r.value).toBeNull();
    expect(r.n).toBe(0);
    expect(r.basis).toBe(
      'No average. None of the 3 countries had a usable number. Blank values are left out and are not entered as zero.',
    );
  });

  it('keeps a genuine zero, which is a reported value not a missing one', () => {
    const r = meanOfValid([0, 0, 30]);
    expect(r.value).toBe(10);
    expect(r.n).toBe(3);
  });

  it('states the denominator it used', () => {
    const r = meanOfValid([1, 2, null, null], { unit: 'countries', expected: 10 });
    expect(r.basis).toBe(
      'Average of 2 usable countries, out of 10 expected. The other 8 had no usable number and are left out of both the total and the count, not entered as zero.',
    );
    expect(r.expected).toBe(10);
  });

  it('defaults the expected count to the number of inputs supplied', () => {
    const r = meanOfValid([1, null, 3], { unit: 'values' });
    expect(r.expected).toBe(3);
    expect(r.n).toBe(2);
  });

  it('reports coverage as valid over expected', () => {
    const r = meanOfValid([1, 2, null, null], { expected: 4 });
    expect(r.coveragePct).toBe(50);
  });
});

describe('weightedMeanOfValid', () => {
  it('weights each observation, so large and small are not treated alike', () => {
    // A simple mean would be 50. Weighted by population it is not.
    const r = weightedMeanOfValid([
      { value: 20, weight: 200 },
      { value: 80, weight: 50 },
    ]);
    expect(r.value).toBe(32);
  });

  it('drops observations with a missing value', () => {
    const r = weightedMeanOfValid(
      [
        { value: 50, weight: 10 },
        { value: null, weight: 90 },
      ],
      { expected: 2 },
    );
    expect(r.value).toBe(50);
    expect(r.n).toBe(1);
  });

  it('drops observations with a missing or non-positive weight', () => {
    const r = weightedMeanOfValid([
      { value: 50, weight: 10 },
      { value: 100, weight: null },
      { value: 100, weight: 0 },
    ]);
    expect(r.value).toBe(50);
    expect(r.n).toBe(1);
  });

  it('returns null when nothing weightable remains', () => {
    const r = weightedMeanOfValid([{ value: null, weight: 5 }], { unit: 'countries' });
    expect(r.value).toBeNull();
  });
});

describe('completeness', () => {
  it('is reported over expected', () => {
    expect(completeness(3, 80).value).toBe(3.75);
    expect(completeness(67, 96).value).toBe(69.79);
  });

  it('is 100 when everything expected arrived', () => {
    expect(completeness(80, 80).value).toBe(100);
  });

  it('states both numbers so the figure can be checked', () => {
    expect(completeness(67, 96).basis).toBe(
      '67 of 96 required indicator values were reported. Blank answers and answers marked not applicable stay inside the 96 and lower this percentage. They are never filled in as zero, and they are not part of the target-progress average.',
    );
  });

  it('handles an expectation of zero without dividing by it', () => {
    const r = completeness(0, 0);
    expect(r.value).toBeNull();
    expect(r.basis).toBe(
      'No completeness figure, because no indicator values were required. Nothing is filled in as zero.',
    );
  });

  it('never silently exceeds 100 for a single frame', () => {
    // Guards the class of bug where facts from two reporting cycles were
    // counted against one cycle's denominator, producing 143%.
    const r = completeness(96, 96);
    expect(r.value).toBeLessThanOrEqual(100);
  });
});
