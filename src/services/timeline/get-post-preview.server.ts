/**
 * The server's read of one wall post, for its page and its metadata.
 *
 * Read from the `timeline_events` TABLE with the reader's own session, never
 * from `enriched_timeline_events`: the view runs with its owner's rights and
 * so ignores row-level security, while the table's SELECT policy is the one
 * rule for who may see a post (public → anyone, signed out included;
 * followers → the author's followers; private → the author, plus replies on
 * the author's own private post). A post this returns is one the reader may
 * see; null means missing, deleted or not theirs to see, without saying which.
 */

import { cache } from 'react';
import { createServerClient } from '@/lib/supabase/server';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';
import type { PostPreviewSource } from '@/lib/seo/post-metadata';

export interface PostPageRead {
  post: PostPreviewSource | null;
  /** Whether the request carries a signed-in session. */
  viewerSignedIn: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One read per request: generateMetadata and the page share it. */
export const getPostForPage = cache(async (id: string): Promise<PostPageRead> => {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const viewerSignedIn = !!user;

    // Not a post id: say "not found" without asking Postgres to cast it.
    if (!UUID.test(id)) {
      return { post: null, viewerSignedIn };
    }

    const { data: row, error } = await supabase
      .from(DATABASE_TABLES.TIMELINE_EVENTS)
      .select('id, visibility, title, description, actor_id, event_timestamp')
      .eq('id', id)
      .eq('is_deleted', false)
      .maybeSingle();

    if (error || !row || !row.actor_id) {
      return { post: null, viewerSignedIn };
    }

    const { data: author } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('name, username')
      .eq('id', row.actor_id)
      .maybeSingle();

    return {
      viewerSignedIn,
      post: {
        id: row.id,
        visibility: row.visibility ?? '',
        text: row.description || row.title || '',
        authorName: author?.name || author?.username || '',
        authorUsername: author?.username ?? null,
        publishedAt: row.event_timestamp,
      },
    };
  } catch (err) {
    logger.error('Failed to read post for its page', { err, id }, 'Timeline');
    return { post: null, viewerSignedIn: false };
  }
});
