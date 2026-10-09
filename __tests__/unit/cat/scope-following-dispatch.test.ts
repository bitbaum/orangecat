/**
 * scope "following" on the TOOL-CALL path: search_platform and explore_topic
 * both route to the follow-graph search — never to the platform-wide search or
 * the embedding-backed explorer — and pass the window and narrowing through.
 */

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const mockSearchFollowing = vi.fn();
vi.mock('@/services/cat/following-scope', async importActual => ({
  ...(await importActual<typeof import('@/services/cat/following-scope')>()),
  searchFollowing: (...args: unknown[]) => mockSearchFollowing(...args),
}));

const mockSearchPlatform = vi.fn();
vi.mock('@/services/cat/platform-search', () => ({
  searchPlatform: (...args: unknown[]) => mockSearchPlatform(...args),
}));

const mockExploreTopic = vi.fn();
vi.mock('@/services/cat/discovery', () => ({
  exploreTopic: (...args: unknown[]) => mockExploreTopic(...args),
  formatDiscoveryForModel: () => '',
}));

import { executeToolCall } from '@/services/cat/tool-executor';

const call = (name: string, args: Record<string, unknown>) =>
  ({ id: 'tc-1', function: { name, arguments: JSON.stringify(args) } }) as never;

const RESULT = {
  query: 'Lightning',
  days: 7,
  followingCount: 2,
  posts: [
    {
      id: 'p1',
      url: '/post/p1',
      author: '@alice',
      text: 'Opened a Lightning channel',
      postedAt: '2026-10-08T10:00:00+00:00',
    },
  ],
  entities: [],
  people: [],
};

beforeEach(() => {
  mockSearchFollowing.mockReset().mockResolvedValue(RESULT);
  mockSearchPlatform.mockReset();
  mockExploreTopic.mockReset();
});

it('search_platform with scope "following" searches only the follow graph', async () => {
  const onToolCall = vi.fn();
  const msg = await executeToolCall(
    {} as never,
    'me',
    call('search_platform', { query: 'Lightning', scope: 'following', days: 7 }),
    'what did people I follow post about Lightning this week?',
    onToolCall
  );
  expect(mockSearchFollowing).toHaveBeenCalledWith({}, 'me', 'Lightning', {
    searchType: 'all',
    days: 7,
  });
  expect(mockSearchPlatform).not.toHaveBeenCalled();
  expect(msg.content).toContain('@alice');
  expect(msg.content).toContain('people the user follows');
  expect(onToolCall).toHaveBeenLastCalledWith(
    expect.objectContaining({ status: 'completed', resultCount: 1 })
  );
});

it('explore_topic with scope "following" never reaches the embedding explorer', async () => {
  await executeToolCall(
    {} as never,
    'me',
    call('explore_topic', { topic: 'Lightning', scope: 'following', entityType: 'project' }),
    'what are people I follow building around Lightning?'
  );
  expect(mockSearchFollowing).toHaveBeenCalledWith({}, 'me', 'Lightning', {
    entityType: 'project',
    days: undefined,
  });
  expect(mockExploreTopic).not.toHaveBeenCalled();
});

it('without the scope, search stays platform-wide', async () => {
  mockSearchPlatform.mockResolvedValue([]);
  await executeToolCall({} as never, 'me', call('search_platform', { query: 'x' }), 'find x');
  expect(mockSearchPlatform).toHaveBeenCalled();
  expect(mockSearchFollowing).not.toHaveBeenCalled();
});

it('a failed follow search is reported as failed, not as "nothing posted"', async () => {
  mockSearchFollowing.mockRejectedValue(new Error('boom'));
  const msg = await executeToolCall(
    {} as never,
    'me',
    call('search_platform', { query: '', scope: 'following' }),
    'anything from my follows?'
  );
  expect(msg.content).toMatch(/did not run/);
});
