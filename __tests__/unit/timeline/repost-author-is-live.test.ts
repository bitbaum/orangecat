/**
 * A repost stored its original author's name and avatar as they were on the
 * day of the repost, and every feed rendered that snapshot. After an avatar
 * change, a post and its reposts showed different pictures side by side.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const profiles = vi.hoisted(() => ({
  rows: [] as Array<{ id: string; name: string | null; username: string | null; avatar_url: string | null }>,
  queried: [] as string[][],
}));

vi.mock('@/lib/supabase/browser', () => ({ default: {} }));
vi.mock('@/lib/supabase/untyped', () => ({
  fromTable: () => ({
    select: () => ({
      in: async (_col: string, ids: string[]) => {
        profiles.queried.push(ids);
        return { data: profiles.rows.filter(r => ids.includes(r.id)) };
      },
    }),
  }),
}));

import { attachLiveOriginalAuthors } from '@/services/timeline/processors/enrichment';

const repost = (avatar: string | null) => ({
  id: 'e1',
  metadata: {
    is_repost: true,
    original_actor_id: 'author',
    original_actor_name: 'Old Name',
    original_actor_username: 'old',
    original_actor_avatar: avatar,
  },
});

beforeEach(() => {
  profiles.rows = [];
  profiles.queried = [];
});

describe('attachLiveOriginalAuthors', () => {
  it("shows the original author's CURRENT avatar and name, not the snapshot", async () => {
    profiles.rows = [{ id: 'author', name: 'New Name', username: 'new', avatar_url: 'new.png' }];
    const [ev] = await attachLiveOriginalAuthors([repost('old.png')]);
    expect(ev.metadata).toMatchObject({
      original_actor_name: 'New Name',
      original_actor_username: 'new',
      original_actor_avatar: 'new.png',
    });
  });

  it('a removed avatar is removed on the repost too', async () => {
    profiles.rows = [{ id: 'author', name: 'A', username: 'a', avatar_url: null }];
    const [ev] = await attachLiveOriginalAuthors([repost('old.png')]);
    expect(ev.metadata.original_actor_avatar).toBeNull();
  });

  it('keeps the snapshot when the profile is gone', async () => {
    const [ev] = await attachLiveOriginalAuthors([repost('old.png')]);
    expect(ev.metadata.original_actor_avatar).toBe('old.png');
  });

  it('does not query at all when there is no repost', async () => {
    await attachLiveOriginalAuthors([{ id: 'e2', metadata: { is_user_post: true } }]);
    expect(profiles.queried).toEqual([]);
  });

  it('resolves every repost author in ONE query', async () => {
    await attachLiveOriginalAuthors([repost('a'), { ...repost('b'), id: 'e3' }]);
    expect(profiles.queried).toHaveLength(1);
  });
});

describe('no feed turns view rows into posts by hand', () => {
  /**
   * Five feeds each wrote `rows.map(transformEnrichedEventToDisplay)`, which is
   * why a step every feed needs was missing from all of them.
   */
  const dir = 'src/services/timeline/queries';
  const feeds = readdirSync(dir)
    .filter(f => f.endsWith('.ts') && f !== 'helpers.ts' && f !== 'index.ts')
    .map(f => ({ f, src: readFileSync(join(dir, f), 'utf8') }));

  it('walks the real feed files', () => {
    expect(feeds.length).toBeGreaterThanOrEqual(5);
  });

  it('every feed goes through displayEventsFromView', () => {
    const byHand = feeds.filter(({ src }) => /\.map\(\s*transformEnrichedEventToDisplay/.test(src));
    expect(byHand.map(x => x.f)).toEqual([]);
  });
});
