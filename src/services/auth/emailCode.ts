/**
 * Sign-in by emailed code — the password-free way into the one account that
 * serves OrangeCat, Solon and Loki (docs: solon/docs/design/2026-09-uniform-auth.md,
 * "Next" item 1).
 *
 * WHY OrangeCat SENDS THE MAIL, NOT GOTRUE
 * GoTrue can mail a sign-in code itself, but only if its magic-link template on
 * the box carries `{{ .Token }}` — box configuration no deploy manages and no
 * test can see. Here GoTrue only GENERATES the code (admin generateLink, which
 * sends nothing) and OrangeCat mails it from a template in this repo, through
 * the same transport as every other email. The whole path ships, reviews and
 * tests like code.
 *
 * WHAT THIS DOES NOT DO: verify the code. The browser hands it straight to
 * GoTrue (`verifyOtp`, type `email`), exactly like the password-reset code.
 * Checking it here would add nothing: GoTrue's verify endpoint is public, so a
 * per-email attempt counter in this app is one an attacker simply walks around.
 * Guessing is bounded by GoTrue's own per-IP verify limit and code expiry.
 *
 * GoTrue semantics relied on (supabase/auth v2.189, internal/api/mail.go):
 *   - existing user → a fresh recovery token, replacing any pending one;
 *   - unknown email → a new UNCONFIRMED user; the code confirms it on use.
 *   - verify type `email` accepts either token, so one browser call serves both.
 */

import { signInCodeTemplate } from '@/lib/email/templates/sign-in-code';
import type { MailMessage, SendResult } from '@/lib/email/client';

export type SendCodeOutcome =
  /** A code was generated and handed to the mail transport. */
  | { status: 'sent' }
  /** This deployment cannot send email; the option should not be offered. */
  | { status: 'unavailable' }
  | { status: 'invalid'; reason: string }
  /** Generation or delivery failed. Deliberately one message for every cause. */
  | { status: 'failed' };

export interface EmailCodeDeps {
  isEmailConfigured: () => boolean;
  /** Returns the six-digit code, or null when GoTrue refused. */
  generateCode: (email: string) => Promise<string | null>;
  sendEmail: (message: MailMessage) => Promise<SendResult>;
}

const EMAIL = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,255}\.[^\s@<>"]{2,}$/;

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const email = raw.trim().toLowerCase();
  return email.length <= 320 && EMAIL.test(email) ? email : null;
}

/**
 * Generate a code for `email` and mail it.
 *
 * The outcome is the same whether or not an account exists for the address:
 * this endpoint must not become a way to ask "is this person a user?".
 */
export async function sendSignInCode(
  input: { email: unknown; appName?: string | null },
  deps: EmailCodeDeps
): Promise<SendCodeOutcome> {
  if (!deps.isEmailConfigured()) {
    return { status: 'unavailable' };
  }
  const email = normalizeEmail(input.email);
  if (!email) {
    return { status: 'invalid', reason: 'Enter a valid email address.' };
  }

  let code: string | null;
  try {
    code = await deps.generateCode(email);
  } catch {
    code = null;
  }
  if (!code || !/^\d{6,10}$/.test(code)) {
    return { status: 'failed' };
  }

  const { subject, html, text } = signInCodeTemplate({ code, appName: input.appName });
  const result = await deps.sendEmail({ to: email, subject, html, text });
  return result.sent ? { status: 'sent' } : { status: 'failed' };
}
