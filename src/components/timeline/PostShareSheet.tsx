'use client';

import BottomSheet from '@/components/ui/BottomSheet';
import { ShareRow, type CrossPost } from '@/components/sharing/ShareRow';
import { APP_NAME, SITE_URL } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { isPublicPost, postPreview, postUrl } from '@/lib/seo/post-metadata';
import type { TimelineDisplayEvent } from '@/types/timeline';

/**
 * "Share" on a wall post: repost it here, or take its link anywhere else.
 * Signed out, "Repost on OrangeCat" is the way in — it opens sign-up and
 * comes back to this post.
 */
export function PostShareSheet({
  event,
  isOpen,
  onClose,
  signedIn,
  onRepost,
}: {
  event: TimelineDisplayEvent;
  isOpen: boolean;
  onClose: () => void;
  signedIn: boolean;
  onRepost?: () => void;
}) {
  const isPublic = isPublicPost(event.visibility);
  const url = postUrl(SITE_URL, event.id);
  const { title, description } = postPreview({
    id: event.id,
    visibility: event.visibility,
    text: event.description || event.title || '',
    authorName: event.actor?.name ?? '',
    authorUsername: event.actor?.username,
  });

  const repostLabel = `Repost on ${APP_NAME}`;
  const crossPost: CrossPost | undefined = signedIn
    ? onRepost
      ? {
          label: repostLabel,
          onClick: () => {
            onClose();
            onRepost();
          },
        }
      : undefined
    : {
        label: repostLabel,
        href: `${ROUTES.AUTH_REGISTER}&from=${encodeURIComponent(ROUTES.POST(event.id))}`,
        // Sign-up is part of this app: stay in the tab.
        newTab: false,
      };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Share post">
      <div className="p-4">
        <ShareRow
          url={url}
          // Only a public post's words travel with its link.
          title={isPublic ? title : ''}
          summary={isPublic ? description : undefined}
          audience={isPublic ? 'public' : 'restricted'}
          crossPost={crossPost}
        />
      </div>
    </BottomSheet>
  );
}
