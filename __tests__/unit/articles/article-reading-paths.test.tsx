// @vitest-environment jsdom
/**
 * Reading an article on orangecat.ch (2026-11-12): "Sign in to join the
 * conversation" returned the reader to the /articles index on every article,
 * through a 17px-tall link; the Share button was 34px tall on phones.
 */
import { render, screen } from '@testing-library/react';
import ArticleDiscussion from '@/app/(public)/articles/[slug]/ArticleDiscussion';
import { PostShareRow } from '@/components/sharing/PostShareRow';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, profile: null }) }));
vi.mock('@/hooks/usePostThread', () => ({
  usePostThread: () => ({ replies: [], isLoading: false, error: null, refresh: vi.fn() }),
}));

describe('reading an article', () => {
  it('signing in to comment brings the reader back to this article’s comments', () => {
    render(
      <ArticleDiscussion articleId="a1" authorName="Cato" articlePath="/articles/one-star-c4w71w" />
    );
    const link = screen.getByRole('link', { name: 'Sign in' });
    const from = new URL(link.getAttribute('href') ?? '', 'https://x').searchParams.get('from');
    expect(from).toBe('/articles/one-star-c4w71w#discussion-heading');
    expect(link.className).toContain('min-h-11');
  });

  it('every way to share is a 44px target like the links beside it', () => {
    render(<PostShareRow isPublic title="One star" url="https://orangecat.ch/articles/one-star" />);
    const targets = [...screen.getAllByRole('button'), ...screen.getAllByRole('link')];
    expect(targets.length).toBeGreaterThan(1);
    for (const target of targets) {
      expect(target.className).toContain('min-h-11');
    }
  });
});
