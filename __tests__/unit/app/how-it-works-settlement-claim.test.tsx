// @vitest-environment jsdom
/**
 * /how-it-works on orangecat.ch (2026-11-12) said "Every transaction is
 * publicly verifiable on the Bitcoin blockchain" — untrue for Lightning, the
 * default rail, which settles off-chain.
 */
import { render } from '@testing-library/react';
import HowItWorksPage from '@/app/(public)/how-it-works/page';
import { SETTLEMENT_TRANSPARENCY_CLAIM } from '@/config/landing-page';

describe('/how-it-works', () => {
  it('says what is public for on-chain and for Lightning, not that every payment is', () => {
    const { container } = render(<HowItWorksPage />);
    const text = container.textContent ?? '';
    expect(text).toContain(SETTLEMENT_TRANSPARENCY_CLAIM);
    expect(text).not.toMatch(/every transaction is (publicly verifiable|permanent, transparent)/i);
  });
});
