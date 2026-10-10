'use client';

import { useState } from 'react';
import { Cat, Check, Share2 } from 'lucide-react';
import { shareIntentUrl } from '@/config/share';
import { SITE_URL } from '@/config/brand';

/**
 * Share affordances for an article — a prefilled post-on-X intent link plus the
 * native share sheet (falling back to copy-to-clipboard). The X link is a plain
 * intent URL: no SDK, no tracking script, the reader posts from their own
 * account. Article pages already ship `twitter:card` metadata, so the pasted
 * link unfurls into a large preview card.
 */

/** X's logo isn't in this lucide version — a minimal inline glyph, currentColor. */
function XGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M18.9 2.1h3.4l-7.4 8.5 8.7 11.3h-6.8l-5.3-6.9-6.1 6.9H1.9l7.9-9L1.4 2.1h7l4.8 6.3 5.7-6.3Zm-1.2 17.8h1.9L7.3 4H5.3l12.4 15.9Z" />
    </svg>
  );
}

/** LinkedIn's glyph, same deal — inline, currentColor, no SDK. */
function LinkedInGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
    </svg>
  );
}

export default function ShareButton({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  const intentHref = `https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  const buttonClass =
    'inline-flex items-center gap-1.5 rounded-md border border-default px-3 py-1.5 text-sm font-medium text-fg-secondary transition-colors hover:bg-surface-raised hover:text-fg-primary';

  return (
    <span className="inline-flex items-center gap-2">
      <a
        // Our own network first: the composer, prefilled, on this account.
        href={shareIntentUrl(SITE_URL, { url, title })}
        aria-label={`Share "${title}" on OrangeCat`}
        className={buttonClass}
      >
        <Cat className="h-3.5 w-3.5" />
        OrangeCat
      </a>
      <a
        href={intentHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Post "${title}" on X`}
        className={buttonClass}
      >
        <XGlyph className="h-3.5 w-3.5" />
        Post
      </a>
      <a
        // LinkedIn's share endpoint takes only the URL — the card comes from
        // the article's OpenGraph tags, same as X.
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Share "${title}" on LinkedIn`}
        className={buttonClass}
      >
        <LinkedInGlyph className="h-3.5 w-3.5" />
        LinkedIn
      </a>
      <button type="button" onClick={share} className={buttonClass}>
        {copied ? (
          <Check className="h-4 w-4 text-status-positive" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        {copied ? 'Link copied' : 'Share'}
      </button>
    </span>
  );
}
