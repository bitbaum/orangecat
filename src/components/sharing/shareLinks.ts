/**
 * Links that spread a post to other places.
 *
 * TEMPORARY COPY — replace with `shareLinks` from `@bitbaum/bip-kit` once
 * 0.8.1 is on npm and the canary app has taken it (fleet rollout gate). The
 * signature, ids, order, labels and URLs here are bip-kit's own
 * (`bip-kit/src/share.ts`), so the swap is this file becoming
 * `export { shareLinks, type ShareLink, type ShareLinkId } from '@bitbaum/bip-kit';`.
 * Change bip-kit, not this copy.
 *
 * Every entry is a plain URL to the service's documented share or intent
 * endpoint (cited beside each). Nothing is posted until the reader confirms
 * there, and no script or tracker is loaded.
 */

export type ShareLinkId =
  'x' | 'linkedin' | 'bluesky' | 'hackernews' | 'whatsapp' | 'telegram' | 'email';

/** One way to spread a post: a stable id, a verb for the button, the link. */
export interface ShareLink {
  id: ShareLinkId;
  label: string;
  href: string;
}

/** What `shareLinks` reads. `url` is the post's public, absolute URL. */
export interface ShareTarget {
  url: string;
  title: string;
  /** A sentence or two; used where a service carries more than a title (email). */
  summary?: string;
  /** Replace any label. Unset ids keep the English verb. */
  labels?: Partial<Record<ShareLinkId, string>>;
}

export const defaultShareLinkLabels: Record<ShareLinkId, string> = {
  x: 'Share on X',
  linkedin: 'Share on LinkedIn',
  bluesky: 'Share on Bluesky',
  hackernews: 'Submit to Hacker News',
  whatsapp: 'Send on WhatsApp',
  telegram: 'Send on Telegram',
  email: 'Email it',
};

const enc = encodeURIComponent;

export function shareLinks(target: ShareTarget): ShareLink[] {
  let url: string;
  try {
    url = new URL(target.url).toString();
  } catch {
    throw new Error(`shareLinks: url is not an absolute URL: ${target.url}`);
  }
  const title = target.title.trim();
  const summary = target.summary?.trim();
  const withUrl = title ? `${title} ${url}` : url;
  const hrefs: Record<ShareLinkId, string> = {
    // https://docs.x.com/x-for-websites/post-button/guides/web-intent
    x: `https://x.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`,
    // https://learn.microsoft.com/linkedin/consumer/integrations/self-serve/plugins/share-plugin
    // (takes only the URL; the card comes from the page's Open Graph tags)
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
    // https://docs.bsky.app/docs/advanced-guides/intent-links (one `text` parameter)
    bluesky: `https://bsky.app/intent/compose?text=${enc(withUrl)}`,
    // https://news.ycombinator.com/bookmarklet.html
    hackernews: `https://news.ycombinator.com/submitlink?u=${enc(url)}&t=${enc(title)}`,
    // https://www.whatsapp.com/faq/en/general/26000030 ("How to use click to chat": wa.me/?text=)
    whatsapp: `https://wa.me/?text=${enc(withUrl)}`,
    // https://core.telegram.org/widgets/share
    telegram: `https://t.me/share/url?url=${enc(url)}&text=${enc(title)}`,
    // https://www.rfc-editor.org/rfc/rfc6068 (mailto: spaces must be %20, never +)
    email: `mailto:?subject=${enc(title)}&body=${enc(summary ? `${summary}\n\n${url}` : url)}`,
  };
  const labels = { ...defaultShareLinkLabels, ...target.labels };
  return (Object.keys(defaultShareLinkLabels) as ShareLinkId[]).map(id => ({
    id,
    label: labels[id],
    href: hrefs[id],
  }));
}
