// @vitest-environment jsdom
/**
 * Two things a review of production found on Cat's pages (2026-11-12):
 *
 * - Cat settings fetched http://localhost:11434 and http://localhost:1234 on
 *   every load, before the person did anything: two refused connections and
 *   two console errors on every phone. The runtimes are now checked only when
 *   the person presses the check button; until then the setup steps show.
 * - /dashboard/cat had no h1 at all; its only heading was the empty chat's
 *   h2 greeting, gone once a chat is open. The page now names itself.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LocalRuntimePanel } from '@/components/ai/LocalRuntimePanel';
import { LOCAL_RUNTIMES } from '@/config/local-ai';
import { CAT_HUB_COPY } from '@/config/cat-hub';
import CatHubPage from '@/app/(authenticated)/dashboard/cat/page';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard/cat',
}));
vi.mock('@/hooks/useAuth', () => ({
  useRequireAuth: () => ({ user: { id: 'u1' }, isLoading: false }),
}));
vi.mock('@/components/ai-chat/ModernChatPanel/index', () => ({
  // An open chat: no greeting, so no heading of its own.
  ModernChatPanel: () => <div data-testid="chat" />,
}));
vi.mock('@/components/ai-chat/ModernChatPanel/hooks/useCatQuota', () => ({
  useCatQuota: () => ({ quota: null, refresh: vi.fn() }),
}));
vi.mock('@/components/ai-chat/CatChatToolbar', () => ({
  CatHeaderStart: () => null,
  CatHeaderEnd: () => null,
}));

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Cat settings — your own machine', () => {
  it('does not reach for localhost when the page loads', async () => {
    render(<LocalRuntimePanel />);
    // Give a mount effect every chance to have fired.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/Not detected/)).toBeNull();
  });

  it('shows how to set each runtime up before anything is checked', () => {
    render(<LocalRuntimePanel />);
    for (const runtime of LOCAL_RUNTIMES) {
      expect(screen.getByRole('link', { name: `Install ${runtime.name}` })).toBeInTheDocument();
      expect(screen.getByText(runtime.corsSetup)).toBeInTheDocument();
    }
  });

  it('checks this computer only when asked, then offers to check again', async () => {
    render(<LocalRuntimePanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Check this computer' }));

    await waitFor(() => expect(screen.getAllByText(/Not detected/)).toHaveLength(2));
    const probed = fetchMock.mock.calls.map(([url]) => String(url));
    expect(probed.sort()).toEqual(LOCAL_RUNTIMES.map(r => r.modelsUrl).sort());
    expect(screen.getByRole('button', { name: 'Check again' })).toBeEnabled();
  });

  it('lists what it found on a computer that runs one', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url === LOCAL_RUNTIMES[0].modelsUrl
        ? new Response(JSON.stringify({ data: [{ id: 'llama3.2' }] }), { status: 200 })
        : Promise.reject(new TypeError('Failed to fetch'))
    );
    render(<LocalRuntimePanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Check this computer' }));

    await waitFor(() => expect(screen.getByText(/Detected · 1 model/)).toBeInTheDocument());
    expect(screen.getByText('llama3.2')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: `Install ${LOCAL_RUNTIMES[0].name}` })
    ).not.toBeInTheDocument();
  });
});

describe('/dashboard/cat', () => {
  it('has one h1 naming the page while a chat is open', () => {
    render(<CatHubPage />);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(CAT_HUB_COPY.title);
  });
});
