// @vitest-environment jsdom
/**
 * A pay link must open on the amount field, not on a spinner.
 *
 * /pay/<username> exists to be handed to someone else, so its first paint is
 * the whole product. It used to render a spinner while the browser asked
 * whether the recipient could receive — a question the server had already
 * answered on its way to rendering the page. Passing that answer down removes
 * both the spinner and the round trip.
 *
 * The modal keeps the client-side check: a wallet can be connected between
 * opening it twice, so there the question is genuinely open each time.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { PayFlow } from '@/components/payment/PayFlow';
import { fetchTipReceiveInfo } from '@/services/tips/tip-client';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/services/tips/tip-client', () => ({
  fetchTipReceiveInfo: vi.fn(),
  fetchTipInvoice: vi.fn(),
  fetchTipStatus: vi.fn(),
}));
vi.mock('@/hooks/useUserCurrency', () => ({ useUserCurrency: () => 'CHF' }));

const receiveInfoMock = fetchTipReceiveInfo as Mock;

beforeEach(() => {
  vi.clearAllMocks();
  receiveInfoMock.mockResolvedValue({ canReceive: true, recipientName: 'Mao' });
});

describe('PayFlow first paint', () => {
  it('shows the amount field immediately when the server already checked', () => {
    render(<PayFlow username="mao" recipientName="Mao" initialCanReceive />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(receiveInfoMock).not.toHaveBeenCalled();
  });

  it('says so immediately when the server found no wallet', () => {
    render(<PayFlow username="mao" recipientName="Mao" initialCanReceive={false} />);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(/Mao/)).toBeInTheDocument();
    expect(receiveInfoMock).not.toHaveBeenCalled();
  });

  it('still asks the client when nothing was resolved up front (the modal)', async () => {
    render(<PayFlow username="mao" recipientName="Mao" />);

    expect(receiveInfoMock).toHaveBeenCalledWith('mao');
    await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument());
  });
});
