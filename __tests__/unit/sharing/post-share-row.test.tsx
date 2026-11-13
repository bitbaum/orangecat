// @vitest-environment jsdom
/**
 * The one share row for posts and articles. Public: repost here first, then
 * copy link and every service, as verbs. Not public: copy link only, with the
 * note that says the link opens only for people who can already see it.
 */
import { render, screen } from '@testing-library/react';
import { NON_PUBLIC_SHARE_NOTE, PostShareRow } from '@/components/sharing/PostShareRow';

const props = {
  url: 'https://orangecat.ch/post/abc',
  title: 'Ada: “Hello”',
  summary: 'Hello',
  crossPost: { label: 'Repost on OrangeCat', href: '/auth?mode=register&from=%2Fpost%2Fabc' },
};

describe('PostShareRow', () => {
  it('offers a public post to every service, cross-post first', () => {
    render(<PostShareRow {...props} isPublic />);
    const names = screen.getAllByRole('listitem').map(li => li.textContent);
    expect(names[0]).toBe('Repost on OrangeCat');
    expect(names).toContain('Copy link');
    expect(screen.getByRole('link', { name: 'Share on X' }).getAttribute('href')).toContain(
      encodeURIComponent(props.url)
    );
    expect(screen.getByRole('link', { name: 'Send on WhatsApp' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Email it' })).not.toHaveAttribute('target');
    expect(screen.queryByText(NON_PUBLIC_SHARE_NOTE)).toBeNull();
  });

  it('offers a non-public post as a link to copy, and says who it will open for', () => {
    render(<PostShareRow {...props} isPublic={false} />);
    expect(screen.getAllByRole('listitem').map(li => li.textContent)).toEqual(['Copy link']);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText(NON_PUBLIC_SHARE_NOTE)).toBeInTheDocument();
  });
});
