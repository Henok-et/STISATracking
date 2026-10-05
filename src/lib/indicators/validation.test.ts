import { describe, expect, it } from 'vitest';
import { validateIndicatorValue, type IndicatorRule, type RawValueInput } from './validation';

/**
 * Per-indicator validation. The framework is not uniformly numeric, and the
 * legal range of a percentage depends on what the percentage means.
 */

const rule = (patch: Partial<IndicatorRule> = {}): IndicatorRule => ({
  code: 'TEST-001',
  dataType: 'PERCENTAGE',
  calculationMethod: 'SHARE_OF_TOTAL',
  unit: 'Percent (%)',
  required: true,
  sourceRequired: true,
  ...patch,
});

const input = (patch: Partial<RawValueInput> = {}): RawValueInput => ({
  indicatorId: 'x',
  dataAvailable: true,
  notApplicable: false,
  actualValue: '50',
  ...patch,
});

describe('share-of-total percentages are bounded', () => {
  it.each(['101', '190', '1000'])('rejects %s%% as a share of a total', (v) => {
    const { issues } = validateIndicatorValue(rule(), input({ actualValue: v }));
    expect(issues.some((i) => i.message.includes('between 0 and 100'))).toBe(true);
  });

  it('rejects a negative share', () => {
    const { issues } = validateIndicatorValue(rule(), input({ actualValue: '-5' }));
    expect(issues.some((i) => i.message.includes('between 0 and 100'))).toBe(true);
  });

  it.each(['0', '50', '100'])('accepts %s%%', (v) => {
    const { issues, parsed } = validateIndicatorValue(rule(), input({ actualValue: v }));
    expect(issues).toHaveLength(0);
    expect(parsed.actualValue).toBe(Number(v));
  });

  it('applies the bound to baseline and target too', () => {
    const { issues } = validateIndicatorValue(
      rule(),
      input({ baselineValue: '150', targetValue: '200', actualValue: '50' }),
    );
    expect(issues.filter((i) => i.message.includes('between 0 and 100'))).toHaveLength(2);
  });
});

describe('percentage CHANGE is deliberately unbounded', () => {
  const changeRule = rule({ calculationMethod: 'PERCENTAGE_CHANGE' });

  it.each(['-40', '0', '250'])('accepts %s%% as a change', (v) => {
    const { issues } = validateIndicatorValue(changeRule, input({ actualValue: v }));
    expect(issues).toHaveLength(0);
  });

  it('accepts a reduction expressed as a negative number', () => {
    const { parsed } = validateIndicatorValue(
      changeRule,
      input({ targetValue: '-20', actualValue: '-10' }),
    );
    expect(parsed.actualValue).toBe(-10);
    expect(parsed.targetValue).toBe(-20);
  });
});

describe('counts', () => {
  const countRule = rule({ dataType: 'INTEGER', calculationMethod: 'ABSOLUTE_COUNT' });

  it('rejects a fractional count', () => {
    const { issues } = validateIndicatorValue(countRule, input({ actualValue: '12.5' }));
    expect(issues.some((i) => i.message.includes('whole number'))).toBe(true);
  });

  it('rejects a negative count', () => {
    const { issues } = validateIndicatorValue(countRule, input({ actualValue: '-3' }));
    expect(issues.some((i) => i.message.includes('negative'))).toBe(true);
  });

  it('accepts a count above 100, which is not a percentage', () => {
    const { issues } = validateIndicatorValue(countRule, input({ actualValue: '4200' }));
    expect(issues).toHaveLength(0);
  });

  it('tolerates thousands separators pasted from a spreadsheet', () => {
    const { parsed } = validateIndicatorValue(countRule, input({ actualValue: '4,200' }));
    expect(parsed.actualValue).toBe(4200);
  });
});

describe('missing and not-applicable are distinct answers', () => {
  it('records unavailable data without demanding a value', () => {
    const { issues, parsed } = validateIndicatorValue(
      rule(),
      input({ dataAvailable: false, actualValue: null }),
    );
    expect(issues).toHaveLength(0);
    expect(parsed.dataAvailable).toBe(false);
    expect(parsed.actualValue).toBeNull();
  });

  it('requires a reason when an indicator is marked not applicable', () => {
    const { issues } = validateIndicatorValue(
      rule(),
      input({ notApplicable: true, dataAvailable: false, notes: null }),
    );
    expect(issues.some((i) => i.field === 'notes')).toBe(true);
  });

  it('accepts not applicable when a reason is given', () => {
    const { issues } = validateIndicatorValue(
      rule(),
      input({ notApplicable: true, dataAvailable: false, notes: 'Landlocked.' }),
    );
    expect(issues).toHaveLength(0);
  });

  it('demands a value when data is declared available', () => {
    const { issues } = validateIndicatorValue(rule(), input({ actualValue: null }));
    expect(issues.some((i) => i.field === 'actualValue')).toBe(true);
  });
});

describe('other types', () => {
  it('requires a currency for monetary indicators', () => {
    const { issues } = validateIndicatorValue(
      rule({ dataType: 'CURRENCY', calculationMethod: 'ABSOLUTE_VALUE' }),
      input({ actualValue: '5000000', currencyCode: null }),
    );
    expect(issues.some((i) => i.field === 'currencyCode')).toBe(true);
  });

  it('rejects a non-http URL', () => {
    const { issues } = validateIndicatorValue(
      rule({ dataType: 'URL', calculationMethod: 'CUSTOM' }),
      input({ actualValue: null, textValue: 'javascript:alert(1)' }),
    );
    expect(issues.some((i) => i.field === 'textValue')).toBe(true);
  });

  it('rejects a malformed source link', () => {
    const { issues } = validateIndicatorValue(
      rule(),
      input({ actualValue: '10', sourceUrl: 'not a url' }),
    );
    expect(issues.some((i) => i.field === 'sourceUrl')).toBe(true);
  });

  it('requires a source only at final submission', () => {
    const draft = validateIndicatorValue(rule(), input({ sourceName: null }), {
      forSubmission: false,
    });
    const final = validateIndicatorValue(rule(), input({ sourceName: null }), {
      forSubmission: true,
    });
    expect(draft.issues).toHaveLength(0);
    expect(final.issues.some((i) => i.field === 'sourceName')).toBe(true);
  });
});
