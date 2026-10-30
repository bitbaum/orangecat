import { describe, it, expect, vi } from 'vitest';
import { FLEET_BOTS, fleetBotAskUrl, isFleetBotSlug } from '@/config/fleet-bots';
import {
  askFleetBot,
  displayName,
  firstSentence,
  fleetAskBody,
  jobLine,
  fleetBotsFromMap,
  type FleetBot,
} from '@/services/companions/rooms/fleet';

const projects = [
  {
    slug: 'diplodoctor',
    name: 'Diplodoctor',
    what: 'The health layer of the fleet: an agent that reads a medical report with you. Beta.',
    urls: { live: 'https://diplodoctor.example/', repo: null, orangecat: null, solon: null },
  },
  {
    slug: 'causius',
    name: 'causius',
    what: null,
    urls: { live: null, repo: null, orangecat: null, solon: null },
  },
  {
    slug: 'loki',
    name: 'loki',
    what: 'Builds things.',
    urls: { live: 'https://loki.example', repo: null, orangecat: null, solon: null },
  },
];

describe('fleet bots from the map', () => {
  it('seats only the products in the contract that the map says are running', () => {
    const bots = fleetBotsFromMap(projects);
    expect(bots.map(b => b.slug)).toEqual(['diplodoctor']);
    expect(bots[0]).toMatchObject({
      name: 'Diplodoctor',
      job: 'health',
      url: 'https://diplodoctor.example',
      mark: '/api/ai-assistants/fleet/diplodoctor/mark',
    });
  });

  it('is empty without a map, never a typed host', () => {
    expect(fleetBotsFromMap([])).toEqual([]);
  });

  it('capitalises a bare slug and keeps a real name', () => {
    expect(displayName({ slug: 'causius', name: 'causius' })).toBe('Causius');
    expect(displayName({ slug: 'biaslens', name: 'BiasLens' })).toBe('BiasLens');
  });

  it('takes the layer word as the job line, else the first sentence', () => {
    expect(jobLine('The legal layer of the fleet: an agent that does legal work.')).toBe('legal');
    expect(jobLine('Builds things. Beta.')).toBe('Builds things.');
    expect(jobLine(null)).toBeNull();
  });

  it('takes the first sentence as the job line', () => {
    expect(firstSentence('Reads it with you. Beta: running.')).toBe('Reads it with you.');
    expect(firstSentence('  No full stop  ')).toBe('No full stop');
    expect(firstSentence(null)).toBeNull();
  });

  it('knows its own slugs', () => {
    for (const slug of Object.keys(FLEET_BOTS)) {
      expect(isFleetBotSlug(slug)).toBe(true);
    }
    expect(isFleetBotSlug('orangecat')).toBe(false);
    expect(isFleetBotSlug('constructor')).toBe(false);
  });
});

describe('askFleetBot', () => {
  const bot: FleetBot = {
    slug: 'diplodoctor',
    name: 'Diplodoctor',
    what: null,
    job: null,
    url: 'https://diplodoctor.example',
  };
  const messages = [{ role: 'user' as const, content: 'What does ferritin measure?' }];

  it('posts the conversation to the shared path and reads text and replies', async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe(fleetBotAskUrl('https://diplodoctor.example/'));
      expect(String(url)).toBe('https://diplodoctor.example/api/ask');
      expect(JSON.parse(String(init?.body))).toEqual({ messages, context: '', locale: 'en' });
      return new Response(JSON.stringify({ text: 'Iron stores.', replies: ['Thanks', 7] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    expect(await askFleetBot(bot, messages, { fetchImpl })).toEqual({
      text: 'Iron stores.',
      replies: ['Thanks'],
    });
  });

  it('maps the product’s own statuses to room errors', async () => {
    const status = async (code: number) =>
      askFleetBot(bot, messages, {
        fetchImpl: (async () => new Response('{}', { status: code })) as unknown as typeof fetch,
      });
    expect(await status(429)).toMatchObject({ error: { code: 'RATE_LIMITED' } });
    expect(await status(503)).toMatchObject({ error: { code: 'SERVICE_UNAVAILABLE' } });
    expect(await status(500)).toMatchObject({ error: { code: 'AI_ERROR' } });
  });

  it('treats an empty answer and a dead connection as a failed line, not a blank', async () => {
    const empty = await askFleetBot(bot, messages, {
      fetchImpl: (async () =>
        new Response(JSON.stringify({ text: '' }), { status: 200 })) as unknown as typeof fetch,
    });
    expect(empty).toMatchObject({ error: { code: 'AI_ERROR' } });
    const dead = await askFleetBot(bot, messages, {
      fetchImpl: (async () => {
        throw new Error('ECONNREFUSED');
      }) as unknown as typeof fetch,
    });
    expect(dead).toMatchObject({ error: { code: 'AI_ERROR' } });
  });
});

describe('fleetAskBody', () => {
  const file = (name: string, body: string) =>
    `<attached_file name="${name}">\n${body}\n</attached_file>`;

  it('moves an attached file out of the line and into context', () => {
    const body = fleetAskBody(
      [
        {
          role: 'user',
          content: `What does this say?\n\n${file('lease.txt', 'Rent is due monthly.')}`,
        },
      ],
      'en'
    );
    expect(body.messages).toEqual([{ role: 'user', content: 'What does this say?' }]);
    expect(body.context).toBe('--- lease.txt ---\nRent is due monthly.');
    expect(body.locale).toBe('en');
  });

  it('cuts a line to the contract and keeps the newest files when they would not fit', () => {
    const long = 'x'.repeat(30_000);
    const body = fleetAskBody(
      [
        { role: 'user', content: file('old.txt', long) },
        { role: 'assistant', content: 'Noted.' },
        { role: 'user', content: `${'y'.repeat(5_000)} ${file('new.txt', 'short')}` },
      ],
      'de'
    );
    expect(body.context).toBe('--- new.txt ---\nshort');
    expect(body.messages[0].content).toBe('(see the attached file)');
    expect(body.messages[2].content.length).toBe(4_000);
  });

  it('leaves a plain conversation alone', () => {
    const turns = [{ role: 'user' as const, content: 'Hello' }];
    expect(fleetAskBody(turns, 'fr')).toEqual({ messages: turns, context: '', locale: 'fr' });
  });
});
