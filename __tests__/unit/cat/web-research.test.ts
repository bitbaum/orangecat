/**
 * Cat's web tools — the policy layer, not the transport.
 *
 * `ai-kit/web` owns the provider chain, the SSRF guard and the Fact mapping,
 * and has its own tests for them. What is asserted here is the part that is
 * OrangeCat's decision and would be silently wrong in a way no type catches:
 *
 *  1. Cat may only open a url the USER wrote or a SEARCH produced. A url that
 *     first appears in the model's own output is refused. This is the rule that
 *     keeps a page Cat reads from talking Cat into fetching somewhere else.
 *  2. Citation handles keep counting across tool calls within a turn. Two
 *     searches that both start at [F1] would make the second answer's citations
 *     point at the first search's sources — an error that looks like diligence.
 *  3. "Found nothing" and "could not look" produce different instructions to
 *     the model AND different chips to the user, all the way through.
 */
import { WebTurnContext, searchTheWeb, readTheWeb } from '@/services/cat/web-research';

const mocks = vi.hoisted(() => ({
  webSearch: vi.fn(),
  readPage: vi.fn(),
}));

vi.mock('@bitbaum/ai-kit/web', async importOriginal => {
  const actual = await importOriginal<typeof import('@bitbaum/ai-kit/web')>();
  return { ...actual, webSearch: mocks.webSearch, readPage: mocks.readPage };
});

function hit(url: string, title = 'A result') {
  return { title, url, snippet: 'Some words from the engine.' };
}

function foundWith(...urls: string[]) {
  return {
    status: 'found' as const,
    provider: 'searxng',
    query: 'q',
    results: urls.map(u => hit(u)),
    attempts: [{ provider: 'searxng', outcome: 'results' as const, count: urls.length }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('what Cat is allowed to open', () => {
  it('refuses a url that only ever appeared in the model’s own output', async () => {
    const ctx = new WebTurnContext('how much does a coworking desk cost in Zurich?');

    const outcome = await readTheWeb(ctx, { url: 'https://totally-real-prices.example/zurich' });

    expect(outcome.ok).toBe(false);
    expect(mocks.readPage).not.toHaveBeenCalled();
    // The refusal has to say WHY, or the model just tries a variant of the
    // same invented url instead of running a search.
    expect(outcome.content).toMatch(/did not come from/i);
    expect(outcome.content).toMatch(/web_search first/i);
    expect(outcome.content).toMatch(/Do not describe, summarise or quote/i);
  });

  it('opens a url the user pasted themselves', async () => {
    const ctx = new WebTurnContext('have a look at https://revampit.org/about please');
    mocks.readPage.mockResolvedValue({
      ok: true,
      url: 'https://revampit.org/about',
      title: 'About',
      text: 'We refurbish computers in Zurich.',
      truncated: false,
    });

    const outcome = await readTheWeb(ctx, { url: 'https://revampit.org/about' });

    expect(outcome.ok).toBe(true);
    expect(outcome.content).toMatch(/We refurbish computers/);
  });

  it('opens a url a search produced, and only after the search produced it', async () => {
    const ctx = new WebTurnContext('what does revampit do?');
    const target = 'https://revampit.org/services';

    const before = await readTheWeb(ctx, { url: target });
    expect(before.ok).toBe(false);

    mocks.webSearch.mockResolvedValue(foundWith(target));
    await searchTheWeb(ctx, { query: 'revampit services' });

    mocks.readPage.mockResolvedValue({
      ok: true,
      url: target,
      title: 'Services',
      text: 'Repairs, refurbishment, IT support.',
      truncated: false,
    });
    const after = await readTheWeb(ctx, { url: target });
    expect(after.ok).toBe(true);
  });

  it('matches urls the way a person would, without letting a different page through', async () => {
    const ctx = new WebTurnContext('see https://Example.COM/docs/ and tell me');
    mocks.readPage.mockResolvedValue({
      ok: true,
      url: 'https://example.com/docs',
      title: 'Docs',
      text: 'x',
      truncated: false,
    });

    // Case, a trailing slash and a fragment are the same page.
    expect((await readTheWeb(ctx, { url: 'https://example.com/docs#intro' })).ok).toBe(true);

    // A different path is a different page, and so is a different query string:
    // `?id=42` is usually the document, not decoration.
    expect((await readTheWeb(ctx, { url: 'https://example.com/docs/secret' })).ok).toBe(false);
    expect((await readTheWeb(ctx, { url: 'https://example.com/docs?id=42' })).ok).toBe(false);
    expect((await readTheWeb(ctx, { url: 'https://evil.example/docs' })).ok).toBe(false);
  });
});

describe('citation handles', () => {
  it('keep counting across two searches in one turn', async () => {
    const ctx = new WebTurnContext('compare desk prices');

    mocks.webSearch.mockResolvedValueOnce(foundWith('https://a.example/1', 'https://a.example/2'));
    const first = await searchTheWeb(ctx, { query: 'desks zurich' });

    mocks.webSearch.mockResolvedValueOnce(foundWith('https://b.example/1'));
    const second = await searchTheWeb(ctx, { query: 'desks geneva' });

    // Scoped to the rendered source blocks — the trailing instructions are
    // prose about handles and must not be searched for handles.
    const sourcesOf = (content: string) => content.split('HOW TO USE THESE:')[0] ?? '';

    expect(sourcesOf(first.content)).toMatch(/\[F1\]/);
    expect(sourcesOf(first.content)).toMatch(/\[F2\]/);
    // The bug this guards: assignFactIds numbers from F1 every time, so a
    // second search would re-issue [F1] and every citation to it would point
    // at the first search's source instead.
    expect(sourcesOf(second.content)).toMatch(/\[F3\]/);
    expect(sourcesOf(second.content)).not.toMatch(/\[F[12]\]/);
    expect(ctx.facts.map(f => f.id)).toEqual(['F1', 'F2', 'F3']);

    // And the two results of a SINGLE search must not share one handle, which
    // is what happened when the id was derived from a length that had not
    // grown yet.
    expect(new Set(ctx.facts.map(f => f.id)).size).toBe(3);
  });

  it('give a read page its own handle, continuing from the search', async () => {
    const ctx = new WebTurnContext('q');
    mocks.webSearch.mockResolvedValue(foundWith('https://a.example/1', 'https://a.example/2'));
    await searchTheWeb(ctx, { query: 'q' });

    mocks.readPage.mockResolvedValue({
      ok: true,
      url: 'https://a.example/1',
      title: 'One',
      text: 'The fee is 240 CHF per month.',
      truncated: false,
    });
    const page = await readTheWeb(ctx, { url: 'https://a.example/1' });

    expect(page.content).toMatch(/PAGE TEXT \[F3\]/);
    expect(page.content).toMatch(/240 CHF/);
    // Evidence must line up with the handles, or the grounding check verifies
    // the answer against the wrong source.
    expect(ctx.evidence.some(e => e.startsWith('[F3]'))).toBe(true);
  });

  it('records every source once, in the order Cat met them', async () => {
    const ctx = new WebTurnContext('q');
    mocks.webSearch.mockResolvedValue(foundWith('https://a.example/1', 'https://a.example/2'));
    await searchTheWeb(ctx, { query: 'q' });
    await searchTheWeb(ctx, { query: 'q again' });

    expect(ctx.sources.map(s => s.url)).toEqual(['https://a.example/1', 'https://a.example/2']);
  });
});

describe('the three answers a lookup can give', () => {
  it('tells the model it may report a real negative when a backend answered', async () => {
    const ctx = new WebTurnContext('q');
    mocks.webSearch.mockResolvedValue({
      status: 'nothing',
      query: 'kraftwerk zurich hedgehog census',
      attempts: [{ provider: 'searxng', outcome: 'empty', count: 0 }],
    });

    const outcome = await searchTheWeb(ctx, { query: 'kraftwerk zurich hedgehog census' });

    expect(outcome.ok).toBe(false);
    expect(outcome.searched).toBe(true);
    expect(outcome.content).toMatch(/no results/i);
  });

  it('forbids reporting a negative when nothing answered, and says why', async () => {
    const ctx = new WebTurnContext('q');
    mocks.webSearch.mockResolvedValue({
      status: 'could_not_look',
      query: 'q',
      attempts: [
        {
          provider: 'searxng',
          outcome: 'failed',
          failure: { kind: 'unreachable', reason: 'the container is down' },
        },
      ],
    });

    const outcome = await searchTheWeb(ctx, { query: 'q' });

    expect(outcome.ok).toBe(false);
    // Not `searched` — this is the distinction that drives the UI chip, so an
    // outage never renders to the user as "nothing found".
    expect(outcome.searched).toBeFalsy();
    expect(outcome.content).toMatch(/COULD NOT BE PERFORMED/);
    expect(outcome.content).toMatch(/must NOT say that nothing was found/i);
    // The operator's actual fix has to survive into the transcript.
    expect(outcome.content).toMatch(/the container is down/);
  });

  it('treats a thrown search as "could not look", never as an empty web', async () => {
    const ctx = new WebTurnContext('q');
    mocks.webSearch.mockRejectedValue(new Error('boom'));

    const outcome = await searchTheWeb(ctx, { query: 'q' });

    expect(outcome.ok).toBe(false);
    expect(outcome.searched).toBeFalsy();
    expect(outcome.content).toMatch(/Do NOT say nothing was found/i);
  });
});

describe('what the model is told to do with what it read', () => {
  it('pushes the model off snippets and onto the page', async () => {
    const ctx = new WebTurnContext('q');
    mocks.webSearch.mockResolvedValue(foundWith('https://a.example/1'));

    const outcome = await searchTheWeb(ctx, { query: 'q' });

    expect(outcome.content).toMatch(/read_page/);
    expect(outcome.content).toMatch(/Cite every claim/i);
    expect(outcome.content).toMatch(/published: <not recorded>/);
  });

  it('says a truncated page is truncated, so a summary cannot imply otherwise', async () => {
    const ctx = new WebTurnContext('see https://a.example/long');
    mocks.readPage.mockResolvedValue({
      ok: true,
      url: 'https://a.example/long',
      title: 'Long',
      text: 'the beginning',
      truncated: true,
    });

    const outcome = await readTheWeb(ctx, { url: 'https://a.example/long' });

    expect(outcome.content).toMatch(/only the FIRST PART/i);
    expect(outcome.content).toMatch(/never imply you read the whole/i);
  });

  it('refuses to let an empty JS-rendered page be inferred from its url', async () => {
    const ctx = new WebTurnContext('see https://a.example/spa');
    mocks.readPage.mockResolvedValue({
      ok: true,
      url: 'https://a.example/spa',
      title: 'App',
      text: '   ',
      truncated: false,
    });

    const outcome = await readTheWeb(ctx, { url: 'https://a.example/spa' });

    expect(outcome.ok).toBe(true);
    expect(outcome.content).toMatch(/no readable text/i);
    expect(outcome.content).toMatch(/Do NOT infer its contents/i);
  });

  it('reports an unreadable page as unreadable rather than describing it', async () => {
    const ctx = new WebTurnContext('see https://a.example/gone');
    mocks.readPage.mockResolvedValue({
      ok: false,
      url: 'https://a.example/gone',
      failure: { kind: 'bad_response', reason: 'The site answered 404.' },
    });

    const outcome = await readTheWeb(ctx, { url: 'https://a.example/gone' });

    expect(outcome.ok).toBe(false);
    expect(outcome.content).toMatch(/answered 404/);
    expect(outcome.content).toMatch(/Do NOT guess or describe/i);
  });
});
