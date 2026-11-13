'use client';

import { ShareRow, type ShareRowProps } from './ShareRow';

/**
 * The one way anything written on OrangeCat — a wall post or an article — is
 * spread. Public: the whole row (repost here, the device sheet, copy link,
 * every service). Not public: copy link only, and the note that says what the
 * link will and will not do, because a followers-only post shared to X is a
 * link that opens a sign-in wall for everyone who taps it.
 */

export const NON_PUBLIC_SHARE_NOTE =
  'Only people who can already see this will be able to open the link.';

export interface PostShareRowProps extends Pick<
  ShareRowProps,
  'url' | 'title' | 'summary' | 'crossPost' | 'className'
> {
  isPublic: boolean;
  /** What the row is a landmark for ("Share this post", "Share this article"). */
  landmark?: string;
}

export function PostShareRow({ isPublic, landmark, className, ...row }: PostShareRowProps) {
  return (
    <div className={className}>
      <ShareRow {...row} copyOnly={!isPublic} labels={landmark ? { landmark } : undefined} />
      {!isPublic && <p className="mb-0 mt-2 text-sm text-fg-secondary">{NON_PUBLIC_SHARE_NOTE}</p>}
    </div>
  );
}
