// @vitest-environment jsdom
/**
 * The one failure that must not look like the others. Lightning gives no
 * "cancel": when a send times out the wallet may still be paying, and the old
 * screen dropped the person back on the form they had just filled in, with the
 * button live — one more tap was a second real payment. A timeout now lands on
 * its own screen, with nothing primed. An ordinary "no" still returns to the form.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SendError, sendToPerson } from '@/services/send/send-client';
import { SendScreen } from '@/components/send/SendScreen';
import type { Mock } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/send',
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/hooks/useAuth', () => ({ useRequireAuth: () => ({ isLoading: false }) }));
vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({ formatAmountBtc: (n: number) => `${n} BTC` }),
}));
vi.mock('@/hooks/usePeopleFinder', () => ({
  usePeopleFinder: () => ({ people: [], loading: false }),
}));
vi.mock('@/components/send/useRecipientCheck', () => ({
  useRecipientCheck: () => ({ state: 'ok', name: 'Lena', payable: true, recipientId: 'p1' }),
}));
vi.mock('@/components/money/AmountField', () => ({
  AmountField: ({ onChange }: { onChange: (btc: number) => void }) => (
    <button onClick={() => onChange(0.001)}>set amount</button>
  ),
}));
vi.mock('@/components/send/SendDestinationField', () => ({
  SendDestinationField: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input aria-label="To" value={value} onChange={e => onChange(e.target.value)} />
  ),
}));
vi.mock('@/services/send/send-client', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/send/send-client')>()),
  fetchSendCapability: async () => ({ canSend: true }),
  sendToPerson: vi.fn(),
}));

async function reviewAndConfirm() {
  render(<SendScreen />);
  fireEvent.change(await screen.findByLabelText('To'), { target: { value: 'lena' } });
  fireEvent.click(screen.getByRole('button', { name: 'set amount' }));
  fireEvent.click(screen.getByRole('button', { name: 'Review payment' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send payment' }));
}

beforeEach(() => vi.clearAllMocks());

describe('SendScreen — when a send does not finish', () => {
  it('a timeout gets its own screen, with nothing primed to pay again', async () => {
    (sendToPerson as Mock).mockRejectedValue(
      new SendError("We couldn't confirm this payment in time.", 'payment_unconfirmed')
    );
    await reviewAndConfirm();

    expect(await screen.findByText('Not confirmed yet')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Review payment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send payment' })).toBeNull();

    // Leaving it starts a clean form: nothing carried over from the attempt.
    fireEvent.click(screen.getByRole('button', { name: 'Back to Send' }));
    expect(((await screen.findByLabelText('To')) as HTMLInputElement).value).toBe('');
  });

  it('an ordinary refusal returns to the form with the reason', async () => {
    (sendToPerson as Mock).mockRejectedValue(
      new SendError('The payment did not go through.', 'payment_failed')
    );
    await reviewAndConfirm();

    await waitFor(() => expect(screen.getByText('The payment did not go through.')).toBeTruthy());
    expect(screen.queryByText('Not confirmed yet')).toBeNull();
  });
});
