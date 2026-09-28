import { TAX_TABLES, ZURICH_CITY_SINGLE_2025, taxTableFor } from '@/config/tax-estimates';
import { estimateIncomeTax, progressiveTax } from '@/domain/finances/tax';

/**
 * The tax figure is an estimate and says so; these pin the two things that
 * make an estimate honest — the arithmetic is progressive and monotonic, and
 * every table carries its year, its assumptions and its sources.
 */
describe('progressive tax', () => {
  const table = ZURICH_CITY_SINGLE_2025;

  it('is zero at and below the first threshold', () => {
    expect(progressiveTax(0, table.federal)).toBe(0);
    expect(progressiveTax(15_000, table.federal)).toBe(0);
    expect(progressiveTax(6_900, table.cantonalBasic)).toBe(0);
  });

  it('never falls as income rises', () => {
    let last = 0;
    for (let income = 0; income <= 500_000; income += 2_500) {
      const now = estimateIncomeTax(income, table).total;
      expect(now).toBeGreaterThanOrEqual(last);
      last = now;
    }
  });

  it('lands in the plausible band for a Zürich single earner on 100k', () => {
    const e = estimateIncomeTax(100_000, table);
    // Official calculators put the total in the low-to-mid teens of percent.
    expect(e.effectiveRate).toBeGreaterThan(0.1);
    expect(e.effectiveRate).toBeLessThan(0.2);
    expect(e.federal + e.cantonalAndCommunal).toBe(e.total);
  });
});

describe('tax tables', () => {
  it('each carries a year, assumptions and at least two sources', () => {
    for (const t of TAX_TABLES) {
      expect(t.year).toBeGreaterThanOrEqual(2025);
      expect(t.assumptions.length).toBeGreaterThan(2);
      expect(t.sources.length).toBeGreaterThanOrEqual(2);
      for (const s of t.sources) {
        expect(s.url.startsWith('https://')).toBe(true);
      }
      const froms = [...t.federal, ...t.cantonalBasic].map(b => b.from);
      expect(froms.every(f => f >= 0)).toBe(true);
    }
  });

  it('finds Zürich by locality or region, and nothing for elsewhere', () => {
    expect(taxTableFor({ country_code: 'ch', region: 'Zürich', locality: 'Witikon' })?.id).toBe(
      'ch-zh-zurich-single'
    );
    expect(taxTableFor({ country_code: 'CH', region: 'Bern', locality: 'Thun' })).toBeNull();
    expect(taxTableFor({ country_code: 'DE', region: 'Berlin', locality: 'Berlin' })).toBeNull();
  });
});
