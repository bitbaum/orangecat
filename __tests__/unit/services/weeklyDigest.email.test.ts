/**
 * Weekly digest email — builder→template contract.
 *
 * The digest pipeline was never scheduled and never ran in production.
 * When the cron was finally installed (2026-06), the builder's output shape
 * (digestBuilder.ts WeeklyDigestData) no longer matched the template's input:
 *   1. suggestions were {text, actionLabel, actionUrl} objects → the template
 *      called escapeHtml(object) → TypeError → EVERY send failed silently
 *   2. stats keys drifted (totalPaymentsReceived vs payments, paymentAmountBtc
 *      vs amountBtc) → payment stats silently dropped → "quiet week" emails
 *      for users who actually received payments
 * buildWeeklyDigestEmail is the single mapping point; this suite pins it
 * using data shaped exactly like the builder's output.
 */

// Keep the transport mocked so the pure mapper under test stays hermetic —
// it never sends anything.
vi.mock('@/lib/email/client', () => ({
  sendEmail: vi.fn(),
  isEmailConfigured: vi.fn(() => false),
}));

import { buildWeeklyDigestEmail } from '@/services/notifications/emailService';

const URLS = {
  dashboardUrl: 'https://orangecat.ch/dashboard',
  chatUrl: 'https://orangecat.ch/dashboard/cat',
  unsubscribeUrl: 'https://orangecat.ch/settings/notifications',
};

/** Shaped exactly like digestBuilder.ts buildWeeklyDigest() output. */
const BUILDER_DIGEST = {
  userName: 'Satoshi',
  period: { start: '2026-06-06', end: '2026-06-13' },
  hasContent: true,
  stats: {
    totalPaymentsReceived: 3,
    paymentAmountBtc: 0.0015,
    newFollowers: 2,
    newMessages: 5,
  },
  suggestions: [
    {
      text: 'Complete your profile with a bio to build trust.',
      actionLabel: 'Edit profile',
      actionUrl: 'https://orangecat.ch/dashboard/info/edit',
    },
  ],
};

describe('buildWeeklyDigestEmail', () => {
  it('renders builder-shaped data without throwing (regression: object suggestions crashed escapeHtml)', () => {
    expect(() => buildWeeklyDigestEmail('Satoshi', BUILDER_DIGEST, URLS)).not.toThrow();
  });

  it('renders suggestion text, not [object Object]', () => {
    const { html, text } = buildWeeklyDigestEmail('Satoshi', BUILDER_DIGEST, URLS);
    expect(html).toContain('Complete your profile with a bio to build trust.');
    expect(html).not.toContain('[object Object]');
    expect(text).toContain('Complete your profile with a bio to build trust.');
  });

  it('maps payment stats (regression: key drift dropped them → false "quiet week")', () => {
    const { html, text } = buildWeeklyDigestEmail('Satoshi', BUILDER_DIGEST, URLS);
    expect(html).toContain('Payments');
    expect(html).toContain('3 (0.0015 BTC)');
    expect(html).not.toContain('quiet week');
    expect(text).toContain('Payments: 3 (0.0015 BTC)');
  });

  it('maps newFollowers and newMessages', () => {
    const { html } = buildWeeklyDigestEmail('Satoshi', BUILDER_DIGEST, URLS);
    expect(html).toContain('New followers');
    expect(html).toContain('New messages');
  });

  it('greets the user by name', () => {
    const { html } = buildWeeklyDigestEmail('Satoshi', BUILDER_DIGEST, URLS);
    expect(html).toContain('Hi Satoshi');
  });

  it('falls back to the quiet-week message when there are no stats or top entities', () => {
    const { html } = buildWeeklyDigestEmail('Satoshi', { stats: {}, suggestions: undefined }, URLS);
    expect(html).toContain('quiet week');
  });

  it('also accepts plain-string suggestions', () => {
    const { html } = buildWeeklyDigestEmail(
      'Satoshi',
      { stats: {}, suggestions: ['Just a string suggestion.'] },
      URLS
    );
    expect(html).toContain('Just a string suggestion.');
  });
});
