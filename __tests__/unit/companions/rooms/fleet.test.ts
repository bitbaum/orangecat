import { describe, it, expect, vi } from 'vitest';
import { FLEET_BOTS, fleetBotAskUrl, isFleetBotSlug } from '@/config/fleet-bots';
import {
  askFleetBot,
  displayName,
  firstSentence,
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
      job: 'The health layer of the fleet: an agent that reads a medical report with you.',
      url: 'https://diplodoctor.example',
    });
  });

  it('is empty without a map, never a typed host', () => {
    expect(fleetBotsFromMap([])).toEqual([]);
  });

  it('capitalises a bare slug and keeps a real name', () => {
    expect(displayName({ slug: 'causius', name: 'causius' })).toBe('Causius');
    expect(displayName({ slug: 'biaslens', name: 'BiasLens' })).toBe('BiasLens');
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
      expect(JSON.parse(String(init?.body))).toEqual({ messages, locale: 'en' });
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
