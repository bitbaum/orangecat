/**
 * Share on OrangeCat — the one URL any page anywhere can send a reader to
 * with something worth posting, the way x.com/intent/post works for X.
 *
 *   https://orangecat.ch/share?url=<page>&title=<title>&text=<optional line>
 *
 * The page opens the composer prefilled; the reader posts from their own
 * account. Signed out, they sign in (or make an account) and land back here
 * with the intent intact. Loki's Thoughts, OrangeCat's own pages and any
 * fleet site link to it; a site that is not OrangeCat can still send its
 * readers here, which is how a social network grows past its own pages.
 *
 * SSOT for the path and the text it composes. Pure; tested.
 */

export const SHARE_INTENT_PATH = '/share';

/** What a share can carry. Everything optional but the URL. */
export type ShareIntent = { url: string; title?: string; text?: string };

/** The link to put behind a "Share on OrangeCat" button. */
export function shareIntentUrl(origin: string, intent: ShareIntent): string {
  const params = new URLSearchParams();
  params.set('url', intent.url);
  if (intent.title?.trim()) {
    params.set('title', intent.title.trim());
  }
  if (intent.text?.trim()) {
    params.set('text', intent.text.trim());
  }
  return `${origin.replace(/\/$/, '')}${SHARE_INTENT_PATH}?${params.toString()}`;
}

const MAX_TITLE = 200;
const MAX_TEXT = 1000;

/** Only web pages are worth a post; anything else is dropped, not posted. */
function webUrl(raw: string | null): string | null {
  if (!raw) {
    return null;
  }
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Read the intent off the page's query. Null when there is nothing to share
 * (no URL, or not a web URL), so the page can say so instead of opening an
 * empty composer.
 */
export function parseShareIntent(params: { get(name: string): string | null }): ShareIntent | null {
  const url = webUrl(params.get('url'));
  if (!url) {
    return null;
  }
  const title = params.get('title')?.trim().slice(0, MAX_TITLE) || undefined;
  const text = params.get('text')?.trim().slice(0, MAX_TEXT) || undefined;
  return { url, ...(title ? { title } : {}), ...(text ? { text } : {}) };
}

/**
 * The post as it first appears in the composer: the reader's own line (or
 * the title) and the link on its own line, where the card unfurls. Plain
 * text — the composer sanitizes and the reader edits before posting.
 */
export function composeShareText(intent: ShareIntent): string {
  const lead = intent.text ?? intent.title ?? '';
  return lead ? `${lead}\n\n${intent.url}` : intent.url;
}
