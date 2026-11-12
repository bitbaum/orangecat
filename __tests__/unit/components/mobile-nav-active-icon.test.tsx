// @vitest-environment jsdom
/**
 * The active tab's icon was given `fill-current`. The icons are stroke
 * drawings, so a fill in the stroke's own colour hid every inner line: on
 * production (390px, 2026-11-12) the active Explore tab was a blank white disc
 * where a compass should be. The active tab is marked by weight and its
 * label, never by a fill.
 */
import { render, screen } from '@testing-library/react';
import MobileBottomNav from '@/components/layout/MobileBottomNav';

vi.mock('next/navigation', () => ({
  usePathname: () => '/discover',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, hydrated: true }) }));
vi.mock('@/hooks/useHeaderScroll', () => ({ useBottomNavScroll: () => ({ isCompact: false }) }));
vi.mock('@/hooks/useSoftKeyboard', () => ({ useSoftKeyboard: () => false }));
vi.mock('@/contexts/ComposerContext', () => ({ useComposer: () => ({ openComposer: vi.fn() }) }));
vi.mock('@/components/create/VoiceCreate', () => ({ VoiceCreate: () => null }));

it('the active tab keeps its icon drawn: marked as current, never filled solid', () => {
  render(<MobileBottomNav />);
  const active = screen.getByRole('button', { current: 'page' });
  expect(active).toHaveAccessibleName('Explore');
  const icon = active.querySelector('svg');
  expect(icon).not.toBeNull();
  expect(icon?.getAttribute('class') ?? '').not.toMatch(/\bfill-current\b/);
});
