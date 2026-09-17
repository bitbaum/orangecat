// @vitest-environment jsdom
/**
 * Website analysis — the safe fetcher behind the Cat's analyze_website tool.
 * Guards the SSRF rails (private-IP rejection, per-hop redirect re-validation,
 * size cap), the HTML→text extraction, and the tool/detection wiring.
 */
import {
  extractHttpUrls,
  isUrlOnlyMessage,
  normalizeToHttpUrl,
  resolveRequestedUrl,
  isPrivateAddress,
  validateTargetUrl,
  fetchWebsiteText,
  extractReadableText,
  type FetchLike,
  type FetchResponseLike,
  type LookupLike,
} from '@/services/cat/website-analysis';
import {
  PLATFORM_TOOL_DEFINITION,
  hasWebsiteAnalysisIntent,
  messageMightNeedTools,
} from '@/services/cat/tool-use-detection';

// ── Helpers ──────────────────────────────────────────────────────────────────

const publicLookup: LookupLike = async () => [{ address: '93.184.216.34' }];
const privateLookup: LookupLike = async () => [{ address: '10.0.0.5' }];

function htmlResponse(html: string, overrides: Partial<FetchResponseLike> = {}): FetchResponseLike {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null,
    },
    body: null,
    text: async () => html,
    ...overrides,
  };
}

function redirectResponse(location: string): FetchResponseLike {
  return {
    ok: false,
    status: 302,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'location' ? location : null),
    },
    body: null,
    text: async () => '',
  };
}

// ── URL extraction / message grounding ───────────────────────────────────────

describe('extractHttpUrls', () => {
  it('extracts http(s) URLs and strips trailing punctuation', () => {
    expect(extractHttpUrls('here is my site: https://example.com/shop.')).toEqual([
      'https://example.com/shop',
    ]);
  });

  it('normalizes www. hosts to https', () => {
    expect(extractHttpUrls('check www.example.com please')).toEqual(['https://www.example.com/']);
  });

  it('returns empty for messages without URLs', () => {
    expect(extractHttpUrls('I sell mugs and want to list them')).toEqual([]);
  });

  it('extracts a bare schemeless domain and normalizes it to https', () => {
    expect(extractHttpUrls('revampit.orangecat.ch')).toEqual(['https://revampit.orangecat.ch/']);
  });

  it('extracts a schemeless domain with a path mid-sentence', () => {
    expect(extractHttpUrls('my shop lives at mybakery.ch/shop these days')).toEqual([
      'https://mybakery.ch/shop',
    ]);
  });

  it('does not extract the domain of an email address', () => {
    expect(extractHttpUrls('mail me at g@revamp-it.ch please')).toEqual([]);
  });

  it('does not extract version numbers or abbreviations', () => {
    expect(extractHttpUrls('use version 3.5 e.g. for testing')).toEqual([]);
  });
});

describe('normalizeToHttpUrl', () => {
  it('prepends https:// to schemeless input', () => {
    expect(normalizeToHttpUrl('revampit.orangecat.ch')).toBe('https://revampit.orangecat.ch');
  });

  it('leaves schemed URLs untouched', () => {
    expect(normalizeToHttpUrl('http://example.com/a')).toBe('http://example.com/a');
    expect(normalizeToHttpUrl('https://example.com')).toBe('https://example.com');
  });
});

describe('isUrlOnlyMessage', () => {
  it.each([
    'revampit.orangecat.ch',
    '  revampit.orangecat.ch  ',
    'revampit.orangecat.ch.',
    'https://example.com',
    'www.example.com/shop',
  ])('is true when the message is nothing but a URL/domain: %s', msg => {
    expect(isUrlOnlyMessage(msg)).toBe(true);
  });

  it.each([
    'check out revampit.orangecat.ch please',
    'https://a.com and https://b.com',
    'hello there',
    '',
  ])('is false otherwise: %s', msg => {
    expect(isUrlOnlyMessage(msg)).toBe(false);
  });
});

describe('resolveRequestedUrl', () => {
  it('accepts a URL that appears in the message (modulo trailing slash/case)', () => {
    expect(
      resolveRequestedUrl('https://Example.com/shop/', 'my site: https://example.com/shop')
    ).toBe('https://example.com/shop');
  });

  it('falls back to the single message URL when the model paraphrased', () => {
    expect(resolveRequestedUrl('https://other.com', 'my site: https://example.com')).toBe(
      'https://example.com/'
    );
  });

  it('refuses when the message has no URL at all', () => {
    expect(resolveRequestedUrl('https://example.com', 'set me up please')).toBeNull();
  });

  it('accepts a schemeless model url against a schemeless message', () => {
    expect(resolveRequestedUrl('revampit.orangecat.ch', 'revampit.orangecat.ch')).toBe(
      'https://revampit.orangecat.ch/'
    );
  });

  it('refuses a non-matching URL when the message has several', () => {
    expect(
      resolveRequestedUrl('https://evil.com', 'compare https://a.com and https://b.com')
    ).toBeNull();
  });
});

// ── SSRF guards ──────────────────────────────────────────────────────────────

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.5',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254', // cloud metadata
    '100.64.0.1', // CGNAT
    '0.0.0.0',
    '198.18.0.1',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fe80::1',
    'fc00::1',
    'fd12:3456::1',
    '::ffff:10.0.0.1', // v4-mapped private
  ])('rejects %s as private', ip => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each([
    '93.184.216.34',
    '172.32.0.1',
    '8.8.8.8',
    '2606:2800:220:1:248:1893:25c8:1946',
    '::ffff:8.8.8.8',
  ])('allows public address %s', ip => {
    expect(isPrivateAddress(ip)).toBe(false);
  });

  it('treats malformed IPv4 as private (refuse rather than guess)', () => {
    expect(isPrivateAddress('999.1.1.1')).toBe(true);
  });
});

describe('validateTargetUrl', () => {
  it('rejects non-http(s) schemes', () => {
    expect(validateTargetUrl('ftp://example.com')).toMatchObject({ ok: false });
    expect(validateTargetUrl('javascript:alert(1)')).toMatchObject({ ok: false });
  });

  it('rejects non-standard ports', () => {
    expect(validateTargetUrl('http://example.com:8080')).toMatchObject({ ok: false });
  });

  it('rejects localhost and private IP literals', () => {
    expect(validateTargetUrl('http://localhost/admin')).toMatchObject({ ok: false });
    expect(validateTargetUrl('http://127.0.0.1/')).toMatchObject({ ok: false });
    expect(validateTargetUrl('http://192.168.1.1/')).toMatchObject({ ok: false });
    expect(validateTargetUrl('http://[::1]/')).toMatchObject({ ok: false });
  });

  it('accepts a plain https URL on a default port', () => {
    expect(validateTargetUrl('https://example.com/about')).toMatchObject({ ok: true });
    expect(validateTargetUrl('https://example.com:443/')).toMatchObject({ ok: true });
  });
});

describe('fetchWebsiteText SSRF rails', () => {
  it('rejects hosts that resolve to a private address without fetching', async () => {
    const fetchFn = vi.fn();
    const result = await fetchWebsiteText('https://internal.example.com', {
      fetchFn,
      lookupFn: privateLookup,
    });
    expect(result.ok).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('re-validates redirect hops and blocks a bounce to a private target', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(redirectResponse('http://127.0.0.1/steal'));
    const result = await fetchWebsiteText('https://example.com', {
      fetchFn,
      lookupFn: publicLookup,
    });
    expect(result.ok).toBe(false);
    expect(fetchFn).toHaveBeenCalledTimes(1); // the private hop was never fetched
  });

  it('re-resolves DNS on every redirect hop', async () => {
    const lookupFn = vi
      .fn()
      .mockResolvedValueOnce([{ address: '93.184.216.34' }]) // hop 0: public
      .mockResolvedValueOnce([{ address: '10.0.0.5' }]); // hop 1: private → block
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(redirectResponse('https://internal.example.com/'));
    const result = await fetchWebsiteText('https://example.com', { fetchFn, lookupFn });
    expect(result.ok).toBe(false);
    expect(lookupFn).toHaveBeenCalledTimes(2);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('gives up after 3 redirects', async () => {
    const fetchFn = vi.fn().mockResolvedValue(redirectResponse('https://example.com/next'));
    const result = await fetchWebsiteText('https://example.com', {
      fetchFn,
      lookupFn: publicLookup,
    });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('redirect') });
    expect(fetchFn).toHaveBeenCalledTimes(4); // initial + 3 allowed hops
  });

  it('rejects non-HTML content types', async () => {
    const fetchFn: FetchLike = async () =>
      htmlResponse('{}', {
        headers: {
          get: name => (name.toLowerCase() === 'content-type' ? 'application/json' : null),
        },
      });
    const result = await fetchWebsiteText('https://example.com/api', {
      fetchFn,
      lookupFn: publicLookup,
    });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('not an HTML page') });
  });

  it('caps a streamed body at 1.5MB', async () => {
    const chunk = new Uint8Array(Buffer.from('<p>' + 'a'.repeat(64 * 1024) + '</p>', 'utf8'));
    let reads = 0;
    let cancelled = false;
    const reader = {
      read: async () => {
        reads += 1;
        return { done: false, value: chunk };
      },
      cancel: async () => {
        cancelled = true;
      },
    };
    const fetchFn: FetchLike = async () =>
      htmlResponse('', { body: { getReader: () => reader }, text: async () => '' });
    const result = await fetchWebsiteText('https://example.com', {
      fetchFn,
      lookupFn: publicLookup,
    });
    expect(result.ok).toBe(true);
    expect(cancelled).toBe(true);
    // Never reads meaningfully past the 1.5MB cap (~24 chunks of 64KB).
    expect(reads).toBeLessThan(30);
  });

  it('caps a non-streamed body by length', async () => {
    const huge = '<html><body><p>' + 'x'.repeat(3 * 1024 * 1024) + '</p></body></html>';
    const fetchFn: FetchLike = async () => htmlResponse(huge);
    const result = await fetchWebsiteText('https://example.com', {
      fetchFn,
      lookupFn: publicLookup,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text.length).toBeLessThanOrEqual(8_400 + 100); // extraction cap dominates
    }
  });

  it('returns extracted title + text on the happy path', async () => {
    const fetchFn: FetchLike = async () =>
      htmlResponse(
        '<html><head><title>Bäckerei Sonne</title></head><body><h1>Fresh bread</h1><p>We bake sourdough daily. Loaf CHF 7.</p></body></html>'
      );
    const result = await fetchWebsiteText('https://example.com', {
      fetchFn,
      lookupFn: publicLookup,
    });
    expect(result).toMatchObject({ ok: true, title: 'Bäckerei Sonne' });
    if (result.ok) {
      expect(result.text).toContain('Fresh bread');
      expect(result.text).toContain('Loaf CHF 7');
    }
  });
});

// ── Text extraction ───────────────────────────────────────────────────────────

describe('extractReadableText', () => {
  it('pulls title, meta description, headings, and body text', () => {
    const html = `<html><head>
      <title>Studio Rex &amp; Co</title>
      <meta content="Handmade ceramics in Zürich" name="description">
    </head><body>
      <h1>Our Work</h1>
      <p>We sell handmade ceramic mugs.</p>
    </body></html>`;
    const out = extractReadableText(html);
    expect(out.title).toBe('Studio Rex & Co');
    expect(out.description).toBe('Handmade ceramics in Zürich');
    expect(out.text).toContain('## Our Work');
    expect(out.text).toContain('handmade ceramic mugs');
  });

  it('drops scripts, styles, and nav/footer chrome', () => {
    const html = `<html><body>
      <nav><a href="/">Home</a><a href="/contact">Contact</a></nav>
      <script>window.secret = "tracker";</script>
      <style>.x { color: red }</style>
      <p>Visible offer: guided bike tours.</p>
      <footer>© 2026 Corp — Imprint</footer>
    </body></html>`;
    const out = extractReadableText(html);
    expect(out.text).toContain('guided bike tours');
    expect(out.text).not.toContain('tracker');
    expect(out.text).not.toContain('color: red');
    expect(out.text).not.toContain('Imprint');
    expect(out.text).not.toContain('Contact');
  });

  it('decodes entities and collapses whitespace', () => {
    const out = extractReadableText('<body><p>Fish &amp; Chips&nbsp;&mdash; daily</p></body>');
    expect(out.text).toContain('Fish & Chips');
    expect(out.text).not.toMatch(/ {2,}/);
  });

  it('caps output at ~8k chars', () => {
    const html = `<body><p>${'word '.repeat(5000)}</p></body>`;
    const out = extractReadableText(html);
    expect(out.text.length).toBeLessThanOrEqual(8_000 + 20);
    expect(out.text).toContain('[…truncated]');
  });
});

// ── Wiring: tool list + detection ────────────────────────────────────────────

describe('analyze_website wiring', () => {
  it('is registered in the platform tool list with a required url param', () => {
    const tool = PLATFORM_TOOL_DEFINITION.find(t => t.function.name === 'analyze_website') as
      | { function: { parameters: { required?: string[]; properties: Record<string, unknown> } } }
      | undefined;
    expect(tool).toBeDefined();
    expect(tool?.function.parameters.required).toEqual(['url']);
    expect(tool?.function.parameters.properties).toHaveProperty('url');
  });

  it('detection triggers on URL + setup intent', () => {
    const msg = "here's my site: https://example.com — set me up on OrangeCat";
    expect(hasWebsiteAnalysisIntent(msg)).toBe(true);
    expect(messageMightNeedTools(msg)).toBe(true);
  });

  it('detection triggers on URL + analyze intent', () => {
    expect(hasWebsiteAnalysisIntent('can you analyze https://example.com for me')).toBe(true);
  });

  it('triggers when the message is ONLY a URL (bare-URL message = analyze intent)', () => {
    expect(hasWebsiteAnalysisIntent('https://example.com')).toBe(true);
  });

  it('triggers when the message is ONLY a bare schemeless domain (prod bug repro)', () => {
    expect(hasWebsiteAnalysisIntent('revampit.orangecat.ch')).toBe(true);
    expect(messageMightNeedTools('revampit.orangecat.ch')).toBe(true);
  });

  it('does not trigger on a URL pasted casually mid-sentence without intent', () => {
    expect(hasWebsiteAnalysisIntent('someone shared https://example.com in chat yesterday')).toBe(
      false
    );
  });

  it('does not trigger on intent without a URL', () => {
    expect(hasWebsiteAnalysisIntent('set me up on OrangeCat')).toBe(false);
  });
});

// ── Schemeless input through the fetcher (normalization + SSRF stays on) ─────

describe('fetchWebsiteText with schemeless input', () => {
  it('normalizes a bare domain to https and fetches it', async () => {
    const fetchFn: FetchLike = vi.fn(async () =>
      htmlResponse(
        '<html><title>RevampIT</title><body><p>We refurbish computers.</p></body></html>'
      )
    );
    const result = await fetchWebsiteText('revampit.orangecat.ch', {
      fetchFn,
      lookupFn: publicLookup,
    });
    expect(result).toMatchObject({ ok: true, title: 'RevampIT' });
    expect(fetchFn).toHaveBeenCalledWith('https://revampit.orangecat.ch/', expect.anything());
  });

  it('still rejects a schemeless private IP literal', async () => {
    const fetchFn = vi.fn();
    const result = await fetchWebsiteText('127.0.0.1', { fetchFn, lookupFn: publicLookup });
    expect(result.ok).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('still rejects a schemeless host that resolves to a private address', async () => {
    const fetchFn = vi.fn();
    const result = await fetchWebsiteText('internal.example.com', {
      fetchFn,
      lookupFn: privateLookup,
    });
    expect(result.ok).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
