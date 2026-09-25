/**
 * GitHub repos context for Cat.
 *
 * Gives Cat awareness of the user's PUBLIC GitHub work, keyed off the GitHub
 * handle they've added to their profile social links. Public data only — no
 * OAuth scope, no stored credential.
 *
 * To keep the Cat hot path fast and within GitHub's unauthenticated rate limit,
 * results are cached per user (github_repo_cache) and refreshed lazily on a TTL.
 * On any failure we fall back to the cached rows (even if stale) or an empty
 * list — GitHub being slow or down never blocks a Cat reply.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { GitHubRepoSummary } from './document-context-types';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const FETCH_TIMEOUT_MS = 3500;
const MAX_REPOS = 15;

interface SocialLink {
  value?: string;
  platform?: string;
}

/** Pull a bare GitHub username out of a handle, @handle, or profile URL. */
function parseGitHubHandle(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim().replace(/^@/, '');
  const urlMatch = trimmed.match(/github\.com\/([\w-]+)/i);
  const handle = urlMatch ? urlMatch[1] : trimmed;
  return /^[\w-]+$/.test(handle) ? handle : null;
}

/** The GitHub handle from the profile's social links, or null. */
export async function getGitHubHandleForUser(
  supabase: AnySupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('social_links')
    .eq('id', userId)
    .maybeSingle();

  const links = (data?.social_links as { links?: SocialLink[] } | null)?.links;
  if (!Array.isArray(links)) {
    return null;
  }
  const gh = links.find(l => l.platform === 'github');
  return parseGitHubHandle(gh?.value);
}

interface GitHubApiRepo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  html_url: string;
  pushed_at: string;
  fork: boolean;
  archived: boolean;
}

async function fetchFromGitHub(handle: string): Promise<GitHubRepoSummary[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'OrangeCat',
    };
    // Optional: a server token raises the shared rate limit. Public data only.
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(handle)}/repos?sort=pushed&per_page=30&type=owner`,
      { headers, signal: controller.signal }
    );
    if (res.status === 404) {
      // The account is gone or renamed. That is an ANSWER, not an outage: an
      // empty list replaces the cache. Treating it as a failure served the
      // last cached repos forever — Cat showed a renamed account's repos,
      // frozen on the day of the rename, for a month.
      logger.warn('GitHub handle no longer exists', { handle }, 'GitHubRepos');
      return [];
    }
    if (!res.ok) {
      logger.warn('GitHub repos fetch non-OK', { handle, status: res.status }, 'GitHubRepos');
      return null;
    }
    const repos = (await res.json()) as GitHubApiRepo[];
    return repos
      .filter(r => !r.fork)
      .slice(0, MAX_REPOS)
      .map(r => ({
        name: r.name,
        description: r.description,
        language: r.language,
        stars: r.stargazers_count ?? 0,
        url: r.html_url,
        pushedAt: r.pushed_at,
        fork: r.fork,
        archived: r.archived,
      }));
  } catch (error) {
    logger.warn('GitHub repos fetch failed', { handle, error: String(error) }, 'GitHubRepos');
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The user's public GitHub repos for Cat context. Reads cache first; refreshes
 * from GitHub only when the cache is missing/stale, and always degrades to
 * cached/empty on failure.
 */
export async function fetchGitHubReposForCat(
  supabase: AnySupabaseClient,
  userId: string,
  nowMs: number = Date.now()
): Promise<GitHubRepoSummary[]> {
  try {
    const handle = await getGitHubHandleForUser(supabase, userId);
    if (!handle) {
      return [];
    }

    const { data: cache } = await supabase
      .from(DATABASE_TABLES.GITHUB_REPO_CACHE)
      .select('handle, repos, fetched_at')
      .eq('user_id', userId)
      .maybeSingle();

    const cachedRepos = (cache?.repos as GitHubRepoSummary[] | undefined) ?? [];
    const fresh =
      cache &&
      cache.handle === handle &&
      nowMs - new Date(cache.fetched_at as string).getTime() < CACHE_TTL_MS;

    if (fresh) {
      return cachedRepos;
    }

    const fetched = await fetchFromGitHub(handle);
    if (!fetched) {
      // GitHub failed — keep serving whatever we had.
      return cachedRepos;
    }

    await supabase.from(DATABASE_TABLES.GITHUB_REPO_CACHE).upsert(
      {
        user_id: userId,
        handle,
        repos: fetched,
        fetched_at: new Date(nowMs).toISOString(),
      },
      { onConflict: 'user_id' }
    );

    return fetched;
  } catch (error) {
    logger.error('Exception fetching github repos for cat', error, 'GitHubRepos');
    return [];
  }
}
