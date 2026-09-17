/**
 * Articles — SSOT for the long-form text-expression surface.
 *
 * An article is NOT a new ENTITY_REGISTRY entity. It is a long-form POST on
 * `timeline_events`: one row, created through the same `createEventWithVisibility`
 * pipeline as a short post, carrying its long-form payload in `metadata.article`.
 * This gives SSOT (no duplicate table), free feed distribution, and ~¼ the code
 * of a new entity. See the text-expression architecture note.
 *
 * Storage shape (metadata.article on the timeline_events row):
 *   { slug, cover_image?, reading_time, body }   // body = raw markdown
 * plus `metadata.is_article = true` as the discriminator, `title` = article
 * title, and `description` = excerpt (feed + SEO). The feed-distribution RPC
 * (`create_post_with_visibility`) is used UNCHANGED — hence the payload rides in
 * `metadata`, which the RPC persists verbatim. No migration required.
 */

import { slugify } from '@/utils/string';

export const ARTICLE_EVENT_TYPE = 'status_update' as const;

/** Discriminator stored at `metadata.is_article`. */
export const ARTICLE_METADATA_FLAG = 'is_article' as const;

/** Words-per-minute used to estimate reading time. */
const WORDS_PER_MINUTE = 200;

export const ARTICLE_LIMITS = {
  /** Article title. Longer than a post title (120) — a headline, not a snippet. */
  title: 140,
  /** Excerpt / subtitle shown in the feed and SEO description. */
  excerpt: 280,
  /** Markdown body. Generous — this is the whole point of long-form. */
  body: 100_000,
  /** Minimum body length before publishing is allowed. */
  bodyMin: 1,
} as const;

export const ARTICLE_COPY = {
  new: {
    heading: 'Write an article',
    subheading: 'Long-form, Bitcoin-native, free to publish. Yours to keep.',
    titlePlaceholder: 'Title',
    excerptPlaceholder: 'A one-line summary (optional — shown in the feed and previews)',
    bodyPlaceholder: 'Write your article in Markdown…',
    coverLabel: 'Cover image URL (optional)',
    publish: 'Publish',
    publishing: 'Publishing…',
    cancel: 'Cancel',
  },
  edit: {
    heading: 'Edit article',
    subheading: 'Update your article. Changes go live immediately.',
    save: 'Save changes',
    saving: 'Saving…',
  },
  reader: {
    back: 'All articles',
    byUnknown: 'Unknown',
    privateNotice: 'Only you can see this article.',
    followersNotice: 'Visible to your followers.',
    edit: 'Edit',
    delete: 'Delete',
    deleting: 'Deleting…',
    deleteConfirm: 'Delete this article? This cannot be undone.',
  },
  index: {
    heading: 'Articles',
    subheading: 'Long-form thinking from the OrangeCat community.',
    empty: 'No articles published yet.',
    write: 'Write an article',
  },
} as const;

/**
 * Estimate reading time in whole minutes (>= 1) from raw markdown.
 * Strips markdown punctuation loosely — good enough for a "5 min read" badge.
 */
export function estimateReadingTime(markdown: string): number {
  const words = markdown
    .replace(/[#>*_`~\-!\[\]()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/**
 * Build a URL-safe base slug from a title. Not unique on its own — always pair
 * with a suffix via {@link buildArticleSlug}.
 */
export function slugifyTitle(title: string): string {
  return slugify(title, { maxLength: 80 }) || 'article';
}

/**
 * Deterministic-enough unique slug: `title-base-<suffix>`. The suffix is a short
 * random token so two same-titled articles never collide. Generated client-side
 * at publish time (before the row exists), so it lives in `metadata.article.slug`.
 */
export function buildArticleSlug(title: string, suffix: string): string {
  return `${slugifyTitle(title)}-${suffix}`;
}

/** A short, URL-safe random token for slug uniqueness. */
export function shortToken(length = 6): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

/**
 * Derive an excerpt from the body when the author leaves it blank: first
 * paragraph, markdown stripped, clamped to the excerpt limit.
 */
export function deriveExcerpt(body: string): string {
  const firstBlock = body.split(/\n\s*\n/).find(b => b.trim().length > 0) ?? '';
  const plain = firstBlock
    .replace(/[#>*_`~]/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1') // links/images → text
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > ARTICLE_LIMITS.excerpt
    ? `${plain.slice(0, ARTICLE_LIMITS.excerpt - 1).trimEnd()}…`
    : plain;
}
