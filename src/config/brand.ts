/**
 * OrangeCat brand SSOT (TypeScript)
 *
 * Visual mark: src/config/marks/<APP_SLUG>.ts, one file, rendered everywhere
 * from the registry. Replace it with `pnpm run brand:import orangecat logo.svg`,
 * which also regenerates every static icon. See docs/design-system/
 * branding-design.md → "Replacing a mark". Never draw a mark anywhere else.
 *
 * created_date: 2026-06-03
 * last_modified_date: 2026-10-11
 * last_modified_summary: marks are swappable files; the coil replaces the cat face / window-with-ears pair
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

/** The one orange: Bitcoin orange, the accent (globals `--public-accent` → `--bitcoin-orange`). */
export const BRAND_ACCENT_HEX = '#f7931a';

export const BRAND_MARK_DESCRIPTION =
  'A coil that is a cat: one continuous stroke wound inward, two ears on its outer turn. Loki’s spiral, wearing the cat. Reads as a cat at a 16px favicon and as a hypnotic coil at 220px.';
