// @vitest-environment jsdom
/**
 * A companion's profile offers Talk to everyone (routing the signed-out
 * through login with a way back), Clone to the signed-in, and Edit to the
 * owner only. It says plainly whether the companion is private or public.
 */

import { render, screen } from '@testing-library/react';
import { CompanionActions } from '@/components/companions/CompanionActions';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const base = { id: 'c1', isPublic: true, conversations: 3, clonedFrom: null };

describe('CompanionActions', () => {
  it('shows Edit only to the owner', () => {
    const { rerender } = render(<CompanionActions {...base} isOwner={false} isSignedIn />);
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
    rerender(<CompanionActions {...base} isOwner isSignedIn />);
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/dashboard/companions/create?edit=c1'
    );
  });

  it('sends the signed-out through login and back to the room', () => {
    render(<CompanionActions {...base} isOwner={false} isSignedIn={false} />);
    const talk = screen.getByRole('link', { name: 'Talk' });
    expect(talk.getAttribute('href')).toContain('/auth?mode=login&from=');
    expect(decodeURIComponent(talk.getAttribute('href') ?? '')).toContain('/companions/c1/talk');
  });

  it('links the signed-in straight to the room and offers Clone', () => {
    render(<CompanionActions {...base} isOwner={false} isSignedIn />);
    expect(screen.getByRole('link', { name: 'Talk' })).toHaveAttribute(
      'href',
      '/companions/c1/talk'
    );
    expect(screen.getByRole('button', { name: 'Clone' })).toBeEnabled();
  });

  it('says private or public, and where a clone came from', () => {
    const { rerender } = render(<CompanionActions {...base} isPublic={false} isOwner isSignedIn />);
    expect(screen.getByText(/Private/)).toBeInTheDocument();
    rerender(<CompanionActions {...base} clonedFrom="src-9" isOwner isSignedIn />);
    expect(screen.getByText(/Public/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cloned from/ })).toHaveAttribute(
      'href',
      '/companions/src-9'
    );
  });
});
