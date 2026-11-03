// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react';
import { TurnFailure } from '@/components/ai-chat/ModernChatPanel/components/TurnFailure';

const flags = vi.hoisted(() => ({ open: false, ready: false }));
vi.mock('@/config/commerce', () => ({
  get PAID_PLANS_OPEN() {
    return flags.open;
  },
}));
vi.mock('@/config/features', () => ({
  FEATURES: {
    get catCreditsLive() {
      return flags.ready;
    },
  },
}));
vi.mock('@/components/ai-chat/CatStatusNote', () => ({ CatStatusButton: () => null }));
vi.mock('@/components/ui/Button', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(() => {
  cleanup();
  flags.open = false;
  flags.ready = false;
});

it('does not send a failed user to a closed or unconfigured top-up', () => {
  flags.open = true;
  render(<TurnFailure failure={{ kind: 'AI_RATE_LIMITED', message: 'Busy' } as never} />);
  expect(screen.getByRole('link', { name: 'Add a free key' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Top up Cat Credits' })).toBeNull();
});

it('offers top-up only when commerce and the credit rail are enabled', () => {
  flags.open = true;
  flags.ready = true;
  render(<TurnFailure failure={{ kind: 'AI_RATE_LIMITED', message: 'Busy' } as never} />);
  expect(screen.getByRole('link', { name: 'Top up Cat Credits' })).toBeTruthy();
});
