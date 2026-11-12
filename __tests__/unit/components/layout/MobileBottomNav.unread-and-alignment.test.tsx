// @vitest-environment jsdom
/**
 * The phone tab bar, measured on production at 390px (2026-11-12):
 *
 * - The header hides its Messages button below md because "the bottom tab bar
 *   already carries Messages", and the config gives that tab
 *   `counter: 'messages'` — but the bar never read the counter. The Messages
 *   tab was an icon and a word, with no count and no count in its name, so a
 *   phone showed unread messages nowhere.
 * - The raised tab's label ('Receive' signed in, 'Create' signed out) was
 *   pushed to the bottom of its button with `mt-auto` while every other label
 *   sits under a centred icon: 640px against 634px. Its circle is lifted out
 *   of flow, so an icon-sized spacer has to hold the icon's place.
 */
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import MobileBottomNav from '@/components/layout/MobileBottomNav';

let mockUser: { id: string } | null = { id: 'user-1' };
let mockUnread = 0;
let mockCompact = false;

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser, hydrated: true }) }));
vi.mock('@/hooks/useHeaderScroll', () => ({
  useBottomNavScroll: () => ({ isCompact: mockCompact }),
}));
vi.mock('@/hooks/useSoftKeyboard', () => ({ useSoftKeyboard: () => false }));
vi.mock('@/contexts/ComposerContext', () => ({ useComposer: () => ({ openComposer: vi.fn() }) }));
vi.mock('@/components/create/VoiceCreate', () => ({ VoiceCreate: () => null }));
vi.mock('@/stores/messaging', () => ({ useUnreadCount: () => mockUnread }));

beforeEach(() => {
  mockUser = { id: 'user-1' };
  mockUnread = 0;
  mockCompact = false;
});

describe('Messages tab carries the unread count', () => {
  it('shows the count on the tab and says it in the name', () => {
    mockUnread = 3;
    render(<MobileBottomNav />);
    const tab = screen.getByRole('button', { name: 'Messages (3 unread)' });
    expect(tab).toHaveTextContent('3');
  });

  it('caps the number the way the header and sidebar do', () => {
    mockUnread = 150;
    render(<MobileBottomNav />);
    expect(screen.getByRole('button', { name: 'Messages (150 unread)' })).toHaveTextContent('99+');
  });

  it('is a plain Messages tab when nothing is unread', () => {
    render(<MobileBottomNav />);
    const tab = screen.getByRole('button', { name: 'Messages' });
    expect(tab).toHaveTextContent(/^Messages$/);
  });

  it('puts the count on no other tab', () => {
    mockUnread = 3;
    render(<MobileBottomNav />);
    for (const name of ['Cat', 'Home', 'Receive', 'Create']) {
      expect(screen.getByRole('button', { name })).not.toHaveTextContent('3');
    }
  });
});

describe('the raised tab labels on the same line as the others', () => {
  const iconSize = (el: Element | null) =>
    (el?.getAttribute('class') ?? '')
      .split(/\s+/)
      .filter(c => /^[hw]-\d+$/.test(c))
      .sort();

  it.each([
    ['signed in, full', { id: 'user-1' }, false, 'Receive', 'Home'],
    ['signed in, compact', { id: 'user-1' }, true, 'Receive', 'Home'],
    ['signed out, full', null, false, 'Create', 'Home'],
  ])('%s', (_case, user, compact, raised, neighbour) => {
    mockUser = user;
    mockCompact = compact;
    render(<MobileBottomNav />);

    const label = screen.getByText(raised, { selector: 'span' });
    expect(label.className).not.toMatch(/\bmt-auto\b/);

    // In flow before the label: something exactly as big as a neighbour's icon.
    const spacer = label.previousElementSibling;
    expect(spacer?.tagName).toBe('SPAN');
    expect(spacer).toHaveAttribute('aria-hidden', 'true');
    const neighbourIcon = screen.getByRole('button', { name: neighbour }).querySelector('svg');
    expect(iconSize(spacer)).toEqual(iconSize(neighbourIcon));
    expect(iconSize(spacer)).toHaveLength(2);
  });
});
