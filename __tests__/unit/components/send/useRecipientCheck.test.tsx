// @vitest-environment jsdom
/**
 * Resolving the recipient before money moves.
 *
 * The contract worth locking down is that the preview never claims more than it
 * knows: a Lightning address is paid blind by definition (there is no OrangeCat
 * profile behind it) and must not be dressed up as a verified person, while an
 * unknown username must block the send rather than fall through to the server.
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useRecipientCheck } from '@/components/send/useRecipientCheck';
import { fetchTipReceiveInfo } from '@/services/tips/tip-client';

import type { Mock } from 'vitest';

vi.mock('@/services/tips/tip-client', () => ({ fetchTipReceiveInfo: vi.fn() }));

const fetchMock = fetchTipReceiveInfo as Mock;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRecipientCheck', () => {
  it('says nothing until something is typed', () => {
    const { result } = renderHook(() => useRecipientCheck('   '));
    expect(result.current.state).toBe('idle');
    expect(result.current.payable).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a Lightning address as payable but unverified — no lookup at all', () => {
    const { result } = renderHook(() => useRecipientCheck('lena@getalby.com'));
    expect(result.current.state).toBe('external');
    expect(result.current.payable).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolves a username to a real name that can be read back', async () => {
    fetchMock.mockResolvedValue({ canReceive: true, recipientName: 'Lena Brunner' });
    const { result } = renderHook(() => useRecipientCheck('lenabrunner'));

    await waitFor(() => expect(result.current.state).toBe('ok'));
    expect(result.current.name).toBe('Lena Brunner');
    expect(result.current.payable).toBe(true);
  });

  it('tolerates a leading @ the way the server does', async () => {
    fetchMock.mockResolvedValue({ canReceive: true, recipientName: 'Lena' });
    renderHook(() => useRecipientCheck('@lenabrunner'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('lenabrunner'));
  });

  it('refuses to mark a walletless recipient payable', async () => {
    fetchMock.mockResolvedValue({ canReceive: false, recipientName: 'Marco' });
    const { result } = renderHook(() => useRecipientCheck('marco'));

    await waitFor(() => expect(result.current.state).toBe('cannot_receive'));
    expect(result.current.payable).toBe(false);
  });

  it('blocks the send when nobody by that name exists', async () => {
    fetchMock.mockRejectedValue(new Error('not found'));
    const { result } = renderHook(() => useRecipientCheck('ghost'));

    await waitFor(() => expect(result.current.state).toBe('not_found'));
    expect(result.current.payable).toBe(false);
  });

  it('does not query on every keystroke', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue({ canReceive: true, recipientName: 'Lena' });

    const { rerender } = renderHook(({ value }) => useRecipientCheck(value), {
      initialProps: { value: 'l' },
    });
    rerender({ value: 'le' });
    rerender({ value: 'len' });
    rerender({ value: 'lena' });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('lena');
    vi.useRealTimers();
  });
});
