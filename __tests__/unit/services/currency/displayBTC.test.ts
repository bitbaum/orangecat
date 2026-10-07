import { describe, expect, it } from 'vitest';
import { displayBTC } from '@/services/currency/formatting';

describe('displayBTC', () => {
  it('never prints scientific notation for small amounts', () => {
    // parseFloat((0.0000005).toFixed(8)) stringifies as "5e-7".
    expect(displayBTC(0.0000005)).toBe('0.0000005 BTC');
    expect(displayBTC(0.00000001)).toBe('0.00000001 BTC');
  });

  it('strips trailing zeros', () => {
    expect(displayBTC(0.005)).toBe('0.005 BTC');
    expect(displayBTC(1)).toBe('1 BTC');
    expect(displayBTC('0.00100000')).toBe('0.001 BTC');
  });

  it('treats empty and invalid as zero', () => {
    expect(displayBTC(null)).toBe('0 BTC');
    expect(displayBTC('abc')).toBe('0 BTC');
  });
});
