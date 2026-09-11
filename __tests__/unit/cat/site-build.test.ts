/**
 * Commissioning a build — the honesty, and the signature.
 *
 * Two properties carry this feature, and both fail silently if wrong.
 *
 * The signature must cover the EXACT bytes sent. Sign a re-serialised object
 * and the receiver says "invalid signature" while the sender is certain the
 * secret is right — a whole afternoon of suspecting the one thing that was
 * fine.
 *
 * And nothing may report a site that does not exist. FleetCrown answers 202:
 * QUEUED. There is no moment in the turn when a site is up, so every sentence
 * that reaches the model has to say a build was started. This repo has already
 * paid for the opposite — an action that logged `completed` while one of two
 * stores was untouched.
 */
import { createHmac } from 'crypto';
import {
  postSignedToFleetCrown,
  fleetCrownRailConfigured,
} from '@/services/fleetcrown/signed-post';
import { requestFleetCrownSite, slugFromTitle } from '@/services/fleetcrown/site-build';
import { siteBuildHandlers } from '@/services/cat/handlers/site-build';
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

describe('the signed rail', () => {
  it('signs exactly the bytes it sends', async () => {
    let sentBody = '';
    let sentSig = '';
    const fetchImpl = vi.fn(async (_url: unknown, init: unknown) => {
      const req = init as { body: string; headers: Record<string, string> };
      sentBody = req.body;
      sentSig = req.headers['x-orangecat-signature'];
      return jsonResponse(200, { ok: true });
    }) as unknown as typeof fetch;

    await postSignedToFleetCrown(
      'https://fc.example/x',
      { b: 2, a: 1 },
      { fetchImpl, secret: SECRET }
    );

    // Recomputing over the transmitted body must reproduce the header. If the
    // payload were serialised twice, key order or number formatting could
    // differ by a byte and this would not match.
    const expected = 'sha256=' + createHmac('sha256', SECRET).update(sentBody).digest('hex');
    expect(sentSig).toBe(expected);
  });

  it('is inert, and honest, when the rail is not configured', async () => {
    delete process.env.ORANGECAT_WEBHOOK_SECRET;
    expect(fleetCrownRailConfigured(undefined)).toBe(false);

    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const result = await postSignedToFleetCrown('https://fc.example/x', {}, { fetchImpl });

    expect(result.ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('hands back the receiver’s own body, not a paraphrase', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(409, {
        error: 'no linked FleetCrown account',
        detail: 'Sign in once, then retry.',
      })
    ) as unknown as typeof fetch;

    const result = await postSignedToFleetCrown(
      'https://fc.example/x',
      {},
      { fetchImpl, secret: SECRET }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.body).toContain('Sign in once');
    }
  });

  it('never throws, whatever the transport does', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('socket exploded');
    }) as unknown as typeof fetch;

    const result = await postSignedToFleetCrown(
      'https://fc.example/x',
      {},
      { fetchImpl, secret: SECRET }
    );
    expect(result.ok).toBe(false);
  });
});

describe('requesting a site', () => {
  it('refuses an impossible subdomain before calling anything', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    for (const slug of ['Not A Slug', '-leading', 'trailing-', '', 'under_score', 'a'.repeat(64)]) {
      const outcome = await requestFleetCrownSite({ actorId: ACTOR, slug, title: 'X' });
      expect(outcome.ok).toBe(false);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('accepts everything the factory accepts, and no less', async () => {
    // The local check is UX, so being stricter than the authority is a bug:
    // it refuses slugs FleetCrown would take and the capability looks broken.
    // A single character and a 63-character label are both legal there.
    // mockImplementation, not mockResolvedValue: a Response body can be read
    // exactly ONCE, so a single shared Response makes every call after the
    // first see an empty body — which here looked like a slug being rejected.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      jsonResponse(202, {
        ok: true,
        commandId: 'c',
        host: 'h.orangecat.ch',
        url: 'https://h.orangecat.ch',
      })
    );
    for (const slug of ['a', 'a1', 'a-b-c', 'a'.repeat(63)]) {
      const outcome = await requestFleetCrownSite({ actorId: ACTOR, slug, title: 'X' });
      expect(outcome.ok).toBe(true);
    }
  });

  it('surfaces the receiver’s sentence verbatim, because it names the next step', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(409, {
        error: 'no linked FleetCrown account',
        detail:
          'This OrangeCat identity is not linked to a FleetCrown account yet. Sign in to FleetCrown with the same OrangeCat identity once, then try again.',
      })
    );

    const outcome = await requestFleetCrownSite({
      actorId: ACTOR,
      slug: 'kraftwerk',
      title: 'Kraftwerk',
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toMatch(/NOT started/);
      expect(outcome.reason).toMatch(/Sign in to FleetCrown/);
    }
  });

  it('does NOT report success when a 2xx body cannot be read', async () => {
    // Between "it worked" and "it failed" is exactly the state an agent must
    // not paper over: something may be building and we cannot say what.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>gateway</html>', {
        status: 202,
        headers: { 'content-type': 'text/html' },
      })
    );

    const outcome = await requestFleetCrownSite({
      actorId: ACTOR,
      slug: 'kraftwerk',
      title: 'Kraftwerk',
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toMatch(/unclear whether a build started/i);
    }
  });

  it('returns the host, url and command id on a queued build', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(202, {
        ok: true,
        commandId: 'cmd-1',
        host: 'kraftwerk.orangecat.ch',
        url: 'https://kraftwerk.orangecat.ch',
        status: 'unverified',
      })
    );

    const outcome = await requestFleetCrownSite({
      actorId: ACTOR,
      slug: 'kraftwerk',
      title: 'Kraftwerk',
    });

    expect(outcome).toEqual({
      ok: true,
      host: 'kraftwerk.orangecat.ch',
      url: 'https://kraftwerk.orangecat.ch',
      commandId: 'cmd-1',
    });
  });
});

describe('slug derivation', () => {
  it('turns a title into a usable subdomain', () => {
    expect(slugFromTitle('Kraftwerk Café & Bar')).toBe('kraftwerk-cafe-bar');
    expect(slugFromTitle('  Hello   World  ')).toBe('hello-world');
    expect(slugFromTitle('Zürich Makers')).toBe('zurich-makers');
  });

  it('never leaves a trailing hyphen, even after truncation', () => {
    const slug = slugFromTitle('a'.repeat(40) + ' ' + 'b'.repeat(40));
    expect(slug).not.toMatch(/-$/);
    expect(slug.length).toBeLessThanOrEqual(42);
  });
});

describe('the action Cat runs', () => {
  const supabase = {} as AnySupabaseClient;

  it('says a build STARTED, never that a site is ready', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(202, {
        ok: true,
        commandId: 'cmd-1',
        host: 'kraftwerk.orangecat.ch',
        url: 'https://kraftwerk.orangecat.ch',
      })
    );

    const handler = siteBuildHandlers.build_site!;
    const result = await handler(supabase, 'user-1', ACTOR, {
      slug: 'kraftwerk',
      title: 'Kraftwerk',
    });

    expect(result.success).toBe(true);
    const status = (result.data as { status: string }).status;
    expect(status).toMatch(/STARTED/);
    expect(status).toMatch(/NOT up yet/);
    // The model must not be invited to describe a site with no content.
    expect(status).toMatch(/do not describe any content/i);
  });

  it('derives the subdomain from the title when the model did not supply one', async () => {
    let sentSlug = '';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: unknown, init: unknown) => {
      sentSlug = JSON.parse((init as { body: string }).body).slug;
      return jsonResponse(202, {
        ok: true,
        commandId: 'c',
        host: `${sentSlug}.orangecat.ch`,
        url: `https://${sentSlug}.orangecat.ch`,
      });
    });

    const handler = siteBuildHandlers.build_site!;
    await handler(supabase, 'user-1', ACTOR, { title: 'Kraftwerk Café' });

    expect(sentSlug).toBe('kraftwerk-cafe');
  });

  it('refuses without a title rather than inventing one', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const handler = siteBuildHandlers.build_site!;
    const result = await handler(supabase, 'user-1', ACTOR, { slug: 'kraftwerk' });

    expect(result.success).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
