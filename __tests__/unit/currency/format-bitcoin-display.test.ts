/**
 * formatBitcoinDisplay stripped trailing zeros but not the dot before them, so
 * an empty balance on a profile project card read "0. BTC". The two other
 * BTC formatters in the same file already stripped both.
 */
import { describe, expect, it } from 'vitest';
import { formatBitcoinDisplay } from '@/services/currency/formatting';

describe('formatBitcoinDisplay', () => {
  it('renders an empty balance as "0 BTC", never "0. BTC"', () => {
    expect(formatBitcoinDisplay(0)).toBe('0 BTC');
  });

  it('keeps the significant digits of a small amount', () => {
    expect(formatBitcoinDisplay(0.0005)).toBe('0.0005 BTC');
    expect(formatBitcoinDisplay(0.00000001)).toBe('0.00000001 BTC');
  });

  it('leaves larger amounts at their fixed precision', () => {
    expect(formatBitcoinDisplay(0.5)).toBe('0.500000 BTC');
    expect(formatBitcoinDisplay(2)).toBe('2.0000 BTC');
  });

  it('never renders NaN', () => {
    expect(formatBitcoinDisplay(Number.NaN)).toBe('0 BTC');
  });
});
