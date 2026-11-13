// @vitest-environment jsdom
/**
 * /events on orangecat.ch (2026-11-12) promised event analytics, media tools,
 * automated attendee updates and real-time tracking that do not exist; its
 * only CTA signed visitors in with `redirect=`, which nothing reads, so they
 * landed on /dashboard; and at the widest distance "Events near you" still
 * said "Widen the distance".
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EventsPage from '@/app/events/page';
import EventsNearYou from '@/components/events/EventsNearYou';
import { ENTITY_REGISTRY } from '@/config/entity-registry';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/events' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ session: null }) }));
vi.mock('@/lib/nominatim', async importOriginal => ({
  ...(await importOriginal<object>()),
  searchNominatim: async () => [{ lat: 47.37, lon: 8.54, mainText: 'Zürich' }],
}));

describe('/events', () => {
  it('claims only what ships', () => {
    render(<EventsPage />);
    const text = document.body.textContent ?? '';
    for (const claim of [
      'Event Analytics',
      'Event Media',
      'automated updates',
      'Real-time analytics',
      'send updates',
      'organizers worldwide',
    ]) {
      expect(text).not.toContain(claim);
    }
  });

  it('signing in from the CTA returns to event creation', () => {
    render(<EventsPage />);
    fireEvent.click(screen.getByRole('button', { name: /Create Your Event/ }));
    const url = new URL(push.mock.calls.at(-1)?.[0] ?? '', 'https://x');
    expect(url.searchParams.get('from')).toBe(ENTITY_REGISTRY.event.createPath);
    expect(url.searchParams.has('redirect')).toBe(false);
  });
});

describe('Events near you', () => {
  it('does not offer a wider distance at the widest one', async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { events: [] } }),
    })) as unknown as typeof fetch;
    render(<EventsNearYou />);
    fireEvent.change(screen.getByLabelText('Place to search around'), {
      target: { value: 'Zürich' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await screen.findByText(/Nothing on within 25 km/);
    expect(document.body.textContent).toContain('Widen the distance');

    fireEvent.change(screen.getByLabelText('Distance'), { target: { value: '100' } });
    await waitFor(() => expect(document.body.textContent).toContain('Nothing on within 100 km'));
    expect(document.body.textContent).not.toContain('Widen the distance');
  });
});
