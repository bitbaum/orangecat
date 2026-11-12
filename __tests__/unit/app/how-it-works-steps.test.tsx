// @vitest-environment jsdom
/**
 * /how-it-works, measured on orangecat.ch at 390px (2026-11-12):
 *
 * - The "Step 1/2/3" pills and the icon circles beside them were `text-white`
 *   on a per-step background that resolves to bg-fg-primary, near-white in the
 *   dark theme (the default): 1.19:1, effectively blank. Step 4 was white on
 *   status green: 2.21:1 in dark, 4.10:1 in light.
 * - "Every transaction is publicly verifiable on the Bitcoin blockchain" —
 *   untrue for Lightning, the default rail, which settles off-chain.
 */
import { render, screen } from '@testing-library/react';
import HowItWorksPage from '@/app/(public)/how-it-works/page';
import { HOW_IT_WORKS_STEPS, SETTLEMENT_TRANSPARENCY_CLAIM } from '@/config/landing-page';

describe('/how-it-works', () => {
  it('draws every step number and icon with the fg-primary / fg-inverted token pair', () => {
    render(<HowItWorksPage />);
    expect(HOW_IT_WORKS_STEPS.length).toBeGreaterThan(0);
    for (const step of HOW_IT_WORKS_STEPS) {
      const pill = screen.getByText(`Step ${step.number}`);
      const circle = pill.closest('.oc-card-link')?.querySelector('.rounded-full.w-16');
      expect(circle, `icon circle of step ${step.number}`).toBeTruthy();
      for (const el of [pill, circle as Element]) {
        const classes = el.className.split(/\s+/);
        expect(classes).toContain('bg-fg-primary');
        expect(classes).toContain('text-fg-inverted');
        expect(classes).not.toContain('text-white');
      }
    }
  });

  it('says what is public for on-chain and for Lightning, not that every payment is', () => {
    const { container } = render(<HowItWorksPage />);
    const text = container.textContent ?? '';
    expect(text).toContain(SETTLEMENT_TRANSPARENCY_CLAIM);
    expect(text).not.toMatch(/every transaction is (publicly verifiable|permanent, transparent)/i);
  });
});
