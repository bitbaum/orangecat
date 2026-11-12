// @vitest-environment jsdom
/**
 * Two sign-in defects reported from a phone:
 *
 * 1. The code step did not survive an interruption. Reading the code means
 *    leaving for the mail app; the browser may discard the tab, and on return
 *    the page reloaded to the password form with an empty code field.
 * 2. A throttled request read "We could not send a code." — a failure to
 *    retry, when the truth is "wait", and no way to enter a code already held.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EmailCodeSignIn } from '@/app/auth/EmailCodeSignIn';
import {
  codeRateLimitMessage,
  readPendingEmailCode,
  writePendingEmailCode,
} from '@/app/auth/pendingEmailCode';

vi.mock('@/lib/supabase/browser', () => ({
  default: { auth: { verifyOtp: vi.fn(async () => ({ error: null })) } },
}));
vi.mock('@/services/supabase/auth', () => ({
  getMFAAssuranceLevel: vi.fn(async () => ({ data: null })),
}));

function mount() {
  return render(
    <EmailCodeSignIn
      initialEmail="ana@example.org"
      clientId={null}
      captchaSiteKey={undefined}
      onBack={() => {}}
      onNeedsSecondFactor={() => {}}
    />
  );
}

function answer(status: number, headers: Record<string, string> = {}) {
  globalThis.fetch = vi.fn(
    async () => new Response(JSON.stringify({}), { status, headers })
  ) as unknown as typeof fetch;
}

const codeField = () => screen.getByLabelText('Code') as HTMLInputElement;

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('EmailCodeSignIn', () => {
  it('reopens the code step, with what was typed, after the page is reloaded', async () => {
    answer(200);
    const first = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
    await waitFor(() => codeField());
    fireEvent.change(codeField(), { target: { value: '482' } });
    expect(readPendingEmailCode()).toMatchObject({ email: 'ana@example.org', code: '482' });

    // The tab is discarded and reloaded: a fresh mount, same sessionStorage.
    first.unmount();
    mount();
    expect(codeField().value).toBe('482');
    expect(screen.getByText('ana@example.org')).toBeTruthy();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('forgets the step once the person asks for a different email', async () => {
    writePendingEmailCode({ email: 'ana@example.org', code: '48', sentAt: Date.now() });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Use a different email' }));
    expect(readPendingEmailCode()).toBeNull();
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });

  it('forgets the step once the code is accepted', async () => {
    writePendingEmailCode({ email: 'ana@example.org', code: '482913', sentAt: Date.now() });
    mount();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });
    await waitFor(() => expect(readPendingEmailCode()).toBeNull());
  });

  it('names the wait when throttled, and still lets a code already held be entered', async () => {
    answer(429, { 'Retry-After': '540' });
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('about 9 minutes');
    expect(alert.textContent).not.toMatch(/could not send/i);

    fireEvent.click(screen.getByRole('button', { name: 'I already have a code' }));
    expect(codeField()).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('pending code step', () => {
  it('is not offered again after fifteen minutes', () => {
    const sentAt = Date.now() - 16 * 60_000;
    writePendingEmailCode({ email: 'ana@example.org', code: '', sentAt });
    expect(readPendingEmailCode()).toBeNull();
  });

  it('ignores a record it did not write', () => {
    window.sessionStorage.setItem('oc.auth.email-code', '{"email":7}');
    expect(readPendingEmailCode()).toBeNull();
    window.sessionStorage.setItem('oc.auth.email-code', 'not json');
    expect(readPendingEmailCode()).toBeNull();
  });
});

describe('codeRateLimitMessage', () => {
  it('says how long to wait, or "a few minutes" when the server did not say', () => {
    expect(codeRateLimitMessage(45)).toContain('in a minute');
    expect(codeRateLimitMessage(600)).toContain('about 10 minutes');
    expect(codeRateLimitMessage(null)).toContain('a few minutes');
  });
});
