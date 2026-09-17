/**
 * Nudge language used to be inferred from currency: no `profile.language` plus
 * a CHF preference meant German. CHF is this platform's DEFAULT fiat, so that
 * describes every account that never chose anything — and the founder, whose
 * interface is English, opened his dashboard to a column of German nudge cards
 * ("Lass „bitcoin" für dich arbeiten", "Biete „Handgemachte Keramiktasse" als
 * Produkt an").
 *
 * A default is not a preference, and a currency is not a language — Switzerland
 * has four national languages. This is the same category error `@/utils/locale`
 * was written to end one layer down.
 */

import { resolveNudgeLanguage, NUDGE_COPY } from '@/services/cat/nudge-copy';

describe('nudge language', () => {
  it('does not read a language out of the currency', () => {
    for (const currency of ['CHF', 'EUR', 'USD', 'chf', null, undefined]) {
      expect(resolveNudgeLanguage({ language: null, currency })).toBe('en');
    }
  });

  it('defaults to the language the interface actually speaks', () => {
    expect(resolveNudgeLanguage(null)).toBe('en');
    expect(resolveNudgeLanguage(undefined)).toBe('en');
    expect(resolveNudgeLanguage({})).toBe('en');
    expect(resolveNudgeLanguage({ language: '', currency: 'CHF' })).toBe('en');
  });

  it('still honours an explicit choice, whatever the currency says', () => {
    expect(resolveNudgeLanguage({ language: 'de', currency: 'USD' })).toBe('de');
    expect(resolveNudgeLanguage({ language: 'de-CH', currency: 'USD' })).toBe('de');
    expect(resolveNudgeLanguage({ language: 'en', currency: 'CHF' })).toBe('en');
  });

  it('keeps a copy table for every language it can return', () => {
    expect(Object.keys(NUDGE_COPY).sort()).toEqual(['de', 'en']);
    expect(NUDGE_COPY.en.languageName).toBe('English');
  });
});
