// @vitest-environment jsdom
/**
 * ContextSwitcher — collapsed-sidebar avatar must be interactive.
 *
 * Visitor feedback (2026-08-23, /messages): the collapsed sidebar avatar was a
 * plain <div>, a dead pixel. It must be a button that expands the sidebar and
 * opens the context-switcher dropdown — the same action the avatar performs in
 * expanded mode.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ContextSwitcher } from '@/components/sidebar/ContextSwitcher';
import type { Profile } from '@/types/database';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} />,
}));
vi.mock('@/components/nostr/NWCStatusBadge', () => ({ NWCStatusBadge: () => null }));
vi.mock('@/hooks/useNavigationContext', () => ({
  useNavigationContext: () => ({
    context: { type: 'individual' },
    userGroups: [],
    loadingGroups: false,
    switchToIndividual: vi.fn(),
    switchToGroup: vi.fn(),
    isGroupContext: false,
  }),
}));

const profile = {
  id: 'user-1',
  username: 'mao',
  name: 'Mao',
  avatar_url: 'https://example.com/avatar.png',
} as unknown as Profile;

describe('ContextSwitcher — collapsed mode', () => {
  it('renders the avatar as a button that expands the sidebar', () => {
    const onExpand = vi.fn();
    render(<ContextSwitcher profile={profile} isExpanded={false} onExpand={onExpand} />);

    const avatarButton = screen.getByRole('button', { name: /switch context/i });
    expect(avatarButton).toContainElement(screen.getByAltText('Mao'));

    fireEvent.click(avatarButton);
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('opens the switcher dropdown once the sidebar re-renders expanded', () => {
    const { rerender } = render(
      <ContextSwitcher profile={profile} isExpanded={false} onExpand={() => {}} />
    );

    fireEvent.click(screen.getByRole('button', { name: /switch context/i }));
    rerender(<ContextSwitcher profile={profile} isExpanded={true} onExpand={() => {}} />);

    // The dropdown's "Personal" entry is only rendered while the switcher is open
    expect(screen.getByText('Personal')).toBeInTheDocument();
  });
});
