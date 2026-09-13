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
// The verbs, in the order a maker meets them. "Make" leads because the Studio
// is the part nobody expects a funding platform to have, and because a
// description that starts at "fund" quietly tells a film-maker this is not
// their site.
export const APP_DESCRIPTION =
  'Make video, music and writing, then fund, sell, lend, invest, and coordinate with any identity. Cat is your private AI agent for practical economic next steps.';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || `https://${APP_DOMAIN}`;

export const APP_EMAIL_FROM = `${APP_NAME} <notifications@${APP_DOMAIN}>`;

/** Warm accent for rare CTAs (matches x.ai public band — defined once in globals `--public-accent`) */
export const BRAND_ACCENT_HEX = '#ff5c00';

export const BRAND_MARK_DESCRIPTION =
  'Minimal cat — round head, triangular ears, dot eyes, soft smile. Geometric but warm; recognizable as a cat at 16px favicon and 24px chrome.';
