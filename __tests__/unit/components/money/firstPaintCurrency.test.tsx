// @vitest-environment jsdom
/**
 * The first paint must already speak the visitor's currency.
 *
 * A stranger landing on a support page used to be shown "How much in BTC" and a
 * ladder of amounts like 0.0001 — because rates only arrived after a client-side
 * fetch, roughly a second later when warm and far worse cold. That first second
 * is the whole decision: 0.0001 BTC is a question almost nobody can answer,
 * CHF 5 is one anybody can.
 *
 * CurrencyRatesProvider closes that gap by handing the browser the rates the
 * server already had, applied before any child renders. This test renders the
 * real server pass and asserts the rendered HTML, so a regression shows up as a
 * failure rather than as a flicker nobody profiles.
 */

import { renderToString } from 'react-dom/server';
import { CurrencyRatesProvider } from '@/components/providers/CurrencyRatesProvider';
import { AmountField } from '@/components/money/AmountField';
import { currencyConverter } from '@/services/currency/rates';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
// An anonymous visitor: no profile, so the platform default (CHF) applies.
vi.mock('@/hooks/useUserCurrency', () => ({
  useUserCurrency: () => 'CHF',
}));

const SNAPSHOT = { rates: { CHF: 50_000, USD: 60_000, EUR: 55_000 }, fetchedAt: Date.now() };

beforeEach(() => {
  currencyConverter.clearCache();
});

function ssr(snapshot: typeof SNAPSHOT | null): string {
  return renderToString(
    <CurrencyRatesProvider initialSnapshot={snapshot}>
      <AmountField value={0.0001} onChange={() => {}} label="How much" />
    </CurrencyRatesProvider>
  );
}

describe('anonymous first paint', () => {
  it('renders the amount field in the visitor’s currency, not BTC', () => {
    const html = ssr(SNAPSHOT);

    expect(html).toContain('How much in CHF');
    expect(html).not.toContain('How much in BTC');
    // 0.0001 BTC at 50,000 CHF/BTC = CHF 5 — the field is pre-filled with the
    // fiat figure, not the Bitcoin one.
    expect(html).toContain('value="5"');
  });

  it('falls back to BTC — honestly — when the server had no rates', () => {
    const html = ssr(null);

    expect(html).toContain('How much in BTC');
  });

  it('ignores a snapshot too old to stand behind', () => {
    // A page prerendered at build time must not ship a fossilised rate.
    const html = ssr({ ...SNAPSHOT, fetchedAt: Date.now() - 60 * 60_000 });

    expect(html).toContain('How much in BTC');
  });
});
