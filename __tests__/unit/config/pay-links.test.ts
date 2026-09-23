/**
 * Pay links are the artifact people paste into chats, so their contract has to
 * be boring and stable. Two behaviours are load-bearing:
 *
 *  - the URL a user copies, shares and renders as a QR is ONE string, so the
 *    three can never disagree about the amount;
 *  - a prefill we cannot honour is reported, never silently dropped. Quietly
 *    nulling a bad amount (and showing a blank form) is the failure mode that
 *    teaches people not to trust payment links.
 */

import {
  buildPayUrl,
  parsePayPrefill,
  PAY_MAX_BTC,
  PAY_MIN_BTC,
  PAY_NOTE_MAX_LENGTH,
  renamedPayHref,
} from '@/config/pay';

const ORIGIN = 'https://orangecat.ch';
const params = (qs: string) => new URLSearchParams(qs);

describe('buildPayUrl', () => {
  it('builds a bare, reusable link when nothing is prefilled', () => {
    expect(buildPayUrl(ORIGIN, 'lena')).toBe('https://orangecat.ch/pay/lena');
  });

  it('carries an amount and a note as query params', () => {
    const url = new URL(buildPayUrl(ORIGIN, 'lena', { amountBtc: 0.0005, note: 'Dinner' }));
    expect(url.pathname).toBe('/pay/lena');
    expect(url.searchParams.get('amount')).toBe('0.0005');
    expect(url.searchParams.get('for')).toBe('Dinner');
  });

  it('does not leak float representation noise into the link', () => {
    const url = new URL(buildPayUrl(ORIGIN, 'lena', { amountBtc: 0.1 + 0.2 }));
    expect(url.searchParams.get('amount')).toBe('0.3');
  });

  it('omits an absent or zero amount rather than sending amount=0', () => {
    expect(buildPayUrl(ORIGIN, 'lena', { amountBtc: 0 })).toBe('https://orangecat.ch/pay/lena');
  });

  it('escapes usernames and truncates overlong notes', () => {
    expect(buildPayUrl(ORIGIN, 'a b/c')).toContain('/pay/a%20b%2Fc');
    const long = 'x'.repeat(PAY_NOTE_MAX_LENGTH + 40);
    const note = new URL(buildPayUrl(ORIGIN, 'lena', { note: long })).searchParams.get('for');
    expect(note).toHaveLength(PAY_NOTE_MAX_LENGTH);
  });

  it('round-trips through the parser — what we write, we can read', () => {
    const url = new URL(buildPayUrl(ORIGIN, 'lena', { amountBtc: 0.0005, note: 'Concert' }));
    const prefill = parsePayPrefill(url.searchParams);
    expect(prefill).toEqual({ amountBtc: 0.0005, note: 'Concert' });
  });
});

describe('renamedPayHref', () => {
  it('stays put when the link already uses the current name', () => {
    expect(renamedPayHref('cato', 'cato', {})).toBeNull();
  });

  it('sends an old name to the current page and keeps the amount', () => {
    expect(renamedPayHref('catomean', 'cato', { amount: '0.0001', for: 'dinner' })).toBe(
      '/pay/cato?amount=0.0001&for=dinner'
    );
  });
});

describe('parsePayPrefill', () => {
  it('returns nothing to prefill for a bare link', () => {
    expect(parsePayPrefill(params(''))).toEqual({});
  });

  it('reads a valid amount and note', () => {
    expect(parsePayPrefill(params('amount=0.001&for=Rent'))).toEqual({
      amountBtc: 0.001,
      note: 'Rent',
    });
  });

  it('reports an unreadable amount instead of silently dropping it', () => {
    const prefill = parsePayPrefill(params('amount=abc'));
    expect(prefill.amountBtc).toBeUndefined();
    expect(prefill.amountError).toContain('abc');
  });

  it.each([
    ['zero', '0'],
    ['negative', '-1'],
  ])('reports a %s amount', (_label, raw) => {
    const prefill = parsePayPrefill(params(`amount=${encodeURIComponent(raw)}`));
    expect(prefill.amountBtc).toBeUndefined();
    expect(prefill.amountError).toBeTruthy();
  });

  it('reports amounts outside the payable range', () => {
    const over = parsePayPrefill(params(`amount=${PAY_MAX_BTC + 1}`));
    expect(over.amountBtc).toBeUndefined();
    expect(over.amountError).toBeTruthy();

    const under = parsePayPrefill(params(`amount=${PAY_MIN_BTC / 10}`));
    expect(under.amountBtc).toBeUndefined();
    expect(under.amountError).toBeTruthy();
  });

  it('keeps a valid note even when the amount is unusable', () => {
    const prefill = parsePayPrefill(params('amount=nope&for=Dinner'));
    expect(prefill.note).toBe('Dinner');
    expect(prefill.amountError).toBeTruthy();
  });

  it('accepts the exact bounds', () => {
    expect(parsePayPrefill(params(`amount=${PAY_MIN_BTC}`)).amountBtc).toBe(PAY_MIN_BTC);
    expect(parsePayPrefill(params(`amount=${PAY_MAX_BTC}`)).amountBtc).toBe(PAY_MAX_BTC);
  });

  it('truncates an overlong note from a hand-edited link', () => {
    const prefill = parsePayPrefill(params(`for=${'y'.repeat(PAY_NOTE_MAX_LENGTH + 25)}`));
    expect(prefill.note).toHaveLength(PAY_NOTE_MAX_LENGTH);
  });
});
