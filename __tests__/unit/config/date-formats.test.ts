import { describe, it, expect } from 'vitest';
import {
  DATE_FORMAT_PREFERENCES,
  resolveDateFormat,
  resolveDateLocale,
  DATE_FORMATS,
  dateFormatSelectOptions,
} from '@/config/date-formats';

/**
 * The rule these exist to protect: a rung of the inference chain is skipped
 * when its value is ABSENT, never defaulted. `profiles.currency` is nullable
 * and `useUserCurrency` falls back to CHF for display — if that fallback leaked
 * into inference, every user who never opened settings would silently have
 * their dates reformatted.
 */
describe('resolveDateFormat — what the person said wins', () => {
  it('honours an explicit choice over every other signal', () => {
    expect(
      resolveDateFormat({
        preference: 'iso',
        locationCountry: 'US',
        currency: 'USD',
        language: 'en-US',
      })
    ).toBe('iso');
  });

  it("treats 'auto' as no choice at all", () => {
    expect(resolveDateFormat({ preference: 'auto', locationCountry: 'US' })).toBe('month-first');
  });
});

describe('resolveDateFormat — where they are, then what they spend', () => {
  it('reads the US as month-first and Switzerland as day-first', () => {
    expect(resolveDateFormat({ locationCountry: 'US' })).toBe('month-first');
    expect(resolveDateFormat({ locationCountry: 'CH' })).toBe('day-first');
  });

  it('accepts a country code in any case or with stray whitespace', () => {
    expect(resolveDateFormat({ locationCountry: ' us ' })).toBe('month-first');
  });

  it('prefers country over currency — an American abroad is not relocated by CHF', () => {
    expect(resolveDateFormat({ locationCountry: 'US', currency: 'CHF' })).toBe('month-first');
  });

  it('falls to currency only when no country is stored', () => {
    expect(resolveDateFormat({ currency: 'USD' })).toBe('month-first');
    expect(resolveDateFormat({ currency: 'CHF' })).toBe('day-first');
  });
});

describe('resolveDateFormat — absent is not a value', () => {
  it('skips null/empty rungs instead of treating them as a signal', () => {
    for (const signals of [
      {},
      { preference: null, locationCountry: null, currency: null, language: null },
      { locationCountry: '', currency: '', language: '' },
      { locationCountry: '   ' },
    ]) {
      expect(resolveDateFormat(signals)).toBe('day-first');
    }
  });

  it('ignores a country code that is not two letters', () => {
    expect(resolveDateFormat({ locationCountry: 'USA', currency: 'CHF' })).toBe('day-first');
  });

  it('reads a region subtag but not a bare language', () => {
    expect(resolveDateFormat({ language: 'en-US' })).toBe('month-first');
    expect(resolveDateFormat({ language: 'en' })).toBe('day-first');
    expect(resolveDateFormat({ language: 'de_CH' })).toBe('day-first');
  });
});

describe('the formats actually render what they are named', () => {
  const march15 = new Date(Date.UTC(2027, 2, 15, 12, 0, 0));

  it('puts the right part first in each format', () => {
    const day = march15.toLocaleDateString(DATE_FORMATS['day-first'].locale, { timeZone: 'UTC' });
    const month = march15.toLocaleDateString(DATE_FORMATS['month-first'].locale, {
      timeZone: 'UTC',
    });
    const iso = march15.toLocaleDateString(DATE_FORMATS.iso.locale, { timeZone: 'UTC' });

    expect(day.startsWith('15')).toBe(true);
    expect(month.startsWith('3')).toBe(true);
    expect(iso).toBe('2027-03-15');
  });

  it('resolveDateLocale agrees with the format it resolved', () => {
    expect(resolveDateLocale({ locationCountry: 'US' })).toBe(DATE_FORMATS['month-first'].locale);
    expect(resolveDateLocale({})).toBe(DATE_FORMATS['day-first'].locale);
  });
});

describe('the settings picker offers exactly what can be resolved', () => {
  it('leads with auto and then every concrete format, once each', () => {
    expect(dateFormatSelectOptions[0].value).toBe('auto');
    const offered = dateFormatSelectOptions
      .slice(1)
      .map(o => o.value)
      .sort();
    expect(offered).toEqual(Object.keys(DATE_FORMATS).sort());
  });
});

describe('the database and the type agree on what a preference may be', () => {
  /**
   * The CHECK constraint is a second copy of DATE_FORMAT_PREFERENCES, in SQL,
   * where TypeScript cannot see it. If they drift, the settings picker offers a
   * value Postgres rejects and the save fails with a constraint violation the
   * user cannot act on. This reads the migration and compares the two lists.
   */
  it('the migration CHECK lists exactly the values the type allows', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');

    const dir = 'supabase/migrations';
    const file = readdirSync(dir).find(f => f.includes('a_date_is_read_differently'));
    expect(file, 'the date_format migration must exist').toBeTruthy();

    const sql = readFileSync(join(dir, file as string), 'utf8');
    const match = sql.match(/date_format\s+IN\s*\(([^)]*)\)/i);
    expect(match, 'the migration must carry a CHECK on date_format').toBeTruthy();

    const inSql = (match as RegExpMatchArray)[1]
      .split(',')
      .map(v => v.trim().replace(/^'|'$/g, ''))
      .sort();

    expect(inSql).toEqual([...DATE_FORMAT_PREFERENCES].sort());
  });
});
