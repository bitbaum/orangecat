import { isAmountInRange } from '@/components/money/amount-draft';

// The one predicate every money action gates on: a button is never live while
// the amount field shows its red out-of-range line.
describe('isAmountInRange', () => {
  const min = 0.000001;
  const max = 1;
  it('accepts an amount inside the bounds, edges included', () => {
    expect(isAmountInRange(0.0002, min, max)).toBe(true);
    expect(isAmountInRange(min, min, max)).toBe(true);
    expect(isAmountInRange(max, min, max)).toBe(true);
  });
  it('rejects nothing, below the minimum and above the maximum', () => {
    expect(isAmountInRange(0, min, max)).toBe(false);
    expect(isAmountInRange(0.0000001, min, max)).toBe(false);
    expect(isAmountInRange(1.5, min, max)).toBe(false);
  });
  it('rejects a number that is not one', () => {
    expect(isAmountInRange(Number.NaN, min, max)).toBe(false);
    expect(isAmountInRange(Number.POSITIVE_INFINITY, min, max)).toBe(false);
  });
});
