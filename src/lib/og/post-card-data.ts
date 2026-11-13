/**
 * What a wall post's share card says: who wrote it and its first words.
 *
 * Read with a SESSIONLESS client, so the timeline_events SELECT policy answers
 * as it would for the signed-out previewer, and then only a `public` post is
 * drawn (isPublicPost, the rule the post's own metadata follows). A
 * followers-only or private post, a deleted one or an id nobody has gets the
 * plain brand card: its words never leave the page in an image either.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { iconNodeOf, loadCardImage, makerName } from '@/lib/og/card-parts';
import type { ShareCardProps } from '@/lib/og/share-card';
import { firstLine, isPublicPost } from '@/lib/seo/post-metadata';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { MessageSquareText } from 'lucide-react';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIRST_WORDS_MAX = 110;

/** The post's first words: its first line, cut on a word boundary. */
export function firstWords(text: string, max = FIRST_WORDS_MAX): string {
  const line = firstLine(text);
  if (line.length <= max) {
    return line;
  }
  return `${line
    .slice(0, max - 1)
    .replace(/\s+\S*$/, '')
    .replace(/[\s,;:—–-]+$/, '')}…`;
}

/** The card for a public post, or null for the brand card. */
export async function loadPostCard(
  supabase: AnySupabaseClient,
  id: string
): Promise<ShareCardProps | null> {
  if (!UUID.test(id)) {
    return null;
  }
  const { data } = await supabase
    .from(DATABASE_TABLES.TIMELINE_EVENTS)
    .select('id, visibility, title, description, actor_id')
    .eq('id', id)
    .eq('is_deleted', false)
    .maybeSingle();
  const row = data as {
    visibility: string | null;
    title: string | null;
    description: string | null;
    actor_id: string | null;
  } | null;
  if (!row || !isPublicPost(row.visibility)) {
    return null;
  }
  const words = firstWords(row.description || row.title || '');
  if (!words) {
    return null;
  }

  const { data: author } = row.actor_id
    ? await supabase
        .from(DATABASE_TABLES.PROFILES)
        .select('name, username, avatar_url')
        .eq('id', row.actor_id)
        .maybeSingle()
    : { data: null };
  const profile = author as {
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;

  return {
    kicker: 'Post',
    title: `“${words}”`,
    maker: makerName(profile),
    image: await loadCardImage(profile?.avatar_url),
    icon: iconNodeOf(MessageSquareText),
    roundFace: true,
  };
}
