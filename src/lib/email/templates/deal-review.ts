/**
 * Deal review prompt email (ADR-0010) — the in-app nudge, by mail. The words
 * are written once, in REVIEW_NUDGE_COPY / COUNTERPART_REVIEWED_COPY; this only
 * renders them.
 */

import { escapeHtml, renderEmail } from './layout';

export function dealReviewTemplate(data: {
  displayName: string;
  title: string;
  message: string;
  dealsUrl: string;
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  return renderEmail(
    {
      subject: data.title,
      preheader: data.message,
      heading: data.title,
      bodyHtml: `<p>Hi ${escapeHtml(data.displayName)},</p><p>${escapeHtml(data.message)}</p>`,
      bodyText: `Hi ${data.displayName},\n\n${data.message}`,
      ctaText: 'Open your deals',
      ctaUrl: data.dealsUrl,
    },
    data.unsubscribeUrl
  );
}
