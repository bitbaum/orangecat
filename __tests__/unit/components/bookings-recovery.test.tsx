// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import BookingsPage from '@/app/(authenticated)/dashboard/bookings/page';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({ formatAmountBtc: vi.fn() }),
}));
vi.mock('@/components/entity/EntityListShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/app/(authenticated)/dashboard/bookings/components/BookingCard', () => ({
  default: ({ booking }: { booking: { id: string } }) => <p>Booking {booking.id}</p>,
}));

describe('booking recovery and view filters', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('reports HTTP failure and retries instead of claiming there are no bookings', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: 'Temporarily unavailable' }),
      })
      .mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) });
    vi.stubGlobal('fetch', fetcher);
    render(<BookingsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Temporarily unavailable');
    expect(screen.queryByText('No bookings found')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading bookings' }));
    await screen.findByText('No bookings found');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not let a history status hide incoming bookings', async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => ({
        success: true,
        data:
          new URL(url, 'https://orangecat.ch').searchParams.get('status') === 'pending'
            ? [{ id: 'incoming-fixture', status: 'pending' }]
            : [],
      }),
    }));
    vi.stubGlobal('fetch', fetcher);
    render(<BookingsPage />);
    await screen.findByText('Booking incoming-fixture');
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    await screen.findByText('No booking history yet');
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'completed' } });
    fireEvent.click(screen.getByRole('button', { name: /Incoming Requests/ }));
    await screen.findByText('Booking incoming-fixture');
    expect(screen.getByRole('button', { name: /Incoming Requests/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
