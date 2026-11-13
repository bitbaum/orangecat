// @vitest-environment jsdom
/**
 * One share row everywhere — `ShareRow` from @bitbaum/bip-kit through
 * src/components/sharing/ShareRow.tsx. A public wall post: "Repost on
 * OrangeCat" first (the repost flow in place, or sign-up and back when signed
 * out), then copy link and every service, as verbs. Not public: copy link
 * only, with the note that says the link opens only for people who can
 * already see it. Profiles and entities use the same row.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/BottomSheet', () => ({
  default: ({ isOpen, children }: { isOpen: boolean; children: ReactNode }) =>
    isOpen ? <div>{children}</div> : null,
}));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }));

import ShareContent from '@/components/sharing/ShareContent';
import { PostShareSheet } from '@/components/timeline/PostShareSheet';
import type { TimelineDisplayEvent } from '@/types/timeline';

function post(visibility: string): TimelineDisplayEvent {
  return {
    id: 'abc',
    visibility,
    title: '',
    description: 'Hello',
    actor: { name: 'Ada', username: 'ada' },
  } as unknown as TimelineDisplayEvent;
}

const items = () => screen.getAllByRole('listitem').map(li => li.textContent);

describe('sharing a wall post', () => {
  it('offers a public post to every service, repost first, in place when signed in', () => {
    const onClose = vi.fn();
    const onRepost = vi.fn();
    render(
      <PostShareSheet
        event={post('public')}
        isOpen
        onClose={onClose}
        signedIn
        onRepost={onRepost}
      />
    );
    expect(items()[0]).toBe('Repost on OrangeCat');
    expect(items()).toContain('Copy link');
    expect(screen.getByRole('link', { name: 'Share on X' }).getAttribute('href')).toContain(
      encodeURIComponent('/post/abc')
    );
    expect(screen.getByRole('link', { name: 'Send on WhatsApp' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Email it' })).not.toHaveAttribute('target');

    fireEvent.click(screen.getByRole('button', { name: 'Repost on OrangeCat' }));
    expect(onClose).toHaveBeenCalled();
    expect(onRepost).toHaveBeenCalled();
  });

  it('signed out, "Repost on OrangeCat" goes to sign-up in this tab and comes back', () => {
    render(<PostShareSheet event={post('public')} isOpen onClose={() => {}} signedIn={false} />);
    const repost = screen.getByRole('link', { name: 'Repost on OrangeCat' });
    expect(repost.getAttribute('href')).toBe('/auth?mode=register&from=%2Fpost%2Fabc');
    expect(repost).not.toHaveAttribute('target');
  });

  it('offers a non-public post as a link to copy, and says who it will open for', () => {
    render(<PostShareSheet event={post('followers')} isOpen onClose={() => {}} signedIn />);
    expect(items()).toEqual(['Copy link']);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText(/Only people who can already see this/)).toBeInTheDocument();
  });
});

describe('sharing a profile or entity', () => {
  it('uses the same row: copy link and every service, named for what it shares', () => {
    render(
      <ShareContent
        title="Ana on OrangeCat"
        description="Ana's profile"
        url="https://orangecat.ch/profiles/ana"
        titleText="Share profile"
      />
    );
    expect(screen.getByRole('navigation', { name: 'Share profile' })).toBeInTheDocument();
    expect(items()).toContain('Copy link');
    expect(screen.getByRole('link', { name: 'Share on LinkedIn' })).toBeInTheDocument();
  });
});
