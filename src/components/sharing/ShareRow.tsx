'use client';

import { useEffect, useState } from 'react';
import { COMPONENT_STYLES } from '@/config/design-system';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { cn } from '@/lib/utils';
import { shareLinks, type ShareLinkId } from './shareLinks';

/**
 * One line of ways to spread a post: the app's own cross-post first, the
 * device share sheet (where there is one), "Copy link", then every service
 * from `shareLinks`. Many choices → one line that scrolls sideways, never
 * wrapping; every target 44px; monochrome, because this sits inside the app.
 *
 * TEMPORARY COPY of `ShareRow` from `@bitbaum/bip-kit/react` (0.8.1), same
 * props and order, to be replaced by it once 0.8.1 is on npm and the canary
 * app has taken it. Two differences, both to be upstreamed rather than kept:
 * `crossPost` may carry an `onClick` (a wall post reposts in place instead of
 * opening a composer), and `copyOnly` keeps a post that is not public to the
 * one action that cannot spread it further than its audience.
 */

export interface ShareRowLabels {
  /** The landmark's accessible name. */
  landmark: string;
  /** The device's own share sheet; shown only where the browser has one. */
  share: string;
  copy: string;
  copied: string;
  /** Shown in the prompt when the clipboard refuses, so the link can still be copied by hand. */
  copyManually: string;
}

export const defaultShareRowLabels: ShareRowLabels = {
  landmark: 'Share this post',
  share: 'Share…',
  copy: 'Copy link',
  copied: 'Link copied',
  copyManually: 'Copy this link',
};

export interface ShareRowProps {
  /** The post's absolute URL. */
  url: string;
  title: string;
  summary?: string;
  /** The app's own place to post it, shown first as the row's one primary action. */
  crossPost?: { label: string; href?: string; onClick?: () => void };
  /** `shareLinks` ids to leave out. */
  exclude?: ShareLinkId[];
  /** Only "Copy link": for a post that is not public. */
  copyOnly?: boolean;
  labels?: Partial<ShareRowLabels>;
  linkLabels?: Partial<Record<ShareLinkId, string>>;
  className?: string;
}

const ACTION = cn(COMPONENT_STYLES.button.base, 'h-11 min-h-11 shrink-0 px-4 text-sm');
const SECONDARY = cn(ACTION, COMPONENT_STYLES.button.variants.outline);
const PRIMARY = cn(ACTION, COMPONENT_STYLES.button.variants.primary);

export function ShareRow({
  url,
  title,
  summary,
  crossPost,
  exclude,
  copyOnly = false,
  labels,
  linkLabels,
  className,
}: ShareRowProps) {
  const words = { ...defaultShareRowLabels, ...labels };
  // Feature-detected after mount, so the server HTML and the first client
  // render agree; the button appears once the browser says it can share.
  const [canShare, setCanShare] = useState(false);
  const { copied, copy } = useCopyToClipboard(1600);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const skip = new Set<string>(exclude ?? []);
  const links = copyOnly
    ? []
    : shareLinks({ url, title, summary, labels: linkLabels }).filter(link => !skip.has(link.id));

  async function onCopy() {
    const ok = await copy(url);
    if (!ok) {
      // Clipboard blocked (permissions, http): hand the link over to copy by hand.
      window.prompt(words.copyManually, url);
    }
  }

  function onShare() {
    navigator.share({ title, text: summary, url }).catch(() => {
      /* dismissed by the reader — nothing to do */
    });
  }

  return (
    <nav aria-label={words.landmark} className={cn('-mx-1 overflow-x-auto', className)}>
      <ul className="flex w-max gap-2 px-1 py-0.5">
        {crossPost && !copyOnly ? (
          <li>
            {crossPost.href ? (
              <a href={crossPost.href} className={PRIMARY}>
                {crossPost.label}
              </a>
            ) : (
              <button type="button" onClick={crossPost.onClick} className={PRIMARY}>
                {crossPost.label}
              </button>
            )}
          </li>
        ) : null}
        {canShare && !copyOnly ? (
          <li>
            <button type="button" onClick={onShare} className={SECONDARY}>
              {words.share}
            </button>
          </li>
        ) : null}
        <li>
          <button
            type="button"
            onClick={onCopy}
            className={SECONDARY}
            data-copied={copied || undefined}
          >
            <span aria-live="polite">{copied ? words.copied : words.copy}</span>
          </button>
        </li>
        {links.map(link => (
          <li key={link.id}>
            <a
              href={link.href}
              className={SECONDARY}
              data-share={link.id}
              // mailto: hands off to the mail app; a new tab would be left blank.
              {...(link.href.startsWith('mailto:')
                ? {}
                : { target: '_blank', rel: 'noopener noreferrer' })}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
