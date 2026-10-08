/**
 * One rule decides whether a request to a room is an investor opening
 * something (ADR-0012 D4). Found live 2026-10-08: the page skipped the owner
 * and the click-through route did not, so the owner's own "Build record" click
 * was logged — and notified — as a visitor on the shared door link.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const getUser = vi.fn();
const checkOwnership = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({ auth: { getUser } }),
}));
vi.mock('@/services/actors', () => ({ checkOwnership: (...a: unknown[]) => checkOwnership(...a) }));

import { countsAsOpen } from '@/domain/projectRooms/counts';

const BROWSER =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const h = (init: Record<string, string>) => new Headers(init);

describe('countsAsOpen', () => {
  beforeEach(() => {
    getUser.mockReset();
    checkOwnership.mockReset();
  });

  it('counts a person who is not the owner', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await countsAsOpen(h({ 'user-agent': BROWSER }), 'actor-1')).toBe(true);
  });

  it('does not count the owner, signed in, previewing or clicking through', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    checkOwnership.mockResolvedValue(true);
    expect(await countsAsOpen(h({ 'user-agent': BROWSER }), 'actor-1')).toBe(false);
  });

  it('counts a signed-in person who does not own the project', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u2' } } });
    checkOwnership.mockResolvedValue(false);
    expect(await countsAsOpen(h({ 'user-agent': BROWSER }), 'actor-1')).toBe(true);
  });

  it('does not count a preview fetcher or a prefetch, without even asking who it is', async () => {
    expect(await countsAsOpen(h({ 'user-agent': 'WhatsApp/2.24' }), 'actor-1')).toBe(false);
    expect(
      await countsAsOpen(h({ 'user-agent': BROWSER, 'next-router-prefetch': '1' }), 'actor-1')
    ).toBe(false);
    expect(getUser).not.toHaveBeenCalled();
  });
});

describe('every place that records an open asks the one rule', () => {
  it.each(['src/app/room/[token]/page.tsx', 'src/app/room/[token]/open/[what]/route.ts'])(
    '%s gates recordRoomOpen on countsAsOpen',
    file => {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source).toMatch(/if \(await countsAsOpen\([^{;]{0,100}\{\s*await recordRoomOpen\(/);
      expect(source).not.toMatch(/isLinkPreviewBot|isPrefetchRequest|checkOwnership/);
    }
  );
});
