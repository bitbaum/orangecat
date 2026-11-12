// @vitest-environment jsdom
/**
 * Two /auth defects measured on production (390px):
 *
 * 1. A slow sign-in (auth request held, never answered). At 16 s the form
 *    said "Authentication request timed out. This usually means environment
 *    variables are not configured properly." while "Signing in…" still spun
 *    and Try Again was disabled; at 22 s the words changed to a bare
 *    "Authentication request timed out". Two clocks: the form's own 15 s
 *    timer, and the auth service's 20 s race whose words the error mapper
 *    missed ("timed out" is not "timeout"). A canned 429 showed GoTrue's raw
 *    "Request rate limit reached".
 * 2. In light mode the line of the "or sign in with email" / "Or continue
 *    with" dividers ran through the words: the label masked it with a 40%
 *    translucent background.
 */
import { act, render, renderHook, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { handleAuthError } from '@/services/supabase/auth/errors';
import { useAuthSubmission } from '@/app/auth/useAuthSubmission';
import { useAuthStore } from '@/stores/auth';
import AuthPageClient from '@/app/auth/AuthPageClient';
import { AuthSocialLogin } from '@/app/auth/AuthSocialLogin';

vi.unmock('@/stores/auth');

// The auth server never answers: what production showed with the request held.
vi.mock('@/lib/supabase/browser', () => ({
  default: {
    auth: {
      signInWithPassword: vi.fn(() => new Promise(() => {})),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    },
  },
}));

vi.mock('next/navigation', () => {
  const searchParams = new URLSearchParams('');
  return {
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => searchParams,
    usePathname: () => '/auth',
  };
});

vi.mock('@/app/auth/oauthProviders', () => ({
  useEnabledOAuthProviders: () => ({ enabled: new Set(['google', 'github']), loaded: true }),
}));

const PLAIN_TIMEOUT =
  'Request timed out. Please check your internet connection or try again later.';

describe('a slow sign-in', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useAuthStore.setState({ isLoading: false, authError: null, error: null });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function mountForm() {
    return renderHook(() =>
      useAuthSubmission({
        formData: { email: 'ana@example.org', password: 'a-password-1', confirmPassword: '' },
        mode: 'login',
        captchaEnabled: false,
        captchaToken: null,
        setCaptchaToken: () => {},
        setMode: () => {},
        setShowMFAVerify: () => {},
        rememberMe: true,
        signIn: (email, password, rememberMe) =>
          useAuthStore.getState().signIn(email, password, rememberMe),
        signUp: () => Promise.resolve({ data: null, error: null }),
      })
    );
  }

  it('has one timeout: no error while the request is still in flight', async () => {
    const { result } = mountForm();
    await act(async () => {
      void result.current.handleSubmit({ preventDefault: () => {} } as React.FormEvent);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });

    // Still signing in, and saying nothing yet: no error shows while every
    // button (Try Again included) is disabled by the store's loading flag.
    expect(result.current.error).toBeNull();
    expect(result.current.localLoading).toBe(true);
    expect(useAuthStore.getState().isLoading).toBe(true);
  });

  it('when the service gives up, says so in plain words and frees the buttons', async () => {
    const { result } = mountForm();
    await act(async () => {
      void result.current.handleSubmit({ preventDefault: () => {} } as React.FormEvent);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(result.current.error).toBe(PLAIN_TIMEOUT);
    expect(result.current.error).not.toMatch(/environment variables/i);
    // Both halves of `loading` are released, so Try Again can be pressed.
    expect(result.current.localLoading).toBe(false);
    expect(useAuthStore.getState().isLoading).toBe(false);

    // And the words do not change afterwards.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(result.current.error).toBe(PLAIN_TIMEOUT);
  });
});

describe('auth error words', () => {
  // Whichever 20 s clock fires first: the service's race, or the browser
  // client's fetch abort, which supabase-js hands on in the browser's words.
  it.each([
    ['Error', 'Authentication request timed out'],
    ['AuthRetryableFetchError', 'signal is aborted without reason'],
    ['AuthRetryableFetchError', 'The operation was aborted. '],
    ['AuthRetryableFetchError', 'Fetch is aborted'],
  ])('reads a %s "%s" as a timeout', (name, raw) => {
    const slow = Object.assign(new Error(raw), { name });
    expect(handleAuthError(slow, 'sign in').message).toBe(PLAIN_TIMEOUT);
  });

  it.each([
    ['over_request_rate_limit', 'Request rate limit reached'],
    ['over_email_send_rate_limit', 'email rate limit exceeded'],
  ])('maps a %s throttle by its code, not its prose', (code, raw) => {
    const gotrue = Object.assign(new Error(raw), { name: 'AuthApiError', status: 429, code });
    const mapped = handleAuthError(gotrue, 'sign in');
    expect(mapped.message).not.toContain(raw);
    expect(mapped.message).toMatch(/^Too many attempts/);
    expect(mapped.status).toBe(429);
  });
});

describe('/auth dividers', () => {
  // The rule must sit beside the words, not behind a mask over them.
  function expectRuleBesideLabel(label: HTMLElement) {
    expect(label.className).not.toMatch(/\bbg-/);
    const row = label.parentElement as HTMLElement;
    expect(row.className).toMatch(/\bflex\b/);
    expect(row.querySelector('.absolute')).toBeNull();
    const rules = Array.from(row.children).filter(child => child !== label);
    expect(rules).toHaveLength(2);
    for (const rule of rules) {
      expect(rule.getAttribute('aria-hidden')).toBe('true');
      expect(rule.className).toMatch(/\bborder-t\b/);
    }
  }

  it('"or sign in with email" is not struck through', () => {
    const container = document.createElement('div');
    container.innerHTML = renderToString(
      <AuthPageClient clientName={null} emailCodeAvailable passkeysAvailable={false} />
    );
    const label = Array.from(container.querySelectorAll('span')).find(
      span => span.textContent === 'or sign in with email'
    );
    expect(label).toBeDefined();
    expectRuleBesideLabel(label as HTMLElement);
  });

  it('"Or continue with" is not struck through', () => {
    render(
      <AuthSocialLogin mode="login" setMode={() => {}} loading={false} onOAuthSignIn={() => {}} />
    );
    expectRuleBesideLabel(screen.getByText('Or continue with'));
  });
});
