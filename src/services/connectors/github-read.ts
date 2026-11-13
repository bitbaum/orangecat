/**
 * What a bot or the Cat can read in a person's connected GitHub, on request:
 * their repositories, open issues, open pull requests, and one file.
 * Read-only by construction: the GitHub App declares read permissions only
 * (services/github/connection.ts), and every call here is a GET.
 */

import { githubGet } from '@/services/github/connection';

export const GITHUB_READ_KINDS = ['repos', 'issues', 'pulls', 'file'] as const;
export type GitHubReadKind = (typeof GITHUB_READ_KINDS)[number];

const LIST_MAX = 20;
/** A file is handed to a model: enough to read a module, not a whole bundle. */
export const FILE_MAX_CHARS = 12_000;

const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export interface GitHubReadRequest {
  what: GitHubReadKind;
  repo?: string;
  path?: string;
}

/** The request as asked, or the sentence that says what is missing. Pure. */
export function parseGitHubRead(
  params: Record<string, unknown>
): { ok: true; request: GitHubReadRequest } | { ok: false; error: string } {
  const what = typeof params.what === 'string' ? params.what.trim().toLowerCase() : '';
  if (!(GITHUB_READ_KINDS as readonly string[]).includes(what)) {
    return { ok: false, error: `"what" is one of: ${GITHUB_READ_KINDS.join(', ')}.` };
  }
  const repo = typeof params.repo === 'string' ? params.repo.trim() : '';
  if (repo && !REPO.test(repo)) {
    return { ok: false, error: 'A repository is written owner/name, for example bitbaum/loki.' };
  }
  const path = typeof params.path === 'string' ? params.path.trim().replace(/^\/+/, '') : '';
  if (path.split('/').includes('..')) {
    return { ok: false, error: 'A path stays inside the repository.' };
  }
  if ((what === 'pulls' || what === 'file') && !repo) {
    return { ok: false, error: `Reading ${what} needs "repo" (owner/name). Ask which one.` };
  }
  return {
    ok: true,
    request: {
      what: what as GitHubReadKind,
      ...(repo ? { repo } : {}),
      ...(path ? { path } : {}),
    },
  };
}

interface ApiRepo {
  full_name: string;
  description: string | null;
  private: boolean;
  archived: boolean;
  pushed_at: string | null;
}
interface ApiIssue {
  number: number;
  title: string;
  html_url: string;
  updated_at: string;
  pull_request?: unknown;
  repository?: { full_name?: string };
  user?: { login?: string };
}
interface ApiPull {
  number: number;
  title: string;
  html_url: string;
  draft?: boolean;
  user?: { login?: string };
  updated_at: string;
}
interface ApiContent {
  type?: string;
  name?: string;
  path?: string;
  content?: string;
  encoding?: string;
  size?: number;
}

const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');

export function reposText(repos: readonly ApiRepo[]): string {
  if (repos.length === 0) {
    return 'No repositories are shared with OrangeCat on GitHub.';
  }
  return [
    `${repos.length} repositories, most recently pushed first:`,
    ...repos.map(
      r =>
        `- ${r.full_name}${r.private ? ' (private)' : ''}${r.archived ? ' (archived)' : ''}` +
        `${r.description ? `: ${r.description}` : ''}${r.pushed_at ? ` · pushed ${day(r.pushed_at)}` : ''}`
    ),
  ].join('\n');
}

export function issuesText(issues: readonly ApiIssue[], repo?: string): string {
  // GitHub's issue lists carry pull requests too; say which is which.
  if (issues.length === 0) {
    return repo ? `No open issues in ${repo}.` : 'No open issues are assigned to you.';
  }
  return [
    repo ? `Open issues in ${repo}:` : 'Open issues and pull requests assigned to you:',
    ...issues.map(
      i =>
        `- ${i.pull_request ? 'PR' : 'Issue'} #${i.number}` +
        `${!repo && i.repository?.full_name ? ` in ${i.repository.full_name}` : ''}: ${i.title}` +
        ` · updated ${day(i.updated_at)} · ${i.html_url}`
    ),
  ].join('\n');
}

export function pullsText(pulls: readonly ApiPull[], repo: string): string {
  if (pulls.length === 0) {
    return `No open pull requests in ${repo}.`;
  }
  return [
    `Open pull requests in ${repo}:`,
    ...pulls.map(
      p =>
        `- #${p.number}${p.draft ? ' (draft)' : ''}: ${p.title}` +
        `${p.user?.login ? ` · by ${p.user.login}` : ''} · updated ${day(p.updated_at)} · ${p.html_url}`
    ),
  ].join('\n');
}

export function contentText(
  content: ApiContent | ApiContent[],
  repo: string,
  path: string
): string {
  if (Array.isArray(content)) {
    return [
      `${repo}/${path || ''} holds:`,
      ...content.slice(0, 100).map(c => `- ${c.name}${c.type === 'dir' ? '/' : ''}`),
    ].join('\n');
  }
  if (content.type !== 'file' || content.encoding !== 'base64' || !content.content) {
    return `${repo}/${path} is not a file that can be read as text here.`;
  }
  const text = Buffer.from(content.content, 'base64').toString('utf8');
  if (text.includes('\u0000')) {
    return `${repo}/${path} is not a text file.`;
  }
  const cut = text.length > FILE_MAX_CHARS;
  return [
    `${repo}/${path}${cut ? ` (first ${FILE_MAX_CHARS} of ${text.length} characters)` : ''}:`,
    '',
    cut ? text.slice(0, FILE_MAX_CHARS) : text,
  ].join('\n');
}

const NOT_SHARED = (repo: string) =>
  `GitHub did not answer for ${repo}. Either it does not exist, or it is not among the repositories shared with OrangeCat (that list is changed on GitHub, in the app's settings).`;

/** Run one read with the person's token. Never throws. */
export async function readGitHub(
  token: string,
  request: GitHubReadRequest
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const { what, repo, path } = request;
  if (what === 'repos') {
    const repos = await githubGet<ApiRepo[]>(
      token,
      `/user/repos?sort=pushed&per_page=${LIST_MAX}&affiliation=owner,collaborator,organization_member`
    );
    return repos
      ? { ok: true, text: reposText(repos) }
      : { ok: false, error: 'GitHub did not answer just now.' };
  }
  if (what === 'issues') {
    const issues = await githubGet<ApiIssue[]>(
      token,
      repo
        ? `/repos/${repo}/issues?state=open&per_page=${LIST_MAX}`
        : `/issues?filter=assigned&state=open&per_page=${LIST_MAX}`
    );
    if (!issues) {
      return {
        ok: false,
        error: repo ? NOT_SHARED(repo) : 'GitHub did not answer just now.',
      };
    }
    return {
      ok: true,
      text: issuesText(repo ? issues.filter(i => !i.pull_request) : issues, repo),
    };
  }
  if (what === 'pulls') {
    const pulls = await githubGet<ApiPull[]>(
      token,
      `/repos/${repo}/pulls?state=open&per_page=${LIST_MAX}`
    );
    return pulls
      ? { ok: true, text: pullsText(pulls, repo as string) }
      : { ok: false, error: NOT_SHARED(repo as string) };
  }
  const encoded = (path ?? '').split('/').map(encodeURIComponent).join('/');
  const content = await githubGet<ApiContent | ApiContent[]>(
    token,
    `/repos/${repo}/contents/${encoded}`
  );
  return content
    ? { ok: true, text: contentText(content, repo as string, path ?? '') }
    : { ok: false, error: NOT_SHARED(`${repo}/${path ?? ''}`) };
}
