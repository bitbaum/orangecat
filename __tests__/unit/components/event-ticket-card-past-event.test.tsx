// @vitest-environment jsdom
/**
 * An event that is over offers no ticket.
 *
 * Found live on 2026-11-12: an event dated Sunday, September 13, 2026 still
 * showed "Free entry", a name field and "Get a free ticket", and nothing on
 * the page said it was over. The ticket box decided from `status` alone, and
 * nothing ever moves a past event to 'completed'.
 */

import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import EventTicketCard from '@/components/events/EventTicketCard';

const getUser = vi.fn();
const getMyTicket = vi.fn();
const getSeatsLeft = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({ auth: { getUser } }),
}));
vi.mock('@/domain/events/tickets', async importOriginal => ({
  ...(await importOriginal<typeof import('@/domain/events/tickets')>()),
  getMyTicket: (...a: unknown[]) => getMyTicket(...a),
  getSeatsLeft: (...a: unknown[]) => getSeatsLeft(...a),
}));
vi.mock('@/utils/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
// The client pieces are stubs that name themselves: this file is about which
// of them the box offers, not how each behaves.
vi.mock('@/components/events/GuestTicketForm', () => ({
  default: () => <button>Get a free ticket</button>,
}));
vi.mock('@/components/events/ClaimTicketButton', () => ({
  default: ({ mode }: { mode: string }) => (
    <button>{mode === 'claim' ? 'Get a free ticket' : 'Give my place back'}</button>
  ),
}));
vi.mock('@/components/events/InviteLinkButton', () => ({
  default: () => <button>Copy invite link</button>,
}));
vi.mock('@/components/events/TicketQr', () => ({ default: () => <div>QR</div> }));

const DAY = 24 * 60 * 60 * 1000;
const at = (ms: number) => new Date(Date.now() + ms).toISOString();

const free = { id: 'ev-1', title: 'Open Bob', status: 'published', is_free: true };
const paid = { ...free, is_free: false, ticket_price: 20, currency: 'CHF' };
const past = { start_date: at(-60 * DAY) };
const future = { start_date: at(2 * DAY) };

async function box(event: Record<string, unknown>, isOwner = false) {
  render((await EventTicketCard({ event, isOwner })) as ReactElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: null } });
  getMyTicket.mockResolvedValue(null);
  getSeatsLeft.mockResolvedValue(null);
});

describe('the ticket box on an event that is over', () => {
  it('says so, and offers no free ticket — signed out or in', async () => {
    await box({ ...free, ...past });
    expect(screen.getByText('This event has ended.')).toBeInTheDocument();
    expect(screen.queryByText('Get a free ticket')).not.toBeInTheDocument();
    expect(screen.queryByText('Free entry')).not.toBeInTheDocument();
  });

  it('offers no ticket to someone signed in either', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-1' } } });
    await box({ ...free, ...past });
    expect(screen.getByText('This event has ended.')).toBeInTheDocument();
    expect(screen.queryByText('Get a free ticket')).not.toBeInTheDocument();
  });

  it('does not point a paid event at the pay panel', async () => {
    await box({ ...paid, ...past });
    expect(screen.getByText('This event has ended.')).toBeInTheDocument();
    expect(screen.queryByText(/Pay below/)).not.toBeInTheDocument();
  });

  it('counts an event as over at its end, not its start', async () => {
    await box({ ...free, start_date: at(-2 * 60 * 60 * 1000), end_date: at(3 * 60 * 60 * 1000) });
    expect(screen.getByText('Get a free ticket')).toBeInTheDocument();
    expect(screen.queryByText('This event has ended.')).not.toBeInTheDocument();
  });

  it('says so for an event its organizer marked completed', async () => {
    await box({ ...free, ...future, status: 'completed' });
    expect(screen.getByText('This event has ended.')).toBeInTheDocument();
  });

  it('still offers a ticket to an event that has not happened yet', async () => {
    await box({ ...free, ...future });
    expect(screen.getByText('Free entry')).toBeInTheDocument();
    expect(screen.getByText('Get a free ticket')).toBeInTheDocument();
  });

  it('keeps the ticket someone holds, without "show this at the door" or give-it-back', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u-1' } } });
    getMyTicket.mockResolvedValue({
      status: 'registered',
      ticket_count: 1,
      ticket_code: 'abcdef0123456789',
      payment_status: 'free',
      checked_in_at: null,
    });
    await box({ ...free, ...past });
    expect(screen.getByText('QR')).toBeInTheDocument();
    expect(screen.getByText('This event has ended.')).toBeInTheDocument();
    expect(screen.queryByText(/Show this at the door/)).not.toBeInTheDocument();
    expect(screen.queryByText('Give my place back')).not.toBeInTheDocument();
  });

  it('tells the organizer nobody can get a ticket, instead of handing out the invite link', async () => {
    await box({ ...free, ...past }, true);
    expect(
      screen.getByText(/This event has ended, so nobody can get a ticket/)
    ).toBeInTheDocument();
    expect(screen.queryByText('Copy invite link')).not.toBeInTheDocument();
    expect(screen.queryByText(/Anyone with the link/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open the door list/ })).toBeInTheDocument();
  });
});
