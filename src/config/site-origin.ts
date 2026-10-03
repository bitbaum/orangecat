/**
 * Where THIS OrangeCat is served from — the one origin every absolute public
 * URL is built on: sitemap, robots, SEO metadata, structured data, emails.
 *
 * It used to be the literal `https://orangecat.ch` in five files. A copy of
 * this repo running anywhere else then advertised bitbaum's site in its own
 * sitemap and emails. One env var, one fallback, and a fork is a fork.
 */
const raw =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://orangecat.ch';

export const SITE_ORIGIN = raw.replace(/\/+$/, '');
