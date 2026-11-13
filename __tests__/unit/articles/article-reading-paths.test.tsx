// @vitest-environment jsdom
/**
 * Reading an article on orangecat.ch (2026-11-12): "Sign in to join the
 * conversation" returned the reader to the /articles index on every article,
 * through a 17px-tall link; the Share button was 34px tall on phones.
 */
import { render, screen } from '@testing-library/react';
import ArticleDiscussion from '@/app/(public)/articles/[slug]/ArticleDiscussion';
import ShareButton from '@/app/(public)/articles/[slug]/ShareButton';

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

  it('the Share button is a 44px target like the links beside it', () => {
    render(<ShareButton title="One star" url="https://orangecat.ch/articles/one-star" />);
    expect(screen.getByRole('button', { name: /share/i }).className).toContain('min-h-11');
  });
});
