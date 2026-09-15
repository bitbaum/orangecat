/**
 * Shared Email Layout
 *
 * Cat-branded HTML wrapper for all OrangeCat email templates.
 * Mobile-responsive table layout (600px max-width).
 *
 * Pure functions — no imports, no side effects.
 */

interface EmailLayoutProps {
  /** Preview text shown in inbox (hidden in email body) */
  preheader: string;
  /** Main heading */
  heading: string;
  /** HTML body content */
  body: string;
  /** Optional CTA button text */
  ctaText?: string;
  /** Optional CTA button URL */
  ctaUrl?: string;
  /** Additional footer text */
  footer?: string;
  /** Unsubscribe link (required) */
  unsubscribeUrl: string;
}

// Exported so all email templates can share a single source of truth for
// inline styles (email clients require inline CSS — Tailwind tokens don't apply).
export const EMAIL_COLORS = {
  TIFFANY: '#0ABAB5',
  TIFFANY_LIGHT: '#E6F7F7',
  TEXT_PRIMARY: '#1a1a1a',
  TEXT_SECONDARY: '#4a4a4a',
  TEXT_MUTED: '#8a8a8a',
  BORDER: '#e5e5e5',
  BG: '#f5f5f5',
} as const;

const { TIFFANY, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, BORDER, BG } = EMAIL_COLORS;

/**
 * Wraps email content in the OrangeCat branded layout.
 * Returns a full HTML document string.
 */
export function emailLayout(props: EmailLayoutProps): string {
  const { preheader, heading, body, ctaText, ctaUrl, footer, unsubscribeUrl } = props;

  const ctaBlock =
    ctaText && ctaUrl
      ? `
        <tr>
          <td style="padding:32px 0 0;">
            <a href="${escapeHtml(ctaUrl)}"
              style="display:inline-block;background:${TIFFANY};color:#ffffff;text-decoration:none;
                     padding:14px 28px;border-radius:6px;font-size:15px;font-weight:600;
                     mso-padding-alt:0;">
              <!--[if mso]><i style="letter-spacing:28px;mso-font-width:-100%;mso-text-raise:21pt">&nbsp;</i><![endif]-->
              <span style="mso-text-raise:10pt;">${escapeHtml(ctaText)}</span>
              <!--[if mso]><i style="letter-spacing:28px;mso-font-width:-100%">&nbsp;</i><![endif]-->
            </a>
          </td>
        </tr>`
      : '';

  const footerExtra = footer
    ? `<p style="font-size:13px;color:${TEXT_MUTED};margin:0 0 12px;">${footer}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(heading)}</title>
  <!--[if !mso]><!-->
  <style>
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; padding: 0 16px !important; }
      .email-body { padding: 24px 16px !important; }
    }
  </style>
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background:${BG};font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${TEXT_PRIMARY};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- Preheader (hidden inbox preview text) -->
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${escapeHtml(preheader)}
    ${'&#8199;&#65279;&#847; '.repeat(30)}
  </div>

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};">
    <tr>
      <td align="center" style="padding:32px 0;">

        <!-- Email container -->
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0"
          style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid ${BORDER};">

          <!-- Header bar -->
          <tr>
            <td style="background:${TIFFANY};padding:20px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">OrangeCat</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td class="email-body" style="padding:32px 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="font-size:22px;font-weight:600;color:${TEXT_PRIMARY};margin:0 0 20px;line-height:1.3;">
                      ${heading}
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="font-size:15px;line-height:1.6;color:${TEXT_SECONDARY};">
                    ${body}
                  </td>
                </tr>
                ${ctaBlock}
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <div style="border-top:1px solid ${BORDER};"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px 32px;">
              ${footerExtra}
              <p style="font-size:13px;color:${TEXT_MUTED};margin:0 0 8px;">
                Sent by your Cat &middot; <a href="https://orangecat.ch" style="color:${TIFFANY};text-decoration:none;">orangecat.ch</a>
              </p>
              <p style="font-size:12px;color:${TEXT_MUTED};margin:0;">
                <a href="${escapeHtml(unsubscribeUrl)}" style="color:${TEXT_MUTED};text-decoration:underline;">Unsubscribe</a>
                &nbsp;&middot;&nbsp; OrangeCat &middot; Switzerland
              </p>
            </td>
          </tr>

        </table>
        <!-- /Email container -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates a plain text version from structured content.
 * Use this alongside emailLayout() to produce the text fallback.
 */
export function emailPlainText(props: {
  heading: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  footer?: string;
  unsubscribeUrl: string;
}): string {
  const { heading, body, ctaText, ctaUrl, footer, unsubscribeUrl } = props;

  const lines: string[] = [heading, '='.repeat(Math.min(heading.length, 60)), '', body, ''];

  if (ctaText && ctaUrl) {
    lines.push(`${ctaText}: ${ctaUrl}`, '');
  }

  if (footer) {
    lines.push(footer, '');
  }

  lines.push('---', 'Sent by your Cat | orangecat.ch', `Unsubscribe: ${unsubscribeUrl}`);

  return lines.join('\n');
}

/**
 * Minimal HTML entity escaping for user-provided strings.
 *
 * SSOT for every email template — it was copied into four of them, which is
 * four chances for one copy to drift and let a display name carry markup into
 * an inbox. Pinned by `__tests__/unit/lib/email-escape-html.test.ts`.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
