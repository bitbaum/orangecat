/**
 * Server-side article reads. Articles are `timeline_events` rows flagged with
 * `metadata.is_article`; we read them through the `enriched_timeline_events`
 * view (joins actor data for the byline).
 */

import { cache } from 'react';
import { createServerClient } from '@/lib/supabase/server';
import { looseClient } from '@/lib/supabase/untyped';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';
import { ARTICLE_METADATA_FLAG } from '@/config/articles';
import type { Article, ArticleMetadataPayload } from './types';

interface AuthorProfileData {
  id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
}

interface EnrichedArticleRow {
  id: string;
  title: string | null;
  description: string | null;
  visibility: string | null;
  event_timestamp: string;
  is_deleted: boolean | null;
  actor_id: string;
  actor_data: AuthorProfileData | null;
  metadata: { is_article?: boolean; article?: ArticleMetadataPayload } | null;
}

const ENRICHED_VIEW = DATABASE_TABLES.ENRICHED_TIMELINE_EVENTS;

/** Columns needed to render an article — never `select('*')`. */
const ARTICLE_COLUMNS =
  'id, title, description, visibility, event_timestamp, is_deleted, actor_id, actor_data, metadata';

function rowToArticle(row: EnrichedArticleRow): Article | null {
  const payload = row.metadata?.article;
  if (
    !payload?.slug ||
    typeof payload.body !== 'string' ||
    !['public', 'followers', 'private'].includes(row.visibility ?? '')
  ) {
    return null;
  }

  const profile = row.actor_data;
  return {
    id: row.id,
    slug: payload.slug,
    title: row.title ?? 'Untitled',
    excerpt: row.description ?? '',
    body: payload.body,
    coverImage: payload.cover_image || undefined,
    readingTime: payload.reading_time ?? 1,
    visibility: row.visibility as Article['visibility'],
    publishedAt: row.event_timestamp,
    author: {
      id: profile?.id ?? row.actor_id,
      name: profile?.display_name || profile?.username || 'Unknown',
      username: profile?.username,
      avatarUrl: profile?.avatar_url,
    },
    authorProfileId: row.actor_id,
  };
}

/**
 * Fetch a single article by slug. Non-public articles are returned only to their
 * author or an eligible follower (the server client carries session cookies).
 *
 * React cache(): generateMetadata and the page body both call this with the
 * same slug in one request — without dedupe the DB round-trip (plus two auth
 * lookups for non-public articles) ran twice before first paint.
 */
export const getArticleBySlug = cache(async (slug: string): Promise<Article | null> => {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from(ENRICHED_VIEW)
      .select(ARTICLE_COLUMNS)
      .eq('metadata->article->>slug', slug)
      .eq('is_deleted', false)
      .limit(1)
      .maybeSingle<EnrichedArticleRow>();

    if (error || !data) {
      return null;
    }

    const article = rowToArticle(data);
    if (!article) {
      return null;
    }

    if (article.visibility !== 'public') {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return null;
      }
      // This legacy timeline FK references profiles(id), not actors(id).
      // Match the same profile identity that the writer and RLS policies use.
      if (user.id !== article.authorProfileId) {
        if (article.visibility !== 'followers') {
          return null;
        }
        const { data: follow, error: followError } = await supabase
          .from(DATABASE_TABLES.FOLLOWS)
          .select('follower_id')
          .eq('follower_id', user.id)
          .eq('following_id', article.authorProfileId)
          .limit(1)
          .maybeSingle();
        if (followError || !follow) {
          return null;
        }
      }
    }

    return article;
  } catch (err) {
    logger.error('Failed to fetch article by slug', { err, slug }, 'Articles');
    return null;
  }
});

/** Timeline authors are profile IDs, as defined by the table FK and RLS. */
export async function isCurrentUserArticleAuthor(authorProfileId: string): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return !!user && user.id === authorProfileId;
  } catch {
    return false;
  }
}

/** List public, published articles, newest first. */
export async function listPublishedArticles(limit = 30): Promise<Article[]> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from(ENRICHED_VIEW)
      .select(ARTICLE_COLUMNS)
      .eq(`metadata->>${ARTICLE_METADATA_FLAG}`, 'true')
      .eq('visibility', 'public')
      .eq('is_deleted', false)
      .order('event_timestamp', { ascending: false })
      .limit(limit)
      .returns<EnrichedArticleRow[]>();

    if (error || !data) {
      return [];
    }
    return data.map(rowToArticle).filter((a): a is Article => a !== null);
  } catch (err) {
    logger.error('Failed to list published articles', { err }, 'Articles');
    return [];
  }
}

/** Minimal reference to a public article — enough for sitemap/feed URLs. */
export interface PublicArticleRef {
  slug: string;
  publishedAt: string;
}

/**
 * List slug + publish date of public articles. Unlike the functions above,
 * the CALLER supplies the client: sitemap generation runs outside a request
 * (no cookies for createServerClient), so it passes the admin client instead.
 */
export async function listPublicArticleRefs(
  client: AnySupabaseClient,
  limit = 500
): Promise<PublicArticleRef[]> {
  const { data, error } = await looseClient(client)
    .from(ENRICHED_VIEW)
    .select('metadata, event_timestamp')
    .eq(`metadata->>${ARTICLE_METADATA_FLAG}`, 'true')
    .eq('visibility', 'public')
    .eq('is_deleted', false)
    .order('event_timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`listPublicArticleRefs failed: ${error.message}`);
  }

  return (data ?? []).flatMap(row => {
    const metadata = row.metadata as { article?: ArticleMetadataPayload } | null;
    const slug = metadata?.article?.slug;
    if (!slug) {
      return [];
    }
    return [{ slug, publishedAt: String(row.event_timestamp) }];
  });
}

/**
 * List one author's articles, newest first. Public articles are visible to
 * everyone; non-public (followers/private) ones are included only when the
 * viewer is the author (`includeNonPublic`). `authorUserId` is an auth user id —
 * the profile id referenced by timeline_events.actor_id.
 */
export async function listArticlesByAuthor(
  authorUserId: string,
  options: { includeNonPublic?: boolean; limit?: number } = {}
): Promise<Article[]> {
  const { includeNonPublic = false, limit = 50 } = options;
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = includeNonPublic ? await supabase.auth.getUser() : { data: { user: null } };
    const canIncludeNonPublic = includeNonPublic && user?.id === authorUserId;

    let query = supabase
      .from(ENRICHED_VIEW)
      .select(ARTICLE_COLUMNS)
      .eq(`metadata->>${ARTICLE_METADATA_FLAG}`, 'true')
      .eq('actor_id', authorUserId)
      .eq('is_deleted', false)
      .order('event_timestamp', { ascending: false })
      .limit(limit);

    if (!canIncludeNonPublic) {
      query = query.eq('visibility', 'public');
    }

    const { data, error } = await query.returns<EnrichedArticleRow[]>();
    if (error || !data) {
      return [];
    }
    return data.map(rowToArticle).filter((a): a is Article => a !== null);
  } catch (err) {
    logger.error('Failed to list articles by author', { err, authorUserId }, 'Articles');
    return [];
  }
}
