/**
 * A bot walks a live site through Loki's browser — what it may say.
 *
 * Nothing is opened without a full address, a walk is a few pages, the
 * words are Loki's own facts, and an unreadable answer is never reported as
 * a walk. Read-only: it files nothing.
 */
import { lokiFindingHandlers } from '@/services/cat/handlers/loki-findings';
import {
  parseWalkPhrases,
  parseWalkUrls,
  siteWalkMessage,
  walkSiteWithLoki,
  SITE_WALK_MAX_PAGES,
} from '@/services/loki/site-walk';
import type { AnySupabaseClient } from '@/lib/supabase/types';

const SECRET = 'x'.repeat(48);
const ACTOR = '00000000-0000-4000-8000-000000000000';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const realEnv = { ...process.env };
beforeEach(() => {
  process.env.ORANGECAT_WEBHOOK_SECRET = SECRET;
});
afterEach(() => {
  process.env = { ...realEnv };
  vi.restoreAllMocks();
});

describe('what a bot names', () => {
  it('keeps full addresses, in order, once each', () => {
    expect(
      parseWalkUrls(
        'https://orangecat.ch, orangecat.ch/discover\nhttps://orangecat.ch https://a.test/x'
      )
    ).toEqual(['https://orangecat.ch', 'https://a.test/x']);
    expect(parseWalkUrls(['https://a.test', 7, 'javascript:alert(1)'])).toEqual(['https://a.test']);
    expect(parseWalkUrls(undefined)).toEqual([]);
  });

  it('reads the phrases every page must show', () => {
    expect(parseWalkPhrases(' Sign in ; ; Get started\nPricing')).toEqual([
      'Sign in',
      'Get started',
      'Pricing',
    ]);
    expect(parseWalkPhrases(undefined)).toEqual([]);
  });
});

describe('walkSiteWithLoki', () => {
  it('opens nothing without a page, or with too many', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect((await walkSiteWithLoki({ actorId: ACTOR, urls: [] })).ok).toBe(false);
    const many = Array.from({ length: SITE_WALK_MAX_PAGES + 1 }, (_, i) => `https://a.test/${i}`);
    const res = await walkSiteWithLoki({ actorId: ACTOR, urls: many });
    expect(res.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends each page with the phrases and reports what Loki found, with the picture of a failed page', async () => {
    let sent: Record<string, unknown> = {};
    let calledUrl = '';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      calledUrl = String(url);
      sent = JSON.parse(String((init as RequestInit).body));
      return jsonResponse(200, {
        ok: true,
        passed: false,
        steps: [
          { url: 'https://orangecat.ch/', ok: true, title: 'OrangeCat', problems: [] },
          {
            url: 'https://orangecat.ch/discover',
            ok: false,
            title: 'Discover',
            problems: ['The page scrolls sideways on a phone: it is 512px wide on a 390px screen.'],
            screenshotUrl:
              'https://loki.orangecat.ch/api/orangecat/shot/0123456789abcdef0123456789abcdef',
          },
        ],
      });
    });
    const res = await lokiFindingHandlers.walk_site({} as AnySupabaseClient, 'u', ACTOR, {
      urls: 'https://orangecat.ch/, https://orangecat.ch/discover',
      must_show: 'OrangeCat',
    });
    expect(calledUrl).toContain('/api/orangecat/site-walk');
    expect(sent.actorId).toBe(ACTOR);
    expect(sent.screenshots).toBeUndefined();
    expect(sent.steps).toEqual([
      { url: 'https://orangecat.ch/', expect: ['OrangeCat'] },
      { url: 'https://orangecat.ch/discover', expect: ['OrangeCat'] },
    ]);
    expect(res.success).toBe(true);
    const data = res.data as { passed: boolean; displayMessage: string; steps: unknown[] };
    expect(data.passed).toBe(false);
    expect(data.displayMessage).toContain('1 has problems');
    expect(data.displayMessage).toContain('512px wide on a 390px screen');
    expect(data.displayMessage).toContain('Nothing was filed');
    // The picture of the failed page rides into the thread as an address.
    expect(data.displayMessage).toContain(
      '![https://orangecat.ch/discover at phone size](https://loki.orangecat.ch/api/orangecat/shot/0123456789abcdef0123456789abcdef)'
    );
  });

  it("says Loki's own sentence when it refuses", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(409, { error: 'no linked Loki account', detail: 'Sign in to Loki once.' })
    );
    const res = await walkSiteWithLoki({ actorId: ACTOR, urls: ['https://a.test'] });
    expect(res).toEqual({ ok: false, reason: 'No page was walked: Sign in to Loki once.' });
  });

  it('never reports a walk it cannot read', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { ok: true, steps: 'x' }));
    const res = await walkSiteWithLoki({ actorId: ACTOR, urls: ['https://a.test'] });
    expect(res.ok).toBe(false);
  });
});

describe('the lines the thread keeps', () => {
  it('says a clean walk is not a full test', () => {
    const text = siteWalkMessage({
      ok: true,
      passed: true,
      steps: [{ url: 'https://a.test/', ok: true, title: 'A', problems: [] }],
    });
    expect(text).toContain('nothing wrong found');
    expect(text).toContain('not a full test');
  });
});
