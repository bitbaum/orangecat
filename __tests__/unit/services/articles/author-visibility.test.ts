import {
  getArticleBySlug,
  isCurrentUserArticleAuthor,
  listArticlesByAuthor,
} from '@/services/articles/get-article';

const mock = vi.hoisted(() => ({
  userId: 'profile-owner' as string | null,
  article: null as unknown,
  rows: [] as unknown[],
  from: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: mock.from,
    auth: { getUser: async () => ({ data: { user: mock.userId ? { id: mock.userId } : null } }) },
  }),
}));

function query(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    returns: vi.fn().mockResolvedValue({ data: mock.rows, error: null }),
  };
}
let articles: ReturnType<typeof query>;
let follows: ReturnType<typeof query>;
beforeEach(() => {
  mock.userId = 'profile-owner';
  mock.article = {
    id: 'event',
    title: 'A private article',
    description: '',
    visibility: 'private',
    event_timestamp: '2026-10-22T00:00:00Z',
    is_deleted: false,
    actor_id: 'profile-owner',
    actor_data: { id: 'profile-owner', username: 'author' },
    metadata: { is_article: true, article: { slug: 'article', body: 'Written words' } },
  };
  mock.rows = [];
  articles = query({ data: mock.article, error: null });
  follows = query({ data: null, error: null });
  mock.from.mockImplementation(table => (table === 'follows' ? follows : articles));
});
afterEach(() => vi.clearAllMocks());

it('lets the author read using the profile FK without a separate actor lookup', async () => {
  expect(await getArticleBySlug('article')).toMatchObject({ authorProfileId: 'profile-owner' });
  expect(await isCurrentUserArticleAuthor('profile-owner')).toBe(true);
  expect(mock.from).not.toHaveBeenCalledWith('actors');
});
it.each(['other-profile', null])('denies a private article to %s', async userId => {
  mock.userId = userId;
  expect(await getArticleBySlug('article')).toBeNull();
  expect(await isCurrentUserArticleAuthor('profile-owner')).toBe(false);
});
it('lets an authenticated follower read followers-only content', async () => {
  mock.userId = 'follower';
  (mock.article as { visibility: string }).visibility = 'followers';
  follows.maybeSingle.mockResolvedValue({ data: { follower_id: 'follower' }, error: null });
  expect(await getArticleBySlug('article')).not.toBeNull();
  expect(follows.eq).toHaveBeenCalledWith('following_id', 'profile-owner');
});
it.each([
  { data: null, error: null },
  { data: null, error: { message: 'Unavailable' } },
])('fails closed without a confirmed follower relationship', async result => {
  mock.userId = 'other-profile';
  (mock.article as { visibility: string }).visibility = 'followers';
  follows.maybeSingle.mockResolvedValue(result);
  expect(await getArticleBySlug('article')).toBeNull();
});
it('queries author lists by profile ID and does not trust an include-private flag from another viewer', async () => {
  mock.userId = 'other-profile';
  await listArticlesByAuthor('profile-owner', { includeNonPublic: true });
  expect(articles.eq).toHaveBeenCalledWith('actor_id', 'profile-owner');
  expect(articles.eq).toHaveBeenCalledWith('visibility', 'public');
  expect(mock.from).not.toHaveBeenCalledWith('actors');
});
it('rejects an unknown visibility rather than treating it as public', async () => {
  (mock.article as { visibility: string | null }).visibility = null;
  expect(await getArticleBySlug('article')).toBeNull();
});
