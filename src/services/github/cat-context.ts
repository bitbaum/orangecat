/**
 * What Cat reads through a connected GitHub account.
 *
 * Repos (private included), the open issues assigned to the person, and the
 * latest release of the repos they pushed most recently. Held in process
 * memory only, for a few minutes: private repository data is never written
 * to github_repo_cache, which keeps holding public data alone.
 *
 * Never throws; a person without the connection simply gets null and Cat
 * falls back to the public repos from their profile handle.
 */

import { getAdminClient } from '@/lib/supabase/admin';
import type { GitHubRepoSummary } from '@/services/ai/document-context-types';
import { getGitHubConnection, githubGet } from './connection';

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_REPOS = 15;
const MAX_ISSUES = 10;
const RELEASE_REPOS = 3;

export interface GitHubIssueSummary {
  title: string;
  repo: string;
  url: string;
  updatedAt: string;
}

export interface GitHubReleaseSummary {
  repo: string;
  name: string;
  url: string;
  publishedAt: string;
}

export interface ConnectedGitHub {
  login: string | null;
  repos: GitHubRepoSummary[];
  assignedIssues: GitHubIssueSummary[];
  releases: GitHubReleaseSummary[];
}

interface ApiRepo {
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  html_url: string;
  pushed_at: string;
  fork: boolean;
  archived: boolean;
  private: boolean;
}
interface ApiIssue {
  title: string;
  html_url: string;
  updated_at: string;
  pull_request?: unknown;
  repository?: { full_name?: string };
}
interface ApiRelease {
  name: string | null;
  tag_name: string;
  html_url: string;
  published_at: string | null;
  draft: boolean;
}

const cache = new Map<string, { at: number; value: ConnectedGitHub | null }>();

/** Pure: the three API answers → what Cat is given. */
export function shapeConnectedGitHub(
  login: string | null,
  repos: ApiRepo[] | null,
  issues: ApiIssue[] | null,
  releases: Array<{ repo: string; release: ApiRelease | null }>
): ConnectedGitHub {
  return {
    login,
    repos: (repos ?? [])
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
        private: r.private,
      })),
    // /issues also returns pull requests; keep them — "assigned to you" is the point.
    assignedIssues: (issues ?? []).slice(0, MAX_ISSUES).map(i => ({
      title: i.title,
      repo: i.repository?.full_name ?? '',
      url: i.html_url,
      updatedAt: i.updated_at,
    })),
    releases: releases
      .filter(r => r.release && !r.release.draft && r.release.published_at)
      .map(r => ({
        repo: r.repo,
        name: r.release!.name || r.release!.tag_name,
        url: r.release!.html_url,
        publishedAt: r.release!.published_at!,
      })),
  };
}

export async function fetchConnectedGitHubForCat(
  userId: string,
  now: number = Date.now()
): Promise<ConnectedGitHub | null> {
  const hit = cache.get(userId);
  if (hit && now - hit.at < CACHE_TTL_MS) {
    return hit.value;
  }
  let value: ConnectedGitHub | null = null;
  const connection = await getGitHubConnection(getAdminClient(), userId, now);
  if (connection) {
    const [repos, issues] = await Promise.all([
      githubGet<ApiRepo[]>(
        connection.token,
        '/user/repos?sort=pushed&per_page=30&affiliation=owner,collaborator'
      ),
      githubGet<ApiIssue[]>(
        connection.token,
        `/issues?filter=assigned&state=open&per_page=${MAX_ISSUES}`
      ),
    ]);
    const recent = (repos ?? []).filter(r => !r.fork && !r.archived).slice(0, RELEASE_REPOS);
    const releases = await Promise.all(
      recent.map(async r => ({
        repo: r.full_name,
        release: await githubGet<ApiRelease>(
          connection.token,
          `/repos/${r.full_name}/releases/latest`
        ),
      }))
    );
    value = shapeConnectedGitHub(connection.login, repos, issues, releases);
  }
  cache.set(userId, { at: now, value });
  return value;
}

/** Test seam. */
export function clearConnectedGitHubCache(): void {
  cache.clear();
}
