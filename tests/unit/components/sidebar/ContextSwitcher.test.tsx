// @vitest-environment jsdom
/**
 * ContextSwitcher — the sidebar avatar must be a control, not a dead pixel.
 *
 * Visitors reported "this element should be clickable" twice, pointing at the
 * same <img class="rounded-md object-cover"> — once on /messages, once on
 * /profiles/<username>. It is one shared component, so one report is one bug;
 * the second arrived only because nothing guarded the first fix. These tests
 * are that guard: they assert the avatar is wrapped in a real control in both
 * sidebar states, and that clicking the collapsed one actually reaches the
 * caller — a button that expands nothing is still a dead pixel to a visitor.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ContextSwitcher } from '@/components/sidebar/ContextSwitcher';
import { useNavigationContext } from '@/hooks/useNavigationContext';
import type { Profile } from '@/types/database';

import type { Mock } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  ),
}));

vi.mock('@/components/nostr/NWCStatusBadge', () => ({
  NWCStatusBadge: () => null,
}));

vi.mock('@/hooks/useNavigationContext', () => ({
  useNavigationContext: vi.fn(),
}));

const mockUseNavigationContext = useNavigationContext as Mock;

const profile = {
  id: 'user-1',
  username: 'mao',
  name: 'Cato',
  avatar_url: 'https://example.test/avatar.png',
} as unknown as Profile;

beforeEach(() => {
  mockUseNavigationContext.mockReturnValue({
    context: { type: 'individual' },
    userGroups: [],
    loadingGroups: false,
    switchToIndividual: vi.fn(),
    switchToGroup: vi.fn(),
    isGroupContext: false,
  });
});

describe('ContextSwitcher avatar is clickable', () => {
  it('wraps the collapsed avatar in a control', () => {
    render(<ContextSwitcher profile={profile} isExpanded={false} />);

    const avatar = screen.getByAltText('Cato');
    expect(avatar.closest('button')).toBeInTheDocument();
  });

  it('tells the sidebar to expand when the collapsed avatar is clicked', () => {
    const onExpand = vi.fn();
    render(<ContextSwitcher profile={profile} isExpanded={false} onExpand={onExpand} />);

    fireEvent.click(screen.getByAltText('Cato').closest('button')!);

    // Collapsed mode returns before the dropdown renders, so opening the
    // switcher is only visible to the user if the sidebar expands too.
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('names the collapsed control for screen readers and hover', () => {
    render(<ContextSwitcher profile={profile} isExpanded={false} />);

    const button = screen.getByAltText('Cato').closest('button')!;
    expect(button).toHaveAccessibleName(/Cato/);
  });

  it('wraps the expanded avatar in the switcher trigger', () => {
    render(<ContextSwitcher profile={profile} isExpanded />);

    const avatar = screen.getByAltText('Cato');
    expect(avatar.closest('button')).toBeInTheDocument();
  });

  it('opens the switcher when the expanded avatar is clicked', () => {
    render(<ContextSwitcher profile={profile} isExpanded />);

    expect(screen.queryByText('Personal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByAltText('Cato').closest('button')!);

    expect(screen.getByText('Personal')).toBeInTheDocument();
  });
});
