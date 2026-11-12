// @vitest-environment jsdom
/**
 * A 404 under an app or marketing prefix must hydrate without a mismatch.
 *
 * Next.js renders a URL that matches no route (/discover/zzz,
 * /settings/security, /about/zzz) through its own /_not-found route. On the
 * server usePathname() then answers '/_not-found'; in the browser it answers
 * the address bar. The shell drew its chrome from that value, so the server
 * sent the public chrome (footer, no tab bar) and the browser drew the app
 * chrome: React #418 on every such page, signed in and out, and the chrome
 * swapped after load (production, 390px, 2026-11-12). /a/b/c did not throw only
 * because both sides happen to call it public.
 *
 * The test renders the server pass with the server's answer, then hydrates
 * with the browser's, as Next.js does. The selected top segment is the same on
 * both sides: it comes from the route tree the server sent. Next.js spells it
 * '/_not-found' in the build orangecat.ch serves and '_not-found' in a local
 * webpack build (the first version of this fix knew only one and still threw
 * #418 there), so both are tested.
 */
import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { AppShell } from '@/components/layout/AppShell';

const NOT_FOUND_SEGMENTS = ['/_not-found', '_not-found'];

let side: 'server' | 'browser' = 'server';
let address = '/';
let topSegment: string | null = null;

vi.mock('next/navigation', () => ({
  usePathname: () =>
    side === 'server' && topSegment !== null && NOT_FOUND_SEGMENTS.includes(topSegment)
      ? '/_not-found'
      : address,
  useSelectedLayoutSegment: () => topSegment,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// First render on both sides: the auth store has not read the session yet.
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, profile: null, session: null, hydrated: false, isLoading: false }),
}));
vi.mock('@/contexts/ComposerContext', () => ({ useComposer: () => ({ openComposer: vi.fn() }) }));

// Leaves that do not read the path. Each still draws an element, so a branch
// that shows or hides one on one side only is a mismatch here as it is live.
vi.mock('@/components/search/SearchTrigger', () => ({
  SearchTrigger: () => <button type="button">Search</button>,
  CommandPaletteHost: () => null,
}));
vi.mock('@/components/dashboard/HeaderCreateButton', () => ({
  HeaderCreateButton: () => <button type="button">Create</button>,
}));
vi.mock('@/components/notifications/NotificationCenter', () => ({ default: () => null }));
vi.mock('@/components/layout/HeaderActions', () => ({
  MessagesButton: () => <button type="button">Messages</button>,
  NotificationsButton: () => <button type="button">Notifications</button>,
}));
vi.mock('@/components/layout/EmailConfirmationBanner', () => ({
  EmailConfirmationBanner: () => null,
}));
vi.mock('@/components/layout/MobileMenu', () => ({
  MobileMenu: () => <div data-testid="marketing-menu" />,
}));
vi.mock('@/components/ui/UserProfileDropdown', () => ({ default: () => null }));
vi.mock('@/components/ui/ThemeToggle', () => ({ ThemeToggle: () => null }));
vi.mock('@/components/sidebar/Sidebar', () => ({ Sidebar: () => null }));
vi.mock('@/components/ai-chat/GlobalCatLauncher', () => ({ default: () => null }));
vi.mock('@/components/MessageSyncManagerInitializer', () => ({
  MessageSyncManagerInitializer: () => null,
}));
vi.mock('@/components/create/MobileCreateSheet', () => ({ MobileCreateSheet: () => null }));

const page = (
  <AppShell>
    <h1>Page Not Found</h1>
  </AppShell>
);

async function serverThenBrowser(url: string, segment: string | null) {
  address = url;
  topSegment = segment;

  side = 'server';
  const html = renderToString(page);

  side = 'browser';
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);

  const recoverable: unknown[] = [];
  const logged: string[] = [];
  const consoleError = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    logged.push(args.map(String).join(' '));
  });
  try {
    await act(async () => {
      hydrateRoot(container, page, { onRecoverableError: error => recoverable.push(error) });
    });
  } finally {
    consoleError.mockRestore();
  }
  const mismatches = logged.filter(line => /hydrat|did(n't| not) match/i.test(line));
  return { container, recoverable, mismatches };
}

afterEach(() => {
  document.body.innerHTML = '';
});

const notFoundCases = [
  '/discover/zzz',
  '/settings/security',
  '/messages/a/b',
  '/about/zzz',
  '/jobs/zzz',
].flatMap(url => NOT_FOUND_SEGMENTS.map(segment => [url, segment]));

describe('a 404 under a prefix hydrates its chrome as the server drew it', () => {
  it.each(notFoundCases)('%s (segment %s)', async (url, segment) => {
    const { container, recoverable, mismatches } = await serverThenBrowser(url, segment);

    expect(recoverable).toEqual([]);
    expect(mismatches).toEqual([]);
    // Every 404 wears the same chrome, the one /a/b/c always had.
    expect(container.querySelector('footer')).not.toBeNull();
    expect(container.querySelector('#main-content')?.className).not.toContain(
      'app-bottom-nav-clearance'
    );
  });
});

describe('a page that exists keeps the chrome of its own path', () => {
  it('an in-app page still clears the tab bar and has no marketing footer', async () => {
    const { container, recoverable } = await serverThenBrowser('/discover', 'discover');

    expect(recoverable).toEqual([]);
    expect(container.querySelector('footer')).toBeNull();
    expect(container.querySelector('#main-content')?.className).toContain(
      'app-bottom-nav-clearance'
    );
  });

  it('a marketing page still has its footer', async () => {
    const { container, recoverable } = await serverThenBrowser('/about', '(public)');

    expect(recoverable).toEqual([]);
    expect(container.querySelector('footer')).not.toBeNull();
  });
});
