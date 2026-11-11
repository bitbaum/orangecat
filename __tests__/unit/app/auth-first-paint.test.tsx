// @vitest-environment jsdom
/**
 * /auth must paint its form from the server, and hydrate without a mismatch.
 *
 * Two defects seen on production (Chromium, 390px, fresh browser):
 *
 * 1. React error #418 on every load. PasskeySignInButton asked
 *    browserSupportsPasskeys() during render: the server has no window and
 *    rendered nothing, the browser has PublicKeyCredential and rendered the
 *    button, so the HTML did not match. The test renders the server pass with
 *    no PublicKeyCredential, then hydrates in a "browser" that has one.
 *
 * 2. With JavaScript off the page was empty. src/app/auth/loading.tsx put a
 *    Suspense boundary above the page, so the form streamed in a hidden
 *    segment that only an inline script reveals; without JS the visitor saw
 *    the skeleton, which has no text at all.
 */
import { existsSync } from 'fs';
import { join } from 'path';
import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import AuthPageClient from '@/app/auth/AuthPageClient';

vi.unmock('@/stores/auth');
vi.mock('next/navigation', () => {
  const searchParams = new URLSearchParams('');
  return {
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
    useSearchParams: () => searchParams,
    usePathname: () => '/auth',
  };
});

// Production has passkeys switched on at the auth server.
const page = <AuthPageClient clientName={null} emailCodeAvailable passkeysAvailable />;

type WithPasskeys = { PublicKeyCredential?: unknown };

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => new Response('{}')) as unknown as typeof fetch;
  delete (window as WithPasskeys).PublicKeyCredential;
});

afterEach(() => {
  delete (window as WithPasskeys).PublicKeyCredential;
  document.body.innerHTML = '';
});

describe('/auth first paint', () => {
  it('hydrates without a mismatch in a browser that supports passkeys', async () => {
    // Server pass: no PublicKeyCredential, as on Node.
    const html = renderToString(page);

    // Browser: has passkeys.
    (window as WithPasskeys).PublicKeyCredential = function PublicKeyCredential() {};
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    const recoverable: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, page, { onRecoverableError: error => recoverable.push(error) });
    });

    expect(recoverable).toEqual([]);
    // The button still arrives, right after hydration.
    expect(container.textContent).toContain('Sign in with a passkey');
  });

  it('server-renders the sign-in form itself, not a placeholder', () => {
    const html = renderToString(page);

    expect(html).toContain('<form');
    expect(html).toContain('id="email"');
    expect(html).toContain('id="password"');
    expect(html).toContain('type="submit"');
  });

  it('has no loading.tsx above the page, so the form is not hidden behind a stream', () => {
    // A segment loading.tsx wraps the page in Suspense: the form then ships in
    // a `<div hidden>` that only JavaScript reveals. Same check as audit-routes.
    const appDir = join(process.cwd(), 'src/app');
    expect(existsSync(join(appDir, 'loading.tsx'))).toBe(false);
    expect(existsSync(join(appDir, 'auth/loading.tsx'))).toBe(false);
  });
});
