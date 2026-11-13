// @vitest-environment jsdom
/**
 * The /auth audit of 2026-11-12 (auth-firstrun #0, #8, #9, #10):
 *
 * - Sign in showed two orange buttons, and the first one CREATED A NEW
 *   ACCOUNT ("Start instantly"). One accent per side now: "Sign in" when
 *   signing in, "Start instantly" when creating an account.
 * - The switch between the two sides was a text link under the fold; it is a
 *   segmented control under the title.
 * - Provider buttons lost their names from 640px with only two providers.
 * - Every failure offered "Try Again", including an empty field or a wrong
 *   password; field problems now sit under the field, and the banner offers a
 *   retry only where the same attempt could work a moment later.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AuthPageClient from '@/app/auth/AuthPageClient';
import { AuthSocialLogin } from '@/app/auth/AuthSocialLogin';
import { AUTH_ERROR_COPY, describeAuthFailure, validateAuthFields } from '@/app/auth/authErrors';
import { landingAfterSignIn } from '@/lib/auth/landing';
import { ROUTES } from '@/config/routes';

vi.unmock('@/stores/auth');

let search = new URLSearchParams('');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => search,
  usePathname: () => '/auth',
}));

let providers = new Set(['google', 'github']);
vi.mock('@/app/auth/oauthProviders', () => ({
  useEnabledOAuthProviders: () => ({ enabled: providers, loaded: true }),
}));

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => new Response('{}')) as unknown as typeof fetch;
});
afterEach(() => {
  cleanup();
  search = new URLSearchParams('');
  providers = new Set(['google', 'github']);
});

/** Buttons that carry the warm accent (Button's `accent` variant). */
function accentButtons() {
  return screen.getAllByRole('button').filter(b => /\bbg-accent-warm\b/.test(b.className));
}

describe('one accent per side', () => {
  it('signing in: the only orange button is "Sign in"', () => {
    render(<AuthPageClient clientName={null} emailCodeAvailable />);
    const accents = accentButtons();
    expect(accents).toHaveLength(1);
    expect(accents[0]).toHaveTextContent('Sign in');
    // The no-email way in is still offered, quietly, and says what it does.
    const anon = screen.getByRole('button', { name: /Try it without an account/ });
    expect(anon.className).not.toMatch(/\bbg-accent-warm\b/);
  });

  it('creating an account: the only orange button is "Start instantly"', () => {
    search = new URLSearchParams('mode=register');
    render(<AuthPageClient clientName={null} emailCodeAvailable />);
    const accents = accentButtons();
    expect(accents).toHaveLength(1);
    expect(accents[0]).toHaveTextContent('Start instantly');
  });

  it('a password reset is a recovery step, not a conversion', () => {
    search = new URLSearchParams('mode=forgot');
    render(<AuthPageClient clientName={null} emailCodeAvailable />);
    expect(accentButtons()).toHaveLength(0);
  });
});

describe('the switch between signing in and creating an account', () => {
  it('sits under the title as two equal cells and changes the side', () => {
    render(<AuthPageClient clientName={null} emailCodeAvailable />);
    const group = screen.getByRole('group', { name: 'Sign in or create an account' });
    expect(group).toBeInTheDocument();
    const create = screen.getByRole('button', { name: 'Create account' });
    expect(create.className).toMatch(/\bmin-h-11\b/);
    fireEvent.click(create);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Get started');
  });
});

describe('provider buttons', () => {
  it('keep their names when two fit side by side', () => {
    render(
      <AuthSocialLogin mode="login" setMode={() => {}} loading={false} onOAuthSignIn={() => {}} />
    );
    const google = screen.getByRole('button', { name: /Google/ });
    expect(google.querySelector('span')?.className).not.toMatch(/sm:hidden/);
    expect(google.className).toMatch(/\bborder-default\b/);
  });

  it('become icons from sm only when four share the row, and are labelled then', () => {
    providers = new Set(['google', 'github', 'x', 'linkedin']);
    render(
      <AuthSocialLogin
        mode="register"
        setMode={() => {}}
        loading={false}
        onOAuthSignIn={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: 'Sign up with Google' })).toBeInTheDocument();
  });
});

describe('field problems sit under their field', () => {
  it('an empty form is not sent and says what is missing, without a retry', () => {
    render(<AuthPageClient clientName={null} emailCodeAvailable />);
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    expect(screen.getByText(AUTH_ERROR_COPY.emailMissing)).toBeInTheDocument();
    expect(screen.getByText(AUTH_ERROR_COPY.passwordMissing)).toBeInTheDocument();
    expect(document.getElementById('email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('button', { name: /Try again/i })).toBeNull();
  });

  it('validates each field in plain words', () => {
    expect(
      validateAuthFields('login', { email: 'ana', password: 'x', confirmPassword: '' })
    ).toEqual({ email: AUTH_ERROR_COPY.emailInvalid });
    expect(
      validateAuthFields('register', {
        email: 'ana@example.org',
        password: 'one',
        confirmPassword: 'two',
      })
    ).toEqual({ confirmPassword: AUTH_ERROR_COPY.confirmMismatch });
    expect(validateAuthFields('forgot', { email: '', password: '', confirmPassword: '' })).toEqual({
      email: AUTH_ERROR_COPY.emailMissing,
    });
  });
});

describe('server failures', () => {
  it.each([
    ['Invalid login credentials', false],
    ['Email not confirmed', false],
    ['User already registered', false],
    ['Request timed out. Please check your internet connection or try again later.', true],
    ['Too many attempts right now. Please wait a few minutes, then try again.', true],
  ])('"%s" offers a retry: %s', (raw, retryable) => {
    expect(describeAuthFailure(raw).retryable).toBe(retryable);
  });
});

describe('where a sign-in lands (auth-firstrun #1)', () => {
  it('a new person meets the Cat, whichever button they used', () => {
    expect(
      landingAfterSignIn({ from: null, isNewAccount: true, onboardingCompleted: undefined })
    ).toBe(ROUTES.DASHBOARD.CAT_WELCOME);
    expect(
      landingAfterSignIn({ from: null, isNewAccount: false, onboardingCompleted: false })
    ).toBe(ROUTES.DASHBOARD.CAT_WELCOME);
  });

  it('a returning person gets their dashboard', () => {
    expect(landingAfterSignIn({ from: null, isNewAccount: false, onboardingCompleted: true })).toBe(
      ROUTES.DASHBOARD.HOME
    );
  });

  it('honours an own-origin `from` and refuses another site', () => {
    expect(
      landingAfterSignIn({
        from: '/dashboard/store',
        isNewAccount: true,
        onboardingCompleted: false,
      })
    ).toBe('/dashboard/store');
    expect(
      landingAfterSignIn({ from: '//evil.example', isNewAccount: false, onboardingCompleted: true })
    ).toBe(ROUTES.DASHBOARD.HOME);
  });
});
