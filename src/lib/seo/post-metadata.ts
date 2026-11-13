/**
 * What a wall post shows to the rest of the web: its public URL, the preview a
 * chat app or search engine renders for it, and whether it may be spread at all.
 *
 * Pure. The access decision itself is made by the database (the
 * `timeline_events` SELECT policy, read with the reader's own session), so a
 * post that reaches this module is one the reader may already see. What this
 * module decides is how much of it leaves the page: only a PUBLIC post's words
 * go into metadata or share links. A followers-only or private post is shown to
 * the people allowed to see it and to nobody else, so its text is never put in
 * a <meta> tag, an Open Graph card or a prefilled share.
 */

import type { Metadata } from 'next';
import { APP_NAME } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { OG_SIZE } from '@/lib/og/branding';
import type { TimelineVisibility } from '@/types/timeline';

/** The fields of a post that its page, its metadata and its share row read. */
export interface PostPreviewSource {
  id: string;
  visibility: TimelineVisibility | string;
  /** The post's words: `description`, else `title` (what PostCard renders). */
  text: string;
  authorName: string;
  authorUsername?: string | null;
  publishedAt?: string | null;
}

/** Only `public` posts may be linked to, previewed or indexed. */
export function isPublicPost(visibility: string | null | undefined): boolean {
  return visibility === 'public';
}

/** The post's one public URL. */
export function postUrl(siteUrl: string, id: string): string {
  return `${siteUrl.replace(/\/+$/, '')}${ROUTES.POST(id)}`;
}

/**
 * The post's share card (src/app/api/og/post/[id]): who wrote it and its first
 * words. It draws only a public post; any other id gets the brand card.
 */
export function postCardUrl(siteUrl: string, id: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/api/og/post/${encodeURIComponent(id)}`;
}

const TITLE_LINE_MAX = 70;
const DESCRIPTION_MAX = 200;

function clip(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** The first non-empty line, whitespace collapsed. */
export function firstLine(text: string): string {
  const line = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .find(Boolean);
  return (line ?? '').replace(/\s+/g, ' ');
}

/**
 * The words a preview card carries for a PUBLIC post: "Author: first line" as
 * the title, the text (one paragraph, clipped) as the description.
 */
export function postPreview(post: PostPreviewSource): { title: string; description: string } {
  const author = post.authorName.trim() || (post.authorUsername ? `@${post.authorUsername}` : '');
  const line = clip(firstLine(post.text), TITLE_LINE_MAX);
  const title = line ? (author ? `${author}: “${line}”` : line) : `Post by ${author || 'someone'}`;
  const description = clip(post.text.replace(/\s+/g, ' ').trim(), DESCRIPTION_MAX);
  return { title, description: description || `A post on ${APP_NAME}.` };
}

/** The title every post that is not public gets — it names nothing. */
export const NON_PUBLIC_POST_TITLE = `Post on ${APP_NAME}`;

/**
 * Page metadata for `/post/<id>`.
 *
 * `post` is null when the reader cannot see it (missing, deleted, or not
 * shared with them — the database does not say which, and neither do we).
 * A post that is not public gets a title that names nothing, no description,
 * no card and `noindex`: an unfurler fetches signed out and must learn nothing
 * it could not read, and even a reader who can see it should not have the
 * text copied into a tag that travels with the link.
 */
export function buildPostMetadata(post: PostPreviewSource | null, siteUrl: string): Metadata {
  if (!post || !isPublicPost(post.visibility)) {
    return {
      title: NON_PUBLIC_POST_TITLE,
      robots: { index: false, follow: false },
    };
  }

  const url = postUrl(siteUrl, post.id);
  const { title, description } = postPreview(post);
  const author = post.authorName.trim() || post.authorUsername || undefined;
  const images = [{ url: postCardUrl(siteUrl, post.id), ...OG_SIZE, alt: title }];

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      siteName: APP_NAME,
      title,
      description,
      images,
      ...(post.publishedAt ? { publishedTime: post.publishedAt } : {}),
      ...(author ? { authors: [author] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images,
    },
  };
}
