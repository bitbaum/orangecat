// @vitest-environment jsdom
/**
 * A bot the person made a moment ago is theirs the moment its chat opens.
 *
 * Seen on the live site (2026-11-13): the list this screen held was loaded
 * before the bot existed, so its chat was given no row, and without a row a
 * chat cannot know the bot is the person's own. The details showed no Edit,
 * no routine, no abilities, and no chips, until the page was reloaded.
 */
import { render, waitFor } from '@testing-library/react';

const seen = vi.hoisted(() => ({ rows: [] as Array<{ id: string; mine: boolean } | null> }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('with=bot-new'),
}));
vi.mock('@/components/companions/talk/CompanionChat', () => ({
  CompanionChat: ({ row }: { row: { id: string; mine: boolean } | null }) => {
    seen.rows.push(row);
    return null;
  },
}));
for (const [path, name] of [
  ['CatChat', 'CatChat'],
  ['FleetChat', 'FleetChat'],
  ['RoomChat', 'RoomChat'],
  ['TalkList', 'TalkList'],
  ['NewCompanionSheet', 'NewCompanionSheet'],
  ['NewRoomSheet', 'NewRoomSheet'],
] as const) {
  vi.doMock(`@/components/companions/talk/${path}`, () => ({ [name]: () => null }));
}

const home = (companions: unknown[]) => ({
  success: true,
  data: { companions, rooms: [], fleet: { bots: [] } },
});
const mine = { id: 'bot-new', title: 'Day Planner', description: 'plans', mine: true };

describe('the talk home, opened on a bot it does not know yet', () => {
  beforeEach(() => {
    seen.rows = [];
    vi.resetModules();
  });

  it('reads the list again, and the chat is told the bot is the person’s own', async () => {
    const calls: string[] = [];
    let listReads = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url.endsWith('/talk')) {
          listReads += 1;
          // The first read is the one made before the bot existed.
          return { ok: true, json: async () => home(listReads === 1 ? [] : [mine]) };
        }
        return { ok: true, json: async () => ({ data: { title: 'Day Planner' } }) };
      })
    );
    const { TalkHome } = await import('@/components/companions/talk/TalkHome');
    render(<TalkHome />);
    await waitFor(() => expect(seen.rows.at(-1)?.mine).toBe(true));
    // It never had to fall back to the by-id read, which knows no owner.
    expect(calls.filter(u => !u.endsWith('/talk'))).toEqual([]);
  });

  it('still shows someone else’s bot opened from a link, as not the person’s own', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.endsWith('/talk')
          ? { ok: true, json: async () => home([]) }
          : { ok: true, json: async () => ({ data: { title: 'Pitch Coach' } }) }
      )
    );
    const { TalkHome } = await import('@/components/companions/talk/TalkHome');
    render(<TalkHome />);
    await waitFor(() => expect(seen.rows.at(-1)?.id).toBe('bot-new'));
    expect(seen.rows.at(-1)?.mine).toBe(false);
  });
});
