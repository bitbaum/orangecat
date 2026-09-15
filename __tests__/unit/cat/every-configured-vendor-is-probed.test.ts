/**
 * A vendor the health report cannot see is a vendor no alert can mention.
 *
 * `probes` was exactly `{ groq, openrouter }` — a shape fixed when those were
 * the only two links — and `ProbeResult.provider` was the closed union
 * `'groq' | 'openrouter'`. Gemini then joined the chain (#1034) and was
 * invisible to every check: it could have failed completely while the report
 * said "Cat is healthy" about the other two.
 *
 * The sharper half is `catCanAnswer`, which read:
 *
 *     groqUsable || openrouter.class === 'ok'
 *
 * OpenRouter's unpaid tier is 50 requests a day for an account shared by ten
 * apps, so it exhausts most days. The first time that happened with Gemini
 * configured, this would have raised CAT_CANNOT_ANSWER — the loudest alert
 * there is — while Gemini answered every turn.
 *
 * ── WHY THESE DRIVE runCatHealthProbes AND NOT classifyHealth ────────────────
 * The first version of this file did the opposite: it hand-built a report with
 * `google` already in `probes` and asserted classifyHealth handled it. Every
 * mutation of the actual fix — dropping vendor probes from the report, removing
 * the free vendor from catCanAnswer, replacing the derived vendor list with an
 * empty one — left all six tests GREEN. They were testing a function that was
 * already correct, and asserting on source strings that survived the edits.
 *
 * So these mock `fetch` and run the real probe assembly. The assertion is on
 * the report the app would actually produce.
 */
import { runCatHealthProbes } from '@/services/cat/health-probes';
import { classifyHealth } from '@/services/cat/health-alert';

const ORIGINAL_ENV = { ...process.env };
const realFetch = global.fetch;

/**
 * Answer every endpoint the probe run touches, per host, with a chosen outcome.
 * `429` stands in for an exhausted daily allowance.
 */
function serve(outcome: Record<string, 'ok' | 429 | 500>) {
  // Routed by exact HOSTNAME, not by substring.
  //
  // The first version used `url.includes('groq.com')`, which CodeQL failed as a
  // high-severity "incomplete URL substring sanitization" — and it was right on
  // the merits, not just by the rule: a URL like
  // `https://evil.test/?x=api.groq.com` matches that check, so the mock would
  // have routed on a path or query string. Harmless in a fixture, wrong
  // everywhere, and not worth teaching by example.
  const VENDOR_BY_HOST: Record<string, string> = {
    'api.groq.com': 'groq',
    'openrouter.ai': 'openrouter',
    'generativelanguage.googleapis.com': 'google',
  };

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const host = VENDOR_BY_HOST[new URL(url).hostname] ?? 'other';

    // Catalogue reads (GET /models) answer UNREADABLE on purpose.
    //
    // A fake list would have to contain every pinned id or the rot check calls
    // them all retired — which is exactly what happened on the first run here:
    // CAT_MODEL_ROT outranked the verdict under test. An unreadable catalogue
    // is the honest stand-in, because ai-kit's three-state rule reads it as
    // "could not look" rather than "nothing is there", so no rot is invented.
    if (url.endsWith('/models')) {
      return { ok: false, status: 500, json: async () => ({}) } as unknown as Response;
    }

    const want = outcome[host] ?? 500;
    if (want === 'ok') {
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
      } as unknown as Response;
    }
    return {
      ok: false,
      status: want,
      json: async () => ({ error: { message: want === 429 ? 'rate limit' : 'boom' } }),
    } as unknown as Response;
  });
}

beforeEach(() => {
  process.env.GROQ_API_KEY = 'gsk_test';
  process.env.OPENROUTER_API_KEY = 'sk-or-test';
  process.env.GEMINI_API_KEY = 'gem-test';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = realFetch;
});

describe('every configured vendor reaches the report', () => {
  it('probes the free vendor and puts it in `probes`', async () => {
    global.fetch = serve({ groq: 'ok', openrouter: 'ok', google: 'ok' }) as unknown as typeof fetch;
    const report = await runCatHealthProbes();

    // The whole point: a vendor absent here can never be mentioned by an alert.
    expect(Object.keys(report.probes)).toContain('google');
    expect(report.probes.google?.configured).toBe(true);
    expect(report.probes.google?.class).toBe('ok');
  });

  it('does NOT probe a vendor whose key is absent', async () => {
    delete process.env.GEMINI_API_KEY;
    global.fetch = serve({ groq: 'ok', openrouter: 'ok' }) as unknown as typeof fetch;
    const report = await runCatHealthProbes();

    expect(Object.keys(report.probes)).not.toContain('google');
  });

  it('says Cat CAN answer when only the free vendor is serving', async () => {
    // The false CAT_CANNOT_ANSWER this change exists to prevent: Groq down,
    // OpenRouter's daily allowance spent, Gemini answering every turn.
    global.fetch = serve({ groq: 500, openrouter: 429, google: 'ok' }) as unknown as typeof fetch;
    const report = await runCatHealthProbes();

    expect(report.catCanAnswer).toBe(true);
    const verdict = classifyHealth(report);
    expect(verdict.alert && verdict.code).not.toBe('CAT_CANNOT_ANSWER');
  });

  it('still says Cat CANNOT answer when every vendor is down', async () => {
    // The alert must survive the fix — widening the probe set must not mute it.
    global.fetch = serve({ groq: 500, openrouter: 429, google: 429 }) as unknown as typeof fetch;
    const report = await runCatHealthProbes();

    expect(report.catCanAnswer).toBe(false);
    const verdict = classifyHealth(report);
    expect(verdict.alert).toBe(true);
    expect(verdict.alert && verdict.code).toBe('CAT_CANNOT_ANSWER');
  });

  it('counts the free vendor as redundancy, so a spent OpenRouter is not "one vendor left"', async () => {
    global.fetch = serve({ groq: 'ok', openrouter: 429, google: 'ok' }) as unknown as typeof fetch;
    const report = await runCatHealthProbes();

    const verdict = classifyHealth(report);
    expect(verdict.alert && verdict.code).not.toBe('CAT_NO_VENDOR_REDUNDANCY');
  });

  it('reports redundancy lost when the free vendor is ALSO spent', async () => {
    global.fetch = serve({ groq: 'ok', openrouter: 429, google: 429 }) as unknown as typeof fetch;
    const report = await runCatHealthProbes();

    const verdict = classifyHealth(report);
    expect(verdict.alert).toBe(true);
    expect(verdict.alert && verdict.code).toBe('CAT_NO_VENDOR_REDUNDANCY');
    expect(verdict.detail).toContain('google');
  });
});
