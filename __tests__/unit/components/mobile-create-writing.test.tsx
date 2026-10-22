// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MobileBottomNav from '@/components/layout/MobileBottomNav';

const { openComposer } = vi.hoisted(() => ({ openComposer: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'writer' }, hydrated: true }) }));
vi.mock('@/hooks/useHeaderScroll', () => ({ useBottomNavScroll: () => ({ isCompact: false }) }));
vi.mock('@/hooks/useSoftKeyboard', () => ({ useSoftKeyboard: () => false }));
vi.mock('@/contexts/ComposerContext', () => ({ useComposer: () => ({ openComposer }) }));
vi.mock('@/components/create/VoiceCreate', () => ({ VoiceCreate: () => null }));

it('the mobile home plus lets a writer choose an article without opening the short-post composer', async () => {
  const user = userEvent.setup();
  render(<MobileBottomNav />);
  await user.click(screen.getByRole('button', { name: 'Create' }));
  expect(screen.getByRole('link', { name: 'Article' })).toHaveAttribute('href', '/articles/new');
  expect(screen.getByRole('link', { name: 'Post' })).toHaveAttribute(
    'href',
    '/timeline?compose=true'
  );
  expect(openComposer).not.toHaveBeenCalled();
  await user.click(screen.getByRole('link', { name: 'Article' }));
  expect(screen.queryByRole('link', { name: 'Article' })).not.toBeInTheDocument();
});
