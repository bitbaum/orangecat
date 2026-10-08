/**
 * The investor room's rules (ADR-0012) that keep its promises:
 * - "who opened what" counts people, not messenger preview fetchers;
 * - the open route only follows what the room itself lists (never an open redirect);
 * - a stored room that no longer fits the schema still opens;
 * - a refresh is not a second visit.
 */
import {
  normalizeRoomContent,
  resolveOpenTarget,
  visibleSections,
} from '@/domain/projectRooms/content';
import { isSameVisit } from '@/domain/projectRooms/open';
import { roomContentSchema, roomParagraphs, ROOM_VISIT_WINDOW_MS } from '@/config/project-room';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isLinkPreviewBot, isPrefetchRequest } from '@/lib/link-preview-bots';
import { summariseOpens } from '@/components/room/RoomLinkRow';

vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
vi.mock('@/services/notifications/dispatcher', () => ({
  NotificationDispatcher: { dispatch: vi.fn() },
}));

const content = normalizeRoomContent({
  headline: 'Understanding the language spoken around you',
  sections: [
    { title: 'The problem', body: 'People live in Zurich for years.\n\nAnd never understand it.' },
    { title: 'Team', body: '' },
    { title: 42, body: 'not a section' },
  ],
  metrics: [
    { label: 'Merged pull requests', value: '156', verify: 'example.com/pulls' },
    { label: '', value: 'no label' },
  ],
  metrics_as_of: '2026-10-01T00:00:00Z',
  deck_url: 'https://example.com/deck',
  documents: [
    { title: 'Financials', url: 'https://example.com/fin.pdf' },
    { title: 'Bad', url: 'javascript:alert(1)' },
  ],
  contact_email: '',
});

describe('normalizeRoomContent', () => {
  it('drops entries that no longer fit instead of failing the room', () => {
    expect(content.sections.map(s => s.title)).toEqual(['The problem', 'Team']);
    expect(content.documents.map(d => d.title)).toEqual(['Financials']);
    expect(content.contact_email).toBeNull();
    expect(content.metrics.map(m => m.label)).toEqual(['Merged pull requests']);
    expect(content.metrics_as_of).toBe('2026-10-01');
  });

  it('shows only sections with something written in them', () => {
    expect(visibleSections(content).map(s => s.title)).toEqual(['The problem']);
  });

  it('splits a body into paragraphs on blank lines', () => {
    expect(roomParagraphs(content.sections[0].body)).toEqual([
      'People live in Zurich for years.',
      'And never understand it.',
    ]);
  });
});

describe('resolveOpenTarget — only what the room lists', () => {
  it('follows the deck, a listed document and the build record', () => {
    expect(resolveOpenTarget(content, 'deck', null, null)?.url).toBe('https://example.com/deck');
    expect(resolveOpenTarget(content, 'document', 0, null)).toEqual({
      url: 'https://example.com/fin.pdf',
      target: 'Financials',
    });
    expect(
      resolveOpenTarget(content, 'build', null, 'https://loki.orangecat.ch/fleet/heidi')?.url
    ).toBe('https://loki.orangecat.ch/fleet/heidi');
  });

  it('refuses anything else', () => {
    expect(resolveOpenTarget(content, 'document', 1, null)).toBeNull();
    expect(resolveOpenTarget(content, 'document', -1, null)).toBeNull();
    expect(resolveOpenTarget(content, 'document', null, null)).toBeNull();
    expect(resolveOpenTarget(content, 'build', null, null)).toBeNull();
    expect(resolveOpenTarget(content, 'https://evil.example', 0, null)).toBeNull();
    expect(resolveOpenTarget({ ...content, deck_url: null }, 'deck', null, null)).toBeNull();
  });
});

describe('roomContentSchema', () => {
  const base = { sections: [], documents: [], metrics: [] };
  it('takes https links only', () => {
    expect(roomContentSchema.safeParse({ ...base, deck_url: 'https://x.io/d' }).success).toBe(true);
    expect(roomContentSchema.safeParse({ ...base, deck_url: 'http://x.io/d' }).success).toBe(false);
    expect(
      roomContentSchema.safeParse({
        ...base,
        documents: [{ title: 'x', url: 'javascript:alert(1)' }],
      }).success
    ).toBe(false);
  });
});

describe('isLinkPreviewBot', () => {
  it.each([
    'WhatsApp/2.24.6.77 A',
    'TelegramBot (like TwitterBot)',
    'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
    'facebookexternalhit/1.1;line-poker/1.0',
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0',
    '',
    null,
  ])('a preview fetcher: %s', ua => {
    expect(isLinkPreviewBot(ua)).toBe(true);
  });

  it.each([
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
    // In-app browsers are people reading the page, not previews of it.
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/14.9.0',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 [FBAN/FB4A;FBAV/480.0]',
  ])('a person: %s', ua => {
    expect(isLinkPreviewBot(ua)).toBe(false);
  });
});

describe('isPrefetchRequest', () => {
  const h = (init: Record<string, string>) => new Headers(init);
  it('recognises a fetch ahead of a click', () => {
    expect(isPrefetchRequest(h({ 'next-router-prefetch': '1' }))).toBe(true);
    expect(isPrefetchRequest(h({ purpose: 'prefetch' }))).toBe(true);
    expect(isPrefetchRequest(h({ 'sec-purpose': 'prefetch;prerender' }))).toBe(true);
  });
  it('lets the click itself through', () => {
    expect(isPrefetchRequest(h({}))).toBe(false);
    expect(isPrefetchRequest(h({ accept: 'text/html' }))).toBe(false);
  });
});

/**
 * Found live 2026-10-08: the room's deck and build buttons were <Button href>,
 * which renders a Next <Link>, which PREFETCHES — so every view of a room
 * fetched /open/deck and /open/build and would have recorded opens nobody
 * clicked. Anything that goes through /open must be a plain <a>.
 */
describe('the room links through /open without prefetching', () => {
  const source = readFileSync(join(process.cwd(), 'src/components/room/RoomView.tsx'), 'utf8');
  it('uses neither next/link nor <Button href>', () => {
    expect(source).not.toMatch(/from 'next\/link'/);
    expect(source).not.toMatch(/<Button\b/);
  });
});

describe('isSameVisit', () => {
  const now = Date.parse('2026-10-08T12:00:00Z');
  it('treats a refresh inside the window as the same visit', () => {
    expect(isSameVisit(new Date(now - 60_000).toISOString(), now)).toBe(true);
  });
  it('counts a return after the window, and a first open', () => {
    expect(isSameVisit(new Date(now - ROOM_VISIT_WINDOW_MS - 1).toISOString(), now)).toBe(false);
    expect(isSameVisit(null, now)).toBe(false);
  });
});

describe('summariseOpens', () => {
  it('names what a link opened, most first, without the page visits', () => {
    const at = '2026-10-08T12:00:00Z';
    expect(
      summariseOpens([
        { link_id: 'l', what: 'room', target: null, opened_at: at },
        { link_id: 'l', what: 'deck', target: null, opened_at: at },
        { link_id: 'l', what: 'document', target: 'Financials', opened_at: at },
        { link_id: 'l', what: 'deck', target: null, opened_at: at },
      ])
    ).toBe('the deck ×2 · Financials');
  });
});
