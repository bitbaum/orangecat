/**
 * GitHub through a connected account (read-only GitHub App user tokens).
 *
 * Pins: GitHub's 200-with-error token answers are refusals; tokens are stored
 * encrypted and refreshed before they expire; what Cat is given drops forks
 * and drafts and marks private work as private.
 */

import {
  getGitHubConnection,
  parseTokenResponse,
  saveGitHubConnection,
} from '@/services/github/connection';
import { shapeConnectedGitHub } from '@/services/github/cat-context';
import { renderGithubRepos, renderGithubWork } from '@/services/ai/context-sections';
import { resetCachedKey } from '@/lib/crypto/webhookSecretCipher';
import { decideGitHubReturn } from '@/app/api/integrations/github/state';
import { fetchGitHubReposForCat } from '@/services/ai/github-repos-fetcher';

describe('public repos from a profile handle', () => {
  it('drops the cached repos when the handle no longer exists (renamed account)', async () => {
    const upserts: unknown[] = [];
    const table = (name: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () =>
          name === 'profiles'
            ? {
                data: {
                  social_links: {
                    links: [{ platform: 'github', value: 'https://github.com/oldname' }],
                  },
                },
              }
            : {
                data: {
                  handle: 'oldname',
                  repos: [{ name: 'stale-repo' }],
                  fetched_at: '2026-08-27T00:00:00Z',
                },
              },
        upsert: async (row: unknown) => {
          upserts.push(row);
          return { error: null };
        },
      };
      return q;
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"message":"Not Found"}', { status: 404 }))
    );

    const repos = await fetchGitHubReposForCat(
      { from: table } as never,
      'u1',
      Date.parse('2026-09-25T00:00:00Z')
    );

    expect(repos).toEqual([]);
    expect(upserts).toHaveLength(1);
    expect((upserts[0] as { repos: unknown[] }).repos).toEqual([]);
  });
});

describe('decideGitHubReturn', () => {
  const base = {
    error: null,
    state: null,
    cookieState: 'abc123',
    code: null,
    installationId: null,
  };

  it('exchanges a code only when it comes back with our state', () => {
    expect(decideGitHubReturn({ ...base, state: 'abc123', code: 'c' })).toBe('exchange');
  });

  it('refuses a forged or mismatched state, never exchanging its code', () => {
    expect(decideGitHubReturn({ ...base, state: 'evil00', code: 'c' })).toBe('failed');
    expect(
      decideGitHubReturn({ ...base, state: 'abc123', cookieState: undefined, code: 'c' })
    ).toBe('failed');
  });

  it('restarts authorisation when returning from the install page without state', () => {
    expect(decideGitHubReturn({ ...base, code: 'c', installationId: '9' })).toBe('reauthorize');
    expect(decideGitHubReturn({ ...base, installationId: '9' })).toBe('reauthorize');
  });

  it('reports a decline, and fails on an empty return', () => {
    expect(decideGitHubReturn({ ...base, error: 'access_denied', state: 'abc123' })).toBe('denied');
    expect(decideGitHubReturn(base)).toBe('failed');
  });
});

const KEY = 'a'.repeat(64);

/** A one-table fake of the service-role client, enough for upsert/select. */
function fakeAdmin() {
  let row: Record<string, unknown> | null = null;
  const builder = {
    upsert: vi.fn(async (r: Record<string, unknown>) => {
      row = { ...r };
      return { error: null };
    }),
    select: () => builder,
    eq: () => builder,
    delete: () => builder,
    maybeSingle: async () => ({ data: row }),
  };
  return {
    client: { from: () => builder } as never,
    row: () => row,
    upsert: builder.upsert,
  };
}

beforeEach(() => {
  process.env.GITHUB_APP_CLIENT_ID = 'Iv1.test';
  process.env.GITHUB_APP_CLIENT_SECRET = 'secret';
  process.env.GITHUB_APP_SLUG = 'orangecat-cat';
  process.env.WEBHOOK_SECRET_KEY = KEY;
  resetCachedKey();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseTokenResponse', () => {
  it('reads a GitHub App token with its expiries', () => {
    const t = parseTokenResponse(
      {
        access_token: 'ghu_x',
        expires_in: 28800,
        refresh_token: 'ghr_y',
        refresh_token_expires_in: 15897600,
      },
      0
    );
    expect(t?.accessToken).toBe('ghu_x');
    expect(t?.accessExpiresAt?.getTime()).toBe(28800_000);
    expect(t?.refreshToken).toBe('ghr_y');
  });

  it('treats GitHub’s 200-with-error answer as a refusal', () => {
    expect(parseTokenResponse({ error: 'bad_verification_code' })).toBeNull();
    expect(parseTokenResponse(null)).toBeNull();
  });
});

describe('stored tokens', () => {
  it('never stores a token in plaintext', async () => {
    const admin = fakeAdmin();
    await saveGitHubConnection(admin.client, 'u1', 'octo', {
      accessToken: 'ghu_plain',
      accessExpiresAt: null,
      refreshToken: 'ghr_plain',
      refreshExpiresAt: null,
    });
    const stored = JSON.stringify(admin.row());
    expect(stored).not.toContain('ghu_plain');
    expect(stored).not.toContain('ghr_plain');
  });

  it('returns the stored token while it is fresh, without calling GitHub', async () => {
    const admin = fakeAdmin();
    const now = Date.parse('2026-09-25T12:00:00Z');
    await saveGitHubConnection(admin.client, 'u1', 'octo', {
      accessToken: 'ghu_fresh',
      accessExpiresAt: new Date(now + 60 * 60 * 1000),
      refreshToken: 'ghr_r',
      refreshExpiresAt: null,
    });
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const c = await getGitHubConnection(admin.client, 'u1', now);
    expect(c).toEqual({ login: 'octo', token: 'ghu_fresh' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refreshes a token about to expire, and stores the new one', async () => {
    const admin = fakeAdmin();
    const now = Date.parse('2026-09-25T12:00:00Z');
    await saveGitHubConnection(admin.client, 'u1', 'octo', {
      accessToken: 'ghu_old',
      accessExpiresAt: new Date(now + 60 * 1000),
      refreshToken: 'ghr_r',
      refreshExpiresAt: null,
    });
    const fetchSpy = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(init.body as string)).toMatchObject({
        grant_type: 'refresh_token',
        refresh_token: 'ghr_r',
      });
      return new Response(
        JSON.stringify({ access_token: 'ghu_new', expires_in: 28800, refresh_token: 'ghr_new' })
      );
    });
    vi.stubGlobal('fetch', fetchSpy);
    const c = await getGitHubConnection(admin.client, 'u1', now);
    expect(c?.token).toBe('ghu_new');
    expect(admin.upsert).toHaveBeenCalledTimes(2);
  });

  it('is inert until the GitHub App is configured', async () => {
    delete process.env.GITHUB_APP_CLIENT_ID;
    const admin = fakeAdmin();
    expect(await getGitHubConnection(admin.client, 'u1')).toBeNull();
  });
});

describe('shapeConnectedGitHub', () => {
  const repo = (over: Record<string, unknown> = {}) => ({
    name: 'kiln',
    full_name: 'octo/kiln',
    description: 'Firing schedules',
    language: 'TypeScript',
    stargazers_count: 3,
    html_url: 'https://github.com/octo/kiln',
    pushed_at: '2026-09-24T10:00:00Z',
    fork: false,
    archived: false,
    private: true,
    ...over,
  });

  it('keeps own work, marks private, drops forks and draft releases', () => {
    const out = shapeConnectedGitHub(
      'octo',
      [repo(), repo({ name: 'fork', fork: true })],
      [
        {
          title: 'Fix glaze calc',
          html_url: 'https://github.com/octo/kiln/issues/4',
          updated_at: '2026-09-24T10:00:00Z',
          repository: { full_name: 'octo/kiln' },
        },
      ],
      [
        {
          repo: 'octo/kiln',
          release: {
            name: 'v1.2',
            tag_name: 'v1.2',
            html_url: 'u',
            published_at: '2026-09-20T00:00:00Z',
            draft: false,
          },
        },
        {
          repo: 'octo/other',
          release: { name: null, tag_name: 'v0', html_url: 'u', published_at: null, draft: true },
        },
      ]
    );
    expect(out.repos.map(r => r.name)).toEqual(['kiln']);
    expect(out.repos[0].private).toBe(true);
    expect(out.assignedIssues[0].repo).toBe('octo/kiln');
    expect(out.releases).toHaveLength(1);
  });
});

describe('rendering', () => {
  it('warns Cat when private repos are in context', () => {
    const out = renderGithubRepos([
      {
        name: 'kiln',
        description: null,
        language: null,
        stars: 0,
        url: 'u',
        pushedAt: '2026-09-24T00:00:00Z',
        fork: false,
        archived: false,
        private: true,
      },
    ]);
    expect(out).toContain('private');
    expect(out).toMatch(/never repeat private details publicly/);
  });

  it('lists assigned issues and releases, and nothing when there are none', () => {
    const out = renderGithubWork({
      login: 'octo',
      assignedIssues: [{ title: 'Fix glaze calc', repo: 'octo/kiln', url: 'u', updatedAt: 'x' }],
      releases: [
        { repo: 'octo/kiln', name: 'v1.2', url: 'u', publishedAt: '2026-09-20T00:00:00Z' },
      ],
    });
    expect(out).toContain('@octo');
    expect(out).toContain('Fix glaze calc');
    expect(out).toContain('v1.2');
    expect(renderGithubWork({ login: 'octo', assignedIssues: [], releases: [] })).toBeNull();
    expect(renderGithubWork(null)).toBeNull();
  });
});
