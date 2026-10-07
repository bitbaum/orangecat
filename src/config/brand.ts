/**
 * OrangeCat brand SSOT (TypeScript)
 *
 * Visual mark: agent window + minimal cat ears — see BrandMark.tsx.
 * public/favicon.svg and public/images/orange-cat-logo.svg must stay
 * pixel-identical (scaled). Never introduce a third mark.
 *
 * created_date: 2026-06-03
 * last_modified_date: 2026-06-03
 * last_modified_summary: x.ai-adjacent identity; replaces mascot pirate-cat mark
 */

export const APP_NAME = 'OrangeCat';
export const APP_SLUG = 'orangecat';
export const APP_DOMAIN = 'orangecat.ch';
export const APP_KICKER = 'AI economic agent';
export const APP_TAGLINE = 'Your AI economic agent';
export const APP_DESCRIPTION =
  'Fund, lend, invest, and coordinate with any identity. Cat is your private AI agent for practical economic next steps.';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || `https://${APP_DOMAIN}`;

export const APP_EMAIL_FROM = `${APP_NAME} <notifications@${APP_DOMAIN}>`;

/**
 * The one public contact address. Only cato@ is a real mailbox on the
 * orangecat.ch domain (Infomaniak); mao@, and the hello@/security@/support@/
 * integrations@ addresses that replaced it on these pages, were never created,
 * so mail to them bounced. Every public page and legal text uses this.
 */
export const CONTACT_EMAIL = `cato@${APP_DOMAIN}`;

/** Warm accent for rare CTAs (matches x.ai public band — defined once in globals `--public-accent`) */
export const BRAND_ACCENT_HEX = '#ff5c00';

export const BRAND_MARK_DESCRIPTION =
  'Minimal cat — round head, triangular ears, dot eyes, soft smile. Geometric but warm; recognizable as a cat at 16px favicon and 24px chrome.';
