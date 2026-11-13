// @vitest-environment jsdom
/**
 * Onboarding has a way out, and says only what it does.
 *
 * On orangecat.ch a signed-in person who had not written a bio was sent to
 * "Tell Cat who you are" on every visit to `/`, with no skip; in a fresh tab
 * its Back went to about:blank. The copy promised Cat would "set them up" and
 * create offers "in one click", where the button opens a create form with
 * only the description filled in. The example chips were cut at 50 characters
 * ("start sellin…").
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntelligentOnboarding from '@/components/onboarding/IntelligentOnboarding';
import { ProfileService } from '@/services/profile';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { ONBOARDING_METHOD } from '@/config/onboarding';
import { ROUTES } from '@/config/routes';

const router = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/onboarding/intelligent',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, profile: null }),
}));
vi.mock('@/services/profile', () => ({
  ProfileService: { fallbackProfileUpdate: vi.fn() },
}));
vi.mock('@/hooks/useCatHealth', () => ({
  useCatHealth: () => ({ health: null, probe: vi.fn() }),
}));
// The paste step has its own test; here it only needs to move on.
vi.mock('@/components/onboarding/OnboardingPay', () => ({
  OnboardingPay: ({ onDone }: { onDone: () => void }) => (
    <button type="button" onClick={() => onDone()}>
      Not now
    </button>
  ),
}));

const fallbackProfileUpdate = vi.mocked(ProfileService.fallbackProfileUpdate);

// The three shown (auth-firstrun #2: three whole sentences, one per row).
const FULL_EXAMPLES = [
  "I'm a freelance graphic designer looking to find clients and sell design templates",
  'I run a small community garden and want to raise funds for seeds and equipment',
  'I make handmade jewellery and want to start selling online',
];

beforeEach(() => {
  vi.clearAllMocks();
  fallbackProfileUpdate.mockResolvedValue({ success: true, data: null });
  delete (window as { navigation?: unknown }).navigation;
});

describe('a way out of onboarding', () => {
  it('records the skip before leaving, so / stops sending them back', async () => {
    let finishWrite: (value: { success: boolean }) => void = () => undefined;
    fallbackProfileUpdate.mockReturnValue(
      new Promise(resolve => {
        finishWrite = resolve;
      })
    );
    render(<IntelligentOnboarding />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Skip for now' }));

    expect(fallbackProfileUpdate).toHaveBeenCalledWith('user-1', {
      onboarding_completed: true,
      onboarding_method: ONBOARDING_METHOD.SKIPPED,
    });
    expect(router.push).not.toHaveBeenCalled();

    await act(async () => finishWrite({ success: true }));
    expect(router.push).toHaveBeenCalledWith(ROUTES.DASHBOARD.CAT);
  });

  it('Back on a page opened fresh goes to the Cat, not off the site', async () => {
    render(<IntelligentOnboarding />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Back' }));

    expect(router.back).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(ROUTES.DASHBOARD.CAT);
  });

  it('Back goes back when the page behind is ours', async () => {
    (window as { navigation?: unknown }).navigation = { canGoBack: true };
    render(<IntelligentOnboarding />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Back' }));

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('onboarding says what it does', () => {
  it('shows each example whole, one full-width row each, never cut mid-word', () => {
    render(<IntelligentOnboarding />);

    for (const example of FULL_EXAMPLES) {
      const row = screen.getByRole('button', { name: example });
      expect(row.textContent).toBe(example);
      expect(row.className).toMatch(/\bw-full\b/);
      expect(row.className).toMatch(/\bmin-h-11\b/);
      expect(row.querySelector('.line-clamp-2')).toBeNull();
    }
    expect(screen.queryByText(/…$/)).toBeNull();
  });

  it('gives the description field the column, not the browser default width', () => {
    render(<IntelligentOnboarding />);
    const field = screen.getByRole('textbox', { name: 'Who are you? What do you do?' });
    // Textarea's own wrapper div, then the flex child that must grow.
    expect(field.parentElement?.parentElement?.className).toMatch(/\bflex-1\b/);
  });

  it('does not promise that Cat sets offers up or creates them in one click', async () => {
    const offer = {
      entityType: 'service',
      description: 'Logo and brand identity design for small businesses.',
      rationale: 'You design.',
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { offers: [offer] } }), { status: 200 })
    );
    const user = userEvent.setup();
    render(<IntelligentOnboarding />);

    expect(document.body.textContent).not.toMatch(/set them up/i);

    await user.type(screen.getByTestId('onboarding-display-name'), 'Ana');
    await user.type(screen.getByTestId('onboarding-description'), 'I design logos.');
    await user.click(screen.getByTestId('onboarding-see-offers'));
    await user.click(screen.getByRole('button', { name: 'Not now' }));

    const open = await screen.findByRole('link', { name: /Fill in the rest/ });
    expect(open.getAttribute('href')).toBe(
      `${ENTITY_REGISTRY.service.createPath}?description=${encodeURIComponent(offer.description)}`
    );
    await waitFor(() => expect(screen.queryByText(/one click/i)).toBeNull());
    expect(screen.queryByText(/Create this/)).toBeNull();
  });
});
