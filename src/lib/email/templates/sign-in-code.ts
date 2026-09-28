/**
 * Sign-in code email — the six digits that stand in for a password.
 *
 * Sent by /api/auth/email-code. Pure function, no imports from outside
 * templates. The code is the whole message: it is set large, on its own line,
 * in the subject too, so a phone's notification alone is enough to finish
 * signing in. There is deliberately no link: a link opens in whatever browser
 * the mail app picks, while the code works in the browser that asked for it —
 * which is the whole reason this path exists.
 */

import { emailLayout, emailPlainText, EMAIL_COLORS, escapeHtml } from './layout';

export interface SignInCodeEmailData {
  code: string;
  /** The app the person is signing in to (Solon, Loki…), when another app sent them. */
  appName?: string | null;
}

export function signInCodeTemplate(data: SignInCodeEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const code = data.code.replace(/\D/g, '');
  const app = data.appName?.trim() || null;
  const target = app ? `${app} (your OrangeCat account)` : 'OrangeCat';
  const subject = `${code} is your sign-in code`;
  const heading = 'Your sign-in code';
  // No number of minutes: the lifetime is the auth server's OTP expiry, set on
  // the box, and an email must not promise a window the server does not keep.
  const validity = 'It works once and expires soon. If it has, ask for a new one.';
  const notYou =
    "Didn't ask for this? Ignore this email. Nobody can sign in without the code, and nothing changes on your account.";

  const html = emailLayout({
    preheader: `${code} — enter it to sign in to ${target}.`,
    heading,
    unsubscribeUrl: null,
    body: `
      <p style="margin:0 0 16px;">Enter this code to sign in to ${escapeHtml(target)}:</p>
      <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:6px;color:${EMAIL_COLORS.TEXT_PRIMARY};font-family:'SFMono-Regular',Menlo,Consolas,monospace;">${code}</p>
      <p style="margin:0 0 16px;">${validity}</p>
      <p style="margin:0;color:${EMAIL_COLORS.TEXT_MUTED};font-size:13px;">${notYou}</p>`,
  });

  const text = emailPlainText({
    heading,
    unsubscribeUrl: null,
    body: [`Enter this code to sign in to ${target}:`, '', code, '', validity, '', notYou].join(
      '\n'
    ),
  });

  return { subject, html, text };
}
