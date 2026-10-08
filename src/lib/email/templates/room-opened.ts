/**
 * "Someone opened your investor room" (ADR-0012) — the in-app notice, by mail.
 * The words are written once, at the dispatch site in
 * src/domain/projectRooms/open.ts; this only renders them.
 */

import { escapeHtml, renderEmail } from './layout';

export function roomOpenedTemplate(data: {
  displayName: string;
  title: string;
  message: string;
  roomUrl: string;
  unsubscribeUrl: string;
}): { subject: string; html: string; text: string } {
  return renderEmail(
    {
      subject: data.title,
      preheader: data.message,
      heading: data.title,
      bodyHtml: `<p>Hi ${escapeHtml(data.displayName)},</p><p>${escapeHtml(data.message)}</p>`,
      bodyText: `Hi ${data.displayName},\n\n${data.message}`,
      ctaText: 'See who opened what',
      ctaUrl: data.roomUrl,
    },
    data.unsubscribeUrl
  );
}
