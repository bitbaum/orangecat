// @vitest-environment jsdom
/**
 * The profile pay card must ask the payment system whether money can arrive —
 * never infer it from `profiles.bitcoin_address` / `profiles.lightning_address`.
 * Those legacy columns are read by no payment path, so rendering them meant a
 * profile could advertise an address the platform would never invoice against.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { ProfileSupportSection } from '@/components/profile/ProfileSupportSection';
import { fetchTipReceiveInfo } from '@/services/tips/tip-client';

import type { Mock } from 'vitest';

vi.mock('@/services/tips/tip-client', () => ({
  fetchTipReceiveInfo: vi.fn(),
}));
vi.mock('@/components/tips/TipButton', () => ({
  __esModule: true,
  default: ({ username }: { username: string }) => <button>tip:{username}</button>,
}));
vi.mock('@/components/receive/SharePayLink', () => ({
  SharePayLink: ({ username }: { username: string }) => <div>share:{username}</div>,
}));

const receiveInfoMock = fetchTipReceiveInfo as Mock;

beforeEach(() => vi.clearAllMocks());

describe('ProfileSupportSection', () => {
  it('asks the payment system, not the profile row', async () => {
    receiveInfoMock.mockResolvedValue({ canReceive: true, recipientName: 'Lena' });
    render(<ProfileSupportSection username="lena" displayName="Lena" />);
    await waitFor(() => expect(receiveInfoMock).toHaveBeenCalledWith('lena'));
  });

  it('shows a pay affordance when money can actually arrive', async () => {
    receiveInfoMock.mockResolvedValue({ canReceive: true, recipientName: 'Lena' });
    render(<ProfileSupportSection username="lena" displayName="Lena" />);
    expect(await screen.findByText('tip:lena')).toBeInTheDocument();
  });

  it('renders nothing when the recipient cannot receive', async () => {
    receiveInfoMock.mockResolvedValue({ canReceive: false, recipientName: 'Lena' });
    const { container } = render(<ProfileSupportSection username="lena" displayName="Lena" />);
    await waitFor(() => expect(receiveInfoMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('stays silent when the capability check fails — never guesses payable', async () => {
    receiveInfoMock.mockRejectedValue(new Error('network'));
    const { container } = render(<ProfileSupportSection username="lena" displayName="Lena" />);
    await waitFor(() => expect(receiveInfoMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('offers the shareable link only to the owner', async () => {
    receiveInfoMock.mockResolvedValue({ canReceive: true, recipientName: 'Lena' });

    const visitor = render(<ProfileSupportSection username="lena" displayName="Lena" />);
    await screen.findByText('tip:lena');
    expect(screen.queryByText('share:lena')).not.toBeInTheDocument();
    visitor.unmount();

    render(<ProfileSupportSection username="lena" displayName="Lena" isOwner />);
    expect(await screen.findByText('share:lena')).toBeInTheDocument();
  });
});
