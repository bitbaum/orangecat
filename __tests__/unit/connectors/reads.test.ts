import { describe, expect, it } from 'vitest';
import { CAT_ACTIONS } from '@/config/cat-actions';
import { CAT_CONNECTIONS } from '@/config/cat-connections';
import {
  FILE_MAX_CHARS,
  contentText,
  issuesText,
  parseGitHubRead,
  pullsText,
  reposText,
} from '@/services/connectors/github-read';
import {
  CALENDAR_DAYS_MAX,
  MAIL_BODY_MAX_CHARS,
  calendarDays,
  calendarText,
  mailBody,
  mailListText,
  mailMessageText,
} from '@/services/connectors/google-read';
import {
  CONNECTOR_HANDS,
  CONNECTOR_HAND_PROVIDER,
  isConnectorHand,
} from '@/services/connectors/hands';
import { canRunOnItsOwn } from '@/services/companions/hand-grants';
import { COMPANION_HANDS } from '@/services/companions/hands';
import { needsReview } from '@/services/companions/rules';
import {
  GOOGLE_SCOPES,
  googleAuthorizeUrl,
  missingGoogleScopes,
  parseGoogleTokenResponse,
} from '@/services/google/connection';
import { decideGoogleReturn } from '@/app/api/integrations/google/state';

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64url');

/**
 * Reading a connected account. What is pinned: every connector hand only
 * reads, is a registered action a bot holds and a connection names, and
 * what comes back is cut to a size a model can be handed.
 */
describe('connector hands', () => {
  it('are registered actions, held by bots, named by a connection, with a provider each', () => {
    const ids = Object.keys(CONNECTOR_HANDS);
    expect(ids.sort()).toEqual(['calendar_read', 'github_read', 'gmail_read']);
    const named = CAT_CONNECTIONS.flatMap(c => c.actions);
    for (const id of ids) {
      expect(CAT_ACTIONS[id]?.enabled, id).toBe(true);
      expect(CAT_ACTIONS[id].riskLevel, id).toBe('low');
      expect(CAT_ACTIONS[id].description, id).toMatch(/Read-only/);
      expect(COMPANION_HANDS, id).toContain(id);
      expect(named, id).toContain(id);
      expect(CONNECTOR_HAND_PROVIDER[id], id).toBeTruthy();
      expect(isConnectorHand(id)).toBe(true);
    }
    expect(isConnectorHand('send_payment')).toBe(false);
  });

  it('only read, so a bot may run them on its own and no rule needs checking first', () => {
    for (const id of Object.keys(CONNECTOR_HANDS)) {
      expect(canRunOnItsOwn(id), id).toBe(true);
      expect(needsReview(id, {}), id).toBe(false);
    }
    // What makes something on OrangeCat still always waits for a tap.
    expect(canRunOnItsOwn('create_event')).toBe(false);
  });

  it('say the account is not connected instead of guessing', async () => {
    // No keys in the test environment: nothing is configured, so nothing is connected.
    const out = await CONNECTOR_HANDS.gmail_read('u1', {});
    expect(out.success).toBe(false);
    expect(out.error).toMatch(/not connected/);
    const bad = await CONNECTOR_HANDS.github_read('u1', { what: 'everything' });
    expect(bad.success).toBe(false);
    expect(bad.error).toMatch(/repos, issues, pulls, file/);
  });
});

describe('a GitHub read', () => {
  it('takes one of four kinds, and a repository where one is needed', () => {
    expect(parseGitHubRead({ what: 'repos' })).toEqual({ ok: true, request: { what: 'repos' } });
    expect(parseGitHubRead({ what: 'Issues', repo: 'bitbaum/loki' })).toEqual({
      ok: true,
      request: { what: 'issues', repo: 'bitbaum/loki' },
    });
    expect(parseGitHubRead({ what: 'pulls' }).ok).toBe(false);
    expect(parseGitHubRead({ what: 'file', path: 'README.md' }).ok).toBe(false);
    expect(parseGitHubRead({ what: 'delete' }).ok).toBe(false);
  });

  it('refuses a repository or a path that is not one', () => {
    expect(parseGitHubRead({ what: 'issues', repo: 'bitbaum/loki/../../x' }).ok).toBe(false);
    expect(parseGitHubRead({ what: 'issues', repo: 'bitbaum' }).ok).toBe(false);
    expect(parseGitHubRead({ what: 'file', repo: 'a/b', path: '../secrets' }).ok).toBe(false);
    expect(parseGitHubRead({ what: 'file', repo: 'a/b', path: '/src/x.ts' })).toEqual({
      ok: true,
      request: { what: 'file', repo: 'a/b', path: 'src/x.ts' },
    });
  });

  it('writes lists a person can read, marking private work and pull requests', () => {
    expect(
      reposText([
        {
          full_name: 'a/b',
          description: 'A thing',
          private: true,
          archived: false,
          pushed_at: '2026-11-12T10:00:00Z',
        },
      ])
    ).toMatch(/a\/b \(private\): A thing · pushed 2026-11-12/);
    expect(reposText([])).toMatch(/No repositories/);
    const issues = issuesText([
      {
        number: 7,
        title: 'Fix it',
        html_url: 'https://github.com/a/b/pull/7',
        updated_at: '2026-11-13T00:00:00Z',
        pull_request: {},
        repository: { full_name: 'a/b' },
      },
    ]);
    expect(issues).toMatch(/PR #7 in a\/b: Fix it/);
    expect(issuesText([], 'a/b')).toBe('No open issues in a/b.');
    expect(
      pullsText(
        [
          {
            number: 3,
            title: 'Add x',
            html_url: 'u',
            draft: true,
            user: { login: 'kim' },
            updated_at: '2026-11-13T00:00:00Z',
          },
        ],
        'a/b'
      )
    ).toMatch(/#3 \(draft\): Add x · by kim/);
  });

  it('reads a file as text, cuts a long one, lists a folder, refuses a binary', () => {
    expect(
      contentText({ type: 'file', encoding: 'base64', content: b64('hello\n') }, 'a/b', 'x.md')
    ).toBe('a/b/x.md:\n\nhello\n');
    const long = contentText(
      { type: 'file', encoding: 'base64', content: b64('x'.repeat(FILE_MAX_CHARS + 50)) },
      'a/b',
      'big.txt'
    );
    expect(long).toMatch(new RegExp(`first ${FILE_MAX_CHARS} of ${FILE_MAX_CHARS + 50}`));
    expect(long.length).toBeLessThan(FILE_MAX_CHARS + 200);
    expect(
      contentText(
        [
          { name: 'src', type: 'dir' },
          { name: 'README.md', type: 'file' },
        ],
        'a/b',
        ''
      )
    ).toMatch(/- src\/\n- README\.md/);
    expect(
      contentText({ type: 'file', encoding: 'base64', content: b64('a\u0000b') }, 'a/b', 'x.png')
    ).toMatch(/not a text file/);
  });
});

describe('a mail read', () => {
  const message = {
    id: 'abc123def',
    snippet: 'See you Friday',
    labelIds: ['UNREAD'],
    payload: {
      mimeType: 'multipart/alternative',
      headers: [
        { name: 'From', value: 'Ana <ana@example.com>' },
        { name: 'To', value: 'me@example.com' },
        { name: 'Subject', value: 'Friday' },
        { name: 'Date', value: 'Thu, 12 Nov 2026 10:00:00 +0100' },
      ],
      parts: [
        { mimeType: 'text/html', body: { data: b64url('<p>See <b>you</b> Friday</p>') } },
        { mimeType: 'text/plain', body: { data: b64url('See you Friday\n') } },
      ],
    },
  };

  it('lists who, what and when, with the id a message is read by', () => {
    const text = mailListText([message], 'from:ana');
    expect(text).toMatch(/1 messages for "from:ana"/);
    expect(text).toMatch(/Ana <ana@example.com> · Friday · unread · id abc123def/);
    expect(mailListText([], 'x')).toBe('No mail matches "x".');
  });

  it('reads the plain part, falls back to the HTML without its tags, and cuts a long body', () => {
    expect(mailBody(message.payload)).toBe('See you Friday');
    expect(
      mailBody({
        mimeType: 'text/html',
        body: { data: b64url('<style>p{}</style><p>Hi&nbsp;there</p>') },
      })
    ).toBe('Hi there');
    expect(mailMessageText(message)).toMatch(/^From: Ana .*\nTo: me@example.com\n/);
    const long = mailMessageText({
      id: 'x',
      payload: { mimeType: 'text/plain', body: { data: b64url('y'.repeat(9000)) } },
    });
    expect(long).toMatch(/the message is longer/);
    expect(long.length).toBeLessThan(MAIL_BODY_MAX_CHARS + 200);
  });
});

describe('a calendar read', () => {
  it('looks a week ahead unless told, and never more than a month', () => {
    expect(calendarDays(undefined)).toBe(7);
    expect(calendarDays('3')).toBe(3);
    expect(calendarDays(0)).toBe(7);
    expect(calendarDays(400)).toBe(CALENDAR_DAYS_MAX);
  });

  it('lists what is on, without what was cancelled', () => {
    const text = calendarText(
      [
        {
          summary: 'Dentist',
          location: 'Chur',
          start: { dateTime: '2026-11-16T09:00:00+01:00' },
          end: { dateTime: '2026-11-16T09:30:00+01:00' },
          attendees: [{ email: 'me@example.com', self: true }, { email: 'dr@example.com' }],
        },
        { summary: 'Gone', status: 'cancelled', start: { date: '2026-11-17' } },
        { summary: 'Holiday', start: { date: '2026-11-18' } },
      ],
      7
    );
    expect(text).toMatch(/^2 events in the next 7 days:/);
    expect(text).toMatch(/Dentist · Chur · with 1 other/);
    expect(text).toMatch(/2026-11-18 \(all day\) · Holiday/);
    expect(text).not.toMatch(/Gone/);
    expect(calendarText([], 1)).toBe('Nothing in your calendar for the next day.');
  });
});

describe('connecting Google', () => {
  it('asks for mail and calendar read-only, offline, and nothing else', () => {
    const url = new URL(googleAuthorizeUrl('s1'));
    expect(url.searchParams.get('scope')).toBe(GOOGLE_SCOPES.join(' '));
    for (const scope of GOOGLE_SCOPES) {
      expect(scope).toMatch(/\.readonly$/);
    }
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('state')).toBe('s1');
    expect(url.searchParams.get('redirect_uri')).toMatch(/\/api\/integrations\/google\/callback$/);
  });

  it('reads a token answer, and a refusal as a refusal', () => {
    const t = parseGoogleTokenResponse(
      { access_token: 'a', expires_in: 3599, refresh_token: 'r', scope: GOOGLE_SCOPES.join(' ') },
      0
    );
    expect(t?.accessExpiresAt?.getTime()).toBe(3_599_000);
    expect(t?.refreshToken).toBe('r');
    expect(missingGoogleScopes(t?.scopes ?? [])).toEqual([]);
    expect(parseGoogleTokenResponse({ error: 'invalid_grant' })).toBeNull();
    // A refresh answers without a refresh token; the stored one is kept by the caller.
    expect(
      parseGoogleTokenResponse({ access_token: 'a', expires_in: 10 })?.refreshToken
    ).toBeNull();
    expect(missingGoogleScopes([GOOGLE_SCOPES[0]])).toEqual([GOOGLE_SCOPES[1]]);
  });

  it('exchanges a code only when it comes back with the state we set', () => {
    const base = { error: null, state: 'abc', cookieState: 'abc', code: 'c' };
    expect(decideGoogleReturn(base)).toBe('exchange');
    expect(decideGoogleReturn({ ...base, error: 'access_denied' })).toBe('denied');
    expect(decideGoogleReturn({ ...base, state: 'abd' })).toBe('failed');
    expect(decideGoogleReturn({ ...base, state: null })).toBe('failed');
    expect(decideGoogleReturn({ ...base, cookieState: undefined })).toBe('failed');
    expect(decideGoogleReturn({ ...base, code: null })).toBe('failed');
  });
});
