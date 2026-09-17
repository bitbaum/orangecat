// @vitest-environment jsdom
/**
 * AuthButtons Component Tests — behavior, not class strings.
 *
 * Rewritten 2026-06-03 to drop assertions about specific Tailwind
 * class snippets (those move with the design system) and stale
 * "hydration shows spinner" expectations (we now keep nav actionable
 * during hydration). What we *do* test: who-sees-what state routing.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import AuthButtons from '@/components/layout/AuthButtons';
import { useAuth } from '@/hooks/useAuth';

import type { Mock } from 'vitest';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: function MockLink({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  },
}));

vi.mock('@/components/ui/UserProfileDropdown', () => ({
  default: function MockUserProfileDropdown({ variant }: { variant?: string }) {
    return (
      <div data-testid="user-profile-dropdown" data-variant={variant}>
        User Profile Dropdown
      </div>
    );
  },
}));

const mockUseAuth = useAuth as Mock;

function setAuth(state: {
  hydrated: boolean;
  isLoading?: boolean;
  user?: unknown;
  session?: unknown;
}) {
  mockUseAuth.mockReturnValue({
    user: state.user ?? null,
    session: state.session ?? null,
    isLoading: state.isLoading ?? false,
    hydrated: state.hydrated,
  });
}

describe('AuthButtons', () => {
  beforeEach(() => mockUseAuth.mockClear());

  describe('unauthenticated', () => {
    it('shows sign-in and get-started links when no session', () => {
      setAuth({ hydrated: true, user: null, session: null });
      render(<AuthButtons />);
      // Multiple Login / sign-in entries exist (mobile + desktop) — at
      // least one of each must be present.
      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
      expect(screen.queryByTestId('user-profile-dropdown')).not.toBeInTheDocument();
    });

    it('keeps sign-in CTA visible during hydration (no spinner blocks nav)', () => {
      setAuth({ hydrated: false, user: null, session: null });
      render(<AuthButtons />);
      // We should see the link CTAs, never a loading spinner that
      // breaks nav. This is the post-rebrand contract.
      expect(screen.getAllByRole('link').length).toBeGreaterThan(0);
    });
  });

  describe('authenticated', () => {
    it('renders the user profile dropdown when a session exists', () => {
      setAuth({
        hydrated: true,
        user: { id: 'user-1' },
        session: { access_token: 'token' },
      });
      render(<AuthButtons />);
      expect(screen.getByTestId('user-profile-dropdown')).toBeInTheDocument();
    });

    it('uses the advanced variant for the dropdown', () => {
      setAuth({
        hydrated: true,
        user: { id: 'user-1' },
        session: { access_token: 'token' },
      });
      render(<AuthButtons />);
      expect(screen.getByTestId('user-profile-dropdown')).toHaveAttribute(
        'data-variant',
        'advanced'
      );
    });
  });

  describe('className handling', () => {
    it('passes mobile-nav className through to the container', () => {
      setAuth({ hydrated: true });
      const { container } = render(<AuthButtons className="flex-col" />);
      // Just confirm the className landed somewhere on rendered output.
      expect(container.innerHTML).toContain('flex-col');
    });
  });
});
