/**
 * A bot's own browser, over the Loki rail — what a step may be and what the
 * thread keeps.
 *
 * Nothing is sent for a step that cannot be one; whose browser is the
 * server's to say; a step Loki stopped is its sentence, not a success; and
 * the page comes back as a picture plus words a model without eyes can act on.
 */
import { lokiFindingHandlers } from '@/services/cat/handlers/loki-findings';
import { browserAction, browserMessage, viewLines } from '@/services/loki/browser';
import type { AnySupabaseClient } from '@/lib/supabase/types';

const SECRET = 'x'.repeat(48);
const ACTOR = '00000000-0000-4000-8000-000000000000';
const BOT = '11111111-1111-4111-8111-111111111111';
const SHOT = 'https://loki.orangecat.ch/api/orangecat/shot/0123456789abcdef0123456789abcdef';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const VIEW = {
  url: 'https://example.com/',
  title: 'Example',
  text: 'Example Domain\nMore information',
  elements: [
    { n: 1, kind: 'link', name: 'More information' },
    { n: 2, kind: 'field:search', name: 'Search' },
  ],
  screenshotUrl: SHOT,
};

const realEnv = { ...process.env };
beforeEach(() => {
  process.env.ORANGECAT_WEBHOOK_SECRET = SECRET;
});
afterEach(() => {
  process.env = { ...realEnv };
  vi.restoreAllMocks();
});

describe('what a step may be', () => {
  it('opens only a full address', () => {
    expect(browserAction({ do: 'open', url: 'example.com' }).ok).toBe(false);
    expect(browserAction({ do: 'open', url: 'javascript:alert(1)' }).ok).toBe(false);
    expect(browserAction({ do: 'open', url: 'https://example.com' })).toEqual({
      ok: true,
      action: { do: 'open', url: 'https://example.com' },
    });
  });

  it('clicks by number or by words, types into a numbered field', () => {
    expect(browserAction({ do: 'click' }).ok).toBe(false);
    expect(browserAction({ do: 'click', n: '3' })).toEqual({
      ok: true,
      action: { do: 'click', n: 3 },
    });
    expect(browserAction({ do: 'click', label: 'Sign in' })).toEqual({
      ok: true,
      action: { do: 'click', label: 'Sign in' },
    });
    expect(browserAction({ do: 'type', n: 2 }).ok).toBe(false);
    expect(browserAction({ do: 'type', n: 2, text: 'cats', submit: 'true' })).toEqual({
      ok: true,
      action: { do: 'type', text: 'cats', n: 2, submit: true },
    });
  });

  it('knows its keys and its directions, and nothing else', () => {
    expect(browserAction({ do: 'press', key: 'enter' })).toEqual({
      ok: true,
      action: { do: 'press', key: 'Enter' },
    });
    expect(browserAction({ do: 'press', key: 'F12' }).ok).toBe(false);
    expect(browserAction({ do: 'scroll' })).toEqual({
      ok: true,
      action: { do: 'scroll', by: 'down' },
    });
    expect(browserAction({ do: 'eval', code: '1' }).ok).toBe(false);
  });
});

describe('use_browser', () => {
  it('sends nothing for a step that cannot be one', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const res = await lokiFindingHandlers.use_browser({} as AnySupabaseClient, 'u', ACTOR, {
      do: 'open',
    });
    expect(res.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("drives the bot's own browser and keeps the page in the thread", async () => {
    let sent: Record<string, unknown> = {};
    let calledUrl = '';
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      calledUrl = String(url);
      sent = JSON.parse(String((init as RequestInit).body));
      return jsonResponse(200, { ok: true, done: true, closed: false, view: VIEW });
    });
    const res = await lokiFindingHandlers.use_browser({} as AnySupabaseClient, 'u', ACTOR, {
      do: 'open',
      url: 'https://example.com',
      bot_id: BOT,
    });
    expect(calledUrl).toContain('/api/orangecat/browser');
    expect(sent.botId).toBe(BOT);
    expect(sent.action).toEqual({ do: 'open', url: 'https://example.com' });
    expect(res.success).toBe(true);
    const data = res.data as Record<string, unknown>;
    const message = String(data.displayMessage);
    expect(message).toContain(`![The page](${SHOT})`);
    expect(message).toContain('Now on: “Example” https://example.com/');
    expect(message).toContain('1 link “More information”; 2 field:search “Search”');
    // outcomeLine adds an "Open" link for data.url: the page is not ours to open.
    expect(data.url).toBeUndefined();
  });

  it("uses the person's own browser when no bot is named (the Cat)", async () => {
    let sent: Record<string, unknown> = {};
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      sent = JSON.parse(String((init as RequestInit).body));
      return jsonResponse(200, { ok: true, done: true, closed: true });
    });
    const res = await lokiFindingHandlers.use_browser({} as AnySupabaseClient, 'u', ACTOR, {
      do: 'close',
      bot_id: 'not-a-uuid',
    });
    expect(sent.botId).toBe(ACTOR);
    expect((res.data as { displayMessage: string }).displayMessage).toBe('The browser is closed.');
  });

  it('reports a stopped step as its sentence, with the page it stopped on', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        done: false,
        reason: 'stopped',
        detail: 'This field takes a password. Stopped here; nothing was typed.',
        view: VIEW,
      })
    );
    const res = await lokiFindingHandlers.use_browser({} as AnySupabaseClient, 'u', ACTOR, {
      do: 'type',
      n: 2,
      text: 'hunter2',
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Stopped here; nothing was typed.');
    expect(res.error).toContain('Now on:');
  });

  it("says Loki's own sentence when it refuses, and never invents a page", async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(409, { detail: 'Sign in to Loki once.' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const a = await lokiFindingHandlers.use_browser({} as AnySupabaseClient, 'u', ACTOR, {
      do: 'look',
    });
    expect(a.error).toBe('The browser did not take that step: Sign in to Loki once.');
    const b = await lokiFindingHandlers.use_browser({} as AnySupabaseClient, 'u', ACTOR, {
      do: 'look',
    });
    expect(b.success).toBe(false);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('the page as lines', () => {
  it('shows a picture only from an https address, and trims a long page', () => {
    const lines = viewLines({ ...VIEW, screenshotUrl: undefined, text: 'x'.repeat(2000) });
    expect(lines.join('\n')).not.toContain('![');
    expect(lines.find(l => l.startsWith('It says:'))!.length).toBeLessThan(760);
    expect(browserMessage({ ok: true, done: true, closed: true })).toBe('The browser is closed.');
  });
});
