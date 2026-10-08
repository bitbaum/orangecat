/**
 * How fast a project ships, read from its public repository (investor portal,
 * phase 1): changes to the default branch, week by week, for the last 12 weeks.
 *
 * Commits on the default branch, not pull requests: studio repos squash-merge,
 * so one commit there is one merged change, and the commit list is one cheap,
 * deterministic call. (GitHub's /stats endpoints answer 202 "computing" on a
 * cold repo — a cached 202 would be a room without its chart.)
 *
 * Unauthenticated unless GITHUB_TOKEN is set: 60 requests an hour per IP is
 * enough because each repo is read at most hourly. NEVER FAILS THE ROOM — any
 * failure, a private repo or a non-GitHub URL is null, and the section is left out.
 */

const API = 'https://api.github.com';
const TIMEOUT_MS = 4_000;
const REVALIDATE_SECONDS = 3_600;
export const PACE_WEEKS = 12;
const MAX_PAGES = 4;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface RepoPace {
  repoUrl: string;
  /** Oldest first; up to `PACE_WEEKS` (fewer for a younger repo); the last is this week so far. */
  weeks: { start: string; count: number }[];
  total: number;
  /** True when the 12 weeks held more commits than were read — `total` is then a floor. */
  capped: boolean;
  createdAt: string | null;
  license: string | null;
}

/** "https://github.com/bitbaum/heidi" → "bitbaum/heidi". Exported for tests. */
export function repoSlug(url: string | null): string | null {
  const m = url?.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Monday 00:00 UTC of the week holding `at`. */
function weekStart(at: number): number {
  const d = new Date(at);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

/** Commit dates → weekly buckets ending with the current week. Exported for tests. */
export function bucketWeeks(dates: string[], now: number = Date.now()): RepoPace['weeks'] {
  const last = weekStart(now);
  const first = last - (PACE_WEEKS - 1) * WEEK_MS;
  const weeks = Array.from({ length: PACE_WEEKS }, (_, i) => ({
    start: new Date(first + i * WEEK_MS).toISOString().slice(0, 10),
    count: 0,
  }));
  for (const date of dates) {
    const t = Date.parse(date);
    if (Number.isNaN(t) || t < first) {
      continue;
    }
    const index = Math.floor((weekStart(t) - first) / WEEK_MS);
    if (index >= 0 && index < PACE_WEEKS) {
      weeks[index].count += 1;
    }
  }
  return weeks;
}

/**
 * A repository younger than the window starts its chart the week it was
 * created: empty bars before a project existed say nothing true about its pace.
 * Exported for tests.
 */
export function sinceCreated(
  weeks: RepoPace['weeks'],
  createdAt: string | null
): RepoPace['weeks'] {
  const created = createdAt ? Date.parse(createdAt) : NaN;
  if (Number.isNaN(created)) {
    return weeks;
  }
  const first = new Date(weekStart(created)).toISOString().slice(0, 10);
  const kept = weeks.filter(w => w.start >= first);
  return kept.length > 0 ? kept : weeks.slice(-1);
}

async function github(path: string): Promise<unknown | null> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetch(`${API}${path}`, {
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: REVALIDATE_SECONDS },
  });
  return response.status === 200 ? response.json() : null;
}

export async function getRepoPace(
  repoUrl: string | null,
  now: number = Date.now()
): Promise<RepoPace | null> {
  const slug = repoSlug(repoUrl);
  if (!slug) {
    return null;
  }
  try {
    const repo = (await github(`/repos/${slug}`)) as {
      private?: boolean;
      created_at?: string;
      default_branch?: string;
      license?: { spdx_id?: string } | null;
      html_url?: string;
    } | null;
    if (!repo || repo.private) {
      return null;
    }

    // Since the start of the first week, rounded to the day so the URL — and
    // therefore the cache entry — stays the same for a whole day.
    const since = new Date(weekStart(now) - (PACE_WEEKS - 1) * WEEK_MS).toISOString().slice(0, 10);
    const branch = encodeURIComponent(repo.default_branch ?? 'main');
    const dates: string[] = [];
    let capped = false;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const commits = (await github(
        `/repos/${slug}/commits?sha=${branch}&since=${since}T00:00:00Z&per_page=100&page=${page}`
      )) as { commit?: { committer?: { date?: string } } }[] | null;
      if (!Array.isArray(commits)) {
        return null;
      }
      for (const c of commits) {
        if (c.commit?.committer?.date) {
          dates.push(c.commit.committer.date);
        }
      }
      if (commits.length < 100) {
        break;
      }
      capped = page === MAX_PAGES;
    }

    const weeks = sinceCreated(bucketWeeks(dates, now), repo.created_at ?? null);
    return {
      repoUrl: repo.html_url ?? `https://github.com/${slug}`,
      weeks,
      total: weeks.reduce((sum, w) => sum + w.count, 0),
      capped,
      createdAt: repo.created_at ?? null,
      license:
        repo.license?.spdx_id && repo.license.spdx_id !== 'NOASSERTION'
          ? repo.license.spdx_id
          : null,
    };
  } catch {
    return null;
  }
}
