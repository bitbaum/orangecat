/**
 * Email transport — thin adapter over @bitbaum/mail-kit (the fleet's one
 * email layer).
 *
 * SSOT: this is the canonical seam for outbound email. Templates stay in
 * src/lib/email/templates; only the transport lives here.
 *
 * - `sendEmail()` never throws — it returns mail-kit's SendResult; callers
 *   that care about delivery check `.sent`.
 * - Sender SSOT is the RESEND_FROM env var (read by mail-kit), with the
 *   fleet-conventional sender as fallback. Per-message `from` still wins.
 * - `isEmailConfigured()` keeps its historical name and call sites; the
 *   placeholder-key (and production sandbox-sender) guard now lives inside
 *   mail-kit's isMailConfigured.
 */

import {
  conventionalFrom,
  fromAddress,
  isMailConfigured,
  sendMail,
  type MailMessage,
  type SendOptions,
  type SendResult,
} from '@bitbaum/mail-kit';

export type { MailMessage, SendOptions, SendResult } from '@bitbaum/mail-kit';

/**
 * Returns true if email can actually go out (real API key; no production
 * sandbox sender). Use this to short-circuit email-sending code paths in dev.
 */
export function isEmailConfigured(): boolean {
  return isMailConfigured();
}

/** Send one email. Never throws — inspect `result.sent`. */
export function sendEmail(message: MailMessage, options?: SendOptions): Promise<SendResult> {
  return sendMail(
    { ...message, from: message.from ?? fromAddress() ?? conventionalFrom('OrangeCat') },
    options
  );
}
