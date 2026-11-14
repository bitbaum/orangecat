// @vitest-environment jsdom
/**
 * One face per author, wherever a post author is drawn:
 * - the Cat always wears its own face (it had three: the brand mark in a
 *   thread, a "C" in the picker and on its share card, the placeholder kitten
 *   on its profile);
 * - a nameless account is never a letter taken from its minted handle.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';

import AvatarLink from '@/components/ui/AvatarLink';
import { CatAvatar } from '@/components/cat/CatAvatar';
import CatIsAnswering from '@/components/timeline/CatIsAnswering';
import { PostHeader } from '@/components/timeline/PostHeader';
import { CAT_AVATAR_SRC, CAT_USERNAME, avatarUrlFor } from '@/config/cat-identity';
import type { TimelineDisplayEvent } from '@/types/timeline';

describe('the Cat has one face', () => {
  it('draws the brand icon tile, named for a screen reader', () => {
    const { container } = render(<CatAvatar size={40} />);
    const face = container.querySelector('[data-cat-avatar]');
    expect(face?.getAttribute('aria-label')).toBe('Cat');
    expect(face?.querySelector('svg rect')).toBeTruthy();
    expect(face?.querySelectorAll('svg path').length).toBeGreaterThan(0);
  });

  it('is what an avatar link draws for the Cat, whatever picture its row holds', () => {
    const { container } = render(
      <AvatarLink username={CAT_USERNAME} avatarUrl="https://example.com/other.png" name="Cat" />
    );
    expect(container.querySelector('[data-cat-avatar]')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('is what the answering row draws, with the neutral AI chip (not orange)', () => {
    const { container, getByText } = render(<CatIsAnswering />);
    expect(container.querySelector('[data-cat-avatar]')).toBeTruthy();
    expect(getByText('AI').className).not.toMatch(/accent-warm/);
  });

  it('has the same drawing as a picture URL, for slots that only take one', () => {
    expect(avatarUrlFor('cat', null)).toBe(CAT_AVATAR_SRC);
    expect(avatarUrlFor('Cat', 'https://example.com/other.png')).toBe(CAT_AVATAR_SRC);
    expect(avatarUrlFor('mao', 'https://example.com/mao.png')).toBe('https://example.com/mao.png');
    expect(avatarUrlFor('mao', null)).toBeNull();
    expect(existsSync(join(process.cwd(), 'public', CAT_AVATAR_SRC))).toBe(true);
  });
});

describe('a nameless account on an avatar plate', () => {
  it('shows a person glyph, not the letter of a minted handle', () => {
    const { container } = render(
      <AvatarLink username="user_df091395b2ca" name="user_df091395b2ca" userId="abc" />
    );
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/profiles/user_df091395b2ca');
    expect(link?.getAttribute('title')).toBe("View An OrangeCat member's profile");
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.textContent).toBe('');
  });

  it('keeps the letter of a chosen name', () => {
    const { container } = render(<AvatarLink username="user_df091395b2ca" name="Mao Zhang" />);
    expect(container.textContent).toBe('M');
  });
});

describe('a feed card header', () => {
  const event = (actor: Record<string, unknown>, metadata: Record<string, unknown> = {}) =>
    ({
      id: 'e1',
      actor: { id: 'a1', type: 'user', ...actor },
      metadata,
      eventTimestamp: new Date().toISOString(),
    }) as unknown as TimelineDisplayEvent;

  it('signs a nameless account neutrally and prints no @line', () => {
    const { container } = render(
      <PostHeader event={event({ name: 'user_df091395b2ca', username: 'user_df091395b2ca' })} />
    );
    expect(container.textContent).toContain('An OrangeCat member');
    expect(container.textContent).not.toContain('user_df091395b2ca');
    expect(container.textContent).not.toContain('@');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/profiles/user_df091395b2ca');
  });

  it('prints a chosen name and handle', () => {
    const { container } = render(
      <PostHeader event={event({ name: 'Mao Zhang', username: 'mao' })} />
    );
    expect(container.textContent).toContain('Mao Zhang');
    expect(container.textContent).toContain('@mao');
  });

  it('applies the same rule to the original author of a repost', () => {
    const { container } = render(
      <PostHeader
        isSimpleRepost
        event={event(
          { name: 'Poster', username: 'poster' },
          { original_actor_name: 'user_aaaaaaaaaaaa', original_actor_username: 'user_aaaaaaaaaaaa' }
        )}
      />
    );
    expect(container.textContent).toContain('An OrangeCat member');
    expect(container.textContent).not.toContain('user_aaaaaaaaaaaa');
  });
});
